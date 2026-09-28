import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Auth session persistence (spec §31: secure local storage for tokens).
abstract class SessionStore {
  Future<String?> readAccessToken();
  Future<String?> readRefreshToken();
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  });
  Future<void> clear();

  /// Stable per-install device id sent with login (auth-service device
  /// tracking, spec §7).
  Future<String> deviceId();
}

String generateDeviceId(String prefix) {
  final Random random = Random.secure();
  final String stamp = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
  final String suffix = random.nextInt(46656).toRadixString(36);
  return '${prefix}_$stamp$suffix';
}

/// Production store backed by the platform keystore/keychain.
class SecureSessionStore implements SessionStore {
  SecureSessionStore({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static const String _accessTokenKey = 'session.access_token';
  static const String _refreshTokenKey = 'session.refresh_token';
  static const String _deviceIdKey = 'session.device_id';

  final FlutterSecureStorage _storage;

  @override
  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  @override
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  @override
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }

  @override
  Future<String> deviceId() async {
    final String? existing = await _storage.read(key: _deviceIdKey);
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }
    final String generated = generateDeviceId('cw');
    await _storage.write(key: _deviceIdKey, value: generated);
    return generated;
  }
}

/// Test/dev store — never used in production builds.
class InMemorySessionStore implements SessionStore {
  String? _accessToken;
  String? _refreshToken;
  String? _deviceId;

  @override
  Future<String?> readAccessToken() async => _accessToken;

  @override
  Future<String?> readRefreshToken() async => _refreshToken;

  @override
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
  }

  @override
  Future<void> clear() async {
    _accessToken = null;
    _refreshToken = null;
  }

  @override
  Future<String> deviceId() async => _deviceId ??= generateDeviceId('cw');
}
