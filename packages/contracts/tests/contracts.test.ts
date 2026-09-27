import { describe, expect, it } from 'vitest';
import { ROLES, SERVICES, HEADER_IDEMPOTENCY_KEY } from '../src/index.js';

describe('contracts', () => {
  it('exposes the RBAC role set from the specification', () => {
    expect(ROLES).toContain('customer');
    expect(ROLES).toContain('super_admin');
    expect(ROLES).toHaveLength(9);
  });

  it('exposes all 30 service names without duplicates', () => {
    expect(SERVICES).toHaveLength(30);
    expect(new Set(SERVICES).size).toBe(30);
  });

  it('defines the idempotency header name', () => {
    expect(HEADER_IDEMPOTENCY_KEY).toBe('idempotency-key');
  });
});
