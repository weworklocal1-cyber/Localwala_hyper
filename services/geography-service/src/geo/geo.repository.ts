import { AppError } from '@localwala/errors';
import type { GeoEntity, GeoConfig, Locality, Zone, ServiceabilityResult, PointInPolygonQuery, GeoJSONGeometry } from './geo.types.js';

export interface GeoRepository {
  save(entity: GeoEntity): Promise<void>;
  findById(id: string): Promise<GeoEntity | null>;
  findByType(type: string): Promise<GeoEntity[]>;
  findByParentId(parentId: string): Promise<GeoEntity[]>;
  findByName(name: string, type?: string): Promise<GeoEntity | null>;
  delete(id: string): Promise<void>;
  getConfig(): Promise<GeoConfig | null>;
  saveConfig(config: GeoConfig): Promise<void>;
  findLocalitiesInZone(zoneId: string): Promise<Locality[]>;
  findZonesInCity(cityId: string): Promise<Zone[]>;
}

/**
 * STAGING ONLY — Replace with Postgres/PostGIS + Redis cache.
 * Throws SERVICE_UNAVAILABLE on every operation.
 */
export class StagingGeoRepository implements GeoRepository {
  async save(): Promise<void> { this.blocked('save'); }
  async findById(): Promise<null> { this.blocked('findById'); return null; }
  async findByType(): Promise<never[]> { this.blocked('findByType'); return []; }
  async findByParentId(): Promise<never[]> { this.blocked('findByParentId'); return []; }
  async findByName(): Promise<null> { this.blocked('findByName'); return null; }
  async delete(): Promise<void> { this.blocked('delete'); }
  async getConfig(): Promise<null> { this.blocked('getConfig'); return null; }
  async saveConfig(): Promise<void> { this.blocked('saveConfig'); }
  async findLocalitiesInZone(): Promise<never[]> { this.blocked('findLocalitiesInZone'); return []; }
  async findZonesInCity(): Promise<never[]> { this.blocked('findZonesInCity'); return []; }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Geo repository not configured: ${op} blocked — database not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}