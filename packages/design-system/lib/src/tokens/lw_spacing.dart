/// Spacing scale (4px base grid) plus touch-target and layout constants
/// (spec §32: spacing system, touch target minimums).
abstract final class LwSpacing {
  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;
  static const double xxxl = 64;

  /// Minimum interactive touch target (WCAG 2.5.5 / Material spec).
  static const double minTouchTarget = 48;

  /// Default page gutter.
  static const double gutter = md;

  /// Maximum readable line length in logical pixels (~40rem body text).
  static const double maxContentWidth = 640;
}
