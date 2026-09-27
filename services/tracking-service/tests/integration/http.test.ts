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

const DELIVERY_ID = `dlv_${'a1b2c3d4'.repeat(4)}`;
const DRIVER_ID = `drv_${'a1b2c3d4'.repeat(4)}`;

const validLocation = {
  subjectType: 'delivery',
  subjectId: DELIVERY_ID,
  lat: 19.076,
  lng: 72.8777,
  recordedAt: 1_760_000_000_000,
};

describe('tracking routes validation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload });

  it('rejects a location without a latitude', async () => {
    const { lat, ...withoutLat } = validLocation;
    void lat;
    const response = await post('/tracking/locations', withoutLat);
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a latitude outside valid range', async () => {
    const response = await post('/tracking/locations', { ...validLocation, lat: 91 });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a location without recordedAt', async () => {
    const { recordedAt, ...withoutTimestamp } = validLocation;
    void recordedAt;
    const response = await post('/tracking/locations', withoutTimestamp);
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a delivery subject id that does not match the pattern', async () => {
    const response = await post('/tracking/locations', {
      ...validLocation,
      subjectId: 'dlv_1',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a driver id used for a delivery subject', async () => {
    const response = await post('/tracking/locations', {
      ...validLocation,
      subjectId: DRIVER_ID,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown subject type', async () => {
    const response = await post('/tracking/locations', {
      ...validLocation,
      subjectType: 'drone',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown properties on a location', async () => {
    const response = await post('/tracking/locations', {
      ...validLocation,
      driverName: 'Ravi',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty batch', async () => {
    const response = await post('/tracking/locations/batch', { updates: [] });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a batch over the item cap', async () => {
    const updates = Array.from({ length: 101 }, () => validLocation);
    const response = await post('/tracking/locations/batch', { updates });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed subject params', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/tracking/delivery/dlv_1/snapshot',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an out-of-range trail limit', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/tracking/delivery/${DELIVERY_ID}/trail?limit=500`,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a subject id in params that does not match the subject type', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/tracking/delivery/${DRIVER_ID}/snapshot`,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('tracking routes staging behavior', () => {
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

  it('blocks location ingestion', async () => {
    const response = await post('/tracking/locations', validLocation);
    expect503(response);
  });

  it('blocks batch ingestion after payload validation', async () => {
    const response = await post('/tracking/locations/batch', { updates: [validLocation] });
    expect503(response);
  });

  it('blocks snapshot reads', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/tracking/delivery/${DELIVERY_ID}/snapshot`,
    });
    expect503(response);
  });

  it('blocks trail reads', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/tracking/delivery/${DELIVERY_ID}/trail`,
    });
    expect503(response);
  });

  it('blocks ending tracking', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/tracking/delivery/${DELIVERY_ID}`,
    });
    expect503(response);
  });
});
