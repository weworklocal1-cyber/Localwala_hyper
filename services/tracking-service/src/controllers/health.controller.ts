import type { FastifyReply, FastifyRequest } from 'fastify';
import type { HealthResponse, ReadinessResponse } from '@localwala/contracts';
import { getHealth, getReadiness } from '../services/health.service.js';

export async function healthController(): Promise<HealthResponse> {
  return getHealth();
}

export async function readyController(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<ReadinessResponse> {
  const readiness = await getReadiness();
  reply.status(readiness.status === 'ready' ? 200 : 503);
  return readiness;
}
