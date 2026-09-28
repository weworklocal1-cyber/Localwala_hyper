import 'package:customer_flutter/features/home/config/home_feed_config.dart';
import 'package:customer_flutter/features/home/widgets/home_section_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lottie/lottie.dart';

Widget _host(LottieConfig lottie) {
  return MaterialApp(
    home: Scaffold(body: LottieHeader(lottie: lottie)),
  );
}

LottieConfig _config({
  bool visible = true,
  String? fit,
  double? speed,
  bool? loop,
}) {
  return LottieConfig(
    url: 'https://cdn.example/header.json',
    fit: fit,
    speed: speed,
    loop: loop,
    visible: visible,
  );
}

void main() {
  group('lottieBoxFit', () {
    test('maps published fit values and defaults to contain', () {
      expect(lottieBoxFit('cover'), BoxFit.cover);
      expect(lottieBoxFit('fill'), BoxFit.fill);
      expect(lottieBoxFit('contain'), BoxFit.contain);
      expect(lottieBoxFit(null), BoxFit.contain);
      expect(lottieBoxFit('stretch'), BoxFit.contain);
    });
  });

  group('lottieDurationForSpeed', () {
    test('scales the composition duration by speed', () {
      expect(
        lottieDurationForSpeed(const Duration(seconds: 4), 2.0),
        const Duration(seconds: 2),
      );
      expect(
        lottieDurationForSpeed(const Duration(seconds: 4), 0.5),
        const Duration(seconds: 8),
      );
      expect(
        lottieDurationForSpeed(const Duration(seconds: 4), 1.0),
        const Duration(seconds: 4),
      );
    });

    test('guards against non-positive speeds', () {
      expect(
        lottieDurationForSpeed(const Duration(seconds: 4), 0),
        const Duration(seconds: 4),
      );
    });
  });

  group('LottieHeader', () {
    testWidgets('renders the player with published animation settings', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        _host(_config(fit: 'cover', loop: false, speed: 1.0)),
      );
      await tester.pumpAndSettle();

      final LottieBuilder builder = tester.widget<LottieBuilder>(
        find.byType(LottieBuilder),
      );
      expect(builder.fit, BoxFit.cover);
      expect(builder.repeat, isFalse);
      expect(builder.controller, isNull);
      expect(
        (builder.lottie as dynamic).url,
        'https://cdn.example/header.json',
      );
      expect(
        find.byKey(const ValueKey<String>('home-lottie-header')),
        findsOneWidget,
      );
    });

    testWidgets('uses a custom controller when a playback speed is set', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(_host(_config(speed: 2.0)));
      await tester.pumpAndSettle();

      final LottieBuilder builder = tester.widget<LottieBuilder>(
        find.byType(LottieBuilder),
      );
      expect(builder.controller, isNotNull);
    });

    testWidgets('falls back to a native placeholder when loading fails', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(_host(_config()));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.animation_outlined), findsOneWidget);
    });

    testWidgets('renders nothing when the header is hidden', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(_host(_config(visible: false)));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const ValueKey<String>('home-lottie-header')),
        findsNothing,
      );
      expect(find.byType(LottieBuilder), findsNothing);
      expect(find.byIcon(Icons.animation_outlined), findsNothing);
    });
  });
}
