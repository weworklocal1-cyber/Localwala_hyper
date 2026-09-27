import { AppError } from '@localwala/errors';
import { z } from 'zod';
import {
  CYCLE_STATES,
  MAX_AMOUNT_PAISE,
  MAX_COMMISSION_BP,
  ORDER_ID_PATTERN,
  RULE_SCOPES,
  RULE_STATUSES,
  USER_ID_PATTERN,
} from '../settlement/settlement.types.js';

const partnerId = z
  .string()
  .min(1)
  .max(64)
  .regex(new RegExp(USER_ID_PATTERN), 'must match [A-Za-z0-9._-]{1,64}');

const amount = z.number().int().min(0).max(MAX_AMOUNT_PAISE);

const createRuleSchema = z
  .object({
    scope: z.enum(RULE_SCOPES),
    partnerId: partnerId.optional(),
    commissionBp: z.number().int().min(0).max(MAX_COMMISSION_BP),
    fixedFeePaise: amount.optional(),
  })
  .refine((value) => value.scope !== 'partner' || value.partnerId !== undefined, {
    message: 'partnerId is required when scope is partner',
  })
  .refine((value) => value.scope !== 'global' || value.partnerId === undefined, {
    message: 'partnerId must be omitted when scope is global',
  });

const listRulesSchema = z.object({
  scope: z.enum(RULE_SCOPES).optional(),
  partnerId: partnerId.optional(),
  status: z.enum(RULE_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const createEarningSchema = z.object({
  orderId: z.string().regex(new RegExp(ORDER_ID_PATTERN), 'must match ord_<32 hex chars>'),
  partnerId,
  grossPaise: z.number().int().min(1).max(MAX_AMOUNT_PAISE),
  deliveryContributionPaise: amount.optional(),
  taxPaise: amount.optional(),
  adjustmentPaise: amount.optional(),
  reason: z.string().min(1).max(200).optional(),
});

const listEarningsSchema = z.object({
  partnerId: partnerId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createCycleSchema = z.object({ partnerId });

const listCyclesSchema = z.object({
  partnerId: partnerId.optional(),
  state: z.enum(CYCLE_STATES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const failSchema = z.object({
  reason: z.string().min(1).max(200),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type ListRulesInput = z.infer<typeof listRulesSchema>;
export type CreateEarningInput = z.infer<typeof createEarningSchema>;
export type CreateCycleInput = z.infer<typeof createCycleSchema>;

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

export function parseCreateRule(input: unknown): CreateRuleInput {
  return parse(createRuleSchema, input);
}

export function parseListRules(input: unknown): ListRulesInput {
  return parse(listRulesSchema, input);
}

export function parseCreateEarning(input: unknown): CreateEarningInput {
  return parse(createEarningSchema, input);
}

export function parseListEarnings(input: unknown): z.infer<typeof listEarningsSchema> {
  return parse(listEarningsSchema, input);
}

export function parseCreateCycle(input: unknown): CreateCycleInput {
  return parse(createCycleSchema, input);
}

export function parseListCycles(input: unknown): z.infer<typeof listCyclesSchema> {
  return parse(listCyclesSchema, input);
}

export function parseFail(input: unknown): z.infer<typeof failSchema> {
  return parse(failSchema, input);
}
