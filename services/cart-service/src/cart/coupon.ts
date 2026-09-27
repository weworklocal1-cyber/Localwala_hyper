import { AppError } from '@localwala/errors';

export interface CouponQuote {
  code: string;
  type: 'flat' | 'percent';
  value: number;
}

export interface CouponValidator {
  validate(code: string, itemsTotal: number): Promise<CouponQuote>;
}

/**
 * STAGING ONLY — promotion-service coupon validation not wired yet.
 * Throws SERVICE_UNAVAILABLE (503): coupons are never trusted without validation.
 */
export class StagingCouponValidator implements CouponValidator {
  async validate(): Promise<CouponQuote> {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: 'Coupon validator not configured — promotion-service integration pending.',
      retryable: false,
    });
  }
}
