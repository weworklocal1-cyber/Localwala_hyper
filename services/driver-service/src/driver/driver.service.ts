import { AppError } from '@localwala/errors';
import type { DriverRepository } from './driver.repository.js';
import { KeyedMutex } from './keyed-mutex.js';
import {
  MAX_SERVICE_AREAS,
  newDriverId,
  newDocumentId,
  type Driver,
  type DriverDocument,
} from './driver.types.js';
import {
  parseCreateDocument,
  parseCreateDriver,
  parseListDrivers,
  parseReason,
  parseSetServiceAreas,
  parseSetVehicle,
} from '../schemas/driver.schema.js';

export class DriverService {
  private readonly mutex = new KeyedMutex();

  constructor(private readonly repo: DriverRepository) {}

  async createDriver(input: unknown): Promise<Driver> {
    const parsed = parseCreateDriver(input);
    return this.mutex.run(`driver:user:${parsed.userId}`, async () => {
      const existing = await this.repo.findDriverByUserId(parsed.userId);
      if (existing) {
        throw new AppError('CONFLICT', {
          message: 'A driver profile already exists for this user.',
          details: { userId: parsed.userId },
        });
      }
      const now = Date.now();
      const driver: Driver = {
        id: newDriverId(),
        userId: parsed.userId,
        onboardingState: 'pending',
        availability: 'offline',
        suspended: false,
        vehicle: parsed.vehicle,
        serviceAreaZoneIds: parsed.serviceAreaZoneIds ?? [],
        createdAt: now,
        updatedAt: now,
      };
      await this.repo.saveDriver(driver);
      return driver;
    });
  }

  async getDriver(driverId: string): Promise<Driver> {
    return this.requireDriver(driverId);
  }

  async listDrivers(query: unknown): Promise<Driver[]> {
    const parsed = parseListDrivers(query);
    const drivers = await this.repo.listDrivers({
      ...(parsed.userId !== undefined ? { userId: parsed.userId } : {}),
      ...(parsed.onboardingState !== undefined ? { onboardingState: parsed.onboardingState } : {}),
      ...(parsed.availability !== undefined ? { availability: parsed.availability } : {}),
      ...(parsed.suspended !== undefined ? { suspended: parsed.suspended === 'true' } : {}),
      ...(parsed.zoneId !== undefined ? { zoneId: parsed.zoneId } : {}),
      limit: parsed.limit,
    });
    return drivers.slice(0, parsed.limit);
  }

  async approve(driverId: string): Promise<Driver> {
    return this.mutex.run(`driver:${driverId}`, async () => {
      const driver = await this.requireDriver(driverId);
      if (driver.onboardingState === 'approved') {
        throw new AppError('CONFLICT', { message: 'Driver is already approved.' });
      }
      if (driver.onboardingState === 'rejected') {
        throw new AppError('CONFLICT', {
          message: 'A rejected driver cannot be approved without a new application.',
          details: { driverId },
        });
      }
      driver.onboardingState = 'approved';
      delete driver.onboardingReason;
      driver.updatedAt = Date.now();
      await this.repo.saveDriver(driver);
      return driver;
    });
  }

  async reject(driverId: string, input: unknown): Promise<Driver> {
    const reason = parseReason(input);
    return this.mutex.run(`driver:${driverId}`, async () => {
      const driver = await this.requireDriver(driverId);
      if (driver.onboardingState !== 'pending') {
        throw new AppError('CONFLICT', {
          message: `Only pending drivers can be rejected (state is "${driver.onboardingState}").`,
          details: { driverId },
        });
      }
      driver.onboardingState = 'rejected';
      driver.onboardingReason = reason.reason;
      if (driver.availability === 'online') driver.availability = 'offline';
      driver.updatedAt = Date.now();
      await this.repo.saveDriver(driver);
      return driver;
    });
  }

  async suspend(driverId: string, input: unknown): Promise<Driver> {
    const reason = parseReason(input);
    return this.mutex.run(`driver:${driverId}`, async () => {
      const driver = await this.requireDriver(driverId);
      if (driver.suspended) {
        throw new AppError('CONFLICT', { message: 'Driver is already suspended.' });
      }
      if (driver.onboardingState !== 'approved') {
        throw new AppError('CONFLICT', {
          message: 'Only approved drivers can be suspended.',
          details: { driverId },
        });
      }
      driver.suspended = true;
      driver.suspensionReason = reason.reason;
      driver.availability = 'offline';
      driver.updatedAt = Date.now();
      await this.repo.saveDriver(driver);
      return driver;
    });
  }

  async unsuspend(driverId: string): Promise<Driver> {
    return this.mutex.run(`driver:${driverId}`, async () => {
      const driver = await this.requireDriver(driverId);
      if (!driver.suspended) {
        throw new AppError('CONFLICT', { message: 'Driver is not suspended.' });
      }
      driver.suspended = false;
      delete driver.suspensionReason;
      driver.updatedAt = Date.now();
      await this.repo.saveDriver(driver);
      return driver;
    });
  }

  async goOnline(driverId: string): Promise<Driver> {
    return this.mutex.run(`driver:${driverId}`, async () => {
      const driver = await this.requireDriver(driverId);
      if (driver.availability === 'online') {
        throw new AppError('CONFLICT', { message: 'Driver is already online.' });
      }
      if (driver.onboardingState !== 'approved') {
        throw new AppError('CONFLICT', {
          message: 'Driver must be approved before going online.',
          details: { driverId, onboardingState: driver.onboardingState },
        });
      }
      if (driver.suspended) {
        throw new AppError('CONFLICT', {
          message: 'Suspended drivers cannot go online.',
          details: { driverId },
        });
      }
      if (driver.serviceAreaZoneIds.length === 0) {
        throw new AppError('CONFLICT', {
          message: 'Driver must have at least one service area before going online.',
          details: { driverId },
        });
      }
      driver.availability = 'online';
      driver.updatedAt = Date.now();
      await this.repo.saveDriver(driver);
      return driver;
    });
  }

  async goOffline(driverId: string): Promise<Driver> {
    return this.mutex.run(`driver:${driverId}`, async () => {
      const driver = await this.requireDriver(driverId);
      if (driver.availability === 'offline') {
        throw new AppError('CONFLICT', { message: 'Driver is already offline.' });
      }
      driver.availability = 'offline';
      driver.updatedAt = Date.now();
      await this.repo.saveDriver(driver);
      return driver;
    });
  }

  async setVehicle(driverId: string, input: unknown): Promise<Driver> {
    const parsed = parseSetVehicle(input);
    return this.mutex.run(`driver:${driverId}`, async () => {
      const driver = await this.requireDriver(driverId);
      driver.vehicle = parsed.vehicle;
      driver.updatedAt = Date.now();
      await this.repo.saveDriver(driver);
      return driver;
    });
  }

  async setServiceAreas(driverId: string, input: unknown): Promise<Driver> {
    const parsed = parseSetServiceAreas(input);
    return this.mutex.run(`driver:${driverId}`, async () => {
      const driver = await this.requireDriver(driverId);
      const unique = [...new Set(parsed.zoneIds)];
      if (unique.length > MAX_SERVICE_AREAS) {
        throw new AppError('VALIDATION_ERROR', {
          message: 'Request payload failed validation',
          details: [
            { path: 'zoneIds', message: `must contain at most ${MAX_SERVICE_AREAS} unique zones` },
          ],
        });
      }
      driver.serviceAreaZoneIds = unique;
      driver.updatedAt = Date.now();
      await this.repo.saveDriver(driver);
      return driver;
    });
  }

  async createDocument(driverId: string, input: unknown): Promise<DriverDocument> {
    const parsed = parseCreateDocument(input);
    return this.mutex.run(`driver:${driverId}`, async () => {
      await this.requireDriver(driverId);
      const now = Date.now();
      const document: DriverDocument = {
        id: newDocumentId(),
        driverId,
        type: parsed.type,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      if (parsed.number !== undefined) document.number = parsed.number;
      if (parsed.expiresAt !== undefined) document.expiresAt = parsed.expiresAt;
      await this.repo.saveDocument(document);
      return document;
    });
  }

  async listDocuments(driverId: string): Promise<DriverDocument[]> {
    await this.requireDriver(driverId);
    return this.repo.listDocuments(driverId);
  }

  async verifyDocument(driverId: string, documentId: string): Promise<DriverDocument> {
    return this.mutex.run(`document:${documentId}`, async () => {
      const document = await this.requireDocument(driverId, documentId);
      if (document.status === 'verified') {
        throw new AppError('CONFLICT', { message: 'Document is already verified.' });
      }
      document.status = 'verified';
      delete document.rejectReason;
      document.updatedAt = Date.now();
      await this.repo.saveDocument(document);
      return document;
    });
  }

  async rejectDocument(
    driverId: string,
    documentId: string,
    input: unknown,
  ): Promise<DriverDocument> {
    const reason = parseReason(input);
    return this.mutex.run(`document:${documentId}`, async () => {
      const document = await this.requireDocument(driverId, documentId);
      if (document.status === 'rejected') {
        throw new AppError('CONFLICT', { message: 'Document is already rejected.' });
      }
      document.status = 'rejected';
      document.rejectReason = reason.reason;
      document.updatedAt = Date.now();
      await this.repo.saveDocument(document);
      return document;
    });
  }

  private async requireDriver(driverId: string): Promise<Driver> {
    const driver = await this.repo.findDriver(driverId);
    if (!driver) {
      throw new AppError('NOT_FOUND', { message: 'Driver not found.' });
    }
    return driver;
  }

  private async requireDocument(driverId: string, documentId: string): Promise<DriverDocument> {
    const document = await this.repo.findDocument(documentId);
    if (!document || document.driverId !== driverId) {
      throw new AppError('NOT_FOUND', { message: 'Document not found.' });
    }
    return document;
  }
}
