import { describe, expect, it } from 'vitest';
import { getHealth, getReadiness } from '../../src/services/health.service.js';

describe('health service (food-service)', () => {
  it('reports ok with the service name', () => {
    const health = getHealth();
    expect(health.status).toBe('ok');
    expect(health.service).toBe('food-service');
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports ready when every dependency check is up', async () => {
    const ready = await getReadiness();
    expect(ready.status).toBe('ready');
    expect(ready.checks.every((check) => check.status === 'up')).toBe(true);
  });

  it('reports not_ready when a dependency check is down', async () => {
    const result = await getReadiness([{ name: 'redis', status: 'down' }]);
    expect(result.status).toBe('not_ready');
  });
});
