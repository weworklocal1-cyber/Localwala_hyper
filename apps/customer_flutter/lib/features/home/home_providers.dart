import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app.dart';
import 'config/home_config_repository.dart';
import 'config/home_feed_config.dart';

/// Remote-config home feed wiring (OC-0035).
final Provider<HomeConfigRepository> homeConfigRepositoryProvider =
    Provider<HomeConfigRepository>(
      (Ref ref) => ApiHomeConfigRepository(ref.watch(apiClientProvider)),
    );

/// Resolved home feed; invalidated to refetch (e.g. on retry).
///
/// Riverpod's default backoff retry is disabled here on purpose: a failed
/// feed should surface the spec §32 error state with a manual Retry action
/// promptly instead of hiding behind ~30s of silent retries.
final FutureProvider<HomeFeedConfig> homeFeedProvider =
    FutureProvider<HomeFeedConfig>(
      (Ref ref) => ref.watch(homeConfigRepositoryProvider).fetchFeed(),
      retry: (int retryCount, Object error) => null,
    );
