import { AppError } from '@localwala/errors';
import type { AuthRepository, UserRepository } from './auth.repository.js';
import { createTokenPair, verifyRefreshToken, decodeWithoutVerify } from './jwt.utils.js';
import { hashToken, verifyTokenHash } from './token.utils.js';
import {
  newSessionId,
  newRefreshTokenId,
  SESSION_TTL_SECONDS,
  type Session,
  type JwtPayload,
  type TokenPair,
} from './auth.types.js';

export class AuthService {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async login(
    phone: string,
    deviceId: string,
    deviceName?: string,
  ): Promise<{
    user: { id: string; phone: string; roles: string[] };
    tokens: TokenPair;
  }> {
    let user = await this.userRepo.findByPhone(phone);
    if (!user) {
      user = await this.userRepo.createUser(phone, ['customer']);
    }

    const sessionId = newSessionId();
    const refreshTokenId = newRefreshTokenId();
    const now = Date.now();
    const session: Session = {
      id: sessionId,
      userId: user.id,
      deviceId,
      deviceName,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: now + SESSION_TTL_SECONDS * 1000,
      revoked: false,
      refreshTokenHash: hashToken(refreshTokenId),
    };

    await this.authRepo.createSession(session);

    const tokens = await createTokenPair(user.id, sessionId, deviceId, user.roles);
    return { user: { id: user.id, phone, roles: user.roles }, tokens };
  }

  async refresh(refreshToken: string, deviceId?: string): Promise<TokenPair> {
    const payload = await verifyRefreshToken(refreshToken);
    const session = await this.authRepo.findSessionById(payload.sessionId);
    if (!session || session.revoked || session.expiresAt < Date.now()) {
      throw new AppError('TOKEN_EXPIRED', { message: 'Session expired or revoked' });
    }
    if (deviceId && session.deviceId !== deviceId) {
      throw new AppError('FORBIDDEN', { message: 'Device mismatch' });
    }
    const valid = await verifyTokenHash(payload.jti, session.refreshTokenHash);
    if (!valid) {
      throw new AppError('UNAUTHENTICATED', { message: 'Invalid refresh token' });
    }

    const nextSessionId = newSessionId();
    const nextRefreshTokenId = newRefreshTokenId();
    const now = Date.now();

    await this.authRepo.revokeSession(session.id);

    const newSession: Session = {
      id: nextSessionId,
      userId: session.userId,
      deviceId: session.deviceId,
      deviceName: session.deviceName,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: now + SESSION_TTL_SECONDS * 1000,
      revoked: false,
      refreshTokenHash: hashToken(nextRefreshTokenId),
    };
    await this.authRepo.createSession(newSession);

    return createTokenPair(session.userId, nextSessionId, session.deviceId, payload.roles);
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    const session = await this.authRepo.findSessionById(sessionId);
    if (!session || session.userId !== userId) {
      throw new AppError('NOT_FOUND', { message: 'Session not found' });
    }
    await this.authRepo.revokeSession(sessionId);
  }

  async logoutAll(userId: string, exceptSessionId?: string): Promise<number> {
    return this.authRepo.revokeAllUserSessions(userId, exceptSessionId);
  }

  async getSessions(userId: string): Promise<Session[]> {
    return this.authRepo.findSessionsByUserId(userId);
  }

  async validateAccessToken(token: string): Promise<JwtPayload> {
    const payload = await decodeWithoutVerify(token);
    if (!payload || payload.type !== 'access') {
      throw new AppError('UNAUTHENTICATED', { message: 'Invalid access token' });
    }
    const session = await this.authRepo.findSessionById(payload.sessionId);
    if (!session || session.revoked || session.expiresAt < Date.now()) {
      throw new AppError('TOKEN_EXPIRED', { message: 'Session expired or revoked' });
    }
    return payload as JwtPayload;
  }
}
