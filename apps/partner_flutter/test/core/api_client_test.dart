import 'dart:convert';
import 'dart:typed_data';

import 'package:partner_flutter/core/auth/session_store.dart';
import 'package:partner_flutter/core/config/app_config.dart';
import 'package:partner_flutter/core/networking/api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

class _MockAdapter implements HttpClientAdapter {
  _MockAdapter(this.handler);

  final ResponseBody Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(Object body, int status) {
  return ResponseBody.fromString(
    jsonEncode(body),
    status,
    headers: <String, List<String>>{
      Headers.contentTypeHeader: <String>[Headers.jsonContentType],
    },
  );
}

ApiClient _clientWith(_MockAdapter adapter, {SessionStore? session}) {
  final Dio dio = Dio(BaseOptions(baseUrl: 'http://gateway.test'))
    ..httpClientAdapter = adapter;
  return DioApiClient(
    config: const AppConfig(apiBaseUrl: 'http://gateway.test'),
    session: session ?? InMemorySessionStore(),
    dio: dio,
  );
}

void main() {
  group('DioApiClient', () {
    test('returns decoded payloads on success', () async {
      final ApiClient client = _clientWith(
        _MockAdapter(
          (RequestOptions options) => _json(<String, Object>{'ok': true}, 200),
        ),
      );
      final Object? data = await client.get('/health');
      expect(data, <String, Object>{'ok': true});
    });

    test('attaches the bearer token from the session', () async {
      final InMemorySessionStore session = InMemorySessionStore();
      await session.saveTokens(accessToken: 'tok-123', refreshToken: 'ref-1');
      String? seenAuthorization;
      final ApiClient client = _clientWith(
        _MockAdapter((RequestOptions options) {
          seenAuthorization = options.headers['authorization'] as String?;
          return _json(<String, Object>{'ok': true}, 200);
        }),
        session: session,
      );
      await client.get('/profile');
      expect(seenAuthorization, 'Bearer tok-123');
    });

    test('maps the platform error envelope to ApiException', () async {
      final ApiClient client = _clientWith(
        _MockAdapter(
          (RequestOptions options) => _json(
            <String, Object>{
              'error': <String, Object>{
                'code': 'VALIDATION_ERROR',
                'message': 'body/lat must be number',
                'requestId': 'req-42',
              },
            },
            400,
          ),
        ),
      );
      final Object error =
          await client.get('/orders').catchError((Object e) => e);
      expect(error, isA<ApiException>());
      final ApiException api = error as ApiException;
      expect(api.code, 'VALIDATION_ERROR');
      expect(api.statusCode, 400);
      expect(api.requestId, 'req-42');
    });

    test('maps responses without an envelope to HTTP_<status>', () async {
      final ApiClient client = _clientWith(
        _MockAdapter((RequestOptions options) => _json('boom', 500)),
      );
      final Object error =
          await client.get('/orders').catchError((Object e) => e);
      expect(error, isA<ApiException>());
      expect((error as ApiException).code, 'HTTP_500');
    });

    test('maps timeouts to NETWORK_TIMEOUT', () async {
      final ApiClient client = _clientWith(
        _MockAdapter(
          (RequestOptions options) => throw DioException(
            requestOptions: options,
            type: DioExceptionType.connectionTimeout,
          ),
        ),
      );
      final Object error =
          await client.get('/orders').catchError((Object e) => e);
      expect(error, isA<ApiException>());
      expect((error as ApiException).code, 'NETWORK_TIMEOUT');
    });
  });

  group('InMemorySessionStore', () {
    test('round-trips and clears tokens', () async {
      final InMemorySessionStore session = InMemorySessionStore();
      expect(await session.readAccessToken(), isNull);
      await session.saveTokens(accessToken: 'a', refreshToken: 'b');
      expect(await session.readAccessToken(), 'a');
      expect(await session.readRefreshToken(), 'b');
      await session.clear();
      expect(await session.readAccessToken(), isNull);
      expect(await session.readRefreshToken(), isNull);
    });
  });
}
