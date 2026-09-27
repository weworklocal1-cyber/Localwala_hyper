import { z } from 'zod';
import { ROLES } from '../rbac/rbac.types.js';

const roleEnum = z.enum(ROLES);

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

export const userParamsSchema = z.object({
  id: z.string().min(1),
});

export const listUsersQuerySchema = z.object({
  role: roleEnum.optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const checkPermissionSchema = z.object({
  permission: z.string().min(3),
});
