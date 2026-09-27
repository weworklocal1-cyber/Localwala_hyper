import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

const ENTRY_ID = `wen_${'a1b2c3d4'.repeat(4)}`;
const WITHDRAWAL_ID = `wdr_${'a1b2c3d4'.repeat(4)}`;

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

describe('wallet routes validation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload });

  it('rejects wallet creation without userId', async () => {
    const response = await post('/wallets', {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed userId param', async () => {
    const response = await app.inject({ method: 'GET', url: '/wallets/bad%20id!' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a zero credit amount', async () => {
    const response = await post('/wallets', { userId: 'usr_1', creditAmount: 0 });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a fractional credit amount', async () => {
    const response = await post('/wallets', { userId: 'usr_1', creditAmount: 10.5 });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a credit amount above the cap', async () => {
    const response = await post('/wallets', { userId: 'usr_1', creditAmount: 100_000_001 });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown properties on credit', async () => {
    const response = await post('/wallets/usr_1/credit', { amount: 100, admin: true });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed hold entry id param', async () => {
    const response = await post('/wallets/usr_1/holds/wen_1/release', {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed withdrawal id param', async () => {
    const response = await post('/withdrawals/wdr_1/approve', {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a rejection without a reason', async () => {
    const response = await post(`/withdrawals/${WITHDRAWAL_ID}/reject`, {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown withdrawal state filter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/wallets/usr_1/withdrawals?state=mystery',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('wallet routes staging behavior', () => {
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

  it('blocks wallet creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/wallets',
      payload: { userId: 'usr_1' },
    });
    expect503(response);
  });

  it('blocks wallet fetch', async () => {
    const response = await app.inject({ method: 'GET', url: '/wallets/usr_1' });
    expect503(response);
  });

  it('blocks ledger listing', async () => {
    const response = await app.inject({ method: 'GET', url: '/wallets/usr_1/entries' });
    expect503(response);
  });

  it('blocks credit', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/wallets/usr_1/credit',
      payload: { amount: 1000 },
    });
    expect503(response);
  });

  it('blocks debit', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/wallets/usr_1/debit',
      payload: { amount: 1000 },
    });
    expect503(response);
  });

  it('blocks hold creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/wallets/usr_1/holds',
      payload: { amount: 1000 },
    });
    expect503(response);
  });

  it('blocks hold release', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/wallets/usr_1/holds/${ENTRY_ID}/release`,
      payload: {},
    });
    expect503(response);
  });

  it('blocks withdrawal creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/wallets/usr_1/withdrawals',
      payload: { amount: 1000 },
    });
    expect503(response);
  });

  it('blocks withdrawal listing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/wallets/usr_1/withdrawals',
    });
    expect503(response);
  });

  it('blocks withdrawal approval', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/withdrawals/${WITHDRAWAL_ID}/approve`,
    });
    expect503(response);
  });

  it('blocks withdrawal rejection after payload validation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/withdrawals/${WITHDRAWAL_ID}/reject`,
      payload: { reason: 'kyc pending' },
    });
    expect503(response);
  });
});
