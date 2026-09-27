import { z } from 'zod';
import { AppError } from '@localwala/errors';

export { z };

export const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const publicIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,64}$/, 'Invalid public id');

export const e164PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164, e.g. +919876543210');

export const emailSchema = z
  .string()
  .min(5)
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address');

export const otpSchema = z.string().regex(/^\d{4,8}$/, 'OTP must be 4-8 digits');

export const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_.:-]+$/, 'Invalid idempotency key');

export const sortSchema = z.object({
  sortBy: z.string().max(64).optional(),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', {
      message: 'Request validation failed',
      details: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}
