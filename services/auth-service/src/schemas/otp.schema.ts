import { z } from 'zod';

export const otpRequestSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164, e.g. +919876543210'),
});

export const otpVerifySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  code: z.string().regex(/^\d{4,8}$/),
});

export const otpResendSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
});
