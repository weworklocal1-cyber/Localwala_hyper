import { AppError } from '@localwala/errors';
import { z } from 'zod';
import {
  IDEMPOTENCY_KEY_PATTERN,
  ORDER_STATUSES,
  USER_ID_PATTERN,
  VERTICAL_PATTERN,
} from '../order/order.types.js';

const userId = z
  .string()
  .min(1)
  .max(64)
  .regex(new RegExp(USER_ID_PATTERN), 'must match [A-Za-z0-9._-]{1,64}');

const vertical = z
  .string()
  .min(1)
  .max(32)
  .regex(new RegExp(VERTICAL_PATTERN), 'must match [a-z0-9][a-z0-9-]{0,31}');

const orderId = z.string().regex(/^ord_[0-9a-f]{32}$/, 'must match ord_<32 hex chars>');

const createOrderSchema = z.object({
  userId,
  vertical,
  addressId: z.string().min(1).max(64),
});

const transitionSchema = z.object({
  to: z.enum(ORDER_STATUSES),
  reason: z.string().min(1).max(200).optional(),
  actor: z.string().min(1).max(64).optional(),
});

const listOrdersSchema = z.object({
  userId: userId.optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const idempotencyKeySchema = z
  .string()
  .regex(new RegExp(IDEMPOTENCY_KEY_PATTERN), 'must match [A-Za-z0-9_.:-]{8,128}');

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', {
      message: 'Request payload failed validation',
      details: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

export function parseCreateOrder(input: unknown): CreateOrderInput {
  return parse(createOrderSchema, input);
}

export function parseTransition(input: unknown): TransitionInput {
  return parse(transitionSchema, input);
}

export function parseListOrders(input: unknown): ListOrdersInput {
  return parse(listOrdersSchema, input);
}

export function parseOrderId(orderIdValue: string): string {
  return parse(orderId, orderIdValue);
}

export function parseIdempotencyKey(raw: string | undefined): string {
  if (raw === undefined) {
    throw new AppError('VALIDATION_ERROR', {
      message: 'Request payload failed validation',
      details: [{ path: 'idempotency-key', message: 'idempotency key header is required' }],
    });
  }
  return parse(idempotencyKeySchema, raw);
}
