import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { StagingCartRepository } from '../cart/cart.repository.js';
import { CartService } from '../cart/cart.service.js';
import { StagingCatalogPriceSource } from '../cart/price-source.js';
import { StagingCouponValidator } from '../cart/coupon.js';
import { MAX_ITEM_QTY, USER_ID_PATTERN, VERTICAL_PATTERN } from '../cart/cart.types.js';

const cartRefParams = {
  type: 'object',
  required: ['userId', 'vertical'],
  properties: {
    userId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
    vertical: { type: 'string', minLength: 1, maxLength: 32, pattern: VERTICAL_PATTERN },
  },
} as const;

const itemRefParams = {
  type: 'object',
  required: ['userId', 'vertical', 'itemId'],
  properties: {
    ...cartRefParams.properties,
    itemId: { type: 'string', minLength: 1, maxLength: 64 },
  },
} as const;

const modifierSelection = {
  type: 'object',
  required: ['groupId', 'optionIds'],
  additionalProperties: false,
  properties: {
    groupId: { type: 'string', minLength: 1, maxLength: 64 },
    optionIds: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: { type: 'string', minLength: 1, maxLength: 64 },
    },
  },
} as const;

interface CartRefParams {
  userId: string;
  vertical: string;
}

interface ItemRefParams extends CartRefParams {
  itemId: string;
}

export function buildCartRoutes(app: FastifyInstance): void {
  const repo = new StagingCartRepository();
  const priceSource = new StagingCatalogPriceSource();
  const couponValidator = new StagingCouponValidator();
  const service = new CartService(repo, priceSource, couponValidator);
  const controller = createCartController(service);

  app.post(
    '/carts',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'vertical'],
          additionalProperties: false,
          properties: {
            userId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            vertical: { type: 'string', minLength: 1, maxLength: 32, pattern: VERTICAL_PATTERN },
          },
        },
      },
    },
    controller.createCart,
  );
  app.get('/carts/:userId/:vertical', { schema: { params: cartRefParams } }, controller.getCart);
  app.delete(
    '/carts/:userId/:vertical',
    { schema: { params: cartRefParams } },
    controller.deleteCart,
  );
  app.patch(
    '/carts/:userId/:vertical',
    {
      schema: {
        params: cartRefParams,
        body: {
          type: 'object',
          required: ['addressId'],
          additionalProperties: false,
          properties: {
            addressId: { type: ['string', 'null'], minLength: 1, maxLength: 64 },
          },
        },
      },
    },
    controller.patchCart,
  );

  app.post(
    '/carts/:userId/:vertical/items',
    {
      schema: {
        params: cartRefParams,
        body: {
          type: 'object',
          required: ['productId', 'variantId', 'qty'],
          additionalProperties: false,
          properties: {
            productId: { type: 'string', minLength: 1, maxLength: 64 },
            variantId: { type: 'string', minLength: 1, maxLength: 64 },
            qty: { type: 'integer', minimum: 1, maximum: MAX_ITEM_QTY },
            modifiers: { type: 'array', maxItems: 20, items: modifierSelection },
            instructions: { type: 'string', maxLength: 500 },
            storeId: { type: 'string', minLength: 1, maxLength: 64 },
          },
        },
      },
    },
    controller.addItem,
  );
  app.patch(
    '/carts/:userId/:vertical/items/:itemId',
    {
      schema: {
        params: itemRefParams,
        body: {
          type: 'object',
          additionalProperties: false,
          minProperties: 1,
          properties: {
            qty: { type: 'integer', minimum: 1, maximum: MAX_ITEM_QTY },
            instructions: { type: ['string', 'null'], maxLength: 500 },
          },
        },
      },
    },
    controller.patchItem,
  );
  app.delete(
    '/carts/:userId/:vertical/items/:itemId',
    { schema: { params: itemRefParams } },
    controller.removeItem,
  );

  app.put(
    '/carts/:userId/:vertical/coupon',
    {
      schema: {
        params: cartRefParams,
        body: {
          type: 'object',
          required: ['code'],
          additionalProperties: false,
          properties: {
            code: { type: 'string', minLength: 3, maxLength: 32, pattern: '^[A-Za-z0-9_-]+$' },
          },
        },
      },
    },
    controller.applyCoupon,
  );
  app.delete(
    '/carts/:userId/:vertical/coupon',
    { schema: { params: cartRefParams } },
    controller.clearCoupon,
  );

  app.get(
    '/carts/:userId/:vertical/checkout-readiness',
    { schema: { params: cartRefParams } },
    controller.getReadiness,
  );
}

function createCartController(service: CartService) {
  async function withPricing(cart: Awaited<ReturnType<CartService['getCart']>>) {
    return { cart, pricing: service.computePricing(cart) };
  }

  return {
    async createCart(request: FastifyRequest, reply: FastifyReply) {
      const cart = await service.createCart(request.body);
      return reply.status(201).send(await withPricing(cart));
    },
    async getCart(request: FastifyRequest<{ Params: CartRefParams }>, reply: FastifyReply) {
      const cart = await service.getCart(request.params.userId, request.params.vertical);
      return reply.send(await withPricing(cart));
    },
    async deleteCart(request: FastifyRequest<{ Params: CartRefParams }>, reply: FastifyReply) {
      await service.deleteCart(request.params.userId, request.params.vertical);
      return reply.send({ deleted: true });
    },
    async patchCart(
      request: FastifyRequest<{ Params: CartRefParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const cart = await service.patchCart(
        request.params.userId,
        request.params.vertical,
        request.body,
      );
      return reply.send(await withPricing(cart));
    },
    async addItem(
      request: FastifyRequest<{ Params: CartRefParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const cart = await service.addItem(
        request.params.userId,
        request.params.vertical,
        request.body,
      );
      return reply.status(201).send(await withPricing(cart));
    },
    async patchItem(
      request: FastifyRequest<{ Params: ItemRefParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const cart = await service.patchItem(
        request.params.userId,
        request.params.vertical,
        request.params.itemId,
        request.body,
      );
      return reply.send(await withPricing(cart));
    },
    async removeItem(request: FastifyRequest<{ Params: ItemRefParams }>, reply: FastifyReply) {
      const cart = await service.removeItem(
        request.params.userId,
        request.params.vertical,
        request.params.itemId,
      );
      return reply.send(await withPricing(cart));
    },
    async applyCoupon(
      request: FastifyRequest<{ Params: CartRefParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const cart = await service.applyCoupon(
        request.params.userId,
        request.params.vertical,
        request.body,
      );
      return reply.send(await withPricing(cart));
    },
    async clearCoupon(request: FastifyRequest<{ Params: CartRefParams }>, reply: FastifyReply) {
      const cart = await service.clearCoupon(request.params.userId, request.params.vertical);
      return reply.send(await withPricing(cart));
    },
    async getReadiness(request: FastifyRequest<{ Params: CartRefParams }>, reply: FastifyReply) {
      const readiness = await service.getReadiness(request.params.userId, request.params.vertical);
      return reply.send(readiness);
    },
  };
}
