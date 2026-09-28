import '../../../core/networking/api_client.dart';
import 'home_feed_config.dart';

/// Config keys published by the admin Home builder (spec §33) and resolved
/// through config-service `GET /config/configs/resolve`.
abstract interface class HomeConfigRepository {
  Future<HomeFeedConfig> fetchFeed({
    String? cityId,
    String? zoneId,
    String? localityId,
    String? segment,
    String environment = 'production',
  });
}

/// Remote-config repository: resolves the three home keys and assembles a
/// [HomeFeedConfig]. A key that has never been published (404) simply
/// contributes nothing; other API failures surface to the caller so the UI
/// can show its error state (spec §32).
class ApiHomeConfigRepository implements HomeConfigRepository {
  ApiHomeConfigRepository(this._api);

  final ApiClient _api;

  static const String resolvePath = '/config/configs/resolve';
  static const String sectionsKey = 'home.sections';
  static const String bannerKey = 'home.banner';
  static const String lottieKey = 'home.lottie';

  @override
  Future<HomeFeedConfig> fetchFeed({
    String? cityId,
    String? zoneId,
    String? localityId,
    String? segment,
    String environment = 'production',
  }) async {
    final Map<String, dynamic> context = <String, dynamic>{
      'environment': environment,
    };
    if (cityId != null) {
      context['cityId'] = cityId;
    }
    if (zoneId != null) {
      context['zoneId'] = zoneId;
    }
    if (localityId != null) {
      context['localityId'] = localityId;
    }
    if (segment != null) {
      context['segment'] = segment;
    }
    final List<Future<Map<String, dynamic>?>> futures =
        <Future<Map<String, dynamic>?>>[
          _resolve(sectionsKey, context),
          _resolve(bannerKey, context),
          _resolve(lottieKey, context),
        ];
    final List<Map<String, dynamic>?> records = await Future.wait(futures);
    final Map<String, dynamic>? sectionsRecord = records[0];
    final Map<String, dynamic>? bannerRecord = records[1];
    final Map<String, dynamic>? lottieRecord = records[2];
    return HomeFeedConfig(
      sections: sectionsRecord == null
          ? const <RemoteHomeSection>[]
          : HomeSectionsConfig.tryParse(sectionsRecord['payload'])?.sections ??
                const <RemoteHomeSection>[],
      banner: bannerRecord == null
          ? null
          : BannerConfig.tryParse(bannerRecord['payload']),
      lottie: lottieRecord == null
          ? null
          : LottieConfig.tryParse(lottieRecord['payload']),
    );
  }

  /// Resolves one config record; nothing published yet (404) → `null`.
  Future<Map<String, dynamic>?> _resolve(
    String key,
    Map<String, dynamic> context,
  ) async {
    try {
      final dynamic result = await _api.get(
        resolvePath,
        query: <String, dynamic>{...context, 'key': key},
      );
      if (result is! Map<String, dynamic>) {
        return null;
      }
      return result;
    } on ApiException catch (error) {
      if (error.code == 'NOT_FOUND') {
        return null;
      }
      rethrow;
    }
  }
}
