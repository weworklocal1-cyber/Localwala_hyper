import { AppError } from '@localwala/errors';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  StagingConfigRepository,
  type ConfigListFilter,
  type ConfigRepository,
} from '../../src/configs/config.repository.js';
import { ConfigService, effectiveState } from '../../src/configs/config.service.js';
import type { ConfigEnvironment, ConfigRecord } from '../../src/configs/config.types.js';

class InMemoryConfigRepository implements ConfigRepository {
  readonly records: ConfigRecord[] = [];

  async save(record: ConfigRecord): Promise<void> {
    const index = this.records.findIndex((entry) => entry.id === record.id);
    if (index >= 0) this.records[index] = record;
    else this.records.push(record);
  }

  async findById(id: string): Promise<ConfigRecord | null> {
    return this.records.find((entry) => entry.id === id) ?? null;
  }

  async findByKey(key: string, environment: ConfigEnvironment): Promise<ConfigRecord[]> {
    return this.records.filter((entry) => entry.key === key && entry.environment === environment);
  }

  async list(filter: ConfigListFilter): Promise<ConfigRecord[]> {
    return this.records.filter(
      (entry) =>
        (filter.key === undefined || entry.key === filter.key) &&
        (filter.environment === undefined || entry.environment === filter.environment) &&
        (filter.state === undefined || entry.state === filter.state) &&
        (filter.type === undefined || entry.type === filter.type),
    );
  }

  async delete(id: string): Promise<void> {
    const index = this.records.findIndex((entry) => entry.id === id);
    if (index >= 0) this.records.splice(index, 1);
  }
}

const flagsPayload = { flags: { checkout_v2: true, new_home: false } };

function baseDraft(overrides: Partial<Parameters<ConfigService['createDraft']>[0]> = {}) {
  return {
    key: 'feature.flags',
    type: 'feature_flags' as const,
    environment: 'production' as const,
    payload: flagsPayload,
    ...overrides,
  };
}

describe('ConfigService', () => {
  let repo: InMemoryConfigRepository;
  let service: ConfigService;

  beforeEach(() => {
    repo = new InMemoryConfigRepository();
    service = new ConfigService(repo);
  });

  describe('draft creation', () => {
    it('creates a draft at version 1 with state draft', async () => {
      const record = await service.createDraft(baseDraft());
      expect(record.version).toBe(1);
      expect(record.state).toBe('draft');
      expect(record.scope).toEqual({ type: 'global' });
      expect(record.publishedAt).toBeUndefined();
    });

    it('increments versions across keys', async () => {
      await service.createDraft(baseDraft());
      await service.createDraft(baseDraft());
      const third = await service.createDraft(baseDraft());
      expect(third.version).toBe(3);
    });

    it('rejects an invalid key', async () => {
      await expect(service.createDraft(baseDraft({ key: 'bad key!' }))).rejects.toThrow(AppError);
      await expect(service.createDraft(baseDraft({ key: 'bad key!' }))).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('rejects a payload that fails schema validation', async () => {
      await expect(
        service.createDraft(baseDraft({ payload: { flags: { bad: 'not-a-boolean' } } })),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects a city scope without cityId', async () => {
      await expect(
        service.createDraft(baseDraft({ scope: { type: 'city' } })),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects an inverted time window', async () => {
      await expect(
        service.createDraft(baseDraft({ activeFrom: 2000, activeTo: 1000 })),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('state machine', () => {
    it('publishes a draft and stamps publishedAt', async () => {
      const draft = await service.createDraft(baseDraft());
      const published = await service.publish(draft.id);
      expect(published.state).toBe('published');
      expect(published.publishedAt).toBeTypeOf('number');
    });

    it('expires the previously published version when a new one is published', async () => {
      const v1 = await service.createDraft(baseDraft());
      await service.publish(v1.id);
      const v2 = await service.createDraft(baseDraft());
      await service.publish(v2.id);

      const first = await service.getRecord(v1.id);
      const second = await service.getRecord(v2.id);
      expect(first.state).toBe('expired');
      expect(second.state).toBe('published');
    });

    it('rejects publishing an expired config', async () => {
      const draft = await service.createDraft(baseDraft());
      await service.publish(draft.id);
      await service.expire(draft.id);
      await expect(service.publish(draft.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects updating anything but a draft', async () => {
      const draft = await service.createDraft(baseDraft());
      await service.publish(draft.id);
      await expect(service.updateDraft(draft.id, { payload: flagsPayload })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('schedules a draft for the future', async () => {
      const draft = await service.createDraft(baseDraft());
      const scheduled = await service.schedule(draft.id, Date.now() + 60_000);
      expect(scheduled.state).toBe('scheduled');
    });

    it('rejects scheduling a draft in the past', async () => {
      const draft = await service.createDraft(baseDraft());
      await expect(service.schedule(draft.id, Date.now() - 1000)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('cannot schedule a published config', async () => {
      const draft = await service.createDraft(baseDraft());
      await service.publish(draft.id);
      await expect(service.schedule(draft.id, Date.now() + 1000)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });
  });

  describe('rollback', () => {
    it('restores the previous published version and expires the current one', async () => {
      const v1 = await service.createDraft(baseDraft());
      await service.publish(v1.id);
      const v2 = await service.createDraft(baseDraft());
      await service.publish(v2.id);

      const restored = await service.rollback(v2.id);
      expect(restored.version).toBe(1);
      expect(restored.state).toBe('published');
      const current = await service.getRecord(v2.id);
      expect(current.state).toBe('expired');
    });

    it('rejects rollback when there is no previous published version', async () => {
      const draft = await service.createDraft(baseDraft());
      await service.publish(draft.id);
      await expect(service.rollback(draft.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects rollback for a non-published config', async () => {
      const draft = await service.createDraft(baseDraft());
      await expect(service.rollback(draft.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });

  describe('resolution', () => {
    it('resolves nothing when no config exists', async () => {
      const resolved = await service.resolve('feature.flags', { environment: 'production' });
      expect(resolved).toBeNull();
    });

    it('does not resolve drafts', async () => {
      await service.createDraft(baseDraft());
      const resolved = await service.resolve('feature.flags', { environment: 'production' });
      expect(resolved).toBeNull();
    });

    it('resolves a published config', async () => {
      const draft = await service.createDraft(baseDraft());
      await service.publish(draft.id);
      const resolved = await service.resolve('feature.flags', { environment: 'production' });
      expect(resolved?.id).toBe(draft.id);
    });

    it('prefers the most specific scope (locality over zone over city over global)', async () => {
      const global = await service.createDraft(baseDraft());
      await service.publish(global.id);
      const city = await service.createDraft(
        baseDraft({ scope: { type: 'city', cityId: 'city-1' } }),
      );
      await service.publish(city.id);
      const locality = await service.createDraft(
        baseDraft({ scope: { type: 'locality', localityId: 'loc-9' } }),
      );
      await service.publish(locality.id);

      const resolved = await service.resolve('feature.flags', {
        environment: 'production',
        cityId: 'city-1',
        localityId: 'loc-9',
      });
      expect(resolved?.id).toBe(locality.id);
    });

    it('skips a city-scoped config when the city does not match', async () => {
      const city = await service.createDraft(
        baseDraft({ scope: { type: 'city', cityId: 'city-1' } }),
      );
      await service.publish(city.id);
      const resolved = await service.resolve('feature.flags', {
        environment: 'production',
        cityId: 'city-2',
      });
      expect(resolved).toBeNull();
    });

    it('separates environments', async () => {
      const prod = await service.createDraft(baseDraft({ environment: 'production' }));
      await service.publish(prod.id);
      const resolved = await service.resolve('feature.flags', { environment: 'staging' });
      expect(resolved).toBeNull();
    });

    it('honours segment targeting', async () => {
      const targeted = await service.createDraft(baseDraft({ targeting: { segments: ['beta'] } }));
      await service.publish(targeted.id);
      const withSegment = await service.resolve('feature.flags', {
        environment: 'production',
        segment: 'beta',
      });
      const withoutSegment = await service.resolve('feature.flags', {
        environment: 'production',
      });
      expect(withSegment?.id).toBe(targeted.id);
      expect(withoutSegment).toBeNull();
    });

    it('honours an activeFrom/activeTo window', async () => {
      const inWindow = await service.createDraft(
        baseDraft({ activeFrom: 1000, activeTo: 9_999_999_999_999 }),
      );
      await service.publish(inWindow.id);

      const future = await service.resolve('feature.flags', {
        environment: 'production',
        now: 500,
      });
      const past = await service.resolve('feature.flags', {
        environment: 'production',
        now: 10_000_000_000_000,
      });
      expect(future).toBeNull();
      expect(past).toBeNull();
    });

    it('activates a scheduled config once scheduledFor passes', async () => {
      const scheduledFor = Date.now() + 30_000;
      const draft = await service.createDraft(baseDraft());
      await service.schedule(draft.id, scheduledFor);
      expect(effectiveState(await service.getRecord(draft.id), Date.now())).toBe('scheduled');
      const resolvedEarly = await service.resolve('feature.flags', { environment: 'production' });
      expect(resolvedEarly).toBeNull();

      const resolvedLater = await service.resolve('feature.flags', {
        environment: 'production',
        now: scheduledFor + 1000,
      });
      expect(resolvedLater?.id).toBe(draft.id);
    });

    it('treats an expired expiresAt as no longer published', async () => {
      const draft = await service.createDraft(baseDraft({ expiresAt: Date.now() - 1 }));
      await service.publish(draft.id);
      const resolved = await service.resolve('feature.flags', { environment: 'production' });
      expect(resolved).toBeNull();
    });
  });

  describe('flags, app version, maintenance', () => {
    it('merges flags from global to most specific scope', async () => {
      const global = await service.createDraft(
        baseDraft({ payload: { flags: { a: true, b: false } } }),
      );
      await service.publish(global.id);
      const city = await service.createDraft(
        baseDraft({
          scope: { type: 'city', cityId: 'city-1' },
          payload: { flags: { b: true } },
        }),
      );
      await service.publish(city.id);

      const flags = await service.resolveFlags({ environment: 'production', cityId: 'city-1' });
      expect(flags).toEqual({ a: true, b: true });
    });

    it('returns no flags when nothing is published', async () => {
      const flags = await service.resolveFlags({ environment: 'production' });
      expect(flags).toEqual({});
    });

    it('returns app version config', async () => {
      const draft = await service.createDraft({
        key: 'app.version',
        type: 'app_version',
        environment: 'production',
        payload: { minSupportedVersion: '2.1.0', forceUpdate: true },
      });
      await service.publish(draft.id);
      const payload = await service.resolveAppVersion({ environment: 'production' });
      expect(payload.minSupportedVersion).toBe('2.1.0');
    });

    it('404s when app version is not configured', async () => {
      await expect(service.resolveAppVersion({ environment: 'production' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('defaults maintenance to disabled when no config exists', async () => {
      const payload = await service.resolveMaintenance({ environment: 'production' });
      expect(payload).toEqual({ enabled: false });
    });

    it('returns maintenance payload when published', async () => {
      const draft = await service.createDraft({
        key: 'maintenance.mode',
        type: 'maintenance',
        environment: 'production',
        payload: { enabled: true, message: 'back soon' },
      });
      await service.publish(draft.id);
      const payload = await service.resolveMaintenance({ environment: 'production' });
      expect(payload.enabled).toBe(true);
    });
  });

  describe('listing', () => {
    it('lists newest version first', async () => {
      await service.createDraft(baseDraft());
      await service.createDraft(baseDraft());
      const versions = await service.listVersions('feature.flags', 'production');
      expect(versions.map((entry) => entry.version)).toEqual([2, 1]);
    });

    it('filters by state', async () => {
      const draft = await service.createDraft(baseDraft());
      await service.publish(draft.id);
      await service.createDraft(baseDraft());
      const drafts = await service.list({ state: 'draft' });
      expect(drafts).toHaveLength(1);
      expect(drafts[0].state).toBe('draft');
    });

    it('404s for an unknown id', async () => {
      await expect(service.getRecord('cfg_missing')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });
});

describe('StagingConfigRepository', () => {
  const repo = new StagingConfigRepository();

  it('blocks every operation with SERVICE_UNAVAILABLE', async () => {
    const calls: Array<() => Promise<unknown>> = [
      () => repo.save({} as ConfigRecord),
      () => repo.findById('cfg_1'),
      () => repo.findByKey('k', 'production'),
      () => repo.list({}),
      () => repo.delete('cfg_1'),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    }
  });
});

describe('effectiveState', () => {
  const base: ConfigRecord = {
    id: 'cfg_x',
    key: 'k',
    type: 'feature_flags',
    environment: 'production',
    version: 1,
    state: 'draft',
    scope: { type: 'global' },
    payload: {},
    createdAt: 0,
    updatedAt: 0,
  };

  it('keeps draft as draft', () => {
    expect(effectiveState(base, 1000)).toBe('draft');
  });
});
