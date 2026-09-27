import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { envBool, envInt, envList, requireEnv, serviceEnv } from '../src/index.js';

describe('config', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
  });

  afterEach(() => {
    process.env = original;
  });

  it('throws for missing required variables', () => {
    delete process.env.SOME_MISSING_VAR;
    expect(() => requireEnv('SOME_MISSING_VAR')).toThrow(
      'Missing required environment variable: SOME_MISSING_VAR',
    );
  });

  it('parses integers with fallback and rejects garbage', () => {
    expect(envInt('PORT', 4000)).toBe(4000);
    process.env.PORT = '5555';
    expect(envInt('PORT', 4000)).toBe(5555);
    process.env.PORT = 'abc';
    expect(() => envInt('PORT', 4000)).toThrow('must be an integer');
  });

  it('parses booleans and lists', () => {
    expect(envBool('FLAG', true)).toBe(true);
    process.env.FLAG = 'TRUE';
    expect(envBool('FLAG', false)).toBe(true);
    process.env.KAFKA_BROKERS = 'b-1:9092, b-2:9092';
    expect(envList('KAFKA_BROKERS')).toEqual(['b-1:9092', 'b-2:9092']);
  });

  it('builds service env with defaults', () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    const env = serviceEnv('auth-service', 4101);
    expect(env.serviceName).toBe('auth-service');
    expect(env.port).toBe(4101);
    expect(env.nodeEnv).toBe('development');
    expect(env.kafkaBrokers).toEqual(['localhost:9092']);
  });
});
