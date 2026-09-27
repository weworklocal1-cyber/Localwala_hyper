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

describe('cart routes validation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload });

  it('rejects create without vertical', async () => {
    const response = await post('/carts', { userId: 'usr_1' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects create with unknown properties', async () => {
    const response = await post('/carts', { userId: 'usr_1', vertical: 'food', admin: true });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed user id param', async () => {
    const response = await app.inject({ method: 'GET', url: '/carts/bad%20id!/food' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an uppercase vertical param', async () => {
    const response = await app.inject({ method: 'GET', url: '/carts/usr_1/FOOD' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects item qty below one', async () => {
    const response = await post('/carts/usr_1/food/items', {
      productId: 'prod_1',
      variantId: 'var_1',
      qty: 0,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects item qty above the per-line cap', async () => {
    const response = await post('/carts/usr_1/food/items', {
      productId: 'prod_1',
      variantId: 'var_1',
      qty: 100,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty item patch', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/carts/usr_1/food/items/ln_1',
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty cart patch', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/carts/usr_1/food',
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed coupon code', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/carts/usr_1/food/coupon',
      payload: { code: 'a b' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('cart routes staging behavior', () => {
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

  it('blocks cart creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/carts',
      payload: { userId: 'usr_1', vertical: 'food' },
    });
    expect503(response);
  });

  it('blocks cart fetch', async () => {
    const response = await app.inject({ method: 'GET', url: '/carts/usr_1/food' });
    expect503(response);
  });

  it('blocks cart delete', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/carts/usr_1/food' });
    expect503(response);
  });

  it('blocks cart patch', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/carts/usr_1/food',
      payload: { addressId: 'addr_1' },
    });
    expect503(response);
  });

  it('blocks adding an item', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/carts/usr_1/food/items',
      payload: { productId: 'prod_1', variantId: 'var_1', qty: 2 },
    });
    expect503(response);
  });

  it('blocks patching an item', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/carts/usr_1/food/items/ln_1',
      payload: { qty: 3 },
    });
    expect503(response);
  });

  it('blocks removing an item', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/carts/usr_1/food/items/ln_1',
    });
    expect503(response);
  });

  it('blocks coupon application', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/carts/usr_1/food/coupon',
      payload: { code: 'FLAT50' },
    });
    expect503(response);
  });

  it('blocks coupon clearing', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/carts/usr_1/food/coupon',
    });
    expect503(response);
  });

  it('blocks checkout readiness', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/carts/usr_1/food/checkout-readiness',
    });
    expect503(response);
  });
});
