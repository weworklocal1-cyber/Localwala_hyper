/// Motion rules (spec §32): durations and curves only — components must
/// pick from these constants instead of ad-hoc values.
abstract final class LwMotion {
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration base = Duration(milliseconds: 250);
  static const Duration slow = Duration(milliseconds: 400);

  /// Progress/feedback loop period for skeleton shimmer.
  static const Duration skeletonPeriod = Duration(milliseconds: 1200);
}
