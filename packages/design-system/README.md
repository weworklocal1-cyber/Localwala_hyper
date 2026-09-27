# LocalWala Design System (`localwala_design_system`)

Shared Flutter package implementing spec §31 (`core/design_system`) and §32
(Design System & UX Quality Gates) for the customer, partner, delivery and
executive apps.

## What's inside

| Area          | Files                         | Notes                                                                                       |
| ------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| Design tokens | `lib/src/tokens/*`            | olive brand ramp, type scale, 4px spacing, radii, elevation, motion, breakpoints            |
| Theme         | `lib/src/theme/lw_theme.dart` | `LwTheme.light()` / `LwTheme.dark()` Material 3 themes                                      |
| Components    | `lib/src/components/*`        | `LwButton`, `LwSkeleton(Lines)`, `LwEmptyState`, `LwErrorState`, `LwOfflineBanner`, `LwGap` |

Import the barrel only:

```dart
import 'package:localwala_design_system/localwala_design_system.dart';
```

## Decisions (spec §32 gates)

- **Olive-green brand**: primary is `LwColors.olive700` (`#4A5D23`) with white
  text — 7.3:1 contrast (WCAG AAA). The full 50–900 ramp lives in `LwColors`.
- **Accessible contrast**: every documented fg/bg pair is asserted ≥ 4.5:1 by
  `test/contrast_test.dart`. Components never hardcode raw hex; they pull from
  tokens or `ColorScheme`.
- **Touch targets**: all buttons are ≥ 48dp (`LwSpacing.minTouchTarget`), even
  the compact size (40dp) is reserved for dense toolbars and documented as such.
  Widget tests assert the minimum.
- **Localization-ready**: the library contains **no user-facing copy**. Every
  text is a parameter (`label`, `title`, `message`, …) so apps own strings via
  `flutter gen-l10n`.
- **Dark mode decision**: both themes ship and are tested; the initial app
  shells default to **light** until a full dark-mode contrast audit is signed
  off. Apps enable `LwTheme.dark()` per system brightness later — no token
  changes required.
- **Responsive**: `LwBreakpoints` (600 / 840dp) for the tablet layouts required
  for partner/delivery/kitchen surfaces.
- **Skeletons**: pulse-style (no gradient shimmer) to stay cheap on low-end
  devices; decorative semantics so screen readers skip them.
- **Motion**: only `LwMotion` durations (150/250/400ms) may be used by feature
  code.

## Commands

```bash
flutter pub get
flutter analyze
flutter test
```

Run from `packages/design-system`. Root alias: `npm run test:flutter`.
