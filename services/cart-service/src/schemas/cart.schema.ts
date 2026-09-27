import { AppError } from '@localwala/errors';
import { z } from 'zod';
import { MAX_ITEM_QTY, USER_ID_PATTERN, VERTICAL_PATTERN } from '../cart/cart.types.js';

const userIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(new RegExp(USER_ID_PATTERN), 'must match [A-Za-z0-9._-]{1,64}');

const verticalSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(new RegExp(VERTICAL_PATTERN), 'must match [a-z0-9][a-z0-9-]{0,31}');

const modifiers = z
  .array(
    z.object({
      groupId: z.string().min(1).max(64),
      optionIds: z.array(z.string().min(1).max(64)).min(1),
    }),
  )
  .max(20);

const createCartSchema = z.object({
  userId: userIdSchema,
  vertical: verticalSchema,
});

const addItemSchema = z.object({
  productId: z.string().min(1).max(64),
  variantId: z.string().min(1).max(64),
  qty: z.number().int().min(1).max(MAX_ITEM_QTY),
  modifiers: modifiers.optional().default([]),
  instructions: z.string().max(500).optional(),
  storeId: z.string().min(1).max(64).optional(),
});

const patchItemSchema = z
  .object({
    qty: z.number().int().min(1).max(MAX_ITEM_QTY).optional(),
    instructions: z.string().max(500).optional().nullable(),
  })
  .refine((value) => value.qty !== undefined || value.instructions !== undefined, {
    message: 'at least one of qty or instructions is required',
  });

const patchCartSchema = z.object({
  addressId: z.string().min(1).max(64).nullable(),
});

const applyCouponSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, 'must match [A-Za-z0-9_-]{3,32}'),
});

export type CreateCartInput = z.infer<typeof createCartSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
export type PatchItemInput = z.infer<typeof patchItemSchema>;
export type PatchCartInput = z.infer<typeof patchCartSchema>;
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;

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

export function parseCreateCart(input: unknown): CreateCartInput {
  return parse(createCartSchema, input);
}

export function parseAddItem(input: unknown): AddItemInput {
  return parse(addItemSchema, input);
}

export function parsePatchItem(input: unknown): PatchItemInput {
  return parse(patchItemSchema, input);
}

export function parsePatchCart(input: unknown): PatchCartInput {
  return parse(patchCartSchema, input);
}

export function parseApplyCoupon(input: unknown): ApplyCouponInput {
  return parse(applyCouponSchema, input);
}

export function parseCartRef(
  userId: string,
  vertical: string,
): { userId: string; vertical: string } {
  return parse(z.object({ userId: userIdSchema, vertical: verticalSchema }), { userId, vertical });
}
