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

/// Root scaffold with the customer bottom navigation (stateful shell so
/// each tab keeps its own navigation stack).
class CustomerShell extends StatelessWidget {
  const CustomerShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const List<({IconData icon, IconData selectedIcon, String label})>
      tabs = <({IconData icon, IconData selectedIcon, String label})>[
    (
      icon: Icons.home_outlined,
      selectedIcon: Icons.home,
      label: AppStrings.homeTab,
    ),
    (
      icon: Icons.restaurant_outlined,
      selectedIcon: Icons.restaurant,
      label: AppStrings.foodTab,
    ),
    (
      icon: Icons.shopping_bag_outlined,
      selectedIcon: Icons.shopping_bag,
      label: AppStrings.cartTab,
    ),
    (
      icon: Icons.receipt_long_outlined,
      selectedIcon: Icons.receipt_long,
      label: AppStrings.ordersTab,
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
