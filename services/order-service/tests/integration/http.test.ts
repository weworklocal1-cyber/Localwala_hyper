import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

const VALID_ID = `ord_${'a1b2c3d4'.repeat(4)}`;

describe('http surface', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves liveness', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
  });

  it('serves readiness', async () => {
    const response = await app.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ready');
  });

  it('returns the standard error envelope for unknown routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/definitely-missing' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('echoes the correlation id header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-correlation-id': 'corr-test-1' },
    });
    expect(response.headers['x-correlation-id']).toBe('corr-test-1');
  });
});

describe('order routes validation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (url: string, payload: unknown, headers: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url, payload, headers });

  it('rejects create without addressId', async () => {
    const response = await post(
      '/orders',
      { userId: 'usr_1', vertical: 'food' },
      { 'idempotency-key': 'idem_key_0000001' },
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects create with unknown properties', async () => {
    const response = await post(
      '/orders',
      { userId: 'usr_1', vertical: 'food', addressId: 'addr_1', price: 1 },
      { 'idempotency-key': 'idem_key_0000001' },
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects create without an idempotency key', async () => {
    const response = await post('/orders', {
      userId: 'usr_1',
      vertical: 'food',
      addressId: 'addr_1',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(response.json())).toContain('idempotency');
  });

  it('rejects a malformed order id param', async () => {
    const response = await app.inject({ method: 'GET', url: '/orders/ord_123' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown status filter', async () => {
    const response = await app.inject({ method: 'GET', url: '/orders?status=teleported' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a transition without a target', async () => {
    const response = await post(`/orders/${VALID_ID}/transitions`, {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown transition target', async () => {
    const response = await post(`/orders/${VALID_ID}/transitions`, { to: 'teleported' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('order routes staging behavior', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const expect503 = (response: { statusCode: number; json: () => { error: { code: string } } }) => {
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
  };

  it('blocks order creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { 'idempotency-key': 'idem_key_0000001' },
      payload: { userId: 'usr_1', vertical: 'food', addressId: 'addr_1' },
    });
    expect503(response);
  });

  it('blocks order fetch', async () => {
    const response = await app.inject({ method: 'GET', url: `/orders/${VALID_ID}` });
    expect503(response);
  });

  it('blocks order listing', async () => {
    const response = await app.inject({ method: 'GET', url: '/orders?userId=usr_1' });
    expect503(response);
  });

  it('blocks transitions', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/orders/${VALID_ID}/transitions`,
      payload: { to: 'confirmed', actor: 'partner_1' },
    });
    expect503(response);
  });

  it('rejects cancellation without a reason before touching the store', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/orders/${VALID_ID}/transitions`,
      payload: { to: 'cancelled' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(response.json())).toContain('reason');
  });
});
