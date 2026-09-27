import type { DispatchPolicy, DriverCandidate, ScoredCandidate } from './dispatch.types.js';

export interface EligibilityCriteria {
  zoneId?: string;
  requiredVehicleType?: string;
  requiredCapacityKg?: number;
  maxDistanceKm: number;
}

export function isEligible(candidate: DriverCandidate, criteria: EligibilityCriteria): boolean {
  if (candidate.distanceKm > criteria.maxDistanceKm) return false;
  if (criteria.zoneId !== undefined && !candidate.zoneIds.includes(criteria.zoneId)) {
    return false;
  }
  if (
    criteria.requiredVehicleType !== undefined &&
    candidate.vehicleType !== criteria.requiredVehicleType
  ) {
    return false;
  }
  if (
    criteria.requiredCapacityKg !== undefined &&
    (candidate.capacityKg ?? 0) < criteria.requiredCapacityKg
  ) {
    return false;
  }
  return true;
}

export function filterCandidates(
  candidates: DriverCandidate[],
  criteria: EligibilityCriteria,
): DriverCandidate[] {
  return candidates.filter((candidate) => isEligible(candidate, criteria));
}

export function scoreCandidates(
  candidates: DriverCandidate[],
  policy: DispatchPolicy,
  criteria: EligibilityCriteria,
): ScoredCandidate[] {
  return candidates
    .map((candidate) => ({
      candidate,
      score: computeScore(candidate, policy, criteria),
    }))
    .sort((a, b) => b.score - a.score || a.candidate.driverId.localeCompare(b.candidate.driverId));
}

export function computeScore(
  candidate: DriverCandidate,
  policy: DispatchPolicy,
  criteria: EligibilityCriteria,
): number {
  const distancePart =
    Math.max(0, criteria.maxDistanceKm - candidate.distanceKm) * policy.distanceWeight;
  const sameZone =
    criteria.zoneId !== undefined && candidate.zoneIds.includes(criteria.zoneId)
      ? policy.sameZoneBonus
      : 0;
  const workloadPenalty = candidate.workload * policy.workloadPenalty;
  return Math.round((distancePart + sameZone - workloadPenalty) * 100) / 100;
}
