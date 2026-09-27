import { describe, expect, it } from 'vitest';
import { createLogger, createRequestChild } from '../src/index.js';

describe('logger', () => {
  it('creates a logger bound to the service name', () => {
    const logger = createLogger({ serviceName: 'auth-service', level: 'silent' });
    expect(logger.bindings().service).toBe('auth-service');
  });

  it('creates a request-scoped child logger', () => {
    const logger = createLogger({ serviceName: 'auth-service', level: 'silent' });
    const child = createRequestChild(logger, { requestId: 'req_1', traceId: 'trace_1' });
    expect(child.bindings().requestId).toBe('req_1');
    expect(child.bindings().traceId).toBe('trace_1');
  });
});
