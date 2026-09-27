import { AppError } from '@localwala/errors';
import type { DriverCandidate } from './dispatch.types.js';

export interface CandidateQuery {
  zoneId?: string;
  limit?: number;
}

/**
 * Driver discovery port. The production implementation calls driver-service
 * and computes distance; the staging implementation refuses to fake matches
 * (specification section 1).
 */
export interface DriverDirectory {
  findCandidates(query: CandidateQuery): Promise<DriverCandidate[]>;
}

/**
 * STAGING ONLY — driver-service integration not wired yet.
 * Throws SERVICE_UNAVAILABLE (503).
 */
export class StagingDriverDirectory implements DriverDirectory {
  async findCandidates(): Promise<DriverCandidate[]> {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message:
        'Driver directory not configured — driver-service candidate lookup pending. Run docker compose up -d.',
      retryable: false,
    });
  }
}
