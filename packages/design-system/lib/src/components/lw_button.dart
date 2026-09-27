import 'package:flutter/material.dart';

import '../tokens/lw_colors.dart';
import '../tokens/lw_radii.dart';
import '../tokens/lw_spacing.dart';

/// Button variants (spec §32: touch target minimums, accessible contrast).
enum LwButtonVariant { primary, secondary, ghost, danger }

enum LwButtonSize { compact, regular }

/// The app's primary action control.
///
/// Enforces the 48dp touch-target minimum, supports a loading state that
/// blocks further taps, and never owns user-facing copy — labels are passed
/// in by the calling feature so they stay localization-ready.
class LwButton extends StatelessWidget {
  const LwButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = LwButtonVariant.primary,
    this.size = LwButtonSize.regular,
    this.icon,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final LwButtonVariant variant;
  final LwButtonSize size;
  final IconData? icon;
  final bool loading;

  bool get _enabled => onPressed != null && !loading;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final double height = size == LwButtonSize.compact
        ? LwSpacing.minTouchTarget - 8
        : LwSpacing.minTouchTarget;
    final Color background = switch (variant) {
      LwButtonVariant.primary => theme.colorScheme.primary,
      LwButtonVariant.secondary => theme.colorScheme.primary.withValues(alpha: 0.12),
      LwButtonVariant.ghost => Colors.transparent,
      LwButtonVariant.danger => LwColors.danger,
    };
    final Color foreground = switch (variant) {
      LwButtonVariant.primary => theme.colorScheme.onPrimary,
      LwButtonVariant.secondary || LwButtonVariant.ghost => theme.colorScheme.primary,
      LwButtonVariant.danger => LwColors.onDanger,
    };
    final BorderSide side = variant == LwButtonVariant.secondary
        ? BorderSide(color: theme.colorScheme.primary)
        : BorderSide.none;

    return Semantics(
      button: true,
      enabled: _enabled,
      label: loading ? '$label (loading)' : label,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _enabled ? onPressed : null,
          borderRadius: BorderRadius.circular(LwRadii.sm),
          child: Ink(
            height: height,
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(LwRadii.sm),
              border: Border(left: side, top: side, right: side, bottom: side),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                if (loading)
                  SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: foreground,
                    ),
                  )
                else if (icon != null)
                  Icon(icon, size: 18, color: foreground),
                if (loading || icon != null) const SizedBox(width: LwSpacing.sm),
                Flexible(
                  child: Text(
                    label,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelLarge?.copyWith(color: foreground),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Convenience primary button.
class LwPrimaryButton extends LwButton {
  const LwPrimaryButton({
    super.key,
    required super.label,
    required super.onPressed,
    super.icon,
    super.loading,
  }) : super(variant: LwButtonVariant.primary);
}
