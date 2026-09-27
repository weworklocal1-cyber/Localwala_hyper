import { AppError } from '@localwala/errors';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CheckoutPayload, CheckoutSource } from '../../src/order/checkout-source.js';
import { StagingCheckoutSource } from '../../src/order/checkout-source.js';
import type { OrderQuery, OrderRepository } from '../../src/order/order.repository.js';
import { StagingOrderRepository } from '../../src/order/order.repository.js';
import { OrderService } from '../../src/order/order.service.js';
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  canTransition,
  isOrderStatus,
  newOrderId,
  type Order,
  type OrderStatus,
} from '../../src/order/order.types.js';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

class InMemoryOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();
  readonly byIdempotencyKey = new Map<string, string>();

  async saveOrder(order: Order): Promise<void> {
    await tick();
    this.orders.set(order.id, structuredClone(order));
    this.byIdempotencyKey.set(order.idempotencyKey, order.id);
  }
  async findOrderById(orderId: string): Promise<Order | null> {
    await tick();
    const order = this.orders.get(orderId);
    return order ? structuredClone(order) : null;
  }
  async findOrderByIdempotencyKey(key: string): Promise<Order | null> {
    await tick();
    const orderId = this.byIdempotencyKey.get(key);
    if (!orderId) return null;
    const order = this.orders.get(orderId);
    return order ? structuredClone(order) : null;
  }
  async listOrders(query: OrderQuery): Promise<Order[]> {
    await tick();
    let orders = [...this.orders.values()];
    if (query.userId !== undefined) {
      orders = orders.filter((order) => order.userId === query.userId);
    }
    if (query.status !== undefined) {
      orders = orders.filter((order) => order.status === query.status);
    }
    orders.sort((a, b) => b.createdAt - a.createdAt);
    return orders.slice(0, query.limit ?? 20).map((order) => structuredClone(order));
  }
}

class FakeCheckoutSource implements CheckoutSource {
  calls = 0;
  payload: CheckoutPayload = defaultCheckout();
  failure: AppError | null = null;

  async load(): Promise<CheckoutPayload> {
    this.calls += 1;
    await tick();
    if (this.failure) throw this.failure;
    return structuredClone(this.payload);
  }
}

function defaultCheckout(): CheckoutPayload {
  return {
    items: [
      {
        productId: 'prod_burger',
        variantId: 'var_regular',
        name: 'Classic Burger',
        qty: 2,
        price: 150,
        mrp: 200,
        modifiers: [{ groupId: 'grp_top', optionIds: ['opt_cheese'] }],
        instructions: 'no onion',
      },
    ],
    pricing: { itemsTotal: 300, mrpTotal: 400, savings: 100, couponDiscount: 0, grandTotal: 300 },
    storeId: 'store_a',
    partner: { storeId: 'store_a', name: 'Burger Hub' },
    address: { addressId: 'addr_1', line1: '12 MG Road', city: 'Bengaluru', pincode: '560001' },
  };
}

const CREATED_ORDER = {
  userId: 'usr_1',
  vertical: 'food',
  addressId: 'addr_1',
} as const;

async function createOrder(
  service: OrderService,
  key = 'idem_key_0000001',
): Promise<{ order: Order; replayed: boolean }> {
  return service.createOrder(CREATED_ORDER, key);
}

async function seedOrder(service: OrderService, key = 'idem_key_0000001'): Promise<Order> {
  return (await createOrder(service, key)).order;
}

describe('order state machine', () => {
  it('only targets valid statuses', () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_TRANSITIONS[from]) {
        expect(isOrderStatus(to)).toBe(true);
      }
    }
  });

  it('has no self transitions', () => {
    for (const from of ORDER_STATUSES) {
      expect(ORDER_TRANSITIONS[from]).not.toContain(from);
    }
  });

  it('treats completed and cancelled as terminal', () => {
    expect(ORDER_TRANSITIONS.completed).toEqual([]);
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
  });

  it('allows cancellation only from created, confirmed and preparing', () => {
    const cancellable = ORDER_STATUSES.filter((status) =>
      ORDER_TRANSITIONS[status].includes('cancelled'),
    );
    expect(cancellable).toEqual(['created', 'confirmed', 'preparing']);
  });

  it('reaches every status from created', () => {
    const seen = new Set<OrderStatus>(['created']);
    const queue: OrderStatus[] = ['created'];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of ORDER_TRANSITIONS[current]) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual([...ORDER_STATUSES].sort());
  });

  it('guards canTransition', () => {
    expect(canTransition('created', 'confirmed')).toBe(true);
    expect(canTransition('created', 'delivered')).toBe(false);
    expect(canTransition('completed', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'confirmed')).toBe(false);
  });
});

describe('OrderService', () => {
  let repo: InMemoryOrderRepository;
  let checkoutSource: FakeCheckoutSource;
  let service: OrderService;

  beforeEach(() => {
    repo = new InMemoryOrderRepository();
    checkoutSource = new FakeCheckoutSource();
    service = new OrderService(repo, checkoutSource);
  });

  describe('order creation', () => {
    it('creates an order with frozen snapshots and status created', async () => {
      const { order, replayed } = await createOrder(service);
      expect(replayed).toBe(false);
      expect(order.id).toMatch(/^ord_[0-9a-f]{32}$/);
      expect(order.status).toBe('created');
      expect(order.userId).toBe('usr_1');
      expect(order.vertical).toBe('food');
      expect(order.items).toHaveLength(1);
      expect(order.items[0]).toMatchObject({ name: 'Classic Burger', qty: 2, price: 150 });
      expect(order.pricing).toEqual({
        itemsTotal: 300,
        mrpTotal: 400,
        savings: 100,
        couponDiscount: 0,
        grandTotal: 300,
      });
      expect(order.partner).toEqual({ storeId: 'store_a', name: 'Burger Hub' });
      expect(order.address).toEqual(checkoutSource.payload.address);
      expect(order.history).toEqual([]);
      expect(order.idempotencyKey).toBe('idem_key_0000001');
    });

    it('stores snapshots independent of the source payload', async () => {
      const { order } = await createOrder(service);
      checkoutSource.payload.items[0]!.qty = 999;
      checkoutSource.payload.pricing.grandTotal = 1;
      const stored = await service.getOrder(order.id);
      expect(stored.items[0]?.qty).toBe(2);
      expect(stored.pricing.grandTotal).toBe(300);
    });

    it('replays the same order for a repeated idempotency key', async () => {
      const first = await createOrder(service, 'idem_replay_0001');
      const second = await createOrder(service, 'idem_replay_0001');
      expect(second.replayed).toBe(true);
      expect(second.order.id).toBe(first.order.id);
      expect(checkoutSource.calls).toBe(1);
    });

    it('creates distinct orders for distinct keys', async () => {
      const first = await createOrder(service, 'idem_key_aaaa0001');
      const second = await createOrder(service, 'idem_key_aaaa0002');
      expect(second.order.id).not.toBe(first.order.id);
      expect(checkoutSource.calls).toBe(2);
    });

    it('rejects a missing idempotency key', async () => {
      await expect(service.createOrder(CREATED_ORDER, undefined)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(checkoutSource.calls).toBe(0);
    });

    it('rejects a malformed idempotency key', async () => {
      await expect(service.createOrder(CREATED_ORDER, 'short')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(checkoutSource.calls).toBe(0);
    });

    it('rejects an invalid body before touching the source', async () => {
      await expect(
        service.createOrder({ userId: 'usr_1', vertical: 'food' }, 'idem_key_0000001'),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(checkoutSource.calls).toBe(0);
    });

    it('propagates checkout source failures', async () => {
      checkoutSource.failure = new AppError('SERVICE_UNAVAILABLE', {
        message: 'checkout integrations pending',
      });
      await expect(createOrder(service)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      expect(repo.orders.size).toBe(0);
    });

    it('serializes concurrent creates with the same key', async () => {
      const results = await Promise.all([
        createOrder(service, 'idem_parallel_01'),
        createOrder(service, 'idem_parallel_01'),
        createOrder(service, 'idem_parallel_01'),
      ]);
      const ids = new Set(results.map((result) => result.order.id));
      expect(ids.size).toBe(1);
      expect(results.filter((result) => !result.replayed)).toHaveLength(1);
      expect(checkoutSource.calls).toBe(1);
    });
  });

  describe('fetching and listing', () => {
    it('returns NOT_FOUND for an unknown order', async () => {
      const missing = `ord_${'0'.repeat(32)}`;
      await expect(service.getOrder(missing)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects a malformed order id', async () => {
      await expect(service.getOrder('ord_123')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('filters by user and status', async () => {
      const foodOrder = await seedOrder(service, 'idem_list_000001');
      await service.transition(foodOrder.id, { to: 'confirmed' });
      checkoutSource.payload = { ...checkoutSource.payload, address: { addressId: 'addr_2' } };
      await service.createOrder(
        { userId: 'usr_2', vertical: 'store', addressId: 'addr_2' },
        'idem_list_000002',
      );

      const mine = await service.listOrders({ userId: 'usr_1' });
      expect(mine).toHaveLength(1);
      expect(mine[0]?.userId).toBe('usr_1');

      const confirmed = await service.listOrders({ status: 'confirmed' });
      expect(confirmed).toHaveLength(1);
      expect(confirmed[0]?.status).toBe('confirmed');

      const created = await service.listOrders({ status: 'created' });
      expect(created).toHaveLength(1);
      expect(created[0]?.userId).toBe('usr_2');

      const all = await service.listOrders({});
      expect(all).toHaveLength(2);
    });

    it('applies the default limit', async () => {
      await seedOrder(service, 'idem_lim_0000001');
      const orders = await service.listOrders({ limit: 1 });
      expect(orders).toHaveLength(1);
    });
  });

  describe('transitions', () => {
    it('walks the happy path to completed with full history', async () => {
      const start = await seedOrder(service);
      const path: OrderStatus[] = [
        'confirmed',
        'preparing',
        'ready',
        'out_for_delivery',
        'delivered',
        'completed',
      ];
      let order = start;
      for (const to of path) {
        order = await service.transition(order.id, { to, actor: 'partner_1' });
        expect(order.status).toBe(to);
      }
      expect(order.status).toBe('completed');
      expect(order.history).toHaveLength(6);
      expect(order.history[0]).toMatchObject({ from: 'created', to: 'confirmed' });
      expect(order.history[5]).toMatchObject({ from: 'delivered', to: 'completed' });
      expect(order.history.every((entry) => entry.actor === 'partner_1')).toBe(true);
    });

    it('keeps item, pricing, partner and address snapshots immutable', async () => {
      const start = await seedOrder(service);
      const before = structuredClone({
        items: start.items,
        pricing: start.pricing,
        partner: start.partner,
        address: start.address,
        couponCode: start.couponCode,
      });
      let order = start;
      for (const to of ['confirmed', 'preparing', 'ready'] as const) {
        order = await service.transition(order.id, { to });
      }
      expect({ items: order.items, pricing: order.pricing }).toEqual({
        items: before.items,
        pricing: before.pricing,
      });
      expect(order.partner).toEqual(before.partner);
      expect(order.address).toEqual(before.address);
      expect(order.couponCode).toEqual(before.couponCode);
    });

    it('rejects an unreachable transition', async () => {
      const order = await seedOrder(service);
      await expect(service.transition(order.id, { to: 'delivered' })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects a self transition', async () => {
      const order = await seedOrder(service);
      await expect(service.transition(order.id, { to: 'created' })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects transitions out of terminal states', async () => {
      const order = await seedOrder(service);
      await service.transition(order.id, { to: 'cancelled', reason: 'out of stock' });
      await expect(service.transition(order.id, { to: 'confirmed' })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      await expect(
        service.transition(order.id, { to: 'cancelled', reason: 'x' }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('requires a cancellation reason', async () => {
      const order = await seedOrder(service);
      await expect(service.transition(order.id, { to: 'cancelled' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      const cancelled = await service.transition(order.id, {
        to: 'cancelled',
        reason: 'partner rejected',
      });
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.history[0]?.reason).toBe('partner rejected');
    });

    it('rejects an unknown order for transitions', async () => {
      const missing = `ord_${'f'.repeat(32)}`;
      await expect(service.transition(missing, { to: 'confirmed' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('rejects an invalid target status', async () => {
      const order = await seedOrder(service);
      await expect(service.transition(order.id, { to: 'teleported' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('lets exactly one of two racing cancellations win', async () => {
      const order = await seedOrder(service);
      const results = await Promise.allSettled([
        service.transition(order.id, { to: 'cancelled', reason: 'customer cancelled' }),
        service.transition(order.id, { to: 'cancelled', reason: 'partner rejected' }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((result) => result.status === 'rejected');
      expect((rejected as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT' });
      const final = await service.getOrder(order.id);
      expect(final.status).toBe('cancelled');
      expect(final.history).toHaveLength(1);
    });

    it('rejects a duplicate parallel confirm', async () => {
      const order = await seedOrder(service);
      const results = await Promise.allSettled([
        service.transition(order.id, { to: 'confirmed' }),
        service.transition(order.id, { to: 'confirmed' }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    });
  });

  describe('staging adapters', () => {
    it('blocks the order repository with 503', async () => {
      const staging = new StagingOrderRepository();
      await expect(staging.findOrderById('ord_1')).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      });
      await expect(staging.saveOrder({} as Order)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(staging.listOrders({})).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    });

    it('blocks the checkout source with 503', async () => {
      const staging = new StagingCheckoutSource();
      await expect(staging.load('usr_1', 'food', 'addr_1')).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      });
    });

    it('surfaces 503 through the service', async () => {
      const stagingService = new OrderService(new StagingOrderRepository(), checkoutSource);
      await expect(stagingService.getOrder(newOrderId())).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(createOrder(stagingService)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    });
  });
});
