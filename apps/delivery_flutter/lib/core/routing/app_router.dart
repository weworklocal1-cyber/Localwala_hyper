import 'package:go_router/go_router.dart';

import '../../features/auth/auth_screen.dart';
import '../../features/deliveries/deliveries_screen.dart';
import '../../features/documents/documents_screen.dart';
import '../../features/earnings/earnings_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/support/support_screen.dart';
import '../widgets/shells.dart';

/// Route table (spec §31: core/routing; §14 delivery surfaces).
///
/// Paths are the deep-link contract — add routes here, not via ad-hoc
/// pushes.
GoRouter buildAppRouter({String initialLocation = '/'}) {
  return GoRouter(
    initialLocation: initialLocation,
    routes: <RouteBase>[
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            DeliveryShell(navigationShell: navigationShell),
        branches: <StatefulShellBranch>[
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: '/',
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: '/deliveries',
                builder: (context, state) => const DeliveriesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: '/earnings',
                builder: (context, state) => const EarningsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: '/profile',
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/documents',
        builder: (context, state) => const DocumentsScreen(),
      ),
      GoRoute(
        path: '/support',
        builder: (context, state) => const SupportScreen(),
      ),
      GoRoute(
        path: '/auth/login',
        builder: (context, state) => const AuthScreen(),
      ),
    ],
  );
}
