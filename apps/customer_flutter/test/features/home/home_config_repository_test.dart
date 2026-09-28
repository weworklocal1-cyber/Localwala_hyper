import 'package:customer_flutter/core/networking/api_client.dart';
import 'package:customer_flutter/features/home/config/home_config_repository.dart';
import 'package:customer_flutter/features/home/config/home_feed_config.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeApiClient implements ApiClient {
  _FakeApiClient({
    Map<String, dynamic>? responses,
    Map<String, ApiException>? errors,
  }) : _responses = responses ?? <String, dynamic>{},
       _errors = errors ?? <String, ApiException>{};

  final Map<String, dynamic> _responses;
  final Map<String, ApiException> _errors;
  final List<({String path, Map<String, dynamic>? query})> calls =
      <({String path, Map<String, dynamic>? query})>[];

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    calls.add((path: path, query: query));
    final String key = (query?['key'] as String?) ?? '';
    final ApiException? error = _errors[key];
    if (error != null) {
      throw error;
    }
    return _responses[key];
  }

  @override
  Future<dynamic> post(String path, {Object? body}) async =>
      throw UnimplementedError();

  @override
  Future<dynamic> put(String path, {Object? body}) async =>
      throw UnimplementedError();

  @override
  Future<dynamic> delete(String path) async => throw UnimplementedError();
}

dynamic _record(String type, Map<String, dynamic> payload) => <String, dynamic>{
  'type': type,
  'payload': payload,
};

void main() {
  group('ApiHomeConfigRepository.fetchFeed', () {
    test('resolves the three home keys and assembles the feed', () async {
      final _FakeApiClient api = _FakeApiClient(
        responses: <String, dynamic>{
          ApiHomeConfigRepository.sectionsKey: _record(
            'home_sections',
            <String, dynamic>{
              'sections': <Object>[
                <String, dynamic>{
                  'id': 'b',
                  'component': 'banner',
                  'order': 1,
                  'visible': true,
                },
                <String, dynamic>{
                  'id': 'h',
                  'component': 'lottie_header',
                  'order': 0,
                  'visible': true,
                },
              ],
            },
          ),
          ApiHomeConfigRepository.bannerKey:
              _record('banner', <String, dynamic>{
                'bannerId': 'b1',
                'imageUrl': 'https://cdn.example/b.jpg',
                'target': '/food',
                'order': 0,
                'visible': true,
              }),
          ApiHomeConfigRepository.lottieKey: _record(
            'lottie',
            <String, dynamic>{
              'url': 'https://cdn.example/header.json',
              'visible': true,
            },
          ),
        },
      );

      final HomeFeedConfig feed = await ApiHomeConfigRepository(
        api,
      ).fetchFeed(cityId: 'city_1', environment: 'staging');

      expect(feed.sections, hasLength(2));
      expect(feed.banner?.bannerId, 'b1');
      expect(feed.lottie?.url, 'https://cdn.example/header.json');
      expect(feed.hasContent, isTrue);

      expect(api.calls, hasLength(3));
      for (final ({String path, Map<String, dynamic>? query}) call
          in api.calls) {
        expect(call.path, '/config/configs/resolve');
        expect(call.query?['environment'], 'staging');
        expect(call.query?['cityId'], 'city_1');
      }
      expect(api.calls.map((c) => c.query?['key']).toSet(), <String>{
        ApiHomeConfigRepository.sectionsKey,
        ApiHomeConfigRepository.bannerKey,
        ApiHomeConfigRepository.lottieKey,
      });
    });

    test('a key that is not published yet contributes nothing', () async {
      final _FakeApiClient api = _FakeApiClient(
        responses: <String, dynamic>{
          ApiHomeConfigRepository.sectionsKey: _record(
            'home_sections',
            <String, dynamic>{
              'sections': <Object>[
                <String, dynamic>{
                  'id': 'b',
                  'component': 'banner',
                  'order': 0,
                  'visible': true,
                },
              ],
            },
          ),
        },
        errors: <String, ApiException>{
          ApiHomeConfigRepository.bannerKey: const ApiException(
            code: 'NOT_FOUND',
            message: 'No published config for key "home.banner"',
            statusCode: 404,
          ),
          ApiHomeConfigRepository.lottieKey: const ApiException(
            code: 'NOT_FOUND',
            message: 'No published config for key "home.lottie"',
            statusCode: 404,
          ),
        },
      );

      final HomeFeedConfig feed = await ApiHomeConfigRepository(
        api,
      ).fetchFeed();

      expect(feed.sections, hasLength(1));
      expect(feed.banner, isNull);
      expect(feed.lottie, isNull);
    });

    test('rethrows API failures other than NOT_FOUND', () async {
      final _FakeApiClient api = _FakeApiClient(
        errors: <String, ApiException>{
          ApiHomeConfigRepository.sectionsKey: const ApiException(
            code: 'SERVICE_UNAVAILABLE',
            message: 'config-service not configured',
            statusCode: 503,
          ),
        },
      );

      expect(
        () => ApiHomeConfigRepository(api).fetchFeed(),
        throwsA(
          isA<ApiException>().having(
            (ApiException e) => e.code,
            'code',
            'SERVICE_UNAVAILABLE',
          ),
        ),
      );
    });

    test('malformed payloads degrade to an empty feed, not a crash', () async {
      final _FakeApiClient api = _FakeApiClient(
        responses: <String, dynamic>{
          ApiHomeConfigRepository.sectionsKey: _record(
            'home_sections',
            <String, dynamic>{'sections': 'corrupt'},
          ),
          ApiHomeConfigRepository.bannerKey: 'not-a-record',
          ApiHomeConfigRepository.lottieKey: _record(
            'lottie',
            <String, dynamic>{},
          ),
        },
      );

      final HomeFeedConfig feed = await ApiHomeConfigRepository(
        api,
      ).fetchFeed();

      expect(feed.sections, isEmpty);
      expect(feed.banner, isNull);
      expect(feed.lottie, isNull);
      expect(feed.hasContent, isFalse);
    });

    test('non-record responses are treated as missing', () async {
      final _FakeApiClient api = _FakeApiClient(
        responses: <String, dynamic>{
          ApiHomeConfigRepository.sectionsKey: 42,
          ApiHomeConfigRepository.bannerKey: null,
          ApiHomeConfigRepository.lottieKey: null,
        },
      );

      final HomeFeedConfig feed = await ApiHomeConfigRepository(
        api,
      ).fetchFeed();

      expect(feed.sections, isEmpty);
      expect(feed.banner, isNull);
      expect(feed.lottie, isNull);
    });
  });
}
