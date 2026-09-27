import { SignJWT, jwtVerify } from 'jose';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  type JwtPayload,
} from './auth.types.js';
import { generateSecureToken } from './token.utils.js';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
);

export async function createAccessToken(
  payload: Omit<JwtPayload, 'type' | 'iat' | 'exp'>,
): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(JWT_SECRET);
}

export async function createRefreshToken(
  payload: Omit<JwtPayload, 'type' | 'iat' | 'exp'>,
): Promise<string> {
  const token = generateSecureToken('rt');
  return new SignJWT({ ...payload, type: 'refresh', jti: token })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(JWT_SECRET);
}

export async function createTokenPair(
  userId: string,
  sessionId: string,
  deviceId: string,
  roles: string[],
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}> {
  const base = { sub: userId, sessionId, deviceId, roles };
  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(base),
    createRefreshToken(base),
  ]);
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS, tokenType: 'Bearer' };
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  if (payload.type !== 'access') throw new Error('Invalid token type');
  return payload as unknown as JwtPayload;
}

export async function verifyRefreshToken(token: string): Promise<JwtPayload & { jti: string }> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  if (payload.type !== 'refresh') throw new Error('Invalid token type');
  return payload as unknown as JwtPayload & { jti: string };
}

export async function decodeWithoutVerify(token: string): Promise<JwtPayload | null> {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const json = Buffer.from(payloadB64, 'base64url').toString();
    return JSON.parse(json);
  } catch {
    return null;
  }
}
