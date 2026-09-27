import { AppError } from '@localwala/errors';
import { z } from 'zod';
import { RESERVATION_KEY_PATTERN, SKU_PATTERN } from '../inventory/inventory.types.js';

const sku = z.string().regex(new RegExp(SKU_PATTERN), 'must match [A-Za-z0-9._-]{1,64}');
const reservationKey = z
  .string()
  .regex(new RegExp(RESERVATION_KEY_PATTERN), 'must match [A-Za-z0-9._:-]{1,128}');

const createStockSchema = z.object({
  sku,
  physical: z.number().int().min(0),
});

const patchStockSchema = z.object({
  physical: z.number().int().min(0),
});

const adjustStockSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((delta) => delta !== 0, { message: 'delta must not be zero' }),
  reason: z.string().min(1).max(200).optional(),
});

const createReservationSchema = z.object({
  key: reservationKey,
  sku,
  qty: z.number().int().positive(),
});

export type CreateStockInput = z.infer<typeof createStockSchema>;
export type PatchStockInput = z.infer<typeof patchStockSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', {
      message: 'Request payload failed validation',
      details: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

export function parseCreateStock(input: unknown): CreateStockInput {
  return parse(createStockSchema, input);
}

export function parsePatchStock(input: unknown): PatchStockInput {
  return parse(patchStockSchema, input);
}

export function parseAdjustStock(input: unknown): AdjustStockInput {
  return parse(adjustStockSchema, input);
}

export function parseCreateReservation(input: unknown): CreateReservationInput {
  return parse(createReservationSchema, input);
}
