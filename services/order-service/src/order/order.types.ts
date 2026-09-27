import { randomUUID } from 'node:crypto';

export const ORDER_STATUSES = [
  'created',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  created: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};

export const TERMINAL_STATUSES: readonly OrderStatus[] = ['completed', 'cancelled'];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export interface OrderItemSnapshot {
  productId: string;
  variantId: string;
  name: string;
  qty: number;
  price: number;
  mrp: number;
  modifiers: Array<{ groupId: string; optionIds: string[] }>;
  instructions?: string;
}

export interface PricingSnapshot {
  itemsTotal: number;
  mrpTotal: number;
  savings: number;
  couponDiscount: number;
  grandTotal: number;
}

export interface PartnerSnapshot {
  storeId: string;
  name?: string;
}

export interface AddressSnapshot {
  addressId: string;
  line1?: string;
  line2?: string;
  city?: string;
  pincode?: string;
}

export interface OrderTransition {
  from: OrderStatus;
  to: OrderStatus;
  at: number;
  reason?: string;
  actor?: string;
}

export interface Order {
  id: string;
  userId: string;
  vertical: string;
  status: OrderStatus;
  storeId?: string;
  partner?: PartnerSnapshot;
  address: AddressSnapshot;
  items: OrderItemSnapshot[];
  pricing: PricingSnapshot;
  couponCode?: string;
  idempotencyKey: string;
  history: OrderTransition[];
  createdAt: number;
  updatedAt: number;
}

export const ORDER_ID_PATTERN = '^ord_[0-9a-f]{32}$';
export const USER_ID_PATTERN = '^[A-Za-z0-9._-]{1,64}$';
export const VERTICAL_PATTERN = '^[a-z0-9][a-z0-9-]{0,31}$';
export const IDEMPOTENCY_KEY_PATTERN = '^[A-Za-z0-9_.:-]{8,128}$';

export function newOrderId(): string {
  return `ord_${randomUUID().replace(/-/g, '')}`;
}
