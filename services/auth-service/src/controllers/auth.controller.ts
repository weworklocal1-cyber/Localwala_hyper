import type { FastifyReply, FastifyRequest } from 'fastify';
import { parseOrThrow } from '@localwala/validation';
import {
  loginRequestSchema,
  refreshRequestSchema,
  revokeSessionSchema,
} from '../schemas/auth.schema.js';
import { AuthService } from '../auth/auth.service.js';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    sub: string;
    sessionId: string;
    deviceId: string;
    roles: string[];
  };
}

export function createAuthController(authService: AuthService) {
  return {
    async login(request: FastifyRequest, reply: FastifyReply) {
      const { phone, code: _code, device } = parseOrThrow(loginRequestSchema, request.body);
      const result = await authService.login(phone, device.deviceId, device.deviceName);
      return reply.status(200).send(result);
    },

    async refresh(request: FastifyRequest, reply: FastifyReply) {
      const { refreshToken, device } = parseOrThrow(refreshRequestSchema, request.body);
      const tokens = await authService.refresh(refreshToken, device?.deviceId);
      return reply.status(200).send({ ...tokens, tokenType: 'Bearer' });
    },

    async logout(request: AuthenticatedRequest, reply: FastifyReply) {
      const { sessionId } = parseOrThrow(revokeSessionSchema, request.body);
      const userId = request.user?.sub ?? '';
      await authService.logout(sessionId, userId);
      return reply.status(204).send();
    },

    async logoutAll(request: AuthenticatedRequest, reply: FastifyReply) {
      const userId = request.user?.sub ?? '';
      const count = await authService.logoutAll(userId, request.user?.sessionId);
      return reply.send({ revoked: count });
    },

    async sessions(request: AuthenticatedRequest, reply: FastifyReply) {
      const userId = request.user?.sub ?? '';
      const sessions = await authService.getSessions(userId);
      return reply.send({
        sessions: sessions.map(
          (s: {
            id: string;
            deviceId: string;
            deviceName?: string;
            createdAt: number;
            lastAccessedAt: number;
            expiresAt: number;
          }) => ({
            id: s.id,
            deviceId: s.deviceId,
            deviceName: s.deviceName,
            createdAt: s.createdAt,
            lastAccessedAt: s.lastAccessedAt,
            expiresAt: s.expiresAt,
            current: s.id === request.user?.sessionId,
          }),
        ),
      });
    },
  };
}
