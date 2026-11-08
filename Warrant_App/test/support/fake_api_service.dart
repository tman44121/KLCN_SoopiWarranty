import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:warrant_safe/models/user_model.dart';
import 'package:warrant_safe/services/i_api_service.dart';

// Test accounts known to [FakeApiService].

final Map<String, Map<String, dynamic>> _testUsers = {
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

/// In-memory [IApiService] for widget and view-model tests: stateless base64
/// tokens, a fixed latency and two known accounts. Tests subclass it and
/// override the calls they exercise.
class FakeApiService extends IApiService {
  static const Duration _latency = Duration(milliseconds: 1500);

  // Keeps the Bearer header like [RealApiService] does.
  final _dio = Dio(
    BaseOptions(
      baseUrl: 'https://api.warrantsafe.com/v1',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  String? _currentToken;

  String _encodeToken(UserModel user) {
    final payload = base64Encode(utf8.encode(jsonEncode(user.toJson())));
    return 'test_$payload';
  }

  UserModel _decodeToken(String token) {
    if (!token.startsWith('test_')) throw const ApiException('Invalid test token format', statusCode: 401);
    try {
      final payload = token.substring(5);
      final jsonStr = utf8.decode(base64Decode(payload));
      return UserModel.fromJson(jsonDecode(jsonStr));
    } catch (_) {
      throw const ApiException('Invalid test token', statusCode: 401);
    }
  }

  @override
  void setAuthToken(String token) {
    _dio.options.headers['Authorization'] = 'Bearer $token';
    _currentToken = token;
  }

  @override
  void clearAuthToken() {
    _dio.options.headers.remove('Authorization');
    _currentToken = null;
  }

  @override
  Future<AuthResponse> login(String username, String password) async {
    await Future.delayed(_latency);

    final entry = _testUsers[username.trim().toLowerCase()];
    if (entry == null || entry['password'] != password) {
      throw const ApiException('Sai tài khoản hoặc mật khẩu.', statusCode: 401);
    }

    final user = UserModel.fromJson(
      Map<String, dynamic>.from(entry['user'] as Map<String, dynamic>),
    );

    final token = _encodeToken(user);

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
    if (_currentToken == null || _revokedTokens.contains(_currentToken)) {
      throw const ApiException('Unauthorized', statusCode: 401);
    }
    return _decodeToken(_currentToken!);
  }

  @override
  Future<AuthResponse> refresh(String refreshToken) async {
    await Future.delayed(_latency);
    if (_revokedTokens.contains(refreshToken)) {
      throw const ApiException('Refresh token revoked', statusCode: 401);
    }

    final user = _decodeToken(refreshToken);
    final token = _encodeToken(user);

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
    if (_currentToken != null) {
      _revokedTokens.add(_currentToken!);
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
