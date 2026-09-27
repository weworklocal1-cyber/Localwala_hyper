import { AppError } from '@localwala/errors';
import { z } from 'zod';
import {
  AVAILABILITY_STATES,
  DATE_PATTERN,
  DOCUMENT_TYPES,
  MAX_SERVICE_AREAS,
  ONBOARDING_STATES,
  USER_ID_PATTERN,
  VEHICLE_TYPES,
  ZONE_ID_PATTERN,
} from '../driver/driver.types.js';

const vehicleSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  registrationNumber: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9 -]{1,32}$/, 'must be alphanumeric with spaces, dashes')
    .optional(),
  capacityKg: z.number().min(0.1).max(5000).optional(),
});

const zoneId = z
  .string()
  .min(1)
  .max(64)
  .regex(new RegExp(ZONE_ID_PATTERN), 'must match [A-Za-z0-9._-]{1,64}');

const createDriverSchema = z.object({
  userId: z
    .string()
    .min(1)
    .max(64)
    .regex(new RegExp(USER_ID_PATTERN), 'must match [A-Za-z0-9._-]{1,64}'),
  vehicle: vehicleSchema,
  serviceAreaZoneIds: z.array(zoneId).max(MAX_SERVICE_AREAS).optional(),
});

const listDriversSchema = z.object({
  userId: z.string().min(1).max(64).regex(new RegExp(USER_ID_PATTERN)).optional(),
  onboardingState: z.enum(ONBOARDING_STATES).optional(),
  availability: z.enum(AVAILABILITY_STATES).optional(),
  suspended: z.enum(['true', 'false']).optional(),
  zoneId: zoneId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const reasonSchema = z.object({
  reason: z.string().trim().min(1).max(200),
});

const setVehicleSchema = z.object({ vehicle: vehicleSchema });

const setServiceAreasSchema = z.object({
  zoneIds: z.array(zoneId).max(MAX_SERVICE_AREAS * 2),
});

const createDocumentSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  number: z.string().min(1).max(64).optional(),
  expiresAt: z.string().regex(new RegExp(DATE_PATTERN), 'must match YYYY-MM-DD').optional(),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type SetVehicleInput = z.infer<typeof setVehicleSchema>;

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

export function parseCreateDriver(input: unknown): CreateDriverInput {
  return parse(createDriverSchema, input);
}

export function parseListDrivers(input: unknown): z.infer<typeof listDriversSchema> {
  return parse(listDriversSchema, input);
}

export function parseReason(input: unknown): z.infer<typeof reasonSchema> {
  return parse(reasonSchema, input);
}

export function parseSetVehicle(input: unknown): SetVehicleInput {
  return parse(setVehicleSchema, input);
}

export function parseSetServiceAreas(input: unknown): z.infer<typeof setServiceAreasSchema> {
  return parse(setServiceAreasSchema, input);
}

export function parseCreateDocument(input: unknown): z.infer<typeof createDocumentSchema> {
  return parse(createDocumentSchema, input);
}
