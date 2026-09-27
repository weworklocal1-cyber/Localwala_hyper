import type { Session } from './auth.types.js';
import { AppError } from '@localwala/errors';

export interface AuthRepository {
  createSession(session: Session): Promise<void>;
  findSessionById(id: string): Promise<Session | null>;
  findSessionsByUserId(userId: string): Promise<Session[]>;
  updateSessionAccess(id: string): Promise<void>;
  revokeSession(id: string): Promise<void>;
  revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number>;
  deleteExpiredSessions(): Promise<number>;
}

export interface UserRepository {
  findByPhone(phone: string): Promise<{ id: string; roles: string[] } | null>;
  createUser(phone: string, roles: string[]): Promise<{ id: string; roles: string[] }>;
}

/**
 * STAGING ONLY — Replace with Redis/Postgres implementations.
 * Throws SERVICE_UNAVAILABLE on every operation.
 */
export class StagingAuthRepository implements AuthRepository {
  async createSession(): Promise<void> {
    this.blocked('createSession');
  }
  async findSessionById(): Promise<null> {
    this.blocked('findSessionById');
    return null;
  }
  async findSessionsByUserId(): Promise<never[]> {
    this.blocked('findSessionsByUserId');
    return [];
  }
  async updateSessionAccess(): Promise<void> {
    this.blocked('updateSessionAccess');
  }
  async revokeSession(): Promise<void> {
    this.blocked('revokeSession');
  }
  async revokeAllUserSessions(): Promise<number> {
    this.blocked('revokeAllUserSessions');
    return 0;
  }
  async deleteExpiredSessions(): Promise<number> {
    this.blocked('deleteExpiredSessions');
    return 0;
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Auth repository not configured: ${op} blocked — database not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}

export class StagingUserRepository implements UserRepository {
  async findByPhone(): Promise<null> {
    this.blocked('findByPhone');
    return null;
  }
  async createUser(): Promise<never> {
    this.blocked('createUser');
    throw new Error('unreachable');
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `User repository not configured: ${op} blocked — database not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
