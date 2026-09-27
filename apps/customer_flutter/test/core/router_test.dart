import 'package:customer_flutter/core/routing/app_router.dart';
import 'package:customer_flutter/features/auth/auth_screen.dart';
import 'package:customer_flutter/features/store/store_screen.dart';
import 'package:customer_flutter/features/support/support_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

Widget _routed(String location) => MaterialApp.router(
      routerConfig: buildAppRouter(initialLocation: location),
    );

void main() {
  testWidgets('deep-links to a non-tab route (/store)', (WidgetTester tester) async {
    await tester.pumpWidget(_routed('/store'));
    await tester.pumpAndSettle();
    expect(find.byType(StoreScreen), findsOneWidget);
  });

  testWidgets('deep-links to the auth route', (WidgetTester tester) async {
    await tester.pumpWidget(_routed('/auth/login'));
    await tester.pumpAndSettle();
    expect(find.byType(AuthScreen), findsOneWidget);
  });

  testWidgets('deep-links into a shell branch (/orders)', (WidgetTester tester) async {
    await tester.pumpWidget(_routed('/orders'));
    await tester.pumpAndSettle();
    expect(find.text('Orders'), findsWidgets);
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      3,
    );
  });

  testWidgets('deep-links to the support route', (WidgetTester tester) async {
    final GoRouter router = buildAppRouter(initialLocation: '/support');
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();
    expect(find.byType(SupportScreen), findsOneWidget);
  });
}
