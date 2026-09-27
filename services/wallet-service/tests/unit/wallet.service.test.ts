import { beforeEach, describe, expect, it } from 'vitest';
import type { WalletRepository } from '../../src/wallet/wallet.repository.js';
import { StagingWalletRepository } from '../../src/wallet/wallet.repository.js';
import { WalletService } from '../../src/wallet/wallet.service.js';
import type {
  Wallet,
  WalletEntry,
  Withdrawal,
  WithdrawalState,
} from '../../src/wallet/wallet.types.js';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

class InMemoryWalletRepository implements WalletRepository {
  readonly wallets = new Map<string, Wallet>();
  readonly entries = new Map<string, WalletEntry[]>();
  readonly withdrawals = new Map<string, Withdrawal>();

  async saveWallet(wallet: Wallet): Promise<void> {
    await tick();
    this.wallets.set(wallet.userId, { ...wallet });
    if (!this.entries.has(wallet.userId)) this.entries.set(wallet.userId, []);
  }
  async findWallet(userId: string): Promise<Wallet | null> {
    await tick();
    const wallet = this.wallets.get(userId);
    return wallet ? { ...wallet } : null;
  }
  async appendEntry(entry: WalletEntry): Promise<void> {
    await tick();
    const list = this.entries.get(entry.userId);
    if (!list) throw new Error('wallet missing');
    if (list.some((existing) => existing.seq === entry.seq)) {
      throw new Error(`duplicate seq ${entry.seq}`);
    }
    list.push({ ...entry });
  }
  async listEntries(userId: string, limit: number): Promise<WalletEntry[]> {
    await tick();
    const list = [...(this.entries.get(userId) ?? [])];
    list.sort((a, b) => b.seq - a.seq);
    return list.slice(0, limit).map((entry) => ({ ...entry }));
  }
  async saveWithdrawal(withdrawal: Withdrawal): Promise<void> {
    await tick();
    this.withdrawals.set(withdrawal.id, { ...withdrawal });
  }
  async findWithdrawal(id: string): Promise<Withdrawal | null> {
    await tick();
    const withdrawal = this.withdrawals.get(id);
    return withdrawal ? { ...withdrawal } : null;
  }
  async listWithdrawals(userId: string, state?: WithdrawalState): Promise<Withdrawal[]> {
    await tick();
    return [...this.withdrawals.values()]
      .filter((withdrawal) => withdrawal.userId === userId)
      .filter((withdrawal) => state === undefined || withdrawal.state === state)
      .map((withdrawal) => ({ ...withdrawal }));
  }
}

async function fundedWallet(service: WalletService, userId = 'usr_1', credit = 100_000) {
  await service.createWallet({ userId });
  if (credit > 0) await service.credit(userId, { amount: credit, reason: 'topup' });
  return service.getWallet(userId);
}

describe('WalletService', () => {
  let repo: InMemoryWalletRepository;
  let service: WalletService;

  beforeEach(() => {
    repo = new InMemoryWalletRepository();
    service = new WalletService(repo);
  });

  describe('wallet creation', () => {
    it('creates an empty wallet with zero balance', async () => {
      const result = await service.createWallet({ userId: 'usr_1' });
      expect(result.wallet.userId).toBe('usr_1');
      expect(result.wallet.currency).toBe('INR');
      expect(result.balance).toEqual({ available: 0, held: 0, total: 0 });
    });

    it('accepts an optional initial credit', async () => {
      const result = await service.createWallet({ userId: 'usr_1', creditAmount: 5000 });
      expect(result.balance.available).toBe(5000);
      const entries = await service.listEntries('usr_1', {});
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ type: 'credit', seq: 1, amount: 5000 });
    });

    it('rejects a duplicate wallet', async () => {
      await service.createWallet({ userId: 'usr_1' });
      await expect(service.createWallet({ userId: 'usr_1' })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects a zero initial credit', async () => {
      await expect(
        service.createWallet({ userId: 'usr_1', creditAmount: 0 }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('returns NOT_FOUND for an unknown wallet', async () => {
      await expect(service.getWallet('usr_missing')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('credit and debit', () => {
    it('credits and appends an immutable ledger entry', async () => {
      await fundedWallet(service, 'usr_1', 0);
      const { entry, balance } = await service.credit('usr_1', {
        amount: 2500,
        reason: 'refund',
        referenceId: 'ord_123',
      });
      expect(entry).toMatchObject({ type: 'credit', amount: 2500, seq: 1, referenceId: 'ord_123' });
      expect(balance.available).toBe(2500);
    });

    it('debits when funds are available', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const { balance } = await service.debit('usr_1', { amount: 4000 });
      expect(balance.available).toBe(6000);
      expect(balance.held).toBe(0);
      expect(balance.total).toBe(6000);
    });

    it('rejects a debit beyond the available balance', async () => {
      await fundedWallet(service, 'usr_1', 1000);
      await expect(service.debit('usr_1', { amount: 1001 })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      const balance = (await service.getWallet('usr_1')).balance;
      expect(balance.available).toBe(1000);
    });

    it('rejects fractional and negative amounts', async () => {
      await fundedWallet(service, 'usr_1', 1000);
      await expect(service.credit('usr_1', { amount: 10.5 })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      await expect(service.credit('usr_1', { amount: -100 })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('rejects operations on a missing wallet', async () => {
      await expect(service.credit('usr_missing', { amount: 100 })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(service.debit('usr_missing', { amount: 100 })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('holds', () => {
    it('moves funds from available to held', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const { entry, balance } = await service.createHold('usr_1', { amount: 3000 });
      expect(entry.type).toBe('hold');
      expect(balance).toEqual({ available: 7000, held: 3000, total: 10_000 });
    });

    it('rejects a hold beyond the available balance', async () => {
      await fundedWallet(service, 'usr_1', 500);
      await expect(service.createHold('usr_1', { amount: 501 })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('releases a hold back to available', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const hold = await service.createHold('usr_1', { amount: 3000 });
      const released = await service.releaseHold('usr_1', hold.entry.id, {
        reason: 'order cancelled',
      });
      expect(released.entry).toMatchObject({
        type: 'release',
        amount: 3000,
        referenceId: hold.entry.id,
      });
      expect(released.balance).toEqual({ available: 10_000, held: 0, total: 10_000 });
    });

    it('rejects releasing the same hold twice', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const hold = await service.createHold('usr_1', { amount: 3000 });
      await service.releaseHold('usr_1', hold.entry.id, {});
      await expect(service.releaseHold('usr_1', hold.entry.id, {})).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('returns NOT_FOUND when releasing an unknown entry', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const missing = `wen_${'0'.repeat(32)}`;
      await expect(service.releaseHold('usr_1', missing, {})).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('returns NOT_FOUND when releasing a non-hold entry', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const entries = await service.listEntries('usr_1', {});
      await expect(service.releaseHold('usr_1', entries[0]!.id, {})).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('withdrawals', () => {
    it('requests a withdrawal by placing a hold', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const { withdrawal, balance } = await service.createWithdrawal('usr_1', {
        amount: 4000,
      });
      expect(withdrawal).toMatchObject({ state: 'requested', amount: 4000 });
      expect(withdrawal.id).toMatch(/^wdr_/);
      expect(withdrawal.holdEntryId).toMatch(/^wen_/);
      expect(balance).toEqual({ available: 6000, held: 4000, total: 10_000 });
    });

    it('rejects a withdrawal beyond the available balance', async () => {
      await fundedWallet(service, 'usr_1', 1000);
      await expect(service.createWithdrawal('usr_1', { amount: 1001 })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('approves a withdrawal by consuming the hold', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const created = await service.createWithdrawal('usr_1', { amount: 4000 });
      const approved = await service.approveWithdrawal(created.withdrawal.id);
      expect(approved.withdrawal.state).toBe('approved');
      expect(approved.withdrawal.decidedAt).toBeDefined();
      expect(approved.balance).toEqual({ available: 6000, held: 0, total: 6000 });
      const entries = await service.listEntries('usr_1', {});
      expect(entries[0]).toMatchObject({
        type: 'withdrawal',
        amount: 4000,
        referenceId: created.withdrawal.holdEntryId,
      });
    });

    it('rejects approving twice', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const created = await service.createWithdrawal('usr_1', { amount: 4000 });
      await service.approveWithdrawal(created.withdrawal.id);
      await expect(service.approveWithdrawal(created.withdrawal.id)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects approving after rejection', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const created = await service.createWithdrawal('usr_1', { amount: 4000 });
      await service.rejectWithdrawal(created.withdrawal.id, { reason: 'kyc pending' });
      await expect(service.approveWithdrawal(created.withdrawal.id)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects with a reason and releases the hold', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const created = await service.createWithdrawal('usr_1', { amount: 4000 });
      const rejected = await service.rejectWithdrawal(created.withdrawal.id, {
        reason: 'bank account mismatch',
      });
      expect(rejected.withdrawal).toMatchObject({
        state: 'rejected',
        reason: 'bank account mismatch',
      });
      expect(rejected.balance).toEqual({ available: 10_000, held: 0, total: 10_000 });
    });

    it('requires a rejection reason', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const created = await service.createWithdrawal('usr_1', { amount: 4000 });
      await expect(service.rejectWithdrawal(created.withdrawal.id, {})).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('rejects approving when the hold was already released', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const created = await service.createWithdrawal('usr_1', { amount: 4000 });
      await service.releaseHold('usr_1', created.withdrawal.holdEntryId, {
        reason: 'manual override',
      });
      await expect(service.approveWithdrawal(created.withdrawal.id)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('returns NOT_FOUND for an unknown withdrawal', async () => {
      const missing = `wdr_${'0'.repeat(32)}`;
      await expect(service.approveWithdrawal(missing)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(service.rejectWithdrawal(missing, { reason: 'x' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('filters withdrawals by state', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const first = await service.createWithdrawal('usr_1', { amount: 1000 });
      const second = await service.createWithdrawal('usr_1', { amount: 2000 });
      await service.approveWithdrawal(first.withdrawal.id);

      const requested = await service.listWithdrawals('usr_1', { state: 'requested' });
      expect(requested.map((entry) => entry.id)).toEqual([second.withdrawal.id]);
      const approved = await service.listWithdrawals('usr_1', { state: 'approved' });
      expect(approved.map((entry) => entry.id)).toEqual([first.withdrawal.id]);
      const all = await service.listWithdrawals('usr_1', {});
      expect(all).toHaveLength(2);
    });
  });

  describe('ledger integrity', () => {
    it('keeps history immutable: reversals append new entries', async () => {
      await fundedWallet(service, 'usr_1', 10_000);
      const before = await service.listEntries('usr_1', {});
      await service.debit('usr_1', { amount: 10_000, reason: 'reversal of topup' });
      const after = await service.listEntries('usr_1', {});
      expect(after).toHaveLength(before.length + 1);
      for (const entry of before) {
        const stillThere = after.find((current) => current.id === entry.id);
        expect(stillThere).toEqual(entry);
      }
      expect(after.map((entry) => entry.seq)).toEqual([2, 1]);
      expect(after[0]).toMatchObject({ type: 'debit', amount: 10_000 });
    });

    it('assigns strictly increasing sequence numbers', async () => {
      await fundedWallet(service, 'usr_1', 0);
      await service.credit('usr_1', { amount: 100 });
      await service.credit('usr_1', { amount: 200 });
      await service.debit('usr_1', { amount: 50 });
      const entries = await service.listEntries('usr_1', { limit: 100 });
      expect(entries.map((entry) => entry.seq)).toEqual([3, 2, 1]);
    });

    it('derives balance across a mixed history', async () => {
      await fundedWallet(service, 'usr_1', 1000);
      await service.debit('usr_1', { amount: 300 });
      const hold = await service.createHold('usr_1', { amount: 200 });
      await service.releaseHold('usr_1', hold.entry.id, {});
      const { balance } = await service.getWallet('usr_1');
      expect(balance).toEqual({ available: 700, held: 0, total: 700 });
    });

    it('returns newest entries first and honors the limit', async () => {
      await fundedWallet(service, 'usr_1', 0);
      await service.credit('usr_1', { amount: 100 });
      await service.credit('usr_1', { amount: 200 });
      await service.credit('usr_1', { amount: 300 });
      const entries = await service.listEntries('usr_1', { limit: 2 });
      expect(entries.map((entry) => entry.amount)).toEqual([300, 200]);
    });
  });

  describe('concurrency', () => {
    it('never allows a debit race to overdraw', async () => {
      await fundedWallet(service, 'usr_1', 1000);
      const results = await Promise.allSettled([
        service.debit('usr_1', { amount: 600 }),
        service.debit('usr_1', { amount: 600 }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const { balance } = await service.getWallet('usr_1');
      expect(balance.available).toBe(400);
    });

    it('serializes parallel credits', async () => {
      await fundedWallet(service, 'usr_1', 0);
      await Promise.all([
        service.credit('usr_1', { amount: 100 }),
        service.credit('usr_1', { amount: 200 }),
        service.credit('usr_1', { amount: 300 }),
      ]);
      const { balance } = await service.getWallet('usr_1');
      expect(balance.available).toBe(600);
      const entries = await service.listEntries('usr_1', { limit: 100 });
      expect(entries.map((entry) => entry.seq)).toEqual([3, 2, 1]);
    });
  });

  describe('staging adapter', () => {
    it('blocks every repository operation with 503', async () => {
      const staging = new StagingWalletRepository();
      await expect(staging.findWallet('usr_1')).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      });
      await expect(staging.saveWallet({} as Wallet)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(staging.appendEntry({} as WalletEntry)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(staging.listEntries('usr_1', 10)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(staging.findWithdrawal('wdr_1')).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    });

    it('surfaces 503 through the service', async () => {
      const stagingService = new WalletService(new StagingWalletRepository());
      await expect(stagingService.getWallet('usr_1')).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(stagingService.createWallet({ userId: 'usr_1' })).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(stagingService.credit('usr_1', { amount: 100 })).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    });
  });
});
