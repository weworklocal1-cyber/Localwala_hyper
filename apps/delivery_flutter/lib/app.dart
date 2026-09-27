import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localwala_design_system/localwala_design_system.dart';

import 'core/analytics/analytics.dart';
import 'core/auth/session_store.dart';
import 'core/config/app_config.dart';
import 'core/networking/api_client.dart';
import 'core/routing/app_router.dart';
import 'core/strings/app_strings.dart';

/// App-wide dependencies (Riverpod — spec §31: one state-management
/// paradigm across the app).
final Provider<AppConfig> appConfigProvider =
    Provider<AppConfig>((Ref ref) => const AppConfig());

final Provider<Analytics> analyticsProvider =
    Provider<Analytics>((Ref ref) => NoopAnalytics());

final Provider<SessionStore> sessionStoreProvider =
    Provider<SessionStore>((Ref ref) => SecureSessionStore());

final Provider<ApiClient> apiClientProvider = Provider<ApiClient>(
  (Ref ref) => DioApiClient(
    config: ref.watch(appConfigProvider),
    session: ref.watch(sessionStoreProvider),
  ),
);

final Provider<GoRouter> routerProvider =
    Provider<GoRouter>((Ref ref) => buildAppRouter());

class LocalWalaApp extends ConsumerWidget {
  const LocalWalaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: AppStrings.appName,
      debugShowCheckedModeBanner: false,
      theme: LwTheme.light(),
      routerConfig: ref.watch(routerProvider),
    );
  }
}
