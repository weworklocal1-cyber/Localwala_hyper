import { AppError } from '@localwala/errors';
import { KeyedMutex } from './keyed-mutex.js';
import type { WalletRepository } from './wallet.repository.js';
import {
  deriveBalance,
  newEntryId,
  newWithdrawalId,
  type Wallet,
  type WalletBalance,
  type WalletEntry,
  type Withdrawal,
} from './wallet.types.js';
import {
  parseCreateWallet,
  parseCreateWithdrawal,
  parseListEntries,
  parseListWithdrawals,
  parseMoneyMove,
  parseReject,
  parseRelease,
  parseUserId,
} from '../schemas/wallet.schema.js';

export interface WalletView {
  wallet: Wallet;
  balance: WalletBalance;
}

export interface EntryView {
  entry: WalletEntry;
  balance: WalletBalance;
}

export interface WithdrawalView {
  withdrawal: Withdrawal;
  balance: WalletBalance;
}

export class WalletService {
  private readonly mutex = new KeyedMutex();

  constructor(private readonly repo: WalletRepository) {}

  async createWallet(input: unknown): Promise<WalletView> {
    const parsed = parseCreateWallet(input);
    return this.mutex.run(`wallet:${parsed.userId}`, async () => {
      const existing = await this.repo.findWallet(parsed.userId);
      if (existing) {
        throw new AppError('CONFLICT', {
          message: 'Wallet already exists for this user.',
          details: { userId: parsed.userId },
        });
      }
      const wallet: Wallet = {
        userId: parsed.userId,
        currency: 'INR',
        createdAt: Date.now(),
      };
      await this.repo.saveWallet(wallet);
      if (parsed.creditAmount !== undefined) {
        await this.appendEntry(wallet.userId, {
          type: 'credit',
          amount: parsed.creditAmount,
          reason: 'initial credit',
        });
      }
      return this.walletView(wallet.userId);
    });
  }

  async getWallet(userId: string): Promise<WalletView> {
    parseUserId(userId);
    const wallet = await this.repo.findWallet(userId);
    if (!wallet) {
      throw new AppError('NOT_FOUND', { message: 'Wallet not found.' });
    }
    return this.walletView(userId);
  }

  async listEntries(userId: string, query: unknown): Promise<WalletEntry[]> {
    parseUserId(userId);
    const parsed = parseListEntries(query);
    const wallet = await this.repo.findWallet(userId);
    if (!wallet) {
      throw new AppError('NOT_FOUND', { message: 'Wallet not found.' });
    }
    const entries = await this.repo.listEntries(userId, parsed.limit);
    return [...entries].sort((a, b) => b.seq - a.seq);
  }

  async credit(userId: string, input: unknown): Promise<EntryView> {
    parseUserId(userId);
    const parsed = parseMoneyMove(input);
    return this.mutex.run(`wallet:${userId}`, async () => {
      await this.requireWallet(userId);
      const entry = await this.appendEntry(userId, {
        type: 'credit',
        amount: parsed.amount,
        ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
        ...(parsed.referenceId !== undefined ? { referenceId: parsed.referenceId } : {}),
      });
      return { entry, balance: await this.balance(userId) };
    });
  }

  async debit(userId: string, input: unknown): Promise<EntryView> {
    parseUserId(userId);
    const parsed = parseMoneyMove(input);
    return this.mutex.run(`wallet:${userId}`, async () => {
      await this.requireWallet(userId);
      const balance = await this.balance(userId);
      if (balance.available < parsed.amount) {
        throw new AppError('CONFLICT', {
          message: 'Insufficient available balance.',
          details: { available: balance.available, requested: parsed.amount },
        });
      }
      const entry = await this.appendEntry(userId, {
        type: 'debit',
        amount: parsed.amount,
        ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
        ...(parsed.referenceId !== undefined ? { referenceId: parsed.referenceId } : {}),
      });
      return { entry, balance: await this.balance(userId) };
    });
  }

  async createHold(userId: string, input: unknown): Promise<EntryView> {
    parseUserId(userId);
    const parsed = parseMoneyMove(input);
    return this.mutex.run(`wallet:${userId}`, async () => {
      await this.requireWallet(userId);
      const balance = await this.balance(userId);
      if (balance.available < parsed.amount) {
        throw new AppError('CONFLICT', {
          message: 'Insufficient available balance.',
          details: { available: balance.available, requested: parsed.amount },
        });
      }
      const entry = await this.appendEntry(userId, {
        type: 'hold',
        amount: parsed.amount,
        ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
        ...(parsed.referenceId !== undefined ? { referenceId: parsed.referenceId } : {}),
      });
      return { entry, balance: await this.balance(userId) };
    });
  }

  async releaseHold(userId: string, entryId: string, input: unknown): Promise<EntryView> {
    parseUserId(userId);
    const parsed = parseRelease(input);
    return this.mutex.run(`wallet:${userId}`, async () => {
      await this.requireWallet(userId);
      const remaining = await this.holdRemaining(userId, entryId);
      if (remaining === null) {
        throw new AppError('NOT_FOUND', { message: 'Hold entry not found.' });
      }
      if (remaining <= 0) {
        throw new AppError('CONFLICT', {
          message: 'Hold has already been settled.',
          details: { entryId },
        });
      }
      const entry = await this.appendEntry(userId, {
        type: 'release',
        amount: remaining,
        referenceId: entryId,
        ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
      });
      return { entry, balance: await this.balance(userId) };
    });
  }

  async createWithdrawal(userId: string, input: unknown): Promise<WithdrawalView> {
    parseUserId(userId);
    const parsed = parseCreateWithdrawal(input);
    return this.mutex.run(`wallet:${userId}`, async () => {
      await this.requireWallet(userId);
      const balance = await this.balance(userId);
      if (balance.available < parsed.amount) {
        throw new AppError('CONFLICT', {
          message: 'Insufficient available balance.',
          details: { available: balance.available, requested: parsed.amount },
        });
      }
      const hold = await this.appendEntry(userId, {
        type: 'hold',
        amount: parsed.amount,
        reason: 'withdrawal hold',
      });
      const now = Date.now();
      const withdrawal: Withdrawal = {
        id: newWithdrawalId(),
        userId,
        amount: parsed.amount,
        state: 'requested',
        holdEntryId: hold.id,
        createdAt: now,
        updatedAt: now,
      };
      await this.repo.saveWithdrawal(withdrawal);
      return { withdrawal, balance: await this.balance(userId) };
    });
  }

  async listWithdrawals(userId: string, query: unknown): Promise<Withdrawal[]> {
    parseUserId(userId);
    const parsed = parseListWithdrawals(query);
    const wallet = await this.repo.findWallet(userId);
    if (!wallet) {
      throw new AppError('NOT_FOUND', { message: 'Wallet not found.' });
    }
    const withdrawals = await this.repo.listWithdrawals(
      userId,
      parsed.state !== undefined ? parsed.state : undefined,
    );
    return withdrawals.sort((a, b) => b.createdAt - a.createdAt).slice(0, parsed.limit);
  }

  async approveWithdrawal(withdrawalId: string): Promise<WithdrawalView> {
    const withdrawal = await this.repo.findWithdrawal(withdrawalId);
    if (!withdrawal) {
      throw new AppError('NOT_FOUND', { message: 'Withdrawal not found.' });
    }
    return this.mutex.run(`wallet:${withdrawal.userId}`, async () => {
      const current = await this.repo.findWithdrawal(withdrawalId);
      if (!current) {
        throw new AppError('NOT_FOUND', { message: 'Withdrawal not found.' });
      }
      if (current.state !== 'requested') {
        throw new AppError('CONFLICT', {
          message: `Withdrawal already ${current.state}.`,
          details: { state: current.state },
        });
      }
      const remaining = await this.holdRemaining(current.userId, current.holdEntryId);
      if (remaining === null || remaining < current.amount) {
        throw new AppError('CONFLICT', {
          message: 'Withdrawal hold is no longer active.',
          details: { holdEntryId: current.holdEntryId },
        });
      }
      await this.appendEntry(current.userId, {
        type: 'withdrawal',
        amount: current.amount,
        referenceId: current.holdEntryId,
        reason: 'withdrawal paid',
      });
      const now = Date.now();
      current.state = 'approved';
      current.updatedAt = now;
      current.decidedAt = now;
      await this.repo.saveWithdrawal(current);
      return { withdrawal: current, balance: await this.balance(current.userId) };
    });
  }

  async rejectWithdrawal(withdrawalId: string, input: unknown): Promise<WithdrawalView> {
    const parsed = parseReject(input);
    const withdrawal = await this.repo.findWithdrawal(withdrawalId);
    if (!withdrawal) {
      throw new AppError('NOT_FOUND', { message: 'Withdrawal not found.' });
    }
    return this.mutex.run(`wallet:${withdrawal.userId}`, async () => {
      const current = await this.repo.findWithdrawal(withdrawalId);
      if (!current) {
        throw new AppError('NOT_FOUND', { message: 'Withdrawal not found.' });
      }
      if (current.state !== 'requested') {
        throw new AppError('CONFLICT', {
          message: `Withdrawal already ${current.state}.`,
          details: { state: current.state },
        });
      }
      const remaining = await this.holdRemaining(current.userId, current.holdEntryId);
      if (remaining === null || remaining <= 0) {
        throw new AppError('CONFLICT', {
          message: 'Withdrawal hold is no longer active.',
          details: { holdEntryId: current.holdEntryId },
        });
      }
      await this.appendEntry(current.userId, {
        type: 'release',
        amount: remaining,
        referenceId: current.holdEntryId,
        reason: `withdrawal rejected: ${parsed.reason}`,
      });
      const now = Date.now();
      current.state = 'rejected';
      current.reason = parsed.reason;
      current.updatedAt = now;
      current.decidedAt = now;
      await this.repo.saveWithdrawal(current);
      return { withdrawal: current, balance: await this.balance(current.userId) };
    });
  }

  private async requireWallet(userId: string): Promise<Wallet> {
    const wallet = await this.repo.findWallet(userId);
    if (!wallet) {
      throw new AppError('NOT_FOUND', { message: 'Wallet not found.' });
    }
    return wallet;
  }

  private async balance(userId: string): Promise<WalletBalance> {
    return deriveBalance(await this.allEntries(userId));
  }

  private async allEntries(userId: string): Promise<WalletEntry[]> {
    return this.repo.listEntries(userId, Number.MAX_SAFE_INTEGER);
  }

  private async holdRemaining(userId: string, holdEntryId: string): Promise<number | null> {
    const entries = await this.allEntries(userId);
    const hold = entries.find((entry) => entry.id === holdEntryId && entry.type === 'hold');
    if (!hold) return null;
    const settled = entries
      .filter(
        (entry) =>
          entry.referenceId === holdEntryId &&
          (entry.type === 'release' || entry.type === 'withdrawal'),
      )
      .reduce((total, entry) => total + entry.amount, 0);
    return hold.amount - settled;
  }

  private async appendEntry(
    userId: string,
    input: {
      type: WalletEntry['type'];
      amount: number;
      reason?: string;
      referenceId?: string;
    },
  ): Promise<WalletEntry> {
    const existing = await this.allEntries(userId);
    const entry: WalletEntry = {
      id: newEntryId(),
      userId,
      seq: existing.reduce((max, current) => Math.max(max, current.seq), 0) + 1,
      type: input.type,
      amount: input.amount,
      createdAt: Date.now(),
    };
    if (input.reason !== undefined) entry.reason = input.reason;
    if (input.referenceId !== undefined) entry.referenceId = input.referenceId;
    await this.repo.appendEntry(entry);
    return entry;
  }

  private async walletView(userId: string): Promise<WalletView> {
    const wallet = await this.requireWallet(userId);
    return { wallet, balance: await this.balance(userId) };
  }
}
