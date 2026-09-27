import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:localwala_design_system/localwala_design_system.dart';

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: LwTheme.light(),
    home: Scaffold(body: Center(child: child)),
  );
}

void main() {
  group('LwButton', () {
    testWidgets('meets the 48dp touch target for the regular size',
        (WidgetTester tester) async {
      await tester.pumpWidget(_wrap(LwButton(label: 'Add to cart', onPressed: () {})));
      final Size size = tester.getSize(find.byType(LwButton));
      expect(size.height, greaterThanOrEqualTo(LwSpacing.minTouchTarget));
    });

    testWidgets('fires the callback on tap', (WidgetTester tester) async {
      bool tapped = false;
      await tester.pumpWidget(
        _wrap(LwButton(label: 'Pay', onPressed: () => tapped = true)),
      );
      await tester.tap(find.byType(LwButton));
      await tester.pump();
      expect(tapped, isTrue);
    });

    testWidgets('ignores taps while loading', (WidgetTester tester) async {
      bool tapped = false;
      await tester.pumpWidget(
        _wrap(
          LwButton(label: 'Pay', loading: true, onPressed: () => tapped = true),
        ),
      );
      await tester.tap(find.byType(LwButton), warnIfMissed: false);
      await tester.pump();
      expect(tapped, isFalse);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('ignores taps when disabled', (WidgetTester tester) async {
      await tester.pumpWidget(_wrap(const LwButton(label: 'Pay')));
      await tester.tap(find.byType(LwButton), warnIfMissed: false);
      await tester.pump();
      expect(find.byType(LwButton), findsOneWidget);
    });

    testWidgets('exposes an accessible button semantics label',
        (WidgetTester tester) async {
      await tester.pumpWidget(_wrap(LwButton(label: 'Checkout', onPressed: () {})));
      final SemanticsNode node = tester.getSemantics(find.byType(LwButton));
      expect(node.label, contains('Checkout'));
      expect(node.flagsCollection.isButton, isTrue);
    });

    testWidgets('renders icon and danger variant without crashing',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        _wrap(
          LwButton(
            label: 'Delete',
            onPressed: () {},
            icon: Icons.delete_outline,
            variant: LwButtonVariant.danger,
          ),
        ),
      );
      expect(find.byIcon(Icons.delete_outline), findsOneWidget);
    });
  });

  group('LwSkeleton', () {
    testWidgets('renders and reports loading semantics',
        (WidgetTester tester) async {
      await tester.pumpWidget(_wrap(const LwSkeleton(height: 20)));
      expect(find.byType(LwSkeleton), findsOneWidget);
      expect(find.bySemanticsLabel('Loading'), findsOneWidget);
    });

    testWidgets('renders a stack of lines with a shorter last line',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        _wrap(const SizedBox(width: 300, child: LwSkeletonLines(lines: 3))),
      );
      expect(find.byType(LwSkeleton), findsNWidgets(3));
      final double fullWidth = tester.getSize(find.byType(LwSkeleton).at(0)).width;
      final double lastWidth = tester.getSize(find.byType(LwSkeleton).at(2)).width;
      expect(fullWidth, 300);
      expect(lastWidth, 180);
    });
  });

  group('state widgets', () {
    testWidgets('renders empty state copy supplied by the caller',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        _wrap(
          const LwEmptyState(
            title: 'No orders yet',
            message: 'Your past orders will show up here.',
          ),
        ),
      );
      expect(find.text('No orders yet'), findsOneWidget);
      expect(find.text('Your past orders will show up here.'), findsOneWidget);
    });

    testWidgets('renders the retry action of an error state and fires it',
        (WidgetTester tester) async {
      bool retried = false;
      await tester.pumpWidget(
        _wrap(
          LwErrorState(
            title: 'Something went wrong',
            retryLabel: 'Retry',
            onRetry: () => retried = true,
          ),
        ),
      );
      expect(find.text('Something went wrong'), findsOneWidget);
      await tester.tap(find.text('Retry'));
      await tester.pump();
      expect(retried, isTrue);
    });

    testWidgets('renders an offline banner as a live region with the given message',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        _wrap(const LwOfflineBanner(message: 'You are offline')),
      );
      expect(find.text('You are offline'), findsOneWidget);
      expect(find.byIcon(Icons.wifi_off), findsOneWidget);
      final SemanticsNode node = tester.getSemantics(find.byType(LwOfflineBanner));
      expect(node.label, 'You are offline');
      expect(node.flagsCollection.isLiveRegion, isTrue);
    });
  });

  group('LwGap', () {
    testWidgets('lays out at the requested size', (WidgetTester tester) async {
      await tester.pumpWidget(_wrap(const LwGap.md()));
      expect(tester.getSize(find.byType(LwGap)), const Size(16, 16));
    });
  });
}
