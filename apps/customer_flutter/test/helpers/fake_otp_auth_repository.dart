import 'package:customer_flutter/core/networking/api_client.dart';
import 'package:customer_flutter/features/auth/otp_auth_repository.dart';

/// Scriptable fake for auth widget/screen tests (no network, no secure
/// storage — see widget_test.dart for the platform-channel hang rationale).
class FakeOtpAuthRepository implements OtpAuthRepository {
  FakeOtpAuthRepository({
    this.requestError,
    this.resendError,
    this.verifyError,
    this.loginError,
  });

  Object? requestError;
  Object? resendError;
  Object? verifyError;
  Object? loginError;

  final List<String> calls = <String>[];
  final List<String> requestedPhones = <String>[];
  final List<(String, String)> verified = <(String, String)>[];
  final List<(String, String)> logins = <(String, String)>[];

  @override
  Future<void> requestOtp(String phone) async {
    calls.add('request');
    requestedPhones.add(phone);
    if (requestError != null) {
      throw requestError!;
    }
  }

  @override
  Future<void> resendOtp(String phone) async {
    calls.add('resend');
    requestedPhones.add(phone);
    if (resendError != null) {
      throw resendError!;
    }
  }

  @override
  Future<void> verifyOtp(String phone, String code) async {
    calls.add('verify');
    if (verifyError != null) {
      throw verifyError!;
    }
    if (code.length != 6) {
      throw verifyError ??
          const ApiException(
            code: 'VALIDATION_ERROR',
            message: 'Enter the 6-digit code.',
          );
    }
    verified.add((phone, code));
  }

  @override
  Future<void> login(String phone, String code) async {
    calls.add('login');
    if (loginError != null) {
      throw loginError!;
    }
    logins.add((phone, code));
  }
}
