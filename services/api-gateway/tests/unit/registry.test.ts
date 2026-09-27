import { describe, expect, it } from 'vitest';
import { resolveDownstreams } from '../../src/proxy/registry.js';

describe('gateway downstream registry', () => {
  const downstreams = resolveDownstreams();

  it('registers every service except the gateway itself', () => {
    expect(downstreams).toHaveLength(29);
    expect(downstreams.find((entry) => entry.service === 'api-gateway')).toBeUndefined();
  });

  it('assigns a unique route prefix to every downstream', () => {
    const prefixes = downstreams.map((entry) => entry.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('points at the documented local ports', () => {
    const auth = downstreams.find((entry) => entry.service === 'auth-service');
    expect(auth?.upstream).toBe('http://localhost:4101');
    expect(auth?.prefix).toBe('/auth');
  });
});
