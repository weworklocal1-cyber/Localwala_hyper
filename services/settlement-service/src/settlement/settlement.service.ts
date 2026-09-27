import { AppError } from '@localwala/errors';
import { KeyedMutex } from './keyed-mutex.js';
import type { SettlementRepository } from './settlement.repository.js';
import {
  commissionFromBp,
  newEarningId,
  newRuleId,
  newSettlementId,
  type CommissionRule,
  type EarningEntry,
  type ReconciliationReport,
  type SettlementCycle,
} from './settlement.types.js';
import {
  parseCreateCycle,
  parseCreateEarning,
  parseCreateRule,
  parseFail,
  parseListCycles,
  parseListEarnings,
  parseListRules,
} from '../schemas/settlement.schema.js';

export class SettlementService {
  private readonly mutex = new KeyedMutex();

  constructor(private readonly repo: SettlementRepository) {}

  async createRule(input: unknown): Promise<CommissionRule> {
    const parsed = parseCreateRule(input);
    const lockKey =
      parsed.scope === 'global' ? 'rules:global' : `rules:partner:${parsed.partnerId}`;
    return this.mutex.run(lockKey, async () => {
      const existing = await this.repo.listRules(
        parsed.scope === 'partner'
          ? { scope: 'partner', partnerId: parsed.partnerId }
          : { scope: 'global' },
      );
      const active = existing.filter((rule) => rule.status === 'active');
      for (const rule of active) {
        rule.status = 'archived';
        await this.repo.saveRule(rule);
      }
      const nextVersion = existing.reduce((max, rule) => Math.max(max, rule.version), 0) + 1;
      const rule: CommissionRule = {
        id: newRuleId(),
        scope: parsed.scope,
        ...(parsed.partnerId !== undefined ? { partnerId: parsed.partnerId } : {}),
        version: nextVersion,
        commissionBp: parsed.commissionBp,
        fixedFeePaise: parsed.fixedFeePaise ?? 0,
        status: 'active',
        createdAt: Date.now(),
      };
      await this.repo.saveRule(rule);
      return rule;
    });
  }

  async listRules(query: unknown): Promise<CommissionRule[]> {
    const parsed = parseListRules(query);
    const rules = await this.repo.listRules({
      ...(parsed.scope !== undefined ? { scope: parsed.scope } : {}),
      ...(parsed.partnerId !== undefined ? { partnerId: parsed.partnerId } : {}),
      ...(parsed.status !== undefined ? { status: parsed.status } : {}),
    });
    return rules
      .sort((a, b) => b.version - a.version || b.createdAt - a.createdAt)
      .slice(0, parsed.limit);
  }

  async getRule(ruleId: string): Promise<CommissionRule> {
    const rule = await this.repo.findRule(ruleId);
    if (!rule) {
      throw new AppError('NOT_FOUND', { message: 'Commission rule not found.' });
    }
    return rule;
  }

  async archiveRule(ruleId: string): Promise<CommissionRule> {
    const rule = await this.getRule(ruleId);
    return this.mutex.run(
      rule.scope === 'global' ? 'rules:global' : `rules:partner:${rule.partnerId ?? ''}`,
      async () => {
        const current = await this.repo.findRule(ruleId);
        if (!current) {
          throw new AppError('NOT_FOUND', { message: 'Commission rule not found.' });
        }
        if (current.status === 'archived') {
          throw new AppError('CONFLICT', {
            message: 'Commission rule is already archived.',
            details: { ruleId },
          });
        }
        current.status = 'archived';
        await this.repo.saveRule(current);
        return current;
      },
    );
  }

  async createEarning(input: unknown): Promise<EarningEntry> {
    const parsed = parseCreateEarning(input);
    return this.mutex.run(`earning:${parsed.orderId}`, async () => {
      const duplicate = await this.repo.findEarningByOrderId(parsed.orderId);
      if (duplicate) {
        throw new AppError('CONFLICT', {
          message: 'An earning entry already exists for this order.',
          details: { orderId: parsed.orderId },
        });
      }
      const rule = await this.resolveActiveRule(parsed.partnerId);
      const commissionPaise = commissionFromBp(parsed.grossPaise, rule.commissionBp);
      const deliveryContributionPaise = parsed.deliveryContributionPaise ?? 0;
      const taxPaise = parsed.taxPaise ?? 0;
      const adjustmentPaise = parsed.adjustmentPaise ?? 0;
      const earning: EarningEntry = {
        id: newEarningId(),
        orderId: parsed.orderId,
        partnerId: parsed.partnerId,
        ruleId: rule.id,
        ruleVersion: rule.version,
        grossPaise: parsed.grossPaise,
        commissionPaise,
        fixedFeePaise: rule.fixedFeePaise,
        deliveryContributionPaise,
        taxPaise,
        adjustmentPaise,
        partnerPayablePaise:
          parsed.grossPaise -
          commissionPaise -
          rule.fixedFeePaise +
          deliveryContributionPaise -
          adjustmentPaise,
        createdAt: Date.now(),
      };
      if (parsed.reason !== undefined) earning.reason = parsed.reason;
      await this.repo.saveEarning(earning);
      return earning;
    });
  }

  async getEarning(earningId: string): Promise<EarningEntry> {
    const earning = await this.repo.findEarning(earningId);
    if (!earning) {
      throw new AppError('NOT_FOUND', { message: 'Earning entry not found.' });
    }
    return earning;
  }

  async listEarnings(query: unknown): Promise<EarningEntry[]> {
    const parsed = parseListEarnings(query);
    const earnings = await this.repo.listEarnings(parsed.partnerId);
    return earnings.sort((a, b) => b.createdAt - a.createdAt).slice(0, parsed.limit);
  }

  async createCycle(input: unknown): Promise<SettlementCycle> {
    const parsed = parseCreateCycle(input);
    return this.mutex.run(`cycle:${parsed.partnerId}`, async () => {
      const existing = await this.repo.listCycles(parsed.partnerId, 'open');
      if (existing.length > 0) {
        throw new AppError('CONFLICT', {
          message: 'An open settlement cycle already exists for this partner.',
          details: { partnerId: parsed.partnerId, settlementId: existing[0]?.id },
        });
      }
      const now = Date.now();
      const cycle: SettlementCycle = {
        id: newSettlementId(),
        partnerId: parsed.partnerId,
        state: 'open',
        earningIds: [],
        earningCount: 0,
        grossPaise: 0,
        commissionPaise: 0,
        payablePaise: 0,
        createdAt: now,
        updatedAt: now,
      };
      await this.repo.saveCycle(cycle);
      return cycle;
    });
  }

  async getCycle(settlementId: string): Promise<SettlementCycle> {
    const cycle = await this.repo.findCycle(settlementId);
    if (!cycle) {
      throw new AppError('NOT_FOUND', { message: 'Settlement cycle not found.' });
    }
    return cycle;
  }

  async listCycles(query: unknown): Promise<SettlementCycle[]> {
    const parsed = parseListCycles(query);
    const cycles = await this.repo.listCycles(parsed.partnerId, parsed.state);
    return cycles.sort((a, b) => b.createdAt - a.createdAt).slice(0, parsed.limit);
  }

  async closeCycle(settlementId: string): Promise<SettlementCycle> {
    const seed = await this.getCycle(settlementId);
    return this.mutex.run(`cycle:${seed.partnerId}`, async () => {
      const cycle = await this.requireCycle(settlementId);
      if (cycle.state !== 'open') {
        throw new AppError('CONFLICT', {
          message: `Settlement cycle is ${cycle.state}; only open cycles can be closed.`,
          details: { state: cycle.state },
        });
      }
      const eligible = await this.eligibleEarnings(cycle.partnerId, Date.now());
      if (eligible.length === 0) {
        throw new AppError('CONFLICT', {
          message: 'No eligible earnings to settle.',
          details: { partnerId: cycle.partnerId },
        });
      }
      cycle.earningIds = eligible.map((earning) => earning.id);
      cycle.earningCount = eligible.length;
      cycle.grossPaise = eligible.reduce((sum, entry) => sum + entry.grossPaise, 0);
      cycle.commissionPaise = eligible.reduce(
        (sum, entry) => sum + entry.commissionPaise + entry.fixedFeePaise,
        0,
      );
      cycle.payablePaise = eligible.reduce((sum, entry) => sum + entry.partnerPayablePaise, 0);
      cycle.state = 'closed';
      cycle.updatedAt = Date.now();
      await this.repo.saveCycle(cycle);
      return cycle;
    });
  }

  async completeCycle(settlementId: string): Promise<SettlementCycle> {
    const seed = await this.getCycle(settlementId);
    return this.mutex.run(`cycle:${seed.partnerId}`, async () => {
      const cycle = await this.requireCycle(settlementId);
      if (cycle.state !== 'closed') {
        throw new AppError('CONFLICT', {
          message: `Settlement cycle is ${cycle.state}; only closed cycles can be completed.`,
          details: { state: cycle.state },
        });
      }
      cycle.state = 'completed';
      cycle.updatedAt = Date.now();
      cycle.decidedAt = Date.now();
      await this.repo.saveCycle(cycle);
      return cycle;
    });
  }

  async failCycle(settlementId: string, input: unknown): Promise<SettlementCycle> {
    const parsed = parseFail(input);
    const seed = await this.getCycle(settlementId);
    return this.mutex.run(`cycle:${seed.partnerId}`, async () => {
      const cycle = await this.requireCycle(settlementId);
      if (cycle.state !== 'closed') {
        throw new AppError('CONFLICT', {
          message: `Settlement cycle is ${cycle.state}; only closed cycles can be failed.`,
          details: { state: cycle.state },
        });
      }
      cycle.state = 'failed';
      cycle.failReason = parsed.reason;
      cycle.updatedAt = Date.now();
      cycle.decidedAt = Date.now();
      await this.repo.saveCycle(cycle);
      return cycle;
    });
  }

  async reconcile(settlementId: string): Promise<ReconciliationReport> {
    const cycle = await this.requireCycle(settlementId);
    if (cycle.state === 'open') {
      throw new AppError('CONFLICT', {
        message: 'Cannot reconcile an open settlement cycle.',
        details: { state: cycle.state },
      });
    }
    const earnings = await Promise.all(
      cycle.earningIds.map((earningId) => this.repo.findEarning(earningId)),
    );
    const settled = earnings.filter((entry): entry is EarningEntry => entry !== null);
    const derived = {
      earningCount: settled.length,
      commissionPaise: settled.reduce(
        (sum, entry) => sum + entry.commissionPaise + entry.fixedFeePaise,
        0,
      ),
      payablePaise: settled.reduce((sum, entry) => sum + entry.partnerPayablePaise, 0),
    };
    const frozen = {
      earningCount: cycle.earningCount,
      commissionPaise: cycle.commissionPaise,
      payablePaise: cycle.payablePaise,
    };
    const deltaPayablePaise = derived.payablePaise - frozen.payablePaise;
    return {
      settlementId: cycle.id,
      partnerId: cycle.partnerId,
      state: cycle.state,
      frozen,
      derived,
      balanced:
        derived.earningCount === frozen.earningCount &&
        derived.commissionPaise === frozen.commissionPaise &&
        derived.payablePaise === frozen.payablePaise,
      deltaPayablePaise,
    };
  }

  private async resolveActiveRule(partnerId: string): Promise<CommissionRule> {
    const partnerRules = await this.repo.listRules({ scope: 'partner', partnerId });
    const partnerActive = partnerRules.find((rule) => rule.status === 'active');
    if (partnerActive) return partnerActive;
    const globalRules = await this.repo.listRules({ scope: 'global' });
    const globalActive = globalRules.find((rule) => rule.status === 'active');
    if (globalActive) return globalActive;
    throw new AppError('CONFLICT', {
      message: 'No active commission rule for this partner.',
      details: { partnerId },
    });
  }

  private async eligibleEarnings(partnerId: string, cutoffAt: number): Promise<EarningEntry[]> {
    const earnings = await this.repo.listEarnings(partnerId);
    const cycles = await this.repo.listCycles(partnerId);
    const locked = new Set(
      cycles
        .filter((cycle) => cycle.state === 'closed' || cycle.state === 'completed')
        .flatMap((cycle) => cycle.earningIds),
    );
    return earnings
      .filter((earning) => earning.createdAt <= cutoffAt && !locked.has(earning.id))
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  private async requireCycle(settlementId: string): Promise<SettlementCycle> {
    const cycle = await this.repo.findCycle(settlementId);
    if (!cycle) {
      throw new AppError('NOT_FOUND', { message: 'Settlement cycle not found.' });
    }
    return cycle;
  }
}
