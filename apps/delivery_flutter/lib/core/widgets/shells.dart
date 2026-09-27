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

/// Root scaffold with the delivery bottom navigation — task-first tabs
/// (spec §14): availability/offers, delivery history, earnings, profile.
class DeliveryShell extends StatelessWidget {
  const DeliveryShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const List<({IconData icon, IconData selectedIcon, String label})>
      tabs = <({IconData icon, IconData selectedIcon, String label})>[
    (
      icon: Icons.home_outlined,
      selectedIcon: Icons.home,
      label: AppStrings.homeTab,
    ),
    (
      icon: Icons.local_shipping_outlined,
      selectedIcon: Icons.local_shipping,
      label: AppStrings.deliveriesTab,
    ),
    (
      icon: Icons.account_balance_wallet_outlined,
      selectedIcon: Icons.account_balance_wallet,
      label: AppStrings.earningsTab,
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
