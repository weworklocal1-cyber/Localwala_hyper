import '../../core/auth/session_store.dart';
import '../../core/networking/api_client.dart';

/// Auth flows for the phone + OTP sign-in (spec §7: OTP request/verify/
/// resend with the auth-service; staging backends answer 503 per the repo
/// convention).
abstract interface class OtpAuthRepository {
  Future<void> requestOtp(String phone);
  Future<void> resendOtp(String phone);
  Future<void> verifyOtp(String phone, String code);

  /// Exchanges a verified phone + code for tokens and persists them in the
  /// [SessionStore].
  Future<void> login(String phone, String code);
}

class ApiOtpAuthRepository implements OtpAuthRepository {
  ApiOtpAuthRepository(this._api, this._session);

  static const String requestPath = '/auth/otp/request';
  static const String verifyPath = '/auth/otp/verify';
  static const String resendPath = '/auth/otp/resend';
  static const String loginPath = '/auth/auth/login';

  final ApiClient _api;
  final SessionStore _session;

  @override
  Future<void> requestOtp(String phone) async {
    await _api.post(requestPath, body: <String, dynamic>{'phone': phone});
  }

  @override
  Future<void> resendOtp(String phone) async {
    await _api.post(resendPath, body: <String, dynamic>{'phone': phone});
  }

  @override
  Future<void> verifyOtp(String phone, String code) async {
    final dynamic result = await _api.post(
      verifyPath,
      body: <String, dynamic>{'phone': phone, 'code': code},
    );
    if (result is! Map<String, dynamic> || result['verified'] != true) {
      throw const ApiException(
        code: 'MALFORMED_RESPONSE',
        message: 'Unexpected response. Please try again.',
      );
    }
  }

  @override
  Future<void> login(String phone, String code) async {
    final dynamic result = await _api.post(
      loginPath,
      body: <String, dynamic>{
        'phone': phone,
        'code': code,
        'device': <String, dynamic>{'deviceId': await _session.deviceId()},
      },
    );
    if (result is! Map<String, dynamic>) {
      throw const ApiException(
        code: 'MALFORMED_RESPONSE',
        message: 'Unexpected response. Please try again.',
      );
    }
    final dynamic tokens = result['tokens'];
    if (tokens is! Map<String, dynamic>) {
      throw const ApiException(
        code: 'MALFORMED_RESPONSE',
        message: 'Unexpected response. Please try again.',
      );
    }
    final Object? accessToken = tokens['accessToken'];
    final Object? refreshToken = tokens['refreshToken'];
    if (accessToken is! String ||
        accessToken.isEmpty ||
        refreshToken is! String ||
        refreshToken.isEmpty) {
      throw const ApiException(
        code: 'MALFORMED_RESPONSE',
        message: 'Unexpected response. Please try again.',
      );
    }
    await _session.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
    );
  }
}
