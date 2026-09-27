import { randomUUID } from 'node:crypto';

export const RESERVATION_STATES = ['reserved', 'released', 'committed'] as const;
export type ReservationState = (typeof RESERVATION_STATES)[number];

export interface StockRecord {
  id: string;
  sku: string;
  physical: number;
  reserved: number;
  createdAt: number;
  updatedAt: number;
}

export interface StockView extends StockRecord {
  sellable: number;
}

export interface Reservation {
  key: string;
  sku: string;
  qty: number;
  state: ReservationState;
  createdAt: number;
  updatedAt: number;
}

export const SKU_PATTERN = '^[A-Za-z0-9._-]{1,64}$';
export const RESERVATION_KEY_PATTERN = '^[A-Za-z0-9._:-]{1,128}$';

export function toStockView(stock: StockRecord): StockView {
  return { ...stock, sellable: stock.physical - stock.reserved };
}

export function newStockId(): string {
  return `stk_${randomUUID().replace(/-/g, '')}`;
}
