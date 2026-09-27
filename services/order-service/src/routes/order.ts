import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { StagingCheckoutSource } from '../order/checkout-source.js';
import { StagingOrderRepository } from '../order/order.repository.js';
import { OrderService } from '../order/order.service.js';
import { ORDER_STATUSES, USER_ID_PATTERN, VERTICAL_PATTERN } from '../order/order.types.js';

const orderIdParams = {
  type: 'object',
  required: ['orderId'],
  properties: {
    orderId: { type: 'string', pattern: '^ord_[0-9a-f]{32}$' },
  },
} as const;

interface OrderIdParams {
  orderId: string;
}

export function buildOrderRoutes(app: FastifyInstance): void {
  const repo = new StagingOrderRepository();
  const checkoutSource = new StagingCheckoutSource();
  const service = new OrderService(repo, checkoutSource);
  const controller = createOrderController(service);

  app.post(
    '/orders',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'vertical', 'addressId'],
          additionalProperties: false,
          properties: {
            userId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            vertical: { type: 'string', minLength: 1, maxLength: 32, pattern: VERTICAL_PATTERN },
            addressId: { type: 'string', minLength: 1, maxLength: 64 },
          },
        },
      },
    },
    controller.createOrder,
  );
  app.get(
    '/orders',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            userId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            status: { type: 'string', enum: [...ORDER_STATUSES] },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    controller.listOrders,
  );
  app.get('/orders/:orderId', { schema: { params: orderIdParams } }, controller.getOrder);
  app.post(
    '/orders/:orderId/transitions',
    {
      schema: {
        params: orderIdParams,
        body: {
          type: 'object',
          required: ['to'],
          additionalProperties: false,
          properties: {
            to: { type: 'string', enum: [...ORDER_STATUSES] },
            reason: { type: 'string', minLength: 1, maxLength: 200 },
            actor: { type: 'string', minLength: 1, maxLength: 64 },
          },
        },
      },
    },
    controller.transition,
  );
}

function createOrderController(service: OrderService) {
  return {
    async createOrder(request: FastifyRequest, reply: FastifyReply) {
      const idempotencyKey = request.headers['idempotency-key'];
      const header = Array.isArray(idempotencyKey) ? idempotencyKey[0] : idempotencyKey;
      const result = await service.createOrder(request.body, header);
      return reply.status(result.replayed ? 200 : 201).send(result.order);
    },
    async listOrders(request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) {
      const orders = await service.listOrders(request.query);
      return reply.send({ orders });
    },
    async getOrder(request: FastifyRequest<{ Params: OrderIdParams }>, reply: FastifyReply) {
      const order = await service.getOrder(request.params.orderId);
      return reply.send(order);
    },
    async transition(
      request: FastifyRequest<{ Params: OrderIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const order = await service.transition(request.params.orderId, request.body);
      return reply.send(order);
    },
  };
}
