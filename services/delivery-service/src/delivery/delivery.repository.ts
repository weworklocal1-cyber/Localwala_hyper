import { AppError } from '@localwala/errors';
import type { Delivery, DeliveryArea, DeliverySlot, DeliveryState } from './delivery.types.js';

export interface DeliveryAreaQuery {
  zoneId?: string;
  partnerId?: string;
  active?: boolean;
}

export interface SlotQuery {
  zoneId?: string;
  date?: string;
  active?: boolean;
}

export interface DeliveryQuery {
  orderId?: string;
  state?: DeliveryState;
  limit?: number;
}

export interface DeliveryRepository {
  saveArea(area: DeliveryArea): Promise<void>;
  findArea(areaId: string): Promise<DeliveryArea | null>;
  findAreaByKey(zoneId: string, partnerId?: string): Promise<DeliveryArea | null>;
  listAreas(query: DeliveryAreaQuery): Promise<DeliveryArea[]>;
  saveSlot(slot: DeliverySlot): Promise<void>;
  findSlot(slotId: string): Promise<DeliverySlot | null>;
  listSlots(query: SlotQuery): Promise<DeliverySlot[]>;
  saveDelivery(delivery: Delivery): Promise<void>;
  findDelivery(deliveryId: string): Promise<Delivery | null>;
  findDeliveryByOrder(orderId: string): Promise<Delivery | null>;
  listDeliveries(query: DeliveryQuery): Promise<Delivery[]>;
}

/**
 * STAGING ONLY — PostgreSQL delivery store not implemented yet.
 * Throws SERVICE_UNAVAILABLE (503) on every operation (specification section 1).
 */
export class StagingDeliveryRepository implements DeliveryRepository {
  async saveArea(): Promise<void> {
    this.blocked('saveArea');
  }
  async findArea(): Promise<null> {
    this.blocked('findArea');
    return null;
  }
  async findAreaByKey(): Promise<null> {
    this.blocked('findAreaByKey');
    return null;
  }
  async listAreas(): Promise<[]> {
    this.blocked('listAreas');
    return [];
  }
  async saveSlot(): Promise<void> {
    this.blocked('saveSlot');
  }
  async findSlot(): Promise<null> {
    this.blocked('findSlot');
    return null;
  }
  async listSlots(): Promise<[]> {
    this.blocked('listSlots');
    return [];
  }
  async saveDelivery(): Promise<void> {
    this.blocked('saveDelivery');
  }
  async findDelivery(): Promise<null> {
    this.blocked('findDelivery');
    return null;
  }
  async findDeliveryByOrder(): Promise<null> {
    this.blocked('findDeliveryByOrder');
    return null;
  }
  async listDeliveries(): Promise<[]> {
    this.blocked('listDeliveries');
    return [];
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Delivery repository not configured: ${op} blocked — PostgreSQL not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
