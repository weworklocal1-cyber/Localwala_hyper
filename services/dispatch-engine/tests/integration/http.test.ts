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

const ASSIGNMENT_ID = `asg_${'a1b2c3d4'.repeat(4)}`;
const DELIVERY_ID = `dlv_${'a1b2c3d4'.repeat(4)}`;
const DRIVER_ID = `drv_${'a1b2c3d4'.repeat(4)}`;

describe('dispatch routes validation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload });

  it('rejects an offer without a deliveryId', async () => {
    const response = await post('/dispatch/offers', { zoneId: 'zone_1' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an offer with a malformed deliveryId', async () => {
    const response = await post('/dispatch/offers', { deliveryId: 'dlv_1' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown required vehicle type', async () => {
    const response = await post('/dispatch/offers', {
      deliveryId: DELIVERY_ID,
      requiredVehicleType: 'segway',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown assignment id param', async () => {
    const response = await post('/dispatch/offers/asg_1/accept', {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a rejection reason that is too long', async () => {
    const response = await post(`/dispatch/offers/${ASSIGNMENT_ID}/reject`, {
      reason: 'x'.repeat(201),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty policy update', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/dispatch/policy',
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an out-of-range policy value', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/dispatch/policy',
      payload: { maxDistanceKm: 0 },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a manual assignment without a driverId', async () => {
    const response = await post('/dispatch/assignments', { deliveryId: DELIVERY_ID });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a reassignment without a reason', async () => {
    const response = await post(`/dispatch/assignments/${ASSIGNMENT_ID}/reassign`, {
      driverId: DRIVER_ID,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown assignment state filter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dispatch/assignments?state=mystery',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an out-of-range assignment list limit', async () => {
    const response = await app.inject({ method: 'GET', url: '/dispatch/assignments?limit=500' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('dispatch routes staging behavior', () => {
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

  const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload });

  it('blocks reading the dispatch policy', async () => {
    const response = await app.inject({ method: 'GET', url: '/dispatch/policy' });
    expect503(response);
  });

  it('blocks policy updates', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/dispatch/policy',
      payload: { maxDistanceKm: 15 },
    });
    expect503(response);
  });

  it('blocks offer creation through the driver directory', async () => {
    const response = await post('/dispatch/offers', { deliveryId: DELIVERY_ID });
    expect503(response);
  });

  it('blocks candidate previews through the driver directory', async () => {
    const response = await post('/dispatch/candidates', { deliveryId: DELIVERY_ID });
    expect503(response);
  });

  it('blocks offer acceptance', async () => {
    const response = await post(`/dispatch/offers/${ASSIGNMENT_ID}/accept`, {});
    expect503(response);
  });

  it('blocks offer rejection after payload validation', async () => {
    const response = await post(`/dispatch/offers/${ASSIGNMENT_ID}/reject`, {
      reason: 'busy',
    });
    expect503(response);
  });

  it('blocks offer timeout', async () => {
    const response = await post(`/dispatch/offers/${ASSIGNMENT_ID}/timeout`, {});
    expect503(response);
  });

  it('blocks manual assignment', async () => {
    const response = await post('/dispatch/assignments', {
      deliveryId: DELIVERY_ID,
      driverId: DRIVER_ID,
    });
    expect503(response);
  });

  it('blocks assignment listing', async () => {
    const response = await app.inject({ method: 'GET', url: '/dispatch/assignments' });
    expect503(response);
  });

  it('blocks assignment fetch', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/dispatch/assignments/${ASSIGNMENT_ID}`,
    });
    expect503(response);
  });

  it('blocks reassignment after payload validation', async () => {
    const response = await post(`/dispatch/assignments/${ASSIGNMENT_ID}/reassign`, {
      driverId: DRIVER_ID,
      reason: 'unresponsive',
    });
    expect503(response);
  });

  it('blocks assignment release', async () => {
    const response = await post(`/dispatch/assignments/${ASSIGNMENT_ID}/release`, {
      reason: 'order cancelled',
    });
    expect503(response);
  });

  it('blocks assignment history', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/dispatch/assignments/${ASSIGNMENT_ID}/history`,
    });
    expect503(response);
  });
});
