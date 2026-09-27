import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:delivery_flutter/app.dart';
import 'package:delivery_flutter/features/deliveries/deliveries_screen.dart';
import 'package:delivery_flutter/features/home/home_screen.dart';

Widget _app() => const ProviderScope(child: LocalWalaApp());

void main() {
  testWidgets('renders the delivery shell with four navigation destinations',
      (WidgetTester tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
    final NavigationBar bar =
        tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(bar.destinations, hasLength(4));
    expect(
      bar.destinations
          .map((Widget widget) => (widget as NavigationDestination).label),
      <String>['Home', 'Deliveries', 'Earnings', 'Profile'],
    );
  });

  testWidgets('switches branches when tapping the deliveries tab',
      (WidgetTester tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.local_shipping_outlined));
    await tester.pumpAndSettle();

    expect(find.byType(DeliveriesScreen), findsOneWidget);
    expect(find.byType(HomeScreen), findsNothing);
  });

  testWidgets('applies the LocalWala design-system theme',
      (WidgetTester tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    final ThemeData theme = Theme.of(tester.element(find.byType(HomeScreen)));
    expect(theme.brightness, Brightness.light);
    expect(theme.useMaterial3, isTrue);
    expect(theme.colorScheme.primary, isNotNull);
  });
}
