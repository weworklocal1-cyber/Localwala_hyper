import pino, { type Logger, type LoggerOptions } from 'pino';

export type { Logger, LoggerOptions };

export interface LoggerConfig {
  serviceName: string;
  level?: string;
  base?: Record<string, unknown>;
}

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.otp',
  '*.pin',
  '*.cardNumber',
  '*.cvv',
  '*.secret',
  '*.token',
];

export function loggerOptions(config: LoggerConfig): LoggerOptions {
  return {
    level: config.level ?? process.env.LOG_LEVEL ?? 'info',
    base: {
      service: config.serviceName,
      ...config.base,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  };
}

export function createLogger(config: LoggerConfig): Logger {
  return pino(loggerOptions(config));
}

export function createRequestChild(
  logger: Logger,
  context: { requestId?: string; traceId?: string; userId?: string },
): Logger {
  return logger.child({
    requestId: context.requestId,
    traceId: context.traceId,
    userId: context.userId,
  });
}
