import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

export function hashToken(token: string): string {
  return createHmac('sha256', process.env.JWT_SECRET ?? 'dev-secret-change-in-production')
    .update(token)
    .digest('hex');
}

export async function verifyTokenHash(token: string, hash: string): Promise<boolean> {
  const computed = hashToken(token);
  const a = Buffer.from(computed);
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function generateSecureToken(prefix: string, length = 32): string {
  const bytes = randomBytes(length);
  return `${prefix}_${bytes.toString('base64url')}`;
}
