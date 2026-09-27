import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:partner_flutter/app.dart';
import 'package:partner_flutter/features/dashboard/dashboard_screen.dart';
import 'package:partner_flutter/features/menu/menu_screen.dart';

Widget _app() => const ProviderScope(child: LocalWalaApp());

void main() {
  testWidgets('renders the partner shell with four navigation destinations',
      (WidgetTester tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.byType(DashboardScreen), findsOneWidget);
    final NavigationBar bar =
        tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(bar.destinations, hasLength(4));
    expect(
      bar.destinations
          .map((Widget widget) => (widget as NavigationDestination).label),
      <String>['Dashboard', 'Orders', 'Menu', 'Profile'],
    );
  });

  testWidgets('switches branches when tapping the menu tab',
      (WidgetTester tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.menu_book_outlined));
    await tester.pumpAndSettle();

    expect(find.byType(MenuScreen), findsOneWidget);
    expect(find.byType(DashboardScreen), findsNothing);
  });

  testWidgets('applies the LocalWala design-system theme',
      (WidgetTester tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    final ThemeData theme =
        Theme.of(tester.element(find.byType(DashboardScreen)));
    expect(theme.brightness, Brightness.light);
    expect(theme.useMaterial3, isTrue);
    expect(theme.colorScheme.primary, isNotNull);
  });
}
