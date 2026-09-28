/// Typed, data-only views over resolved remote-config payloads
/// (config-service `/configs/resolve`; spec §11 remote config, §33 home
/// builder).
///
/// Parsing accepts strings, numbers and booleans only — payloads are never
/// evaluated as code (spec §11: no arbitrary code execution through remote
/// configuration).
library;

class RemoteHomeSection {
  const RemoteHomeSection({
    required this.id,
    required this.component,
    required this.order,
    required this.visible,
  });

  factory RemoteHomeSection.fromJson(Map<String, dynamic> json) {
    return RemoteHomeSection(
      id: json['id'] as String? ?? '',
      component: json['component'] as String? ?? '',
      order: (json['order'] as num?)?.toInt() ?? 0,
      visible: json['visible'] as bool? ?? true,
    );
  }

  final String id;
  final String component;
  final int order;
  final bool visible;

  /// Sections need both an id and a component name to be renderable.
  bool get isUsable => id.isNotEmpty && component.isNotEmpty;
}

class HomeSectionsConfig {
  const HomeSectionsConfig(this.sections);

  final List<RemoteHomeSection> sections;

  /// Parses a `home_sections` payload; malformed payloads degrade to `null`
  /// (the caller renders an empty state instead of crashing).
  static HomeSectionsConfig? tryParse(Object? payload) {
    if (payload is! Map<String, dynamic>) {
      return null;
    }
    final Object? raw = payload['sections'];
    if (raw is! List) {
      return null;
    }
    final List<RemoteHomeSection> sections = <RemoteHomeSection>[];
    final Set<String> seen = <String>{};
    for (final Object? entry in raw) {
      if (entry is! Map<String, dynamic>) {
        continue;
      }
      final RemoteHomeSection section = RemoteHomeSection.fromJson(entry);
      if (!section.isUsable || !seen.add(section.id)) {
        continue;
      }
      sections.add(section);
    }
    return HomeSectionsConfig(sections);
  }
}

class BannerConfig {
  const BannerConfig({
    required this.bannerId,
    required this.imageUrl,
    required this.target,
    required this.order,
    required this.visible,
  });

  factory BannerConfig.fromJson(Map<String, dynamic> json) {
    return BannerConfig(
      bannerId: json['bannerId'] as String? ?? '',
      imageUrl: json['imageUrl'] as String? ?? '',
      target: json['target'] as String? ?? '',
      order: (json['order'] as num?)?.toInt() ?? 0,
      visible: json['visible'] as bool? ?? true,
    );
  }

  final String bannerId;
  final String imageUrl;
  final String target;
  final int order;
  final bool visible;

  static BannerConfig? tryParse(Object? payload) {
    if (payload is! Map<String, dynamic>) {
      return null;
    }
    final BannerConfig config = BannerConfig.fromJson(payload);
    if (config.bannerId.isEmpty ||
        config.imageUrl.isEmpty ||
        config.target.isEmpty) {
      return null;
    }
    return config;
  }
}

class LottieConfig {
  const LottieConfig({
    required this.url,
    this.fit,
    this.speed,
    this.loop,
    required this.visible,
  });

  factory LottieConfig.fromJson(Map<String, dynamic> json) {
    final Object? rawFit = json['fit'];
    final Object? rawSpeed = json['speed'];
    return LottieConfig(
      url: json['url'] as String? ?? '',
      fit:
          rawFit is String &&
              const <String>{'contain', 'cover', 'fill'}.contains(rawFit)
          ? rawFit
          : null,
      speed: rawSpeed is num && rawSpeed >= 0.1 && rawSpeed <= 4.0
          ? rawSpeed.toDouble()
          : null,
      loop: json['loop'] as bool?,
      visible: json['visible'] as bool? ?? true,
    );
  }

  final String url;
  final String? fit;
  final double? speed;
  final bool? loop;
  final bool visible;

  static LottieConfig? tryParse(Object? payload) {
    if (payload is! Map<String, dynamic>) {
      return null;
    }
    final LottieConfig config = LottieConfig.fromJson(payload);
    if (config.url.isEmpty) {
      return null;
    }
    return config;
  }
}

/// The assembled home feed: ordered sections plus optional banner and
/// Lottie header configuration.
class HomeFeedConfig {
  const HomeFeedConfig({
    this.sections = const <RemoteHomeSection>[],
    this.banner,
    this.lottie,
  });

  static const HomeFeedConfig empty = HomeFeedConfig();

  final List<RemoteHomeSection> sections;
  final BannerConfig? banner;
  final LottieConfig? lottie;

  /// Usable, visible sections in `order` (ties keep the published order —
  /// Dart's `List.sort` is not stable, so the index breaks ties).
  List<RemoteHomeSection> get visibleSections {
    final List<({RemoteHomeSection section, int index})> decorated =
        <({RemoteHomeSection section, int index})>[
          for (int index = 0; index < sections.length; index++)
            (section: sections[index], index: index),
        ]..sort((
          ({RemoteHomeSection section, int index}) a,
          ({RemoteHomeSection section, int index}) b,
        ) {
          final int byOrder = a.section.order.compareTo(b.section.order);
          return byOrder != 0 ? byOrder : a.index.compareTo(b.index);
        });
    return <RemoteHomeSection>[
      for (final ({RemoteHomeSection section, int index}) entry in decorated)
        if (entry.section.visible && entry.section.isUsable) entry.section,
    ];
  }

  bool get hasContent =>
      visibleSections.isNotEmpty ||
      (banner?.visible ?? false) ||
      (lottie?.visible ?? false);
}
