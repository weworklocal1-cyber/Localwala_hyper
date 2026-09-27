import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { StagingInventoryRepository } from '../inventory/inventory.repository.js';
import { InventoryService } from '../inventory/inventory.service.js';
import {
  RESERVATION_STATES,
  RESERVATION_KEY_PATTERN,
  SKU_PATTERN,
  type ReservationState,
} from '../inventory/inventory.types.js';

const skuParams = {
  type: 'object',
  required: ['sku'],
  properties: { sku: { type: 'string', minLength: 1, maxLength: 64, pattern: SKU_PATTERN } },
} as const;

const keyParams = {
  type: 'object',
  required: ['key'],
  properties: {
    key: { type: 'string', minLength: 1, maxLength: 128, pattern: RESERVATION_KEY_PATTERN },
  },
} as const;

interface SkuParams {
  sku: string;
}

interface KeyParams {
  key: string;
}

interface StockListQuery {
  q?: string;
  limit?: number;
}

interface ReservationListQuery {
  sku?: string;
  state?: ReservationState;
  limit?: number;
}

export function buildInventoryRoutes(app: FastifyInstance): void {
  const repo = new StagingInventoryRepository();
  const service = new InventoryService(repo);
  const controller = createInventoryController(service);

  app.post(
    '/stock',
    {
      schema: {
        body: {
          type: 'object',
          required: ['sku', 'physical'],
          additionalProperties: false,
          properties: {
            sku: { type: 'string', minLength: 1, maxLength: 64, pattern: SKU_PATTERN },
            physical: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    controller.createStock,
  );
  app.get(
    '/stock',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', minLength: 1, maxLength: 64 },
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
        },
      },
    },
    controller.listStock,
  );
  app.get('/stock/:sku', { schema: { params: skuParams } }, controller.getStock);
  app.patch(
    '/stock/:sku',
    {
      schema: {
        params: skuParams,
        body: {
          type: 'object',
          required: ['physical'],
          additionalProperties: false,
          properties: { physical: { type: 'integer', minimum: 0 } },
        },
      },
    },
    controller.patchStock,
  );
  app.post(
    '/stock/:sku/adjust',
    {
      schema: {
        params: skuParams,
        body: {
          type: 'object',
          required: ['delta'],
          additionalProperties: false,
          properties: {
            delta: { type: 'integer' },
            reason: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    controller.adjustStock,
  );

  app.post(
    '/reservations',
    {
      schema: {
        body: {
          type: 'object',
          required: ['key', 'sku', 'qty'],
          additionalProperties: false,
          properties: {
            key: {
              type: 'string',
              minLength: 1,
              maxLength: 128,
              pattern: RESERVATION_KEY_PATTERN,
            },
            sku: { type: 'string', minLength: 1, maxLength: 64, pattern: SKU_PATTERN },
            qty: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    controller.createReservation,
  );
  app.get(
    '/reservations',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            sku: { type: 'string', minLength: 1, maxLength: 64, pattern: SKU_PATTERN },
            state: { type: 'string', enum: [...RESERVATION_STATES] },
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
        },
      },
    },
    controller.listReservations,
  );
  app.get('/reservations/:key', { schema: { params: keyParams } }, controller.getReservation);
  app.post(
    '/reservations/:key/release',
    { schema: { params: keyParams } },
    controller.releaseReservation,
  );
  app.post(
    '/reservations/:key/commit',
    { schema: { params: keyParams } },
    controller.commitReservation,
  );
}

function createInventoryController(service: InventoryService) {
  return {
    async createStock(request: FastifyRequest, reply: FastifyReply) {
      const stock = await service.createStock(request.body);
      return reply.status(201).send(stock);
    },
    async listStock(request: FastifyRequest<{ Querystring: StockListQuery }>, reply: FastifyReply) {
      const stock = await service.listStock(request.query);
      return reply.send({ stock });
    },
    async getStock(request: FastifyRequest<{ Params: SkuParams }>, reply: FastifyReply) {
      const stock = await service.getStock(request.params.sku);
      return reply.send(stock);
    },
    async patchStock(
      request: FastifyRequest<{ Params: SkuParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const stock = await service.patchStock(request.params.sku, request.body);
      return reply.send(stock);
    },
    async adjustStock(
      request: FastifyRequest<{ Params: SkuParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const stock = await service.adjustStock(request.params.sku, request.body);
      return reply.send(stock);
    },
    async createReservation(request: FastifyRequest, reply: FastifyReply) {
      const result = await service.createReservation(request.body);
      return reply.status(201).send(result);
    },
    async listReservations(
      request: FastifyRequest<{ Querystring: ReservationListQuery }>,
      reply: FastifyReply,
    ) {
      const reservations = await service.listReservations(request.query);
      return reply.send({ reservations });
    },
    async getReservation(request: FastifyRequest<{ Params: KeyParams }>, reply: FastifyReply) {
      const reservation = await service.getReservation(request.params.key);
      return reply.send(reservation);
    },
    async releaseReservation(request: FastifyRequest<{ Params: KeyParams }>, reply: FastifyReply) {
      const result = await service.releaseReservation(request.params.key);
      return reply.send(result);
    },
    async commitReservation(request: FastifyRequest<{ Params: KeyParams }>, reply: FastifyReply) {
      const result = await service.commitReservation(request.params.key);
      return reply.send(result);
    },
  };
}
