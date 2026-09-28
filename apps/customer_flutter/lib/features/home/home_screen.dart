import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localwala_design_system/localwala_design_system.dart';

import '../../core/strings/app_strings.dart';
import 'config/home_feed_config.dart';
import 'home_providers.dart';
import 'render/home_feed_renderer.dart';

/// Home tab: remote-config driven feed (OC-0035). Sections are fetched from
/// config-service and rendered with native components only — server
/// configuration selects and orders sections but never executes code
/// (spec §11).
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: Text(AppStrings.homeTitle)),
      body: ref
          .watch(homeFeedProvider)
          .when<Widget>(
            data: (HomeFeedConfig config) {
              if (!config.hasContent) {
                return const LwEmptyState(
                  title: AppStrings.homeTitle,
                  message: AppStrings.homeEmpty,
                );
              }
              return HomeFeedRenderer(
                config: config,
                onNavigate: (String target) => _openTarget(context, target),
              );
            },
            error: (Object error, StackTrace stackTrace) => Center(
              child: LwErrorState(
                title: AppStrings.homeConfigErrorTitle,
                message: AppStrings.homeConfigError,
                retryLabel: AppStrings.retry,
                onRetry: () => ref.invalidate(homeFeedProvider),
              ),
            ),
            loading: () => const Center(child: LwSkeletonLines(lines: 4)),
          ),
    );
  }

  /// Banner/section targets are in-app routes; anything else is ignored
  /// instead of crashing the feed.
  void _openTarget(BuildContext context, String target) {
    if (!target.startsWith('/')) {
      return;
    }
    try {
      context.push(target);
    } on Exception {
      // Unknown deep-link target — ignore.
    }
  }
}
