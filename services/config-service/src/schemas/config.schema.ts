import { AppError } from '@localwala/errors';
import { z } from 'zod';
import { CONFIG_TYPES, type ConfigType } from '../configs/config.types.js';

const uniqueStrings = (values: string[]): boolean => new Set(values).size === values.length;

const featureFlagsSchema = z.object({
  flags: z.record(z.string().min(1), z.boolean()),
});

const semver = z.string().regex(/^\d+\.\d+(\.\d+)?$/, 'must be a semver like 1.2.3');

const appVersionSchema = z.object({
  minSupportedVersion: semver,
  latestVersion: semver.optional(),
  forceUpdate: z.boolean(),
  storeUrls: z
    .object({
      android: z.string().url().optional(),
      ios: z.string().url().optional(),
    })
    .optional(),
});

const maintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(500).optional(),
  allowedRoutes: z.array(z.string().min(1)).optional(),
});

const verticalsSchema = z.object({
  verticals: z.record(z.string().min(1), z.boolean()),
});

const homeSectionsSchema = z.object({
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        component: z.string().min(1),
        order: z.number().int().min(0),
        visible: z.boolean(),
      }),
    )
    .refine((sections) => uniqueStrings(sections.map((section) => section.id)), {
      message: 'section ids must be unique',
    }),
});

const bannerSchema = z.object({
  bannerId: z.string().min(1),
  imageUrl: z.string().url(),
  target: z.string().min(1),
  order: z.number().int().min(0),
  visible: z.boolean(),
});

const categorySchema = z.object({
  categories: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        visible: z.boolean(),
        order: z.number().int().min(0),
      }),
    )
    .refine((categories) => uniqueStrings(categories.map((entry) => entry.categoryId)), {
      message: 'categoryIds must be unique',
    }),
});

const lottieSchema = z.object({
  url: z.string().url(),
  fit: z.enum(['contain', 'cover', 'fill']).optional(),
  speed: z.number().min(0.1).max(4).optional(),
  loop: z.boolean().optional(),
  visible: z.boolean().optional(),
});

const paymentMethodsSchema = z.object({
  methods: z.array(z.string().min(1)).refine(uniqueStrings, { message: 'methods must be unique' }),
});

const plainJsonSchema = z.record(z.string().min(1), z.unknown());

export const payloadSchemas: Record<ConfigType, z.ZodType> = {
  feature_flags: featureFlagsSchema,
  app_version: appVersionSchema,
  maintenance: maintenanceSchema,
  verticals: verticalsSchema,
  home_sections: homeSectionsSchema,
  banner: bannerSchema,
  category: categorySchema,
  lottie: lottieSchema,
  payment_methods: paymentMethodsSchema,
  delivery_rules: plainJsonSchema,
  pricing_rules: plainJsonSchema,
  commission_rules: plainJsonSchema,
  promotion_rules: plainJsonSchema,
  notification_template: plainJsonSchema,
};

export function validateConfigPayload(type: ConfigType, payload: Record<string, unknown>): void {
  if (!CONFIG_TYPES.includes(type)) {
    throw new AppError('VALIDATION_ERROR', { message: `Unknown config type: ${type}` });
  }
  const result = payloadSchemas[type].safeParse(payload);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', {
      message: `Invalid payload for config type "${type}"`,
      details: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
}
