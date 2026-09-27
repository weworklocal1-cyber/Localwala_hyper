import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface Session {
  id: string;
  userId: string;
  deviceId: string;
  deviceName?: string;
  ip?: string;
  userAgent?: string;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
  revoked: boolean;
  refreshTokenHash: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface JwtPayload {
  sub: string; // userId
  sessionId: string;
  deviceId: string;
  roles: string[];
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

export const deviceInfoSchema = z.object({
  deviceId: z.string().min(1).max(128),
  deviceName: z.string().max(128).optional(),
});

export const loginRequestSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  code: z.string().regex(/^\d{4,8}$/),
  device: deviceInfoSchema,
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(32),
  device: deviceInfoSchema.optional(),
});

export const revokeSessionSchema = z.object({
  sessionId: z.string().min(1),
});

export function newSessionId(): string {
  return `sess_${randomUUID().replace(/-/g, '')}`;
}

export function newAccessTokenId(): string {
  return `at_${randomUUID().replace(/-/g, '')}`;
}

export function newRefreshTokenId(): string {
  return `rt_${randomUUID().replace(/-/g, '')}`;
}
