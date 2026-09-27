import type { FastifyReply, FastifyRequest } from 'fastify';
import { parseOrThrow } from '@localwala/validation';
import {
  userCreateSchema,
  userUpdateSchema,
  userParamsSchema,
  listUsersQuerySchema,
  checkPermissionSchema,
} from '../schemas/user.schema.js';
import { UserService } from '../rbac/user.service.js';
import { type Role, type Permission } from '../rbac/rbac.types.js';

interface AuthenticatedRequest extends FastifyRequest {
  user?: { sub: string; roles: string[]; sessionId: string; deviceId: string };
}

export function createUserController(userService: UserService) {
  return {
    async create(request: FastifyRequest, reply: FastifyReply) {
      const data = parseOrThrow(userCreateSchema, request.body);
      const user = await userService.createUser(data);
      return reply.status(201).send(user);
    },

    async getById(request: AuthenticatedRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(userParamsSchema, request.params);
      if (request.user && request.user.sub !== id) {
        // Permission check would go here via auth middleware
      }
      const user = await userService.getUserById(id);
      return reply.send(user);
    },

    async update(request: AuthenticatedRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(userParamsSchema, request.params);
      const data = parseOrThrow(userUpdateSchema, request.body);
      const user = await userService.updateUser(id, data);
      return reply.send(user);
    },

    async delete(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(userParamsSchema, request.params);
      await userService.deleteUser(id);
      return reply.status(204).send();
    },

    async list(request: FastifyRequest, reply: FastifyReply) {
      const query = parseOrThrow(listUsersQuerySchema, request.query);
      const result = await userService.listUsers({
        role: query.role as Role | undefined,
        active: query.active,
        page: query.page,
        pageSize: query.pageSize,
      });
      return reply.send(result);
    },

    async permissions(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(userParamsSchema, request.params);
      const perms = await userService.getUserPermissions(id);
      return reply.send({ permissions: perms });
    },

    async checkPermission(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(userParamsSchema, request.params);
      const { permission } = parseOrThrow(checkPermissionSchema, request.body);
      const allowed = await userService.checkPermission(id, permission as Permission);
      return reply.send({ allowed });
    },
  };
}
