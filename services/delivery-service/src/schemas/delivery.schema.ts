import { AppError } from '@localwala/errors';
import { z } from 'zod';
import {
  DATE_PATTERN,
  DELIVERY_STATES,
  MAX_AMOUNT_PAISE,
  OTP_PATTERN,
  ORDER_ID_PATTERN,
  POD_TYPES,
  ZONE_ID_PATTERN,
} from '../delivery/delivery.types.js';

const zoneId = z
  .string()
  .min(1)
  .max(64)
  .regex(new RegExp(ZONE_ID_PATTERN), 'must match [A-Za-z0-9._-]{1,64}');

const paise = z.number().int().min(0).max(MAX_AMOUNT_PAISE);

const createAreaSchema = z.object({
  zoneId,
  partnerId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9._-]{1,64}$/, 'must match [A-Za-z0-9._-]{1,64}')
    .optional(),
  feePaise: paise,
  freeAbovePaise: paise.optional(),
  maxDistanceKm: z.number().min(0.1).max(100).optional(),
  etaMinutes: z.number().int().min(1).max(600),
  active: z.boolean().optional(),
});

const updateAreaSchema = z
  .object({
    feePaise: paise.optional(),
    freeAbovePaise: paise.optional(),
    etaMinutes: z.number().int().min(1).max(600).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one field is required',
  });

const listAreasSchema = z.object({
  zoneId: zoneId.optional(),
  partnerId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9._-]{1,64}$/)
    .optional(),
  active: z.enum(['true', 'false']).optional(),
});

const createSlotSchema = z.object({
  zoneId,
  date: z.string().regex(new RegExp(DATE_PATTERN), 'must match YYYY-MM-DD'),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  capacity: z.number().int().min(1).max(1000),
  active: z.boolean().optional(),
});

const listSlotsSchema = z.object({
  zoneId: zoneId.optional(),
  date: z.string().regex(new RegExp(DATE_PATTERN), 'must match YYYY-MM-DD').optional(),
  active: z.enum(['true', 'false']).optional(),
});

const reserveSchema = z.object({
  quantity: z.number().int().min(1).max(1000).default(1),
});

const createDeliverySchema = z.object({
  orderId: z.string().regex(new RegExp(ORDER_ID_PATTERN), 'must match ^ord_[0-9a-f]{32}$'),
  slotId: z
    .string()
    .regex(/^dsl_[0-9a-f]{32}$/, 'must match ^dsl_[0-9a-f]{32}$')
    .optional(),
  otpCode: z.string().regex(new RegExp(OTP_PATTERN), 'must match ^\\d{4,8}$').optional(),
  requirePod: z.boolean().optional(),
  codAmountPaise: paise.optional(),
});

const listDeliveriesSchema = z.object({
  orderId: z
    .string()
    .regex(new RegExp(ORDER_ID_PATTERN), 'must match ^ord_[0-9a-f]{32}$')
    .optional(),
  state: z.enum(DELIVERY_STATES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const podSchema = z.object({
  type: z.enum(POD_TYPES),
  ref: z.string().min(1).max(300).optional(),
});

const transitionSchema = z.object({
  to: z.enum(DELIVERY_STATES),
  reason: z.string().min(1).max(200).optional(),
  otpCode: z.string().regex(new RegExp(OTP_PATTERN), 'must match ^\\d{4,8}$').optional(),
  pod: podSchema.optional(),
  codCollected: z.boolean().optional(),
});

export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;

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

export function parseCreateArea(input: unknown): CreateAreaInput {
  return parse(createAreaSchema, input);
}

export function parseUpdateArea(input: unknown): z.infer<typeof updateAreaSchema> {
  return parse(updateAreaSchema, input);
}

export function parseListAreas(input: unknown): z.infer<typeof listAreasSchema> {
  return parse(listAreasSchema, input);
}

export function parseCreateSlot(input: unknown): CreateSlotInput {
  return parse(createSlotSchema, input);
}

export function parseListSlots(input: unknown): z.infer<typeof listSlotsSchema> {
  return parse(listSlotsSchema, input);
}

export function parseReserveSlot(input: unknown): z.infer<typeof reserveSchema> {
  return parse(reserveSchema, input);
}

export function parseCreateDelivery(input: unknown): CreateDeliveryInput {
  return parse(createDeliverySchema, input);
}

export function parseListDeliveries(input: unknown): z.infer<typeof listDeliveriesSchema> {
  return parse(listDeliveriesSchema, input);
}

export function parseTransition(input: unknown): TransitionInput {
  return parse(transitionSchema, input);
}
