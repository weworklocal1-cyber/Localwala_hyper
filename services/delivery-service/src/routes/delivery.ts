import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { StagingDeliveryRepository } from '../delivery/delivery.repository.js';
import { DeliveryService } from '../delivery/delivery.service.js';
import {
  DATE_PATTERN,
  DELIVERY_STATES,
  MAX_AMOUNT_PAISE,
  OTP_PATTERN,
  ORDER_ID_PATTERN,
  POD_TYPES,
  ZONE_ID_PATTERN,
} from '../delivery/delivery.types.js';

const areaIdParams = {
  type: 'object',
  required: ['areaId'],
  properties: { areaId: { type: 'string', pattern: '^dar_[0-9a-f]{32}$' } },
} as const;

const slotIdParams = {
  type: 'object',
  required: ['slotId'],
  properties: { slotId: { type: 'string', pattern: '^dsl_[0-9a-f]{32}$' } },
} as const;

const deliveryIdParams = {
  type: 'object',
  required: ['deliveryId'],
  properties: { deliveryId: { type: 'string', pattern: '^dlv_[0-9a-f]{32}$' } },
} as const;

const zoneIdProp = {
  type: 'string',
  minLength: 1,
  maxLength: 64,
  pattern: ZONE_ID_PATTERN,
} as const;
const paiseProp = { type: 'integer', minimum: 0, maximum: MAX_AMOUNT_PAISE } as const;
const otpProp = { type: 'string', pattern: OTP_PATTERN } as const;

interface AreaIdParams {
  areaId: string;
}

interface SlotIdParams {
  slotId: string;
}

interface DeliveryIdParams {
  deliveryId: string;
}

export function buildDeliveryRoutes(app: FastifyInstance): void {
  const repo = new StagingDeliveryRepository();
  const service = new DeliveryService(repo);
  const controller = createDeliveryController(service);

  app.post(
    '/delivery-areas',
    {
      schema: {
        body: {
          type: 'object',
          required: ['zoneId', 'feePaise', 'etaMinutes'],
          additionalProperties: false,
          properties: {
            zoneId: zoneIdProp,
            partnerId: {
              type: 'string',
              minLength: 1,
              maxLength: 64,
              pattern: '^[A-Za-z0-9._-]{1,64}$',
            },
            feePaise: paiseProp,
            freeAbovePaise: paiseProp,
            maxDistanceKm: { type: 'number', minimum: 0.1, maximum: 100 },
            etaMinutes: { type: 'integer', minimum: 1, maximum: 600 },
            active: { type: 'boolean' },
          },
        },
      },
    },
    controller.createArea,
  );
  app.get(
    '/delivery-areas',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            zoneId: zoneIdProp,
            partnerId: { type: 'string', minLength: 1, maxLength: 64 },
            active: { type: 'string', enum: ['true', 'false'] },
          },
        },
      },
    },
    controller.listAreas,
  );
  app.get('/delivery-areas/:areaId', { schema: { params: areaIdParams } }, controller.getArea);
  app.put(
    '/delivery-areas/:areaId',
    {
      schema: {
        params: areaIdParams,
        body: {
          type: 'object',
          additionalProperties: false,
          minProperties: 1,
          properties: {
            feePaise: paiseProp,
            freeAbovePaise: paiseProp,
            etaMinutes: { type: 'integer', minimum: 1, maximum: 600 },
            active: { type: 'boolean' },
          },
        },
      },
    },
    controller.updateArea,
  );

  app.post(
    '/delivery-slots',
    {
      schema: {
        body: {
          type: 'object',
          required: ['zoneId', 'date', 'startMinute', 'endMinute', 'capacity'],
          additionalProperties: false,
          properties: {
            zoneId: zoneIdProp,
            date: { type: 'string', pattern: DATE_PATTERN },
            startMinute: { type: 'integer', minimum: 0, maximum: 1439 },
            endMinute: { type: 'integer', minimum: 1, maximum: 1440 },
            capacity: { type: 'integer', minimum: 1, maximum: 1000 },
            active: { type: 'boolean' },
          },
        },
      },
    },
    controller.createSlot,
  );
  app.get(
    '/delivery-slots',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            zoneId: zoneIdProp,
            date: { type: 'string', pattern: DATE_PATTERN },
            active: { type: 'string', enum: ['true', 'false'] },
          },
        },
      },
    },
    controller.listSlots,
  );
  app.get('/delivery-slots/:slotId', { schema: { params: slotIdParams } }, controller.getSlot);
  app.post(
    '/delivery-slots/:slotId/reserve',
    {
      schema: {
        params: slotIdParams,
        body: {
          type: 'object',
          additionalProperties: false,
          properties: { quantity: { type: 'integer', minimum: 1, maximum: 1000, default: 1 } },
        },
      },
    },
    controller.reserveSlot,
  );
  app.post(
    '/delivery-slots/:slotId/release',
    {
      schema: {
        params: slotIdParams,
        body: {
          type: 'object',
          additionalProperties: false,
          properties: { quantity: { type: 'integer', minimum: 1, maximum: 1000, default: 1 } },
        },
      },
    },
    controller.releaseSlot,
  );

  app.post(
    '/deliveries',
    {
      schema: {
        body: {
          type: 'object',
          required: ['orderId'],
          additionalProperties: false,
          properties: {
            orderId: { type: 'string', pattern: ORDER_ID_PATTERN },
            slotId: { type: 'string', pattern: '^dsl_[0-9a-f]{32}$' },
            otpCode: otpProp,
            requirePod: { type: 'boolean' },
            codAmountPaise: paiseProp,
          },
        },
      },
    },
    controller.createDelivery,
  );
  app.get(
    '/deliveries',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            orderId: { type: 'string', pattern: ORDER_ID_PATTERN },
            state: { type: 'string', enum: [...DELIVERY_STATES] },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        },
      },
    },
    controller.listDeliveries,
  );
  app.get(
    '/deliveries/:deliveryId',
    { schema: { params: deliveryIdParams } },
    controller.getDelivery,
  );
  app.post(
    '/deliveries/:deliveryId/transitions',
    {
      schema: {
        params: deliveryIdParams,
        body: {
          type: 'object',
          required: ['to'],
          additionalProperties: false,
          properties: {
            to: { type: 'string', enum: [...DELIVERY_STATES] },
            reason: { type: 'string', minLength: 1, maxLength: 200 },
            otpCode: otpProp,
            pod: {
              type: 'object',
              required: ['type'],
              additionalProperties: false,
              properties: {
                type: { type: 'string', enum: [...POD_TYPES] },
                ref: { type: 'string', minLength: 1, maxLength: 300 },
              },
            },
            codCollected: { type: 'boolean' },
          },
        },
      },
    },
    controller.transition,
  );
  app.get(
    '/deliveries/:deliveryId/history',
    { schema: { params: deliveryIdParams } },
    controller.getHistory,
  );
}

function createDeliveryController(service: DeliveryService) {
  return {
    async createArea(request: FastifyRequest, reply: FastifyReply) {
      const area = await service.createArea(request.body);
      return reply.status(201).send(area);
    },
    async listAreas(request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) {
      const areas = await service.listAreas(request.query);
      return reply.send({ areas });
    },
    async getArea(request: FastifyRequest<{ Params: AreaIdParams }>, reply: FastifyReply) {
      const area = await service.getArea(request.params.areaId);
      return reply.send(area);
    },
    async updateArea(
      request: FastifyRequest<{ Params: AreaIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const area = await service.updateArea(request.params.areaId, request.body);
      return reply.send(area);
    },
    async createSlot(request: FastifyRequest, reply: FastifyReply) {
      const slot = await service.createSlot(request.body);
      return reply.status(201).send(slot);
    },
    async listSlots(request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) {
      const slots = await service.listSlots(request.query);
      return reply.send({ slots });
    },
    async getSlot(request: FastifyRequest<{ Params: SlotIdParams }>, reply: FastifyReply) {
      const slot = await service.getSlot(request.params.slotId);
      return reply.send(slot);
    },
    async reserveSlot(
      request: FastifyRequest<{ Params: SlotIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const slot = await service.reserveSlot(request.params.slotId, request.body);
      return reply.send(slot);
    },
    async releaseSlot(
      request: FastifyRequest<{ Params: SlotIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const slot = await service.releaseSlot(request.params.slotId, request.body);
      return reply.send(slot);
    },
    async createDelivery(request: FastifyRequest, reply: FastifyReply) {
      const delivery = await service.createDelivery(request.body);
      return reply.status(201).send(delivery);
    },
    async listDeliveries(request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) {
      const deliveries = await service.listDeliveries(request.query);
      return reply.send({ deliveries });
    },
    async getDelivery(request: FastifyRequest<{ Params: DeliveryIdParams }>, reply: FastifyReply) {
      const delivery = await service.getDelivery(request.params.deliveryId);
      return reply.send(delivery);
    },
    async transition(
      request: FastifyRequest<{ Params: DeliveryIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const delivery = await service.transition(request.params.deliveryId, request.body);
      return reply.send(delivery);
    },
    async getHistory(request: FastifyRequest<{ Params: DeliveryIdParams }>, reply: FastifyReply) {
      const events = await service.getHistory(request.params.deliveryId);
      return reply.send({ events });
    },
  };
}
