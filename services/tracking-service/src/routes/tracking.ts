import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { StagingTrackingRepository } from '../tracking/tracking.repository.js';
import { TrackingService } from '../tracking/tracking.service.js';
import { SUBJECT_TYPES } from '../tracking/tracking.types.js';

const locationBody = {
  type: 'object',
  required: ['subjectType', 'subjectId', 'lat', 'lng', 'recordedAt'],
  additionalProperties: false,
  properties: {
    subjectType: { type: 'string', enum: [...SUBJECT_TYPES] },
    subjectId: { type: 'string', minLength: 1, maxLength: 64 },
    lat: { type: 'number', minimum: -90, maximum: 90 },
    lng: { type: 'number', minimum: -180, maximum: 180 },
    speedKph: { type: 'number', minimum: 0, maximum: 400 },
    heading: { type: 'number', minimum: 0, maximum: 360 },
    accuracyM: { type: 'number', minimum: 0, maximum: 10000 },
    recordedAt: { type: 'integer', minimum: 0, maximum: 4102444800000 },
  },
  if: {
    properties: { subjectType: { const: 'delivery' } },
    required: ['subjectType'],
  },
  then: { properties: { subjectId: { pattern: '^dlv_[0-9a-f]{32}$' } } },
  else: { properties: { subjectId: { pattern: '^drv_[0-9a-f]{32}$' } } },
} as const;

const subjectParams = {
  type: 'object',
  required: ['subjectType', 'subjectId'],
  properties: {
    subjectType: { type: 'string', enum: [...SUBJECT_TYPES] },
    subjectId: { type: 'string', minLength: 1, maxLength: 64 },
  },
  if: {
    properties: { subjectType: { const: 'delivery' } },
    required: ['subjectType'],
  },
  then: { properties: { subjectId: { pattern: '^dlv_[0-9a-f]{32}$' } } },
  else: { properties: { subjectId: { pattern: '^drv_[0-9a-f]{32}$' } } },
} as const;

interface SubjectParams {
  subjectType: 'delivery' | 'driver';
  subjectId: string;
}

export function buildTrackingRoutes(app: FastifyInstance): void {
  const repo = new StagingTrackingRepository();
  const service = new TrackingService(repo);
  const controller = createTrackingController(service);

  app.post('/tracking/locations', { schema: { body: locationBody } }, controller.recordLocation);
  app.post(
    '/tracking/locations/batch',
    {
      schema: {
        body: {
          type: 'object',
          required: ['updates'],
          additionalProperties: false,
          properties: {
            updates: { type: 'array', minItems: 1, maxItems: 100, items: locationBody },
          },
        },
      },
    },
    controller.recordLocationBatch,
  );
  app.get(
    '/tracking/:subjectType/:subjectId/snapshot',
    { schema: { params: subjectParams } },
    controller.getSnapshot,
  );
  app.get(
    '/tracking/:subjectType/:subjectId/trail',
    {
      schema: {
        params: subjectParams,
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
        },
      },
    },
    controller.listTrail,
  );
  app.delete(
    '/tracking/:subjectType/:subjectId',
    { schema: { params: subjectParams } },
    controller.endTracking,
  );
}

function createTrackingController(service: TrackingService) {
  return {
    async recordLocation(request: FastifyRequest, reply: FastifyReply) {
      const result = await service.recordLocation(request.body);
      return reply.status(201).send(result);
    },
    async recordLocationBatch(request: FastifyRequest, reply: FastifyReply) {
      const result = await service.recordLocationBatch(request.body);
      return reply.status(201).send(result);
    },
    async getSnapshot(request: FastifyRequest<{ Params: SubjectParams }>, reply: FastifyReply) {
      const snapshot = await service.getSnapshot(
        request.params.subjectType,
        request.params.subjectId,
      );
      return reply.send(snapshot);
    },
    async listTrail(
      request: FastifyRequest<{ Params: SubjectParams; Querystring: { limit?: number } }>,
      reply: FastifyReply,
    ) {
      const points = await service.listTrail({
        subjectType: request.params.subjectType,
        subjectId: request.params.subjectId,
        ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
      });
      return reply.send({ points });
    },
    async endTracking(request: FastifyRequest<{ Params: SubjectParams }>, reply: FastifyReply) {
      const result = await service.endTracking(request.params);
      return reply.send(result);
    },
  };
}
