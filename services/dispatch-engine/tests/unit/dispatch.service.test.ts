import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '@localwala/errors';
import {
  StagingDriverDirectory,
  type DriverDirectory,
} from '../../src/dispatch/driver-directory.js';
import {
  StagingDispatchRepository,
  type AssignmentQuery,
  type DispatchRepository,
} from '../../src/dispatch/dispatch.repository.js';
import { DispatchService } from '../../src/dispatch/dispatch.service.js';
import { filterCandidates, scoreCandidates } from '../../src/dispatch/scoring.js';
import {
  DEFAULT_DISPATCH_POLICY,
  type Assignment,
  type DispatchPolicy,
  type DriverCandidate,
} from '../../src/dispatch/dispatch.types.js';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

const DELIVERY = `dlv_${'a1b2c3d4'.repeat(4)}`;
const DELIVERY_2 = `dlv_${'b1b2c3d4'.repeat(4)}`;
const ZONE = 'zone_central';

const policy = (): DispatchPolicy => ({ ...DEFAULT_DISPATCH_POLICY, updatedAt: 1 });

const candidate = (
  driverId: string,
  overrides: Partial<DriverCandidate> = {},
): DriverCandidate => ({
  driverId,
  zoneIds: [ZONE],
  vehicleType: 'motorcycle',
  capacityKg: 20,
  distanceKm: 2,
  workload: 0,
  ...overrides,
});

class InMemoryDispatchRepository implements DispatchRepository {
  readonly assignments = new Map<string, Assignment>();
  storedPolicy: DispatchPolicy | null = null;

  async saveAssignment(assignment: Assignment): Promise<void> {
    await tick();
    this.assignments.set(assignment.id, structuredClone(assignment));
  }
  async findAssignment(assignmentId: string): Promise<Assignment | null> {
    await tick();
    const assignment = this.assignments.get(assignmentId);
    return assignment ? structuredClone(assignment) : null;
  }
  async findActiveAssignmentByDelivery(deliveryId: string): Promise<Assignment | null> {
    await tick();
    for (const assignment of this.assignments.values()) {
      if (
        assignment.deliveryId === deliveryId &&
        (assignment.state === 'offered' || assignment.state === 'claimed')
      ) {
        return structuredClone(assignment);
      }
    }
    return null;
  }
  async listAssignments(query: AssignmentQuery): Promise<Assignment[]> {
    await tick();
    return [...this.assignments.values()]
      .filter(
        (assignment) =>
          query.deliveryId === undefined || assignment.deliveryId === query.deliveryId,
      )
      .filter(
        (assignment) => query.driverId === undefined || assignment.driverId === query.driverId,
      )
      .filter((assignment) => query.state === undefined || assignment.state === query.state)
      .slice(0, query.limit ?? 50)
      .map((assignment) => structuredClone(assignment));
  }
  async savePolicy(policyRecord: DispatchPolicy): Promise<void> {
    await tick();
    this.storedPolicy = structuredClone(policyRecord);
  }
  async findPolicy(): Promise<DispatchPolicy | null> {
    await tick();
    return this.storedPolicy ? structuredClone(this.storedPolicy) : null;
  }
}

class FakeDriverDirectory implements DriverDirectory {
  candidates: DriverCandidate[] = [];
  calls = 0;

  async findCandidates(): Promise<DriverCandidate[]> {
    this.calls += 1;
    return this.candidates.map((entry) => ({ ...entry }));
  }
}

const expectError = async (operation: Promise<unknown>, code: string) => {
  const error = await operation.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  return error as AppError;
};

describe('scoring', () => {
  it('filters by distance, zone, vehicle type and capacity', () => {
    const candidates = [
      candidate('drv_near', { distanceKm: 3 }),
      candidate('drv_far', { distanceKm: 30 }),
      candidate('drv_other_zone', { zoneIds: ['zone_north'] }),
      candidate('drv_bike', { vehicleType: 'bicycle' }),
      candidate('drv_small', { capacityKg: 5 }),
    ];
    const eligible = filterCandidates(candidates, {
      zoneId: ZONE,
      requiredVehicleType: 'motorcycle',
      requiredCapacityKg: 10,
      maxDistanceKm: 10,
    });
    expect(eligible.map((entry) => entry.driverId)).toEqual(['drv_near']);
  });

  it('scores closer drivers higher and applies zone bonus and workload penalty', () => {
    const scored = scoreCandidates(
      [
        candidate('drv_near_zero_work', { distanceKm: 1, workload: 0 }),
        candidate('drv_far', { distanceKm: 8, workload: 0 }),
        candidate('drv_busy', { distanceKm: 1, workload: 3 }),
        candidate('drv_wrong_zone', { distanceKm: 1, zoneIds: ['zone_north'] }),
      ],
      policy(),
      { zoneId: ZONE, maxDistanceKm: 10 },
    );
    expect(scored.map((entry) => entry.candidate.driverId)).toEqual([
      'drv_near_zero_work',
      'drv_wrong_zone',
      'drv_far',
      'drv_busy',
    ]);
    expect(scored[0]?.score).toBe(140);
    expect(scored[1]?.score).toBe(90);
    expect(scored[2]?.score).toBe(70);
    expect(scored[3]?.score).toBe(65);
  });
});

describe('DispatchService', () => {
  let repo: InMemoryDispatchRepository;
  let directory: FakeDriverDirectory;
  let service: DispatchService;

  beforeEach(() => {
    repo = new InMemoryDispatchRepository();
    directory = new FakeDriverDirectory();
    directory.candidates = [
      candidate('drv_a', { distanceKm: 3 }),
      candidate('drv_b', { distanceKm: 1 }),
      candidate('drv_c', { distanceKm: 5, workload: 2 }),
    ];
    service = new DispatchService(repo, directory);
  });

  describe('policy', () => {
    it('returns the built-in default when nothing is stored', async () => {
      const current = await service.getPolicy();
      expect(current.key).toBe('default');
      expect(current.maxDistanceKm).toBe(10);
      expect(current.offerTimeoutSeconds).toBe(120);
      expect(current.updatedAt).toBe(0);
    });

    it('merges partial policy updates', async () => {
      const updated = await service.setPolicy({ maxDistanceKm: 25, distanceWeight: 15 });
      expect(updated.maxDistanceKm).toBe(25);
      expect(updated.distanceWeight).toBe(15);
      expect(updated.sameZoneBonus).toBe(50);
      expect(updated.workloadPenalty).toBe(25);
      const stored = await service.getPolicy();
      expect(stored.maxDistanceKm).toBe(25);
    });

    it('rejects an empty policy update', async () => {
      await expectError(service.setPolicy({}), 'VALIDATION_ERROR');
    });
  });

  describe('candidate preview', () => {
    it('returns filtered, scored candidates sorted best first', async () => {
      const candidates = await service.previewCandidates({
        deliveryId: DELIVERY,
        zoneId: ZONE,
      });
      expect(candidates.map((entry) => entry.driverId)).toEqual(['drv_b', 'drv_a', 'drv_c']);
      expect(directory.calls).toBe(1);
    });

    it('returns an empty list when nothing is eligible', async () => {
      directory.candidates = [candidate('drv_far', { distanceKm: 50 })];
      const candidates = await service.previewCandidates({
        deliveryId: DELIVERY,
        zoneId: ZONE,
      });
      expect(candidates).toEqual([]);
    });
  });

  describe('offers', () => {
    it('offers to the best candidate with an expiry', async () => {
      const offer = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      expect(assignmentId(offer)).toMatch(/^asg_[0-9a-f]{32}$/);
      expect(offer.state).toBe('offered');
      expect(offer.driverId).toBe('drv_b');
      expect(offer.offerExpiresAt).toBeGreaterThan(Date.now());
      expect(offer.history.map((entry) => entry.event)).toEqual(['offered']);
    });

    it('honours a custom offer timeout', async () => {
      const before = Date.now();
      const offer = await service.createOffer({
        deliveryId: DELIVERY,
        zoneId: ZONE,
        offerTimeoutSeconds: 15,
      });
      expect(offer.offerExpiresAt).toBeGreaterThanOrEqual(before + 15_000);
    });

    it('rejects an offer when no driver is eligible', async () => {
      directory.candidates = [candidate('drv_far', { distanceKm: 50 })];
      await expectError(service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE }), 'CONFLICT');
      expect(repo.assignments.size).toBe(0);
    });

    it('prevents a second offer while an assignment is active', async () => {
      await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      await expectError(service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE }), 'CONFLICT');
    });

    it('allows a new offer after the previous one times out', async () => {
      const first = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      await service.timeoutOffer(assignmentId(first));
      const second = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      expect(second.state).toBe('offered');
      expect(second.id).not.toBe(first.id);
    });

    it('offers the next best candidate after a timeout instead of retrying the same driver', async () => {
      const first = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      expect(first.driverId).toBe('drv_b');
      await service.timeoutOffer(assignmentId(first));
      const second = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      expect(second.driverId).toBe('drv_a');
      await service.rejectOffer(assignmentId(second), {});
      const third = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      expect(third.driverId).toBe('drv_c');
    });

    it('runs out of candidates once every driver has been offered', async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const offer = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
        await service.timeoutOffer(assignmentId(offer));
      }
      await expectError(service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE }), 'CONFLICT');
    });

    it('allows a new offer after the previous one is rejected', async () => {
      const first = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      await service.rejectOffer(assignmentId(first), {});
      const second = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      expect(second.driverId).toBe('drv_a');
    });

    it('serialises racing offers so exactly one wins', async () => {
      const results = await Promise.allSettled([
        service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE }),
        service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
      expect(await repo.findActiveAssignmentByDelivery(DELIVERY)).not.toBeNull();
    });
  });

  describe('accepting offers', () => {
    it('claims an open offer', async () => {
      const offer = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      const claimed = await service.acceptOffer(assignmentId(offer));
      expect(claimed.state).toBe('claimed');
      expect(claimed.history.map((entry) => entry.event)).toEqual(['offered', 'accepted']);
      expect(claimed.history[1]?.actor).toBe('driver');
    });

    it('rejects a second accept of the same offer (double-assignment prevention)', async () => {
      const offer = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      await service.acceptOffer(assignmentId(offer));
      await expectError(service.acceptOffer(assignmentId(offer)), 'CONFLICT');
    });

    it('serialises racing accepts so exactly one driver wins the claim', async () => {
      const offer = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      const results = await Promise.allSettled([
        service.acceptOffer(assignmentId(offer)),
        service.acceptOffer(assignmentId(offer)),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected');
      expect((rejected as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT' });
      expect((await service.getAssignment(assignmentId(offer))).state).toBe('claimed');
    });

    it('expires an offer lazily on accept', async () => {
      const offer = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      const record = repo.assignments.get(assignmentId(offer));
      record!.offerExpiresAt = Date.now() - 1;
      await expectError(service.acceptOffer(assignmentId(offer)), 'CONFLICT');
      expect((await service.getAssignment(assignmentId(offer))).state).toBe('timeout');
    });

    it('rejects accept after timeout or rejection', async () => {
      const offer = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      await service.timeoutOffer(assignmentId(offer));
      await expectError(service.acceptOffer(assignmentId(offer)), 'CONFLICT');
      const second = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      await service.rejectOffer(assignmentId(second), { reason: 'busy' });
      await expectError(service.acceptOffer(assignmentId(second)), 'CONFLICT');
    });

    it('returns 404 for an unknown offer', async () => {
      await expectError(service.acceptOffer(`asg_${'a'.repeat(32)}`), 'NOT_FOUND');
    });
  });

  describe('rejecting and timing out offers', () => {
    it('rejects an open offer with an optional reason', async () => {
      const offer = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      const rejected = await service.rejectOffer(assignmentId(offer), {
        reason: 'on a break',
      });
      expect(rejected.state).toBe('rejected');
      expect(rejected.history.at(-1)?.reason).toBe('on a break');
    });

    it('only rejects open offers', async () => {
      const offer = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      await service.acceptOffer(assignmentId(offer));
      await expectError(service.rejectOffer(assignmentId(offer), {}), 'CONFLICT');
    });

    it('times out an open offer only once', async () => {
      const offer = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      const timedOut = await service.timeoutOffer(assignmentId(offer));
      expect(timedOut.state).toBe('timeout');
      await expectError(service.timeoutOffer(assignmentId(offer)), 'CONFLICT');
    });
  });

  describe('manual assignment', () => {
    it('claims a delivery directly for a chosen driver', async () => {
      const assignment = await service.manualAssign({
        deliveryId: DELIVERY,
        driverId: `drv_${'f'.repeat(32)}`,
        reason: 'phone dispatch',
      });
      expect(assignment.state).toBe('claimed');
      expect(assignment.history[0]?.event).toBe('manual_assigned');
      expect(assignment.history[0]?.actor).toBe('admin');
    });

    it('blocks manual assignment while an offer is active', async () => {
      await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      await expectError(
        service.manualAssign({ deliveryId: DELIVERY, driverId: `drv_${'f'.repeat(32)}` }),
        'CONFLICT',
      );
    });

    it('serialises a racing offer and manual assignment', async () => {
      const results = await Promise.allSettled([
        service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE }),
        service.manualAssign({ deliveryId: DELIVERY, driverId: `drv_${'f'.repeat(32)}` }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    });
  });

  describe('reassignment and release', () => {
    const claimedAssignment = async () => {
      const assignment = await service.manualAssign({
        deliveryId: DELIVERY,
        driverId: `drv_${'1'.repeat(32)}`,
      });
      return assignment;
    };

    it('reassigns a claimed delivery to a new driver', async () => {
      const first = await claimedAssignment();
      const replacement = await service.reassign(assignmentId(first), {
        driverId: `drv_${'2'.repeat(32)}`,
        reason: 'driver unresponsive',
      });
      expect(replacement.id).not.toBe(first.id);
      expect(replacement.state).toBe('claimed');
      expect(replacement.driverId).toBe(`drv_${'2'.repeat(32)}`);
      expect((await service.getAssignment(assignmentId(first))).state).toBe('released');
      expect((await service.getAssignment(assignmentId(first))).history.at(-1)?.event).toBe(
        'released',
      );
      expect(replacement.history.map((entry) => entry.event)).toEqual(['reassigned']);
    });

    it('requires a reason to reassign', async () => {
      const first = await claimedAssignment();
      await expectError(
        service.reassign(assignmentId(first), { driverId: `drv_${'2'.repeat(32)}` }),
        'VALIDATION_ERROR',
      );
    });

    it('cannot reassign a non-claimed assignment', async () => {
      const offer = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      await expectError(
        service.reassign(assignmentId(offer), {
          driverId: `drv_${'2'.repeat(32)}`,
          reason: 'swap',
        }),
        'CONFLICT',
      );
    });

    it('serialises racing reassignments of the same delivery', async () => {
      const first = await claimedAssignment();
      const results = await Promise.allSettled([
        service.reassign(assignmentId(first), {
          driverId: `drv_${'2'.repeat(32)}`,
          reason: 'one',
        }),
        service.reassign(assignmentId(first), {
          driverId: `drv_${'3'.repeat(32)}`,
          reason: 'two',
        }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    });

    it('releases a claimed or offered assignment', async () => {
      const first = await claimedAssignment();
      const released = await service.release(assignmentId(first), { reason: 'order cancelled' });
      expect(released.state).toBe('released');
      await expectError(service.release(assignmentId(first), {}), 'CONFLICT');
    });

    it('frees the delivery for a new offer after release', async () => {
      const first = await claimedAssignment();
      await service.release(assignmentId(first), { reason: 'cancelled' });
      const offer = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      expect(offer.state).toBe('offered');
    });
  });

  describe('queries', () => {
    it('filters assignments by delivery, driver and state', async () => {
      await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      await service.createOffer({ deliveryId: DELIVERY_2, zoneId: ZONE });
      expect(await service.listAssignments({ deliveryId: DELIVERY })).toHaveLength(1);
      expect(await service.listAssignments({ state: 'offered' })).toHaveLength(2);
      expect(await service.listAssignments({ state: 'claimed' })).toHaveLength(0);
      expect(await service.listAssignments({ driverId: `drv_${'a'.repeat(32)}` })).toHaveLength(0);
    });

    it('returns assignment history', async () => {
      const offer = await service.createOffer({ deliveryId: DELIVERY, zoneId: ZONE });
      await service.acceptOffer(assignmentId(offer));
      const history = await service.getHistory(assignmentId(offer));
      expect(history.map((entry) => entry.event)).toEqual(['offered', 'accepted']);
      await expectError(service.getHistory(`asg_${'b'.repeat(32)}`), 'NOT_FOUND');
    });
  });
});

describe('staging dispatch repository', () => {
  const repo = new StagingDispatchRepository();
  const expectBlocked = async (operation: Promise<unknown>) => {
    const error = await operation.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('SERVICE_UNAVAILABLE');
    expect((error as AppError).message).toContain('PostgreSQL not available');
  };

  it('blocks assignment and policy operations', async () => {
    await expectBlocked(repo.saveAssignment({} as Assignment));
    await expectBlocked(repo.findAssignment('asg_x'));
    await expectBlocked(repo.findActiveAssignmentByDelivery('dlv_x'));
    await expectBlocked(repo.listAssignments({}));
    await expectBlocked(repo.savePolicy({} as DispatchPolicy));
    await expectBlocked(repo.findPolicy());
  });
});

describe('staging driver directory', () => {
  it('blocks candidate lookups', async () => {
    const directory = new StagingDriverDirectory();
    const error = await directory.findCandidates({}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('SERVICE_UNAVAILABLE');
    expect((error as AppError).message).toContain('Driver directory not configured');
  });
});

function assignmentId(assignment: Assignment): string {
  return assignment.id;
}
