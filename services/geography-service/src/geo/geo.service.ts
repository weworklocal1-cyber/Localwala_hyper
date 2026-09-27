import { AppError } from '@localwala/errors';
import type {
  GeoRepository,
  GeoConfig,
  GeoEntity,
  Locality,
  Zone,
  ServiceabilityResult,
  GeoJSONGeometry,
  GeoEntityType,
} from './geo.types.js';
import { newGeoId } from './geo.types.js';

export class GeoService {
  private configCache: GeoConfig | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL_MS = 60_000;

  constructor(private readonly geoRepo: GeoRepository) {}

  async createEntity(data: {
    type: string;
    name: string;
    code?: string;
    parentId?: string;
    boundary?: unknown;
    metadata?: Record<string, unknown>;
    isActive?: boolean;
  }): Promise<GeoEntity> {
    if (data.parentId) {
      const parent = await this.geoRepo.findById(data.parentId);
      if (!parent) throw new AppError('NOT_FOUND', { message: 'Parent entity not found' });
      if (parent.type === data.type) {
        throw new AppError('VALIDATION_ERROR', { message: 'Entity cannot be child of same type' });
      }
    }

    const now = Date.now();
    const entity: GeoEntity = {
      id: newGeoId(data.type),
      type: data.type as GeoEntityType,
      name: data.name,
      code: data.code,
      parentId: data.parentId,
      boundary: data.boundary as GeoJSONGeometry | undefined,
      metadata: data.metadata,
      isActive: data.isActive ?? true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await this.geoRepo.save(entity);
    this.invalidateCache();
    return entity;
  }

  async getEntity(id: string): Promise<GeoEntity> {
    const entity = await this.geoRepo.findById(id);
    if (!entity) throw new AppError('NOT_FOUND', { message: 'Entity not found' });
    return entity;
  }

  async updateEntity(id: string, data: Partial<GeoEntity>): Promise<GeoEntity> {
    const entity = await this.getEntity(id);
    const updated: GeoEntity = {
      ...entity,
      ...data,
      version: entity.version + 1,
      updatedAt: Date.now(),
    };
    await this.geoRepo.save(updated);
    this.invalidateCache();
    return updated;
  }

  async deleteEntity(id: string): Promise<void> {
    await this.getEntity(id);
    const children = await this.geoRepo.findByParentId(id);
    if (children.length > 0) {
      throw new AppError('CONFLICT', { message: 'Entity has children, delete them first' });
    }
    await this.geoRepo.delete(id);
    this.invalidateCache();
  }

  async setActive(id: string, isActive: boolean): Promise<GeoEntity> {
    const entity = await this.getEntity(id);
    entity.isActive = isActive;
    entity.version += 1;
    entity.updatedAt = Date.now();
    await this.geoRepo.save(entity);
    this.invalidateCache();
    return entity;
  }

  async listEntities(type?: string): Promise<GeoEntity[]> {
    if (type) return this.geoRepo.findByType(type);
    const countries = await this.geoRepo.findByType('country');
    const descendants = await Promise.all(countries.map((c) => this.getDescendants(c.id)));
    return countries.concat(...descendants);
  }

  private async getDescendants(parentId: string): Promise<GeoEntity[]> {
    const children = await this.geoRepo.findByParentId(parentId);
    const descendants = [...children];
    for (const child of children) {
      descendants.push(...(await this.getDescendants(child.id)));
    }
    return descendants;
  }

  async resolveLocality(lat: number, lng: number): Promise<Locality | null> {
    const config = await this.getConfig();
    const candidates: Locality[] = [];

    for (const entity of config.entities.values()) {
      if (entity.type !== 'locality' || !entity.isActive) continue;
      if (entity.boundary && this.pointInPolygon(lat, lng, entity.boundary)) {
        candidates.push(entity as Locality);
      }
    }

    if (candidates.length === 0) return null;
    return (
      candidates.sort((a, b) => {
        const areaA = this.polygonArea(a.boundary!);
        const areaB = this.polygonArea(b.boundary!);
        return areaA - areaB;
      })[0] ?? null
    );
  }

  async checkServiceability(
    lat: number,
    lng: number,
    vertical?: string,
  ): Promise<ServiceabilityResult> {
    const locality = await this.resolveLocality(lat, lng);
    if (!locality) return { serviceable: false, verticals: [] };

    const config = await this.getConfig();
    let zone: Zone | undefined;
    if (locality.zoneId) {
      zone = config.entities.get(locality.zoneId) as Zone | undefined;
    }

    const verticals = zone?.verticals ?? [];
    if (vertical && !verticals.includes(vertical)) {
      return { serviceable: false, locality, zone, verticals };
    }

    return {
      serviceable: true,
      locality,
      zone,
      verticals,
      deliveryEtaMinutes: zone ? 30 : 60,
    };
  }

  async getZonesInCity(cityId: string): Promise<Zone[]> {
    return this.geoRepo.findZonesInCity(cityId);
  }

  async getLocalitiesInZone(zoneId: string): Promise<Locality[]> {
    return this.geoRepo.findLocalitiesInZone(zoneId);
  }

  private async getConfig(): Promise<GeoConfig> {
    const now = Date.now();
    if (this.configCache && now < this.cacheExpiry) return this.configCache;

    const config = await this.geoRepo.getConfig();
    if (!config) {
      const all = await this.geoRepo.findByType('country');
      const entities = new Map<string, GeoEntity>();
      const spatialIndex = new Map<string, string[]>();

      for (const country of all) {
        this.collectEntities(country, entities, spatialIndex);
      }

      this.configCache = {
        version: Date.now(),
        entities,
        spatialIndex,
        updatedAt: now,
      };
    }

    this.cacheExpiry = now + this.CACHE_TTL_MS;
    return this.configCache!;
  }

  private async collectEntities(
    entity: GeoEntity,
    entities: Map<string, GeoEntity>,
    spatialIndex: Map<string, string[]>,
  ): Promise<void> {
    entities.set(entity.id, entity);
    if (entity.boundary) {
      const bbox = this.getBoundingBox(entity.boundary);
      const key = `${Math.floor(bbox.minLng)},${Math.floor(bbox.minLat)}`;
      const arr = spatialIndex.get(key) ?? [];
      arr.push(entity.id);
      spatialIndex.set(key, arr);
    }
    const children = await this.geoRepo.findByParentId(entity.id);
    for (const child of children) {
      await this.collectEntities(child, entities, spatialIndex);
    }
  }

  private pointInPolygon(lat: number, lng: number, polygon: GeoJSONGeometry): boolean {
    const rings =
      polygon.type === 'MultiPolygon' ? polygon.coordinates.flat() : [polygon.coordinates];
    for (const ring of rings) {
      const firstRing = ring[0] as [number, number][];
      if (firstRing && this.pointInRing(lat, lng, firstRing)) return true;
    }
    return false;
  }

  private pointInRing(lat: number, lng: number, ring: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const current = ring[i];
      const previous = ring[j];
      if (!current || !previous) continue;
      const [xi, yi] = current;
      const [xj, yj] = previous;
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  private polygonArea(polygon: GeoJSONGeometry): number {
    const rings =
      polygon.type === 'MultiPolygon' ? polygon.coordinates.flat() : [polygon.coordinates];
    let area = 0;
    for (const ring of rings) {
      const firstRing = ring[0] as [number, number][];
      if (firstRing) {
        area += Math.abs(this.ringArea(firstRing));
      }
    }
    return area;
  }

  private ringArea(ring: [number, number][]): number {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const current = ring[i];
      const next = ring[i + 1];
      if (current && next) {
        area += current[0] * next[1] - next[0] * current[1];
      }
    }
    return area / 2;
  }

  private getBoundingBox(polygon: GeoJSONGeometry): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } {
    const rings =
      polygon.type === 'MultiPolygon' ? polygon.coordinates.flat() : [polygon.coordinates];
    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;
    for (const ring of rings) {
      const firstRing = ring[0] as [number, number][];
      if (firstRing) {
        for (const coord of firstRing) {
          const [lng, lat] = coord;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        }
      }
    }
    return { minLat, maxLat, minLng, maxLng };
  }

  private invalidateCache(): void {
    this.configCache = null;
    this.cacheExpiry = 0;
  }
}
