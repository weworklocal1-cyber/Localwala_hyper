import { describe, expect, it } from 'vitest';
import { AppError, notFound, toErrorBody } from '../src/index.js';

describe('AppError', () => {
  it('maps error codes to HTTP status codes', () => {
    expect(new AppError('RATE_LIMITED').statusCode).toBe(429);
    expect(new AppError('NOT_FOUND').statusCode).toBe(404);
    expect(new AppError('INTERNAL_ERROR').statusCode).toBe(500);
  });

  it('builds not found messages with and without ids', () => {
    expect(notFound('Order').message).toBe('Order not found');
    expect(notFound('Order', 'ord_1').message).toBe('Order ord_1 not found');
  });

  it('defaults retryable for 5xx only', () => {
    expect(new AppError('SERVICE_UNAVAILABLE').retryable).toBe(true);
    expect(new AppError('VALIDATION_ERROR').retryable).toBe(false);
  });
});

describe('toErrorBody', () => {
  it('serialises AppError without leaking internals', () => {
    const { statusCode, body } = toErrorBody(new AppError('FORBIDDEN', { message: 'nope' }));
    expect(statusCode).toBe(403);
    expect(body).toEqual({ error: { code: 'FORBIDDEN', message: 'nope' } });
  });

  it('maps fastify validation errors to VALIDATION_ERROR', () => {
    const err = Object.assign(new Error('body must have property email'), {
      validation: [{ message: 'required' }],
      statusCode: 400,
    });
    const { statusCode, body } = toErrorBody(err);
    expect(statusCode).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('never leaks unknown error messages on 500', () => {
    const { statusCode, body } = toErrorBody(new Error('secret db password leaked'));
    expect(statusCode).toBe(500);
    expect(body.error.message).toBe('Internal server error');
  });

  it('maps 404 route misses', () => {
    const err = Object.assign(new Error('Route GET:/x not found'), { statusCode: 404 });
    expect(toErrorBody(err).body.error.code).toBe('NOT_FOUND');
  });
});
