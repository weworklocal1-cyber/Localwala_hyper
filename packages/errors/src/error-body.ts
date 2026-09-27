import { AppError, isAppError, type ErrorCode } from './app-error.js';

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

interface FastifyLikeError {
  validation?: unknown;
  statusCode?: number;
  code?: string;
  message?: string;
}

const hasValidation = (error: unknown): error is FastifyLikeError =>
  typeof error === 'object' && error !== null && 'validation' in error;

export function toErrorBody(error: unknown): { statusCode: number; body: ErrorBody } {
  if (isAppError(error)) {
    const body: ErrorBody = { error: { code: error.code, message: error.message } };
    if (error.details !== undefined) body.error.details = error.details;
    return { statusCode: error.statusCode, body };
  }

  if (hasValidation(error)) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message ?? 'Request validation failed',
          details: error.validation,
        },
      },
    };
  }

  const fastifyError = error as FastifyLikeError | undefined;
  const status = typeof fastifyError?.statusCode === 'number' ? fastifyError.statusCode : 500;

  if (status === 404) {
    return { statusCode: 404, body: { error: { code: 'NOT_FOUND', message: 'Route not found' } } };
  }

  if (status >= 400 && status < 500) {
    return {
      statusCode: status,
      body: {
        error: {
          code: status === 429 ? 'RATE_LIMITED' : 'VALIDATION_ERROR',
          message: fastifyError?.message ?? 'Request failed',
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
  };
}

export function errorFromStatus(statusCode: number, message?: string): AppError {
  const code: ErrorCode =
    statusCode === 401
      ? 'UNAUTHENTICATED'
      : statusCode === 403
        ? 'FORBIDDEN'
        : statusCode === 404
          ? 'NOT_FOUND'
          : statusCode === 409
            ? 'CONFLICT'
            : statusCode === 429
              ? 'RATE_LIMITED'
              : statusCode >= 500
                ? 'SERVICE_UNAVAILABLE'
                : 'VALIDATION_ERROR';
  return new AppError(code, message ? { message } : {});
}
