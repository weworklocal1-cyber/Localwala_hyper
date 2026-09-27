import { beforeEach, describe, expect, it } from 'vitest';
import {
  createTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../src/auth/jwt.utils.js';
import { StagingAuthRepository, StagingUserRepository } from '../../src/auth/auth.repository.js';
import { AuthService } from '../../src/auth/auth.service.js';

describe('Auth JWT utils', () => {
  it('creates and verifies access token', async () => {
    const token = await createTokenPair('user-1', 'sess-1', 'device-1', ['customer']);
    expect(token.accessToken).toBeDefined();
    expect(token.refreshToken).toBeDefined();
    expect(token.expiresIn).toBe(900);

    const payload = await verifyAccessToken(token.accessToken);
    expect(payload.sub).toBe('user-1');
    expect(payload.sessionId).toBe('sess-1');
    expect(payload.roles).toEqual(['customer']);
  });

  it('rejects invalid access token', async () => {
    await expect(verifyAccessToken('invalid.token.here')).rejects.toThrow();
  });

  it('verifies refresh token with jti', async () => {
    const { refreshToken } = await createTokenPair('user-1', 'sess-1', 'device-1', ['customer']);
    const payload = await verifyRefreshToken(refreshToken);
    expect(payload.sub).toBe('user-1');
    expect(payload.jti).toBeDefined();
  });
});

describe('AuthService', () => {
  let authRepo: StagingAuthRepository;
  let userRepo: StagingUserRepository;
  let authService: AuthService;

  beforeEach(() => {
    authRepo = new StagingAuthRepository();
    userRepo = new StagingUserRepository();
    authService = new AuthService(authRepo, userRepo);
  });

  it('throws BLOCKED on login (staging user repo hit first)', async () => {
    await expect(authService.login('+919876543210', 'device-1')).rejects.toThrow(
      'User repository not configured',
    );
  });

  it('throws on refresh with invalid token (JWT verification fails first)', async () => {
    await expect(authService.refresh('fake-refresh-token')).rejects.toThrow();
  });

  it('throws BLOCKED on logout (staging repo)', async () => {
    await expect(authService.logout('sess-1', 'user-1')).rejects.toThrow(
      'Auth repository not configured',
    );
  });
});
