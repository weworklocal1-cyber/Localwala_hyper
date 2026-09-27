import { OtpProvider } from './otp-provider.interface.js';
import { AppError } from '@localwala/errors';

/**
 * STAGING ONLY — does not send real SMS.
 * Replace with a real provider (Twilio, Vonage, Plivo, etc.) before production.
 * This adapter is intentionally NOT a mock that pretends to work;
 * it throws BLOCKED so the integration boundary is explicit.
 */
export class StagingOtpProvider implements OtpProvider {
  readonly name = 'staging';

  async send(phoneE164: string, code: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[STAGING OTP] ${phoneE164} -> ${code}`);
    throw new AppError('SERVICE_UNAVAILABLE', {
      message:
        'OTP provider not configured: StagingOtpProvider is blocked — configure a real SMS provider (Twilio, Vonage, etc.)',
      details: { provider: 'staging', phone: phoneE164 },
      retryable: false,
    });
  }
}
