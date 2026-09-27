/// Single source of shell UI copy (spec §32: localization-ready strings).
///
/// Kept in one place so the app can migrate to `flutter gen-l10n` without
/// hunting literals across the tree.
abstract final class AppStrings {
  static const String appName = 'LocalWala Partner';
  static const String dashboardTab = 'Dashboard';
  static const String ordersTab = 'Orders';
  static const String menuTab = 'Menu';
  static const String profileTab = 'Profile';

  static const String dashboardTitle = 'Dashboard';
  static const String dashboardEmpty =
      'Today\'s revenue, orders and rating will appear here.';
  static const String ordersEmpty = 'Incoming orders will appear here.';
  static const String menuEmpty = 'Your catalog will appear here.';
  static const String profileEmpty = 'Store settings will appear here.';
  static const String earningsEmpty = 'Settlements and payouts will appear here.';
  static const String offersEmpty = 'Offers and promotions will appear here.';
  static const String timingsEmpty = 'Store timings will appear here.';
  static const String staffEmpty = 'Staff roles and permissions will appear here.';
  static const String analyticsEmpty = 'Store analytics will appear here.';
  static const String supportEmpty = 'Help and support will appear here.';
  static const String notificationsEmpty = 'Notifications will appear here.';
  static const String loginTitle = 'Sign in to LocalWala Partner';
  static const String loginEmpty = 'Partner sign-in arrives with the auth feature.';
  static const String retry = 'Retry';
}
