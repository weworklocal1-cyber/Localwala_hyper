import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../tokens/lw_colors.dart';
import '../tokens/lw_elevation.dart';
import '../tokens/lw_motion.dart';
import '../tokens/lw_radii.dart';
import '../tokens/lw_spacing.dart';
import '../tokens/lw_typography.dart';

/// Theme builders (spec §32).
///
/// Dark mode decision: the package ships both themes and apps may switch
/// per system preference, but the initial shells default to light until a
/// full dark-mode contrast audit is signed off (documented in README).
abstract final class LwTheme {
  static ThemeData light() => _build(
        brightness: Brightness.light,
        colorScheme: const ColorScheme.light(
          primary: LwColors.primary,
          onPrimary: LwColors.onPrimary,
          primaryContainer: LwColors.primaryContainer,
          onPrimaryContainer: LwColors.onPrimaryContainer,
          secondary: LwColors.olive500,
          onSecondary: LwColors.onPrimary,
          surface: LwColors.surface,
          onSurface: LwColors.onSurface,
          onSurfaceVariant: LwColors.onSurfaceVariant,
          surfaceContainerHighest: LwColors.surfaceVariant,
          outline: LwColors.outline,
          error: LwColors.danger,
          onError: LwColors.onDanger,
        ),
        onSurface: LwColors.onSurface,
        onSurfaceVariant: LwColors.onSurfaceVariant,
        dividerColor: LwColors.divider,
      );

  static ThemeData dark() => _build(
        brightness: Brightness.dark,
        colorScheme: const ColorScheme.dark(
          primary: LwColors.darkPrimary,
          onPrimary: LwColors.darkOnPrimary,
          primaryContainer: LwColors.olive800,
          onPrimaryContainer: LwColors.olive100,
          secondary: LwColors.olive300,
          onSecondary: LwColors.olive900,
          surface: LwColors.darkSurface,
          onSurface: LwColors.darkOnSurface,
          onSurfaceVariant: LwColors.darkOnSurfaceVariant,
          surfaceContainerHighest: LwColors.darkSurfaceVariant,
          outline: LwColors.darkOutline,
          error: LwColors.danger,
          onError: LwColors.onDanger,
        ),
        onSurface: LwColors.darkOnSurface,
        onSurfaceVariant: LwColors.darkOnSurfaceVariant,
        dividerColor: LwColors.darkDivider,
      );

  static ThemeData _build({
    required Brightness brightness,
    required ColorScheme colorScheme,
    required Color onSurface,
    required Color onSurfaceVariant,
    required Color dividerColor,
  }) {
    final TextTheme textTheme = LwTypography.textTheme(onSurface, onSurfaceVariant);
    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: colorScheme.surface,
      textTheme: textTheme,
      splashFactory: InkSparkle.splashFactory,
      dividerTheme: DividerThemeData(color: dividerColor, thickness: 1, space: 1),
      cardTheme: CardThemeData(
        elevation: 0,
        color: colorScheme.surfaceContainerHighest,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(LwRadii.md),
          side: BorderSide(color: dividerColor),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(LwSpacing.minTouchTarget),
          textStyle: textTheme.labelLarge,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(LwRadii.sm),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(LwSpacing.minTouchTarget),
          textStyle: textTheme.labelLarge,
          foregroundColor: colorScheme.primary,
          side: BorderSide(color: colorScheme.primary),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(LwRadii.sm),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size.fromHeight(LwSpacing.minTouchTarget),
          textStyle: textTheme.labelLarge,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colorScheme.surfaceContainerHighest,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: LwSpacing.md,
          vertical: LwSpacing.sm,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(LwRadii.sm),
          borderSide: BorderSide(color: dividerColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(LwRadii.sm),
          borderSide: BorderSide(color: dividerColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(LwRadii.sm),
          borderSide: BorderSide(color: colorScheme.primary, width: 2),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: onSurface,
        contentTextStyle: textTheme.bodyMedium?.copyWith(
          color: colorScheme.surface,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(LwRadii.sm),
        ),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.macOS: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
        },
      ),
      visualDensity: VisualDensity.adaptivePlatformDensity,
    );
  }

  /// Shadow for a given elevation level (0–3).
  static List<BoxShadow> elevation(int level) => switch (level) {
        1 => LwElevation.low,
        2 => LwElevation.medium,
        3 => LwElevation.high,
        _ => LwElevation.none,
      };

  /// Standard motion duration for a transition kind.
  static Duration duration({required String kind}) => switch (kind) {
        'fast' => LwMotion.fast,
        'slow' => LwMotion.slow,
        _ => LwMotion.base,
      };
}
