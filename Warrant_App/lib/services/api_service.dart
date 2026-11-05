import 'dart:convert';
import 'package:dio/dio.dart';
import '../models/user_model.dart';
import 'i_api_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Mock credentials
// ─────────────────────────────────────────────────────────────────────────────

final Map<String, Map<String, dynamic>> _mockUsers = {
  'admin@gmail.com': {
    'password': '123456',
    'user': {
      'id': 'usr_001',
      'fullName': 'Alex Morgan',
      'email': 'admin@gmail.com',
      'phone': '+84 912 345 678',
      'role': 'admin',
    },
  },
  'user@gmail.com': {
    'password': 'password123',
    'user': {
      'id': 'usr_002',
      'fullName': 'Nguyen Van B',
      'email': 'user@gmail.com',
      'phone': '+84 909 123 456',
      'role': 'customer',
    },
  },
};

final Set<String> _revokedTokens = {};

// ─────────────────────────────────────────────────────────────────────────────
// MockApiService
// ─────────────────────────────────────────────────────────────────────────────

/// In-memory mock implementation of [IApiService].
///
/// Mock tokens are stateless base64-encoded JSON, allowing mock sessions and
/// newly registered mock users to survive a cold app restart.
///
/// No real HTTP calls are made. AuthViewModel selects this or RealApiService
/// according to the saved mode.
class MockApiService extends IApiService {
  static const Duration _latency = Duration(milliseconds: 1500);

  // Dio is kept here so we can inject the Bearer header even in mock mode,
  // giving the same API surface as [RealApiService].
  final _dio = Dio(
    BaseOptions(
      baseUrl: 'https://api.warrantsafe.com/v1',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  String? _currentMockToken;

  String _encodeMockToken(UserModel user) {
    final payload = base64Encode(utf8.encode(jsonEncode(user.toJson())));
    return 'mock_$payload';
  }

  UserModel _decodeMockToken(String token) {
    if (!token.startsWith('mock_')) throw const ApiException('Invalid mock token format', statusCode: 401);
    try {
      final payload = token.substring(5);
      final jsonStr = utf8.decode(base64Decode(payload));
      return UserModel.fromJson(jsonDecode(jsonStr));
    } catch (_) {
      throw const ApiException('Invalid mock token', statusCode: 401);
    }
  }

  @override
  void setAuthToken(String token) {
    _dio.options.headers['Authorization'] = 'Bearer $token';
    _currentMockToken = token;
  }

  @override
  void clearAuthToken() {
    _dio.options.headers.remove('Authorization');
    _currentMockToken = null;
  }

  @override
  Future<AuthResponse> login(String username, String password) async {
    await Future.delayed(_latency);

    // Mock supports username as email
    final entry = _mockUsers[username.trim().toLowerCase()];
    if (entry == null || entry['password'] != password) {
      throw const ApiException('Sai tài khoản hoặc mật khẩu.', statusCode: 401);
    }

    final user = UserModel.fromJson(
      Map<String, dynamic>.from(entry['user'] as Map<String, dynamic>),
    );

    final token = _encodeMockToken(user);

    return AuthResponse(
      accessToken: token,
      expiresIn: 3600,
      refreshToken: token,
      refreshExpiresIn: 86400,
      user: user,
    );
  }

  @override
  Future<AuthResponse> register({
    required String fullName,
    required String phone,
    required String email,
    required String password,
  }) async {
    await Future.delayed(_latency);

    if (_mockUsers.containsKey(email.trim().toLowerCase())) {
      throw const ApiException(
        'Email này đã được đăng ký. Vui lòng sử dụng email khác.',
        statusCode: 409,
      );
    }

    final user = UserModel(
      id: 'usr_${DateTime.now().millisecondsSinceEpoch}',
      fullName: fullName,
      username: email.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      phone: phone,
      role: 'customer',
    );

    final token = _encodeMockToken(user);

    return AuthResponse(
      accessToken: token,
      expiresIn: 3600,
      refreshToken: token,
      refreshExpiresIn: 86400,
      user: user,
    );
  }

  @override
  Future<UserModel> getProfile() async {
    await Future.delayed(_latency);
    if (_currentMockToken == null || _revokedTokens.contains(_currentMockToken)) {
      throw const ApiException('Unauthorized', statusCode: 401);
    }
    return _decodeMockToken(_currentMockToken!);
  }

  @override
  Future<AuthResponse> refresh(String refreshToken) async {
    await Future.delayed(_latency);
    if (_revokedTokens.contains(refreshToken)) {
      throw const ApiException('Refresh token revoked', statusCode: 401);
    }

    final user = _decodeMockToken(refreshToken);
    final token = _encodeMockToken(user);

    return AuthResponse(
      accessToken: token,
      expiresIn: 3600,
      refreshToken: token,
      refreshExpiresIn: 86400,
      user: user,
    );
  }

  @override
  Future<void> logout(String? refreshToken) async {
    await Future.delayed(_latency);
    if (refreshToken != null) {
      _revokedTokens.add(refreshToken);
    }
    if (_currentMockToken != null) {
      _revokedTokens.add(_currentMockToken!);
    }
  }

  @override
  Future<List<OwnedDevice>> getMyDevices() async {
    await Future.delayed(_latency);
    return [
      const OwnedDevice(
        code: 'DEV-101',
        serialOrImei: 'C02CG123MD6R',
        productName: 'MacBook Pro 16"',
        brandName: 'Apple',
        identifierType: 'Serial',
        warrantyStatus: 'IN_WARRANTY',
        warrantyExpiresOn: '2027-10-09'
      ),
      const OwnedDevice(
        code: 'DEV-102',
        serialOrImei: '358912345678901',
        productName: 'Galaxy S24 Ultra',
        brandName: 'Samsung',
        identifierType: 'IMEI',
        warrantyStatus: 'OUT_OF_WARRANTY',
        warrantyExpiresOn: '2025-01-01'
      ),
    ];
  }
}
