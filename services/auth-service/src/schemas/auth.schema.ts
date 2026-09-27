import { z } from 'zod';

export const loginRequestSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  code: z.string().regex(/^\d{4,8}$/),
  device: z.object({
    deviceId: z.string().min(1).max(128),
    deviceName: z.string().max(128).optional(),
  }),
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(32),
  device: z
    .object({
      deviceId: z.string().min(1).max(128),
      deviceName: z.string().max(128).optional(),
    })
    .optional(),
});

export const revokeSessionSchema = z.object({
  sessionId: z.string().min(1),
});
