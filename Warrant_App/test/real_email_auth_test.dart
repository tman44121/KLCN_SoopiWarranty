import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:warrant_safe/models/user_model.dart';
import 'package:warrant_safe/services/api_service.dart';
import 'package:warrant_safe/services/i_api_service.dart';
import 'package:warrant_safe/services/real_api_service.dart';
import 'package:warrant_safe/services/token_storage.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/views/auth/auth_form_validators.dart';

ResponseBody _json(Object value, int status) => ResponseBody.fromString(
  jsonEncode(value),
  status,
  headers: {
    Headers.contentTypeHeader: ['application/json'],
  },
);

bool _hasAuthorization(RequestOptions request) =>
    request.headers.keys.any((key) => key.toLowerCase() == 'authorization');

class _Adapter implements HttpClientAdapter {
  _Adapter(this.respond);
  final ResponseBody Function(RequestOptions) respond;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

const _user = UserModel(
  id: 'acc-fixture',
  fullName: 'Khách kiểm thử',
  username: 'customer-fixture',
  phone: '',
  role: 'CUSTOMER',
);

const _auth = AuthResponse(
  accessToken: 'access-fixture',
  expiresIn: 900,
  refreshToken: 'refresh-fixture',
  refreshExpiresIn: 3600,
  user: _user,
);

class _Storage implements TokenStorage {
  String? access;
  String? refresh;
  bool? mock;

  @override
  Future<void> saveSession({
    required String token,
    String? refreshToken,
    required String userId,
    bool isMock = false,
  }) async {
    access = token;
    refresh = refreshToken;
    mock = isMock;
  }

  @override
  Future<Map<String, String?>> readSession({bool isMock = false}) async => {};

  @override
  Future<void> clearSession({bool isMock = false}) async {}
}

class _RegisterApi extends MockApiService {
  int registerCalls = 0;
  String? lastBearer;

  @override
  Future<AuthResponse> registerWithEmailOtp({
    required String fullName,
    required String phone,
    required String email,
    required String otp,
    required String password,
  }) async {
    registerCalls++;
    return _auth;
  }

  @override
  void setAuthToken(String token) => lastBearer = token;

  @override
  Future<UserModel> getProfile() async => const UserModel(
    id: 'acc-fixture',
    customerCode: 'KH-fixture',
    fullName: 'Khách kiểm thử',
    username: 'customer-fixture',
    phone: '',
    role: 'CUSTOMER',
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'Real OTP and registration use the backend body without Bearer',
    () async {
      final adapter = _Adapter((request) {
        if (request.path == '/auth/mobile/otp') {
          return _json({'expiresIn': 300, 'resendAfter': 60}, 202);
        }
        if (request.path == '/auth/mobile/register') {
          return _json({
            'accessToken': 'access-fixture',
            'expiresIn': 900,
            'refreshToken': 'refresh-fixture',
            'refreshExpiresIn': 3600,
            'user': {
              'accountId': 'acc-fixture',
              'username': 'customer-fixture',
              'displayName': 'Khách kiểm thử',
              'roles': [
                {'code': 'CUSTOMER'},
              ],
            },
          }, 201);
        }
        throw StateError('Unexpected request');
      });
      final api = RealApiService(
        baseUrl: 'http://test/api/v1',
        adapter: adapter,
      )..setAuthToken('old-access-fixture');

      final issued = await api.requestRegistrationOtp(
        'demo@example.test',
        '0900000000',
      );
      final created = await api.registerWithEmailOtp(
        fullName: 'Khách kiểm thử',
        phone: '0900000000',
        email: 'demo@example.test',
        otp: '000000',
        password: 'fixturepass1',
      );
      expect(issued.resendAfter, 60);
      expect(created.user.id, 'acc-fixture');
      expect(created.refreshToken, 'refresh-fixture');
      expect(adapter.requests.map((request) => request.uri.path), [
        '/api/v1/auth/mobile/otp',
        '/api/v1/auth/mobile/register',
      ]);
      expect(
        adapter.requests.every((request) => !_hasAuthorization(request)),
        true,
      );
      expect((adapter.requests.first.data as Map)['purpose'], 'REGISTER');
      expect((adapter.requests.last.data as Map)['otp'], '000000');
    },
  );

  test('problem code and HTTP status survive rejected registration', () async {
    final adapter = _Adapter(
      (_) => _json({
        'type': 'https://example.test/errors/CUSTOMER_EMAIL_DUPLICATE',
        'detail': 'Email đã được dùng cho một tài khoản khác.',
        'code': 'CUSTOMER_EMAIL_DUPLICATE',
      }, 409),
    );
    final api = RealApiService(baseUrl: 'http://test/api/v1', adapter: adapter);
    await expectLater(
      api.registerWithEmailOtp(
        fullName: 'Khách kiểm thử',
        phone: '0900000000',
        email: 'demo@example.test',
        otp: '000000',
        password: 'fixturepass1',
      ),
      throwsA(
        isA<ApiException>()
            .having((error) => error.statusCode, 'status', 409)
            .having((error) => error.code, 'code', 'CUSTOMER_EMAIL_DUPLICATE'),
      ),
    );
    expect(adapter.requests, hasLength(1));
  });

  test('password reset uses email OTP endpoints without Bearer', () async {
    final adapter = _Adapter(
      (request) => request.path == '/auth/mobile/otp'
          ? _json({'expiresIn': 300, 'resendAfter': 60}, 202)
          : _json({}, 204),
    );
    final api = RealApiService(baseUrl: 'http://test/api/v1', adapter: adapter)
      ..setAuthToken('old-access-fixture');
    await api.requestPasswordResetOtp('demo@example.test');
    await api.verifyPasswordResetOtp('demo@example.test', '000000');
    await api.resetPasswordWithEmailOtp(
      email: 'demo@example.test',
      otp: '000000',
      newPassword: 'fixturepass1',
    );
    expect(adapter.requests.map((request) => request.uri.path), [
      '/api/v1/auth/mobile/otp',
      '/api/v1/auth/mobile/password-reset/verify',
      '/api/v1/auth/mobile/password-reset',
    ]);
    expect(
      adapter.requests.every((request) => !_hasAuthorization(request)),
      true,
    );
    expect((adapter.requests.first.data as Map)['purpose'], 'RESET_PASSWORD');
  });

  test('Real registration stores its own session and loads profile', () async {
    SharedPreferences.setMockInitialValues({
      'isMock': false,
      'baseUrl': 'http://10.0.2.2:8081/api/v1',
    });
    final storage = _Storage();
    final api = _RegisterApi();
    final auth = AuthViewModel(tokenStorage: storage, apiService: api);
    await auth.initialize();
    expect(
      await auth.registerUser(
        fullName: 'Khách kiểm thử',
        phone: '0900000000',
        email: 'demo@example.test',
        emailOtp: '000000',
        password: 'fixturepass1',
      ),
      true,
    );
    expect(api.registerCalls, 1);
    expect(storage.mock, false);
    expect(storage.refresh, 'refresh-fixture');
    expect(api.lastBearer, 'access-fixture');
    expect(auth.currentUser?.customerCode, 'KH-fixture');
    auth.dispose();
  });

  test('Real form guidance follows phone, email, OTP and password rules', () {
    expect(validateCustomerPhone('0900000000'), isNull);
    expect(validateCustomerPhone('abc'), isNotNull);
    expect(validateCustomerEmail('demo@example.test'), isNull);
    expect(validateCustomerEmail('demo'), isNotNull);
    expect(validateEmailOtp('000000'), isNull);
    expect(validateEmailOtp('123'), isNotNull);
    expect(validateCustomerPassword('fixturepass1', '0900000000'), isNull);
    expect(validateCustomerPassword('short1', '0900000000'), isNotNull);
    expect(
      validateCustomerPassword('0900000000Pass1', '0900000000'),
      isNotNull,
    );
  });
}
