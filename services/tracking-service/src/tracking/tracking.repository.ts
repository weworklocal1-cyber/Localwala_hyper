import { AppError } from '@localwala/errors';
import type { SubjectType, TrackingSnapshot } from './tracking.types.js';

export interface TrackingRepository {
  saveSnapshot(snapshot: TrackingSnapshot): Promise<void>;
  findSnapshot(subjectType: SubjectType, subjectId: string): Promise<TrackingSnapshot | null>;
  deleteSnapshot(subjectType: SubjectType, subjectId: string): Promise<boolean>;
}

/**
 * STAGING ONLY — Redis tracking store not implemented yet.
 * Throws SERVICE_UNAVAILABLE (503) on every operation (specification section 1).
 * Production stores one JSON snapshot per subject with a sliding TTL.
 */
export class StagingTrackingRepository implements TrackingRepository {
  async saveSnapshot(): Promise<void> {
    this.blocked('saveSnapshot');
  }
  async findSnapshot(): Promise<null> {
    this.blocked('findSnapshot');
    return null;
  }
  async deleteSnapshot(): Promise<boolean> {
    this.blocked('deleteSnapshot');
    return false;
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Tracking repository not configured: ${op} blocked — Redis not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
