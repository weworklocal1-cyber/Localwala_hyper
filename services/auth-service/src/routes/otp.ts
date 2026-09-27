import type { FastifyInstance } from 'fastify';
import { createOtpController } from '../controllers/otp.controller.js';
import { OtpService } from '../otp/otp.service.js';
import { StagingOtpProvider } from '../otp/staging-otp-provider.js';
import {
  StagingOtpRepository,
  StagingRateLimiter,
  createOtpConfig,
} from '../otp/otp.repository.js';

export function buildOtpRoutes(app: FastifyInstance): void {
  const provider = new StagingOtpProvider();
  const repository = new StagingOtpRepository();
  const rateLimiter = new StagingRateLimiter();
  const config = createOtpConfig();
  const otpService = new OtpService(provider, repository, rateLimiter, config);
  const controller = createOtpController(otpService);

  app.post(
    '/otp/request',
    {
      schema: {
        body: { type: 'object', properties: { phone: { type: 'string' } }, required: ['phone'] },
      },
    },
    controller.request,
  );
  app.post(
    '/otp/verify',
    {
      schema: {
        body: {
          type: 'object',
          properties: { phone: { type: 'string' }, code: { type: 'string' } },
          required: ['phone', 'code'],
        },
      },
    },
    controller.verify,
  );
  app.post(
    '/otp/resend',
    {
      schema: {
        body: { type: 'object', properties: { phone: { type: 'string' } }, required: ['phone'] },
      },
    },
    controller.resend,
  );
}
