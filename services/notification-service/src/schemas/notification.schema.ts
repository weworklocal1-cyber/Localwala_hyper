import { AppError } from '@localwala/errors';
import { z } from 'zod';
import {
  CHANNELS,
  DEEP_LINK_PATTERN,
  LOCALE_PATTERN,
  TEMPLATE_KEY_PATTERN,
  USER_ID_PATTERN,
} from '../notification/notification.types.js';

const userId = z
  .string()
  .min(1)
  .max(64)
  .regex(new RegExp(USER_ID_PATTERN), 'must match [A-Za-z0-9._-]{1,64}');

const locale = z.string().regex(new RegExp(LOCALE_PATTERN), 'must match [a-z] or [a-z]-[A-Z]');

const deepLink = z
  .string()
  .min(1)
  .max(300)
  .regex(new RegExp(DEEP_LINK_PATTERN), 'must be a path or http(s) URL');

const createTemplateSchema = z.object({
  key: z.string().regex(new RegExp(TEMPLATE_KEY_PATTERN), 'must match [a-z0-9][a-z0-9_-]{1,63}'),
  channel: z.enum(CHANNELS),
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(1000),
  locale: locale.optional(),
});

const updateTemplateSchema = z
  .object({
    title: z.string().min(1).max(200).nullable().optional(),
    body: z.string().min(1).max(1000).optional(),
    locale: locale.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one field is required',
  });

const listTemplatesSchema = z.object({
  channel: z.enum(CHANNELS).optional(),
  key: z
    .string()
    .regex(new RegExp(TEMPLATE_KEY_PATTERN), 'must match [a-z0-9][a-z0-9_-]{1,63}')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const setPreferenceSchema = z.object({
  userId,
  channel: z.enum(CHANNELS),
  enabled: z.boolean(),
});

const sendSchema = z.object({
  userId,
  channel: z.enum(CHANNELS),
  templateKey: z
    .string()
    .regex(new RegExp(TEMPLATE_KEY_PATTERN), 'must match [a-z0-9][a-z0-9_-]{1,63}'),
  variables: z
    .record(z.string().min(1).max(64), z.union([z.string().max(500), z.number()]))
    .optional(),
  deepLink: deepLink.optional(),
});

const createInAppSchema = z.object({
  userId,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000).optional(),
  deepLink: deepLink.optional(),
});

const listInAppSchema = z.object({
  userId,
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type SendInput = z.infer<typeof sendSchema>;
export type CreateInAppInput = z.infer<typeof createInAppSchema>;
export type ListInAppInput = z.infer<typeof listInAppSchema>;

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

export function parseCreateTemplate(input: unknown): CreateTemplateInput {
  return parse(createTemplateSchema, input);
}

export function parseUpdateTemplate(input: unknown): UpdateTemplateInput {
  return parse(updateTemplateSchema, input);
}

export function parseListTemplates(input: unknown): z.infer<typeof listTemplatesSchema> {
  return parse(listTemplatesSchema, input);
}

export function parseSetPreference(input: unknown): z.infer<typeof setPreferenceSchema> {
  return parse(setPreferenceSchema, input);
}

export function parseSend(input: unknown): SendInput {
  return parse(sendSchema, input);
}

export function parseCreateInApp(input: unknown): CreateInAppInput {
  return parse(createInAppSchema, input);
}

export function parseListInApp(input: unknown): ListInAppInput {
  return parse(listInAppSchema, input);
}
