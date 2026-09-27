import { randomUUID } from 'node:crypto';

export const WALLET_ENTRY_TYPES = ['credit', 'debit', 'hold', 'release', 'withdrawal'] as const;

export type WalletEntryType = (typeof WALLET_ENTRY_TYPES)[number];

export const WITHDRAWAL_STATES = ['requested', 'approved', 'rejected'] as const;

export type WithdrawalState = (typeof WITHDRAWAL_STATES)[number];

export const MAX_AMOUNT_PAISE = 100_000_000;

export interface Wallet {
  userId: string;
  currency: 'INR';
  createdAt: number;
}

export interface WalletEntry {
  id: string;
  userId: string;
  seq: number;
  type: WalletEntryType;
  amount: number;
  referenceId?: string;
  reason?: string;
  createdAt: number;
}

export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  state: WithdrawalState;
  holdEntryId: string;
  reason?: string;
  createdAt: number;
  updatedAt: number;
  decidedAt?: number;
}

export interface WalletBalance {
  available: number;
  held: number;
  total: number;
}

export const USER_ID_PATTERN = '^[A-Za-z0-9._-]{1,64}$';
export const ENTRY_ID_PATTERN = '^wen_[0-9a-f]{32}$';
export const WITHDRAWAL_ID_PATTERN = '^wdr_[0-9a-f]{32}$';

export function newEntryId(): string {
  return `wen_${randomUUID().replace(/-/g, '')}`;
}

export function newWithdrawalId(): string {
  return `wdr_${randomUUID().replace(/-/g, '')}`;
}

export function deriveBalance(entries: readonly WalletEntry[]): WalletBalance {
  let available = 0;
  let held = 0;
  for (const entry of entries) {
    switch (entry.type) {
      case 'credit':
        available += entry.amount;
        break;
      case 'debit':
        available -= entry.amount;
        break;
      case 'hold':
        available -= entry.amount;
        held += entry.amount;
        break;
      case 'release':
        available += entry.amount;
        held -= entry.amount;
        break;
      case 'withdrawal':
        held -= entry.amount;
        break;
    }
  }
  return { available, held, total: available + held };
}
