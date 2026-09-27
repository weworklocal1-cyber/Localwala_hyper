import type { FastifyReply, FastifyRequest } from 'fastify';
import { parseOrThrow } from '@localwala/validation';
import {
  geoEntityCreateSchema,
  geoEntityUpdateSchema,
  activateEntitySchema,
  pointInPolygonQuerySchema,
} from '../schemas/geo.schema.js';
import { GeoService } from '../geo/geo.service.js';
import type { GeoEntity } from '../geo/geo.types.js';

export function createGeoController(geoService: GeoService) {
  return {
    async create(request: FastifyRequest, reply: FastifyReply) {
      const data = parseOrThrow(geoEntityCreateSchema, request.body);
      const entity = await geoService.createEntity(data);
      return reply.status(201).send(entity);
    },

    async getById(request: FastifyRequest, reply: FastifyReply) {
      const { id } = request.params as { id: string };
      const entity = await geoService.getEntity(id);
      return reply.send(entity);
    },

    async update(request: FastifyRequest, reply: FastifyReply) {
      const { id } = request.params as { id: string };
      const data = parseOrThrow(geoEntityUpdateSchema, request.body);
      const entity = await geoService.updateEntity(id, data as Partial<GeoEntity>);
      return reply.send(entity);
    },

    async delete(request: FastifyRequest, reply: FastifyReply) {
      const { id } = request.params as { id: string };
      await geoService.deleteEntity(id);
      return reply.status(204).send();
    },

    async setActive(request: FastifyRequest, reply: FastifyReply) {
      const { id } = request.params as { id: string };
      const body = { ...(request.body as object), entityId: id };
      const { isActive } = parseOrThrow(activateEntitySchema, body);
      const entity = await geoService.setActive(id, isActive);
      return reply.send(entity);
    },

    async list(request: FastifyRequest, reply: FastifyReply) {
      const { type } = request.query as { type?: string };
      const entities = await geoService.listEntities(type);
      return reply.send({ entities });
    },

    async resolveLocality(request: FastifyRequest, reply: FastifyReply) {
      const query = parseOrThrow(pointInPolygonQuerySchema, request.query);
      const locality = await geoService.resolveLocality(query.lat, query.lng);
      return reply.send({ locality });
    },

    async checkServiceability(request: FastifyRequest, reply: FastifyReply) {
      const query = parseOrThrow(pointInPolygonQuerySchema, request.query);
      const { vertical } = request.query as { vertical?: string };
      const result = await geoService.checkServiceability(query.lat, query.lng, vertical);
      return reply.send(result);
    },

    async getZonesInCity(request: FastifyRequest, reply: FastifyReply) {
      const { cityId } = request.params as { cityId: string };
      const zones = await geoService.getZonesInCity(cityId);
      return reply.send({ zones });
    },

    async getLocalitiesInZone(request: FastifyRequest, reply: FastifyReply) {
      const { zoneId } = request.params as { zoneId: string };
      const localities = await geoService.getLocalitiesInZone(zoneId);
      return reply.send({ localities });
    },
  };
}