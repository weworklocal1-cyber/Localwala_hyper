import type { HealthResponse, ReadinessCheck, ReadinessResponse } from '@localwala/contracts';
import { SERVICE_NAME } from '../config/index.js';

const STARTED_AT = Date.now();
const VERSION = process.env.SERVICE_VERSION ?? '0.1.0';

export function getHealth(): HealthResponse {
  return {
    status: 'ok',
    service: SERVICE_NAME,
    version: VERSION,
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    timestamp: new Date().toISOString(),
  };
}

export function getReadiness(checks: ReadinessCheck[] = []): ReadinessResponse {
  const all: ReadinessCheck[] = [{ name: 'process', status: 'up' }, ...checks];
  return {
    status: all.every((check) => check.status === 'up') ? 'ready' : 'not_ready',
    service: SERVICE_NAME,
    checks: all,
  };
}
