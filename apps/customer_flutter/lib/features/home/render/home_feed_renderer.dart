import 'package:flutter/material.dart';

import '../config/home_feed_config.dart';
import '../widgets/home_section_widgets.dart';

/// Component names published by the admin Home builder (spec §33) that this
/// app renders natively (spec §11: no arbitrary code execution through
/// remote configuration).
abstract final class HomeComponents {
  static const String banner = 'banner';
  static const String lottieHeader = 'lottie_header';
}

class SectionBuildContext {
  const SectionBuildContext({
    required this.section,
    required this.config,
    this.onNavigate,
  });

  final RemoteHomeSection section;
  final HomeFeedConfig config;
  final void Function(String target)? onNavigate;
}

typedef SectionBuilder = Widget Function(SectionBuildContext context);

/// Allowlisted component registry: server-provided `component` strings are
/// only ever *looked up* in this map — never evaluated or instantiated
/// dynamically. Unknown names render nothing.
class SectionRegistry {
  SectionRegistry(Map<String, SectionBuilder> builders)
    : _builders = Map<String, SectionBuilder>.unmodifiable(builders);

  /// The app's shipped component set.
  factory SectionRegistry.standard() {
    return SectionRegistry(<String, SectionBuilder>{
      HomeComponents.banner: (SectionBuildContext context) {
        final BannerConfig? banner = context.config.banner;
        if (banner == null) {
          return const SizedBox.shrink();
        }
        return BannerSection(banner: banner, onNavigate: context.onNavigate);
      },
      HomeComponents.lottieHeader: (SectionBuildContext context) {
        final LottieConfig? lottie = context.config.lottie;
        if (lottie == null) {
          return const SizedBox.shrink();
        }
        return LottieHeader(lottie: lottie);
      },
    });
  }

  final Map<String, SectionBuilder> _builders;

  bool supports(String component) => _builders.containsKey(component);

  Widget build(SectionBuildContext context) {
    final SectionBuilder? builder = _builders[context.section.component];
    if (builder == null) {
      return const SizedBox.shrink();
    }
    return builder(context);
  }
}

/// Renders the resolved home feed as native widgets: visible sections in
/// published order, only allowlisted components, with per-section error
/// isolation so one bad section never takes down the feed (spec §11, §32).
class HomeFeedRenderer extends StatelessWidget {
  HomeFeedRenderer({
    super.key,
    required this.config,
    SectionRegistry? registry,
    this.onNavigate,
    this.onSectionError,
  }) : registry = registry ?? SectionRegistry.standard();

  final HomeFeedConfig config;
  final SectionRegistry registry;
  final void Function(String target)? onNavigate;
  final void Function(Object error, RemoteHomeSection section)? onSectionError;

  @override
  Widget build(BuildContext context) {
    final List<Widget> children = <Widget>[];
    for (final RemoteHomeSection section in config.visibleSections) {
      if (!registry.supports(section.component)) {
        // Unknown component: skipped entirely — never executed.
        continue;
      }
      try {
        children.add(
          registry.build(
            SectionBuildContext(
              section: section,
              config: config,
              onNavigate: onNavigate,
            ),
          ),
        );
      } catch (error) {
        onSectionError?.call(error, section);
        children.add(const SizedBox.shrink());
      }
    }
    if (children.isEmpty) {
      return const SizedBox.shrink();
    }
    return ListView(children: children);
  }
}
