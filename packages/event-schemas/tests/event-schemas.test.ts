import { describe, expect, it } from 'vitest';
import { EVENTS, createEnvelope, eventEnvelopeSchema, safeParseEnvelope } from '../src/index.js';

describe('event envelope', () => {
  it('creates a valid versioned envelope', () => {
    const envelope = createEnvelope({
      eventType: 'order.created',
      producer: 'order-service',
      aggregateType: 'order',
      aggregateId: 'ord_1',
      correlationId: 'corr_1',
      payload: { orderId: 'ord_1' },
    });

    expect(eventEnvelopeSchema.safeParse(envelope).success).toBe(true);
    expect(envelope.eventVersion).toBe(EVENTS['order.created']);
    expect(envelope.payload).toEqual({ orderId: 'ord_1' });
  });

  it('rejects unknown event types', () => {
    const envelope = createEnvelope({
      eventType: 'order.created',
      producer: 'order-service',
      aggregateType: 'order',
      aggregateId: 'ord_1',
      correlationId: 'corr_1',
      payload: {},
    });

    const result = safeParseEnvelope({ ...envelope, eventType: 'order.teleported' });
    expect(result.ok).toBe(false);
  });

  it('requires correlation and aggregate identity', () => {
    const result = safeParseEnvelope({
      eventId: 'x',
      eventType: 'order.created',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producer: 'order-service',
      aggregateType: 'order',
      correlationId: 'corr_1',
      payload: {},
    });
    expect(result.ok).toBe(false);
  });
});
