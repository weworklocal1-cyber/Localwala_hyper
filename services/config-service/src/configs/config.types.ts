import { randomUUID } from 'node:crypto';

export const CONFIG_TYPES = [
  'feature_flags',
  'app_version',
  'maintenance',
  'verticals',
  'home_sections',
  'banner',
  'category',
  'lottie',
  'payment_methods',
  'delivery_rules',
  'pricing_rules',
  'commission_rules',
  'promotion_rules',
  'notification_template',
] as const;
export type ConfigType = (typeof CONFIG_TYPES)[number];

export const CONFIG_ENVIRONMENTS = ['development', 'staging', 'production'] as const;
export type ConfigEnvironment = (typeof CONFIG_ENVIRONMENTS)[number];

export const CONFIG_STATES = ['draft', 'scheduled', 'published', 'expired'] as const;
export type ConfigState = (typeof CONFIG_STATES)[number];

export const SCOPE_TYPES = ['global', 'city', 'zone', 'locality'] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

export const CONVENTIONAL_KEYS = {
  featureFlags: 'feature.flags',
  appVersion: 'app.version',
  maintenance: 'maintenance.mode',
} as const;

export interface ConfigScope {
  type: ScopeType;
  cityId?: string;
  zoneId?: string;
  localityId?: string;
}

export interface ConfigTargeting {
  segments?: string[];
}

export interface ConfigRecord {
  id: string;
  key: string;
  type: ConfigType;
  environment: ConfigEnvironment;
  version: number;
  state: ConfigState;
  scope: ConfigScope;
  targeting?: ConfigTargeting;
  scheduledFor?: number;
  activeFrom?: number;
  activeTo?: number;
  expiresAt?: number;
  publishedAt?: number;
  payload: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface ResolveContext {
  environment: ConfigEnvironment;
  cityId?: string;
  zoneId?: string;
  localityId?: string;
  segment?: string;
  now?: number;
}

export const SCOPE_SPECIFICITY: Record<ScopeType, number> = {
  global: 0,
  city: 1,
  zone: 2,
  locality: 3,
};

export function newConfigId(): string {
  return 'cfg_' + randomUUID().replace(/-/g, '');
}
