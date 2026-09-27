import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('Auth HTTP surface', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        phone: '+919876543210',
        code: '123456',
        device: { deviceId: 'dev-1', deviceName: 'Test Device' },
      },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('POST /auth/refresh returns 503 (staging repo blocked) or 400 (invalid token)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'rt_fake', device: { deviceId: 'dev-1' } },
    });
    // Invalid JWT fails validation/verification before hitting repo
    expect([400, 503]).toContain(response.statusCode);
  });

  it('POST /auth/logout returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { sessionId: 'sess-1' },
    });
    expect(response.statusCode).toBe(503);
  });

  it('POST /auth/logout-all returns 503', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout-all',
    });
    expect(response.statusCode).toBe(503);
  });

  it('GET /auth/sessions returns 503', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/sessions',
    });
    expect(response.statusCode).toBe(503);
  });

  it('rejects invalid phone format on login', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { phone: '9876543210', code: '123456', device: { deviceId: 'dev-1' } },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing fields on refresh', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { device: { deviceId: 'dev-1' } },
    });
    expect(response.statusCode).toBe(400);
  });
});
