import { AppError } from '@localwala/errors';
import {
  parseAdjustStock,
  parseCreateReservation,
  parseCreateStock,
  parsePatchStock,
} from '../schemas/inventory.schema.js';
import type { InventoryRepository } from './inventory.repository.js';
import { KeyedMutex } from './keyed-mutex.js';
import {
  newStockId,
  toStockView,
  type Reservation,
  type ReservationState,
  type StockRecord,
  type StockView,
} from './inventory.types.js';

export interface StockListFilter {
  q?: string;
  limit?: number;
}

export interface ReservationListFilter {
  sku?: string;
  state?: ReservationState;
  limit?: number;
}

export interface ReservationResult {
  reservation: Reservation;
  stock: StockView;
}

export class InventoryService {
  private readonly mutex = new KeyedMutex();

  constructor(private readonly repo: InventoryRepository) {}

  async createStock(input: unknown): Promise<StockView> {
    const parsed = parseCreateStock(input);
    return this.mutex.run(`stock:${parsed.sku}`, async () => {
      const existing = await this.repo.findStockBySku(parsed.sku);
      if (existing) {
        throw new AppError('CONFLICT', {
          message: `Stock for SKU "${parsed.sku}" already exists`,
        });
      }
      const now = Date.now();
      const stock: StockRecord = {
        id: newStockId(),
        sku: parsed.sku,
        physical: parsed.physical,
        reserved: 0,
        createdAt: now,
        updatedAt: now,
      };
      await this.repo.saveStock(stock);
      return toStockView(stock);
    });
  }

  async getStock(sku: string): Promise<StockView> {
    const stock = await this.repo.findStockBySku(sku);
    if (!stock) {
      throw new AppError('NOT_FOUND', { message: `Stock for SKU "${sku}" not found` });
    }
    return toStockView(stock);
  }

  async listStock(filter: StockListFilter = {}): Promise<StockView[]> {
    const records = await this.repo.listStock();
    const query = filter.q?.toLowerCase();
    return records
      .filter((record) => query === undefined || record.sku.toLowerCase().includes(query))
      .sort((a, b) => a.sku.localeCompare(b.sku))
      .slice(0, filter.limit ?? 50)
      .map(toStockView);
  }

  async patchStock(sku: string, input: unknown): Promise<StockView> {
    const parsed = parsePatchStock(input);
    return this.mutex.run(`stock:${sku}`, async () => {
      const stock = await this.requireStock(sku);
      if (parsed.physical < stock.reserved) {
        throw new AppError('CONFLICT', {
          message: `physical (${parsed.physical}) cannot fall below reserved (${stock.reserved})`,
        });
      }
      stock.physical = parsed.physical;
      stock.updatedAt = Date.now();
      await this.repo.saveStock(stock);
      return toStockView(stock);
    });
  }

  async adjustStock(sku: string, input: unknown): Promise<StockView> {
    const parsed = parseAdjustStock(input);
    return this.mutex.run(`stock:${sku}`, async () => {
      const stock = await this.requireStock(sku);
      const physical = stock.physical + parsed.delta;
      if (physical < 0) {
        throw new AppError('CONFLICT', {
          message: `adjustment would drive physical below zero (physical ${stock.physical}, delta ${parsed.delta})`,
        });
      }
      if (physical < stock.reserved) {
        throw new AppError('CONFLICT', {
          message: `adjustment would drive physical (${physical}) below reserved (${stock.reserved})`,
        });
      }
      stock.physical = physical;
      stock.updatedAt = Date.now();
      await this.repo.saveStock(stock);
      return toStockView(stock);
    });
  }

  async createReservation(input: unknown): Promise<ReservationResult> {
    const parsed = parseCreateReservation(input);
    return this.mutex.run(`stock:${parsed.sku}`, async () => {
      const existing = await this.repo.findReservationByKey(parsed.key);
      if (existing) {
        if (existing.sku !== parsed.sku || existing.qty !== parsed.qty) {
          throw new AppError('CONFLICT', {
            message: `Reservation key "${parsed.key}" already used for a different reservation`,
          });
        }
        if (existing.state !== 'reserved') {
          throw new AppError('CONFLICT', {
            message: `Reservation key "${parsed.key}" is already ${existing.state}`,
          });
        }
        const stock = await this.requireStock(parsed.sku);
        return { reservation: existing, stock: toStockView(stock) };
      }
      const stock = await this.requireStock(parsed.sku);
      const sellable = stock.physical - stock.reserved;
      if (sellable < parsed.qty) {
        throw new AppError('CONFLICT', {
          message: `Insufficient sellable stock for SKU "${parsed.sku}" (sellable ${sellable}, requested ${parsed.qty})`,
        });
      }
      const now = Date.now();
      const reservation: Reservation = {
        key: parsed.key,
        sku: parsed.sku,
        qty: parsed.qty,
        state: 'reserved',
        createdAt: now,
        updatedAt: now,
      };
      stock.reserved += parsed.qty;
      stock.updatedAt = now;
      await this.repo.saveStock(stock);
      await this.repo.saveReservation(reservation);
      return { reservation, stock: toStockView(stock) };
    });
  }

  async getReservation(key: string): Promise<Reservation> {
    const reservation = await this.repo.findReservationByKey(key);
    if (!reservation) {
      throw new AppError('NOT_FOUND', { message: `Reservation "${key}" not found` });
    }
    return reservation;
  }

  async listReservations(filter: ReservationListFilter = {}): Promise<Reservation[]> {
    const reservations = await this.repo.listReservations();
    return reservations
      .filter(
        (reservation) =>
          (filter.sku === undefined || reservation.sku === filter.sku) &&
          (filter.state === undefined || reservation.state === filter.state),
      )
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(0, filter.limit ?? 50);
  }

  async releaseReservation(key: string): Promise<ReservationResult> {
    const initial = await this.getReservation(key);
    return this.mutex.run(`stock:${initial.sku}`, async () => {
      const reservation = await this.requireReservation(key);
      if (reservation.state !== 'reserved') {
        throw new AppError('CONFLICT', {
          message: `Reservation "${key}" is already ${reservation.state}`,
        });
      }
      const stock = await this.requireStock(reservation.sku);
      stock.reserved -= reservation.qty;
      reservation.state = 'released';
      reservation.updatedAt = Date.now();
      stock.updatedAt = reservation.updatedAt;
      await this.repo.saveStock(stock);
      await this.repo.saveReservation(reservation);
      return { reservation, stock: toStockView(stock) };
    });
  }

  async commitReservation(key: string): Promise<ReservationResult> {
    const initial = await this.getReservation(key);
    return this.mutex.run(`stock:${initial.sku}`, async () => {
      const reservation = await this.requireReservation(key);
      if (reservation.state !== 'reserved') {
        throw new AppError('CONFLICT', {
          message: `Reservation "${key}" is already ${reservation.state}`,
        });
      }
      const stock = await this.requireStock(reservation.sku);
      stock.reserved -= reservation.qty;
      stock.physical -= reservation.qty;
      reservation.state = 'committed';
      reservation.updatedAt = Date.now();
      stock.updatedAt = reservation.updatedAt;
      await this.repo.saveStock(stock);
      await this.repo.saveReservation(reservation);
      return { reservation, stock: toStockView(stock) };
    });
  }

  private async requireStock(sku: string): Promise<StockRecord> {
    const stock = await this.repo.findStockBySku(sku);
    if (!stock) {
      throw new AppError('NOT_FOUND', { message: `Stock for SKU "${sku}" not found` });
    }
    return stock;
  }

  private async requireReservation(key: string): Promise<Reservation> {
    const reservation = await this.repo.findReservationByKey(key);
    if (!reservation) {
      throw new AppError('NOT_FOUND', { message: `Reservation "${key}" not found` });
    }
    return reservation;
  }
}
