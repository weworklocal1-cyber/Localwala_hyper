import type { FastifyInstance } from 'fastify';
import { healthController, readyController } from '../controllers/health.controller.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', healthController);
  app.get('/ready', readyController);
}
