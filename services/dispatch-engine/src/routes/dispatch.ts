import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { StagingDriverDirectory } from '../dispatch/driver-directory.js';
import { StagingDispatchRepository } from '../dispatch/dispatch.repository.js';
import { DispatchService } from '../dispatch/dispatch.service.js';
import {
  ASSIGNMENT_STATES,
  DELIVERY_ID_PATTERN,
  DRIVER_ID_PATTERN,
  VEHICLE_TYPES,
  ZONE_ID_PATTERN,
} from '../dispatch/dispatch.types.js';

const assignmentIdParams = {
  type: 'object',
  required: ['assignmentId'],
  properties: { assignmentId: { type: 'string', pattern: '^asg_[0-9a-f]{32}$' } },
} as const;

const reasonBody = {
  type: 'object',
  additionalProperties: false,
  properties: { reason: { type: 'string', minLength: 1, maxLength: 200 } },
} as const;

interface AssignmentIdParams {
  assignmentId: string;
}

export function buildDispatchRoutes(app: FastifyInstance): void {
  const repo = new StagingDispatchRepository();
  const directory = new StagingDriverDirectory();
  const service = new DispatchService(repo, directory);
  const controller = createDispatchController(service);

  app.get('/dispatch/policy', controller.getPolicy);
  app.put(
    '/dispatch/policy',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          minProperties: 1,
          properties: {
            distanceWeight: { type: 'number', minimum: 0, maximum: 1000 },
            sameZoneBonus: { type: 'number', minimum: 0, maximum: 10000 },
            workloadPenalty: { type: 'number', minimum: 0, maximum: 10000 },
            maxDistanceKm: { type: 'number', minimum: 0.1, maximum: 100 },
            offerTimeoutSeconds: { type: 'integer', minimum: 15, maximum: 3600 },
          },
        },
      },
    },
    controller.setPolicy,
  );

  const offerBody = {
    type: 'object',
    required: ['deliveryId'],
    additionalProperties: false,
    properties: {
      deliveryId: { type: 'string', pattern: DELIVERY_ID_PATTERN },
      zoneId: { type: 'string', minLength: 1, maxLength: 64, pattern: ZONE_ID_PATTERN },
      requiredVehicleType: { type: 'string', enum: [...VEHICLE_TYPES] },
      requiredCapacityKg: { type: 'number', minimum: 0.1, maximum: 5000 },
      maxDistanceKm: { type: 'number', minimum: 0.1, maximum: 100 },
      offerTimeoutSeconds: { type: 'integer', minimum: 15, maximum: 3600 },
    },
  } as const;

  app.post('/dispatch/offers', { schema: { body: offerBody } }, controller.createOffer);
  app.post(
    '/dispatch/offers/:assignmentId/accept',
    { schema: { params: assignmentIdParams } },
    controller.acceptOffer,
  );
  app.post(
    '/dispatch/offers/:assignmentId/reject',
    { schema: { params: assignmentIdParams, body: reasonBody } },
    controller.rejectOffer,
  );
  app.post(
    '/dispatch/offers/:assignmentId/timeout',
    { schema: { params: assignmentIdParams } },
    controller.timeoutOffer,
  );
  app.post('/dispatch/candidates', { schema: { body: offerBody } }, controller.previewCandidates);

  app.post(
    '/dispatch/assignments',
    {
      schema: {
        body: {
          type: 'object',
          required: ['deliveryId', 'driverId'],
          additionalProperties: false,
          properties: {
            deliveryId: { type: 'string', pattern: DELIVERY_ID_PATTERN },
            driverId: { type: 'string', pattern: DRIVER_ID_PATTERN },
            reason: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    controller.manualAssign,
  );
  app.get(
    '/dispatch/assignments',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            deliveryId: { type: 'string', pattern: DELIVERY_ID_PATTERN },
            driverId: { type: 'string', pattern: DRIVER_ID_PATTERN },
            state: { type: 'string', enum: [...ASSIGNMENT_STATES] },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        },
      },
    },
    controller.listAssignments,
  );
  app.get(
    '/dispatch/assignments/:assignmentId',
    { schema: { params: assignmentIdParams } },
    controller.getAssignment,
  );
  app.post(
    '/dispatch/assignments/:assignmentId/reassign',
    {
      schema: {
        params: assignmentIdParams,
        body: {
          type: 'object',
          required: ['driverId', 'reason'],
          additionalProperties: false,
          properties: {
            driverId: { type: 'string', pattern: DRIVER_ID_PATTERN },
            reason: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    controller.reassign,
  );
  app.post(
    '/dispatch/assignments/:assignmentId/release',
    { schema: { params: assignmentIdParams, body: reasonBody } },
    controller.release,
  );
  app.get(
    '/dispatch/assignments/:assignmentId/history',
    { schema: { params: assignmentIdParams } },
    controller.getHistory,
  );
}

function createDispatchController(service: DispatchService) {
  return {
    async getPolicy(_request: FastifyRequest, reply: FastifyReply) {
      const policy = await service.getPolicy();
      return reply.send(policy);
    },
    async setPolicy(request: FastifyRequest, reply: FastifyReply) {
      const policy = await service.setPolicy(request.body);
      return reply.send(policy);
    },
    async createOffer(request: FastifyRequest, reply: FastifyReply) {
      const assignment = await service.createOffer(request.body);
      return reply.status(201).send(assignment);
    },
    async acceptOffer(
      request: FastifyRequest<{ Params: AssignmentIdParams }>,
      reply: FastifyReply,
    ) {
      const assignment = await service.acceptOffer(request.params.assignmentId);
      return reply.send(assignment);
    },
    async rejectOffer(
      request: FastifyRequest<{ Params: AssignmentIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const assignment = await service.rejectOffer(request.params.assignmentId, request.body);
      return reply.send(assignment);
    },
    async timeoutOffer(
      request: FastifyRequest<{ Params: AssignmentIdParams }>,
      reply: FastifyReply,
    ) {
      const assignment = await service.timeoutOffer(request.params.assignmentId);
      return reply.send(assignment);
    },
    async previewCandidates(request: FastifyRequest, reply: FastifyReply) {
      const candidates = await service.previewCandidates(request.body);
      return reply.send({ candidates });
    },
    async manualAssign(request: FastifyRequest, reply: FastifyReply) {
      const assignment = await service.manualAssign(request.body);
      return reply.status(201).send(assignment);
    },
    async listAssignments(request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) {
      const assignments = await service.listAssignments(request.query);
      return reply.send({ assignments });
    },
    async getAssignment(
      request: FastifyRequest<{ Params: AssignmentIdParams }>,
      reply: FastifyReply,
    ) {
      const assignment = await service.getAssignment(request.params.assignmentId);
      return reply.send(assignment);
    },
    async reassign(
      request: FastifyRequest<{ Params: AssignmentIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const assignment = await service.reassign(request.params.assignmentId, request.body);
      return reply.send(assignment);
    },
    async release(
      request: FastifyRequest<{ Params: AssignmentIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const assignment = await service.release(request.params.assignmentId, request.body);
      return reply.send(assignment);
    },
    async getHistory(request: FastifyRequest<{ Params: AssignmentIdParams }>, reply: FastifyReply) {
      const history = await service.getHistory(request.params.assignmentId);
      return reply.send({ history });
    },
  };
}
