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

const DRIVER_ID = `drv_${'a1b2c3d4'.repeat(4)}`;
const DOCUMENT_ID = `dcm_${'a1b2c3d4'.repeat(4)}`;

describe('driver routes validation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload });

  it('rejects driver creation without a vehicle', async () => {
    const response = await post('/drivers', { userId: 'usr_1' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown vehicle type', async () => {
    const response = await post('/drivers', {
      userId: 'usr_1',
      vehicle: { type: 'hoverboard' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed service-area zone id', async () => {
    const response = await post('/drivers', {
      userId: 'usr_1',
      vehicle: { type: 'bicycle' },
      serviceAreaZoneIds: ['bad zone!'],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed driver id param', async () => {
    const response = await app.inject({ method: 'GET', url: '/drivers/drv_1' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a rejection without a reason', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/reject`, {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a suspension without a reason', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/suspend`, { reason: '' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown onboarding state filter', async () => {
    const response = await app.inject({ method: 'GET', url: '/drivers?onboardingState=mystery' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown availability filter', async () => {
    const response = await app.inject({ method: 'GET', url: '/drivers?availability=maybe' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an out-of-range driver list limit', async () => {
    const response = await app.inject({ method: 'GET', url: '/drivers?limit=500' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a vehicle update without a vehicle', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/drivers/${DRIVER_ID}/vehicle`,
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a service-area payload without zoneIds', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/drivers/${DRIVER_ID}/service-areas`,
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects document creation with an unknown type', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/documents`, { type: 'crayon_drawing' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed document expiry date', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/documents`, {
      type: 'license',
      expiresAt: '30-06-2027',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed document id param', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/documents/dcm_1/verify`, {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects document rejection without a reason', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/documents/${DOCUMENT_ID}/reject`, {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('driver routes staging behavior', () => {
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

  it('blocks driver creation', async () => {
    const response = await post('/drivers', {
      userId: 'usr_1',
      vehicle: { type: 'motorcycle' },
    });
    expect503(response);
  });

  it('blocks driver listing', async () => {
    const response = await app.inject({ method: 'GET', url: '/drivers' });
    expect503(response);
  });

  it('blocks driver fetch', async () => {
    const response = await app.inject({ method: 'GET', url: `/drivers/${DRIVER_ID}` });
    expect503(response);
  });

  it('blocks approval', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/approve`, {});
    expect503(response);
  });

  it('blocks rejection after payload validation', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/reject`, { reason: 'docs mismatch' });
    expect503(response);
  });

  it('blocks suspension after payload validation', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/suspend`, { reason: 'incident' });
    expect503(response);
  });

  it('blocks unsuspension', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/unsuspend`, {});
    expect503(response);
  });

  it('blocks going online', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/online`, {});
    expect503(response);
  });

  it('blocks going offline', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/offline`, {});
    expect503(response);
  });

  it('blocks vehicle updates', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/drivers/${DRIVER_ID}/vehicle`,
      payload: { vehicle: { type: 'van' } },
    });
    expect503(response);
  });

  it('blocks service-area updates', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/drivers/${DRIVER_ID}/service-areas`,
      payload: { zoneIds: ['zone_central'] },
    });
    expect503(response);
  });

  it('blocks document creation', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/documents`, { type: 'license' });
    expect503(response);
  });

  it('blocks document listing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/drivers/${DRIVER_ID}/documents`,
    });
    expect503(response);
  });

  it('blocks document verification', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/documents/${DOCUMENT_ID}/verify`, {});
    expect503(response);
  });

  it('blocks document rejection after payload validation', async () => {
    const response = await post(`/drivers/${DRIVER_ID}/documents/${DOCUMENT_ID}/reject`, {
      reason: 'blurred scan',
    });
    expect503(response);
  });
});
