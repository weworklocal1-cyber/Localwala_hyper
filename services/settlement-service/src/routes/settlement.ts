import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { StagingSettlementRepository } from '../settlement/settlement.repository.js';
import { SettlementService } from '../settlement/settlement.service.js';
import {
  CYCLE_STATES,
  MAX_AMOUNT_PAISE,
  MAX_COMMISSION_BP,
  ORDER_ID_PATTERN,
  RULE_SCOPES,
  RULE_STATUSES,
  USER_ID_PATTERN,
} from '../settlement/settlement.types.js';

const ruleIdParams = {
  type: 'object',
  required: ['ruleId'],
  properties: { ruleId: { type: 'string', pattern: '^cr_[0-9a-f]{32}$' } },
} as const;

const earningIdParams = {
  type: 'object',
  required: ['earningId'],
  properties: { earningId: { type: 'string', pattern: '^ern_[0-9a-f]{32}$' } },
} as const;

const settlementIdParams = {
  type: 'object',
  required: ['settlementId'],
  properties: { settlementId: { type: 'string', pattern: '^sty_[0-9a-f]{32}$' } },
} as const;

interface IdParams {
  ruleId: string;
}

interface EarningParams {
  earningId: string;
}

interface SettlementParams {
  settlementId: string;
}

export function buildSettlementRoutes(app: FastifyInstance): void {
  const repo = new StagingSettlementRepository();
  const service = new SettlementService(repo);
  const controller = createSettlementController(service);

  app.post(
    '/commission-rules',
    {
      schema: {
        body: {
          type: 'object',
          required: ['scope', 'commissionBp'],
          additionalProperties: false,
          properties: {
            scope: { type: 'string', enum: [...RULE_SCOPES] },
            partnerId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            commissionBp: { type: 'integer', minimum: 0, maximum: MAX_COMMISSION_BP },
            fixedFeePaise: { type: 'integer', minimum: 0, maximum: MAX_AMOUNT_PAISE },
          },
        },
      },
    },
    controller.createRule,
  );
  app.get(
    '/commission-rules',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            scope: { type: 'string', enum: [...RULE_SCOPES] },
            partnerId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            status: { type: 'string', enum: [...RULE_STATUSES] },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        },
      },
    },
    controller.listRules,
  );
  app.get('/commission-rules/:ruleId', { schema: { params: ruleIdParams } }, controller.getRule);
  app.post(
    '/commission-rules/:ruleId/archive',
    { schema: { params: ruleIdParams } },
    controller.archiveRule,
  );

  app.post(
    '/earnings',
    {
      schema: {
        body: {
          type: 'object',
          required: ['orderId', 'partnerId', 'grossPaise'],
          additionalProperties: false,
          properties: {
            orderId: { type: 'string', pattern: ORDER_ID_PATTERN },
            partnerId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            grossPaise: { type: 'integer', minimum: 1, maximum: MAX_AMOUNT_PAISE },
            deliveryContributionPaise: {
              type: 'integer',
              minimum: 0,
              maximum: MAX_AMOUNT_PAISE,
            },
            taxPaise: { type: 'integer', minimum: 0, maximum: MAX_AMOUNT_PAISE },
            adjustmentPaise: { type: 'integer', minimum: 0, maximum: MAX_AMOUNT_PAISE },
            reason: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    controller.createEarning,
  );
  app.get(
    '/earnings',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            partnerId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    controller.listEarnings,
  );
  app.get('/earnings/:earningId', { schema: { params: earningIdParams } }, controller.getEarning);

  app.post(
    '/settlements',
    {
      schema: {
        body: {
          type: 'object',
          required: ['partnerId'],
          additionalProperties: false,
          properties: {
            partnerId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
          },
        },
      },
    },
    controller.createCycle,
  );
  app.get(
    '/settlements',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            partnerId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            state: { type: 'string', enum: [...CYCLE_STATES] },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    controller.listCycles,
  );
  app.get(
    '/settlements/:settlementId',
    { schema: { params: settlementIdParams } },
    controller.getCycle,
  );
  app.post(
    '/settlements/:settlementId/close',
    { schema: { params: settlementIdParams } },
    controller.closeCycle,
  );
  app.post(
    '/settlements/:settlementId/complete',
    { schema: { params: settlementIdParams } },
    controller.completeCycle,
  );
  app.post(
    '/settlements/:settlementId/fail',
    {
      schema: {
        params: settlementIdParams,
        body: {
          type: 'object',
          required: ['reason'],
          additionalProperties: false,
          properties: { reason: { type: 'string', minLength: 1, maxLength: 200 } },
        },
      },
    },
    controller.failCycle,
  );
  app.get(
    '/settlements/:settlementId/reconciliation',
    { schema: { params: settlementIdParams } },
    controller.reconcile,
  );
}

function createSettlementController(service: SettlementService) {
  return {
    async createRule(request: FastifyRequest, reply: FastifyReply) {
      const rule = await service.createRule(request.body);
      return reply.status(201).send(rule);
    },
    async listRules(request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) {
      const rules = await service.listRules(request.query);
      return reply.send({ rules });
    },
    async getRule(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
      const rule = await service.getRule(request.params.ruleId);
      return reply.send(rule);
    },
    async archiveRule(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
      const rule = await service.archiveRule(request.params.ruleId);
      return reply.send(rule);
    },
    async createEarning(request: FastifyRequest, reply: FastifyReply) {
      const earning = await service.createEarning(request.body);
      return reply.status(201).send(earning);
    },
    async listEarnings(request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) {
      const earnings = await service.listEarnings(request.query);
      return reply.send({ earnings });
    },
    async getEarning(request: FastifyRequest<{ Params: EarningParams }>, reply: FastifyReply) {
      const earning = await service.getEarning(request.params.earningId);
      return reply.send(earning);
    },
    async createCycle(request: FastifyRequest, reply: FastifyReply) {
      const cycle = await service.createCycle(request.body);
      return reply.status(201).send(cycle);
    },
    async listCycles(request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) {
      const cycles = await service.listCycles(request.query);
      return reply.send({ cycles });
    },
    async getCycle(request: FastifyRequest<{ Params: SettlementParams }>, reply: FastifyReply) {
      const cycle = await service.getCycle(request.params.settlementId);
      return reply.send(cycle);
    },
    async closeCycle(request: FastifyRequest<{ Params: SettlementParams }>, reply: FastifyReply) {
      const cycle = await service.closeCycle(request.params.settlementId);
      return reply.send(cycle);
    },
    async completeCycle(
      request: FastifyRequest<{ Params: SettlementParams }>,
      reply: FastifyReply,
    ) {
      const cycle = await service.completeCycle(request.params.settlementId);
      return reply.send(cycle);
    },
    async failCycle(
      request: FastifyRequest<{ Params: SettlementParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const cycle = await service.failCycle(request.params.settlementId, request.body);
      return reply.send(cycle);
    },
    async reconcile(request: FastifyRequest<{ Params: SettlementParams }>, reply: FastifyReply) {
      const report = await service.reconcile(request.params.settlementId);
      return reply.send(report);
    },
  };
}
