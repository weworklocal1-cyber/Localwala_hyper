import { randomUUID } from 'node:crypto';
import { z } from 'zod';

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
];

export type Role = (typeof ROLES)[number];

export type Permission =
  | 'user:read'
  | 'user:write'
  | 'user:delete'
  | 'partner:read'
  | 'partner:write'
  | 'partner:verify'
  | 'order:read'
  | 'order:write'
  | 'order:cancel'
  | 'payment:read'
  | 'payment:refund'
  | 'settlement:read'
  | 'settlement:write'
  | 'delivery:read'
  | 'delivery:assign'
  | 'delivery:track'
  | 'catalog:read'
  | 'catalog:write'
  | 'inventory:read'
  | 'inventory:write'
  | 'config:read'
  | 'config:write'
  | 'zone:manage'
  | 'locality:manage'
  | 'support:read'
  | 'support:write'
  | 'analytics:read';

export const PERMISSIONS: Record<Permission, readonly Role[]> = {
  'user:read': ['super_admin', 'admin', 'manager', 'support_agent'],
  'user:write': ['super_admin', 'admin'],
  'user:delete': ['super_admin'],
  'partner:read': ['super_admin', 'admin', 'manager'],
  'partner:write': ['super_admin', 'admin'],
  'partner:verify': ['super_admin', 'admin'],
  'order:read': [
    'super_admin',
    'admin',
    'manager',
    'support_agent',
    'partner',
    'partner_staff',
    'delivery_partner',
  ],
  'order:write': [
    'super_admin',
    'admin',
    'manager',
    'partner',
    'partner_staff',
    'delivery_partner',
  ],
  'order:cancel': ['super_admin', 'admin', 'manager', 'partner', 'partner_staff', 'customer'],
  'payment:read': ['super_admin', 'admin', 'manager', 'support_agent'],
  'payment:refund': ['super_admin', 'admin', 'manager'],
  'settlement:read': ['super_admin', 'admin', 'manager'],
  'settlement:write': ['super_admin', 'admin'],
  'delivery:read': ['super_admin', 'admin', 'manager', 'delivery_partner'],
  'delivery:assign': ['super_admin', 'admin', 'manager'],
  'delivery:track': ['super_admin', 'admin', 'manager', 'delivery_partner', 'customer'],
  'catalog:read': ['super_admin', 'admin', 'manager', 'partner', 'partner_staff', 'customer'],
  'catalog:write': ['super_admin', 'admin', 'manager', 'partner', 'partner_staff'],
  'inventory:read': ['super_admin', 'admin', 'manager', 'partner', 'partner_staff'],
  'inventory:write': ['super_admin', 'admin', 'manager', 'partner', 'partner_staff'],
  'config:read': ['super_admin', 'admin', 'manager'],
  'config:write': ['super_admin', 'admin'],
  'zone:manage': ['super_admin', 'admin', 'manager'],
  'locality:manage': ['super_admin', 'admin', 'manager'],
  'support:read': ['super_admin', 'admin', 'manager', 'support_agent'],
  'support:write': ['super_admin', 'admin', 'manager', 'support_agent'],
  'analytics:read': ['super_admin', 'admin', 'manager'],
} as const;

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function getPermissionsForRole(role: Role): Permission[] {
  return Object.entries(PERMISSIONS)
    .filter(([, roles]) => roles.includes(role))
    .map(([perm]) => perm as Permission);
}

export interface User {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  roles: Role[];
  avatarUrl?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
  metadata?: Record<string, unknown>;
}

export interface UserProfile {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  roles: Role[];
  avatarUrl?: string;
  createdAt: number;
  lastLoginAt?: number;
}

const ROLE_VALUES = [
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
const roleEnum = z.enum(ROLE_VALUES);

export const userCreateSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  email: z.string().email().optional(),
  name: z.string().min(1).max(128).optional(),
  roles: z.array(roleEnum).default(['customer']),
});

export const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(128).optional(),
  avatarUrl: z.string().url().optional(),
  roles: z.array(roleEnum).optional(),
  isActive: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()),
});

export const userIdSchema = z.object({
  id: z.string().min(1),
});

export function newUserId(): string {
  return `usr_${randomUUID().replace(/-/g, '')}`;
}
