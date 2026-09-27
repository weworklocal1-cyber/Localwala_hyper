import type { FastifyInstance } from 'fastify';
import { createAuthController } from '../controllers/auth.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { StagingAuthRepository, StagingUserRepository } from '../auth/auth.repository.js';

export function buildAuthRoutes(app: FastifyInstance): void {
  const authRepo = new StagingAuthRepository();
  const userRepo = new StagingUserRepository();
  const authService = new AuthService(authRepo, userRepo);
  const controller = createAuthController(authService);

  app.post(
    '/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            code: { type: 'string' },
            device: {
              type: 'object',
              properties: { deviceId: { type: 'string' }, deviceName: { type: 'string' } },
              required: ['deviceId'],
            },
          },
          required: ['phone', 'code', 'device'],
        },
      },
    },
    controller.login,
  );
  app.post(
    '/auth/refresh',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
            device: {
              type: 'object',
              properties: { deviceId: { type: 'string' }, deviceName: { type: 'string' } },
            },
          },
          required: ['refreshToken'],
        },
      },
    },
    controller.refresh,
  );
  app.post(
    '/auth/logout',
    {
      schema: {
        body: {
          type: 'object',
          properties: { sessionId: { type: 'string' } },
          required: ['sessionId'],
        },
      },
    },
    controller.logout,
  );
  app.post('/auth/logout-all', controller.logoutAll);
  app.get('/auth/sessions', controller.sessions);
}
