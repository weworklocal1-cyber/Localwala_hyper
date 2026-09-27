import { AppError } from '@localwala/errors';
import type { TrackingRepository } from './tracking.repository.js';
import { KeyedMutex } from './keyed-mutex.js';
import {
  MAX_TRAIL_POINTS,
  subjectKey,
  type LocationPoint,
  type SubjectType,
  type TrackingSnapshot,
} from './tracking.types.js';
import {
  parseEndTracking,
  parseListTrail,
  parseLocation,
  parseLocationBatch,
} from '../schemas/tracking.schema.js';

export class TrackingService {
  private readonly mutex = new KeyedMutex();

  constructor(private readonly repo: TrackingRepository) {}

  async recordLocation(input: unknown): Promise<{ sequence: number; receivedAt: number }> {
    const parsed = parseLocation(input);
    const { subjectType, subjectId, ...point } = parsed;
    return this.mutex.run(subjectKey(subjectType, subjectId), async () => {
      const snapshot = await this.appendPoint(subjectType, subjectId, point);
      return { sequence: snapshot.sequence, receivedAt: snapshot.updatedAt };
    });
  }

  async recordLocationBatch(input: unknown): Promise<{
    recorded: number;
    lastSequence?: number;
    receivedAt?: number;
  }> {
    const parsed = parseLocationBatch(input);
    if (parsed.updates.length === 0) {
      throw new AppError('VALIDATION_ERROR', {
        message: 'Request payload failed validation',
        details: [{ path: 'updates', message: 'must contain at least one update' }],
      });
    }
    let lastSequence: number | undefined;
    let receivedAt: number | undefined;
    for (const update of parsed.updates) {
      const result = await this.recordLocation(update);
      lastSequence = result.sequence;
      receivedAt = result.receivedAt;
    }
    return { recorded: parsed.updates.length, lastSequence, receivedAt };
  }

  async getSnapshot(subjectType: SubjectType, subjectId: string): Promise<TrackingSnapshot> {
    const snapshot = await this.repo.findSnapshot(subjectType, subjectId);
    if (!snapshot) {
      throw new AppError('NOT_FOUND', { message: 'No tracking data for this subject.' });
    }
    return snapshot;
  }

  async listTrail(query: unknown): Promise<LocationPoint[]> {
    const parsed = parseListTrail(query);
    const snapshot = await this.repo.findSnapshot(parsed.subjectType, parsed.subjectId);
    if (!snapshot) {
      throw new AppError('NOT_FOUND', { message: 'No tracking data for this subject.' });
    }
    return snapshot.trail.slice(-parsed.limit).reverse();
  }

  async endTracking(input: unknown): Promise<{ subjectType: SubjectType; subjectId: string }> {
    const parsed = parseEndTracking(input);
    const removed = await this.repo.deleteSnapshot(parsed.subjectType, parsed.subjectId);
    if (!removed) {
      throw new AppError('NOT_FOUND', { message: 'No tracking data for this subject.' });
    }
    return { subjectType: parsed.subjectType, subjectId: parsed.subjectId };
  }

  private async appendPoint(
    subjectType: SubjectType,
    subjectId: string,
    point: LocationPoint,
  ): Promise<TrackingSnapshot> {
    const existing = await this.repo.findSnapshot(subjectType, subjectId);
    const now = Date.now();
    if (!existing) {
      const snapshot: TrackingSnapshot = {
        subjectType,
        subjectId,
        sequence: 1,
        startedAt: now,
        updatedAt: now,
        last: point,
        trail: [point],
      };
      await this.repo.saveSnapshot(snapshot);
      return snapshot;
    }
    existing.sequence += 1;
    existing.updatedAt = now;
    existing.last = point;
    existing.trail.push(point);
    if (existing.trail.length > MAX_TRAIL_POINTS) {
      existing.trail = existing.trail.slice(-MAX_TRAIL_POINTS);
    }
    await this.repo.saveSnapshot(existing);
    return existing;
  }
}
