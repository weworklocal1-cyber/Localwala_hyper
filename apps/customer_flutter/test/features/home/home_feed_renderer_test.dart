import 'package:customer_flutter/features/home/config/home_feed_config.dart';
import 'package:customer_flutter/features/home/render/home_feed_renderer.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

RemoteHomeSection _section(
  String id,
  String component, {
  int order = 0,
  bool visible = true,
}) {
  return RemoteHomeSection(
    id: id,
    component: component,
    order: order,
    visible: visible,
  );
}

Widget _host(HomeFeedRenderer renderer) =>
    MaterialApp(home: Scaffold(body: renderer));

void main() {
  group('SectionRegistry', () {
    test('standard registry exposes only the shipped components', () {
      final SectionRegistry registry = SectionRegistry.standard();
      expect(registry.supports(HomeComponents.banner), isTrue);
      expect(registry.supports(HomeComponents.lottieHeader), isTrue);
      expect(registry.supports('eval_script'), isFalse);
      expect(registry.supports('arbitrary_widget'), isFalse);
    });
  });

  group('HomeFeedRenderer', () {
    testWidgets('renders visible sections in published order', (
      WidgetTester tester,
    ) async {
      final SectionRegistry registry = SectionRegistry(<String, SectionBuilder>{
        'one': (SectionBuildContext context) =>
            Text('one:${context.section.id}'),
        'two': (SectionBuildContext context) => const Text('two'),
      });
      await tester.pumpWidget(
        _host(
          HomeFeedRenderer(
            config: HomeFeedConfig(
              sections: <RemoteHomeSection>[
                _section('s-later', 'one', order: 2),
                _section('s-first', 'two', order: 1),
                _section('s-hidden', 'one', order: 0, visible: false),
                _section('s-unknown', 'not_registered', order: 0),
              ],
            ),
            registry: registry,
          ),
        ),
      );

      expect(find.byType(ListView), findsOneWidget);
      expect(find.text('one:s-later'), findsOneWidget);
      expect(find.text('two'), findsOneWidget);
      expect(find.text('one:s-hidden'), findsNothing);

      final double first = tester.getTopLeft(find.text('two')).dy;
      final double second = tester.getTopLeft(find.text('one:s-later')).dy;
      expect(first, lessThan(second));
    });

    testWidgets('unknown components are skipped without executing anything', (
      WidgetTester tester,
    ) async {
      final SectionRegistry registry = SectionRegistry(<String, SectionBuilder>{
        'one': (SectionBuildContext context) => const Text('known'),
      });
      await tester.pumpWidget(
        _host(
          HomeFeedRenderer(
            config: HomeFeedConfig(
              sections: <RemoteHomeSection>[
                _section('s-evil', 'remote_code', order: 0),
                _section('s-ok', 'one', order: 1),
              ],
            ),
            registry: registry,
          ),
        ),
      );

      expect(find.text('known'), findsOneWidget);
      expect(find.byType(ListView), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a failing section is isolated and reported', (
      WidgetTester tester,
    ) async {
      Object? reported;
      RemoteHomeSection? reportedSection;
      final SectionRegistry registry = SectionRegistry(<String, SectionBuilder>{
        'boom': (SectionBuildContext context) =>
            throw StateError('builder failed'),
        'two': (SectionBuildContext context) => const Text('still here'),
      });
      await tester.pumpWidget(
        _host(
          HomeFeedRenderer(
            config: HomeFeedConfig(
              sections: <RemoteHomeSection>[
                _section('s-bad', 'boom', order: 0),
                _section('s-good', 'two', order: 1),
              ],
            ),
            registry: registry,
            onSectionError: (Object error, RemoteHomeSection section) {
              reported = error;
              reportedSection = section;
            },
          ),
        ),
      );

      expect(find.text('still here'), findsOneWidget);
      expect(tester.takeException(), isNull);
      expect(reported, isA<StateError>());
      expect(reportedSection?.id, 's-bad');
    });

    testWidgets('standard registry renders the native banner and lottie slot', (
      WidgetTester tester,
    ) async {
      String? navigatedTo;
      await tester.pumpWidget(
        _host(
          HomeFeedRenderer(
            config: HomeFeedConfig(
              sections: <RemoteHomeSection>[
                _section('h1', HomeComponents.lottieHeader, order: 0),
                _section('b1', HomeComponents.banner, order: 1),
              ],
              banner: const BannerConfig(
                bannerId: 'banner-1',
                imageUrl: 'https://cdn.example/banner.jpg',
                target: '/food',
                order: 0,
                visible: true,
              ),
              lottie: const LottieConfig(
                url: 'https://cdn.example/header.json',
                visible: true,
              ),
            ),
            onNavigate: (String target) => navigatedTo = target,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.byKey(const ValueKey<String>('home-lottie-slot')),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey<String>('home-banner')), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey<String>('home-banner')));
      await tester.pump();
      expect(navigatedTo, '/food');
    });

    testWidgets('hidden banner and lottie configs render nothing', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        _host(
          HomeFeedRenderer(
            config: HomeFeedConfig(
              sections: <RemoteHomeSection>[
                _section('h1', HomeComponents.lottieHeader, order: 0),
                _section('b1', HomeComponents.banner, order: 1),
              ],
              banner: const BannerConfig(
                bannerId: 'banner-1',
                imageUrl: 'https://cdn.example/banner.jpg',
                target: '/food',
                order: 0,
                visible: false,
              ),
              lottie: const LottieConfig(
                url: 'https://cdn.example/header.json',
                visible: false,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.byKey(const ValueKey<String>('home-lottie-slot')),
        findsNothing,
      );
      expect(find.byKey(const ValueKey<String>('home-banner')), findsNothing);
    });

    testWidgets('an empty feed renders no list', (WidgetTester tester) async {
      await tester.pumpWidget(
        _host(HomeFeedRenderer(config: HomeFeedConfig.empty)),
      );
      expect(find.byType(ListView), findsNothing);
    });
  });
}
