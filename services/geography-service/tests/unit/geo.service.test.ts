import { beforeEach, describe, expect, it } from 'vitest';
import type {
  GeoConfig,
  GeoEntity,
  GeoRepository,
  GeoJSONPolygon,
  Locality,
  Zone,
} from '../../src/geo/geo.types.js';
import { GeoService } from '../../src/geo/geo.service.js';

function square(lngMin: number, lngMax: number, latMin: number, latMax: number): GeoJSONPolygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lngMin, latMin],
        [lngMax, latMin],
        [lngMax, latMax],
        [lngMin, latMax],
        [lngMin, latMin],
      ],
    ],
  };
}

const now = 1_700_000_000_000;

class InMemoryGeoRepository implements GeoRepository {
  readonly entities = new Map<string, GeoEntity>();
  storedConfig: GeoConfig | null = null;

  async save(entity: GeoEntity): Promise<void> {
    this.entities.set(entity.id, { ...entity });
  }
  async findById(id: string): Promise<GeoEntity | null> {
    return this.entities.get(id) ?? null;
  }
  async findByType(type: string): Promise<GeoEntity[]> {
    return [...this.entities.values()].filter((entity) => entity.type === type);
  }
  async findByParentId(parentId: string): Promise<GeoEntity[]> {
    return [...this.entities.values()].filter((entity) => entity.parentId === parentId);
  }
  async findByName(name: string, type?: string): Promise<GeoEntity | null> {
    return (
      [...this.entities.values()].find(
        (entity) => entity.name === name && (type === undefined || entity.type === type),
      ) ?? null
    );
  }
  async delete(id: string): Promise<void> {
    this.entities.delete(id);
  }
  async getConfig(): Promise<GeoConfig | null> {
    return this.storedConfig;
  }
  async saveConfig(config: GeoConfig): Promise<void> {
    this.storedConfig = config;
  }
  async findLocalitiesInZone(zoneId: string): Promise<Locality[]> {
    return [...this.entities.values()].filter(
      (entity) => entity.type === 'locality' && (entity as Locality).zoneId === zoneId,
    ) as Locality[];
  }
  async findZonesInCity(cityId: string): Promise<Zone[]> {
    return [...this.entities.values()].filter(
      (entity) => entity.type === 'zone' && (entity as Zone).cityId === cityId,
    ) as Zone[];
  }
}

function makeCountry(id: string): GeoEntity {
  return {
    id,
    type: 'country',
    name: 'India',
    isoCode: 'IN',
    phoneCode: '+91',
    currency: 'INR',
    isActive: true,
    version: 1,
    createdAt: now,
    updatedAt: now,
  } as GeoEntity;
}

function makeZone(id: string, verticals: string[]): Zone {
  return {
    id,
    type: 'zone',
    name: `Zone ${id}`,
    cityId: 'city_1',
    verticals,
    isActive: true,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function makeLocality(
  id: string,
  zoneId: string,
  boundary: GeoJSONPolygon,
  options: { isActive?: boolean } = {},
): Locality {
  return {
    id,
    type: 'locality',
    name: `Locality ${id}`,
    zoneId,
    boundary,
    isActive: options.isActive ?? true,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

const BIG = square(78.4, 78.8, 17.3, 17.7);
const SMALL = square(78.5, 78.6, 17.4, 17.5);

async function seedHierarchy(repo: InMemoryGeoRepository): Promise<void> {
  await repo.save(makeCountry('country_1'));
  await repo.save(makeZone('zone_1', ['food', 'store']));
  await repo.save(makeLocality('loc_big', 'zone_1', BIG));
  await repo.save(makeLocality('loc_small', 'zone_1', SMALL));
  const zone = await repo.findById('zone_1');
  const big = await repo.findById('loc_big');
  const small = await repo.findById('loc_small');
  if (zone) await repo.save({ ...zone, parentId: 'country_1' });
  if (big) await repo.save({ ...big, parentId: 'zone_1' });
  if (small) await repo.save({ ...small, parentId: 'zone_1' });
}

describe('GeoService point-in-polygon resolution', () => {
  let repo: InMemoryGeoRepository;
  let service: GeoService;

  beforeEach(async () => {
    repo = new InMemoryGeoRepository();
    service = new GeoService(repo);
    await seedHierarchy(repo);
  });

  it('returns null when the point is outside every locality', async () => {
    const result = await service.resolveLocality(18.5, 79.5);
    expect(result).toBeNull();
  });

  it('resolves a point inside a locality polygon', async () => {
    const result = await service.resolveLocality(17.35, 78.45);
    expect(result?.id).toBe('loc_big');
  });

  it('picks the smallest locality when polygons overlap', async () => {
    const result = await service.resolveLocality(17.45, 78.55);
    expect(result?.id).toBe('loc_small');
  });

  it('ignores inactive localities', async () => {
    const small = await repo.findById('loc_small');
    if (!small) throw new Error('seed failed');
    await repo.save({ ...small, isActive: false });

    const service2 = new GeoService(repo);
    const result = await service2.resolveLocality(17.45, 78.55);
    expect(result?.id).toBe('loc_big');
  });

  it('resolves points in any polygon of a MultiPolygon boundary', async () => {
    const multi = await repo.findById('loc_big');
    if (!multi) throw new Error('seed failed');
    await repo.save({
      ...multi,
      parentId: 'zone_1',
      boundary: {
        type: 'MultiPolygon',
        coordinates: [
          square(60, 61, 10, 11).coordinates,
          square(78.4, 78.8, 17.3, 17.7).coordinates,
        ],
      },
    });
    const service2 = new GeoService(repo);
    expect((await service2.resolveLocality(10.5, 60.5))?.id).toBe('loc_big');
    expect((await service2.resolveLocality(17.35, 78.45))?.id).toBe('loc_big');
    expect(await service2.resolveLocality(14, 74)).toBeNull();
  });

  it('uses the repository-provided config when available', async () => {
    const entities = new Map<string, GeoEntity>();
    const locality = makeLocality('loc_stored', 'zone_1', BIG);
    entities.set('loc_stored', locality);
    await repo.saveConfig({
      version: 1,
      entities,
      spatialIndex: new Map(),
      updatedAt: now,
    });

    const result = await service.resolveLocality(17.45, 78.55);
    expect(result?.id).toBe('loc_stored');
  });

  it('serves resolves from cache until a mutation invalidates it', async () => {
    expect((await service.resolveLocality(17.45, 78.55))?.id).toBe('loc_small');

    const bangalore = square(77.4, 77.6, 12.8, 13.0);
    await repo.save({ ...makeLocality('loc_sneaky', 'zone_1', bangalore), parentId: 'zone_1' });

    expect(await service.resolveLocality(12.9, 77.5)).toBeNull();

    await service.createEntity({
      type: 'locality',
      name: 'Cache trigger',
      parentId: 'zone_1',
      boundary: square(0, 1, 0, 1),
    });

    const resolved = await service.resolveLocality(12.9, 77.5);
    expect(resolved?.id).toBe('loc_sneaky');
  });
});

describe('GeoService serviceability', () => {
  let repo: InMemoryGeoRepository;
  let service: GeoService;

  beforeEach(async () => {
    repo = new InMemoryGeoRepository();
    service = new GeoService(repo);
    await seedHierarchy(repo);
  });

  it('is not serviceable outside every locality', async () => {
    const result = await service.checkServiceability(18.5, 79.5);
    expect(result.serviceable).toBe(false);
    expect(result.verticals).toEqual([]);
    expect(result.locality).toBeUndefined();
  });

  it('is serviceable inside a locality with zone verticals and ETA', async () => {
    const result = await service.checkServiceability(17.35, 78.45);
    expect(result.serviceable).toBe(true);
    expect(result.locality?.id).toBe('loc_big');
    expect(result.zone?.id).toBe('zone_1');
    expect(result.verticals).toEqual(['food', 'store']);
    expect(result.deliveryEtaMinutes).toBe(30);
  });

  it('rejects a vertical the zone does not serve', async () => {
    const result = await service.checkServiceability(17.35, 78.45, 'pharma');
    expect(result.serviceable).toBe(false);
    expect(result.zone?.id).toBe('zone_1');
    expect(result.verticals).toEqual(['food', 'store']);
  });

  it('accepts a vertical the zone serves', async () => {
    const result = await service.checkServiceability(17.35, 78.45, 'food');
    expect(result.serviceable).toBe(true);
    expect(result.verticals).toContain('food');
  });

  it('falls back to 60 minute ETA when the locality has no zone', async () => {
    const warangal = square(76.9, 77.0, 15.8, 15.9);
    await repo.save({
      ...makeLocality('loc_free', '', warangal),
      parentId: 'country_1',
    });
    const service2 = new GeoService(repo);

    const result = await service2.checkServiceability(15.85, 76.95);
    expect(result.serviceable).toBe(true);
    expect(result.locality?.id).toBe('loc_free');
    expect(result.zone).toBeUndefined();
    expect(result.verticals).toEqual([]);
    expect(result.deliveryEtaMinutes).toBe(60);
  });
});

describe('GeoService entity lifecycle', () => {
  let repo: InMemoryGeoRepository;
  let service: GeoService;

  beforeEach(async () => {
    repo = new InMemoryGeoRepository();
    service = new GeoService(repo);
    await seedHierarchy(repo);
  });

  it('creates a version 1 entity', async () => {
    const entity = await service.createEntity({ type: 'city', name: 'Hyderabad' });
    expect(entity.version).toBe(1);
    expect(entity.isActive).toBe(true);
    expect(entity.id).toMatch(/^city_/);
  });

  it('404s when the parent does not exist', async () => {
    await expect(
      service.createEntity({ type: 'city', name: 'X', parentId: 'missing' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects a parent of the same type', async () => {
    await expect(
      service.createEntity({ type: 'locality', name: 'X', parentId: 'loc_big' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('bumps the version on update', async () => {
    const updated = await service.updateEntity('loc_big', { name: 'Renamed' });
    expect(updated.version).toBe(2);
    expect(updated.name).toBe('Renamed');
  });

  it('toggles active state with a version bump', async () => {
    const deactivated = await service.setActive('loc_big', false);
    expect(deactivated.isActive).toBe(false);
    expect(deactivated.version).toBe(2);
    const activated = await service.setActive('loc_big', true);
    expect(activated.isActive).toBe(true);
    expect(activated.version).toBe(3);
  });

  it('rejects deleting an entity with children', async () => {
    await expect(service.deleteEntity('zone_1')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('deletes a leaf entity', async () => {
    await service.deleteEntity('loc_small');
    await expect(service.getEntity('loc_small')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lists entities filtered by type', async () => {
    const zones = await service.listEntities('zone');
    expect(zones).toHaveLength(1);
    expect(zones[0].id).toBe('zone_1');
  });

  it('lists the whole hierarchy when no type is given', async () => {
    const all = await service.listEntities();
    const ids = all.map((entity) => entity.id);
    expect(ids).toContain('country_1');
    expect(ids).toContain('zone_1');
    expect(ids).toContain('loc_big');
    expect(ids).toContain('loc_small');
  });

  it('lists zones in a city and localities in a zone', async () => {
    const zones = await service.getZonesInCity('city_1');
    expect(zones.map((zone) => zone.id)).toEqual(['zone_1']);
    const localities = await service.getLocalitiesInZone('zone_1');
    expect(localities.map((locality) => locality.id).sort()).toEqual(['loc_big', 'loc_small']);
  });
});
