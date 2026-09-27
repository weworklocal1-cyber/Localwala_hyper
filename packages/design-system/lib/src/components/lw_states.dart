import 'package:flutter/material.dart';

import '../tokens/lw_colors.dart';
import '../tokens/lw_spacing.dart';
import 'lw_button.dart';

/// Empty / error / offline state widgets (spec §32: empty/error/offline
/// states). All copy is supplied by the caller so strings stay
/// localization-ready — the library never owns user-facing text.
class LwEmptyState extends StatelessWidget {
  const LwEmptyState({
    super.key,
    required this.title,
    this.message,
    this.icon = Icons.inbox_outlined,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return _StateLayout(
      icon: icon,
      title: title,
      titleStyle: text.titleMedium,
      message: message,
      messageStyle: text.bodyMedium,
      action: actionLabel != null && onAction != null
          ? LwButton(
              label: actionLabel!,
              onPressed: onAction,
              variant: LwButtonVariant.secondary,
            )
          : null,
    );
  }
}

class LwErrorState extends StatelessWidget {
  const LwErrorState({
    super.key,
    required this.title,
    this.message,
    this.retryLabel,
    this.onRetry,
    this.icon = Icons.error_outline,
  });

  final String title;
  final String? message;
  final String? retryLabel;
  final VoidCallback? onRetry;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return _StateLayout(
      icon: icon,
      iconColor: LwColors.danger,
      title: title,
      titleStyle: text.titleMedium,
      message: message,
      messageStyle: text.bodyMedium,
      action: retryLabel != null && onRetry != null
          ? LwButton(
              label: retryLabel!,
              onPressed: onRetry,
              variant: LwButtonVariant.secondary,
            )
          : null,
    );
  }
}

/// Sticky offline banner shown while connectivity is lost.
class LwOfflineBanner extends StatelessWidget {
  const LwOfflineBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return Semantics(
      container: true,
      liveRegion: true,
      child: Material(
        color: LwColors.warning,
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: LwSpacing.md,
              vertical: LwSpacing.sm,
            ),
            child: Row(
              children: <Widget>[
                const Icon(Icons.wifi_off, size: 18, color: LwColors.onWarning),
                const SizedBox(width: LwSpacing.sm),
                Expanded(
                  child: Text(
                    message,
                    style: text.bodySmall?.copyWith(color: LwColors.onWarning),
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

class _StateLayout extends StatelessWidget {
  const _StateLayout({
    required this.icon,
    required this.title,
    required this.titleStyle,
    this.iconColor,
    this.message,
    this.messageStyle,
    this.action,
  });

  final IconData icon;
  final Color? iconColor;
  final String title;
  final TextStyle? titleStyle;
  final String? message;
  final TextStyle? messageStyle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: LwSpacing.maxContentWidth),
        child: Padding(
          padding: const EdgeInsets.all(LwSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(
                icon,
                size: 48,
                color: iconColor ?? Theme.of(context).colorScheme.outline,
              ),
              const SizedBox(height: LwSpacing.md),
              Text(
                title,
                style: titleStyle,
                textAlign: TextAlign.center,
              ),
              if (message != null) ...<Widget>[
                const SizedBox(height: LwSpacing.sm),
                Text(
                  message!,
                  style: messageStyle,
                  textAlign: TextAlign.center,
                ),
              ],
              if (action != null) ...<Widget>[
                const SizedBox(height: LwSpacing.lg),
                action!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}
