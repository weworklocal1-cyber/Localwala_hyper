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
  static const String homeEmpty =
      'Stores and offers near you will appear here.';
  static const String homeConfigErrorTitle = 'Home unavailable';
  static const String homeConfigError = 'Could not load your home feed.';
  static const String bannerLabel = 'Promotional banner';
  static const String homeHeaderLabel = 'Home header animation';
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
  static const String loginEmpty =
      'Phone number sign-in arrives with the auth feature.';
  static const String phoneLabel = 'Phone number';
  static const String phoneHint = '98765 43210';
  static const String phoneInvalid = 'Enter a valid phone number.';
  static const String sendCode = 'Send code';
  static const String sendingCode = 'Sending…';
  static const String otpTitle = 'Verification code';
  static const String otpSentTo = 'Enter the 6-digit code sent to';
  static const String otpInvalidFallback = 'The code is not valid. Try again.';
  static const String otpResent = 'A new code was sent.';
  static const String verifyContinue = 'Verify and continue';
  static const String verifying = 'Verifying…';
  static const String resendCode = 'Resend code';
  static const String changeNumber = 'Change number';
  static const String retry = 'Retry';

  /// Countdown label shown until resend becomes available.
  static String resendInWith(int seconds) => 'Resend in ${seconds}s';
}
