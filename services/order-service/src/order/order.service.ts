import { AppError } from '@localwala/errors';
import type { CheckoutSource } from './checkout-source.js';
import type { OrderRepository } from './order.repository.js';
import { KeyedMutex } from './keyed-mutex.js';
import { canTransition, newOrderId, type Order } from './order.types.js';
import {
  parseCreateOrder,
  parseIdempotencyKey,
  parseListOrders,
  parseOrderId,
  parseTransition,
} from '../schemas/order.schema.js';

export class OrderService {
  private readonly mutex = new KeyedMutex();

  constructor(
    private readonly repo: OrderRepository,
    private readonly checkoutSource: CheckoutSource,
  ) {}

  async createOrder(
    input: unknown,
    idempotencyKeyHeader: string | undefined,
  ): Promise<{ order: Order; replayed: boolean }> {
    const parsed = parseCreateOrder(input);
    const key = parseIdempotencyKey(idempotencyKeyHeader);

    return this.mutex.run(`idem:${key}`, async () => {
      const existing = await this.repo.findOrderByIdempotencyKey(key);
      if (existing) {
        return { order: existing, replayed: true };
      }

      const checkout = await this.checkoutSource.load(
        parsed.userId,
        parsed.vertical,
        parsed.addressId,
      );

      const now = Date.now();
      const order: Order = {
        id: newOrderId(),
        userId: parsed.userId,
        vertical: parsed.vertical,
        status: 'created',
        address: checkout.address,
        items: structuredClone(checkout.items),
        pricing: structuredClone(checkout.pricing),
        idempotencyKey: key,
        history: [],
        createdAt: now,
        updatedAt: now,
      };
      if (checkout.storeId !== undefined) order.storeId = checkout.storeId;
      if (checkout.partner !== undefined) order.partner = structuredClone(checkout.partner);
      if (checkout.couponCode !== undefined) order.couponCode = checkout.couponCode;

      await this.repo.saveOrder(order);
      return { order, replayed: false };
    });
  }

  async getOrder(orderId: string): Promise<Order> {
    parseOrderId(orderId);
    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      throw new AppError('NOT_FOUND', { message: 'Order not found.' });
    }
    return order;
  }

  async listOrders(query: unknown): Promise<Order[]> {
    const parsed = parseListOrders(query);
    return this.repo.listOrders(parsed);
  }

  async transition(orderId: string, input: unknown): Promise<Order> {
    const parsed = parseTransition(input);
    if (parsed.to === 'cancelled' && parsed.reason === undefined) {
      throw new AppError('VALIDATION_ERROR', {
        message: 'Request payload failed validation',
        details: [{ path: 'reason', message: 'cancellation requires a reason' }],
      });
    }
    return this.mutex.run(`order:${orderId}`, async () => {
      parseOrderId(orderId);
      const order = await this.repo.findOrderById(orderId);
      if (!order) {
        throw new AppError('NOT_FOUND', { message: 'Order not found.' });
      }
      if (order.status === parsed.to) {
        throw new AppError('CONFLICT', {
          message: `Order is already in status "${parsed.to}".`,
          details: { from: order.status, to: parsed.to },
        });
      }
      if (!canTransition(order.status, parsed.to)) {
        throw new AppError('CONFLICT', {
          message: `Invalid transition from "${order.status}" to "${parsed.to}".`,
          details: { from: order.status, to: parsed.to },
        });
      }

      const from = order.status;
      order.status = parsed.to;
      order.history.push({
        from,
        to: parsed.to,
        at: Date.now(),
        ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
        ...(parsed.actor !== undefined ? { actor: parsed.actor } : {}),
      });
      order.updatedAt = Date.now();
      await this.repo.saveOrder(order);
      return order;
    });
  }
}
