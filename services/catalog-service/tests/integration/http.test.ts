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

  describe('catalog validation (400)', () => {
    it('rejects a category create without a name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/categories',
        payload: { key: 'groceries' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a category key that is not a slug', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/categories',
        payload: { key: 'Bad Key!', name: 'Bad' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a product without variants', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/products',
        payload: { key: 'rice', categoryId: 'cat_1', name: 'Rice', variants: [] },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a product without a categoryId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/products',
        payload: {
          key: 'rice',
          name: 'Rice',
          variants: [{ sku: 'R-1', name: '1kg', price: 10, mrp: 12 }],
        },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a product where mrp is below price (business rule)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/products',
        payload: {
          key: 'rice',
          categoryId: 'cat_1',
          name: 'Rice',
          variants: [{ sku: 'R-1', name: '1kg', price: 100, mrp: 50 }],
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an unknown product status', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/products/prd_1',
        payload: { status: 'archived' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects an unknown status on the product list query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/products?status=bogus',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects an availability body without the flag', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/products/prd_1/availability',
        payload: {},
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects unknown properties on a variant patch', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/products/prd_1/variants/var_1',
        payload: { price: 10, bogus: true },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('staging repository (503)', () => {
    it('blocks category create with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/categories',
        payload: { key: 'groceries', name: 'Groceries' },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('blocks category list with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({ method: 'GET', url: '/categories' });
      expect(response.statusCode).toBe(503);
    });

    it('blocks category tree with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({ method: 'GET', url: '/categories/tree' });
      expect(response.statusCode).toBe(503);
    });

    it('blocks category fetch with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({ method: 'GET', url: '/categories/cat_1' });
      expect(response.statusCode).toBe(503);
    });

    it('blocks product create with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/products',
        payload: {
          key: 'rice',
          categoryId: 'cat_1',
          name: 'Rice',
          variants: [{ sku: 'R-1', name: '1kg', price: 10, mrp: 12 }],
        },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('blocks product list with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({ method: 'GET', url: '/products' });
      expect(response.statusCode).toBe(503);
    });

    it('blocks product fetch with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({ method: 'GET', url: '/products/prd_1' });
      expect(response.statusCode).toBe(503);
    });

    it('blocks availability toggle with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/products/prd_1/availability',
        payload: { available: false },
      });
      expect(response.statusCode).toBe(503);
    });
  });
});
