import 'package:customer_flutter/features/home/config/home_feed_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('RemoteHomeSection', () {
    test('fromJson applies defaults for missing fields', () {
      final RemoteHomeSection section = RemoteHomeSection.fromJson(
        <String, dynamic>{},
      );
      expect(section.id, '');
      expect(section.component, '');
      expect(section.order, 0);
      expect(section.visible, isTrue);
    });

    test('fromJson reads published fields', () {
      final RemoteHomeSection section = RemoteHomeSection.fromJson(
        <String, dynamic>{
          'id': 's1',
          'component': 'banner',
          'order': 3,
          'visible': false,
        },
      );
      expect(section.id, 's1');
      expect(section.component, 'banner');
      expect(section.order, 3);
      expect(section.visible, isFalse);
      expect(section.isUsable, isTrue);
    });

    test('isUsable requires id and component', () {
      expect(
        const RemoteHomeSection(
          id: '',
          component: 'banner',
          order: 0,
          visible: true,
        ).isUsable,
        isFalse,
      );
      expect(
        const RemoteHomeSection(
          id: 's1',
          component: '',
          order: 0,
          visible: true,
        ).isUsable,
        isFalse,
      );
    });
  });

  group('HomeSectionsConfig.tryParse', () {
    test('parses a valid payload', () {
      final HomeSectionsConfig? config = HomeSectionsConfig.tryParse(
        <String, dynamic>{
          'sections': <Object>[
            <String, dynamic>{
              'id': 'a',
              'component': 'banner',
              'order': 1,
              'visible': true,
            },
            <String, dynamic>{
              'id': 'b',
              'component': 'lottie_header',
              'order': 0,
              'visible': false,
            },
          ],
        },
      );
      expect(config, isNotNull);
      expect(config!.sections, hasLength(2));
      expect(config.sections.first.id, 'a');
    });

    test('drops malformed entries and duplicate ids', () {
      final HomeSectionsConfig? config = HomeSectionsConfig.tryParse(
        <String, dynamic>{
          'sections': <Object>[
            <String, dynamic>{
              'id': 'a',
              'component': 'banner',
              'order': 1,
              'visible': true,
            },
            <String, dynamic>{
              'id': 'a',
              'component': 'lottie_header',
              'order': 2,
              'visible': true,
            },
            <String, dynamic>{
              'id': '',
              'component': 'banner',
              'order': 3,
              'visible': true,
            },
            'not-a-map',
            42,
          ],
        },
      );
      expect(config, isNotNull);
      expect(config!.sections.map((RemoteHomeSection s) => s.id), <String>[
        'a',
      ]);
      expect(config.sections.single.component, 'banner');
    });

    test('returns null for malformed payloads', () {
      expect(HomeSectionsConfig.tryParse(null), isNull);
      expect(HomeSectionsConfig.tryParse('nope'), isNull);
      expect(
        HomeSectionsConfig.tryParse(<String, dynamic>{
          'sections': 'not-a-list',
        }),
        isNull,
      );
      expect(HomeSectionsConfig.tryParse(<String, dynamic>{}), isNull);
    });
  });

  group('BannerConfig.tryParse', () {
    test('parses a complete banner', () {
      final BannerConfig? banner = BannerConfig.tryParse(<String, dynamic>{
        'bannerId': 'b1',
        'imageUrl': 'https://cdn.example/banner.jpg',
        'target': '/food',
        'order': 2,
        'visible': true,
      });
      expect(banner, isNotNull);
      expect(banner!.bannerId, 'b1');
      expect(banner.target, '/food');
      expect(banner.order, 2);
    });

    test('rejects payloads missing required fields', () {
      expect(BannerConfig.tryParse(null), isNull);
      expect(BannerConfig.tryParse(<String, dynamic>{}), isNull);
      expect(
        BannerConfig.tryParse(<String, dynamic>{
          'bannerId': 'b1',
          'imageUrl': 'https://cdn.example/b.jpg',
        }),
        isNull,
      );
    });
  });

  group('LottieConfig.tryParse', () {
    test('parses valid animation settings', () {
      final LottieConfig? lottie = LottieConfig.tryParse(<String, dynamic>{
        'url': 'https://cdn.example/header.json',
        'fit': 'cover',
        'speed': 1.5,
        'loop': false,
        'visible': true,
      });
      expect(lottie, isNotNull);
      expect(lottie!.fit, 'cover');
      expect(lottie.speed, 1.5);
      expect(lottie.loop, isFalse);
    });

    test('rejects missing url and out-of-range settings', () {
      expect(LottieConfig.tryParse(<String, dynamic>{}), isNull);
      expect(LottieConfig.tryParse(null), isNull);

      final LottieConfig? lottie = LottieConfig.tryParse(<String, dynamic>{
        'url': 'https://cdn.example/header.json',
        'fit': 'stretch',
        'speed': 99,
      });
      expect(lottie, isNotNull);
      expect(lottie!.fit, isNull);
      expect(lottie.speed, isNull);
    });
  });

  group('HomeFeedConfig', () {
    test('visibleSections filters hidden/unusable and sorts by order', () {
      final HomeFeedConfig config = HomeFeedConfig(
        sections: <RemoteHomeSection>[
          const RemoteHomeSection(
            id: 's2',
            component: 'banner',
            order: 2,
            visible: true,
          ),
          const RemoteHomeSection(
            id: 's1',
            component: 'banner',
            order: 1,
            visible: true,
          ),
          const RemoteHomeSection(
            id: 'hidden',
            component: 'banner',
            order: 0,
            visible: false,
          ),
          const RemoteHomeSection(
            id: 'bad',
            component: '',
            order: 0,
            visible: true,
          ),
        ],
      );
      expect(
        config.visibleSections.map((RemoteHomeSection s) => s.id),
        <String>['s1', 's2'],
      );
    });

    test('equal orders keep the published order (stable sort)', () {
      final HomeFeedConfig config = HomeFeedConfig(
        sections: <RemoteHomeSection>[
          const RemoteHomeSection(
            id: 'first',
            component: 'banner',
            order: 0,
            visible: true,
          ),
          const RemoteHomeSection(
            id: 'second',
            component: 'banner',
            order: 0,
            visible: true,
          ),
          const RemoteHomeSection(
            id: 'third',
            component: 'banner',
            order: 0,
            visible: true,
          ),
        ],
      );
      expect(
        config.visibleSections.map((RemoteHomeSection s) => s.id),
        <String>['first', 'second', 'third'],
      );
    });

    test('hasContent reflects visible sections, banner and lottie', () {
      expect(HomeFeedConfig.empty.hasContent, isFalse);
      expect(
        const HomeFeedConfig(
          banner: BannerConfig(
            bannerId: 'b1',
            imageUrl: 'https://cdn.example/b.jpg',
            target: '/food',
            order: 0,
            visible: false,
          ),
        ).hasContent,
        isFalse,
      );
      expect(
        const HomeFeedConfig(
          sections: <RemoteHomeSection>[
            RemoteHomeSection(
              id: 's1',
              component: 'banner',
              order: 0,
              visible: true,
            ),
          ],
        ).hasContent,
        isTrue,
      );
    });
  });
}
