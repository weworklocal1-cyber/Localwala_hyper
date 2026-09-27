import type { FastifyInstance } from 'fastify';
import { createUserController } from '../controllers/user.controller.js';
import { UserService } from '../rbac/user.service.js';
import { StagingUserRepository } from '../rbac/user.repository.js';

export function buildUserRoutes(app: FastifyInstance): void {
  const userRepo = new StagingUserRepository();
  const userService = new UserService(userRepo);
  const controller = createUserController(userService);

  app.post(
    '/users',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            roles: { type: 'array', items: { type: 'string' } },
          },
          required: ['phone'],
        },
      },
    },
    controller.create,
  );
  app.get(
    '/users/:id',
    {
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    controller.getById,
  );
  app.patch(
    '/users/:id',
    {
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        body: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            name: { type: 'string' },
            avatarUrl: { type: 'string' },
            roles: { type: 'array', items: { type: 'string' } },
            isActive: { type: 'boolean' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    controller.update,
  );
  app.delete(
    '/users/:id',
    {
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    controller.delete,
  );
  app.get(
    '/users',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            role: { type: 'string' },
            active: { type: 'boolean' },
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
          },
        },
      },
    },
    controller.list,
  );
  app.get(
    '/users/:id/permissions',
    {
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    controller.permissions,
  );
  app.post(
    '/users/:id/check-permission',
    {
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        body: {
          type: 'object',
          properties: { permission: { type: 'string' } },
          required: ['permission'],
        },
      },
    },
    controller.checkPermission,
  );
}
