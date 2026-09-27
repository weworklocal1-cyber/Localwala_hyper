export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  INSUFFICIENT_INVENTORY: 409,
  PAYMENT_FAILED: 402,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export const ERROR_CODES = Object.keys(ERROR_STATUS) as ErrorCode[];

export interface AppErrorOptions {
  message?: string;
  details?: unknown;
  cause?: unknown;
  retryable?: boolean;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: unknown;
  readonly retryable: boolean;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    super(
      options.message ?? code,
      options.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = 'AppError';
    this.code = code;
    this.statusCode = ERROR_STATUS[code];
    this.details = options.details;
    this.retryable = options.retryable ?? this.statusCode >= 500;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export const badRequest = (message = 'Bad request', details?: unknown): AppError =>
  new AppError('VALIDATION_ERROR', { message, details });

export const unauthenticated = (message = 'Authentication required'): AppError =>
  new AppError('UNAUTHENTICATED', { message });

export const forbidden = (message = 'Insufficient permissions'): AppError =>
  new AppError('FORBIDDEN', { message });

export const notFound = (resource = 'Resource', id?: string): AppError =>
  new AppError('NOT_FOUND', {
    message: id ? `${resource} ${id} not found` : `${resource} not found`,
  });

export const conflict = (message = 'Conflict', details?: unknown): AppError =>
  new AppError('CONFLICT', { message, details });

export const rateLimited = (message = 'Too many requests', details?: unknown): AppError =>
  new AppError('RATE_LIMITED', { message, details });

export const serviceUnavailable = (message = 'Service unavailable'): AppError =>
  new AppError('SERVICE_UNAVAILABLE', { message });

export const internalError = (message = 'Internal server error', cause?: unknown): AppError =>
  new AppError('INTERNAL_ERROR', { message, cause });
