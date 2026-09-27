import { AppError } from '@localwala/errors';
import type {
  CommissionRule,
  CycleState,
  EarningEntry,
  SettlementCycle,
} from './settlement.types.js';

export interface RuleQuery {
  scope?: string;
  partnerId?: string;
  status?: string;
}

export interface SettlementRepository {
  saveRule(rule: CommissionRule): Promise<void>;
  findRule(ruleId: string): Promise<CommissionRule | null>;
  listRules(query: RuleQuery): Promise<CommissionRule[]>;
  saveEarning(earning: EarningEntry): Promise<void>;
  findEarning(earningId: string): Promise<EarningEntry | null>;
  findEarningByOrderId(orderId: string): Promise<EarningEntry | null>;
  listEarnings(partnerId?: string): Promise<EarningEntry[]>;
  saveCycle(cycle: SettlementCycle): Promise<void>;
  findCycle(cycleId: string): Promise<SettlementCycle | null>;
  listCycles(partnerId?: string, state?: CycleState): Promise<SettlementCycle[]>;
}

/**
 * STAGING ONLY — PostgreSQL settlement store not implemented yet.
 * Throws SERVICE_UNAVAILABLE (503) on every operation (specification section 1).
 */
export class StagingSettlementRepository implements SettlementRepository {
  async saveRule(): Promise<void> {
    this.blocked('saveRule');
  }
  async findRule(): Promise<null> {
    this.blocked('findRule');
    return null;
  }
  async listRules(): Promise<[]> {
    this.blocked('listRules');
    return [];
  }
  async saveEarning(): Promise<void> {
    this.blocked('saveEarning');
  }
  async findEarning(): Promise<null> {
    this.blocked('findEarning');
    return null;
  }
  async findEarningByOrderId(): Promise<null> {
    this.blocked('findEarningByOrderId');
    return null;
  }
  async listEarnings(): Promise<[]> {
    this.blocked('listEarnings');
    return [];
  }
  async saveCycle(): Promise<void> {
    this.blocked('saveCycle');
  }
  async findCycle(): Promise<null> {
    this.blocked('findCycle');
    return null;
  }
  async listCycles(): Promise<[]> {
    this.blocked('listCycles');
    return [];
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Settlement repository not configured: ${op} blocked — PostgreSQL not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
