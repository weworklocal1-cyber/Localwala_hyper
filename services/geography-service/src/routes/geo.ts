import type { FastifyInstance } from 'fastify';
import { GeoService } from '../geo/geo.service.js';
import { StagingGeoRepository } from '../geo/geo.repository.js';

export function buildGeoRoutes(app: FastifyInstance): void {
  const geoRepo = new StagingGeoRepository();
  const geoService = new GeoService(geoRepo);
  const controller = createGeoController(geoService);

  app.post('/geo', { schema: { body: { type: 'object', properties: { type: { type: 'string' }, name: { type: 'string' }, code: { type: 'string' }, parentId: { type: 'string' }, boundary: { type: 'object' }, metadata: { type: 'object' }, isActive: { type: 'boolean' } }, required: ['type', 'name'] } } }, controller.create);
  app.get('/geo/:id', controller.getById);
  app.patch('/geo/:id', controller.update);
  app.delete('/geo/:id', controller.delete);
  app.post('/geo/:id/activate', controller.setActive);
  app.get('/geo', controller.list);
  app.get('/geo/resolve', controller.resolveLocality);
  app.get('/geo/serviceability', controller.checkServiceability);
  app.get('/geo/cities/:cityId/zones', controller.getZonesInCity);
  app.get('/geo/zones/:zoneId/localities', controller.getLocalitiesInZone);
}

function createGeoController(geoService: any) {
  return {
    async create(request: any, reply: any) {
      const data = request.body;
      const entity = await geoService.createEntity(data);
      return reply.status(201).send(entity);
    },
    async getById(request: any, reply: any) {
      const entity = await geoService.getEntity(request.params.id);
      return reply.send(entity);
    },
    async update(request: any, reply: any) {
      const entity = await geoService.updateEntity(request.params.id, request.body);
      return reply.send(entity);
    },
    async delete(request: any, reply: any) {
      await geoService.deleteEntity(request.params.id);
      return reply.status(204).send();
    },
    async setActive(request: any, reply: any) {
      const entity = await geoService.setActive(request.params.id, request.body.isActive);
      return reply.send(entity);
    },
    async list(request: any, reply: any) {
      const entities = await geoService.listEntities(request.query.type);
      return reply.send({ entities });
    },
    async resolveLocality(request: any, reply: any) {
      const locality = await geoService.resolveLocality(request.query.lat, request.query.lng);
      return reply.send({ locality });
    },
    async checkServiceability(request: any, reply: any) {
      const result = await geoService.checkServiceability(request.query.lat, request.query.lng, request.query.vertical);
      return reply.send(result);
    },
    async getZonesInCity(request: any, reply: any) {
      const zones = await geoService.getZonesInCity(request.params.cityId);
      return reply.send({ zones });
    },
    async getLocalitiesInZone(request: any, reply: any) {
      const localities = await geoService.getLocalitiesInZone(request.params.zoneId);
      return reply.send({ localities });
    },
  };
}