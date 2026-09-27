import 'package:flutter/material.dart';

/// LocalWala color tokens — olive-green brand language (spec §32).
///
/// The olive scale is the brand ramp; semantic colors layer on top so
/// components never hardcode raw hex values. All foreground/background
/// pairs exposed as `on*` colors are verified against WCAG AA (4.5:1)
/// by `test/contrast_test.dart`.
abstract final class LwColors {
  // Olive brand ramp (50 = tint, 900 = shade).
  static const Color olive50 = Color(0xFFF4F6EC);
  static const Color olive100 = Color(0xFFE7EBD3);
  static const Color olive200 = Color(0xFFCFD7A7);
  static const Color olive300 = Color(0xFFB2BC76);
  static const Color olive400 = Color(0xFF96A450);
  static const Color olive500 = Color(0xFF7B8A34);
  static const Color olive600 = Color(0xFF5F6D27);
  static const Color olive700 = Color(0xFF4A5D23); // brand primary
  static const Color olive800 = Color(0xFF3B4A1E);
  static const Color olive900 = Color(0xFF2C3718);

  // Brand primary and its foreground.
  static const Color primary = olive700;
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color primaryContainer = olive100;
  static const Color onPrimaryContainer = olive900;

  // Surfaces (light).
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF4F4F1);
  static const Color onSurface = Color(0xFF1C1B17);
  static const Color onSurfaceVariant = Color(0xFF4A4943);
  static const Color outline = Color(0xFF7A7970);
  static const Color divider = Color(0xFFE4E3DD);

  // Feedback.
  static const Color danger = Color(0xFFB3261E);
  static const Color onDanger = Color(0xFFFFFFFF);
  static const Color warning = Color(0xFF8A5A00);
  static const Color onWarning = Color(0xFFFFFFFF);
  static const Color success = Color(0xFF3D6B1F);
  static const Color onSuccess = Color(0xFFFFFFFF);
  static const Color info = Color(0xFF1F5E8C);
  static const Color onInfo = Color(0xFFFFFFFF);

  // Skeleton / shimmer base.
  static const Color skeletonBase = Color(0xFFE7E6E1);
  static const Color skeletonHighlight = Color(0xFFF4F3EE);

  // Dark surfaces.
  static const Color darkSurface = Color(0xFF16170F);
  static const Color darkSurfaceVariant = Color(0xFF23241B);
  static const Color darkOnSurface = Color(0xFFECEBE4);
  static const Color darkOnSurfaceVariant = Color(0xFFB9B8AF);
  static const Color darkOutline = Color(0xFF8D8C83);
  static const Color darkDivider = Color(0xFF33342A);

  /// Dark-mode brand primary: olive400 keeps AA contrast on dark surfaces.
  static const Color darkPrimary = olive400;
  static const Color darkOnPrimary = Color(0xFF17200A);
}
