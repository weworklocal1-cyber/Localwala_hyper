import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { GeoService } from '../geo/geo.service.js';
import { StagingGeoRepository } from '../geo/geo.repository.js';
import type { GeoEntity } from '../geo/geo.types.js';

interface IdParams {
  id: string;
}
interface CityParams {
  cityId: string;
}
interface ZoneParams {
  zoneId: string;
}
interface CreateGeoBody {
  type: string;
  name: string;
  code?: string;
  parentId?: string;
  boundary?: unknown;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}
interface ActiveBody {
  isActive: boolean;
}
interface ListQuery {
  type?: string;
}
interface LatLngQuery {
  lat: string;
  lng: string;
  vertical?: string;
}

export function buildGeoRoutes(app: FastifyInstance): void {
  const geoRepo = new StagingGeoRepository();
  const geoService = new GeoService(geoRepo);
  const controller = createGeoController(geoService);

  app.post(
    '/geo',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            name: { type: 'string' },
            code: { type: 'string' },
            parentId: { type: 'string' },
            boundary: { type: 'object' },
            metadata: { type: 'object' },
            isActive: { type: 'boolean' },
          },
          required: ['type', 'name'],
        },
      },
    },
    controller.create,
  );
  app.get('/geo/:id', controller.getById);
  app.patch('/geo/:id', controller.update);
  app.delete('/geo/:id', controller.delete);
  app.post('/geo/:id/activate', controller.setActive);
  app.get('/geo', controller.list);
  app.get(
    '/geo/resolve',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['lat', 'lng'],
          properties: {
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lng: { type: 'number', minimum: -180, maximum: 180 },
          },
        },
      },
    },
    controller.resolveLocality,
  );
  app.get(
    '/geo/serviceability',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['lat', 'lng'],
          properties: {
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lng: { type: 'number', minimum: -180, maximum: 180 },
            vertical: { type: 'string' },
          },
        },
      },
    },
    controller.checkServiceability,
  );
  app.get('/geo/cities/:cityId/zones', controller.getZonesInCity);
  app.get('/geo/zones/:zoneId/localities', controller.getLocalitiesInZone);
}

function createGeoController(geoService: GeoService) {
  return {
    async create(request: FastifyRequest<{ Body: CreateGeoBody }>, reply: FastifyReply) {
      const entity = await geoService.createEntity(request.body);
      return reply.status(201).send(entity);
    },
    async getById(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
      const entity = await geoService.getEntity(request.params.id);
      return reply.send(entity);
    },
    async update(
      request: FastifyRequest<{ Params: IdParams; Body: Partial<GeoEntity> }>,
      reply: FastifyReply,
    ) {
      const entity = await geoService.updateEntity(request.params.id, request.body);
      return reply.send(entity);
    },
    async delete(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
      await geoService.deleteEntity(request.params.id);
      return reply.status(204).send();
    },
    async setActive(
      request: FastifyRequest<{ Params: IdParams; Body: ActiveBody }>,
      reply: FastifyReply,
    ) {
      const entity = await geoService.setActive(request.params.id, request.body.isActive);
      return reply.send(entity);
    },
    async list(request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) {
      const entities = await geoService.listEntities(request.query.type);
      return reply.send({ entities });
    },
    async resolveLocality(
      request: FastifyRequest<{ Querystring: LatLngQuery }>,
      reply: FastifyReply,
    ) {
      const locality = await geoService.resolveLocality(
        Number(request.query.lat),
        Number(request.query.lng),
      );
      return reply.send({ locality });
    },
    async checkServiceability(
      request: FastifyRequest<{ Querystring: LatLngQuery }>,
      reply: FastifyReply,
    ) {
      const result = await geoService.checkServiceability(
        Number(request.query.lat),
        Number(request.query.lng),
        request.query.vertical,
      );
      return reply.send(result);
    },
    async getZonesInCity(request: FastifyRequest<{ Params: CityParams }>, reply: FastifyReply) {
      const zones = await geoService.getZonesInCity(request.params.cityId);
      return reply.send({ zones });
    },
    async getLocalitiesInZone(
      request: FastifyRequest<{ Params: ZoneParams }>,
      reply: FastifyReply,
    ) {
      const localities = await geoService.getLocalitiesInZone(request.params.zoneId);
      return reply.send({ localities });
    },
  };
}
