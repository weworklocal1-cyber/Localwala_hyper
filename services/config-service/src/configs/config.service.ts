import { AppError } from '@localwala/errors';
import { validateConfigPayload } from '../schemas/config.schema.js';
import type { ConfigRepository } from './config.repository.js';
import {
  CONVENTIONAL_KEYS,
  SCOPE_SPECIFICITY,
  newConfigId,
  type ConfigEnvironment,
  type ConfigRecord,
  type ConfigScope,
  type ConfigState,
  type ConfigTargeting,
  type ConfigType,
  type ResolveContext,
  type ScopeType,
} from './config.types.js';

export interface CreateDraftInput {
  key: string;
  type: ConfigType;
  environment: ConfigEnvironment;
  payload: Record<string, unknown>;
  scope?: ConfigScope;
  targeting?: ConfigTargeting;
  activeFrom?: number;
  activeTo?: number;
  expiresAt?: number;
}

export interface UpdateDraftInput {
  payload?: Record<string, unknown>;
  scope?: ConfigScope;
  targeting?: ConfigTargeting;
  activeFrom?: number;
  activeTo?: number;
  expiresAt?: number;
}

const KEY_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export class ConfigService {
  constructor(private readonly repo: ConfigRepository) {}

  async createDraft(input: CreateDraftInput): Promise<ConfigRecord> {
    if (!KEY_PATTERN.test(input.key)) {
      throw new AppError('VALIDATION_ERROR', {
        message: 'key must match [A-Za-z0-9._-] and be 1-128 characters',
      });
    }
    validateScope(input.scope);
    validateTimeWindow(input.activeFrom, input.activeTo);
    validateConfigPayload(input.type, input.payload);

    const existing = await this.repo.findByKey(input.key, input.environment);
    const version = existing.reduce((max, record) => Math.max(max, record.version), 0) + 1;
    const now = Date.now();

    const record: ConfigRecord = {
      id: newConfigId(),
      key: input.key,
      type: input.type,
      environment: input.environment,
      version,
      state: 'draft',
      scope: input.scope ?? { type: 'global' },
      targeting: input.targeting,
      activeFrom: input.activeFrom,
      activeTo: input.activeTo,
      expiresAt: input.expiresAt,
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.save(record);
    return record;
  }

  async getRecord(id: string): Promise<ConfigRecord> {
    const record = await this.repo.findById(id);
    if (!record) {
      throw new AppError('NOT_FOUND', { message: `Config ${id} not found` });
    }
    return record;
  }

  async updateDraft(id: string, patch: UpdateDraftInput): Promise<ConfigRecord> {
    const record = await this.getRecord(id);
    assertState(record, ['draft'], 'update');
    if (patch.scope !== undefined) validateScope(patch.scope);
    if (patch.activeFrom !== undefined || patch.activeTo !== undefined) {
      validateTimeWindow(patch.activeFrom ?? record.activeFrom, patch.activeTo ?? record.activeTo);
    }
    if (patch.payload !== undefined) validateConfigPayload(record.type, patch.payload);

    const updated: ConfigRecord = {
      ...record,
      payload: patch.payload ?? record.payload,
      scope: patch.scope ?? record.scope,
      targeting: patch.targeting ?? record.targeting,
      activeFrom: patch.activeFrom ?? record.activeFrom,
      activeTo: patch.activeTo ?? record.activeTo,
      expiresAt: patch.expiresAt ?? record.expiresAt,
      updatedAt: Date.now(),
    };
    await this.repo.save(updated);
    return updated;
  }

  async schedule(id: string, scheduledFor: number): Promise<ConfigRecord> {
    const record = await this.getRecord(id);
    assertState(record, ['draft'], 'schedule');
    if (scheduledFor <= Date.now()) {
      throw new AppError('VALIDATION_ERROR', {
        message: 'scheduledFor must be a future timestamp',
      });
    }
    const scheduled: ConfigRecord = {
      ...record,
      state: 'scheduled',
      scheduledFor,
      updatedAt: Date.now(),
    };
    await this.repo.save(scheduled);
    return scheduled;
  }

  async publish(id: string): Promise<ConfigRecord> {
    const record = await this.getRecord(id);
    assertState(record, ['draft', 'scheduled'], 'publish');

    const siblings = await this.repo.findByKey(record.key, record.environment);
    const now = Date.now();
    for (const sibling of siblings) {
      if (
        sibling.state === 'published' &&
        sibling.id !== record.id &&
        sameScope(sibling.scope, record.scope)
      ) {
        await this.repo.save({ ...sibling, state: 'expired', updatedAt: now });
      }
    }

    const published: ConfigRecord = {
      ...record,
      state: 'published',
      publishedAt: now,
      updatedAt: now,
    };
    await this.repo.save(published);
    return published;
  }

  async expire(id: string): Promise<ConfigRecord> {
    const record = await this.getRecord(id);
    assertState(record, ['published', 'scheduled'], 'expire');
    const expired: ConfigRecord = { ...record, state: 'expired', updatedAt: Date.now() };
    await this.repo.save(expired);
    return expired;
  }

  async rollback(id: string): Promise<ConfigRecord> {
    const record = await this.getRecord(id);
    assertState(record, ['published'], 'rollback');

    const siblings = await this.repo.findByKey(record.key, record.environment);
    const previous = siblings
      .filter(
        (entry) =>
          entry.version < record.version &&
          entry.publishedAt !== undefined &&
          sameScope(entry.scope, record.scope),
      )
      .sort((a, b) => b.version - a.version)[0];
    if (!previous) {
      throw new AppError('CONFLICT', {
        message: `No previous published version to roll back to for key "${record.key}"`,
      });
    }

    const now = Date.now();
    await this.repo.save({ ...record, state: 'expired', updatedAt: now });
    const restored: ConfigRecord = { ...previous, state: 'published', updatedAt: now };
    await this.repo.save(restored);
    return restored;
  }

  async listVersions(key: string, environment: ConfigEnvironment): Promise<ConfigRecord[]> {
    const records = await this.repo.findByKey(key, environment);
    return records.sort((a, b) => b.version - a.version);
  }

  async list(filter: {
    key?: string;
    environment?: ConfigEnvironment;
    state?: ConfigState;
    type?: ConfigType;
    limit?: number;
  }): Promise<ConfigRecord[]> {
    return this.repo.list(filter);
  }

  async resolve(key: string, ctx: ResolveContext): Promise<ConfigRecord | null> {
    const candidates = await this.candidates(key, ctx);
    if (candidates.length === 0) return null;
    return (
      candidates.sort(
        (a, b) => SCOPE_SPECIFICITY[b.scope.type] - SCOPE_SPECIFICITY[a.scope.type],
      )[0] ?? null
    );
  }

  async resolveFlags(ctx: ResolveContext): Promise<Record<string, boolean>> {
    const candidates = await this.candidates(CONVENTIONAL_KEYS.featureFlags, ctx);
    const ordered = [...candidates].sort(
      (a, b) => SCOPE_SPECIFICITY[a.scope.type] - SCOPE_SPECIFICITY[b.scope.type],
    );
    const merged: Record<string, boolean> = {};
    for (const candidate of ordered) {
      const flags = (candidate.payload as { flags?: Record<string, boolean> }).flags;
      if (flags) Object.assign(merged, flags);
    }
    return merged;
  }

  async resolveAppVersion(ctx: ResolveContext): Promise<Record<string, unknown>> {
    const record = await this.resolve(CONVENTIONAL_KEYS.appVersion, ctx);
    if (!record) {
      throw new AppError('NOT_FOUND', {
        message: `"${CONVENTIONAL_KEYS.appVersion}" configuration not found`,
      });
    }
    assertType(record, 'app_version');
    return record.payload;
  }

  async resolveMaintenance(ctx: ResolveContext): Promise<Record<string, unknown>> {
    const record = await this.resolve(CONVENTIONAL_KEYS.maintenance, ctx);
    if (!record) return { enabled: false };
    assertType(record, 'maintenance');
    return record.payload;
  }

  private async candidates(key: string, ctx: ResolveContext): Promise<ConfigRecord[]> {
    const now = ctx.now ?? Date.now();
    const records = await this.repo.findByKey(key, ctx.environment);
    return records.filter(
      (record) =>
        effectiveState(record, now) === 'published' &&
        matchesScope(record.scope, ctx) &&
        matchesTime(record, now) &&
        matchesSegment(record.targeting, ctx.segment),
    );
  }
}

export function effectiveState(record: ConfigRecord, now: number): ConfigState {
  if (record.state === 'scheduled') {
    return record.scheduledFor !== undefined && record.scheduledFor <= now
      ? 'published'
      : 'scheduled';
  }
  if (record.state === 'published' && record.expiresAt !== undefined && record.expiresAt <= now) {
    return 'expired';
  }
  return record.state;
}

function sameScope(a: ConfigScope, b: ConfigScope): boolean {
  return (
    a.type === b.type &&
    a.cityId === b.cityId &&
    a.zoneId === b.zoneId &&
    a.localityId === b.localityId
  );
}

function matchesScope(scope: ConfigScope, ctx: ResolveContext): boolean {
  switch (scope.type) {
    case 'global':
      return true;
    case 'city':
      return scope.cityId !== undefined && scope.cityId === ctx.cityId;
    case 'zone':
      return scope.zoneId !== undefined && scope.zoneId === ctx.zoneId;
    case 'locality':
      return scope.localityId !== undefined && scope.localityId === ctx.localityId;
  }
}

function matchesTime(record: ConfigRecord, now: number): boolean {
  if (record.activeFrom !== undefined && now < record.activeFrom) return false;
  if (record.activeTo !== undefined && now > record.activeTo) return false;
  return true;
}

function matchesSegment(targeting: ConfigTargeting | undefined, segment: string | undefined) {
  const segments = targeting?.segments;
  if (!segments || segments.length === 0) return true;
  return segment !== undefined && segments.includes(segment);
}

function validateScope(scope: ConfigScope | undefined): void {
  if (!scope) return;
  const required: Record<Exclude<ScopeType, 'global'>, string | undefined> = {
    city: scope.cityId,
    zone: scope.zoneId,
    locality: scope.localityId,
  };
  if (scope.type === 'global') return;
  if (!required[scope.type]) {
    throw new AppError('VALIDATION_ERROR', {
      message: `scope "${scope.type}" requires ${scope.type}Id`,
    });
  }
}

function validateTimeWindow(activeFrom: number | undefined, activeTo: number | undefined) {
  if (activeFrom !== undefined && activeTo !== undefined && activeFrom >= activeTo) {
    throw new AppError('VALIDATION_ERROR', { message: 'activeFrom must be before activeTo' });
  }
}

function assertState(record: ConfigRecord, allowed: ConfigState[], action: string): void {
  if (!allowed.includes(record.state)) {
    throw new AppError('CONFLICT', {
      message: `Cannot ${action} config in state "${record.state}" (allowed: ${allowed.join(', ')})`,
    });
  }
}

function assertType(record: ConfigRecord, expected: ConfigType): void {
  if (record.type !== expected) {
    throw new AppError('VALIDATION_ERROR', {
      message: `Key "${record.key}" must have type "${expected}", found "${record.type}"`,
    });
  }
}
