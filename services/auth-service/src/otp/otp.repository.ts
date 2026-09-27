import { OtpProvider, type OtpProviderConfig } from './otp-provider.interface.js';

export { OtpProvider, type OtpProviderConfig };

export interface OtpRecord {
  phone: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  expiresAt: number;
}

export interface OtpRepository {
  save(record: OtpRecord): Promise<void>;
  findByPhone(phone: string): Promise<OtpRecord | null>;
  delete(phone: string): Promise<void>;
  incrementAttempts(phone: string): Promise<number>;
}

export interface RateLimitRecord {
  key: string;
  count: number;
  windowStart: number;
}

export interface RateLimiter {
  check(
    key: string,
    max: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}

import { AppError } from '@localwala/errors';

/**
 * STAGING ONLY — Redis not available. Replace with RedisOtpRepository/RedisRateLimiter.
 * Throws SERVICE_UNAVAILABLE (503) on every operation.
 */
export class StagingOtpRepository implements OtpRepository {
  async save(): Promise<void> {
    this.blocked('save');
  }
  async findByPhone(): Promise<null> {
    this.blocked('findByPhone');
    return null;
  }
  async delete(): Promise<void> {
    this.blocked('delete');
  }
  async incrementAttempts(): Promise<number> {
    this.blocked('incrementAttempts');
    return 0;
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `OTP repository not configured: ${op} blocked — Redis not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}

export class StagingRateLimiter implements RateLimiter {
  async check(): Promise<{ allowed: false; remaining: 0; resetAt: number }> {
    this.blocked('check');
    return { allowed: false, remaining: 0, resetAt: Date.now() + 60_000 };
  }
  async reset(): Promise<void> {
    this.blocked('reset');
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Rate limiter not configured: ${op} blocked — Redis not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}

export function createOtpConfig(
  overrides: Partial<OtpProviderConfig> = {},
): Required<OtpProviderConfig> {
  return {
    provider: { name: 'staging', send: async () => {} } as OtpProvider, // replaced at runtime
    codeLength: 6,
    ttlSeconds: 300,
    maxAttempts: 3,
    rateLimitWindowSeconds: 60,
    rateLimitMaxRequests: 3,
    ...overrides,
  };
}
