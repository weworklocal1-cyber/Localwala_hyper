import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { buildAdapters } from '../notification/adapters.js';
import { StagingNotificationRepository } from '../notification/notification.repository.js';
import { NotificationService } from '../notification/notification.service.js';
import {
  CHANNELS,
  DEEP_LINK_PATTERN,
  LOCALE_PATTERN,
  TEMPLATE_KEY_PATTERN,
  USER_ID_PATTERN,
} from '../notification/notification.types.js';

const templateIdParams = {
  type: 'object',
  required: ['templateId'],
  properties: { templateId: { type: 'string', pattern: '^tpl_[0-9a-f]{32}$' } },
} as const;

const userIdParams = {
  type: 'object',
  required: ['userId'],
  properties: {
    userId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
  },
} as const;

const inAppIdParams = {
  type: 'object',
  required: ['notificationId'],
  properties: { notificationId: { type: 'string', pattern: '^ian_[0-9a-f]{32}$' } },
} as const;

const templateKey = {
  type: 'string',
  minLength: 2,
  maxLength: 64,
  pattern: TEMPLATE_KEY_PATTERN,
} as const;
const localeProp = { type: 'string', pattern: LOCALE_PATTERN } as const;
const deepLinkProp = {
  type: 'string',
  minLength: 1,
  maxLength: 300,
  pattern: DEEP_LINK_PATTERN,
} as const;

interface TemplateIdParams {
  templateId: string;
}

interface UserIdParams {
  userId: string;
}

interface InAppIdParams {
  notificationId: string;
}

export function buildNotificationRoutes(app: FastifyInstance): void {
  const repo = new StagingNotificationRepository();
  const adapters = buildAdapters(repo, ['push', 'sms', 'email', 'whatsapp']);
  const service = new NotificationService(repo, adapters);
  const controller = createNotificationController(service);

  app.post(
    '/templates',
    {
      schema: {
        body: {
          type: 'object',
          required: ['key', 'channel', 'body'],
          additionalProperties: false,
          properties: {
            key: templateKey,
            channel: { type: 'string', enum: [...CHANNELS] },
            title: { type: 'string', minLength: 1, maxLength: 200 },
            body: { type: 'string', minLength: 1, maxLength: 1000 },
            locale: localeProp,
          },
        },
      },
    },
    controller.createTemplate,
  );
  app.get(
    '/templates',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            channel: { type: 'string', enum: [...CHANNELS] },
            key: templateKey,
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        },
      },
    },
    controller.listTemplates,
  );
  app.get(
    '/templates/:templateId',
    { schema: { params: templateIdParams } },
    controller.getTemplate,
  );
  app.put(
    '/templates/:templateId',
    {
      schema: {
        params: templateIdParams,
        body: {
          type: 'object',
          additionalProperties: false,
          minProperties: 1,
          properties: {
            title: { type: ['string', 'null'], minLength: 1, maxLength: 200 },
            body: { type: 'string', minLength: 1, maxLength: 1000 },
            locale: localeProp,
          },
        },
      },
    },
    controller.updateTemplate,
  );
  app.delete(
    '/templates/:templateId',
    { schema: { params: templateIdParams } },
    controller.deleteTemplate,
  );

  app.get('/preferences/:userId', { schema: { params: userIdParams } }, controller.getPreferences);
  app.put(
    '/preferences',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'channel', 'enabled'],
          additionalProperties: false,
          properties: {
            userId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            channel: { type: 'string', enum: [...CHANNELS] },
            enabled: { type: 'boolean' },
          },
        },
      },
    },
    controller.setPreference,
  );

  app.post(
    '/notifications/send',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'channel', 'templateKey'],
          additionalProperties: false,
          properties: {
            userId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            channel: { type: 'string', enum: [...CHANNELS] },
            templateKey,
            variables: {
              type: 'object',
              additionalProperties: { type: ['string', 'number'] },
              maxProperties: 50,
            },
            deepLink: deepLinkProp,
          },
        },
      },
    },
    controller.send,
  );

  app.post(
    '/notifications/in-app',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'title'],
          additionalProperties: false,
          properties: {
            userId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            title: { type: 'string', minLength: 1, maxLength: 200 },
            body: { type: 'string', minLength: 1, maxLength: 1000 },
            deepLink: deepLinkProp,
          },
        },
      },
    },
    controller.createInApp,
  );
  app.get(
    '/notifications/in-app',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            unreadOnly: { type: 'string', enum: ['true', 'false'] },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    controller.listInApp,
  );
  app.post(
    '/notifications/in-app/:notificationId/read',
    { schema: { params: inAppIdParams } },
    controller.markInAppRead,
  );
  app.post(
    '/notifications/in-app/:userId/read-all',
    { schema: { params: userIdParams } },
    controller.markAllInAppRead,
  );
}

function createNotificationController(service: NotificationService) {
  return {
    async createTemplate(request: FastifyRequest, reply: FastifyReply) {
      const template = await service.createTemplate(request.body);
      return reply.status(201).send(template);
    },
    async listTemplates(request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) {
      const templates = await service.listTemplates(request.query);
      return reply.send({ templates });
    },
    async getTemplate(request: FastifyRequest<{ Params: TemplateIdParams }>, reply: FastifyReply) {
      const template = await service.getTemplate(request.params.templateId);
      return reply.send(template);
    },
    async updateTemplate(
      request: FastifyRequest<{ Params: TemplateIdParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const template = await service.updateTemplate(request.params.templateId, request.body);
      return reply.send(template);
    },
    async deleteTemplate(
      request: FastifyRequest<{ Params: TemplateIdParams }>,
      reply: FastifyReply,
    ) {
      await service.deleteTemplate(request.params.templateId);
      return reply.send({ deleted: true });
    },
    async getPreferences(request: FastifyRequest<{ Params: UserIdParams }>, reply: FastifyReply) {
      const preferences = await service.getPreferences(request.params.userId);
      return reply.send({ preferences });
    },
    async setPreference(request: FastifyRequest, reply: FastifyReply) {
      const preference = await service.setPreference(request.body);
      return reply.send(preference);
    },
    async send(request: FastifyRequest, reply: FastifyReply) {
      const result = await service.send(request.body);
      return reply.status(result.status === 'sent' ? 201 : 200).send(result);
    },
    async createInApp(request: FastifyRequest, reply: FastifyReply) {
      const notification = await service.createInApp(request.body);
      return reply.status(201).send(notification);
    },
    async listInApp(request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) {
      const notifications = await service.listInApp(request.query);
      return reply.send({ notifications });
    },
    async markInAppRead(request: FastifyRequest<{ Params: InAppIdParams }>, reply: FastifyReply) {
      const notification = await service.markInAppRead(request.params.notificationId);
      return reply.send(notification);
    },
    async markAllInAppRead(request: FastifyRequest<{ Params: UserIdParams }>, reply: FastifyReply) {
      const result = await service.markAllInAppRead(request.params.userId);
      return reply.send(result);
    },
  };
}
