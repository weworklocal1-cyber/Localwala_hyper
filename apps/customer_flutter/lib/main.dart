import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/analytics/analytics.dart';
import 'core/crash/crash_handlers.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final Analytics analytics = NoopAnalytics();
  runAppWithCrashHandlers(analytics, () {
    runApp(const ProviderScope(child: LocalWalaApp()));
  });
}
