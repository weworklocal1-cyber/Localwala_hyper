import { AppError } from '@localwala/errors';
import type { AvailabilityState, Driver, DriverDocument, OnboardingState } from './driver.types.js';

export interface DriverQuery {
  userId?: string;
  onboardingState?: OnboardingState;
  availability?: AvailabilityState;
  suspended?: boolean;
  zoneId?: string;
  limit?: number;
}

export interface DriverRepository {
  saveDriver(driver: Driver): Promise<void>;
  findDriver(driverId: string): Promise<Driver | null>;
  findDriverByUserId(userId: string): Promise<Driver | null>;
  listDrivers(query: DriverQuery): Promise<Driver[]>;
  saveDocument(document: DriverDocument): Promise<void>;
  findDocument(documentId: string): Promise<DriverDocument | null>;
  listDocuments(driverId: string): Promise<DriverDocument[]>;
}

/**
 * STAGING ONLY — PostgreSQL driver store not implemented yet.
 * Throws SERVICE_UNAVAILABLE (503) on every operation (specification section 1).
 */
export class StagingDriverRepository implements DriverRepository {
  async saveDriver(): Promise<void> {
    this.blocked('saveDriver');
  }
  async findDriver(): Promise<null> {
    this.blocked('findDriver');
    return null;
  }
  async findDriverByUserId(): Promise<null> {
    this.blocked('findDriverByUserId');
    return null;
  }
  async listDrivers(): Promise<[]> {
    this.blocked('listDrivers');
    return [];
  }
  async saveDocument(): Promise<void> {
    this.blocked('saveDocument');
  }
  async findDocument(): Promise<null> {
    this.blocked('findDocument');
    return null;
  }
  async listDocuments(): Promise<[]> {
    this.blocked('listDocuments');
    return [];
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Driver repository not configured: ${op} blocked — PostgreSQL not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
