import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:localwala_design_system/localwala_design_system.dart';

/// WCAG 2.1 relative luminance + contrast ratio (spec §32: accessible contrast).
double _luminance(Color color) {
  double channel(double c) =>
      c <= 0.04045 ? c / 12.92 : math.pow((c + 0.055) / 1.055, 2.4).toDouble();

  return 0.2126 * channel(color.r) +
      0.7152 * channel(color.g) +
      0.0722 * channel(color.b);
}

double contrastRatio(Color foreground, Color background) {
  final double l1 = _luminance(foreground);
  final double l2 = _luminance(background);
  final double lighter = l1 > l2 ? l1 : l2;
  final double darker = l1 > l2 ? l2 : l1;
  return (lighter + 0.05) / (darker + 0.05);
}

void main() {
  final Map<String, List<Color>> pairs = <String, List<Color>>{
    'primary on white': <Color>[LwColors.onPrimary, LwColors.primary],
    'danger on white': <Color>[LwColors.onDanger, LwColors.danger],
    'warning on white': <Color>[LwColors.onWarning, LwColors.warning],
    'success on white': <Color>[LwColors.onSuccess, LwColors.success],
    'info on white': <Color>[LwColors.onInfo, LwColors.info],
    'onSurface on surface': <Color>[LwColors.onSurface, LwColors.surface],
    'onSurfaceVariant on surface': <Color>[
      LwColors.onSurfaceVariant,
      LwColors.surface,
    ],
    'onSurface on surfaceVariant': <Color>[
      LwColors.onSurface,
      LwColors.surfaceVariant,
    ],
    'onPrimaryContainer on primaryContainer': <Color>[
      LwColors.onPrimaryContainer,
      LwColors.primaryContainer,
    ],
    'dark primary on dark surface': <Color>[
      LwColors.darkOnPrimary,
      LwColors.darkPrimary,
    ],
    'dark onSurface on dark surface': <Color>[
      LwColors.darkOnSurface,
      LwColors.darkSurface,
    ],
    'dark onSurfaceVariant on dark surface': <Color>[
      LwColors.darkOnSurfaceVariant,
      LwColors.darkSurface,
    ],
    'dark onSurface on dark surfaceVariant': <Color>[
      LwColors.darkOnSurface,
      LwColors.darkSurfaceVariant,
    ],
  };

  test('documented foreground/background pairs meet WCAG AA (4.5:1)', () {
    pairs.forEach((String name, List<Color> pair) {
      final double ratio = contrastRatio(pair[0], pair[1]);
      expect(
        ratio,
        greaterThanOrEqualTo(4.5),
        reason: '$name contrast is ${ratio.toStringAsFixed(2)}:1',
      );
    });
  });

  test('light theme maps olive primary into the color scheme', () {
    final ThemeData theme = LwTheme.light();
    expect(theme.brightness, Brightness.light);
    expect(theme.colorScheme.primary, LwColors.primary);
    expect(theme.colorScheme.onPrimary, LwColors.onPrimary);
    expect(theme.colorScheme.error, LwColors.danger);
    expect(theme.textTheme.bodyMedium?.fontSize, LwTypography.bodyMediumSize);
  });

  test('dark theme uses the dark olive primary and dark surfaces', () {
    final ThemeData theme = LwTheme.dark();
    expect(theme.brightness, Brightness.dark);
    expect(theme.colorScheme.primary, LwColors.darkPrimary);
    expect(theme.colorScheme.surface, LwColors.darkSurface);
    expect(theme.colorScheme.onSurface, LwColors.darkOnSurface);
  });

  test('component themes meet the touch-target minimum', () {
    for (final ThemeData theme in <ThemeData>[LwTheme.light(), LwTheme.dark()]) {
      expect(
        theme.filledButtonTheme.style?.minimumSize?.resolve(<WidgetState>{}),
        const Size.fromHeight(LwSpacing.minTouchTarget),
      );
      expect(
        theme.outlinedButtonTheme.style?.minimumSize?.resolve(<WidgetState>{}),
        const Size.fromHeight(LwSpacing.minTouchTarget),
      );
    }
  });

  test('elevation helper maps levels to shadow rules', () {
    expect(LwTheme.elevation(0), isEmpty);
    expect(LwTheme.elevation(1), LwElevation.low);
    expect(LwTheme.elevation(2), LwElevation.medium);
    expect(LwTheme.elevation(3), LwElevation.high);
  });

  test('motion helper only returns documented durations', () {
    expect(LwTheme.duration(kind: 'fast'), LwMotion.fast);
    expect(LwTheme.duration(kind: 'slow'), LwMotion.slow);
    expect(LwTheme.duration(kind: 'other'), LwMotion.base);
  });
}
