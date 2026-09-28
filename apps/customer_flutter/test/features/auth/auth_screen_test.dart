import 'package:customer_flutter/core/networking/api_client.dart';
import 'package:customer_flutter/core/routing/app_router.dart';
import 'package:customer_flutter/core/strings/app_strings.dart';
import 'package:customer_flutter/features/auth/auth_providers.dart';
import 'package:customer_flutter/features/auth/auth_screen.dart';
import 'package:customer_flutter/features/auth/otp_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_otp_auth_repository.dart';

Future<void> _pumpAuth(
  WidgetTester tester,
  FakeOtpAuthRepository repository,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [otpAuthRepositoryProvider.overrideWithValue(repository)],
      child: MaterialApp.router(
        routerConfig: buildAppRouter(initialLocation: '/auth/login'),
      ),
    ),
  );
}

void main() {
  testWidgets('rejects an invalid phone before any request', (
    WidgetTester tester,
  ) async {
    final FakeOtpAuthRepository repository = FakeOtpAuthRepository();
    await _pumpAuth(tester, repository);

    await tester.enterText(
      find.byKey(const ValueKey<String>('phone-field')),
      '12',
    );
    await tester.tap(find.byKey(const ValueKey<String>('send-code-button')));
    await tester.pump();

    expect(find.text(AppStrings.phoneInvalid), findsOneWidget);
    expect(repository.calls, isEmpty);
    expect(find.byType(AuthScreen), findsOneWidget);
  });

  testWidgets('requests an OTP and routes to the code screen', (
    WidgetTester tester,
  ) async {
    final FakeOtpAuthRepository repository = FakeOtpAuthRepository();
    await _pumpAuth(tester, repository);

    await tester.enterText(
      find.byKey(const ValueKey<String>('phone-field')),
      '98765 43210',
    );
    await tester.tap(find.byKey(const ValueKey<String>('send-code-button')));
    await tester.pumpAndSettle();

    expect(repository.calls, <String>['request']);
    expect(repository.requestedPhones, <String>['+919876543210']);
    expect(find.byType(OtpScreen), findsOneWidget);
    expect(find.byKey(const ValueKey<String>('otp-sent-to')), findsOneWidget);
    expect(find.textContaining('+919876543210'), findsOneWidget);
  });

  testWidgets('shows the service error and stays on the phone screen', (
    WidgetTester tester,
  ) async {
    final FakeOtpAuthRepository repository = FakeOtpAuthRepository(
      requestError: const ApiException(
        code: 'RATE_LIMITED',
        message: 'Too many codes requested. Try again later.',
        statusCode: 429,
      ),
    );
    await _pumpAuth(tester, repository);

    await tester.enterText(
      find.byKey(const ValueKey<String>('phone-field')),
      '9876543210',
    );
    await tester.tap(find.byKey(const ValueKey<String>('send-code-button')));
    await tester.pump();

    expect(
      find.text('Too many codes requested. Try again later.'),
      findsOneWidget,
    );
    expect(find.byType(AuthScreen), findsOneWidget);
    expect(find.byType(OtpScreen), findsNothing);
  });
}
