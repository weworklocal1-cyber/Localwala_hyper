import { beforeEach, describe, expect, it } from 'vitest';
import { generateOtpCode, hashOtp, verifyOtpHash } from '../../src/otp/otp.utils.js';
import { StagingOtpProvider } from '../../src/otp/staging-otp-provider.js';
import {
  StagingOtpRepository,
  StagingRateLimiter,
  createOtpConfig,
} from '../../src/otp/otp.repository.js';
import { OtpService } from '../../src/otp/otp.service.js';

describe('OTP utils', () => {
  it('generates a numeric code of requested length', () => {
    const code = generateOtpCode(6);
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^\d+$/);
  });

  it('hashes and verifies OTP codes', async () => {
    const code = '123456';
    const hash = await hashOtp(code);
    expect(await verifyOtpHash(code, hash)).toBe(true);
    expect(await verifyOtpHash('654321', hash)).toBe(false);
  });
});

describe('OtpService', () => {
  let provider: StagingOtpProvider;
  let repository: StagingOtpRepository;
  let rateLimiter: StagingRateLimiter;
  let service: OtpService;

  beforeEach(() => {
    provider = new StagingOtpProvider();
    repository = new StagingOtpRepository();
    rateLimiter = new StagingRateLimiter();
    service = new OtpService(provider, repository, rateLimiter, createOtpConfig());
  });

  it('throws BLOCKED from staging provider on request', async () => {
    await expect(service.request('+919876543210')).rejects.toThrow('Rate limiter not configured');
  });

  it('throws BLOCKED from staging repository on verify', async () => {
    await expect(service.verify('+919876543210', '123456')).rejects.toThrow(
      'OTP repository not configured',
    );
  });

  it('throws BLOCKED from staging rate limiter on request', async () => {
    await expect(service.request('+919876543210')).rejects.toThrow('Rate limiter not configured');
  });
});
