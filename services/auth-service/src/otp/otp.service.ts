import { AppError } from '@localwala/errors';
import { generateOtpCode, hashOtp, verifyOtpHash } from './otp.utils.js';
import type {
  OtpProvider,
  OtpProviderConfig,
  OtpRepository,
  RateLimiter,
} from './otp.repository.js';

export class OtpService {
  constructor(
    private readonly provider: OtpProvider,
    private readonly repository: OtpRepository,
    private readonly rateLimiter: RateLimiter,
    private readonly config: Required<OtpProviderConfig>,
  ) {}

  async request(phone: string): Promise<void> {
    const rl = await this.rateLimiter.check(
      `otp:req:${phone}`,
      this.config.rateLimitMaxRequests,
      this.config.rateLimitWindowSeconds,
    );
    if (!rl.allowed) {
      throw new AppError('RATE_LIMITED', {
        message: 'Too many OTP requests. Try again later.',
        details: { resetAt: new Date(rl.resetAt).toISOString() },
      });
    }

    const code = generateOtpCode(this.config.codeLength);
    const codeHash = await hashOtp(code);
    const now = Date.now();
    const expiresAt = now + this.config.ttlSeconds * 1000;

    await this.repository.save({
      phone,
      codeHash,
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      createdAt: now,
      expiresAt,
    });

    await this.provider.send(phone, code);
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const record = await this.repository.findByPhone(phone);
    if (!record) {
      throw new AppError('NOT_FOUND', { message: 'No OTP found for this phone' });
    }
    if (record.attempts >= record.maxAttempts) {
      await this.repository.delete(phone);
      throw new AppError('RATE_LIMITED', { message: 'Maximum verification attempts exceeded' });
    }
    if (record.expiresAt < Date.now()) {
      await this.repository.delete(phone);
      throw new AppError('TOKEN_EXPIRED', { message: 'OTP has expired' });
    }

    const valid = await verifyOtpHash(code, record.codeHash);
    if (!valid) {
      const attempts = await this.repository.incrementAttempts(phone);
      throw new AppError('VALIDATION_ERROR', {
        message: 'Invalid OTP',
        details: { attemptsRemaining: record.maxAttempts - attempts },
      });
    }

    await this.repository.delete(phone);
    return true;
  }

  async resend(phone: string): Promise<void> {
    const record = await this.repository.findByPhone(phone);
    if (!record) {
      throw new AppError('NOT_FOUND', { message: 'No OTP to resend' });
    }
    await this.request(phone);
  }
}
