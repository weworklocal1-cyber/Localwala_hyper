import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const EVENTS = {
  'order.created': 1,
  'order.confirmed': 1,
  'order.cancelled': 1,
  'order.completed': 1,
  'payment.initiated': 1,
  'payment.succeeded': 1,
  'payment.failed': 1,
  'payment.refunded': 1,
  'inventory.reserved': 1,
  'inventory.released': 1,
  'dispatch.offer.created': 1,
  'dispatch.offer.accepted': 1,
  'assignment.created': 1,
  'assignment.released': 1,
  'delivery.status.changed': 1,
  'wallet.credited': 1,
  'wallet.debited': 1,
  'settlement.completed': 1,
  'notification.requested': 1,
  'user.created': 1,
  'locality.activated': 1,
  'subscription.created': 1,
  'subscription.paused': 1,
  'support.ticket.created': 1,
  'audit.recorded': 1,
} as const;

export type EventType = keyof typeof EVENTS;

export const EVENT_SCHEMA_VERSION = 1;

const eventTypeSchema = z.enum(Object.keys(EVENTS) as [EventType, ...EventType[]]);

export const eventEnvelopeSchema = z
  .object({
    eventId: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'eventId must be a UUID'),
    eventType: eventTypeSchema,
    eventVersion: z.number().int().min(1),
    occurredAt: z.string().min(20),
    producer: z.string().min(3).max(64),
    aggregateType: z.string().min(3).max(64),
    aggregateId: z.string().min(1).max(128),
    correlationId: z.string().min(1).max(128),
    traceId: z.string().max(128).optional(),
    payload: z.record(z.string(), z.unknown()),
  })
  .superRefine((value, ctx) => {
    const expected = EVENTS[value.eventType];
    if (value.eventVersion !== expected) {
      ctx.addIssue({
        code: 'custom',
        message: `eventVersion must be ${expected} for ${value.eventType}`,
        path: ['eventVersion'],
      });
    }
  });

export type EventEnvelope<TPayload = Record<string, unknown>> = z.input<
  typeof eventEnvelopeSchema
> & { payload: TPayload; eventType: EventType };

export interface CreateEnvelopeInput<TPayload = Record<string, unknown>> {
  eventType: EventType;
  producer: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  traceId?: string;
  payload: TPayload;
}

export function createEnvelope<TPayload = Record<string, unknown>>(
  input: CreateEnvelopeInput<TPayload>,
): z.infer<typeof eventEnvelopeSchema> & { payload: TPayload } {
  const candidate = {
    eventId: randomUUID(),
    eventType: input.eventType,
    eventVersion: EVENTS[input.eventType],
    occurredAt: new Date().toISOString(),
    producer: input.producer,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    correlationId: input.correlationId,
    ...(input.traceId !== undefined ? { traceId: input.traceId } : {}),
    payload: input.payload,
  };

  return eventEnvelopeSchema.parse(candidate) as z.infer<typeof eventEnvelopeSchema> & {
    payload: TPayload;
  };
}

export function safeParseEnvelope(
  data: unknown,
):
  | { ok: true; value: z.infer<typeof eventEnvelopeSchema> }
  | { ok: false; issues: z.core.$ZodIssue[] } {
  const result = eventEnvelopeSchema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, issues: result.error.issues };
}
