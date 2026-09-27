import { describe, expect, it } from 'vitest';
import { getHealth, getReadiness } from '../../src/services/health.service.js';

describe('health service (promotion-service)', () => {
  it('reports ok with the service name', () => {
    const health = getHealth();
    expect(health.status).toBe('ok');
    expect(health.service).toBe('promotion-service');
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports ready when every dependency check is up', () => {
    const ready = getReadiness();
    expect(ready.status).toBe('ready');
    expect(ready.checks.every((check) => check.status === 'up')).toBe(true);
  });

  it('reports not_ready when a dependency check is down', () => {
    const result = getReadiness([{ name: 'redis', status: 'down' }]);
    expect(result.status).toBe('not_ready');
  });
});
