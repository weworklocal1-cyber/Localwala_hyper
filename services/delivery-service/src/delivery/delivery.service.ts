import { AppError } from '@localwala/errors';
import type { DeliveryRepository } from './delivery.repository.js';
import { KeyedMutex } from './keyed-mutex.js';
import {
  DELIVERY_STATES,
  DELIVERY_TRANSITIONS,
  hashOtp,
  newAreaId,
  newDeliveryId,
  newEventId,
  newSlotId,
  type Delivery,
  type DeliveryArea,
  type DeliverySlot,
  type DeliveryState,
} from './delivery.types.js';
import {
  parseCreateArea,
  parseCreateDelivery,
  parseCreateSlot,
  parseListAreas,
  parseListDeliveries,
  parseListSlots,
  parseReserveSlot,
  parseTransition,
  parseUpdateArea,
} from '../schemas/delivery.schema.js';

export class DeliveryService {
  private readonly mutex = new KeyedMutex();

  constructor(private readonly repo: DeliveryRepository) {}

  async createArea(input: unknown): Promise<DeliveryArea> {
    const parsed = parseCreateArea(input);
    return this.mutex.run(`area:${parsed.zoneId}:${parsed.partnerId ?? 'global'}`, async () => {
      const existing = await this.repo.findAreaByKey(parsed.zoneId, parsed.partnerId);
      if (existing) {
        throw new AppError('CONFLICT', {
          message: 'A delivery area already exists for this zone and partner.',
          details: { zoneId: parsed.zoneId, partnerId: parsed.partnerId ?? null },
        });
      }
      const now = Date.now();
      const area: DeliveryArea = {
        id: newAreaId(),
        zoneId: parsed.zoneId,
        feePaise: parsed.feePaise,
        etaMinutes: parsed.etaMinutes,
        active: parsed.active ?? true,
        createdAt: now,
        updatedAt: now,
      };
      if (parsed.partnerId !== undefined) area.partnerId = parsed.partnerId;
      if (parsed.freeAbovePaise !== undefined) area.freeAbovePaise = parsed.freeAbovePaise;
      if (parsed.maxDistanceKm !== undefined) area.maxDistanceKm = parsed.maxDistanceKm;
      await this.repo.saveArea(area);
      return area;
    });
  }

  async getArea(areaId: string): Promise<DeliveryArea> {
    const area = await this.repo.findArea(areaId);
    if (!area) {
      throw new AppError('NOT_FOUND', { message: 'Delivery area not found.' });
    }
    return area;
  }

  async listAreas(query: unknown): Promise<DeliveryArea[]> {
    const parsed = parseListAreas(query);
    return this.repo.listAreas({
      ...(parsed.zoneId !== undefined ? { zoneId: parsed.zoneId } : {}),
      ...(parsed.partnerId !== undefined ? { partnerId: parsed.partnerId } : {}),
      ...(parsed.active !== undefined ? { active: parsed.active === 'true' } : {}),
    });
  }

  async updateArea(areaId: string, input: unknown): Promise<DeliveryArea> {
    const parsed = parseUpdateArea(input);
    const area = await this.getArea(areaId);
    if (parsed.feePaise !== undefined) area.feePaise = parsed.feePaise;
    if (parsed.freeAbovePaise !== undefined) area.freeAbovePaise = parsed.freeAbovePaise;
    if (parsed.etaMinutes !== undefined) area.etaMinutes = parsed.etaMinutes;
    if (parsed.active !== undefined) area.active = parsed.active;
    area.updatedAt = Date.now();
    await this.repo.saveArea(area);
    return area;
  }

  async createSlot(input: unknown): Promise<DeliverySlot> {
    const parsed = parseCreateSlot(input);
    if (parsed.endMinute <= parsed.startMinute) {
      throw new AppError('VALIDATION_ERROR', {
        message: 'Request payload failed validation',
        details: [{ path: 'endMinute', message: 'must be greater than startMinute' }],
      });
    }
    const now = Date.now();
    const slot: DeliverySlot = {
      id: newSlotId(),
      zoneId: parsed.zoneId,
      date: parsed.date,
      startMinute: parsed.startMinute,
      endMinute: parsed.endMinute,
      capacity: parsed.capacity,
      reserved: 0,
      active: parsed.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.saveSlot(slot);
    return slot;
  }

  async getSlot(slotId: string): Promise<DeliverySlot> {
    const slot = await this.repo.findSlot(slotId);
    if (!slot) {
      throw new AppError('NOT_FOUND', { message: 'Delivery slot not found.' });
    }
    return slot;
  }

  async listSlots(query: unknown): Promise<DeliverySlot[]> {
    const parsed = parseListSlots(query);
    return this.repo.listSlots({
      ...(parsed.zoneId !== undefined ? { zoneId: parsed.zoneId } : {}),
      ...(parsed.date !== undefined ? { date: parsed.date } : {}),
      ...(parsed.active !== undefined ? { active: parsed.active === 'true' } : {}),
    });
  }

  async reserveSlot(slotId: string, input: unknown): Promise<DeliverySlot> {
    const parsed = parseReserveSlot(input);
    return this.mutex.run(`slot:${slotId}`, async () => {
      const slot = await this.requireSlot(slotId);
      if (slot.reserved + parsed.quantity > slot.capacity) {
        throw new AppError('CONFLICT', {
          message: 'Delivery slot capacity exceeded.',
          details: { capacity: slot.capacity, reserved: slot.reserved },
        });
      }
      slot.reserved += parsed.quantity;
      slot.updatedAt = Date.now();
      await this.repo.saveSlot(slot);
      return slot;
    });
  }

  async releaseSlot(slotId: string, input: unknown): Promise<DeliverySlot> {
    const parsed = parseReserveSlot(input);
    return this.mutex.run(`slot:${slotId}`, async () => {
      const slot = await this.requireSlot(slotId);
      if (slot.reserved - parsed.quantity < 0) {
        throw new AppError('CONFLICT', {
          message: 'Cannot release more reservations than exist.',
          details: { reserved: slot.reserved },
        });
      }
      slot.reserved -= parsed.quantity;
      slot.updatedAt = Date.now();
      await this.repo.saveSlot(slot);
      return slot;
    });
  }

  async createDelivery(input: unknown): Promise<Delivery> {
    const parsed = parseCreateDelivery(input);
    return this.mutex.run(`delivery:order:${parsed.orderId}`, async () => {
      const existing = await this.repo.findDeliveryByOrder(parsed.orderId);
      if (existing) {
        throw new AppError('CONFLICT', {
          message: 'A delivery already exists for this order.',
          details: { orderId: parsed.orderId },
        });
      }
      if (parsed.slotId !== undefined) {
        await this.mutex.run(`slot:${parsed.slotId}`, async () => {
          const slot = await this.requireSlot(parsed.slotId!);
          if (!slot.active) {
            throw new AppError('CONFLICT', { message: 'Delivery slot is not active.' });
          }
          if (slot.reserved + 1 > slot.capacity) {
            throw new AppError('CONFLICT', {
              message: 'Delivery slot capacity exceeded.',
              details: { capacity: slot.capacity, reserved: slot.reserved },
            });
          }
          slot.reserved += 1;
          slot.updatedAt = Date.now();
          await this.repo.saveSlot(slot);
        });
      }
      const now = Date.now();
      const delivery: Delivery = {
        id: newDeliveryId(),
        orderId: parsed.orderId,
        slotReleased: false,
        state: 'created',
        requirePod: parsed.requirePod ?? false,
        codAmountPaise: parsed.codAmountPaise ?? 0,
        codCollected: false,
        events: [],
        createdAt: now,
        updatedAt: now,
      };
      if (parsed.slotId !== undefined) delivery.slotId = parsed.slotId;
      if (parsed.otpCode !== undefined) delivery.otpHash = hashOtp(parsed.otpCode);
      await this.repo.saveDelivery(delivery);
      return delivery;
    });
  }

  async getDelivery(deliveryId: string): Promise<Delivery> {
    return this.requireDelivery(deliveryId);
  }

  async listDeliveries(query: unknown): Promise<Delivery[]> {
    const parsed = parseListDeliveries(query);
    const deliveries = await this.repo.listDeliveries({
      ...(parsed.orderId !== undefined ? { orderId: parsed.orderId } : {}),
      ...(parsed.state !== undefined ? { state: parsed.state } : {}),
      limit: parsed.limit,
    });
    return deliveries.slice(0, parsed.limit);
  }

  async transition(deliveryId: string, input: unknown): Promise<Delivery> {
    const parsed = parseTransition(input);
    if ((parsed.to === 'failed' || parsed.to === 'cancelled') && parsed.reason === undefined) {
      throw new AppError('VALIDATION_ERROR', {
        message: 'Request payload failed validation',
        details: [
          { path: 'reason', message: `reason is required when transitioning to ${parsed.to}` },
        ],
      });
    }
    return this.mutex.run(`delivery:${deliveryId}`, async () => {
      const delivery = await this.requireDelivery(deliveryId);
      const allowed = DELIVERY_TRANSITIONS[delivery.state];
      if (!allowed.includes(parsed.to)) {
        throw new AppError('CONFLICT', {
          message: `Cannot transition delivery from "${delivery.state}" to "${parsed.to}".`,
          details: { state: delivery.state, to: parsed.to },
        });
      }

      let otpVerified: boolean | undefined;
      if (parsed.to === 'delivered') {
        if (delivery.otpHash !== undefined) {
          if (parsed.otpCode === undefined || hashOtp(parsed.otpCode) !== delivery.otpHash) {
            throw new AppError('CONFLICT', {
              message: 'Customer OTP verification failed.',
              details: { deliveryId },
            });
          }
          otpVerified = true;
        }
        if (delivery.requirePod && parsed.pod === undefined) {
          throw new AppError('VALIDATION_ERROR', {
            message: 'Request payload failed validation',
            details: [{ path: 'pod', message: 'proof of delivery is required for this delivery' }],
          });
        }
        if (delivery.codAmountPaise > 0 && parsed.codCollected !== true) {
          throw new AppError('VALIDATION_ERROR', {
            message: 'Request payload failed validation',
            details: [
              {
                path: 'codCollected',
                message: 'COD collection must be confirmed before completing delivery',
              },
            ],
          });
        }
      }

      const previous = delivery.state;
      delivery.state = parsed.to;
      delivery.updatedAt = Date.now();
      if (parsed.to === 'delivered' && parsed.codCollected === true) {
        delivery.codCollected = true;
      }
      const event: Delivery['events'][number] = {
        id: newEventId(),
        deliveryId,
        from: previous,
        to: parsed.to,
        at: delivery.updatedAt,
      };
      if (parsed.reason !== undefined) event.reason = parsed.reason;
      if (otpVerified !== undefined) event.otpVerified = otpVerified;
      if (parsed.pod !== undefined) event.pod = parsed.pod;
      if (parsed.codCollected !== undefined) event.codCollected = parsed.codCollected;
      delivery.events.push(event);

      if (
        (parsed.to === 'cancelled' || parsed.to === 'failed') &&
        delivery.slotId &&
        !delivery.slotReleased
      ) {
        await this.mutex.run(`slot:${delivery.slotId}`, async () => {
          const slot = await this.repo.findSlot(delivery.slotId!);
          if (slot && slot.reserved > 0) {
            slot.reserved -= 1;
            slot.updatedAt = Date.now();
            await this.repo.saveSlot(slot);
          }
        });
        delivery.slotReleased = true;
      }

      await this.repo.saveDelivery(delivery);
      return delivery;
    });
  }

  async getHistory(deliveryId: string): Promise<Delivery['events']> {
    const delivery = await this.requireDelivery(deliveryId);
    return delivery.events;
  }

  private async requireSlot(slotId: string): Promise<DeliverySlot> {
    const slot = await this.repo.findSlot(slotId);
    if (!slot) {
      throw new AppError('NOT_FOUND', { message: 'Delivery slot not found.' });
    }
    return slot;
  }

  private async requireDelivery(deliveryId: string): Promise<Delivery> {
    const delivery = await this.repo.findDelivery(deliveryId);
    if (!delivery) {
      throw new AppError('NOT_FOUND', { message: 'Delivery not found.' });
    }
    return delivery;
  }
}

export function isDeliveryState(value: string): value is DeliveryState {
  return (DELIVERY_STATES as readonly string[]).includes(value);
}
