import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:warrant_safe/models/user_model.dart';
import 'support/fake_api_service.dart';
import 'package:warrant_safe/services/i_api_service.dart';
import 'package:warrant_safe/services/real_api_service.dart';
import 'package:warrant_safe/services/token_storage.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/views/profile/account_settings_screens.dart';
import 'package:warrant_safe/views/profile/profile_screen.dart';

ResponseBody _json(Object value, int status) => ResponseBody.fromString(
  jsonEncode(value),
  status,
  headers: {
    Headers.contentTypeHeader: ['application/json'],
  },
);

const _profile = {
  'customerCode': 'KH-FIXTURE',
  'fullName': 'Khách kiểm thử',
  'phone': '0900000000',
  'email': 'old@example.test',
  'address': 'Địa chỉ cũ',
  'username': 'kh.fixture',
};

const _userView = {
  'accountId': 'account-fixture',
  'displayName': 'Khách kiểm thử',
  'username': 'kh.fixture',
  'roles': [
    {'code': 'CUSTOMER'},
  ],
};

class _Adapter implements HttpClientAdapter {
  _Adapter(this.respond);

  final ResponseBody Function(RequestOptions) respond;
  final requests = <RequestOptions>[];
  final bodies = <String>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    bodies.add(
      requestStream == null
          ? ''
          : utf8.decode(await requestStream.expand((bytes) => bytes).toList()),
    );
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

class _Storage implements TokenStorage {
  String? access;
  String? refreshToken;
  String? userId;

  @override
  Future<void> saveSession({
    required String token,
    String? refreshToken,
    required String userId,
  }) async {
    access = token;
    this.refreshToken = refreshToken;
    this.userId = userId;
  }

  @override
  Future<Map<String, String?>> readSession() async => {
    'token': access,
    'refreshToken': refreshToken,
    'userId': userId,
  };

  @override
  Future<void> clearSession() async {
    access = null;
    refreshToken = null;
    userId = null;
  }
}

class _FakeApi extends FakeApiService {
  String? bearer;
  int passwordCalls = 0;
  bool rejectPassword = false;
  String? savedFullName;
  String? savedEmail;
  String? savedAddress;

  @override
  void setAuthToken(String token) => bearer = token;

  @override
  void clearAuthToken() => bearer = null;

  @override
  Future<AuthResponse> login(String username, String password) async =>
      const AuthResponse(
        accessToken: 'old-access-fixture',
        expiresIn: 900,
        refreshToken: 'old-refresh-fixture',
        refreshExpiresIn: 3600,
        user: UserModel(
          id: 'account-fixture',
          fullName: 'Khách kiểm thử',
          username: 'kh.fixture',
          phone: '0900000000',
          role: 'CUSTOMER',
        ),
      );

  @override
  Future<UserModel> getProfile() async => UserModel.fromJson(_profile);

  @override
  Future<UserModel> updateMyProfile({
    required String fullName,
    required String email,
    required String address,
  }) async {
    savedFullName = fullName;
    savedEmail = email;
    savedAddress = address;
    return UserModel.fromJson({
      ..._profile,
      'fullName': fullName,
      'email': email,
      'address': address,
    });
  }

  @override
  Future<AuthResponse> changePassword(
    String currentPassword,
    String newPassword,
  ) async {
    passwordCalls++;
    if (rejectPassword) {
      throw const ApiException(
        'Mật khẩu hiện tại không đúng.',
        statusCode: 400,
      );
    }
    return const AuthResponse(
      accessToken: 'rotated-access-fixture',
      expiresIn: 900,
      refreshToken: 'rotated-refresh-fixture',
      refreshExpiresIn: 3600,
      user: UserModel(
        id: 'account-fixture',
        fullName: 'Khách kiểm thử',
        username: 'kh.fixture',
        phone: '0900000000',
        role: 'CUSTOMER',
      ),
    );
  }

  @override
  Future<void> logout(String? refreshToken) async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'Real profile PATCH and password POST use Bearer and exact contract',
    () async {
      final adapter = _Adapter((request) {
        switch ('${request.method} ${request.uri.path}') {
          case 'GET /api/v1/auth/me':
            return _json(_userView, 200);
          case 'PATCH /api/v1/portal/my/profile':
            return _json({
              ..._profile,
              'fullName': 'Tên đã đổi',
              'email': 'new@example.test',
              'address': 'Địa chỉ mới',
            }, 200);
          case 'POST /api/v1/auth/mobile/change-password':
            return _json({
              'accessToken': 'rotated-access-fixture',
              'expiresIn': 900,
              'refreshToken': 'rotated-refresh-fixture',
              'refreshExpiresIn': 3600,
              'user': _userView,
            }, 200);
        }
        return _json({'detail': 'Unexpected route'}, 404);
      });
      final api = RealApiService(
        baseUrl: 'http://test/api/v1',
        adapter: adapter,
      )..setAuthToken('old-access-fixture');

      final profile = await api.updateMyProfile(
        fullName: ' Tên đã đổi ',
        email: ' new@example.test ',
        address: ' Địa chỉ mới ',
      );
      final auth = await api.changePassword('old-fixture', 'New-fixture123');

      expect(profile.fullName, 'Tên đã đổi');
      expect(profile.email, 'new@example.test');
      expect(auth.refreshToken, 'rotated-refresh-fixture');
      expect(adapter.requests.map((r) => '${r.method} ${r.uri.path}'), [
        'GET /api/v1/auth/me',
        'PATCH /api/v1/portal/my/profile',
        'GET /api/v1/auth/me',
        'POST /api/v1/auth/mobile/change-password',
      ]);
      expect(
        adapter.requests.every(
          (r) => r.headers['Authorization'] == 'Bearer old-access-fixture',
        ),
        isTrue,
      );
      expect(jsonDecode(adapter.bodies[1]), {
        'fullName': 'Tên đã đổi',
        'email': 'new@example.test',
        'address': 'Địa chỉ mới',
      });
      expect(jsonDecode(adapter.bodies[3]), {
        'currentPassword': 'old-fixture',
        'newPassword': 'New-fixture123',
      });
    },
  );

  test(
    'old API response cannot be shown as a successful name change',
    () async {
      final adapter = _Adapter((request) {
        if (request.method == 'GET') return _json(_userView, 200);
        return _json(_profile, 200);
      });
      final api = RealApiService(
        baseUrl: 'http://test/api/v1',
        adapter: adapter,
      )..setAuthToken('old-access-fixture');
      await expectLater(
        api.updateMyProfile(
          fullName: 'Tên mới',
          email: 'old@example.test',
          address: 'Địa chỉ cũ',
        ),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'HTTP status', 200),
        ),
      );
      expect(adapter.requests.where((r) => r.method == 'PATCH').length, 1);
    },
  );

  test('uncertain password response does not replay the POST', () async {
    final adapter = _Adapter((request) {
      if (request.method == 'GET') return _json(_userView, 200);
      throw DioException(
        requestOptions: request,
        type: DioExceptionType.receiveTimeout,
      );
    });
    final api = RealApiService(baseUrl: 'http://test/api/v1', adapter: adapter)
      ..setAuthToken('old-access-fixture');
    await expectLater(
      api.changePassword('old-fixture', 'New-fixture123'),
      throwsA(isA<NetworkException>()),
    );
    expect(adapter.requests.where((r) => r.method == 'POST').length, 1);
  });

  test('profile save updates only the current Real session', () async {
    SharedPreferences.setMockInitialValues({});
    final api = _FakeApi();
    final storage = _Storage();
    final vm = AuthViewModel(apiService: api, tokenStorage: storage);
    await vm.initialize();
    expect(await vm.loginUser('kh.fixture', 'fixture'), isTrue);

    await vm.updateMyProfile(
      fullName: 'Tên đã đổi',
      email: 'new@example.test',
      address: 'Địa chỉ mới',
    );
    expect(api.savedFullName, 'Tên đã đổi');
    expect(api.savedEmail, 'new@example.test');
    expect(vm.currentUser!.id, 'account-fixture');
    expect(vm.currentUser!.customerCode, 'KH-FIXTURE');
    expect(vm.currentUser!.fullName, 'Tên đã đổi');
    expect(vm.currentUser!.email, 'new@example.test');
    expect(vm.currentUser!.address, 'Địa chỉ mới');
    vm.dispose();
  });

  test('confirmed password change persists both rotated credentials', () async {
    SharedPreferences.setMockInitialValues({});
    final api = _FakeApi();
    final storage = _Storage();
    final vm = AuthViewModel(apiService: api, tokenStorage: storage);
    await vm.initialize();
    expect(await vm.loginUser('kh.fixture', 'fixture'), isTrue);

    await vm.changePassword('old-fixture', 'New-fixture123');
    expect(api.passwordCalls, 1);
    expect(storage.access, 'rotated-access-fixture');
    expect(storage.refreshToken, 'rotated-refresh-fixture');
    expect(api.bearer, 'rotated-access-fixture');
    expect(vm.isAuthenticated, isTrue);
    expect(vm.currentUser!.customerCode, 'KH-FIXTURE');
    vm.dispose();
  });

  test('rejected password change keeps the existing session', () async {
    SharedPreferences.setMockInitialValues({});
    final api = _FakeApi()..rejectPassword = true;
    final storage = _Storage();
    final vm = AuthViewModel(apiService: api, tokenStorage: storage);
    await vm.initialize();
    expect(await vm.loginUser('kh.fixture', 'fixture'), isTrue);

    await expectLater(
      vm.changePassword('wrong-fixture', 'New-fixture123'),
      throwsA(isA<ApiException>()),
    );
    expect(api.passwordCalls, 1);
    expect(storage.refreshToken, 'old-refresh-fixture');
    expect(vm.isAuthenticated, isTrue);
    vm.dispose();
  });

  testWidgets(
    'name form validates locally and the account page shows the saved name',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final api = _FakeApi();
      final vm = AuthViewModel(apiService: api, tokenStorage: _Storage());
      await vm.initialize();
      expect(await vm.loginUser('kh.fixture', 'fixture'), isTrue);
      addTearDown(vm.dispose);
      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: vm,
          child: const MaterialApp(home: EditProfileScreen()),
        ),
      );
      await tester.enterText(find.byType(TextFormField).first, 'A');
      await tester.ensureVisible(find.text('Lưu thay đổi'));
      await tester.tap(find.text('Lưu thay đổi'));
      await tester.pump();
      expect(
        find.text('Họ và tên cần từ 2 đến 100 ký tự và không chứa chữ số.'),
        findsOneWidget,
      );
      expect(api.savedFullName, isNull);
      await tester.enterText(find.byType(TextFormField).first, 'Tên đã đổi');
      await tester.tap(find.text('Lưu thay đổi'));
      await tester.pumpAndSettle();
      expect(api.savedFullName, 'Tên đã đổi');
      expect(find.text('Đã cập nhật hồ sơ cá nhân.'), findsOneWidget);
      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: vm,
          child: const MaterialApp(home: ProfileScreen()),
        ),
      );
      await tester.pump();
      expect(find.text('Tên đã đổi'), findsWidgets);
    },
  );

  testWidgets('password form blocks incomplete input without an API write', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final api = _FakeApi();
    final vm = AuthViewModel(apiService: api, tokenStorage: _Storage());
    await vm.initialize();
    expect(await vm.loginUser('kh.fixture', 'fixture'), isTrue);
    addTearDown(vm.dispose);

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: vm,
        child: const MaterialApp(home: ChangePasswordScreen()),
      ),
    );
    await tester.ensureVisible(find.text('Đổi mật khẩu').last);
    await tester.tap(find.text('Đổi mật khẩu').last);
    await tester.pump();
    expect(find.text('Vui lòng nhập mật khẩu hiện tại.'), findsOneWidget);
    expect(api.passwordCalls, 0);
  });
}
