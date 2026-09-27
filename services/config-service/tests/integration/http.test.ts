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

  describe('config validation (400)', () => {
    it('rejects a create body with a missing key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/configs',
        payload: {
          type: 'feature_flags',
          environment: 'production',
          payload: { flags: {} },
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an unknown config type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/configs',
        payload: {
          key: 'feature.flags',
          type: 'not_a_type',
          environment: 'production',
          payload: {},
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an unknown environment', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/configs',
        payload: {
          key: 'feature.flags',
          type: 'feature_flags',
          environment: 'qa',
          payload: { flags: {} },
        },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects extra properties on the create body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/configs',
        payload: {
          key: 'feature.flags',
          type: 'feature_flags',
          environment: 'production',
          payload: { flags: {} },
          bogus: true,
        },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a resolve call without a key', async () => {
      const response = await app.inject({ method: 'GET', url: '/configs/resolve' });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a resolve call with an invalid environment', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/configs/resolve?key=feature.flags&environment=nope',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects scheduling without scheduledFor', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/configs/cfg_missing/schedule',
        payload: {},
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects an invalid id param', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/configs/' + 'a'.repeat(65),
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('staging repository (503)', () => {
    it('blocks create with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/configs',
        payload: {
          key: 'feature.flags',
          type: 'feature_flags',
          environment: 'production',
          payload: { flags: {} },
        },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('blocks list with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({ method: 'GET', url: '/configs' });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('blocks resolve with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/configs/resolve?key=feature.flags',
      });
      expect(response.statusCode).toBe(503);
    });

    it('blocks flags with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({ method: 'GET', url: '/configs/flags' });
      expect(response.statusCode).toBe(503);
    });

    it('blocks app-version with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({ method: 'GET', url: '/configs/app-version' });
      expect(response.statusCode).toBe(503);
    });

    it('blocks maintenance with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({ method: 'GET', url: '/configs/maintenance' });
      expect(response.statusCode).toBe(503);
    });

    it('blocks publish of an unknown id with SERVICE_UNAVAILABLE', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/configs/cfg_missing/publish',
      });
      expect(response.statusCode).toBe(503);
    });
  });
});
