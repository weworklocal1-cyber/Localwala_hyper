import 'package:customer_flutter/core/networking/api_client.dart';
import 'package:customer_flutter/core/routing/app_router.dart';
import 'package:customer_flutter/core/strings/app_strings.dart';
import 'package:customer_flutter/features/auth/auth_providers.dart';
import 'package:customer_flutter/features/auth/otp_screen.dart';
import 'package:customer_flutter/features/home/config/home_feed_config.dart';
import 'package:customer_flutter/features/home/home_providers.dart';
import 'package:customer_flutter/features/home/home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_home_config_repository.dart';
import '../../helpers/fake_otp_auth_repository.dart';

/// `+911234567890`, URL-encoded so the `+` survives query parsing.
const String _otpLocation = '/auth/otp?phone=%2B911234567890';
const String _phone = '+911234567890';

Future<void> _pumpOtp(
  WidgetTester tester,
  FakeOtpAuthRepository repository, {
  String location = _otpLocation,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        otpAuthRepositoryProvider.overrideWithValue(repository),
        // Home reads remote config through the API client; a real fetch
        // would hang on the secure-storage channel in tests (see
        // widget_test.dart), so keep it faked.
        homeConfigRepositoryProvider.overrideWithValue(
          FakeHomeConfigRepository(response: HomeFeedConfig.empty),
        ),
      ],
      child: MaterialApp.router(
        routerConfig: buildAppRouter(initialLocation: location),
      ),
    ),
  );
}

void main() {
  testWidgets('verifies, logs in and lands on home', (
    WidgetTester tester,
  ) async {
    final FakeOtpAuthRepository repository = FakeOtpAuthRepository();
    await _pumpOtp(tester, repository);

    expect(find.byType(OtpScreen), findsOneWidget);
    expect(find.byKey(const ValueKey<String>('otp-sent-to')), findsOneWidget);

    await tester.enterText(
      find.byKey(const ValueKey<String>('otp-field')),
      '123456',
    );
    await tester.pumpAndSettle();

    expect(repository.calls, <String>['verify', 'login']);
    expect(repository.verified.single, (_phone, '123456'));
    expect(repository.logins.single, (_phone, '123456'));
    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.byType(OtpScreen), findsNothing);
  });

  testWidgets('shows the verification error and clears the input', (
    WidgetTester tester,
  ) async {
    final FakeOtpAuthRepository repository = FakeOtpAuthRepository(
      verifyError: const ApiException(
        code: 'VALIDATION_ERROR',
        message: 'The code is not valid. Try again.',
        statusCode: 400,
      ),
    );
    await _pumpOtp(tester, repository);

    await tester.enterText(
      find.byKey(const ValueKey<String>('otp-field')),
      '999999',
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey<String>('otp-error')), findsOneWidget);
    expect(find.text('The code is not valid. Try again.'), findsOneWidget);
    expect(find.byType(OtpScreen), findsOneWidget);
    expect(repository.calls, <String>['verify']);
    expect(repository.logins, isEmpty);

    // The input was cleared so the user can retype the code.
    final TextField field = tester.widget<TextField>(
      find.byKey(const ValueKey<String>('otp-field')),
    );
    expect(field.controller!.text, isEmpty);
  });

  testWidgets('counts down and enables resend', (WidgetTester tester) async {
    final FakeOtpAuthRepository repository = FakeOtpAuthRepository();
    await _pumpOtp(tester, repository);

    final TextButton resend = tester.widget<TextButton>(
      find.byKey(const ValueKey<String>('resend-button')),
    );
    expect(resend.onPressed, isNull);
    expect(find.text(AppStrings.resendInWith(60)), findsOneWidget);

    await tester.pump(const Duration(seconds: 1));
    expect(find.text(AppStrings.resendInWith(59)), findsOneWidget);

    await tester.pump(const Duration(seconds: 59));
    expect(find.text(AppStrings.resendCode), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey<String>('resend-button')));
    // Not pumpAndSettle: the restarted countdown would drain the 60s
    // cooldown before we can assert on it.
    await tester.pump();
    await tester.pump();

    expect(repository.calls, contains('resend'));
    expect(repository.requestedPhones, contains(_phone));
    expect(find.text(AppStrings.otpResent), findsOneWidget);
    // The countdown restarts after a successful resend.
    expect(find.text(AppStrings.resendInWith(60)), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('verify button validates an incomplete code', (
    WidgetTester tester,
  ) async {
    final FakeOtpAuthRepository repository = FakeOtpAuthRepository();
    await _pumpOtp(tester, repository);

    await tester.tap(find.byKey(const ValueKey<String>('verify-button')));
    await tester.pumpAndSettle();

    expect(repository.calls, <String>['verify']);
    expect(find.text('Enter the 6-digit code.'), findsOneWidget);
    expect(repository.logins, isEmpty);
  });
}
