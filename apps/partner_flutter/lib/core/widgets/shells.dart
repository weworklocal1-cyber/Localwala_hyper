import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:localwala_design_system/localwala_design_system.dart';

import '../strings/app_strings.dart';

/// Shared scaffold for shell placeholder features until their screens land.
class FeaturePlaceholderScreen extends StatelessWidget {
  const FeaturePlaceholderScreen({
    super.key,
    required this.title,
    required this.emptyMessage,
  });

  final String title;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: LwEmptyState(title: title, message: emptyMessage),
    );
  }
}

/// Root scaffold with the partner bottom navigation — operations-first
/// tabs (spec §13): dashboard, order queue, menu, profile.
class PartnerShell extends StatelessWidget {
  const PartnerShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const List<({IconData icon, IconData selectedIcon, String label})>
      tabs = <({IconData icon, IconData selectedIcon, String label})>[
    (
      icon: Icons.dashboard_outlined,
      selectedIcon: Icons.dashboard,
      label: AppStrings.dashboardTab,
    ),
    (
      icon: Icons.receipt_long_outlined,
      selectedIcon: Icons.receipt_long,
      label: AppStrings.ordersTab,
    ),
    (
      icon: Icons.menu_book_outlined,
      selectedIcon: Icons.menu_book,
      label: AppStrings.menuTab,
    ),
    (
      icon: Icons.person_outline,
      selectedIcon: Icons.person,
      label: AppStrings.profileTab,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (int index) =>
            navigationShell.goBranch(index, initialLocation: index == 0),
        destinations: <NavigationDestination>[
          for (final ({IconData icon, IconData selectedIcon, String label}) tab
              in tabs)
            NavigationDestination(
              icon: Icon(tab.icon),
              selectedIcon: Icon(tab.selectedIcon),
              label: tab.label,
            ),
        ],
      ),
    );
  }
}
