import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export type GeoJSONGeometry = GeoJSONPolygon | GeoJSONMultiPolygon;

export const GEO_ENTITY_TYPES = ['country', 'state', 'city', 'zone', 'locality'] as const;
export type GeoEntityType = (typeof GEO_ENTITY_TYPES)[number];

export interface GeoEntity {
  id: string;
  type: GeoEntityType;
  name: string;
  code?: string;
  parentId?: string;
  boundary?: GeoJSONGeometry;
  metadata?: Record<string, unknown>;
  isActive: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface Country extends GeoEntity {
  type: 'country';
  isoCode: string;
  phoneCode: string;
  currency: string;
}

export interface State extends GeoEntity {
  type: 'state';
  countryId: string;
  isoCode?: string;
}

export interface City extends GeoEntity {
  type: 'city';
  stateId: string;
}

export interface Zone extends GeoEntity {
  type: 'zone';
  cityId: string;
  operationalHours?: { open: string; close: string };
  verticals?: string[];
}

export interface Locality extends GeoEntity {
  type: 'locality';
  zoneId: string;
  pincode?: string;
  district?: string;
  mandal?: string;
  deliveryAreas?: string[];
}

export interface ServiceabilityResult {
  serviceable: boolean;
  locality?: Locality;
  zone?: Zone;
  verticals: string[];
  deliveryEtaMinutes?: number;
}

export interface PointInPolygonQuery {
  lat: number;
  lng: number;
  entityType?: GeoEntityType;
}

export interface GeoConfig {
  version: number;
  entities: Map<string, GeoEntity>;
  spatialIndex: Map<string, string[]>;
  updatedAt: number;
}

export function newGeoId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

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

export const geoEntityCreateSchema = z.object({
  type: z.enum(['country', 'state', 'city', 'zone', 'locality']),
  name: z.string().min(1).max(128),
  code: z.string().max(32).optional(),
  parentId: z.string().optional(),
  boundary: z.object({
    type: z.enum(['Polygon', 'MultiPolygon']),
    coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()])))),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().default(true),
});

export const geoEntityUpdateSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  code: z.string().max(32).optional(),
  boundary: z.object({
    type: z.enum(['Polygon', 'MultiPolygon']),
    coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()])))),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional().default(false),
});

export const activateEntitySchema = z.object({
  entityId: z.string().min(1),
  isActive: z.boolean(),
});

export const pointInPolygonQuerySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  entityType: z.enum(['country', 'state', 'city', 'zone', 'locality']).optional(),
  vertical: z.string().optional(),
});