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

  describe('inventory validation (400)', () => {
    it('rejects stock create without physical', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/stock',
        payload: { sku: 'RICE-1K' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a negative physical quantity', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/stock',
        payload: { sku: 'RICE-1K', physical: -5 },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects an invalid SKU', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/stock',
        payload: { sku: 'bad sku!', physical: 5 },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a zero-delta adjustment', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/stock/RICE-1K/adjust',
        payload: { delta: 0 },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a reservation without a key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { sku: 'RICE-1K', qty: 1 },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a reservation with qty below one', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { key: 'ord-1', sku: 'RICE-1K', qty: 0 },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects an unknown reservation state in the query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/reservations?state=bogus',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a non-integer qty on reserve', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { key: 'ord-1', sku: 'RICE-1K', qty: 1.5 },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('staging repository (503)', () => {
    it('blocks stock create with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/stock',
        payload: { sku: 'RICE-1K', physical: 25 },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('blocks stock list with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({ method: 'GET', url: '/stock' });
      expect(response.statusCode).toBe(503);
    });

    it('blocks stock fetch with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({ method: 'GET', url: '/stock/RICE-1K' });
      expect(response.statusCode).toBe(503);
    });

    it('blocks stock patch with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/stock/RICE-1K',
        payload: { physical: 40 },
      });
      expect(response.statusCode).toBe(503);
    });

    it('blocks adjust with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/stock/RICE-1K/adjust',
        payload: { delta: 5 },
      });
      expect(response.statusCode).toBe(503);
    });

    it('blocks reservation create with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { key: 'ord-1', sku: 'RICE-1K', qty: 1 },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('blocks reservation fetch with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({ method: 'GET', url: '/reservations/ord-1' });
      expect(response.statusCode).toBe(503);
    });

    it('blocks reservation list with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({ method: 'GET', url: '/reservations' });
      expect(response.statusCode).toBe(503);
    });

    it('blocks release with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/reservations/ord-1/release',
      });
      expect(response.statusCode).toBe(503);
    });

    it('blocks commit with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/reservations/ord-1/commit',
      });
      expect(response.statusCode).toBe(503);
    });
  });
});
