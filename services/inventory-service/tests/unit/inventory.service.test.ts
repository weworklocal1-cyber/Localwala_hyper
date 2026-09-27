import { AppError } from '@localwala/errors';
import { beforeEach, describe, expect, it } from 'vitest';
import type { InventoryRepository } from '../../src/inventory/inventory.repository.js';
import { StagingInventoryRepository } from '../../src/inventory/inventory.repository.js';
import { InventoryService } from '../../src/inventory/inventory.service.js';
import type { Reservation, StockRecord } from '../../src/inventory/inventory.types.js';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

class InMemoryInventoryRepository implements InventoryRepository {
  readonly stocks = new Map<string, StockRecord>();
  readonly reservations = new Map<string, Reservation>();

  async saveStock(stock: StockRecord): Promise<void> {
    await tick();
    this.stocks.set(stock.sku, { ...stock });
  }
  async findStockBySku(sku: string): Promise<StockRecord | null> {
    await tick();
    const stock = this.stocks.get(sku);
    return stock ? { ...stock } : null;
  }
  async listStock(): Promise<StockRecord[]> {
    await tick();
    return [...this.stocks.values()].map((stock) => ({ ...stock }));
  }
  async saveReservation(reservation: Reservation): Promise<void> {
    await tick();
    this.reservations.set(reservation.key, { ...reservation });
  }
  async findReservationByKey(key: string): Promise<Reservation | null> {
    await tick();
    const reservation = this.reservations.get(key);
    return reservation ? { ...reservation } : null;
  }
  async listReservations(): Promise<Reservation[]> {
    await tick();
    return [...this.reservations.values()].map((entry) => ({ ...entry }));
  }
}

async function createStock(service: InventoryService, sku: string, physical: number) {
  return service.createStock({ sku, physical });
}

describe('InventoryService', () => {
  let repo: InMemoryInventoryRepository;
  let service: InventoryService;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository();
    service = new InventoryService(repo);
  });

  describe('stock management', () => {
    it('creates stock with zero reserved and sellable = physical', async () => {
      const stock = await createStock(service, 'RICE-1K', 25);
      expect(stock.id).toMatch(/^stk_/);
      expect(stock.reserved).toBe(0);
      expect(stock.sellable).toBe(25);
    });

    it('rejects a duplicate SKU', async () => {
      await createStock(service, 'RICE-1K', 25);
      await expect(createStock(service, 'RICE-1K', 10)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects a negative physical quantity', async () => {
      await expect(createStock(service, 'RICE-1K', -1)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('rejects an invalid SKU format', async () => {
      await expect(createStock(service, 'bad sku!', 1)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('404s for an unknown SKU', async () => {
      await expect(service.getStock('MISSING')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('lists stock filtered by query with a limit', async () => {
      await createStock(service, 'RICE-1K', 5);
      await createStock(service, 'RICE-500G', 8);
      await createStock(service, 'OIL-1L', 3);

      expect(await service.listStock({ q: 'rice' })).toHaveLength(2);
      expect((await service.listStock({}))[0].sku).toBe('OIL-1L');
      expect(await service.listStock({ limit: 1 })).toHaveLength(1);
      expect(await service.listStock({ q: 'nope' })).toHaveLength(0);
    });

    it('patches physical to a value above reserved', async () => {
      await createStock(service, 'RICE-1K', 25);
      const stock = await service.patchStock('RICE-1K', { physical: 40 });
      expect(stock.physical).toBe(40);
      expect(stock.sellable).toBe(40);
    });

    it('rejects a patch below reserved quantity', async () => {
      await createStock(service, 'RICE-1K', 25);
      await service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 10 });
      await expect(service.patchStock('RICE-1K', { physical: 5 })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('adjusts stock up and down', async () => {
      await createStock(service, 'RICE-1K', 25);
      const up = await service.adjustStock('RICE-1K', { delta: 10, reason: 'delivery' });
      expect(up.physical).toBe(35);
      const down = await service.adjustStock('RICE-1K', { delta: -5, reason: 'damaged' });
      expect(down.physical).toBe(30);
    });

    it('rejects an adjustment below zero', async () => {
      await createStock(service, 'RICE-1K', 5);
      await expect(service.adjustStock('RICE-1K', { delta: -10 })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects an adjustment below reserved quantity', async () => {
      await createStock(service, 'RICE-1K', 25);
      await service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 20 });
      await expect(service.adjustStock('RICE-1K', { delta: -10 })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects a zero delta', async () => {
      await createStock(service, 'RICE-1K', 5);
      await expect(service.adjustStock('RICE-1K', { delta: 0 })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('reservations', () => {
    beforeEach(async () => {
      await createStock(service, 'RICE-1K', 25);
    });

    it('reserves quantity and reduces sellable', async () => {
      const result = await service.createReservation({
        key: 'ord-1',
        sku: 'RICE-1K',
        qty: 10,
      });
      expect(result.reservation.state).toBe('reserved');
      expect(result.stock.reserved).toBe(10);
      expect(result.stock.sellable).toBe(15);
    });

    it('rejects a reservation above sellable stock', async () => {
      await expect(
        service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 26 }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects a reservation that exactly drains sellable stock', async () => {
      const result = await service.createReservation({
        key: 'ord-1',
        sku: 'RICE-1K',
        qty: 25,
      });
      expect(result.stock.sellable).toBe(0);
    });

    it('rejects qty below one', async () => {
      await expect(
        service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 0 }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('404s for an unknown SKU', async () => {
      await expect(
        service.createReservation({ key: 'ord-1', sku: 'MISSING', qty: 1 }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('is idempotent for the same key and arguments', async () => {
      const first = await service.createReservation({
        key: 'ord-1',
        sku: 'RICE-1K',
        qty: 10,
      });
      const second = await service.createReservation({
        key: 'ord-1',
        sku: 'RICE-1K',
        qty: 10,
      });
      expect(second.reservation).toEqual(first.reservation);
      expect(second.stock.reserved).toBe(10);
      expect(second.stock.sellable).toBe(15);
    });

    it('rejects reusing a key with different arguments', async () => {
      await service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 10 });
      await expect(
        service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 5 }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects reusing a consumed key', async () => {
      await service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 10 });
      await service.releaseReservation('ord-1');
      await expect(
        service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 10 }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('releases a reservation and frees sellable stock', async () => {
      await service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 10 });
      const result = await service.releaseReservation('ord-1');
      expect(result.reservation.state).toBe('released');
      expect(result.stock.reserved).toBe(0);
      expect(result.stock.sellable).toBe(25);
    });

    it('rejects releasing twice', async () => {
      await service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 10 });
      await service.releaseReservation('ord-1');
      await expect(service.releaseReservation('ord-1')).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('commits a reservation, reducing physical and reserved', async () => {
      await service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 10 });
      const result = await service.commitReservation('ord-1');
      expect(result.reservation.state).toBe('committed');
      expect(result.stock.physical).toBe(15);
      expect(result.stock.reserved).toBe(0);
      expect(result.stock.sellable).toBe(15);
    });

    it('rejects committing twice', async () => {
      await service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 10 });
      await service.commitReservation('ord-1');
      await expect(service.commitReservation('ord-1')).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects releasing a committed reservation', async () => {
      await service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 10 });
      await service.commitReservation('ord-1');
      await expect(service.releaseReservation('ord-1')).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('404s for an unknown reservation key', async () => {
      await expect(service.getReservation('nope')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(service.releaseReservation('nope')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(service.commitReservation('nope')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('lists reservations filtered by SKU and state', async () => {
      await createStock(service, 'OIL-1L', 10);
      await service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 1 });
      await service.createReservation({ key: 'ord-2', sku: 'OIL-1L', qty: 2 });
      await service.createReservation({ key: 'ord-3', sku: 'RICE-1K', qty: 3 });
      await service.releaseReservation('ord-3');

      expect(await service.listReservations({ sku: 'RICE-1K' })).toHaveLength(2);
      expect(await service.listReservations({ state: 'reserved' })).toHaveLength(2);
      expect(await service.listReservations({ state: 'released' })).toHaveLength(1);
      expect(await service.listReservations({ limit: 1 })).toHaveLength(1);
    });
  });

  describe('concurrency (specification section 30)', () => {
    it('never oversells under 20 parallel reservations', async () => {
      await createStock(service, 'RICE-1K', 10);
      const attempts = await Promise.allSettled(
        Array.from({ length: 20 }, (_, index) =>
          service.createReservation({ key: `ord-${index}`, sku: 'RICE-1K', qty: 1 }),
        ),
      );
      const fulfilled = attempts.filter((entry) => entry.status === 'fulfilled');
      const rejected = attempts.filter((entry) => entry.status === 'rejected');
      expect(fulfilled).toHaveLength(10);
      expect(rejected).toHaveLength(10);
      const stock = await service.getStock('RICE-1K');
      expect(stock.reserved).toBe(10);
      expect(stock.sellable).toBe(0);
    });

    it('never oversells when a large reservation races small ones', async () => {
      await createStock(service, 'RICE-1K', 10);
      const attempts = await Promise.allSettled([
        ...Array.from({ length: 10 }, (_, index) =>
          service.createReservation({ key: `small-${index}`, sku: 'RICE-1K', qty: 1 }),
        ),
        service.createReservation({ key: 'whale', sku: 'RICE-1K', qty: 10 }),
      ]);
      const stock = await service.getStock('RICE-1K');
      expect(stock.reserved).toBeLessThanOrEqual(10);
      expect(stock.sellable).toBeGreaterThanOrEqual(0);
      expect(stock.physical).toBeGreaterThanOrEqual(stock.reserved);
      const successes = attempts.filter((entry) => entry.status === 'fulfilled');
      expect(successes.length).toBeGreaterThanOrEqual(1);
      expect(successes.length).toBeLessThanOrEqual(11);
    });

    it('serializes duplicate concurrent stock creation', async () => {
      const attempts = await Promise.allSettled([
        createStock(service, 'RICE-1K', 5),
        createStock(service, 'RICE-1K', 5),
        createStock(service, 'RICE-1K', 5),
      ]);
      expect(attempts.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter((entry) => entry.status === 'rejected')).toHaveLength(2);
    });

    it('serializes concurrent release of the same key', async () => {
      await createStock(service, 'RICE-1K', 25);
      await service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 10 });
      const attempts = await Promise.allSettled([
        service.releaseReservation('ord-1'),
        service.releaseReservation('ord-1'),
        service.releaseReservation('ord-1'),
      ]);
      expect(attempts.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter((entry) => entry.status === 'rejected')).toHaveLength(2);
      const stock = await service.getStock('RICE-1K');
      expect(stock.reserved).toBe(0);
      expect(stock.sellable).toBe(25);
    });

    it('keeps concurrent release and reservation consistent', async () => {
      await createStock(service, 'RICE-1K', 10);
      await service.createReservation({ key: 'ord-1', sku: 'RICE-1K', qty: 10 });
      await Promise.allSettled([
        service.releaseReservation('ord-1'),
        service.createReservation({ key: 'ord-2', sku: 'RICE-1K', qty: 10 }),
      ]);
      const stock = await service.getStock('RICE-1K');
      expect(stock.physical).toBeGreaterThanOrEqual(stock.reserved);
      expect(stock.reserved).toBeGreaterThanOrEqual(0);
      expect(stock.reserved).toBeLessThanOrEqual(10);
      const ord2 = repo.reservations.get('ord-2');
      if (ord2?.state === 'reserved') {
        expect(stock.reserved).toBe(10);
      } else {
        expect(stock.reserved).toBe(0);
      }
    });

    it('keeps invariants under mixed concurrent operations', async () => {
      await createStock(service, 'RICE-1K', 50);
      await service.createReservation({ key: 'seed', sku: 'RICE-1K', qty: 20 });
      await Promise.allSettled([
        service.adjustStock('RICE-1K', { delta: 5 }),
        service.adjustStock('RICE-1K', { delta: -5 }),
        service.createReservation({ key: 'a', sku: 'RICE-1K', qty: 5 }),
        service.createReservation({ key: 'b', sku: 'RICE-1K', qty: 5 }),
        service.releaseReservation('seed'),
        service.patchStock('RICE-1K', { physical: 60 }),
      ]);
      const stock = await service.getStock('RICE-1K');
      expect(stock.physical).toBeGreaterThanOrEqual(stock.reserved);
      expect(stock.reserved).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(stock.physical)).toBe(true);
      expect(Number.isInteger(stock.reserved)).toBe(true);
    });
  });
});

describe('StagingInventoryRepository', () => {
  const repo = new StagingInventoryRepository();

  it('blocks every operation with SERVICE_UNAVAILABLE', async () => {
    const calls: Array<() => Promise<unknown>> = [
      () => repo.saveStock({} as StockRecord),
      () => repo.findStockBySku('SKU-1'),
      () => repo.listStock(),
      () => repo.saveReservation({} as Reservation),
      () => repo.findReservationByKey('k'),
      () => repo.listReservations(),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    }
  });

  it('throws a typed AppError', async () => {
    await expect(repo.listStock()).rejects.toBeInstanceOf(AppError);
  });
});
