import { AppError } from '@localwala/errors';
import { z } from 'zod';
import { SLUG_PATTERN } from '../catalog/catalog.types.js';

const slug = z.string().regex(new RegExp(SLUG_PATTERN), 'must be a kebab-case slug');

const attributeRecord = z.record(z.string().min(1).max(64), z.string().max(500));

const money = z.number().positive();

const variantSchema = z
  .object({
    sku: z.string().min(1).max(64),
    name: z.string().min(1).max(200),
    attributes: attributeRecord.optional(),
    price: money,
    mrp: money,
    available: z.boolean().optional(),
  })
  .refine((variant) => variant.mrp >= variant.price, {
    message: 'mrp must be greater than or equal to price',
    path: ['mrp'],
  });

const modifierOptionSchema = z.object({
  name: z.string().min(1).max(200),
  priceDelta: z.number(),
  available: z.boolean().optional(),
});

const modifierGroupSchema = z.object({
  name: z.string().min(1).max(200),
  required: z.boolean(),
  options: z.array(modifierOptionSchema).min(1),
});

const modifierGroupsAreUnique = (groups: z.infer<typeof modifierGroupSchema>[]): boolean =>
  groups.every(
    (group) => new Set(group.options.map((option) => option.name)).size === group.options.length,
  );

const createCategorySchema = z.object({
  key: slug,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  parentId: z.string().min(1).max(64).optional(),
  vertical: z.string().min(1).max(64).optional(),
  order: z.number().int().min(0).optional(),
  visible: z.boolean().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  parentId: z.string().min(1).max(64).nullable().optional(),
  order: z.number().int().min(0).optional(),
  visible: z.boolean().optional(),
});

const createProductSchema = z
  .object({
    key: slug,
    categoryId: z.string().min(1).max(64),
    name: z.string().min(1).max(300),
    description: z.string().max(5000).optional(),
    brand: z.string().min(1).max(200).optional(),
    attributes: attributeRecord.optional(),
    media: z.array(z.string().url()).max(20).optional(),
    variants: z.array(variantSchema).min(1),
    modifierGroups: z.array(modifierGroupSchema).optional(),
  })
  .refine(
    (product) =>
      new Set(product.variants.map((variant) => variant.sku)).size === product.variants.length,
    { message: 'variant SKUs must be unique', path: ['variants'] },
  )
  .refine((product) => modifierGroupsAreUnique(product.modifierGroups ?? []), {
    message: 'modifier option names must be unique within a group',
    path: ['modifierGroups'],
  });

const updateProductSchema = z
  .object({
    name: z.string().min(1).max(300).optional(),
    description: z.string().max(5000).optional(),
    brand: z.string().min(1).max(200).optional(),
    categoryId: z.string().min(1).max(64).optional(),
    attributes: attributeRecord.optional(),
    media: z.array(z.string().url()).max(20).optional(),
    status: z.enum(['draft', 'active', 'inactive']).optional(),
    modifierGroups: z.array(modifierGroupSchema).optional(),
  })
  .refine(
    (product) =>
      product.modifierGroups === undefined || modifierGroupsAreUnique(product.modifierGroups),
    { message: 'modifier option names must be unique within a group', path: ['modifierGroups'] },
  );

const updateVariantSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    attributes: attributeRecord.optional(),
    price: money.optional(),
    mrp: money.optional(),
    available: z.boolean().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'at least one field is required',
  });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

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

export function parseCreateCategory(input: unknown): CreateCategoryInput {
  return parse(createCategorySchema, input);
}

export function parseUpdateCategory(input: unknown): UpdateCategoryInput {
  return parse(updateCategorySchema, input);
}

export function parseCreateProduct(input: unknown): CreateProductInput {
  return parse(createProductSchema, input);
}

export function parseUpdateProduct(input: unknown): UpdateProductInput {
  return parse(updateProductSchema, input);
}

export function parseUpdateVariant(input: unknown): UpdateVariantInput {
  return parse(updateVariantSchema, input);
}
