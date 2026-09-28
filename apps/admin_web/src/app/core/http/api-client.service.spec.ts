import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  APP_CONFIG,
  ApiException,
  ApiService,
  authInterceptor,
  mapHttpError,
} from './api-client.service';
import { SessionService } from '../auth/session.service';

describe('ApiService', () => {
  let http: HttpTestingController;
  let api: ApiService;
  let session: SessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'http://gw.test' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ApiService);
    session = TestBed.inject(SessionService);
    localStorage.clear();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('prefixes requests with the configured base URL', () => {
    api.get('/health').subscribe();
    const request = http.expectOne('http://gw.test/health');
    expect(request.request.method).toBe('GET');
    request.flush({ status: 'ok' });
  });

  it('attaches the bearer token from the session', () => {
    session.setToken('tok-42');
    api.get('/profile').subscribe();
    const request = http.expectOne('http://gw.test/profile');
    expect(request.request.headers.get('Authorization')).toBe('Bearer tok-42');
    request.flush({});
  });

  it('maps the platform error envelope to ApiException', () => {
    let captured: unknown;
    api.get('/orders').subscribe({ error: (e: unknown) => (captured = e) });
    const request = http.expectOne('http://gw.test/orders');
    request.flush(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'body/lat must be number',
          requestId: 'req-7',
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(captured).toBeInstanceOf(ApiException);
    const api_error = captured as ApiException;
    expect(api_error.code).toBe('VALIDATION_ERROR');
    expect(api_error.statusCode).toBe(400);
    expect(api_error.requestId).toBe('req-7');
  });

  it('maps responses without an envelope to HTTP_<status>', () => {
    let captured: unknown;
    api.get('/orders').subscribe({ error: (e: unknown) => (captured = e) });
    const request = http.expectOne('http://gw.test/orders');
    request.flush('boom', { status: 500, statusText: 'Server Error' });
    expect((captured as ApiException).code).toBe('HTTP_500');
  });

  it('maps offline requests to NETWORK_UNAVAILABLE', () => {
    let captured: unknown;
    api.get('/orders').subscribe({ error: (e: unknown) => (captured = e) });
    const request = http.expectOne('http://gw.test/orders');
    request.error(new ProgressEvent('error'), { status: 0 });
    expect((captured as ApiException).code).toBe('NETWORK_UNAVAILABLE');
  });
});

describe('mapHttpError', () => {
  it('passes through ApiException instances', () => {
    const original = new ApiException('X', 'y');
    expect(mapHttpError(original)).toBe(original);
  });

  it('falls back to NETWORK_ERROR for unknown errors', () => {
    expect(mapHttpError(new Error('nope')).code).toBe('NETWORK_ERROR');
  });
});
