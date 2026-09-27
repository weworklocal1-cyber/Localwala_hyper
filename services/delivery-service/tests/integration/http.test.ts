import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

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

const AREA_ID = `dar_${'a1b2c3d4'.repeat(4)}`;
const SLOT_ID = `dsl_${'a1b2c3d4'.repeat(4)}`;
const DELIVERY_ID = `dlv_${'a1b2c3d4'.repeat(4)}`;
const ORDER_ID = `ord_${'a1b2c3d4'.repeat(4)}`;

describe('delivery routes validation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload });

  it('rejects area creation without feePaise', async () => {
    const response = await post('/delivery-areas', { zoneId: 'zone_1', etaMinutes: 30 });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a negative delivery fee', async () => {
    const response = await post('/delivery-areas', {
      zoneId: 'zone_1',
      feePaise: -1,
      etaMinutes: 30,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed area id param', async () => {
    const response = await app.inject({ method: 'GET', url: '/delivery-areas/dar_1' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty area update', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/delivery-areas/${AREA_ID}`,
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown property on area update', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/delivery-areas/${AREA_ID}`,
      payload: { feePaise: 100, admin: true },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed slot date', async () => {
    const response = await post('/delivery-slots', {
      zoneId: 'zone_1',
      date: 'tomorrow',
      startMinute: 540,
      endMinute: 600,
      capacity: 10,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a slot whose end minute is not after its start minute', async () => {
    const response = await post('/delivery-slots', {
      zoneId: 'zone_1',
      date: '2026-10-01',
      startMinute: 600,
      endMinute: 540,
      capacity: 10,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed slot id param', async () => {
    const response = await post('/delivery-slots/dsl_1/reserve', {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a zero reserve quantity', async () => {
    const response = await post(`/delivery-slots/${SLOT_ID}/reserve`, { quantity: 0 });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects delivery creation with a malformed orderId', async () => {
    const response = await post('/deliveries', { orderId: 'ord_1' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects delivery creation with an unknown property', async () => {
    const response = await post('/deliveries', { orderId: ORDER_ID, driverId: 'drv_1' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid OTP code', async () => {
    const response = await post('/deliveries', { orderId: ORDER_ID, otpCode: 'abc' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a transition without a target state', async () => {
    const response = await post(`/deliveries/${DELIVERY_ID}/transitions`, { reason: 'x' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown transition target', async () => {
    const response = await post(`/deliveries/${DELIVERY_ID}/transitions`, { to: 'teleported' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown proof-of-delivery type', async () => {
    const response = await post(`/deliveries/${DELIVERY_ID}/transitions`, {
      to: 'delivered',
      pod: { type: 'mind_meld' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown delivery state filter', async () => {
    const response = await app.inject({ method: 'GET', url: '/deliveries?state=mystery' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an out-of-range delivery list limit', async () => {
    const response = await app.inject({ method: 'GET', url: '/deliveries?limit=500' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('delivery routes staging behavior', () => {
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

  it('blocks area creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/delivery-areas',
      payload: { zoneId: 'zone_1', feePaise: 2500, etaMinutes: 40 },
    });
    expect503(response);
  });

  it('blocks area listing', async () => {
    const response = await app.inject({ method: 'GET', url: '/delivery-areas' });
    expect503(response);
  });

  it('blocks area fetch', async () => {
    const response = await app.inject({ method: 'GET', url: `/delivery-areas/${AREA_ID}` });
    expect503(response);
  });

  it('blocks area update after payload validation', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/delivery-areas/${AREA_ID}`,
      payload: { feePaise: 3000 },
    });
    expect503(response);
  });

  it('blocks slot creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/delivery-slots',
      payload: {
        zoneId: 'zone_1',
        date: '2026-10-01',
        startMinute: 540,
        endMinute: 600,
        capacity: 10,
      },
    });
    expect503(response);
  });

  it('blocks slot listing', async () => {
    const response = await app.inject({ method: 'GET', url: '/delivery-slots' });
    expect503(response);
  });

  it('blocks slot fetch', async () => {
    const response = await app.inject({ method: 'GET', url: `/delivery-slots/${SLOT_ID}` });
    expect503(response);
  });

  it('blocks slot reservation', async () => {
    const response = await post(app, `/delivery-slots/${SLOT_ID}/reserve`, {});
    expect503(response);
  });

  it('blocks slot release', async () => {
    const response = await post(app, `/delivery-slots/${SLOT_ID}/release`, {});
    expect503(response);
  });

  it('blocks delivery creation', async () => {
    const response = await post(app, '/deliveries', { orderId: ORDER_ID });
    expect503(response);
  });

  it('blocks delivery listing', async () => {
    const response = await app.inject({ method: 'GET', url: '/deliveries' });
    expect503(response);
  });

  it('blocks delivery fetch', async () => {
    const response = await app.inject({ method: 'GET', url: `/deliveries/${DELIVERY_ID}` });
    expect503(response);
  });

  it('blocks delivery transitions after payload validation', async () => {
    const response = await post(app, `/deliveries/${DELIVERY_ID}/transitions`, {
      to: 'assigned',
    });
    expect503(response);
  });

  it('blocks delivery history', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/deliveries/${DELIVERY_ID}/history`,
    });
    expect503(response);
  });
});

async function post(app: FastifyInstance, url: string, payload: unknown) {
  return app.inject({ method: 'POST', url, payload });
}
