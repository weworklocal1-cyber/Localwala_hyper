import Fastify, { LogController, type FastifyInstance } from 'fastify';
import { loggerOptions } from '@localwala/logger';
import { toErrorBody } from '@localwala/errors';
import { config } from './config/index.js';
import { registerRequestContext } from './plugins/request-context.js';
import { healthRoutes } from './routes/health.js';
import { buildUserRoutes } from './routes/user.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: loggerOptions({
      serviceName: config.serviceName,
      level: config.logLevel,
    }),
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: true,
    bodyLimit: 1_048_576,
    ajv: { customOptions: { removeAdditional: false, allErrors: true } },
  });

  registerRequestContext(app);

  app.setErrorHandler((error, request, reply) => {
    const { statusCode, body } = toErrorBody(error);
    const payload = { ...body, requestId: request.id };
    if (statusCode >= 500) {
      request.log.error(
        { err: error, correlationId: request.correlationId, code: body.error.code },
        'request failed',
      );
    } else {
      request.log.warn(
        { correlationId: request.correlationId, code: body.error.code, statusCode },
        'request rejected',
      );
    }
    void reply.status(statusCode).send(payload);
  });

  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId: request.id,
      },
    });
  });

  app.register(healthRoutes);
  app.register(buildUserRoutes);

  return app;
}
