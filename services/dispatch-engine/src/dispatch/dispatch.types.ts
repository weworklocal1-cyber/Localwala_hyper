import { randomUUID } from 'node:crypto';

export const ASSIGNMENT_STATES = ['offered', 'claimed', 'rejected', 'timeout', 'released'] as const;

export type AssignmentState = (typeof ASSIGNMENT_STATES)[number];

export const ACTIVE_ASSIGNMENT_STATES: readonly AssignmentState[] = ['offered', 'claimed'];

export const ASSIGNMENT_EVENTS = [
  'offered',
  'accepted',
  'rejected',
  'timeout',
  'manual_assigned',
  'reassigned',
  'released',
] as const;

export type AssignmentEventKind = (typeof ASSIGNMENT_EVENTS)[number];

export const ACTORS = ['system', 'admin', 'driver'] as const;

export type Actor = (typeof ACTORS)[number];

export const VEHICLE_TYPES = ['bicycle', 'motorcycle', 'car', 'van', 'truck'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface AssignmentEventRecord {
  id: string;
  event: AssignmentEventKind;
  actor: Actor;
  driverId?: string;
  reason?: string;
  at: number;
}

export interface Assignment {
  id: string;
  deliveryId: string;
  driverId: string;
  state: AssignmentState;
  offerExpiresAt?: number;
  history: AssignmentEventRecord[];
  createdAt: number;
  updatedAt: number;
}

export interface DispatchPolicy {
  key: 'default';
  distanceWeight: number;
  sameZoneBonus: number;
  workloadPenalty: number;
  maxDistanceKm: number;
  offerTimeoutSeconds: number;
  updatedAt: number;
}

export const DEFAULT_DISPATCH_POLICY: Omit<DispatchPolicy, 'updatedAt'> = {
  key: 'default',
  distanceWeight: 10,
  sameZoneBonus: 50,
  workloadPenalty: 25,
  maxDistanceKm: 10,
  offerTimeoutSeconds: 120,
};

export interface DriverCandidate {
  driverId: string;
  zoneIds: string[];
  vehicleType: VehicleType | string;
  capacityKg?: number;
  distanceKm: number;
  workload: number;
}

export interface ScoredCandidate {
  candidate: DriverCandidate;
  score: number;
}

export const ASSIGNMENT_ID_PATTERN = '^asg_[0-9a-f]{32}$';
export const EVENT_ID_PATTERN = '^aev_[0-9a-f]{32}$';
export const DELIVERY_ID_PATTERN = '^dlv_[0-9a-f]{32}$';
export const DRIVER_ID_PATTERN = '^drv_[0-9a-f]{32}$';
export const ZONE_ID_PATTERN = '^[A-Za-z0-9._-]{1,64}$';

export function newAssignmentId(): string {
  return `asg_${randomUUID().replace(/-/g, '')}`;
}

export function newAssignmentEventId(): string {
  return `aev_${randomUUID().replace(/-/g, '')}`;
}
