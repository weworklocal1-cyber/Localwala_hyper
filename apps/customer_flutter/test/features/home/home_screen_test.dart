import 'package:customer_flutter/core/networking/api_client.dart';
import 'package:customer_flutter/core/routing/app_router.dart';
import 'package:customer_flutter/core/strings/app_strings.dart';
import 'package:customer_flutter/features/home/config/home_config_repository.dart';
import 'package:customer_flutter/features/home/config/home_feed_config.dart';
import 'package:customer_flutter/features/home/home_providers.dart';
import 'package:customer_flutter/features/home/home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:localwala_design_system/localwala_design_system.dart';

import '../../helpers/fake_home_config_repository.dart';

HomeFeedConfig _feedWithBanner() => const HomeFeedConfig(
  sections: <RemoteHomeSection>[
    RemoteHomeSection(id: 'b1', component: 'banner', order: 0, visible: true),
  ],
  banner: BannerConfig(
    bannerId: 'banner-1',
    imageUrl: 'https://cdn.example/banner.jpg',
    target: '/food',
    order: 0,
    visible: true,
  ),
);

Future<void> _pumpHome(
  WidgetTester tester,
  HomeConfigRepository repository,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [homeConfigRepositoryProvider.overrideWithValue(repository)],
      child: MaterialApp.router(
        routerConfig: buildAppRouter(initialLocation: '/'),
      ),
    ),
  );
}

void main() {
  testWidgets('shows a skeleton while the feed loads', (
    WidgetTester tester,
  ) async {
    await _pumpHome(tester, FakeHomeConfigRepository(pending: true));
    await tester.pump();

    expect(find.byType(LwSkeletonLines), findsOneWidget);
    expect(find.byType(HomeScreen), findsOneWidget);
  });

  testWidgets('renders the remote-config feed once loaded', (
    WidgetTester tester,
  ) async {
    final FakeHomeConfigRepository repository = FakeHomeConfigRepository(
      response: _feedWithBanner(),
    );
    await _pumpHome(tester, repository);
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey<String>('home-banner')), findsOneWidget);
    expect(repository.calls, 1);
  });

  testWidgets('shows the empty state when nothing is published', (
    WidgetTester tester,
  ) async {
    await _pumpHome(
      tester,
      FakeHomeConfigRepository(response: HomeFeedConfig.empty),
    );
    await tester.pumpAndSettle();

    expect(find.text(AppStrings.homeEmpty), findsOneWidget);
    expect(find.byKey(const ValueKey<String>('home-banner')), findsNothing);
  });

  testWidgets('shows the error state and retries on tap', (
    WidgetTester tester,
  ) async {
    final FakeHomeConfigRepository repository = FakeHomeConfigRepository(
      error: const ApiException(
        code: 'NETWORK_UNAVAILABLE',
        message: 'No connection.',
      ),
    );
    await _pumpHome(tester, repository);
    await tester.pumpAndSettle();

    expect(find.text(AppStrings.homeConfigErrorTitle), findsOneWidget);
    expect(find.text(AppStrings.homeConfigError), findsOneWidget);
    expect(repository.calls, 1);

    repository.succeedWith(_feedWithBanner());
    await tester.tap(find.text(AppStrings.retry));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey<String>('home-banner')), findsOneWidget);
    expect(repository.calls, 2);
  });
}
