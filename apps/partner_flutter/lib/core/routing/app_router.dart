import 'package:go_router/go_router.dart';

import '../../features/analytics/analytics_screen.dart';
import '../../features/auth/auth_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/earnings/earnings_screen.dart';
import '../../features/menu/menu_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/offers/offers_screen.dart';
import '../../features/orders/orders_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/staff/staff_screen.dart';
import '../../features/support/support_screen.dart';
import '../../features/timings/timings_screen.dart';
import '../widgets/shells.dart';

/// Route table (spec §31: core/routing; §13 partner surfaces).
///
/// Paths are the deep-link contract — add routes here, not via ad-hoc
/// pushes.
GoRouter buildAppRouter({String initialLocation = '/'}) {
  return GoRouter(
    initialLocation: initialLocation,
    routes: <RouteBase>[
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            PartnerShell(navigationShell: navigationShell),
        branches: <StatefulShellBranch>[
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: '/',
                builder: (context, state) => const DashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: '/orders',
                builder: (context, state) => const OrdersScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: '/menu',
                builder: (context, state) => const MenuScreen(),
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
        path: '/earnings',
        builder: (context, state) => const EarningsScreen(),
      ),
      GoRoute(path: '/offers', builder: (context, state) => const OffersScreen()),
      GoRoute(
        path: '/timings',
        builder: (context, state) => const TimingsScreen(),
      ),
      GoRoute(path: '/staff', builder: (context, state) => const StaffScreen()),
      GoRoute(
        path: '/analytics',
        builder: (context, state) => const AnalyticsScreen(),
      ),
      GoRoute(
        path: '/support',
        builder: (context, state) => const SupportScreen(),
      ),
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
      GoRoute(
        path: '/auth/login',
        builder: (context, state) => const AuthScreen(),
      ),
    ],
  );
}
