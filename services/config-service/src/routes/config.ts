import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { StagingConfigRepository } from '../configs/config.repository.js';
import { ConfigService } from '../configs/config.service.js';
import {
  CONFIG_ENVIRONMENTS,
  CONFIG_STATES,
  CONFIG_TYPES,
  SCOPE_TYPES,
  type ConfigEnvironment,
  type ConfigScope,
  type ConfigState,
  type ConfigTargeting,
  type ConfigType,
  type ResolveContext,
} from '../configs/config.types.js';

const scopeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: [...SCOPE_TYPES] },
    cityId: { type: 'string' },
    zoneId: { type: 'string' },
    localityId: { type: 'string' },
  },
} as const;

const targetingSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    segments: { type: 'array', items: { type: 'string' }, uniqueItems: true },
  },
} as const;

const timeFields = {
  activeFrom: { type: 'number' },
  activeTo: { type: 'number' },
  expiresAt: { type: 'number' },
} as const;

const resolveQuery = {
  type: 'object',
  required: ['key'],
  properties: {
    key: { type: 'string', minLength: 1, maxLength: 128 },
    environment: { type: 'string', enum: [...CONFIG_ENVIRONMENTS], default: 'production' },
    cityId: { type: 'string' },
    zoneId: { type: 'string' },
    localityId: { type: 'string' },
    segment: { type: 'string' },
    now: { type: 'number' },
  },
} as const;

const contextQuery = {
  type: 'object',
  properties: {
    environment: { type: 'string', enum: [...CONFIG_ENVIRONMENTS], default: 'production' },
    cityId: { type: 'string' },
    zoneId: { type: 'string' },
    localityId: { type: 'string' },
    segment: { type: 'string' },
    now: { type: 'number' },
  },
} as const;

interface CreateConfigBody {
  key: string;
  type: ConfigType;
  environment: ConfigEnvironment;
  payload: Record<string, unknown>;
  scope?: ConfigScope;
  targeting?: ConfigTargeting;
  activeFrom?: number;
  activeTo?: number;
  expiresAt?: number;
}

interface UpdateConfigBody {
  payload?: Record<string, unknown>;
  scope?: ConfigScope;
  targeting?: ConfigTargeting;
  activeFrom?: number;
  activeTo?: number;
  expiresAt?: number;
}

interface IdParams {
  id: string;
}

interface ResolveQuery {
  key: string;
  environment: ConfigEnvironment;
  cityId?: string;
  zoneId?: string;
  localityId?: string;
  segment?: string;
  now?: number;
}

interface ContextQuery {
  environment: ConfigEnvironment;
  cityId?: string;
  zoneId?: string;
  localityId?: string;
  segment?: string;
  now?: number;
}

interface ListQuery {
  key?: string;
  environment?: ConfigEnvironment;
  state?: ConfigState;
  type?: ConfigType;
  limit?: number;
}

interface ScheduleBody {
  scheduledFor: number;
}

export function buildConfigRoutes(app: FastifyInstance): void {
  const repo = new StagingConfigRepository();
  const service = new ConfigService(repo);
  const controller = createConfigController(service);

  app.post(
    '/configs',
    {
      schema: {
        body: {
          type: 'object',
          required: ['key', 'type', 'environment', 'payload'],
          additionalProperties: false,
          properties: {
            key: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9._-]+$' },
            type: { type: 'string', enum: [...CONFIG_TYPES] },
            environment: { type: 'string', enum: [...CONFIG_ENVIRONMENTS] },
            payload: { type: 'object' },
            scope: scopeSchema,
            targeting: targetingSchema,
            ...timeFields,
          },
        },
      },
    },
    controller.create,
  );
  app.get(
    '/configs',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            key: { type: 'string', minLength: 1, maxLength: 128 },
            environment: { type: 'string', enum: [...CONFIG_ENVIRONMENTS] },
            state: { type: 'string', enum: [...CONFIG_STATES] },
            type: { type: 'string', enum: [...CONFIG_TYPES] },
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
        },
      },
    },
    controller.list,
  );
  app.get('/configs/resolve', { schema: { querystring: resolveQuery } }, controller.resolve);
  app.get('/configs/flags', { schema: { querystring: contextQuery } }, controller.flags);
  app.get('/configs/app-version', { schema: { querystring: contextQuery } }, controller.appVersion);
  app.get(
    '/configs/maintenance',
    { schema: { querystring: contextQuery } },
    controller.maintenance,
  );
  app.get('/configs/:id', { schema: { params: idParamsSchema } }, controller.getById);
  app.patch(
    '/configs/:id',
    {
      schema: {
        params: idParamsSchema,
        body: {
          type: 'object',
          minProperties: 1,
          additionalProperties: false,
          properties: {
            payload: { type: 'object' },
            scope: scopeSchema,
            targeting: targetingSchema,
            ...timeFields,
          },
        },
      },
    },
    controller.update,
  );
  app.post(
    '/configs/:id/schedule',
    {
      schema: {
        params: idParamsSchema,
        body: {
          type: 'object',
          required: ['scheduledFor'],
          additionalProperties: false,
          properties: { scheduledFor: { type: 'number' } },
        },
      },
    },
    controller.schedule,
  );
  app.post('/configs/:id/publish', { schema: { params: idParamsSchema } }, controller.publish);
  app.post('/configs/:id/expire', { schema: { params: idParamsSchema } }, controller.expire);
  app.post('/configs/:id/rollback', { schema: { params: idParamsSchema } }, controller.rollback);
}

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
} as const;

function toContext(query: ContextQuery | ResolveQuery): ResolveContext {
  return {
    environment: query.environment,
    cityId: query.cityId,
    zoneId: query.zoneId,
    localityId: query.localityId,
    segment: query.segment,
    now: query.now,
  };
}

function createConfigController(service: ConfigService) {
  return {
    async create(request: FastifyRequest<{ Body: CreateConfigBody }>, reply: FastifyReply) {
      const record = await service.createDraft(request.body);
      return reply.status(201).send(record);
    },
    async list(request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) {
      const configs = await service.list(request.query);
      return reply.send({ configs });
    },
    async resolve(request: FastifyRequest<{ Querystring: ResolveQuery }>, reply: FastifyReply) {
      const record = await service.resolve(request.query.key, toContext(request.query));
      if (!record) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `No published config for key "${request.query.key}"`,
            requestId: request.id,
          },
        });
      }
      return reply.send(record);
    },
    async flags(request: FastifyRequest<{ Querystring: ContextQuery }>, reply: FastifyReply) {
      const flags = await service.resolveFlags(toContext(request.query));
      return reply.send({ flags });
    },
    async appVersion(request: FastifyRequest<{ Querystring: ContextQuery }>, reply: FastifyReply) {
      const payload = await service.resolveAppVersion(toContext(request.query));
      return reply.send(payload);
    },
    async maintenance(request: FastifyRequest<{ Querystring: ContextQuery }>, reply: FastifyReply) {
      const payload = await service.resolveMaintenance(toContext(request.query));
      return reply.send(payload);
    },
    async getById(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
      const record = await service.getRecord(request.params.id);
      return reply.send(record);
    },
    async update(
      request: FastifyRequest<{ Params: IdParams; Body: UpdateConfigBody }>,
      reply: FastifyReply,
    ) {
      const record = await service.updateDraft(request.params.id, request.body);
      return reply.send(record);
    },
    async schedule(
      request: FastifyRequest<{ Params: IdParams; Body: ScheduleBody }>,
      reply: FastifyReply,
    ) {
      const record = await service.schedule(request.params.id, request.body.scheduledFor);
      return reply.send(record);
    },
    async publish(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
      const record = await service.publish(request.params.id);
      return reply.send(record);
    },
    async expire(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
      const record = await service.expire(request.params.id);
      return reply.send(record);
    },
    async rollback(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
      const record = await service.rollback(request.params.id);
      return reply.send(record);
    },
  };
}
