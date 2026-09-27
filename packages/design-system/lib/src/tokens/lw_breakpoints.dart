/// Responsive breakpoints (spec §32: responsive tablet layouts for
/// partner/delivery/kitchen surfaces).
abstract final class LwBreakpoints {
  /// Phones below this width use compact layouts.
  static const double compact = 0;

  /// Tablet portrait / split layouts start here (600dp).
  static const double medium = 600;

  /// Full expanded / desktop-like layouts start here (840dp).
  static const double expanded = 840;

  static bool isMedium(double width) => width >= medium;
  static bool isExpanded(double width) => width >= expanded;
}
