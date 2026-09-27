import { z } from 'zod';

export const geoEntityCreateSchema = z.object({
  type: z.enum(['country', 'state', 'city', 'zone', 'locality']),
  name: z.string().min(1).max(128),
  code: z.string().max(32).optional(),
  parentId: z.string().optional(),
  boundary: z.custom<{ type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }>().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().default(true),
});

export const geoEntityUpdateSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  code: z.string().max(32).optional(),
  boundary: z.custom<{ type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }>().optional(),
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
