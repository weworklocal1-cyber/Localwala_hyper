export const SUBJECT_TYPES = ['delivery', 'driver'] as const;

export type SubjectType = (typeof SUBJECT_TYPES)[number];

export interface LocationPoint {
  lat: number;
  lng: number;
  speedKph?: number;
  heading?: number;
  accuracyM?: number;
  recordedAt: number;
}

export interface TrackingSnapshot {
  subjectType: SubjectType;
  subjectId: string;
  sequence: number;
  startedAt: number;
  updatedAt: number;
  last: LocationPoint;
  trail: LocationPoint[];
}

export const MAX_TRAIL_POINTS = 200;

export const DELIVERY_ID_PATTERN = '^dlv_[0-9a-f]{32}$';
export const DRIVER_ID_PATTERN = '^drv_[0-9a-f]{32}$';
export const MAX_RECORDED_AT_MS = 4102444800000;

export function subjectKey(subjectType: SubjectType, subjectId: string): string {
  return `${subjectType}:${subjectId}`;
}
