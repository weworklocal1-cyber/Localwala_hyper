import { AppError } from '@localwala/errors';
import { z } from 'zod';
import {
  ASSIGNMENT_STATES,
  DELIVERY_ID_PATTERN,
  DRIVER_ID_PATTERN,
  VEHICLE_TYPES,
  ZONE_ID_PATTERN,
} from '../dispatch/dispatch.types.js';

const deliveryId = z
  .string()
  .regex(new RegExp(DELIVERY_ID_PATTERN), 'must match ^dlv_[0-9a-f]{32}$');

const driverId = z.string().regex(new RegExp(DRIVER_ID_PATTERN), 'must match ^drv_[0-9a-f]{32}$');

const zoneId = z
  .string()
  .min(1)
  .max(64)
  .regex(new RegExp(ZONE_ID_PATTERN), 'must match [A-Za-z0-9._-]{1,64}');

const createOfferSchema = z.object({
  deliveryId,
  zoneId: zoneId.optional(),
  requiredVehicleType: z.enum(VEHICLE_TYPES).optional(),
  requiredCapacityKg: z.number().min(0.1).max(5000).optional(),
  maxDistanceKm: z.number().min(0.1).max(100).optional(),
  offerTimeoutSeconds: z.number().int().min(15).max(3600).optional(),
});

const policyUpdateSchema = z
  .object({
    distanceWeight: z.number().min(0).max(1000),
    sameZoneBonus: z.number().min(0).max(10000),
    workloadPenalty: z.number().min(0).max(10000),
    maxDistanceKm: z.number().min(0.1).max(100),
    offerTimeoutSeconds: z.number().int().min(15).max(3600),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one field is required',
  });

const manualAssignSchema = z.object({
  deliveryId,
  driverId,
  reason: z.string().trim().min(1).max(200).optional(),
});

const reassignSchema = z.object({
  driverId,
  reason: z.string().trim().min(1).max(200),
});

const reasonSchema = z.object({
  reason: z.string().trim().min(1).max(200).optional(),
});

const listAssignmentsSchema = z.object({
  deliveryId: deliveryId.optional(),
  driverId: driverId.optional(),
  state: z.enum(ASSIGNMENT_STATES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type PolicyUpdateInput = z.infer<typeof policyUpdateSchema>;
export type ManualAssignInput = z.infer<typeof manualAssignSchema>;
export type ReassignInput = z.infer<typeof reassignSchema>;

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

export function parseCreateOffer(input: unknown): CreateOfferInput {
  return parse(createOfferSchema, input);
}

export function parsePolicyUpdate(input: unknown): PolicyUpdateInput {
  return parse(policyUpdateSchema, input);
}

export function parseManualAssign(input: unknown): ManualAssignInput {
  return parse(manualAssignSchema, input);
}

export function parseReassign(input: unknown): ReassignInput {
  return parse(reassignSchema, input);
}

export function parseOfferReason(input: unknown): z.infer<typeof reasonSchema> {
  return parse(reasonSchema, input ?? {});
}

export function parseListAssignments(input: unknown): z.infer<typeof listAssignmentsSchema> {
  return parse(listAssignmentsSchema, input);
}
