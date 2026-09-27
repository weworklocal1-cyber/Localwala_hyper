import { randomUUID } from 'node:crypto';

export const RULE_SCOPES = ['global', 'partner'] as const;

export type RuleScope = (typeof RULE_SCOPES)[number];

export const RULE_STATUSES = ['active', 'archived'] as const;

export type RuleStatus = (typeof RULE_STATUSES)[number];

export const CYCLE_STATES = ['open', 'closed', 'completed', 'failed'] as const;

export type CycleState = (typeof CYCLE_STATES)[number];

export interface CommissionRule {
  id: string;
  scope: RuleScope;
  partnerId?: string;
  version: number;
  commissionBp: number;
  fixedFeePaise: number;
  status: RuleStatus;
  createdAt: number;
}

export interface EarningEntry {
  id: string;
  orderId: string;
  partnerId: string;
  ruleId: string;
  ruleVersion: number;
  grossPaise: number;
  commissionPaise: number;
  fixedFeePaise: number;
  deliveryContributionPaise: number;
  taxPaise: number;
  adjustmentPaise: number;
  partnerPayablePaise: number;
  reason?: string;
  createdAt: number;
}

export interface SettlementCycle {
  id: string;
  partnerId: string;
  state: CycleState;
  earningIds: string[];
  earningCount: number;
  grossPaise: number;
  commissionPaise: number;
  payablePaise: number;
  failReason?: string;
  createdAt: number;
  updatedAt: number;
  decidedAt?: number;
}

export interface ReconciliationReport {
  settlementId: string;
  partnerId: string;
  state: CycleState;
  frozen: { earningCount: number; commissionPaise: number; payablePaise: number };
  derived: { earningCount: number; commissionPaise: number; payablePaise: number };
  balanced: boolean;
  deltaPayablePaise: number;
}

export const USER_ID_PATTERN = '^[A-Za-z0-9._-]{1,64}$';
export const ORDER_ID_PATTERN = '^ord_[0-9a-f]{32}$';
export const RULE_ID_PATTERN = '^cr_[0-9a-f]{32}$';
export const EARNING_ID_PATTERN = '^ern_[0-9a-f]{32}$';
export const SETTLEMENT_ID_PATTERN = '^sty_[0-9a-f]{32}$';

export const MAX_AMOUNT_PAISE = 100_000_000;
export const MAX_COMMISSION_BP = 10_000;

export function newRuleId(): string {
  return `cr_${randomUUID().replace(/-/g, '')}`;
}

export function newEarningId(): string {
  return `ern_${randomUUID().replace(/-/g, '')}`;
}

export function newSettlementId(): string {
  return `sty_${randomUUID().replace(/-/g, '')}`;
}

export function commissionFromBp(grossPaise: number, commissionBp: number): number {
  return Math.round((grossPaise * commissionBp) / 10_000);
}
