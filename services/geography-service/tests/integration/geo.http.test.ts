import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('Geo HTTP surface', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /geo returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/geo',
      payload: { type: 'city', name: 'Test City' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('GET /geo/:id returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/geo/geo_1',
    });
    expect(response.statusCode).toBe(503);
  });

  it('PATCH /geo/:id returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/geo/geo_1',
      payload: { name: 'Updated' },
    });
    expect([400, 503]).toContain(response.statusCode);
  });

  it('DELETE /geo/:id returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/geo/geo_1',
    });
    expect(response.statusCode).toBe(503);
  });

  it('POST /geo/:id/activate returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/geo/geo_1/activate',
      payload: { isActive: false },
    });
    expect(response.statusCode).toBe(503);
  });

  it('GET /geo returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/geo',
    });
    expect(response.statusCode).toBe(503);
  });

  it('GET /geo/resolve returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/geo/resolve?lat=17.385&lng=78.4867',
    });
    expect(response.statusCode).toBe(503);
  });

  it('GET /geo/serviceability returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/geo/serviceability?lat=17.385&lng=78.4867',
    });
    expect(response.statusCode).toBe(503);
  });

  it('GET /geo/cities/:cityId/zones returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/geo/cities/city_1/zones',
    });
    expect(response.statusCode).toBe(503);
  });

  it('GET /geo/zones/:zoneId/localities returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/geo/zones/zone_1/localities',
    });
    expect(response.statusCode).toBe(503);
  });

  it('rejects invalid lat/lng with 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/geo/resolve?lat=200&lng=78.4867',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing lat/lng with 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/geo/resolve',
    });
    expect(response.statusCode).toBe(400);
  });
});
