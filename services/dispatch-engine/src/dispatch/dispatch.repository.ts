import { AppError } from '@localwala/errors';
import type { Assignment, AssignmentState, DispatchPolicy } from './dispatch.types.js';

export interface AssignmentQuery {
  deliveryId?: string;
  driverId?: string;
  state?: AssignmentState;
  limit?: number;
}

export interface DispatchRepository {
  saveAssignment(assignment: Assignment): Promise<void>;
  findAssignment(assignmentId: string): Promise<Assignment | null>;
  findActiveAssignmentByDelivery(deliveryId: string): Promise<Assignment | null>;
  listAssignments(query: AssignmentQuery): Promise<Assignment[]>;
  savePolicy(policy: DispatchPolicy): Promise<void>;
  findPolicy(): Promise<DispatchPolicy | null>;
}

/**
 * STAGING ONLY — PostgreSQL dispatch store not implemented yet.
 * Throws SERVICE_UNAVAILABLE (503) on every operation (specification section 1).
 */
export class StagingDispatchRepository implements DispatchRepository {
  async saveAssignment(): Promise<void> {
    this.blocked('saveAssignment');
  }
  async findAssignment(): Promise<null> {
    this.blocked('findAssignment');
    return null;
  }
  async findActiveAssignmentByDelivery(): Promise<null> {
    this.blocked('findActiveAssignmentByDelivery');
    return null;
  }
  async listAssignments(): Promise<[]> {
    this.blocked('listAssignments');
    return [];
  }
  async savePolicy(): Promise<void> {
    this.blocked('savePolicy');
  }
  async findPolicy(): Promise<null> {
    this.blocked('findPolicy');
    return null;
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Dispatch repository not configured: ${op} blocked — PostgreSQL not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
