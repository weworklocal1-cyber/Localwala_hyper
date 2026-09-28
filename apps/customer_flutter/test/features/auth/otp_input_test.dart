import 'package:customer_flutter/core/widgets/otp_input.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('normalizePhone / isValidE164Phone', () {
    test('keeps full E.164 numbers as-is', () {
      expect(normalizePhone('+911234567890'), '+911234567890');
    });

    test('prepends +91 to a 10-digit number', () {
      expect(normalizePhone('9876543210'), '+919876543210');
    });

    test('strips leading zeros, spaces and dashes', () {
      expect(normalizePhone('0 98765-43210'), '+919876543210');
    });

    test('accepts an explicit country code', () {
      expect(normalizePhone('+919876543210'), '+919876543210');
    });

    test('rejects too-short input', () {
      expect(normalizePhone('12345'), isNull);
      expect(normalizePhone(''), isNull);
      expect(normalizePhone('+0123456789'), isNull);
    });

    test('validates E.164 directly', () {
      expect(isValidE164Phone('+911234567890'), isTrue);
      expect(isValidE164Phone('9876543210'), isFalse);
      expect(isValidE164Phone('+123'), isFalse);
    });
  });

  group('OtpInput widget', () {
    Future<OtpInput> pumpOtp(
      WidgetTester tester, {
      required ValueChanged<String> onCompleted,
      bool enabled = true,
      TextEditingController? controller,
    }) async {
      late OtpInput widget;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: widget = OtpInput(
                onCompleted: onCompleted,
                enabled: enabled,
                autofocus: true,
                controller: controller,
              ),
            ),
          ),
        ),
      );
      return widget;
    }

    testWidgets('renders a box per digit and shows entered digits', (
      WidgetTester tester,
    ) async {
      await pumpOtp(tester, onCompleted: (_) {});
      expect(find.byKey(const ValueKey<String>('otp-field')), findsOneWidget);
      expect(
        find.byWidgetPredicate(
          (Widget w) =>
              w is Container && w.key == const ValueKey<String>('otp-box-0'),
        ),
        findsWidgets,
      );
      expect(find.byKey(const ValueKey<String>('otp-box-5')), findsOneWidget);

      await tester.enterText(
        find.byKey(const ValueKey<String>('otp-field')),
        '123456',
      );
      await tester.pump();

      expect(find.text('1'), findsOneWidget);
      expect(find.text('6'), findsOneWidget);
    });

    testWidgets('fires onCompleted once with the full code', (
      WidgetTester tester,
    ) async {
      final List<String> completed = <String>[];
      await pumpOtp(tester, onCompleted: completed.add);

      await tester.enterText(
        find.byKey(const ValueKey<String>('otp-field')),
        '123456',
      );
      await tester.pump();
      expect(completed, <String>['123456']);

      // Editing after completion and re-entering the same length fires
      // again only once per new completion.
      await tester.enterText(
        find.byKey(const ValueKey<String>('otp-field')),
        '12345',
      );
      await tester.pump();
      await tester.enterText(
        find.byKey(const ValueKey<String>('otp-field')),
        '123456',
      );
      await tester.pump();
      expect(completed, <String>['123456', '123456']);
    });

    testWidgets('filters non-digit input', (WidgetTester tester) async {
      final List<String> completed = <String>[];
      await pumpOtp(tester, onCompleted: completed.add);

      await tester.enterText(
        find.byKey(const ValueKey<String>('otp-field')),
        'abcdef',
      );
      await tester.pump();
      expect(completed, isEmpty);
      expect(find.text('a'), findsNothing);
    });

    testWidgets('does not fire before every digit is entered', (
      WidgetTester tester,
    ) async {
      final List<String> completed = <String>[];
      await pumpOtp(tester, onCompleted: completed.add);

      await tester.enterText(
        find.byKey(const ValueKey<String>('otp-field')),
        '12345',
      );
      await tester.pump();
      expect(completed, isEmpty);
    });
  });
}
