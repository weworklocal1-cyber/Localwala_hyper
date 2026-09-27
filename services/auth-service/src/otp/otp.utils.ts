import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const otpCodeSchema = z.string().regex(/^\d{4,8}$/);

export const otpRequestSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164, e.g. +919876543210'),
});

export const otpVerifySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  code: otpCodeSchema,
});

export function generateOtpCode(length = 6): string {
  const bytes = randomBytes(length);
  return bytes.reduce((acc, b) => acc + (b % 10).toString(), '').slice(0, length);
}

export function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export async function verifyOtpHash(code: string, hash: string): Promise<boolean> {
  const computed = hashOtp(code);
  return computed === hash;
}
