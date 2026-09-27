import { AppError } from '@localwala/errors';
import { z } from 'zod';
import { MAX_AMOUNT_PAISE, USER_ID_PATTERN, WITHDRAWAL_STATES } from '../wallet/wallet.types.js';

const userId = z
  .string()
  .min(1)
  .max(64)
  .regex(new RegExp(USER_ID_PATTERN), 'must match [A-Za-z0-9._-]{1,64}');

const amount = z
  .number()
  .int()
  .min(1)
  .max(MAX_AMOUNT_PAISE, 'amount exceeds the maximum allowed value');

const reason = z.string().min(1).max(200);
const optionalReason = z.string().min(1).max(200).optional();

const createWalletSchema = z.object({
  userId,
  creditAmount: amount.optional(),
});

const moneyMoveSchema = z.object({
  amount,
  reason: optionalReason,
  referenceId: z.string().min(1).max(64).optional(),
});

const releaseSchema = z.object({
  reason: optionalReason,
});

const createWithdrawalSchema = z.object({
  amount,
});

const rejectSchema = z.object({
  reason,
});

const listEntriesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const listWithdrawalsSchema = z.object({
  state: z.enum(WITHDRAWAL_STATES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateWalletInput = z.infer<typeof createWalletSchema>;
export type MoneyMoveInput = z.infer<typeof moneyMoveSchema>;
export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;
export type RejectInput = z.infer<typeof rejectSchema>;
export type ListEntriesInput = z.infer<typeof listEntriesSchema>;
export type ListWithdrawalsInput = z.infer<typeof listWithdrawalsSchema>;

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

export function parseCreateWallet(input: unknown): CreateWalletInput {
  return parse(createWalletSchema, input);
}

export function parseMoneyMove(input: unknown): MoneyMoveInput {
  return parse(moneyMoveSchema, input);
}

export function parseRelease(input: unknown): z.infer<typeof releaseSchema> {
  return parse(releaseSchema, input);
}

export function parseCreateWithdrawal(input: unknown): CreateWithdrawalInput {
  return parse(createWithdrawalSchema, input);
}

export function parseReject(input: unknown): RejectInput {
  return parse(rejectSchema, input);
}

export function parseListEntries(input: unknown): ListEntriesInput {
  return parse(listEntriesSchema, input);
}

export function parseListWithdrawals(input: unknown): ListWithdrawalsInput {
  return parse(listWithdrawalsSchema, input);
}

export function parseUserId(userIdValue: string): string {
  return parse(userId, userIdValue);
}
