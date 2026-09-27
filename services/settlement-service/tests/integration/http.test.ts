import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

const RULE_ID = `cr_${'a1b2c3d4'.repeat(4)}`;
const EARNING_ID = `ern_${'a1b2c3d4'.repeat(4)}`;
const SETTLEMENT_ID = `sty_${'a1b2c3d4'.repeat(4)}`;
const ORDER_ID = `ord_${'a1b2c3d4'.repeat(4)}`;

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

describe('settlement routes validation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload });

  it('rejects a rule without commissionBp', async () => {
    const response = await post('/commission-rules', { scope: 'global' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects commissionBp above 10000', async () => {
    const response = await post('/commission-rules', {
      scope: 'global',
      commissionBp: 10_001,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects partner scope without partnerId at the schema level', async () => {
    const response = await post('/commission-rules', {
      scope: 'partner',
      commissionBp: 1000,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed rule id param', async () => {
    const response = await app.inject({ method: 'GET', url: '/commission-rules/cr_1' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an earning with a malformed orderId', async () => {
    const response = await post('/earnings', {
      orderId: 'ord_123',
      partnerId: 'partner_1',
      grossPaise: 100,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a fractional gross amount', async () => {
    const response = await post('/earnings', {
      orderId: ORDER_ID,
      partnerId: 'partner_1',
      grossPaise: 10.5,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a settlement without partnerId', async () => {
    const response = await post('/settlements', {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown cycle state filter', async () => {
    const response = await app.inject({ method: 'GET', url: '/settlements?state=mystery' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects failing a cycle without a reason', async () => {
    const response = await post(`/settlements/${SETTLEMENT_ID}/fail`, {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed settlement id param', async () => {
    const response = await post('/settlements/sty_1/close', {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('settlement routes staging behavior', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload });

  const expect503 = (response: { statusCode: number; json: () => { error: { code: string } } }) => {
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
  };

  it('blocks rule creation', async () => {
    const response = await post('/commission-rules', {
      scope: 'global',
      commissionBp: 2000,
    });
    expect503(response);
  });

  it('blocks rule listing', async () => {
    const response = await app.inject({ method: 'GET', url: '/commission-rules' });
    expect503(response);
  });

  it('blocks rule fetch', async () => {
    const response = await app.inject({ method: 'GET', url: `/commission-rules/${RULE_ID}` });
    expect503(response);
  });

  it('blocks rule archiving after not-found resolution', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/commission-rules/${RULE_ID}/archive`,
    });
    expect503(response);
  });

  it('blocks earning creation', async () => {
    const response = await post('/earnings', {
      orderId: ORDER_ID,
      partnerId: 'partner_1',
      grossPaise: 10_000,
    });
    expect503(response);
  });

  it('blocks earning listing', async () => {
    const response = await app.inject({ method: 'GET', url: '/earnings' });
    expect503(response);
  });

  it('blocks earning fetch', async () => {
    const response = await app.inject({ method: 'GET', url: `/earnings/${EARNING_ID}` });
    expect503(response);
  });

  it('blocks cycle creation', async () => {
    const response = await post('/settlements', { partnerId: 'partner_1' });
    expect503(response);
  });

  it('blocks cycle listing', async () => {
    const response = await app.inject({ method: 'GET', url: '/settlements' });
    expect503(response);
  });

  it('blocks cycle fetch', async () => {
    const response = await app.inject({ method: 'GET', url: `/settlements/${SETTLEMENT_ID}` });
    expect503(response);
  });

  it('blocks cycle close', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/settlements/${SETTLEMENT_ID}/close`,
    });
    expect503(response);
  });

  it('blocks cycle completion', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/settlements/${SETTLEMENT_ID}/complete`,
    });
    expect503(response);
  });

  it('blocks cycle failure after payload validation', async () => {
    const response = await post(`/settlements/${SETTLEMENT_ID}/fail`, {
      reason: 'payout rejected',
    });
    expect503(response);
  });

  it('blocks reconciliation', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/settlements/${SETTLEMENT_ID}/reconciliation`,
    });
    expect503(response);
  });
});
