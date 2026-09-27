import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:localwala_design_system/localwala_design_system.dart';

void main() {
  group('spacing tokens', () {
    test('uses a 4px base grid (xxs is a 2px half-step)', () {
      const List<double> scale = <double>[
        LwSpacing.xs,
        LwSpacing.sm,
        LwSpacing.md,
        LwSpacing.lg,
        LwSpacing.xl,
        LwSpacing.xxl,
        LwSpacing.xxxl,
      ];
      for (final double value in scale) {
        expect(value % 4, 0, reason: '$value should sit on the 4px grid');
      }
      expect(LwSpacing.xxs % 2, 0);
    });

    test('keeps the scale strictly increasing', () {
      expect(LwSpacing.xxs, lessThan(LwSpacing.xs));
      expect(LwSpacing.xs, lessThan(LwSpacing.sm));
      expect(LwSpacing.sm, lessThan(LwSpacing.md));
      expect(LwSpacing.md, lessThan(LwSpacing.lg));
      expect(LwSpacing.lg, lessThan(LwSpacing.xl));
      expect(LwSpacing.xl, lessThan(LwSpacing.xxl));
    });

    test('enforces the 48dp touch target', () {
      expect(LwSpacing.minTouchTarget, 48);
    });
  });

  group('typography scale', () {
    test('is strictly decreasing from display to small labels', () {
      expect(
        LwTypography.displaySize,
        greaterThan(LwTypography.headlineLargeSize),
      );
      expect(
        LwTypography.headlineLargeSize,
        greaterThan(LwTypography.headlineMediumSize),
      );
      expect(
        LwTypography.headlineMediumSize,
        greaterThan(LwTypography.titleLargeSize),
      );
      expect(LwTypography.titleLargeSize, greaterThan(LwTypography.titleMediumSize));
      expect(
        LwTypography.titleMediumSize,
        greaterThanOrEqualTo(LwTypography.bodyLargeSize),
      );
      expect(LwTypography.bodyLargeSize, greaterThan(LwTypography.bodyMediumSize));
      expect(LwTypography.bodyMediumSize, greaterThan(LwTypography.bodySmallSize));
      expect(LwTypography.bodySmallSize, greaterThan(LwTypography.labelSmallSize));
    });

    test('gives every style a line height at least its font size', () {
      final TextTheme theme = LwTypography.textTheme(
        LwColors.onSurface,
        LwColors.onSurfaceVariant,
      );
      final List<TextStyle?> styles = <TextStyle?>[
        theme.displayLarge,
        theme.headlineLarge,
        theme.headlineMedium,
        theme.titleLarge,
        theme.titleMedium,
        theme.titleSmall,
        theme.bodyLarge,
        theme.bodyMedium,
        theme.bodySmall,
        theme.labelLarge,
        theme.labelMedium,
        theme.labelSmall,
      ];
      for (final TextStyle? style in styles) {
        expect(style, isNotNull);
        expect(style!.height! * style.fontSize!, greaterThanOrEqualTo(style.fontSize!));
      }
    });
  });

  group('motion and radii', () {
    test('orders durations fast < base < slow', () {
      expect(LwMotion.fast, lessThan(LwMotion.base));
      expect(LwMotion.base, lessThan(LwMotion.slow));
    });

    test('orders radii xs < sm < md < lg < xl < pill', () {
      expect(LwRadii.xs, lessThan(LwRadii.sm));
      expect(LwRadii.sm, lessThan(LwRadii.md));
      expect(LwRadii.md, lessThan(LwRadii.lg));
      expect(LwRadii.lg, lessThan(LwRadii.xl));
      expect(LwRadii.xl, lessThan(LwRadii.pill));
    });
  });

  group('breakpoints', () {
    test('classifies phone/tablet widths', () {
      expect(LwBreakpoints.isMedium(599), isFalse);
      expect(LwBreakpoints.isMedium(600), isTrue);
      expect(LwBreakpoints.isExpanded(839), isFalse);
      expect(LwBreakpoints.isExpanded(840), isTrue);
    });
  });

  group('elevation', () {
    test('increases blur across levels', () {
      expect(
        LwElevation.low.first.blurRadius,
        lessThan(LwElevation.medium.first.blurRadius),
      );
      expect(
        LwElevation.medium.first.blurRadius,
        lessThan(LwElevation.high.first.blurRadius),
      );
      expect(LwElevation.none, isEmpty);
    });
  });
}
