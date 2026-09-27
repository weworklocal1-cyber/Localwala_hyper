import 'package:flutter/material.dart';

/// Typography scale (spec §32).
///
/// Sizes follow a modular scale with explicit line heights; apps receive
/// the scale through [TextTheme] built by `LwTheme`, so raw `TextStyle`
/// construction outside the theme is discouraged.
abstract final class LwTypography {
  static const String? fontFamily = null; // Use the platform default font.

  static const double displaySize = 32;
  static const double displayLineHeight = 40;

  static const double headlineLargeSize = 28;
  static const double headlineLargeLineHeight = 36;

  static const double headlineMediumSize = 24;
  static const double headlineMediumLineHeight = 32;

  static const double titleLargeSize = 20;
  static const double titleLargeLineHeight = 28;

  static const double titleMediumSize = 16;
  static const double titleMediumLineHeight = 24;

  static const double titleSmallSize = 14;
  static const double titleSmallLineHeight = 20;

  static const double bodyLargeSize = 16;
  static const double bodyLargeLineHeight = 24;

  static const double bodyMediumSize = 14;
  static const double bodyMediumLineHeight = 20;

  static const double bodySmallSize = 12;
  static const double bodySmallLineHeight = 16;

  static const double labelLargeSize = 14;
  static const double labelLargeLineHeight = 20;

  static const double labelMediumSize = 12;
  static const double labelMediumLineHeight = 16;

  static const double labelSmallSize = 11;
  static const double labelSmallLineHeight = 16;

  static TextStyle style({
    required double fontSize,
    required double height,
    FontWeight weight = FontWeight.w400,
    Color? color,
    double letterSpacing = 0.0,
  }) {
    return TextStyle(
      fontSize: fontSize,
      height: height / fontSize,
      fontWeight: weight,
      color: color,
      letterSpacing: letterSpacing,
    );
  }

  static TextTheme textTheme(Color onSurface, Color onSurfaceVariant) {
    return TextTheme(
      displayLarge: style(
        fontSize: displaySize,
        height: displayLineHeight,
        weight: FontWeight.w700,
        color: onSurface,
      ),
      headlineLarge: style(
        fontSize: headlineLargeSize,
        height: headlineLargeLineHeight,
        weight: FontWeight.w700,
        color: onSurface,
      ),
      headlineMedium: style(
        fontSize: headlineMediumSize,
        height: headlineMediumLineHeight,
        weight: FontWeight.w600,
        color: onSurface,
      ),
      titleLarge: style(
        fontSize: titleLargeSize,
        height: titleLargeLineHeight,
        weight: FontWeight.w600,
        color: onSurface,
      ),
      titleMedium: style(
        fontSize: titleMediumSize,
        height: titleMediumLineHeight,
        weight: FontWeight.w600,
        color: onSurface,
      ),
      titleSmall: style(
        fontSize: titleSmallSize,
        height: titleSmallLineHeight,
        weight: FontWeight.w600,
        color: onSurfaceVariant,
      ),
      bodyLarge: style(
        fontSize: bodyLargeSize,
        height: bodyLargeLineHeight,
        color: onSurface,
      ),
      bodyMedium: style(
        fontSize: bodyMediumSize,
        height: bodyMediumLineHeight,
        color: onSurface,
      ),
      bodySmall: style(
        fontSize: bodySmallSize,
        height: bodySmallLineHeight,
        color: onSurfaceVariant,
      ),
      labelLarge: style(
        fontSize: labelLargeSize,
        height: labelLargeLineHeight,
        weight: FontWeight.w600,
        color: onSurface,
      ),
      labelMedium: style(
        fontSize: labelMediumSize,
        height: labelMediumLineHeight,
        weight: FontWeight.w600,
        color: onSurfaceVariant,
      ),
      labelSmall: style(
        fontSize: labelSmallSize,
        height: labelSmallLineHeight,
        weight: FontWeight.w500,
        color: onSurfaceVariant,
      ),
    );
  }
}
