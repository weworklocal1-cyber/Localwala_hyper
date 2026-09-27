import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('User HTTP surface', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /users returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { phone: '+919876543210', name: 'Test User' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('GET /users/:id returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/users/usr_1',
    });
    expect(response.statusCode).toBe(503);
  });

  it('PATCH /users/:id returns 503 (staging repo blocked) or 400 (validation)', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/users/usr_1',
      payload: { name: 'Updated' },
    });
    // Either validation passes and repo blocks (503), or validation fails (400)
    expect([400, 503]).toContain(response.statusCode);
  });

  it('DELETE /users/:id returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/users/usr_1',
    });
    expect(response.statusCode).toBe(503);
  });

  it('GET /users returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/users',
    });
    expect(response.statusCode).toBe(503);
  });

  it('GET /users/:id/permissions returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/users/usr_1/permissions',
    });
    expect(response.statusCode).toBe(503);
  });

  it('POST /users/:id/check-permission returns 503 (staging repo blocked)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users/usr_1/check-permission',
      payload: { permission: 'user:read' },
    });
    expect(response.statusCode).toBe(503);
  });

  it('rejects invalid phone format with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { phone: '9876543210' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing phone with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Test' },
    });
    expect(response.statusCode).toBe(400);
  });
});
