import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { StagingWalletRepository } from '../wallet/wallet.repository.js';
import { WalletService } from '../wallet/wallet.service.js';
import { MAX_AMOUNT_PAISE, USER_ID_PATTERN, WITHDRAWAL_STATES } from '../wallet/wallet.types.js';

const walletParams = {
  type: 'object',
  required: ['userId'],
  properties: {
    userId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
  },
} as const;

const holdParams = {
  type: 'object',
  required: ['userId', 'entryId'],
  properties: {
    ...walletParams.properties,
    entryId: { type: 'string', pattern: '^wen_[0-9a-f]{32}$' },
  },
} as const;

const withdrawalParams = {
  type: 'object',
  required: ['withdrawalId'],
  properties: {
    withdrawalId: { type: 'string', pattern: '^wdr_[0-9a-f]{32}$' },
  },
} as const;

const amountBody = {
  amount: { type: 'integer', minimum: 1, maximum: MAX_AMOUNT_PAISE },
} as const;

const moneyBody = {
  type: 'object',
  required: ['amount'],
  additionalProperties: false,
  properties: {
    ...amountBody,
    reason: { type: 'string', minLength: 1, maxLength: 200 },
    referenceId: { type: 'string', minLength: 1, maxLength: 64 },
  },
} as const;

interface WalletParams {
  userId: string;
}

interface HoldParams extends WalletParams {
  entryId: string;
}

interface WithdrawalParams {
  withdrawalId: string;
}

export function buildWalletRoutes(app: FastifyInstance): void {
  const repo = new StagingWalletRepository();
  const service = new WalletService(repo);
  const controller = createWalletController(service);

  app.post(
    '/wallets',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId'],
          additionalProperties: false,
          properties: {
            userId: { type: 'string', minLength: 1, maxLength: 64, pattern: USER_ID_PATTERN },
            ...amountBody,
          },
        },
      },
    },
    controller.createWallet,
  );
  app.get('/wallets/:userId', { schema: { params: walletParams } }, controller.getWallet);
  app.get(
    '/wallets/:userId/entries',
    {
      schema: {
        params: walletParams,
        querystring: {
          type: 'object',
          properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        },
      },
    },
    controller.listEntries,
  );
  app.post(
    '/wallets/:userId/credit',
    { schema: { params: walletParams, body: moneyBody } },
    controller.credit,
  );
  app.post(
    '/wallets/:userId/debit',
    { schema: { params: walletParams, body: moneyBody } },
    controller.debit,
  );
  app.post(
    '/wallets/:userId/holds',
    { schema: { params: walletParams, body: moneyBody } },
    controller.createHold,
  );
  app.post(
    '/wallets/:userId/holds/:entryId/release',
    {
      schema: {
        params: holdParams,
        body: {
          type: 'object',
          additionalProperties: false,
          properties: { reason: { type: 'string', minLength: 1, maxLength: 200 } },
        },
      },
    },
    controller.releaseHold,
  );
  app.post(
    '/wallets/:userId/withdrawals',
    {
      schema: {
        params: walletParams,
        body: {
          type: 'object',
          required: ['amount'],
          additionalProperties: false,
          properties: { ...amountBody },
        },
      },
    },
    controller.createWithdrawal,
  );
  app.get(
    '/wallets/:userId/withdrawals',
    {
      schema: {
        params: walletParams,
        querystring: {
          type: 'object',
          properties: {
            state: { type: 'string', enum: [...WITHDRAWAL_STATES] },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    controller.listWithdrawals,
  );
  app.post(
    '/withdrawals/:withdrawalId/approve',
    { schema: { params: withdrawalParams } },
    controller.approveWithdrawal,
  );
  app.post(
    '/withdrawals/:withdrawalId/reject',
    {
      schema: {
        params: withdrawalParams,
        body: {
          type: 'object',
          required: ['reason'],
          additionalProperties: false,
          properties: { reason: { type: 'string', minLength: 1, maxLength: 200 } },
        },
      },
    },
    controller.rejectWithdrawal,
  );
}

function createWalletController(service: WalletService) {
  return {
    async createWallet(request: FastifyRequest, reply: FastifyReply) {
      const result = await service.createWallet(request.body);
      return reply.status(201).send(result);
    },
    async getWallet(request: FastifyRequest<{ Params: WalletParams }>, reply: FastifyReply) {
      const result = await service.getWallet(request.params.userId);
      return reply.send(result);
    },
    async listEntries(
      request: FastifyRequest<{ Params: WalletParams; Querystring: unknown }>,
      reply: FastifyReply,
    ) {
      const entries = await service.listEntries(request.params.userId, request.query);
      return reply.send({ entries });
    },
    async credit(
      request: FastifyRequest<{ Params: WalletParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const result = await service.credit(request.params.userId, request.body);
      return reply.status(201).send(result);
    },
    async debit(
      request: FastifyRequest<{ Params: WalletParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const result = await service.debit(request.params.userId, request.body);
      return reply.status(201).send(result);
    },
    async createHold(
      request: FastifyRequest<{ Params: WalletParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const result = await service.createHold(request.params.userId, request.body);
      return reply.status(201).send(result);
    },
    async releaseHold(
      request: FastifyRequest<{ Params: HoldParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const result = await service.releaseHold(
        request.params.userId,
        request.params.entryId,
        request.body,
      );
      return reply.status(201).send(result);
    },
    async createWithdrawal(
      request: FastifyRequest<{ Params: WalletParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const result = await service.createWithdrawal(request.params.userId, request.body);
      return reply.status(201).send(result);
    },
    async listWithdrawals(
      request: FastifyRequest<{ Params: WalletParams; Querystring: unknown }>,
      reply: FastifyReply,
    ) {
      const withdrawals = await service.listWithdrawals(request.params.userId, request.query);
      return reply.send({ withdrawals });
    },
    async approveWithdrawal(
      request: FastifyRequest<{ Params: WithdrawalParams }>,
      reply: FastifyReply,
    ) {
      const result = await service.approveWithdrawal(request.params.withdrawalId);
      return reply.send(result);
    },
    async rejectWithdrawal(
      request: FastifyRequest<{ Params: WithdrawalParams; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const result = await service.rejectWithdrawal(request.params.withdrawalId, request.body);
      return reply.send(result);
    },
  };
}
