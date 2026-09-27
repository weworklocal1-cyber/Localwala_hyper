import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '@localwala/errors';
import {
  StagingTrackingRepository,
  type TrackingRepository,
} from '../../src/tracking/tracking.repository.js';
import { TrackingService } from '../../src/tracking/tracking.service.js';
import {
  MAX_TRAIL_POINTS,
  type SubjectType,
  type TrackingSnapshot,
} from '../../src/tracking/tracking.types.js';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

const DELIVERY = `dlv_${'a1b2c3d4'.repeat(4)}`;
const DRIVER = `drv_${'b1b2c3d4'.repeat(4)}`;
const OTHER_DELIVERY = `dlv_${'c1b2c3d4'.repeat(4)}`;

class InMemoryTrackingRepository implements TrackingRepository {
  readonly snapshots = new Map<string, TrackingSnapshot>();

  private key(subjectType: SubjectType, subjectId: string): string {
    return `${subjectType}:${subjectId}`;
  }

  async saveSnapshot(snapshot: TrackingSnapshot): Promise<void> {
    await tick();
    this.snapshots.set(
      this.key(snapshot.subjectType, snapshot.subjectId),
      structuredClone(snapshot),
    );
  }
  async findSnapshot(
    subjectType: SubjectType,
    subjectId: string,
  ): Promise<TrackingSnapshot | null> {
    await tick();
    const snapshot = this.snapshots.get(this.key(subjectType, subjectId));
    return snapshot ? structuredClone(snapshot) : null;
  }
  async deleteSnapshot(subjectType: SubjectType, subjectId: string): Promise<boolean> {
    await tick();
    return this.snapshots.delete(this.key(subjectType, subjectId));
  }
}

const expectError = async (operation: Promise<unknown>, code: string) => {
  const error = await operation.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  return error as AppError;
};

const location = (overrides: Record<string, unknown> = {}) => ({
  subjectType: 'delivery',
  subjectId: DELIVERY,
  lat: 19.076,
  lng: 72.8777,
  recordedAt: 1_760_000_000_000,
  ...overrides,
});

describe('TrackingService', () => {
  let repo: InMemoryTrackingRepository;
  let service: TrackingService;

  beforeEach(() => {
    repo = new InMemoryTrackingRepository();
    service = new TrackingService(repo);
  });

  it('records the first point with sequence 1', async () => {
    const result = await service.recordLocation(location());
    expect(result.sequence).toBe(1);
    expect(result.receivedAt).toBeGreaterThan(0);
    const snapshot = await service.getSnapshot('delivery', DELIVERY);
    expect(snapshot.sequence).toBe(1);
    expect(snapshot.last).toEqual({
      lat: 19.076,
      lng: 72.8777,
      recordedAt: 1_760_000_000_000,
    });
    expect(snapshot.trail).toHaveLength(1);
    expect(snapshot.startedAt).toBe(snapshot.updatedAt);
  });

  it('increments the sequence and appends to the trail', async () => {
    await service.recordLocation(location());
    const second = await service.recordLocation(location({ lat: 19.08, lng: 72.88 }));
    expect(second.sequence).toBe(2);
    const snapshot = await service.getSnapshot('delivery', DELIVERY);
    expect(snapshot.trail).toHaveLength(2);
    expect(snapshot.last.lat).toBe(19.08);
    expect(snapshot.updatedAt).toBeGreaterThanOrEqual(snapshot.startedAt);
  });

  it('keeps optional speed, heading and accuracy', async () => {
    await service.recordLocation(location({ speedKph: 32.5, heading: 180, accuracyM: 8 }));
    const snapshot = await service.getSnapshot('delivery', DELIVERY);
    expect(snapshot.last.speedKph).toBe(32.5);
    expect(snapshot.last.heading).toBe(180);
    expect(snapshot.last.accuracyM).toBe(8);
  });

  it('trims the trail to the maximum length keeping the newest points', async () => {
    for (let index = 0; index < MAX_TRAIL_POINTS + 5; index += 1) {
      await service.recordLocation(location({ lat: index / 1000 }));
    }
    const snapshot = await service.getSnapshot('delivery', DELIVERY);
    expect(snapshot.trail).toHaveLength(MAX_TRAIL_POINTS);
    expect(snapshot.sequence).toBe(MAX_TRAIL_POINTS + 5);
    expect(snapshot.trail[0]?.lat).toBeCloseTo(5 / 1000, 6);
    expect(snapshot.trail.at(-1)?.lat).toBeCloseTo((MAX_TRAIL_POINTS + 4) / 1000, 6);
  });

  it('tracks subjects independently', async () => {
    await service.recordLocation(location());
    await service.recordLocation(location({ subjectType: 'driver', subjectId: DRIVER, lat: 18.5 }));
    const deliverySnapshot = await service.getSnapshot('delivery', DELIVERY);
    const driverSnapshot = await service.getSnapshot('driver', DRIVER);
    expect(deliverySnapshot.sequence).toBe(1);
    expect(driverSnapshot.sequence).toBe(1);
    expect(driverSnapshot.last.lat).toBe(18.5);
  });

  it('returns 404 for an unknown subject snapshot', async () => {
    await expectError(service.getSnapshot('delivery', OTHER_DELIVERY), 'NOT_FOUND');
  });

  it('returns the trail newest first with a limit', async () => {
    for (let index = 1; index <= 5; index += 1) {
      await service.recordLocation(location({ lat: index }));
    }
    const trail = await service.listTrail({
      subjectType: 'delivery',
      subjectId: DELIVERY,
      limit: 3,
    });
    expect(trail.map((point) => point.lat)).toEqual([5, 4, 3]);
    const defaults = await service.listTrail({
      subjectType: 'delivery',
      subjectId: DELIVERY,
    });
    expect(defaults).toHaveLength(5);
  });

  it('returns 404 for an unknown subject trail', async () => {
    await expectError(
      service.listTrail({ subjectType: 'delivery', subjectId: OTHER_DELIVERY }),
      'NOT_FOUND',
    );
  });

  it('ends tracking and refuses a second delete', async () => {
    await service.recordLocation(location());
    const result = await service.endTracking({
      subjectType: 'delivery',
      subjectId: DELIVERY,
    });
    expect(result).toEqual({ subjectType: 'delivery', subjectId: DELIVERY });
    await expectError(
      service.endTracking({ subjectType: 'delivery', subjectId: DELIVERY }),
      'NOT_FOUND',
    );
    await expectError(service.getSnapshot('delivery', DELIVERY), 'NOT_FOUND');
  });

  it('records a batch and reports the last sequence', async () => {
    const result = await service.recordLocationBatch({
      updates: [
        location({ lat: 1 }),
        location({ lat: 2 }),
        location({ subjectType: 'driver', subjectId: DRIVER, lat: 3 }),
      ],
    });
    expect(result.recorded).toBe(3);
    expect(result.lastSequence).toBe(1);
    expect(await service.getSnapshot('delivery', DELIVERY)).toMatchObject({ sequence: 2 });
    expect(await service.getSnapshot('driver', DRIVER)).toMatchObject({ sequence: 1 });
  });

  it('rejects an empty batch', async () => {
    await expectError(service.recordLocationBatch({ updates: [] }), 'VALIDATION_ERROR');
  });

  it('rejects a batch over the size cap', async () => {
    const updates = Array.from({ length: 101 }, () => location());
    await expectError(service.recordLocationBatch({ updates }), 'VALIDATION_ERROR');
  });

  it('rejects coordinates outside valid ranges', async () => {
    await expectError(service.recordLocation(location({ lat: 91 })), 'VALIDATION_ERROR');
    await expectError(service.recordLocation(location({ lng: -181 })), 'VALIDATION_ERROR');
  });

  it('rejects a subject id that does not match the subject type', async () => {
    await expectError(service.recordLocation(location({ subjectId: DRIVER })), 'VALIDATION_ERROR');
    await expectError(
      service.recordLocation(location({ subjectType: 'driver', subjectId: DELIVERY })),
      'VALIDATION_ERROR',
    );
  });

  it('rejects a non-integer recordedAt', async () => {
    await expectError(service.recordLocation(location({ recordedAt: 1.5 })), 'VALIDATION_ERROR');
  });

  it('serialises concurrent updates so sequences never collide', async () => {
    const results = await Promise.all([
      service.recordLocation(location({ lat: 1 })),
      service.recordLocation(location({ lat: 2 })),
      service.recordLocation(location({ lat: 3 })),
    ]);
    const sequences = results.map((result) => result.sequence).sort();
    expect(sequences).toEqual([1, 2, 3]);
    expect((await service.getSnapshot('delivery', DELIVERY)).sequence).toBe(3);
    expect((await service.getSnapshot('delivery', DELIVERY)).trail).toHaveLength(3);
  });
});

describe('staging tracking repository', () => {
  const repo = new StagingTrackingRepository();
  const expectBlocked = async (operation: Promise<unknown>) => {
    const error = await operation.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('SERVICE_UNAVAILABLE');
    expect((error as AppError).message).toContain('Redis not available');
  };

  it('blocks snapshot operations', async () => {
    await expectBlocked(repo.saveSnapshot({} as TrackingSnapshot));
    await expectBlocked(repo.findSnapshot('delivery', DELIVERY));
    await expectBlocked(repo.deleteSnapshot('delivery', DELIVERY));
  });
});
