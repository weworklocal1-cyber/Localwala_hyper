import { AppError } from '@localwala/errors';
import type { Wallet, WalletEntry, Withdrawal, WithdrawalState } from './wallet.types.js';

export interface WalletRepository {
  saveWallet(wallet: Wallet): Promise<void>;
  findWallet(userId: string): Promise<Wallet | null>;
  appendEntry(entry: WalletEntry): Promise<void>;
  listEntries(userId: string, limit: number): Promise<WalletEntry[]>;
  saveWithdrawal(withdrawal: Withdrawal): Promise<void>;
  findWithdrawal(id: string): Promise<Withdrawal | null>;
  listWithdrawals(userId: string, state?: WithdrawalState): Promise<Withdrawal[]>;
}

/**
 * STAGING ONLY — PostgreSQL wallet store not implemented yet.
 * Throws SERVICE_UNAVAILABLE (503) on every operation (specification section 1).
 */
export class StagingWalletRepository implements WalletRepository {
  async saveWallet(): Promise<void> {
    this.blocked('saveWallet');
  }
  async findWallet(): Promise<null> {
    this.blocked('findWallet');
    return null;
  }
  async appendEntry(): Promise<void> {
    this.blocked('appendEntry');
  }
  async listEntries(): Promise<[]> {
    this.blocked('listEntries');
    return [];
  }
  async saveWithdrawal(): Promise<void> {
    this.blocked('saveWithdrawal');
  }
  async findWithdrawal(): Promise<null> {
    this.blocked('findWithdrawal');
    return null;
  }
  async listWithdrawals(): Promise<[]> {
    this.blocked('listWithdrawals');
    return [];
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Wallet repository not configured: ${op} blocked — PostgreSQL not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
