import 'dart:async';

import 'package:flutter/foundation.dart';

import '../analytics/analytics.dart';

/// Crash/error handling (spec §31): routes framework and zone errors into
/// the [Analytics] sink so nothing escapes silently.
///
/// The whole app runs inside a guarded zone via [runAppWithCrashHandlers].
void runAppWithCrashHandlers(Analytics analytics, void Function() app) {
  final FlutterExceptionHandler? previousFlutterOnError = FlutterError.onError;
  FlutterError.onError = (FlutterErrorDetails details) {
    analytics.recordError(
      details.exception,
      details.stack ?? StackTrace.empty,
      context: details.context?.toDescription(),
    );
    if (kDebugMode) {
      FlutterError.presentError(details);
    }
    previousFlutterOnError?.call(details);
  };

  runZonedGuarded(app, (Object error, StackTrace stackTrace) {
    analytics.recordError(error, stackTrace, context: 'zone');
    if (kDebugMode) {
      debugPrint('Uncaught error: $error\n$stackTrace');
    }
  });
}
