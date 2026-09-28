import 'package:customer_flutter/app.dart';
import 'package:customer_flutter/features/food/food_screen.dart';
import 'package:customer_flutter/features/home/home_providers.dart';
import 'package:customer_flutter/features/home/home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers/fake_home_config_repository.dart';

Widget _app() => ProviderScope(
  overrides: [
    homeConfigRepositoryProvider.overrideWithValue(FakeHomeConfigRepository()),
  ],
  child: const LocalWalaApp(),
);

void main() {
  testWidgets('renders the customer shell with five navigation destinations', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
    final NavigationBar bar = tester.widget<NavigationBar>(
      find.byType(NavigationBar),
    );
    expect(bar.destinations, hasLength(5));
    expect(
      bar.destinations.map(
        (Widget widget) => (widget as NavigationDestination).label,
      ),
      <String>['Home', 'Food', 'Cart', 'Orders', 'Profile'],
    );
  });

  testWidgets('switches branches when tapping the food tab', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.restaurant_outlined));
    await tester.pumpAndSettle();

    expect(find.byType(FoodScreen), findsOneWidget);
    expect(find.byType(HomeScreen), findsNothing);
  });

  testWidgets('applies the LocalWala design-system theme', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    final ThemeData theme = Theme.of(tester.element(find.byType(HomeScreen)));
    expect(theme.brightness, Brightness.light);
    expect(theme.useMaterial3, isTrue);
    expect(theme.colorScheme.primary, isNotNull);
  });
}
