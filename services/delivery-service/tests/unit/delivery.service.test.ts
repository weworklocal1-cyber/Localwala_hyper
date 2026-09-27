import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '@localwala/errors';
import {
  StagingDeliveryRepository,
  type DeliveryAreaQuery,
  type DeliveryQuery,
  type DeliveryRepository,
  type SlotQuery,
} from '../../src/delivery/delivery.repository.js';
import { DeliveryService } from '../../src/delivery/delivery.service.js';
import type {
  Delivery,
  DeliveryArea,
  DeliverySlot,
  DeliveryState,
} from '../../src/delivery/delivery.types.js';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

const ORDER_A = `ord_${'a1b2c3d4'.repeat(4)}`;
const ORDER_B = `ord_${'b1b2c3d4'.repeat(4)}`;
const ZONE = 'zone_central';

class InMemoryDeliveryRepository implements DeliveryRepository {
  readonly areas = new Map<string, DeliveryArea>();
  readonly slots = new Map<string, DeliverySlot>();
  readonly deliveries = new Map<string, Delivery>();

  async saveArea(area: DeliveryArea): Promise<void> {
    await tick();
    this.areas.set(area.id, structuredClone(area));
  }
  async findArea(areaId: string): Promise<DeliveryArea | null> {
    await tick();
    const area = this.areas.get(areaId);
    return area ? structuredClone(area) : null;
  }
  async findAreaByKey(zoneId: string, partnerId?: string): Promise<DeliveryArea | null> {
    await tick();
    for (const area of this.areas.values()) {
      if (area.zoneId === zoneId && (area.partnerId ?? undefined) === partnerId) {
        return structuredClone(area);
      }
    }
    return null;
  }
  async listAreas(query: DeliveryAreaQuery): Promise<DeliveryArea[]> {
    await tick();
    return [...this.areas.values()]
      .filter((area) => query.zoneId === undefined || area.zoneId === query.zoneId)
      .filter((area) => query.partnerId === undefined || area.partnerId === query.partnerId)
      .filter((area) => query.active === undefined || area.active === query.active)
      .map((area) => structuredClone(area));
  }
  async saveSlot(slot: DeliverySlot): Promise<void> {
    await tick();
    this.slots.set(slot.id, structuredClone(slot));
  }
  async findSlot(slotId: string): Promise<DeliverySlot | null> {
    await tick();
    const slot = this.slots.get(slotId);
    return slot ? structuredClone(slot) : null;
  }
  async listSlots(query: SlotQuery): Promise<DeliverySlot[]> {
    await tick();
    return [...this.slots.values()]
      .filter((slot) => query.zoneId === undefined || slot.zoneId === query.zoneId)
      .filter((slot) => query.date === undefined || slot.date === query.date)
      .filter((slot) => query.active === undefined || slot.active === query.active)
      .map((slot) => structuredClone(slot));
  }
  async saveDelivery(delivery: Delivery): Promise<void> {
    await tick();
    this.deliveries.set(delivery.id, structuredClone(delivery));
  }
  async findDelivery(deliveryId: string): Promise<Delivery | null> {
    await tick();
    const delivery = this.deliveries.get(deliveryId);
    return delivery ? structuredClone(delivery) : null;
  }
  async findDeliveryByOrder(orderId: string): Promise<Delivery | null> {
    await tick();
    for (const delivery of this.deliveries.values()) {
      if (delivery.orderId === orderId) return structuredClone(delivery);
    }
    return null;
  }
  async listDeliveries(query: DeliveryQuery): Promise<Delivery[]> {
    await tick();
    return [...this.deliveries.values()]
      .filter((delivery) => query.orderId === undefined || delivery.orderId === query.orderId)
      .filter((delivery) => query.state === undefined || delivery.state === query.state)
      .slice(0, query.limit ?? 50)
      .map((delivery) => structuredClone(delivery));
  }
}

const expectError = async (operation: Promise<unknown>, code: string) => {
  const error = await operation.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  return error as AppError;
};

describe('DeliveryService', () => {
  let repo: InMemoryDeliveryRepository;
  let service: DeliveryService;

  beforeEach(() => {
    repo = new InMemoryDeliveryRepository();
    service = new DeliveryService(repo);
  });

  describe('delivery areas', () => {
    const areaPayload = { zoneId: ZONE, feePaise: 2500, etaMinutes: 40 };

    it('creates an active area with a generated id', async () => {
      const area = await service.createArea(areaPayload);
      expect(area.id).toMatch(/^dar_[0-9a-f]{32}$/);
      expect(area.active).toBe(true);
      expect(area.feePaise).toBe(2500);
      expect(area.partnerId).toBeUndefined();
    });

    it('rejects a duplicate zone and partner key', async () => {
      await service.createArea(areaPayload);
      await expectError(service.createArea(areaPayload), 'CONFLICT');
    });

    it('keeps global and partner areas for the same zone distinct', async () => {
      const global = await service.createArea(areaPayload);
      const partner = await service.createArea({ ...areaPayload, partnerId: 'prt_1' });
      expect(partner.id).not.toBe(global.id);
      expect(partner.partnerId).toBe('prt_1');
    });

    it('returns 404 for an unknown area', async () => {
      await expectError(service.getArea(`dar_${'a'.repeat(32)}`), 'NOT_FOUND');
    });

    it('updates area fields and advances updatedAt', async () => {
      const created = await service.createArea(areaPayload);
      await new Promise((resolve) => setTimeout(resolve, 2));
      const updated = await service.updateArea(created.id, {
        feePaise: 3000,
        freeAbovePaise: 50000,
        active: false,
      });
      expect(updated.feePaise).toBe(3000);
      expect(updated.freeAbovePaise).toBe(50000);
      expect(updated.active).toBe(false);
      expect(updated.etaMinutes).toBe(40);
      expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    });

    it('rejects an empty area update', async () => {
      const created = await service.createArea(areaPayload);
      await expectError(service.updateArea(created.id, {}), 'VALIDATION_ERROR');
    });

    it('filters areas by zone, partner and active flag', async () => {
      await service.createArea(areaPayload);
      await service.createArea({ ...areaPayload, partnerId: 'prt_1' });
      await service.createArea({ zoneId: 'zone_north', feePaise: 1000, etaMinutes: 30 });
      expect(await service.listAreas({ zoneId: ZONE })).toHaveLength(2);
      expect(await service.listAreas({ partnerId: 'prt_1' })).toHaveLength(1);
      const inactive = await service.listAreas({ active: 'false' });
      expect(inactive).toHaveLength(0);
    });
  });

  describe('delivery slots', () => {
    const slotPayload = {
      zoneId: ZONE,
      date: '2026-10-01',
      startMinute: 540,
      endMinute: 600,
      capacity: 2,
    };

    it('creates a slot with zero reservations', async () => {
      const slot = await service.createSlot(slotPayload);
      expect(slot.id).toMatch(/^dsl_[0-9a-f]{32}$/);
      expect(slot.reserved).toBe(0);
      expect(slot.active).toBe(true);
    });

    it('rejects an end minute that is not after the start minute', async () => {
      await expectError(service.createSlot({ ...slotPayload, endMinute: 540 }), 'VALIDATION_ERROR');
      await expectError(service.createSlot({ ...slotPayload, endMinute: 300 }), 'VALIDATION_ERROR');
    });

    it('reserves and releases capacity', async () => {
      const slot = await service.createSlot(slotPayload);
      const reserved = await service.reserveSlot(slot.id, { quantity: 2 });
      expect(reserved.reserved).toBe(2);
      const released = await service.releaseSlot(slot.id, { quantity: 1 });
      expect(released.reserved).toBe(1);
    });

    it('defaults the reserve quantity to one', async () => {
      const slot = await service.createSlot(slotPayload);
      const reserved = await service.reserveSlot(slot.id, {});
      expect(reserved.reserved).toBe(1);
    });

    it('rejects a reservation beyond capacity', async () => {
      const slot = await service.createSlot(slotPayload);
      await service.reserveSlot(slot.id, { quantity: 2 });
      await expectError(service.reserveSlot(slot.id, { quantity: 1 }), 'CONFLICT');
    });

    it('rejects releasing more than reserved', async () => {
      const slot = await service.createSlot(slotPayload);
      await expectError(service.releaseSlot(slot.id, { quantity: 1 }), 'CONFLICT');
    });

    it('returns 404 for an unknown slot', async () => {
      await expectError(service.getSlot(`dsl_${'b'.repeat(32)}`), 'NOT_FOUND');
    });

    it('filters slots by zone and date', async () => {
      await service.createSlot(slotPayload);
      await service.createSlot({ ...slotPayload, date: '2026-10-02' });
      await service.createSlot({ ...slotPayload, zoneId: 'zone_north' });
      expect(await service.listSlots({ zoneId: ZONE })).toHaveLength(2);
      expect(await service.listSlots({ date: '2026-10-01' })).toHaveLength(2);
      expect(await service.listSlots({ zoneId: 'zone_north', date: '2026-10-01' })).toHaveLength(1);
    });
  });

  describe('deliveries', () => {
    const createSlot = () =>
      service.createSlot({
        zoneId: ZONE,
        date: '2026-10-01',
        startMinute: 540,
        endMinute: 600,
        capacity: 1,
      });

    it('creates a delivery in the created state', async () => {
      const delivery = await service.createDelivery({ orderId: ORDER_A });
      expect(delivery.id).toMatch(/^dlv_[0-9a-f]{32}$/);
      expect(delivery.state).toBe('created');
      expect(delivery.events).toEqual([]);
      expect(delivery.codCollected).toBe(false);
      expect(delivery.slotReleased).toBe(false);
    });

    it('hashes the OTP instead of storing it', async () => {
      const delivery = await service.createDelivery({ orderId: ORDER_A, otpCode: '4219' });
      expect(delivery.otpHash).toBeDefined();
      expect(delivery.otpHash).not.toBe('4219');
      expect(delivery.otpHash).toHaveLength(64);
    });

    it('rejects a second delivery for the same order', async () => {
      await service.createDelivery({ orderId: ORDER_A });
      await expectError(service.createDelivery({ orderId: ORDER_A }), 'CONFLICT');
    });

    it('reserves slot capacity when a slot is attached', async () => {
      const slot = await createSlot();
      await service.createDelivery({ orderId: ORDER_A, slotId: slot.id });
      const after = await service.getSlot(slot.id);
      expect(after.reserved).toBe(1);
    });

    it('rejects delivery creation when the slot is full', async () => {
      const slot = await createSlot();
      await service.createDelivery({ orderId: ORDER_A, slotId: slot.id });
      await expectError(service.createDelivery({ orderId: ORDER_B, slotId: slot.id }), 'CONFLICT');
      expect(await repo.findDeliveryByOrder(ORDER_B)).toBeNull();
    });

    it('returns 404 for an unknown slot on creation', async () => {
      await expectError(
        service.createDelivery({ orderId: ORDER_A, slotId: `dsl_${'c'.repeat(32)}` }),
        'NOT_FOUND',
      );
      expect(await repo.findDeliveryByOrder(ORDER_A)).toBeNull();
    });

    it('returns 404 for an unknown delivery', async () => {
      await expectError(service.getDelivery(`dlv_${'d'.repeat(32)}`), 'NOT_FOUND');
    });

    it('filters deliveries by order and state', async () => {
      await service.createDelivery({ orderId: ORDER_A });
      await service.createDelivery({ orderId: ORDER_B });
      expect(await service.listDeliveries({ orderId: ORDER_A })).toHaveLength(1);
      expect(await service.listDeliveries({ state: 'created' })).toHaveLength(2);
      expect(await service.listDeliveries({ state: 'delivered' })).toHaveLength(0);
    });

    it('walks the full lifecycle and records history', async () => {
      const delivery = await service.createDelivery({ orderId: ORDER_A });
      const path: DeliveryState[] = [
        'assigned',
        'arrived_at_pickup',
        'picked_up',
        'arrived_at_customer',
        'delivered',
        'completed',
      ];
      let current = delivery;
      for (const to of path) {
        current = await service.transition(delivery.id, { to });
      }
      expect(current.state).toBe('completed');
      expect(current.events).toHaveLength(6);
      expect(current.events[0]).toMatchObject({ from: 'created', to: 'assigned' });
      expect(current.events.at(-1)).toMatchObject({ from: 'delivered', to: 'completed' });
    });

    it('rejects a transition that is not in the state machine', async () => {
      const delivery = await service.createDelivery({ orderId: ORDER_A });
      await expectError(service.transition(delivery.id, { to: 'picked_up' }), 'CONFLICT');
      await expectError(service.transition(delivery.id, { to: 'completed' }), 'CONFLICT');
    });

    it('requires a reason when failing or cancelling', async () => {
      const delivery = await service.createDelivery({ orderId: ORDER_A });
      await expectError(service.transition(delivery.id, { to: 'failed' }), 'VALIDATION_ERROR');
      await expectError(service.transition(delivery.id, { to: 'cancelled' }), 'VALIDATION_ERROR');
      const cancelled = await service.transition(delivery.id, {
        to: 'cancelled',
        reason: 'customer cancelled',
      });
      expect(cancelled.state).toBe('cancelled');
      expect(cancelled.events[0]?.reason).toBe('customer cancelled');
    });

    it('verifies the customer OTP before marking delivered', async () => {
      const delivery = await service.createDelivery({ orderId: ORDER_A, otpCode: '4219' });
      await service.transition(delivery.id, { to: 'assigned' });
      await service.transition(delivery.id, { to: 'arrived_at_pickup' });
      await service.transition(delivery.id, { to: 'picked_up' });
      await service.transition(delivery.id, { to: 'arrived_at_customer' });
      await expectError(
        service.transition(delivery.id, { to: 'delivered', otpCode: '0000' }),
        'CONFLICT',
      );
      await expectError(service.transition(delivery.id, { to: 'delivered' }), 'CONFLICT');
      const delivered = await service.transition(delivery.id, { to: 'delivered', otpCode: '4219' });
      expect(delivered.state).toBe('delivered');
      expect(delivered.events.at(-1)?.otpVerified).toBe(true);
    });

    it('requires proof of delivery when configured', async () => {
      const delivery = await service.createDelivery({ orderId: ORDER_A, requirePod: true });
      await service.transition(delivery.id, { to: 'assigned' });
      await service.transition(delivery.id, { to: 'arrived_at_pickup' });
      await service.transition(delivery.id, { to: 'picked_up' });
      await service.transition(delivery.id, { to: 'arrived_at_customer' });
      await expectError(service.transition(delivery.id, { to: 'delivered' }), 'VALIDATION_ERROR');
      const delivered = await service.transition(delivery.id, {
        to: 'delivered',
        pod: { type: 'photo', ref: 'https://cdn.localwala.example/pod/1.jpg' },
      });
      expect(delivered.events.at(-1)?.pod).toEqual({
        type: 'photo',
        ref: 'https://cdn.localwala.example/pod/1.jpg',
      });
    });

    it('requires COD confirmation before delivered', async () => {
      const delivery = await service.createDelivery({ orderId: ORDER_A, codAmountPaise: 50000 });
      await service.transition(delivery.id, { to: 'assigned' });
      await service.transition(delivery.id, { to: 'arrived_at_pickup' });
      await service.transition(delivery.id, { to: 'picked_up' });
      await service.transition(delivery.id, { to: 'arrived_at_customer' });
      await expectError(service.transition(delivery.id, { to: 'delivered' }), 'VALIDATION_ERROR');
      const delivered = await service.transition(delivery.id, {
        to: 'delivered',
        codCollected: true,
      });
      expect(delivered.codCollected).toBe(true);
      expect(delivered.events.at(-1)?.codCollected).toBe(true);
    });

    it('releases the slot reservation when a delivery fails', async () => {
      const slot = await createSlot();
      const delivery = await service.createDelivery({ orderId: ORDER_A, slotId: slot.id });
      expect((await service.getSlot(slot.id)).reserved).toBe(1);
      await service.transition(delivery.id, { to: 'assigned' });
      const failed = await service.transition(delivery.id, {
        to: 'failed',
        reason: 'customer unreachable',
      });
      expect(failed.slotReleased).toBe(true);
      expect((await service.getSlot(slot.id)).reserved).toBe(0);
    });

    it('keeps the slot reservation after successful completion', async () => {
      const slot = await createSlot();
      const delivery = await service.createDelivery({ orderId: ORDER_A, slotId: slot.id });
      await service.transition(delivery.id, { to: 'assigned' });
      await service.transition(delivery.id, { to: 'arrived_at_pickup' });
      await service.transition(delivery.id, { to: 'picked_up' });
      await service.transition(delivery.id, { to: 'arrived_at_customer' });
      await service.transition(delivery.id, { to: 'delivered' });
      await service.transition(delivery.id, { to: 'completed' });
      expect((await service.getSlot(slot.id)).reserved).toBe(1);
      expect((await service.getDelivery(delivery.id)).slotReleased).toBe(false);
    });

    it('serialises racing transitions so exactly one wins', async () => {
      const delivery = await service.createDelivery({ orderId: ORDER_A });
      const results = await Promise.allSettled([
        service.transition(delivery.id, { to: 'assigned' }),
        service.transition(delivery.id, { to: 'assigned' }),
      ]);
      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT' });
    });

    it('serialises racing slot reservations at the capacity boundary', async () => {
      const slot = await createSlot();
      const results = await Promise.allSettled([
        service.reserveSlot(slot.id, { quantity: 1 }),
        service.reserveSlot(slot.id, { quantity: 1 }),
      ]);
      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((await service.getSlot(slot.id)).reserved).toBe(1);
    });

    it('returns delivery history', async () => {
      const delivery = await service.createDelivery({ orderId: ORDER_A });
      await service.transition(delivery.id, { to: 'assigned' });
      const history = await service.getHistory(delivery.id);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ from: 'created', to: 'assigned' });
      await expectError(service.getHistory(`dlv_${'e'.repeat(32)}`), 'NOT_FOUND');
    });
  });
});

describe('staging delivery repository', () => {
  const repo = new StagingDeliveryRepository();
  const expectBlocked = async (operation: Promise<unknown>) => {
    const error = await operation.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('SERVICE_UNAVAILABLE');
    expect((error as AppError).message).toContain('PostgreSQL not available');
  };

  it('blocks area, slot and delivery operations', async () => {
    await expectBlocked(repo.saveArea({} as DeliveryArea));
    await expectBlocked(repo.findArea('dar_x'));
    await expectBlocked(repo.findAreaByKey('zone_central'));
    await expectBlocked(repo.listAreas({}));
    await expectBlocked(repo.saveSlot({} as DeliverySlot));
    await expectBlocked(repo.findSlot('dsl_x'));
    await expectBlocked(repo.listSlots({}));
    await expectBlocked(repo.saveDelivery({} as Delivery));
    await expectBlocked(repo.findDelivery('dlv_x'));
    await expectBlocked(repo.findDeliveryByOrder('ord_x'));
    await expectBlocked(repo.listDeliveries({}));
  });
});
