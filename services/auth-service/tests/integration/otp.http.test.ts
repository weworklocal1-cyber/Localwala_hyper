import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('OTP HTTP surface', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /otp/request returns 503 (provider blocked) with correct envelope', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/otp/request',
      payload: { phone: '+919876543210' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('POST /otp/verify returns 503 (repository blocked) with correct envelope', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/otp/verify',
      payload: { phone: '+919876543210', code: '123456' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('POST /otp/resend returns 503 (provider blocked)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/otp/resend',
      payload: { phone: '+919876543210' },
    });
    expect(response.statusCode).toBe(503);
  });

  it('rejects invalid phone format with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/otp/request',
      payload: { phone: '9876543210' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing fields with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/otp/verify',
      payload: { phone: '+919876543210' },
    });
    expect(response.statusCode).toBe(400);
  });
});
