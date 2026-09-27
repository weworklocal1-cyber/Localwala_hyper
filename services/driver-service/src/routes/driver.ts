import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { StagingDriverRepository } from '../driver/driver.repository.js';
import { DriverService } from '../driver/driver.service.js';
import {
  AVAILABILITY_STATES,
  DATE_PATTERN,
  DOCUMENT_TYPES,
  DRIVER_ID_PATTERN,
  DOCUMENT_ID_PATTERN,
  ONBOARDING_STATES,
  USER_ID_PATTERN,
  VEHICLE_TYPES,
  ZONE_ID_PATTERN,
} from '../driver/driver.types.js';

const driverIdParams = {
  type: 'object',
  required: ['driverId'],
  properties: { driverId: { type: 'string', pattern: DRIVER_ID_PATTERN } },
} as const;

const documentIdParams = {
  type: 'object',
  required: ['driverId', 'documentId'],
  properties: {
    driverId: { type: 'string', pattern: DRIVER_ID_PATTERN },
    documentId: { type: 'string', pattern: DOCUMENT_ID_PATTERN },
  },
} as const;

const reasonBody = {
  type: 'object',
  required: ['reason'],
  additionalProperties: false,
  properties: { reason: { type: 'string', minLength: 1, maxLength: 200 } },
} as const;

const vehicleProps = {
  type: { type: 'string', enum: [...VEHICLE_TYPES] },
  registrationNumber: {
    type: 'string',
    minLength: 1,
    maxLength: 32,
    pattern: '^[A-Za-z0-9 -]{1,32}$',
  },
  capacityKg: { type: 'number', minimum: 0.1, maximum: 5000 },
} as const;

interface DriverIdParams {
  driverId: string;
}

interface DocumentIdParams {
  driverId: string;
  documentId: string;
}

export function buildDriverRoutes(app: FastifyInstance): void {
  const repo = new StagingDriverRepository();
  const service = new DriverService(repo);
  const controller = createDriverController(service);

  app.post(
    '/drivers',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'vehicle'],
          additionalProperties: false,
          properties: {
            userId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            vehicle: {
              type: 'object',
              required: ['type'],
              additionalProperties: false,
              properties: vehicleProps,
            },
            serviceAreaZoneIds: {
              type: 'array',
              maxItems: 20,
              items: { type: 'string', minLength: 1, maxLength: 64, pattern: ZONE_ID_PATTERN },
            },
          },
        },
      },
    },
    controller.createDriver,
  );
  app.get(
    '/drivers',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            userId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            onboardingState: { type: 'string', enum: [...ONBOARDING_STATES] },
            availability: { type: 'string', enum: [...AVAILABILITY_STATES] },
            suspended: { type: 'string', enum: ['true', 'false'] },
            zoneId: { type: 'string', minLength: 1, maxLength: 64, pattern: ZONE_ID_PATTERN },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        },
      },
    },
    controller.listDrivers,
  );
  app.get('/drivers/:driverId', { schema: { params: driverIdParams } }, controller.getDriver);
  app.post(
    '/drivers/:driverId/approve',
    { schema: { params: driverIdParams } },
    controller.approve,
  );
  app.post(
    '/drivers/:driverId/reject',
    { schema: { params: driverIdParams, body: reasonBody } },
    controller.reject,
  );
  app.post(
    '/drivers/:driverId/suspend',
    { schema: { params: driverIdParams, body: reasonBody } },
    controller.suspend,
  );
  app.post(
    '/drivers/:driverId/unsuspend',
    { schema: { params: driverIdParams } },
    controller.unsuspend,
  );
  app.post(
    '/drivers/:driverId/online',
    { schema: { params: driverIdParams } },
    controller.goOnline,
  );
  app.post(
    '/drivers/:driverId/offline',
    { schema: { params: driverIdParams } },
    controller.goOffline,
  );
  app.put(
    '/drivers/:driverId/vehicle',
    {
      schema: {
        params: driverIdParams,
        body: {
          type: 'object',
          required: ['vehicle'],
          additionalProperties: false,
          properties: {
            vehicle: {
              type: 'object',
              required: ['type'],
              additionalProperties: false,
              properties: vehicleProps,
            },
          },
        },
      },
    },
    controller.setVehicle,
  );
  app.put(
    '/drivers/:driverId/service-areas',
    {
      schema: {
        params: driverIdParams,
        body: {
          type: 'object',
          required: ['zoneIds'],
          additionalProperties: false,
          properties: {
            zoneIds: {
              type: 'array',
              maxItems: 40,
              items: { type: 'string', minLength: 1, maxLength: 64, pattern: ZONE_ID_PATTERN },
            },
          },
        },
      },
    },
    controller.setServiceAreas,
  );
  app.post(
    '/drivers/:driverId/documents',
    {
      schema: {
        params: driverIdParams,
        body: {
          type: 'object',
          required: ['type'],
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: [...DOCUMENT_TYPES] },
            number: { type: 'string', minLength: 1, maxLength: 64 },
            expiresAt: { type: 'string', pattern: DATE_PATTERN },
          },
        },
      },
    },
    controller.createDocument,
  );
  app.get(
    '/drivers/:driverId/documents',
    { schema: { params: driverIdParams } },
    controller.listDocuments,
  );
  app.post(
    '/drivers/:driverId/documents/:documentId/verify',
    { schema: { params: documentIdParams } },
    controller.verifyDocument,
  );
  app.post(
    '/drivers/:driverId/documents/:documentId/reject',
    { schema: { params: documentIdParams, body: reasonBody } },
    controller.rejectDocument,
  );
}

function createDriverController(service: DriverService) {
  return {
    async createDriver(request: FastifyRequest, reply: FastifyReply) {
      const driver = await service.createDriver(request.body);
      return reply.status(201).send(driver);
    },
    async listDrivers(request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) {
      const drivers = await service.listDrivers(request.query);
      return reply.send({ drivers });
    },
    async getDriver(request: FastifyRequest<{ Params: DriverIdParams }>, reply: FastifyReply) {
      const driver = await service.getDriver(request.params.driverId);
      return reply.send(driver);
    },
    async approve(request: FastifyRequest<{ Params: DriverIdParams }>, reply: FastifyReply) {
      const driver = await service.approve(request.params.driverId);
      return reply.send(driver);
    },
    async reject(
      request: FastifyRequest<{ Params: DriverIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const driver = await service.reject(request.params.driverId, request.body);
      return reply.send(driver);
    },
    async suspend(
      request: FastifyRequest<{ Params: DriverIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const driver = await service.suspend(request.params.driverId, request.body);
      return reply.send(driver);
    },
    async unsuspend(request: FastifyRequest<{ Params: DriverIdParams }>, reply: FastifyReply) {
      const driver = await service.unsuspend(request.params.driverId);
      return reply.send(driver);
    },
    async goOnline(request: FastifyRequest<{ Params: DriverIdParams }>, reply: FastifyReply) {
      const driver = await service.goOnline(request.params.driverId);
      return reply.send(driver);
    },
    async goOffline(request: FastifyRequest<{ Params: DriverIdParams }>, reply: FastifyReply) {
      const driver = await service.goOffline(request.params.driverId);
      return reply.send(driver);
    },
    async setVehicle(
      request: FastifyRequest<{ Params: DriverIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const driver = await service.setVehicle(request.params.driverId, request.body);
      return reply.send(driver);
    },
    async setServiceAreas(
      request: FastifyRequest<{ Params: DriverIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const driver = await service.setServiceAreas(request.params.driverId, request.body);
      return reply.send(driver);
    },
    async createDocument(
      request: FastifyRequest<{ Params: DriverIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const document = await service.createDocument(request.params.driverId, request.body);
      return reply.status(201).send(document);
    },
    async listDocuments(request: FastifyRequest<{ Params: DriverIdParams }>, reply: FastifyReply) {
      const documents = await service.listDocuments(request.params.driverId);
      return reply.send({ documents });
    },
    async verifyDocument(
      request: FastifyRequest<{ Params: DocumentIdParams }>,
      reply: FastifyReply,
    ) {
      const document = await service.verifyDocument(
        request.params.driverId,
        request.params.documentId,
      );
      return reply.send(document);
    },
    async rejectDocument(
      request: FastifyRequest<{ Params: DocumentIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const document = await service.rejectDocument(
        request.params.driverId,
        request.params.documentId,
        request.body,
      );
      return reply.send(document);
    },
  };
}
