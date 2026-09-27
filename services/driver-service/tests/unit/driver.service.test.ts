import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '@localwala/errors';
import {
  StagingDriverRepository,
  type DriverQuery,
  type DriverRepository,
} from '../../src/driver/driver.repository.js';
import { DriverService } from '../../src/driver/driver.service.js';
import type { Driver, DriverDocument } from '../../src/driver/driver.types.js';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

const USER = 'usr_driver_1';
const ZONE = 'zone_central';

class InMemoryDriverRepository implements DriverRepository {
  readonly drivers = new Map<string, Driver>();
  readonly documents = new Map<string, DriverDocument>();

  async saveDriver(driver: Driver): Promise<void> {
    await tick();
    this.drivers.set(driver.id, structuredClone(driver));
  }
  async findDriver(driverId: string): Promise<Driver | null> {
    await tick();
    const driver = this.drivers.get(driverId);
    return driver ? structuredClone(driver) : null;
  }
  async findDriverByUserId(userId: string): Promise<Driver | null> {
    await tick();
    for (const driver of this.drivers.values()) {
      if (driver.userId === userId) return structuredClone(driver);
    }
    return null;
  }
  async listDrivers(query: DriverQuery): Promise<Driver[]> {
    await tick();
    return [...this.drivers.values()]
      .filter((driver) => query.userId === undefined || driver.userId === query.userId)
      .filter(
        (driver) =>
          query.onboardingState === undefined || driver.onboardingState === query.onboardingState,
      )
      .filter(
        (driver) => query.availability === undefined || driver.availability === query.availability,
      )
      .filter((driver) => query.suspended === undefined || driver.suspended === query.suspended)
      .filter(
        (driver) => query.zoneId === undefined || driver.serviceAreaZoneIds.includes(query.zoneId),
      )
      .slice(0, query.limit ?? 50)
      .map((driver) => structuredClone(driver));
  }
  async saveDocument(document: DriverDocument): Promise<void> {
    await tick();
    this.documents.set(document.id, structuredClone(document));
  }
  async findDocument(documentId: string): Promise<DriverDocument | null> {
    await tick();
    const document = this.documents.get(documentId);
    return document ? structuredClone(document) : null;
  }
  async listDocuments(driverId: string): Promise<DriverDocument[]> {
    await tick();
    return [...this.documents.values()]
      .filter((document) => document.driverId === driverId)
      .map((document) => structuredClone(document));
  }
}

const expectError = async (operation: Promise<unknown>, code: string) => {
  const error = await operation.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  return error as AppError;
};

describe('DriverService', () => {
  let repo: InMemoryDriverRepository;
  let service: DriverService;

  beforeEach(() => {
    repo = new InMemoryDriverRepository();
    service = new DriverService(repo);
  });

  const createDriver = (overrides: Record<string, unknown> = {}) =>
    service.createDriver({
      userId: USER,
      vehicle: { type: 'motorcycle', registrationNumber: 'MH-12-AB-1234', capacityKg: 20 },
      serviceAreaZoneIds: [ZONE],
      ...overrides,
    });

  const approvedDriver = async () => {
    const driver = await createDriver();
    await service.approve(driver.id);
    return driver;
  };

  describe('onboarding', () => {
    it('creates a pending, offline driver', async () => {
      const driver = await createDriver();
      expect(driver.id).toMatch(/^drv_[0-9a-f]{32}$/);
      expect(driver.onboardingState).toBe('pending');
      expect(driver.availability).toBe('offline');
      expect(driver.suspended).toBe(false);
      expect(driver.serviceAreaZoneIds).toEqual([ZONE]);
    });

    it('rejects a duplicate driver for the same user', async () => {
      await createDriver();
      await expectError(createDriver(), 'CONFLICT');
    });

    it('approves a pending driver', async () => {
      const driver = await createDriver();
      const approved = await service.approve(driver.id);
      expect(approved.onboardingState).toBe('approved');
      expect(approved.updatedAt).toBeGreaterThanOrEqual(driver.updatedAt);
    });

    it('rejects approving an already approved driver', async () => {
      const driver = await approvedDriver();
      await expectError(service.approve(driver.id), 'CONFLICT');
    });

    it('rejects approving a rejected driver', async () => {
      const driver = await createDriver();
      await service.reject(driver.id, { reason: 'document mismatch' });
      await expectError(service.approve(driver.id), 'CONFLICT');
    });

    it('rejects a pending driver with a reason', async () => {
      const driver = await createDriver();
      const rejected = await service.reject(driver.id, { reason: 'fraud review' });
      expect(rejected.onboardingState).toBe('rejected');
      expect(rejected.onboardingReason).toBe('fraud review');
    });

    it('requires a reason when rejecting', async () => {
      const driver = await createDriver();
      await expectError(service.reject(driver.id, {}), 'VALIDATION_ERROR');
      await expectError(service.reject(driver.id, { reason: '  ' }), 'VALIDATION_ERROR');
    });

    it('only allows rejecting pending drivers', async () => {
      const driver = await approvedDriver();
      await expectError(service.reject(driver.id, { reason: 'late docs' }), 'CONFLICT');
    });

    it('goes online only after service areas exist', async () => {
      const driver = await createDriver({ serviceAreaZoneIds: [] });
      await service.approve(driver.id);
      await expectError(service.goOnline(driver.id), 'CONFLICT');
      await service.setServiceAreas(driver.id, { zoneIds: [ZONE] });
      const online = await service.goOnline(driver.id);
      expect(online.availability).toBe('online');
    });
  });

  describe('availability', () => {
    it('blocks going online before approval', async () => {
      const driver = await createDriver();
      await expectError(service.goOnline(driver.id), 'CONFLICT');
    });

    it('blocks going online without service areas', async () => {
      const driver = await createDriver({ serviceAreaZoneIds: [] });
      await service.approve(driver.id);
      const error = await expectError(service.goOnline(driver.id), 'CONFLICT');
      expect(error.message).toContain('service area');
    });

    it('takes an approved driver with areas online and back offline', async () => {
      const driver = await approvedDriver();
      const online = await service.goOnline(driver.id);
      expect(online.availability).toBe('online');
      const offline = await service.goOffline(driver.id);
      expect(offline.availability).toBe('offline');
    });

    it('rejects redundant online/offline transitions', async () => {
      const driver = await approvedDriver();
      await service.goOnline(driver.id);
      await expectError(service.goOnline(driver.id), 'CONFLICT');
      await service.goOffline(driver.id);
      await expectError(service.goOffline(driver.id), 'CONFLICT');
    });

    it('serialises racing online requests so exactly one wins', async () => {
      const driver = await approvedDriver();
      const results = await Promise.allSettled([
        service.goOnline(driver.id),
        service.goOnline(driver.id),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    });
  });

  describe('suspension', () => {
    it('suspends an approved driver and forces them offline', async () => {
      const driver = await approvedDriver();
      await service.goOnline(driver.id);
      const suspended = await service.suspend(driver.id, { reason: 'accident report' });
      expect(suspended.suspended).toBe(true);
      expect(suspended.suspensionReason).toBe('accident report');
      expect(suspended.availability).toBe('offline');
    });

    it('rejects suspending a non-approved driver', async () => {
      const driver = await createDriver();
      await expectError(service.suspend(driver.id, { reason: 'x' }), 'CONFLICT');
    });

    it('rejects double suspension', async () => {
      const driver = await approvedDriver();
      await service.suspend(driver.id, { reason: 'first' });
      await expectError(service.suspend(driver.id, { reason: 'second' }), 'CONFLICT');
    });

    it('blocks a suspended driver from going online', async () => {
      const driver = await approvedDriver();
      await service.suspend(driver.id, { reason: 'verification' });
      await expectError(service.goOnline(driver.id), 'CONFLICT');
    });

    it('unsuspends a driver', async () => {
      const driver = await approvedDriver();
      await service.suspend(driver.id, { reason: 'check' });
      const restored = await service.unsuspend(driver.id);
      expect(restored.suspended).toBe(false);
      expect(restored.suspensionReason).toBeUndefined();
      const online = await service.goOnline(driver.id);
      expect(online.availability).toBe('online');
    });

    it('rejects unsuspending a driver who is not suspended', async () => {
      const driver = await approvedDriver();
      await expectError(service.unsuspend(driver.id), 'CONFLICT');
    });
  });

  describe('vehicle and service areas', () => {
    it('replaces the vehicle', async () => {
      const driver = await createDriver();
      const updated = await service.setVehicle(driver.id, {
        vehicle: { type: 'van', capacityKg: 200 },
      });
      expect(updated.vehicle).toEqual({ type: 'van', capacityKg: 200 });
      expect(updated.vehicle.registrationNumber).toBeUndefined();
    });

    it('rejects an invalid vehicle type', async () => {
      const driver = await createDriver();
      await expectError(
        service.setVehicle(driver.id, { vehicle: { type: 'hoverboard' } }),
        'VALIDATION_ERROR',
      );
    });

    it('replaces service areas and deduplicates zones', async () => {
      const driver = await createDriver();
      const updated = await service.setServiceAreas(driver.id, {
        zoneIds: ['zone_a', 'zone_b', 'zone_a'],
      });
      expect(updated.serviceAreaZoneIds).toEqual(['zone_a', 'zone_b']);
    });

    it('rejects more than the unique zone cap', async () => {
      const driver = await createDriver();
      const zoneIds = Array.from({ length: 21 }, (_, index) => `zone_${index}`);
      await expectError(service.setServiceAreas(driver.id, { zoneIds }), 'VALIDATION_ERROR');
    });
  });

  describe('documents', () => {
    it('creates a pending document', async () => {
      const driver = await createDriver();
      const document = await service.createDocument(driver.id, {
        type: 'license',
        number: 'DL-123456',
        expiresAt: '2027-06-30',
      });
      expect(document.id).toMatch(/^dcm_[0-9a-f]{32}$/);
      expect(document.status).toBe('pending');
      expect(document.driverId).toBe(driver.id);
    });

    it('rejects document creation for an unknown driver', async () => {
      await expectError(
        service.createDocument(`drv_${'a'.repeat(32)}`, { type: 'license' }),
        'NOT_FOUND',
      );
    });

    it('verifies a document once', async () => {
      const driver = await createDriver();
      const document = await service.createDocument(driver.id, { type: 'insurance' });
      const verified = await service.verifyDocument(driver.id, document.id);
      expect(verified.status).toBe('verified');
      expect(verified.updatedAt).toBeGreaterThanOrEqual(document.updatedAt);
      await expectError(service.verifyDocument(driver.id, document.id), 'CONFLICT');
    });

    it('rejects a document with a reason', async () => {
      const driver = await createDriver();
      const document = await service.createDocument(driver.id, { type: 'id_proof' });
      const rejected = await service.rejectDocument(driver.id, document.id, {
        reason: 'photo blurry',
      });
      expect(rejected.status).toBe('rejected');
      expect(rejected.rejectReason).toBe('photo blurry');
      await expectError(
        service.rejectDocument(driver.id, document.id, { reason: 'again' }),
        'CONFLICT',
      );
    });

    it('requires a reason when rejecting a document', async () => {
      const driver = await createDriver();
      const document = await service.createDocument(driver.id, { type: 'id_proof' });
      await expectError(service.rejectDocument(driver.id, document.id, {}), 'VALIDATION_ERROR');
    });

    it('hides documents belonging to another driver', async () => {
      const first = await createDriver();
      const second = await createDriver({ userId: 'usr_driver_2' });
      const document = await service.createDocument(second.id, { type: 'license' });
      await expectError(service.verifyDocument(first.id, document.id), 'NOT_FOUND');
      await expectError(
        service.rejectDocument(first.id, document.id, { reason: 'x' }),
        'NOT_FOUND',
      );
    });

    it('lists documents for a driver', async () => {
      const driver = await createDriver();
      await service.createDocument(driver.id, { type: 'license' });
      await service.createDocument(driver.id, { type: 'insurance' });
      const documents = await service.listDocuments(driver.id);
      expect(documents).toHaveLength(2);
      await expectError(service.listDocuments(`drv_${'b'.repeat(32)}`), 'NOT_FOUND');
    });
  });

  describe('queries', () => {
    it('filters drivers by onboarding state, availability, suspension and zone', async () => {
      const first = await approvedDriver();
      await service.goOnline(first.id);
      await createDriver({ userId: 'usr_driver_2' });
      await createDriver({ userId: 'usr_driver_3', serviceAreaZoneIds: ['zone_north'] });

      const approved = await service.listDrivers({ onboardingState: 'approved' });
      expect(approved).toHaveLength(1);
      const online = await service.listDrivers({ availability: 'online' });
      expect(online.map((driver) => driver.id)).toEqual([first.id]);
      const pending = await service.listDrivers({ onboardingState: 'pending' });
      expect(pending).toHaveLength(2);
      const byZone = await service.listDrivers({ zoneId: 'zone_north' });
      expect(byZone).toHaveLength(1);
      const suspended = await service.listDrivers({ suspended: 'true' });
      expect(suspended).toHaveLength(0);
      const byUser = await service.listDrivers({ userId: 'usr_driver_2' });
      expect(byUser).toHaveLength(1);
    });
  });
});

describe('staging driver repository', () => {
  const repo = new StagingDriverRepository();
  const expectBlocked = async (operation: Promise<unknown>) => {
    const error = await operation.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('SERVICE_UNAVAILABLE');
    expect((error as AppError).message).toContain('PostgreSQL not available');
  };

  it('blocks driver and document operations', async () => {
    await expectBlocked(repo.saveDriver({} as Driver));
    await expectBlocked(repo.findDriver('drv_x'));
    await expectBlocked(repo.findDriverByUserId('usr_1'));
    await expectBlocked(repo.listDrivers({}));
    await expectBlocked(repo.saveDocument({} as DriverDocument));
    await expectBlocked(repo.findDocument('dcm_x'));
    await expectBlocked(repo.listDocuments('drv_x'));
  });
});
