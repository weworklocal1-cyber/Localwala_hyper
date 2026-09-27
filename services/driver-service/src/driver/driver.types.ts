import { randomUUID } from 'node:crypto';

export const ONBOARDING_STATES = ['pending', 'approved', 'rejected'] as const;

export type OnboardingState = (typeof ONBOARDING_STATES)[number];

export const AVAILABILITY_STATES = ['offline', 'online'] as const;

export type AvailabilityState = (typeof AVAILABILITY_STATES)[number];

export const VEHICLE_TYPES = ['bicycle', 'motorcycle', 'car', 'van', 'truck'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const DOCUMENT_TYPES = [
  'license',
  'insurance',
  'registration',
  'id_proof',
  'background_check',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = ['pending', 'verified', 'rejected'] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface Vehicle {
  type: VehicleType;
  registrationNumber?: string;
  capacityKg?: number;
}

export interface Driver {
  id: string;
  userId: string;
  onboardingState: OnboardingState;
  availability: AvailabilityState;
  suspended: boolean;
  suspensionReason?: string;
  onboardingReason?: string;
  vehicle: Vehicle;
  serviceAreaZoneIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface DriverDocument {
  id: string;
  driverId: string;
  type: DocumentType;
  number?: string;
  expiresAt?: string;
  status: DocumentStatus;
  rejectReason?: string;
  createdAt: number;
  updatedAt: number;
}

export const MAX_SERVICE_AREAS = 20;

export const DRIVER_ID_PATTERN = '^drv_[0-9a-f]{32}$';
export const DOCUMENT_ID_PATTERN = '^dcm_[0-9a-f]{32}$';
export const USER_ID_PATTERN = '^[A-Za-z0-9._-]{1,64}$';
export const ZONE_ID_PATTERN = '^[A-Za-z0-9._-]{1,64}$';
export const DATE_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$';

export function newDriverId(): string {
  return `drv_${randomUUID().replace(/-/g, '')}`;
}

export function newDocumentId(): string {
  return `dcm_${randomUUID().replace(/-/g, '')}`;
}
