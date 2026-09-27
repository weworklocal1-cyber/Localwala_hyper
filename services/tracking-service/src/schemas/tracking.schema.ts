import { AppError } from '@localwala/errors';
import { z } from 'zod';
import {
  DELIVERY_ID_PATTERN,
  DRIVER_ID_PATTERN,
  MAX_RECORDED_AT_MS,
  SUBJECT_TYPES,
} from '../tracking/tracking.types.js';

const MAX_LIMIT = 200;

const subjectType = z.enum(SUBJECT_TYPES);

const subjectRefine = (
  data: { subjectType: 'delivery' | 'driver'; subjectId: string },
  ctx: z.RefinementCtx,
): void => {
  const pattern = data.subjectType === 'delivery' ? DELIVERY_ID_PATTERN : DRIVER_ID_PATTERN;
  if (!new RegExp(pattern).test(data.subjectId)) {
    ctx.addIssue({
      code: 'custom',
      path: ['subjectId'],
      message:
        data.subjectType === 'delivery'
          ? 'must match ^dlv_[0-9a-f]{32}$'
          : 'must match ^drv_[0-9a-f]{32}$',
    });
  }
};

const locationSchema = z
  .object({
    subjectType,
    subjectId: z.string().min(1).max(64),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    speedKph: z.number().min(0).max(400).optional(),
    heading: z.number().min(0).max(360).optional(),
    accuracyM: z.number().min(0).max(10000).optional(),
    recordedAt: z.number().int().min(0).max(MAX_RECORDED_AT_MS),
  })
  .superRefine(subjectRefine);

const locationBatchSchema = z.object({
  updates: z.array(locationSchema).min(1).max(100),
});

const listTrailSchema = z
  .object({
    subjectType,
    subjectId: z.string().min(1).max(64),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(50),
  })
  .superRefine(subjectRefine);

const endTrackingSchema = z
  .object({
    subjectType,
    subjectId: z.string().min(1).max(64),
  })
  .superRefine(subjectRefine);

export type LocationInput = z.infer<typeof locationSchema>;

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

export function parseLocation(input: unknown): LocationInput {
  return parse(locationSchema, input);
}

export function parseLocationBatch(input: unknown): z.infer<typeof locationBatchSchema> {
  return parse(locationBatchSchema, input);
}

export function parseListTrail(input: unknown): z.infer<typeof listTrailSchema> {
  return parse(listTrailSchema, input);
}

export function parseEndTracking(input: unknown): z.infer<typeof endTrackingSchema> {
  return parse(endTrackingSchema, input);
}
