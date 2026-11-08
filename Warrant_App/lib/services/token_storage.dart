import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Abstract interface
// ─────────────────────────────────────────────────────────────────────────────

/// Abstraction over the underlying secure storage implementation.
///
/// Concrete implementations:
///   • [SecureTokenStorage]  — `flutter_secure_storage` (iOS/Android/Web)
///   • `InMemoryTokenStorage` in `test/` — lightweight test double
abstract class TokenStorage {
  /// Persists the auth [token], [refreshToken] and [userId] to secure storage.
  Future<void> saveSession({
    required String token,
    String? refreshToken,
    required String userId,
  });

  /// Reads the stored keys.
  /// Returns `{'token': ..., 'refreshToken': ..., 'userId': ...}`
  Future<Map<String, String?>> readSession();

  /// Removes all keys from storage (called on logout).
  Future<void> clearSession();
}

// ─────────────────────────────────────────────────────────────────────────────
// Production implementation (flutter_secure_storage)
// ─────────────────────────────────────────────────────────────────────────────

/// Secure token storage using platform-specific encrypted storage:
///   • Android: EncryptedSharedPreferences (AES-256)
///   • iOS/macOS: Keychain
///   • Web: AES-encrypted localStorage
///   • Windows/Linux: libsecret / Credential Manager
class SecureTokenStorage implements TokenStorage {
  SecureTokenStorage()
    : _storage = const FlutterSecureStorage(
        // Android: use EncryptedSharedPreferences for AES-256 at rest.
        aOptions: AndroidOptions(encryptedSharedPreferences: true),
        // iOS: readable after first unlock, survives app reinstall.
        iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
        // Web: custom DB name to avoid collisions with other apps.
        webOptions: WebOptions(
          dbName: 'warrant_safe_secure',
          publicKey: 'warrant_safe_pub_key',
        ),
      );

  final FlutterSecureStorage _storage;

  // ── Private storage keys ─────────────────────────────────────────────────
  static const _tokenKey = 'warrantsafe_auth_token';
  static const _refreshTokenKey = 'warrantsafe_refresh_token';
  static const _userIdKey = 'warrantsafe_user_id';

  @override
  Future<void> saveSession({
    required String token,
    String? refreshToken,
    required String userId,
  }) async {
    final futures = <Future>[
      _storage.write(key: _tokenKey, value: token),
      _storage.write(key: _userIdKey, value: userId),
    ];
    if (refreshToken != null) {
      futures.add(_storage.write(key: _refreshTokenKey, value: refreshToken));
    }
    await Future.wait(futures);
  }

  @override
  Future<Map<String, String?>> readSession() async {
    final results = await Future.wait([
      _storage.read(key: _tokenKey),
      _storage.read(key: _refreshTokenKey),
      _storage.read(key: _userIdKey),
    ]);
    return {
      'token': results[0],
      'refreshToken': results[1],
      'userId': results[2],
    };
  }

  @override
  Future<void> clearSession() async {
    await Future.wait([
      _storage.delete(key: _tokenKey),
      _storage.delete(key: _refreshTokenKey),
      _storage.delete(key: _userIdKey),
    ]);
  }
}
