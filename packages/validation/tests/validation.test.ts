import { describe, expect, it } from 'vitest';
import { AppError } from '@localwala/errors';
import {
  coordinateSchema,
  e164PhoneSchema,
  idempotencyKeySchema,
  paginationQuerySchema,
  parseOrThrow,
} from '../src/index.js';

describe('validation', () => {
  it('accepts E.164 phone numbers only', () => {
    expect(e164PhoneSchema.safeParse('+919876543210').success).toBe(true);
    expect(e164PhoneSchema.safeParse('9876543210').success).toBe(false);
    expect(e164PhoneSchema.safeParse('+91 98765 43210').success).toBe(false);
  });

  it('applies pagination defaults', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationQuerySchema.parse({ page: '3' }).page).toBe(3);
    expect(paginationQuerySchema.safeParse({ pageSize: 500 }).success).toBe(false);
  });

  it('validates coordinates', () => {
    expect(coordinateSchema.safeParse({ lat: 17.385, lng: 78.4867 }).success).toBe(true);
    expect(coordinateSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(false);
  });

  it('throws AppError with field details through parseOrThrow', () => {
    try {
      parseOrThrow(paginationQuerySchema, { page: -1 });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('VALIDATION_ERROR');
      expect((error as AppError).details).toBeDefined();
    }
  });

  it('validates idempotency keys', () => {
    expect(idempotencyKeySchema.safeParse('order.create.abc123').success).toBe(true);
    expect(idempotencyKeySchema.safeParse('short').success).toBe(false);
    expect(idempotencyKeySchema.safeParse('bad key with spaces').success).toBe(false);
  });
});
