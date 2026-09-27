/// Single source of shell UI copy (spec §32: localization-ready strings).
///
/// Kept in one place so the app can migrate to `flutter gen-l10n` without
/// hunting literals across the tree.
abstract final class AppStrings {
  static const String appName = 'LocalWala';
  static const String homeTab = 'Home';
  static const String foodTab = 'Food';
  static const String cartTab = 'Cart';
  static const String ordersTab = 'Orders';
  static const String profileTab = 'Profile';

  static const String homeTitle = 'LocalWala';
  static const String homeEmpty = 'Stores and offers near you will appear here.';
  static const String foodEmpty = 'Restaurants and dishes will appear here.';
  static const String storeEmpty = 'Local stores will appear here.';
  static const String dairyEmpty = 'Dairy subscriptions will appear here.';
  static const String zatkaEmpty = 'Zatka services will appear here.';
  static const String servicesEmpty = 'Home services will appear here.';
  static const String realestateEmpty = 'Properties will appear here.';
  static const String cartEmpty = 'Your cart is empty.';
  static const String ordersEmpty = 'Your orders will appear here.';
  static const String paymentsEmpty = 'Payment methods will appear here.';
  static const String profileEmpty = 'Account settings will appear here.';
  static const String supportEmpty = 'Help and support will appear here.';
  static const String loginTitle = 'Sign in to LocalWala';
  static const String loginEmpty = 'Phone number sign-in arrives with the auth feature.';
  static const String retry = 'Retry';
}
