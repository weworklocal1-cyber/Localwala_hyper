import { beforeEach, describe, expect, it } from 'vitest';
import type { SettlementRepository } from '../../src/settlement/settlement.repository.js';
import { StagingSettlementRepository } from '../../src/settlement/settlement.repository.js';
import { SettlementService } from '../../src/settlement/settlement.service.js';
import type {
  CommissionRule,
  CycleState,
  EarningEntry,
  SettlementCycle,
} from '../../src/settlement/settlement.types.js';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const smallDelay = () => new Promise<void>((resolve) => setTimeout(resolve, 3));

const ORD = (suffix: string) => `ord_${suffix.padEnd(32, '0').slice(0, 32)}`;

class InMemorySettlementRepository implements SettlementRepository {
  readonly rules = new Map<string, CommissionRule>();
  readonly earnings = new Map<string, EarningEntry>();
  readonly earningsByOrder = new Map<string, string>();
  readonly cycles = new Map<string, SettlementCycle>();

  async saveRule(rule: CommissionRule): Promise<void> {
    await tick();
    this.rules.set(rule.id, { ...rule });
  }
  async findRule(ruleId: string): Promise<CommissionRule | null> {
    await tick();
    const rule = this.rules.get(ruleId);
    return rule ? { ...rule } : null;
  }
  async listRules(query: {
    scope?: string;
    partnerId?: string;
    status?: string;
  }): Promise<CommissionRule[]> {
    await tick();
    return [...this.rules.values()]
      .filter((rule) => query.scope === undefined || rule.scope === query.scope)
      .filter((rule) => query.partnerId === undefined || rule.partnerId === query.partnerId)
      .filter((rule) => query.status === undefined || rule.status === query.status)
      .map((rule) => ({ ...rule }));
  }
  async saveEarning(earning: EarningEntry): Promise<void> {
    await tick();
    this.earnings.set(earning.id, { ...earning });
    this.earningsByOrder.set(earning.orderId, earning.id);
  }
  async findEarning(earningId: string): Promise<EarningEntry | null> {
    await tick();
    const earning = this.earnings.get(earningId);
    return earning ? { ...earning } : null;
  }
  async findEarningByOrderId(orderId: string): Promise<EarningEntry | null> {
    await tick();
    const id = this.earningsByOrder.get(orderId);
    if (!id) return null;
    const earning = this.earnings.get(id);
    return earning ? { ...earning } : null;
  }
  async listEarnings(partnerId?: string): Promise<EarningEntry[]> {
    await tick();
    return [...this.earnings.values()]
      .filter((earning) => partnerId === undefined || earning.partnerId === partnerId)
      .map((earning) => ({ ...earning }));
  }
  async saveCycle(cycle: SettlementCycle): Promise<void> {
    await tick();
    this.cycles.set(cycle.id, { ...cycle });
  }
  async findCycle(cycleId: string): Promise<SettlementCycle | null> {
    await tick();
    const cycle = this.cycles.get(cycleId);
    return cycle ? { ...cycle } : null;
  }
  async listCycles(partnerId?: string, state?: CycleState): Promise<SettlementCycle[]> {
    await tick();
    return [...this.cycles.values()]
      .filter((cycle) => partnerId === undefined || cycle.partnerId === partnerId)
      .filter((cycle) => state === undefined || cycle.state === state)
      .map((cycle) => ({ ...cycle }));
  }
}

const RULE = { scope: 'global', commissionBp: 2000 } as const;

async function seedGlobalRule(service: SettlementService, commissionBp = 2000) {
  return service.createRule({ scope: 'global', commissionBp });
}

async function seedEarning(
  service: SettlementService,
  orderId: string,
  overrides: Record<string, unknown> = {},
) {
  return service.createEarning({
    orderId,
    partnerId: 'partner_1',
    grossPaise: 10_000,
    ...overrides,
  });
}

describe('SettlementService', () => {
  let repo: InMemorySettlementRepository;
  let service: SettlementService;

  beforeEach(() => {
    repo = new InMemorySettlementRepository();
    service = new SettlementService(repo);
  });

  describe('commission rules', () => {
    it('creates an active global rule at version 1', async () => {
      const rule = await seedGlobalRule(service);
      expect(rule.id).toMatch(/^cr_/);
      expect(rule).toMatchObject({
        scope: 'global',
        version: 1,
        status: 'active',
        commissionBp: 2000,
        fixedFeePaise: 0,
      });
      expect(rule.partnerId).toBeUndefined();
    });

    it('requires partnerId for partner scope', async () => {
      await expect(
        service.createRule({ scope: 'partner', commissionBp: 1000 }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects partnerId on global scope', async () => {
      await expect(
        service.createRule({ scope: 'global', partnerId: 'partner_1', commissionBp: 1000 }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('supersedes the active rule with the next version', async () => {
      const first = await seedGlobalRule(service, 2000);
      const second = await seedGlobalRule(service, 2500);
      expect(second.version).toBe(2);
      expect(second.status).toBe('active');
      const previous = await service.getRule(first.id);
      expect(previous.status).toBe('archived');
      const rules = await service.listRules({ scope: 'global' });
      expect(rules.map((rule) => rule.version)).toEqual([2, 1]);
    });

    it('versions partner rules independently from global rules', async () => {
      await seedGlobalRule(service, 2000);
      const partnerRule = await service.createRule({
        scope: 'partner',
        partnerId: 'partner_1',
        commissionBp: 1500,
      });
      expect(partnerRule.version).toBe(1);
      await seedGlobalRule(service, 2100);
      const partnerRule2 = await service.createRule({
        scope: 'partner',
        partnerId: 'partner_1',
        commissionBp: 1600,
      });
      expect(partnerRule2.version).toBe(2);
    });

    it('archives an active rule and rejects double archiving', async () => {
      const rule = await seedGlobalRule(service);
      const archived = await service.archiveRule(rule.id);
      expect(archived.status).toBe('archived');
      await expect(service.archiveRule(rule.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('returns NOT_FOUND for an unknown rule', async () => {
      const missing = `cr_${'0'.repeat(32)}`;
      await expect(service.getRule(missing)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(service.archiveRule(missing)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('filters rules by status and partner', async () => {
      await seedGlobalRule(service, 2000);
      const partnerRule = await service.createRule({
        scope: 'partner',
        partnerId: 'partner_1',
        commissionBp: 1500,
      });
      await service.archiveRule(partnerRule.id);

      const active = await service.listRules({ status: 'active' });
      expect(active).toHaveLength(1);
      expect(active[0]?.scope).toBe('global');

      const partnerRules = await service.listRules({ partnerId: 'partner_1' });
      expect(partnerRules).toHaveLength(1);
      expect(partnerRules[0]?.status).toBe('archived');
    });
  });

  describe('earnings', () => {
    it('computes commission and payable from the active global rule', async () => {
      await seedGlobalRule(service, 2000);
      const earning = await seedEarning(service, ORD('a1'));
      expect(earning).toMatchObject({
        commissionPaise: 2000,
        fixedFeePaise: 0,
        partnerPayablePaise: 8000,
        ruleVersion: 1,
      });
      expect(earning.id).toMatch(/^ern_/);
    });

    it('applies fixed fees, delivery contribution and adjustments', async () => {
      await service.createRule({
        scope: 'global',
        commissionBp: 2000,
        fixedFeePaise: 500,
      });
      const earning = await seedEarning(service, ORD('a2'), {
        deliveryContributionPaise: 300,
        adjustmentPaise: 100,
      });
      expect(earning.commissionPaise).toBe(2000);
      expect(earning.fixedFeePaise).toBe(500);
      expect(earning.partnerPayablePaise).toBe(10_000 - 2000 - 500 + 300 - 100);
    });

    it('keeps tax informational: it does not change partner payable', async () => {
      await seedGlobalRule(service, 2000);
      const withoutTax = await seedEarning(service, ORD('a3'));
      const withTax = await seedEarning(service, ORD('a4'), { taxPaise: 777 });
      expect(withTax.partnerPayablePaise).toBe(withoutTax.partnerPayablePaise);
      expect(withTax.taxPaise).toBe(777);
    });

    it('prefers a partner rule over the global rule', async () => {
      await seedGlobalRule(service, 2000);
      await service.createRule({
        scope: 'partner',
        partnerId: 'partner_1',
        commissionBp: 1000,
      });
      const earning = await seedEarning(service, ORD('a5'));
      expect(earning.commissionPaise).toBe(1000);
      expect(earning.ruleVersion).toBe(1);
    });

    it('rounds commission to whole paise', async () => {
      await seedGlobalRule(service, 3333);
      const earning = await seedEarning(service, ORD('a6'), { grossPaise: 999 });
      expect(earning.commissionPaise).toBe(333);
    });

    it('rejects earning creation without an active rule', async () => {
      await expect(seedEarning(service, ORD('a7'))).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects a duplicate earning for the same order', async () => {
      await seedGlobalRule(service);
      await seedEarning(service, ORD('a8'));
      await expect(seedEarning(service, ORD('a8'))).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('returns NOT_FOUND for an unknown earning', async () => {
      const missing = `ern_${'0'.repeat(32)}`;
      await expect(service.getEarning(missing)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('lists earnings per partner with a limit', async () => {
      await seedGlobalRule(service);
      await seedEarning(service, ORD('a9'));
      await seedEarning(service, ORD('b0'));
      await service.createRule({
        scope: 'partner',
        partnerId: 'partner_2',
        commissionBp: 1000,
      });
      await service.createEarning({
        orderId: ORD('b1'),
        partnerId: 'partner_2',
        grossPaise: 500,
      });

      const all = await service.listEarnings({});
      expect(all).toHaveLength(3);
      const mine = await service.listEarnings({ partnerId: 'partner_1' });
      expect(mine).toHaveLength(2);
      const limited = await service.listEarnings({ limit: 1 });
      expect(limited).toHaveLength(1);
    });
  });

  describe('settlement cycles', () => {
    it('creates an open cycle with zero totals', async () => {
      const cycle = await service.createCycle({ partnerId: 'partner_1' });
      expect(cycle.id).toMatch(/^sty_/);
      expect(cycle).toMatchObject({ state: 'open', earningCount: 0, payablePaise: 0 });
    });

    it('rejects a second open cycle for the same partner', async () => {
      await service.createCycle({ partnerId: 'partner_1' });
      await expect(service.createCycle({ partnerId: 'partner_1' })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('closes a cycle with frozen totals from eligible earnings', async () => {
      await seedGlobalRule(service);
      await seedEarning(service, ORD('c1'));
      await seedEarning(service, ORD('c2'), { grossPaise: 5000 });
      const cycle = await service.createCycle({ partnerId: 'partner_1' });
      const closed = await service.closeCycle(cycle.id);

      expect(closed.state).toBe('closed');
      expect(closed.earningCount).toBe(2);
      expect(closed.grossPaise).toBe(15_000);
      expect(closed.commissionPaise).toBe(3000);
      expect(closed.payablePaise).toBe(12_000);
      expect(closed.earningIds).toHaveLength(2);
    });

    it('rejects closing a cycle with no eligible earnings', async () => {
      const cycle = await service.createCycle({ partnerId: 'partner_1' });
      await expect(service.closeCycle(cycle.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('includes earnings created while the cycle was open', async () => {
      await seedGlobalRule(service);
      await seedEarning(service, ORD('c3'));
      const cycle = await service.createCycle({ partnerId: 'partner_1' });
      await smallDelay();
      await seedEarning(service, ORD('c4'));
      const closed = await service.closeCycle(cycle.id);
      expect(closed.earningCount).toBe(2);
      expect(closed.grossPaise).toBe(20_000);
    });

    it('rejects closing twice and closing non-open cycles', async () => {
      await seedGlobalRule(service);
      await seedEarning(service, ORD('c5'));
      const cycle = await service.createCycle({ partnerId: 'partner_1' });
      const closed = await service.closeCycle(cycle.id);
      await expect(service.closeCycle(closed.id)).rejects.toMatchObject({ code: 'CONFLICT' });
      const completed = await service.completeCycle(closed.id);
      await expect(service.closeCycle(completed.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('locks settled earnings out of the next cycle', async () => {
      await seedGlobalRule(service);
      await seedEarning(service, ORD('c6'));
      await seedEarning(service, ORD('c7'));
      const first = await service.createCycle({ partnerId: 'partner_1' });
      const firstClosed = await service.closeCycle(first.id);
      await service.completeCycle(firstClosed.id);

      await smallDelay();
      const second = await service.createCycle({ partnerId: 'partner_1' });
      await expect(service.closeCycle(second.id)).rejects.toMatchObject({ code: 'CONFLICT' });

      await seedEarning(service, ORD('c8'));
      const secondClosed = await service.closeCycle(second.id);
      expect(secondClosed.earningCount).toBe(1);
      expect(secondClosed.grossPaise).toBe(10_000);
    });

    it('completes a closed cycle and rejects any other state', async () => {
      await seedGlobalRule(service);
      await seedEarning(service, ORD('c9'));
      const cycle = await service.createCycle({ partnerId: 'partner_1' });
      await expect(service.completeCycle(cycle.id)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      const closed = await service.closeCycle(cycle.id);
      const completed = await service.completeCycle(closed.id);
      expect(completed.state).toBe('completed');
      expect(completed.decidedAt).toBeDefined();
      await expect(service.completeCycle(completed.id)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('fails a closed cycle with a reason and releases its earnings', async () => {
      await seedGlobalRule(service);
      await seedEarning(service, ORD('d1'));
      const cycle = await service.createCycle({ partnerId: 'partner_1' });
      await expect(service.failCycle(cycle.id, { reason: 'bank rejected' })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      const closed = await service.closeCycle(cycle.id);
      const failed = await service.failCycle(closed.id, { reason: 'bank rejected' });
      expect(failed.state).toBe('failed');
      expect(failed.failReason).toBe('bank rejected');

      await smallDelay();
      const retry = await service.createCycle({ partnerId: 'partner_1' });
      const retried = await service.closeCycle(retry.id);
      expect(retried.earningCount).toBe(1);
      await expect(service.failCycle(failed.id, { reason: 'x' })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('lists cycles by partner and state', async () => {
      await seedGlobalRule(service);
      await seedEarning(service, ORD('d2'));
      const first = await service.createCycle({ partnerId: 'partner_1' });
      await service.closeCycle(first.id);
      await service.createCycle({ partnerId: 'partner_2' });

      const open = await service.listCycles({ state: 'open' });
      expect(open).toHaveLength(1);
      expect(open[0]?.partnerId).toBe('partner_2');
      const closed = await service.listCycles({ partnerId: 'partner_1', state: 'closed' });
      expect(closed).toHaveLength(1);
    });

    it('returns NOT_FOUND for an unknown cycle', async () => {
      const missing = `sty_${'0'.repeat(32)}`;
      await expect(service.getCycle(missing)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(service.closeCycle(missing)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(service.completeCycle(missing)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(service.failCycle(missing, { reason: 'x' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(service.reconcile(missing)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects opening a cycle for an invalid partner id at schema level', async () => {
      await expect(service.createCycle({ partnerId: 'bad id!' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('reconciliation', () => {
    it('rejects reconciling an open cycle', async () => {
      const cycle = await service.createCycle({ partnerId: 'partner_1' });
      await expect(service.reconcile(cycle.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('reports a balanced reconciliation after close', async () => {
      await seedGlobalRule(service);
      await seedEarning(service, ORD('e1'));
      await seedEarning(service, ORD('e2'), { grossPaise: 4000 });
      const cycle = await service.createCycle({ partnerId: 'partner_1' });
      const closed = await service.closeCycle(cycle.id);

      const report = await service.reconcile(closed.id);
      expect(report.balanced).toBe(true);
      expect(report.deltaPayablePaise).toBe(0);
      expect(report.frozen).toEqual(report.derived);
      expect(report.frozen.payablePaise).toBe(14_000 - 2800);
      expect(report.state).toBe('closed');
    });

    it('detects drift when a settled earning has been tampered with', async () => {
      await seedGlobalRule(service);
      const earning = await seedEarning(service, ORD('e3'));
      const cycle = await service.createCycle({ partnerId: 'partner_1' });
      const closed = await service.closeCycle(cycle.id);

      const stored = repo.earnings.get(earning.id)!;
      stored.partnerPayablePaise += 500;

      const report = await service.reconcile(closed.id);
      expect(report.balanced).toBe(false);
      expect(report.deltaPayablePaise).toBe(500);
      expect(report.derived.payablePaise).toBe(report.frozen.payablePaise + 500);
    });

    it('detects a missing settled earning', async () => {
      await seedGlobalRule(service);
      const earning = await seedEarning(service, ORD('e4'));
      const cycle = await service.createCycle({ partnerId: 'partner_1' });
      const closed = await service.closeCycle(cycle.id);
      repo.earnings.delete(earning.id);

      const report = await service.reconcile(closed.id);
      expect(report.balanced).toBe(false);
      expect(report.derived.earningCount).toBe(0);
      expect(report.derived.payablePaise).toBe(0);
    });
  });

  describe('concurrency', () => {
    it('lets only one of two racing cycle creations win', async () => {
      const results = await Promise.allSettled([
        service.createCycle({ partnerId: 'partner_1' }),
        service.createCycle({ partnerId: 'partner_1' }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const open = await service.listCycles({ partnerId: 'partner_1', state: 'open' });
      expect(open).toHaveLength(1);
    });

    it('lets only one of two racing earnings for the same order win', async () => {
      await seedGlobalRule(service);
      const results = await Promise.allSettled([
        seedEarning(service, ORD('ff')),
        seedEarning(service, ORD('ff')),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const earnings = await service.listEarnings({});
      expect(earnings).toHaveLength(1);
    });
  });

  describe('staging adapter', () => {
    it('blocks every repository operation with 503', async () => {
      const staging = new StagingSettlementRepository();
      await expect(staging.listRules({})).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      });
      await expect(staging.saveRule({} as CommissionRule)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(staging.saveEarning({} as EarningEntry)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(staging.findCycle('sty_1')).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(staging.listCycles()).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    });

    it('surfaces 503 through the service', async () => {
      const stagingService = new SettlementService(new StagingSettlementRepository());
      await expect(stagingService.createRule({ ...RULE })).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(stagingService.listEarnings({})).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(stagingService.createCycle({ partnerId: 'partner_1' })).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    });
  });
});
