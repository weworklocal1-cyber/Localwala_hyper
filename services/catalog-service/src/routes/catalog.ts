import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { StagingCatalogRepository } from '../catalog/catalog.repository.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { PRODUCT_STATUSES, SLUG_PATTERN, type ProductStatus } from '../catalog/catalog.types.js';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
} as const;

const categoryBody = {
  type: 'object',
  required: ['key', 'name'],
  additionalProperties: false,
  properties: {
    key: { type: 'string', minLength: 1, maxLength: 128, pattern: SLUG_PATTERN },
    name: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 2000 },
    parentId: { type: 'string', minLength: 1, maxLength: 64 },
    vertical: { type: 'string', minLength: 1, maxLength: 64 },
    order: { type: 'integer', minimum: 0 },
    visible: { type: 'boolean' },
  },
} as const;

const categoryPatchBody = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 2000 },
    parentId: { type: ['string', 'null'], minLength: 1, maxLength: 64 },
    order: { type: 'integer', minimum: 0 },
    visible: { type: 'boolean' },
  },
} as const;

const modifierGroupSchema = {
  type: 'object',
  required: ['name', 'required', 'options'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200 },
    required: { type: 'boolean' },
    options: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['name', 'priceDelta'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          priceDelta: { type: 'number' },
          available: { type: 'boolean' },
        },
      },
    },
  },
} as const;

const variantSchema = {
  type: 'object',
  required: ['sku', 'name', 'price', 'mrp'],
  additionalProperties: false,
  properties: {
    sku: { type: 'string', minLength: 1, maxLength: 64 },
    name: { type: 'string', minLength: 1, maxLength: 200 },
    attributes: { type: 'object', additionalProperties: { type: 'string', maxLength: 500 } },
    price: { type: 'number', exclusiveMinimum: 0 },
    mrp: { type: 'number', exclusiveMinimum: 0 },
    available: { type: 'boolean' },
  },
} as const;

const productBody = {
  type: 'object',
  required: ['key', 'categoryId', 'name', 'variants'],
  additionalProperties: false,
  properties: {
    key: { type: 'string', minLength: 1, maxLength: 128, pattern: SLUG_PATTERN },
    categoryId: { type: 'string', minLength: 1, maxLength: 64 },
    name: { type: 'string', minLength: 1, maxLength: 300 },
    description: { type: 'string', maxLength: 5000 },
    brand: { type: 'string', minLength: 1, maxLength: 200 },
    attributes: { type: 'object', additionalProperties: { type: 'string', maxLength: 500 } },
    media: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1 } },
    variants: { type: 'array', minItems: 1, items: variantSchema },
    modifierGroups: { type: 'array', items: modifierGroupSchema },
  },
} as const;

const productPatchBody = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 300 },
    description: { type: 'string', maxLength: 5000 },
    brand: { type: 'string', minLength: 1, maxLength: 200 },
    categoryId: { type: 'string', minLength: 1, maxLength: 64 },
    attributes: { type: 'object', additionalProperties: { type: 'string', maxLength: 500 } },
    media: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1 } },
    status: { type: 'string', enum: [...PRODUCT_STATUSES] },
    modifierGroups: { type: 'array', items: modifierGroupSchema },
  },
} as const;

interface IdParams {
  id: string;
}

interface VariantParams {
  id: string;
  variantId: string;
}

interface CategoryListQuery {
  parentId?: string;
  vertical?: string;
  visible?: boolean;
  key?: string;
}

interface ProductListQuery {
  categoryId?: string;
  status?: ProductStatus;
  available?: boolean;
  q?: string;
  limit?: number;
}

interface AvailabilityBody {
  available: boolean;
}

export function buildCatalogRoutes(app: FastifyInstance): void {
  const repo = new StagingCatalogRepository();
  const service = new CatalogService(repo);
  const controller = createCatalogController(service);

  app.post('/categories', { schema: { body: categoryBody } }, controller.createCategory);
  app.get(
    '/categories',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            parentId: { type: 'string', minLength: 1, maxLength: 64 },
            vertical: { type: 'string', minLength: 1, maxLength: 64 },
            key: { type: 'string', minLength: 1, maxLength: 128, pattern: SLUG_PATTERN },
            visible: { type: 'boolean' },
          },
        },
      },
    },
    controller.listCategories,
  );
  app.get('/categories/tree', controller.getCategoryTree);
  app.get('/categories/:id', { schema: { params: idParams } }, controller.getCategory);
  app.patch(
    '/categories/:id',
    { schema: { params: idParams, body: categoryPatchBody } },
    controller.updateCategory,
  );
  app.delete('/categories/:id', { schema: { params: idParams } }, controller.deleteCategory);

  app.post('/products', { schema: { body: productBody } }, controller.createProduct);
  app.get(
    '/products',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            categoryId: { type: 'string', minLength: 1, maxLength: 64 },
            status: { type: 'string', enum: [...PRODUCT_STATUSES] },
            available: { type: 'boolean' },
            q: { type: 'string', minLength: 1, maxLength: 200 },
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
        },
      },
    },
    controller.listProducts,
  );
  app.get('/products/:id', { schema: { params: idParams } }, controller.getProduct);
  app.patch(
    '/products/:id',
    { schema: { params: idParams, body: productPatchBody } },
    controller.updateProduct,
  );
  app.delete('/products/:id', { schema: { params: idParams } }, controller.deleteProduct);
  app.post(
    '/products/:id/availability',
    {
      schema: {
        params: idParams,
        body: {
          type: 'object',
          required: ['available'],
          additionalProperties: false,
          properties: { available: { type: 'boolean' } },
        },
      },
    },
    controller.setAvailability,
  );
  app.patch(
    '/products/:id/variants/:variantId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id', 'variantId'],
          properties: {
            id: { type: 'string', minLength: 1, maxLength: 64 },
            variantId: { type: 'string', minLength: 1, maxLength: 64 },
          },
        },
        body: {
          type: 'object',
          minProperties: 1,
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            attributes: {
              type: 'object',
              additionalProperties: { type: 'string', maxLength: 500 },
            },
            price: { type: 'number', exclusiveMinimum: 0 },
            mrp: { type: 'number', exclusiveMinimum: 0 },
            available: { type: 'boolean' },
          },
        },
      },
    },
    controller.updateVariant,
  );
}

function createCatalogController(service: CatalogService) {
  return {
    async createCategory(request: FastifyRequest, reply: FastifyReply) {
      const category = await service.createCategory(request.body);
      return reply.status(201).send(category);
    },
    async listCategories(
      request: FastifyRequest<{ Querystring: CategoryListQuery }>,
      reply: FastifyReply,
    ) {
      const categories = await service.listCategories(request.query);
      return reply.send({ categories });
    },
    async getCategoryTree(_request: FastifyRequest, reply: FastifyReply) {
      const tree = await service.getCategoryTree();
      return reply.send({ tree });
    },
    async getCategory(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
      const category = await service.getCategory(request.params.id);
      return reply.send(category);
    },
    async updateCategory(
      request: FastifyRequest<{ Params: IdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const category = await service.updateCategory(request.params.id, request.body);
      return reply.send(category);
    },
    async deleteCategory(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
      const result = await service.deleteCategory(request.params.id);
      return reply.send(result);
    },
    async createProduct(request: FastifyRequest, reply: FastifyReply) {
      const product = await service.createProduct(request.body);
      return reply.status(201).send(product);
    },
    async listProducts(
      request: FastifyRequest<{ Querystring: ProductListQuery }>,
      reply: FastifyReply,
    ) {
      const products = await service.listProducts(request.query);
      return reply.send({ products });
    },
    async getProduct(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
      const product = await service.getProduct(request.params.id);
      return reply.send(product);
    },
    async updateProduct(
      request: FastifyRequest<{ Params: IdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const product = await service.updateProduct(request.params.id, request.body);
      return reply.send(product);
    },
    async deleteProduct(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
      const result = await service.deleteProduct(request.params.id);
      return reply.send(result);
    },
    async setAvailability(
      request: FastifyRequest<{ Params: IdParams; Body: AvailabilityBody }>,
      reply: FastifyReply,
    ) {
      const product = await service.setProductAvailability(
        request.params.id,
        request.body.available,
      );
      return reply.send(product);
    },
    async updateVariant(
      request: FastifyRequest<{ Params: VariantParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const product = await service.updateVariant(
        request.params.id,
        request.params.variantId,
        request.body,
      );
      return reply.send(product);
    },
  };
}
