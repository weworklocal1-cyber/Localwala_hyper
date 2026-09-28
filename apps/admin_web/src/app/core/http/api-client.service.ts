import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { SessionService } from '../auth/session.service';

export interface AppConfig {
  readonly apiBaseUrl: string;
}

/** Overridable app config (tests provide their own value). */
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: (): AppConfig => ({ apiBaseUrl: 'http://localhost:4000' }),
});

/** Typed client error mirroring the platform error envelope (spec §9). */
export class ApiException extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode?: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiException';
  }
}

/** Maps transport errors onto the platform error contract. */
export function mapHttpError(error: unknown): ApiException {
  if (error instanceof ApiException) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return new ApiException(
        'NETWORK_UNAVAILABLE',
        'No connection. Check your network and try again.',
      );
    }
    const body: unknown = error.error;
    if (body && typeof body === 'object' && 'error' in body) {
      const envelope = (body as { error: unknown }).error;
      if (envelope && typeof envelope === 'object' && 'code' in envelope) {
        const details = envelope as {
          code?: unknown;
          message?: unknown;
          requestId?: unknown;
        };
        return new ApiException(
          typeof details.code === 'string' ? details.code : 'UNKNOWN_ERROR',
          typeof details.message === 'string' ? details.message : 'Unexpected error.',
          error.status,
          typeof details.requestId === 'string' ? details.requestId : undefined,
        );
      }
    }
    return new ApiException(
      `HTTP_${error.status}`,
      `Request failed (${error.status}).`,
      error.status,
    );
  }
  return new ApiException('NETWORK_ERROR', 'Something went wrong. Please try again.');
}

/** Injects the bearer token from the session on every API call. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionService);
  const token = session.getToken();
  return next(
    token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request,
  );
};

/**
 * Repository/service abstraction for API access (spec §31). Feature data
 * services must go through this client — never raw HttpClient.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  get<T>(path: string, params?: Record<string, string | number>): Observable<T> {
    return this.http.get<T>(this.url(path), { params }).pipe(catchError(mapError));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.url(path), body).pipe(catchError(mapError));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(this.url(path), body).pipe(catchError(mapError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path)).pipe(catchError(mapError));
  }

  private url(path: string): string {
    const base = this.config.apiBaseUrl.replace(/\/$/, '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }
}

function mapError(error: unknown): Observable<never> {
  return throwError(() => mapHttpError(error));
}
