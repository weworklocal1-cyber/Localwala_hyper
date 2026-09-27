/// Single source of shell UI copy (spec §32: localization-ready strings).
///
/// Kept in one place so the app can migrate to `flutter gen-l10n` without
/// hunting literals across the tree.
abstract final class AppStrings {
  static const String appName = 'LocalWala Delivery';
  static const String homeTab = 'Home';
  static const String deliveriesTab = 'Deliveries';
  static const String earningsTab = 'Earnings';
  static const String profileTab = 'Profile';

  static const String homeTitle = 'Go online';
  static const String homeEmpty = 'New delivery offers will appear here.';
  static const String deliveriesEmpty = 'Your delivery history will appear here.';
  static const String earningsEmpty = 'Your earnings and settlements will appear here.';
  static const String profileEmpty = 'Driver profile and documents will appear here.';
  static const String documentsEmpty = 'Onboarding documents will appear here.';
  static const String supportEmpty = 'Help and incident reporting will appear here.';
  static const String loginTitle = 'Sign in to LocalWala Delivery';
  static const String loginEmpty = 'Driver sign-in arrives with the auth feature.';
  static const String retry = 'Retry';
}
