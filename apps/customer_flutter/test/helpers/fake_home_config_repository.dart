import 'dart:async';

import 'package:customer_flutter/features/home/config/home_config_repository.dart';
import 'package:customer_flutter/features/home/config/home_feed_config.dart';

/// In-memory [HomeConfigRepository] for widget tests: deterministic, no
/// network, no platform channels (spec §31 repository abstraction).
class FakeHomeConfigRepository implements HomeConfigRepository {
  FakeHomeConfigRepository({this.response, this.error, this.pending = false});

  HomeFeedConfig? response;
  Object? error;
  final bool pending;
  final Completer<HomeFeedConfig> completer = Completer<HomeFeedConfig>();
  int calls = 0;

  void succeedWith(HomeFeedConfig config) {
    response = config;
    error = null;
  }

  @override
  Future<HomeFeedConfig> fetchFeed({
    String? cityId,
    String? zoneId,
    String? localityId,
    String? segment,
    String environment = 'production',
  }) {
    calls += 1;
    if (pending) {
      return completer.future;
    }
    final Object? failure = error;
    if (failure != null) {
      return Future<HomeFeedConfig>.error(failure);
    }
    return Future<HomeFeedConfig>.value(response ?? HomeFeedConfig.empty);
  }
}
