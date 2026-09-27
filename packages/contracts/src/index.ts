import type { ErrorBody } from '@localwala/errors';

export type { ErrorBody };

export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  error: ErrorBody['error'];
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}

export const ROLES = [
  'customer',
  'partner',
  'partner_staff',
  'delivery_partner',
  'executive',
  'support_agent',
  'manager',
  'admin',
  'super_admin',
] as const;

export type Role = (typeof ROLES)[number];

export interface RequestIdentity {
  userId: string;
  roles: Role[];
  sessionId?: string;
  correlationId: string;
}

export const SERVICES = [
  'api-gateway',
  'auth-service',
  'user-service',
  'geography-service',
  'config-service',
  'media-service',
  'notification-service',
  'search-service',
  'support-service',
  'catalog-service',
  'inventory-service',
  'cart-service',
  'order-service',
  'payment-service',
  'wallet-service',
  'promotion-service',
  'settlement-service',
  'referral-service',
  'delivery-service',
  'dispatch-engine',
  'driver-service',
  'tracking-service',
  'food-service',
  'store-service',
  'dairy-service',
  'zatka-service',
  'local-services-service',
  'realestate-service',
  'analytics-service',
  'audit-service',
] as const;

export type ServiceName = (typeof SERVICES)[number];

export interface HealthResponse {
  status: 'ok';
  service: ServiceName;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessCheck {
  name: string;
  status: 'up' | 'down';
  detail?: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  service: ServiceName;
  checks: ReadinessCheck[];
}

export const HEADER_CORRELATION_ID = 'x-correlation-id';
export const HEADER_IDEMPOTENCY_KEY = 'idempotency-key';
export const HEADER_REQUEST_ID = 'x-request-id';
