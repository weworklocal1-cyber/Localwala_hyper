import { createHash, randomUUID } from 'node:crypto';

export const DELIVERY_STATES = [
  'created',
  'assigned',
  'arrived_at_pickup',
  'picked_up',
  'arrived_at_customer',
  'delivered',
  'completed',
  'failed',
  'cancelled',
] as const;

export type DeliveryState = (typeof DELIVERY_STATES)[number];

export const DELIVERY_TRANSITIONS: Record<DeliveryState, readonly DeliveryState[]> = {
  created: ['assigned', 'cancelled'],
  assigned: ['arrived_at_pickup', 'failed', 'cancelled'],
  arrived_at_pickup: ['picked_up', 'failed'],
  picked_up: ['arrived_at_customer', 'failed'],
  arrived_at_customer: ['delivered', 'failed'],
  delivered: ['completed'],
  completed: [],
  failed: [],
  cancelled: [],
};

export const POD_TYPES = ['otp', 'photo', 'signature'] as const;

export type PodType = (typeof POD_TYPES)[number];

export interface Pod {
  type: PodType;
  ref?: string;
}

export interface DeliveryArea {
  id: string;
  zoneId: string;
  partnerId?: string;
  feePaise: number;
  freeAbovePaise?: number;
  maxDistanceKm?: number;
  etaMinutes: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DeliverySlot {
  id: string;
  zoneId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  capacity: number;
  reserved: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DeliveryEvent {
  id: string;
  deliveryId: string;
  from: DeliveryState;
  to: DeliveryState;
  reason?: string;
  otpVerified?: boolean;
  pod?: Pod;
  codCollected?: boolean;
  at: number;
}

export interface Delivery {
  id: string;
  orderId: string;
  slotId?: string;
  slotReleased: boolean;
  state: DeliveryState;
  otpHash?: string;
  requirePod: boolean;
  codAmountPaise: number;
  codCollected: boolean;
  events: DeliveryEvent[];
  createdAt: number;
  updatedAt: number;
}

export const MAX_AMOUNT_PAISE = 100_000_000;

export const ORDER_ID_PATTERN = '^ord_[0-9a-f]{32}$';
export const DELIVERY_ID_PATTERN = '^dlv_[0-9a-f]{32}$';
export const AREA_ID_PATTERN = '^dar_[0-9a-f]{32}$';
export const SLOT_ID_PATTERN = '^dsl_[0-9a-f]{32}$';
export const EVENT_ID_PATTERN = '^dev_[0-9a-f]{32}$';
export const ZONE_ID_PATTERN = '^[A-Za-z0-9._-]{1,64}$';
export const DATE_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$';
export const OTP_PATTERN = '^\\d{4,8}$';

export function newDeliveryId(): string {
  return `dlv_${randomUUID().replace(/-/g, '')}`;
}

export function newAreaId(): string {
  return `dar_${randomUUID().replace(/-/g, '')}`;
}

export function newSlotId(): string {
  return `dsl_${randomUUID().replace(/-/g, '')}`;
}

export function newEventId(): string {
  return `dev_${randomUUID().replace(/-/g, '')}`;
}

export function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
