import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

const TEMPLATE_ID = `tpl_${'a1b2c3d4'.repeat(4)}`;
const NOTIFICATION_ID = `ian_${'a1b2c3d4'.repeat(4)}`;

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

describe('notification routes validation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload });

  it('rejects template creation without a body', async () => {
    const response = await post('/templates', { key: 'order_confirmed', channel: 'push' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid template key', async () => {
    const response = await post('/templates', { key: 'Bad Key!', channel: 'push', body: 'x' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown channel', async () => {
    const response = await post('/templates', { key: 'valid_key', channel: 'pigeon', body: 'x' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown properties on template creation', async () => {
    const response = await post('/templates', {
      key: 'valid_key',
      channel: 'push',
      body: 'x',
      admin: true,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed template id param', async () => {
    const response = await app.inject({ method: 'GET', url: '/templates/tpl_1' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty template update', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/templates/${TEMPLATE_ID}`,
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an out-of-range template list limit', async () => {
    const response = await app.inject({ method: 'GET', url: '/templates?limit=500' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects preference updates with an invalid userId', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/preferences',
      payload: { userId: 'bad id!', channel: 'push', enabled: true },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a send without templateKey', async () => {
    const response = await post('/notifications/send', { userId: 'usr_1', channel: 'push' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a send with a non-numeric variable value', async () => {
    const response = await post('/notifications/send', {
      userId: 'usr_1',
      channel: 'push',
      templateKey: 'order_confirmed',
      variables: { orderId: { nested: true } },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a javascript deep link', async () => {
    const response = await post('/notifications/in-app', {
      userId: 'usr_1',
      title: 'Hello',
      deepLink: 'javascript:alert(1)',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects in-app creation without a title', async () => {
    const response = await post('/notifications/in-app', { userId: 'usr_1' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed notification id param', async () => {
    const response = await post('/notifications/in-app/ian_1/read', {});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown unreadOnly filter value', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/notifications/in-app?userId=usr_1&unreadOnly=maybe',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('notification routes staging behavior', () => {
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

  it('blocks template creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/templates',
      payload: { key: 'order_confirmed', channel: 'push', body: 'x' },
    });
    expect503(response);
  });

  it('blocks template listing', async () => {
    const response = await app.inject({ method: 'GET', url: '/templates' });
    expect503(response);
  });

  it('blocks template fetch', async () => {
    const response = await app.inject({ method: 'GET', url: `/templates/${TEMPLATE_ID}` });
    expect503(response);
  });

  it('blocks template update after payload validation', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/templates/${TEMPLATE_ID}`,
      payload: { body: 'updated' },
    });
    expect503(response);
  });

  it('blocks template deletion', async () => {
    const response = await app.inject({ method: 'DELETE', url: `/templates/${TEMPLATE_ID}` });
    expect503(response);
  });

  it('blocks preference reads', async () => {
    const response = await app.inject({ method: 'GET', url: '/preferences/usr_1' });
    expect503(response);
  });

  it('blocks preference writes', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/preferences',
      payload: { userId: 'usr_1', channel: 'push', enabled: false },
    });
    expect503(response);
  });

  it('blocks channel sends after payload validation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/notifications/send',
      payload: { userId: 'usr_1', channel: 'push', templateKey: 'order_confirmed' },
    });
    expect503(response);
  });

  it('blocks direct in-app creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/notifications/in-app',
      payload: { userId: 'usr_1', title: 'Hello' },
    });
    expect503(response);
  });

  it('blocks in-app listing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/notifications/in-app?userId=usr_1',
    });
    expect503(response);
  });

  it('blocks marking a notification read', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/notifications/in-app/${NOTIFICATION_ID}/read`,
    });
    expect503(response);
  });

  it('blocks marking all notifications read', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/notifications/in-app/usr_1/read-all',
    });
    expect503(response);
  });
});
