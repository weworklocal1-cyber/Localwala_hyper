/// Build-time app configuration.
///
/// Override at build/run time with:
/// `flutter run --dart-define=API_BASE_URL=http://10.0.0.5:4000`
class AppConfig {
  const AppConfig({
    this.environment = const String.fromEnvironment(
      'APP_ENV',
      defaultValue: 'dev',
    ),
    this.apiBaseUrl = const String.fromEnvironment(
      'API_BASE_URL',
      // 10.0.2.2 is the Android emulator's alias for the host machine.
      defaultValue: 'http://10.0.2.2:4000',
    ),
    this.connectTimeout = const Duration(seconds: 10),
    this.receiveTimeout = const Duration(seconds: 20),
  });

  final String environment;
  final String apiBaseUrl;
  final Duration connectTimeout;
  final Duration receiveTimeout;

  bool get isDev => environment == 'dev';
}
