import { AppError } from '@localwala/errors';
import type { Reservation, StockRecord } from './inventory.types.js';

export interface InventoryRepository {
  saveStock(stock: StockRecord): Promise<void>;
  findStockBySku(sku: string): Promise<StockRecord | null>;
  listStock(): Promise<StockRecord[]>;
  saveReservation(reservation: Reservation): Promise<void>;
  findReservationByKey(key: string): Promise<Reservation | null>;
  listReservations(): Promise<Reservation[]>;
}

/**
 * STAGING ONLY — PostgreSQL repository not implemented yet.
 * Throws SERVICE_UNAVAILABLE (503) on every operation (specification section 1).
 */
export class StagingInventoryRepository implements InventoryRepository {
  async saveStock(): Promise<void> {
    this.blocked('saveStock');
  }
  async findStockBySku(): Promise<null> {
    this.blocked('findStockBySku');
    return null;
  }
  async listStock(): Promise<[]> {
    this.blocked('listStock');
    return [];
  }
  async saveReservation(): Promise<void> {
    this.blocked('saveReservation');
  }
  async findReservationByKey(): Promise<null> {
    this.blocked('findReservationByKey');
    return null;
  }
  async listReservations(): Promise<[]> {
    this.blocked('listReservations');
    return [];
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Inventory repository not configured: ${op} blocked — PostgreSQL not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
