import 'package:customer_flutter/core/auth/session_store.dart';
import 'package:customer_flutter/core/networking/api_client.dart';
import 'package:customer_flutter/features/auth/otp_auth_repository.dart';
import 'package:flutter_test/flutter_test.dart';

class _RecordingApiClient implements ApiClient {
  final List<({String path, Object? body})> posts =
      <({String path, Object? body})>[];
  Object? nextError;
  dynamic nextResponse;

  @override
  Future<dynamic> post(String path, {Object? body}) async {
    posts.add((path: path, body: body));
    if (nextError != null) {
      throw nextError!;
    }
    return nextResponse;
  }

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      throw UnimplementedError();

  @override
  Future<dynamic> put(String path, {Object? body}) =>
      throw UnimplementedError();

  @override
  Future<dynamic> delete(String path) => throw UnimplementedError();
}

const Map<String, Object> _loginResponse = <String, Object>{
  'user': <String, Object>{'id': 'u1', 'phone': '+911234567890'},
  'tokens': <String, Object>{
    'accessToken': 'access-1',
    'refreshToken': 'refresh-1',
    'expiresIn': 900,
    'tokenType': 'Bearer',
  },
};

void main() {
  late _RecordingApiClient api;
  late InMemorySessionStore session;
  late ApiOtpAuthRepository repository;

  setUp(() {
    api = _RecordingApiClient();
    session = InMemorySessionStore();
    repository = ApiOtpAuthRepository(api, session);
  });

  test('requestOtp posts the phone to the request path', () async {
    await repository.requestOtp('+911234567890');
    expect(api.posts, hasLength(1));
    expect(api.posts.single.path, '/auth/otp/request');
    expect(api.posts.single.body, <String, dynamic>{'phone': '+911234567890'});
  });

  test('resendOtp posts to the resend path', () async {
    await repository.resendOtp('+911234567890');
    expect(api.posts.single.path, '/auth/otp/resend');
    expect(api.posts.single.body, <String, dynamic>{'phone': '+911234567890'});
  });

  test('verifyOtp posts phone and code and requires verified:true', () async {
    api.nextResponse = <String, Object>{'verified': true};
    await repository.verifyOtp('+911234567890', '123456');
    expect(api.posts.single.path, '/auth/otp/verify');
    expect(api.posts.single.body, <String, dynamic>{
      'phone': '+911234567890',
      'code': '123456',
    });
  });

  test('verifyOtp rejects a malformed verified payload', () async {
    api.nextResponse = <String, Object>{'verified': false};
    Object? error;
    try {
      await repository.verifyOtp('+911234567890', '123456');
    } catch (e) {
      error = e;
    }
    expect(error, isA<ApiException>());
    expect((error! as ApiException).code, 'MALFORMED_RESPONSE');
    expect(api.posts.single.path, '/auth/otp/verify');
  });

  test('login sends device info and persists the returned tokens', () async {
    api.nextResponse = _loginResponse;
    await repository.login('+911234567890', '123456');

    final Map<String, dynamic> body =
        api.posts.single.body! as Map<String, dynamic>;
    expect(api.posts.single.path, '/auth/auth/login');
    expect(body['phone'], '+911234567890');
    expect(body['code'], '123456');
    final Object? device = body['device'];
    expect(device, isA<Map<String, dynamic>>());
    final String deviceId =
        (device! as Map<String, dynamic>)['deviceId'] as String;
    expect(deviceId, isNotEmpty);
    expect(await session.readAccessToken(), 'access-1');
    expect(await session.readRefreshToken(), 'refresh-1');

    // Device id is stable across logins (auth-service device tracking).
    await repository.login('+911234567890', '123456');
    final Map<String, dynamic> secondBody =
        api.posts.last.body! as Map<String, dynamic>;
    expect(
      ((secondBody['device']! as Map<String, dynamic>)['deviceId']! as String),
      deviceId,
    );
  });

  test('login rejects a payload without tokens', () async {
    api.nextResponse = <String, Object>{'user': <String, Object>{}};
    Object? error;
    try {
      await repository.login('+911234567890', '123456');
    } catch (e) {
      error = e;
    }
    expect(error, isA<ApiException>());
    expect((error! as ApiException).code, 'MALFORMED_RESPONSE');
    expect(await session.readAccessToken(), isNull);
  });

  test('propagates service errors such as staging 503', () async {
    api.nextError = const ApiException(
      code: 'SERVICE_UNAVAILABLE',
      message: 'OTP storage not configured.',
      statusCode: 503,
    );
    Object? error;
    try {
      await repository.requestOtp('+911234567890');
    } catch (e) {
      error = e;
    }
    expect(error, isA<ApiException>());
    expect((error! as ApiException).code, 'SERVICE_UNAVAILABLE');
    expect((error as ApiException).statusCode, 503);
  });
}
