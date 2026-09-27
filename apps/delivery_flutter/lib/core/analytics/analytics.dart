/// Analytics/crash-reporting abstraction (spec §31: core/analytics).
///
/// The shell ships a no-op implementation; a real backend adapter lands
/// with the analytics task.
abstract class Analytics {
  void track(String event, {Map<String, Object?> properties = const {}});
  void recordError(Object error, StackTrace stackTrace, {String? context});
}

class NoopAnalytics implements Analytics {
  @override
  void track(String event, {Map<String, Object?> properties = const {}}) {}

  @override
  void recordError(Object error, StackTrace stackTrace, {String? context}) {}
}

/// Test double that records what it received.
class RecordingAnalytics implements Analytics {
  final List<String> events = <String>[];
  final List<Object> errors = <Object>[];

  @override
  void track(String event, {Map<String, Object?> properties = const {}}) {
    events.add(event);
  }

  @override
  void recordError(Object error, StackTrace stackTrace, {String? context}) {
    errors.add(error);
  }
}
