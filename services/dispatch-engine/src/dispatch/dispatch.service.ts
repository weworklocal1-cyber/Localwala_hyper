import { AppError } from '@localwala/errors';
import type { DriverDirectory } from './driver-directory.js';
import type { DispatchRepository } from './dispatch.repository.js';
import { KeyedMutex } from './keyed-mutex.js';
import { filterCandidates, scoreCandidates, type EligibilityCriteria } from './scoring.js';
import {
  ACTIVE_ASSIGNMENT_STATES,
  DEFAULT_DISPATCH_POLICY,
  newAssignmentEventId,
  newAssignmentId,
  type Actor,
  type Assignment,
  type AssignmentEventKind,
  type AssignmentState,
  type DispatchPolicy,
} from './dispatch.types.js';
import {
  parseCreateOffer,
  parseManualAssign,
  parseOfferReason,
  parsePolicyUpdate,
  parseReassign,
  parseListAssignments,
} from '../schemas/dispatch.schema.js';

export class DispatchService {
  private readonly mutex = new KeyedMutex();

  constructor(
    private readonly repo: DispatchRepository,
    private readonly directory: DriverDirectory,
  ) {}

  async getPolicy(): Promise<DispatchPolicy> {
    const stored = await this.repo.findPolicy();
    if (stored) return stored;
    return { ...DEFAULT_DISPATCH_POLICY, updatedAt: 0 };
  }

  async setPolicy(input: unknown): Promise<DispatchPolicy> {
    const parsed = parsePolicyUpdate(input);
    return this.mutex.run('policy', async () => {
      const current = await this.getPolicy();
      const policy: DispatchPolicy = {
        key: 'default',
        distanceWeight: parsed.distanceWeight ?? current.distanceWeight,
        sameZoneBonus: parsed.sameZoneBonus ?? current.sameZoneBonus,
        workloadPenalty: parsed.workloadPenalty ?? current.workloadPenalty,
        maxDistanceKm: parsed.maxDistanceKm ?? current.maxDistanceKm,
        offerTimeoutSeconds: parsed.offerTimeoutSeconds ?? current.offerTimeoutSeconds,
        updatedAt: Date.now(),
      };
      await this.repo.savePolicy(policy);
      return policy;
    });
  }

  async previewCandidates(
    input: unknown,
  ): Promise<Array<{ driverId: string; score: number; distanceKm: number; workload: number }>> {
    const parsed = parseCreateOffer(input);
    const policy = await this.getPolicy();
    const criteria = this.buildCriteria(policy, parsed);
    const candidates = await this.directory.findCandidates({
      ...(parsed.zoneId !== undefined ? { zoneId: parsed.zoneId } : {}),
      limit: 50,
    });
    const eligible = filterCandidates(candidates, criteria);
    return scoreCandidates(eligible, policy, criteria).map((entry) => ({
      driverId: entry.candidate.driverId,
      score: entry.score,
      distanceKm: entry.candidate.distanceKm,
      workload: entry.candidate.workload,
    }));
  }

  async createOffer(input: unknown): Promise<Assignment> {
    const parsed = parseCreateOffer(input);
    return this.mutex.run(`delivery:${parsed.deliveryId}`, async () => {
      const active = await this.repo.findActiveAssignmentByDelivery(parsed.deliveryId);
      if (active) {
        throw new AppError('CONFLICT', {
          message: 'Delivery already has an active assignment.',
          details: { deliveryId: parsed.deliveryId, assignmentId: active.id },
        });
      }
      const policy = await this.getPolicy();
      const criteria = this.buildCriteria(policy, parsed);
      const candidates = await this.directory.findCandidates({
        ...(parsed.zoneId !== undefined ? { zoneId: parsed.zoneId } : {}),
        limit: 50,
      });
      const prior = await this.repo.listAssignments({
        deliveryId: parsed.deliveryId,
        limit: 100,
      });
      const alreadyOffered = new Set(prior.map((entry) => entry.driverId));
      const scored = scoreCandidates(
        filterCandidates(candidates, criteria).filter(
          (candidate) => !alreadyOffered.has(candidate.driverId),
        ),
        policy,
        criteria,
      );
      const best = scored[0];
      if (!best) {
        throw new AppError('CONFLICT', {
          message: 'No eligible driver available for this delivery.',
          details: { deliveryId: parsed.deliveryId },
        });
      }
      const timeoutSeconds = parsed.offerTimeoutSeconds ?? policy.offerTimeoutSeconds;
      const now = Date.now();
      const assignment: Assignment = {
        id: newAssignmentId(),
        deliveryId: parsed.deliveryId,
        driverId: best.candidate.driverId,
        state: 'offered',
        offerExpiresAt: now + timeoutSeconds * 1000,
        history: [],
        createdAt: now,
        updatedAt: now,
      };
      this.appendHistory(assignment, 'offered', 'system', {
        driverId: best.candidate.driverId,
      });
      await this.repo.saveAssignment(assignment);
      return assignment;
    });
  }

  async acceptOffer(assignmentId: string): Promise<Assignment> {
    const assignment = await this.requireAssignment(assignmentId);
    return this.mutex.run(`delivery:${assignment.deliveryId}`, async () => {
      const current = await this.requireAssignment(assignmentId);
      if (current.state !== 'offered') {
        throw new AppError('CONFLICT', {
          message: `Offer is not open (state "${current.state}").`,
          details: { assignmentId, state: current.state },
        });
      }
      if (current.offerExpiresAt !== undefined && Date.now() > current.offerExpiresAt) {
        current.state = 'timeout';
        current.updatedAt = Date.now();
        this.appendHistory(current, 'timeout', 'system', { reason: 'offer expired' });
        await this.repo.saveAssignment(current);
        throw new AppError('CONFLICT', {
          message: 'Offer has expired.',
          details: { assignmentId, state: 'timeout' },
        });
      }
      current.state = 'claimed';
      current.updatedAt = Date.now();
      this.appendHistory(current, 'accepted', 'driver', { driverId: current.driverId });
      await this.repo.saveAssignment(current);
      return current;
    });
  }

  async rejectOffer(assignmentId: string, input: unknown): Promise<Assignment> {
    const parsed = parseOfferReason(input);
    const assignment = await this.requireAssignment(assignmentId);
    return this.mutex.run(`delivery:${assignment.deliveryId}`, async () => {
      const current = await this.requireAssignment(assignmentId);
      if (current.state !== 'offered') {
        throw new AppError('CONFLICT', {
          message: `Offer is not open (state "${current.state}").`,
          details: { assignmentId, state: current.state },
        });
      }
      current.state = 'rejected';
      current.updatedAt = Date.now();
      this.appendHistory(current, 'rejected', 'driver', {
        driverId: current.driverId,
        ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
      });
      await this.repo.saveAssignment(current);
      return current;
    });
  }

  async timeoutOffer(assignmentId: string): Promise<Assignment> {
    const assignment = await this.requireAssignment(assignmentId);
    return this.mutex.run(`delivery:${assignment.deliveryId}`, async () => {
      const current = await this.requireAssignment(assignmentId);
      if (current.state !== 'offered') {
        throw new AppError('CONFLICT', {
          message: `Offer is not open (state "${current.state}").`,
          details: { assignmentId, state: current.state },
        });
      }
      current.state = 'timeout';
      current.updatedAt = Date.now();
      this.appendHistory(current, 'timeout', 'system');
      await this.repo.saveAssignment(current);
      return current;
    });
  }

  async manualAssign(input: unknown): Promise<Assignment> {
    const parsed = parseManualAssign(input);
    return this.mutex.run(`delivery:${parsed.deliveryId}`, async () => {
      const active = await this.repo.findActiveAssignmentByDelivery(parsed.deliveryId);
      if (active) {
        throw new AppError('CONFLICT', {
          message: 'Delivery already has an active assignment.',
          details: { deliveryId: parsed.deliveryId, assignmentId: active.id },
        });
      }
      const now = Date.now();
      const assignment: Assignment = {
        id: newAssignmentId(),
        deliveryId: parsed.deliveryId,
        driverId: parsed.driverId,
        state: 'claimed',
        history: [],
        createdAt: now,
        updatedAt: now,
      };
      this.appendHistory(assignment, 'manual_assigned', 'admin', {
        driverId: parsed.driverId,
        reason: parsed.reason,
      });
      await this.repo.saveAssignment(assignment);
      return assignment;
    });
  }

  async reassign(assignmentId: string, input: unknown): Promise<Assignment> {
    const parsed = parseReassign(input);
    const assignment = await this.requireAssignment(assignmentId);
    return this.mutex.run(`delivery:${assignment.deliveryId}`, async () => {
      const current = await this.requireAssignment(assignmentId);
      if (current.state !== 'claimed') {
        throw new AppError('CONFLICT', {
          message: `Only claimed assignments can be reassigned (state "${current.state}").`,
          details: { assignmentId, state: current.state },
        });
      }
      current.state = 'released';
      current.updatedAt = Date.now();
      this.appendHistory(current, 'released', 'admin', {
        reason: parsed.reason,
        driverId: current.driverId,
      });
      await this.repo.saveAssignment(current);

      const now = Date.now();
      const replacement: Assignment = {
        id: newAssignmentId(),
        deliveryId: current.deliveryId,
        driverId: parsed.driverId,
        state: 'claimed',
        history: [],
        createdAt: now,
        updatedAt: now,
      };
      this.appendHistory(replacement, 'reassigned', 'admin', {
        driverId: parsed.driverId,
        reason: parsed.reason,
      });
      await this.repo.saveAssignment(replacement);
      return replacement;
    });
  }

  async release(assignmentId: string, input: unknown): Promise<Assignment> {
    const parsed = parseOfferReason(input);
    const assignment = await this.requireAssignment(assignmentId);
    return this.mutex.run(`delivery:${assignment.deliveryId}`, async () => {
      const current = await this.requireAssignment(assignmentId);
      if (current.state !== 'claimed' && current.state !== 'offered') {
        throw new AppError('CONFLICT', {
          message: `Assignment cannot be released from state "${current.state}".`,
          details: { assignmentId, state: current.state },
        });
      }
      current.state = 'released';
      current.updatedAt = Date.now();
      this.appendHistory(current, 'released', 'admin', {
        driverId: current.driverId,
        ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
      });
      await this.repo.saveAssignment(current);
      return current;
    });
  }

  async getAssignment(assignmentId: string): Promise<Assignment> {
    return this.requireAssignment(assignmentId);
  }

  async listAssignments(query: unknown): Promise<Assignment[]> {
    const parsed = parseListAssignments(query);
    const assignments = await this.repo.listAssignments({
      ...(parsed.deliveryId !== undefined ? { deliveryId: parsed.deliveryId } : {}),
      ...(parsed.driverId !== undefined ? { driverId: parsed.driverId } : {}),
      ...(parsed.state !== undefined ? { state: parsed.state } : {}),
      limit: parsed.limit,
    });
    return assignments.slice(0, parsed.limit);
  }

  async getHistory(assignmentId: string): Promise<Assignment['history']> {
    const assignment = await this.requireAssignment(assignmentId);
    return assignment.history;
  }

  private buildCriteria(
    policy: DispatchPolicy,
    input: {
      zoneId?: string;
      requiredVehicleType?: string;
      requiredCapacityKg?: number;
      maxDistanceKm?: number;
    },
  ): EligibilityCriteria {
    const criteria: EligibilityCriteria = {
      maxDistanceKm: input.maxDistanceKm ?? policy.maxDistanceKm,
    };
    if (input.zoneId !== undefined) criteria.zoneId = input.zoneId;
    if (input.requiredVehicleType !== undefined) {
      criteria.requiredVehicleType = input.requiredVehicleType;
    }
    if (input.requiredCapacityKg !== undefined) {
      criteria.requiredCapacityKg = input.requiredCapacityKg;
    }
    return criteria;
  }

  private appendHistory(
    assignment: Assignment,
    event: AssignmentEventKind,
    actor: Actor,
    details: { driverId?: string; reason?: string } = {},
  ): void {
    const record: Assignment['history'][number] = {
      id: newAssignmentEventId(),
      event,
      actor,
      at: Date.now(),
    };
    if (details.driverId !== undefined) record.driverId = details.driverId;
    if (details.reason !== undefined) record.reason = details.reason;
    assignment.history.push(record);
  }

  private async requireAssignment(assignmentId: string): Promise<Assignment> {
    const assignment = await this.repo.findAssignment(assignmentId);
    if (!assignment) {
      throw new AppError('NOT_FOUND', { message: 'Assignment not found.' });
    }
    return assignment;
  }
}

export function isActiveAssignment(state: AssignmentState): boolean {
  return ACTIVE_ASSIGNMENT_STATES.includes(state);
}
