import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/services/i_api_service.dart';
import 'package:warrant_safe/services/token_storage.dart';
import 'package:warrant_safe/models/user_model.dart';

class InMemoryTokenStorage implements TokenStorage {
  final Map<String, String> _store = {};

  @override
  Future<void> saveSession({required String token, String? refreshToken, required String userId}) async {
    _store['token'] = token;
    _store['userId'] = userId;
    if (refreshToken != null) {
      _store['refreshToken'] = refreshToken;
    }
  }

  @override
  Future<Map<String, String?>> readSession() async {
    return {
      'token': _store['token'],
      'refreshToken': _store['refreshToken'],
      'userId': _store['userId'],
    };
  }

  @override
  Future<void> clearSession() async {
    _store.remove('token');
    _store.remove('refreshToken');
    _store.remove('userId');
  }
}

class FakeApiService extends IApiService {
  int refreshCallCount = 0;
  int getProfileCallCount = 0;
  int logoutCallCount = 0;

  bool simulateNetworkOutage = false;
  bool simulateTempServerError = false;
  bool simulateInvalidRefresh = false;

  String? currentAuthToken;

  @override
  void setAuthToken(String token) {
    currentAuthToken = token;
  }

  @override
  void clearAuthToken() {
    currentAuthToken = null;
  }

  @override
  Future<AuthResponse> login(String username, String password) async {
    throw UnimplementedError();
  }

  @override
  Future<UserModel> getProfile() async {
    getProfileCallCount++;
    return const UserModel(
      id: 'acc_123',
      fullName: 'Real User',
      username: 'real',
      phone: '999',
      customerCode: 'CUST-01',
      role: 'CUSTOMER'
    );
  }

  @override
  Future<AuthResponse> refresh(String refreshToken) async {
    refreshCallCount++;
    if (simulateNetworkOutage) throw const NetworkException('Network Outage');
    if (simulateTempServerError) throw const ApiException('Server Error', statusCode: 500);
    if (simulateInvalidRefresh) throw const ApiException('Invalid/revoked', statusCode: 401);

    return const AuthResponse(
      accessToken: 'new_token',
      expiresIn: 3600,
      refreshToken: 'new_refresh',
      refreshExpiresIn: 86400,
      user: UserModel(id: 'acc_123', fullName: 'Real User', username: 'real', phone: '999', role: 'CUSTOMER'),
    );
  }

  @override
  Future<void> logout(String? refreshToken) async {
    logoutCallCount++;
  }

  @override
  Future<List<OwnedDevice>> getMyDevices() async {
    return [];
  }
}

void main() {
  group('AuthViewModel Restoration Tests', () {
    late InMemoryTokenStorage storage;
    late FakeApiService fakeApi;

    setUp(() {
      SharedPreferences.setMockInitialValues({'baseUrl': 'http://10.0.2.2/api/v1'});
      storage = InMemoryTokenStorage();
      fakeApi = FakeApiService();
    });

    for (final token in [null, 'orphaned_access_token']) {
      test('No refresh credential clears the stored session (token=$token)', () async {
        if (token != null) {
          await storage.saveSession(token: token, userId: 'acc_123');
        }
        final vm = AuthViewModel(tokenStorage: storage, apiService: fakeApi);
        addTearDown(vm.dispose);

        await vm.initialize();

        expect(vm.isAuthenticated, false);
        expect(vm.isLoading, false);
        expect(vm.hasSessionPendingRetry, false);
        expect(fakeApi.refreshCallCount, 0);
        expect(fakeApi.getProfileCallCount, 0);
        expect(fakeApi.currentAuthToken, null);
        final session = await storage.readSession();
        expect(session.values, everyElement(isNull));
      });
    }

    test('Network outage keeps tokens and sets retry flag on initialization', () async {
      await storage.saveSession(token: 'old_t', refreshToken: 'old_r', userId: 'acc_123');
      fakeApi.simulateNetworkOutage = true;
      final vm = AuthViewModel(tokenStorage: storage, apiService: fakeApi);

      await vm.initialize(); // Calls loadSettings, then tryAutoLogin

      expect(vm.hasSessionPendingRetry, true);
      expect(vm.isAuthenticated, false);

      final session = await storage.readSession();
      expect(session['refreshToken'], 'old_r', reason: 'Should not clear tokens');
    });

    test('Temporary server error (500) keeps tokens and sets retry flag', () async {
      await storage.saveSession(token: 'old_t', refreshToken: 'old_r', userId: 'acc_123');
      fakeApi.simulateTempServerError = true;
      final vm = AuthViewModel(tokenStorage: storage, apiService: fakeApi);

      await vm.initialize();

      expect(vm.hasSessionPendingRetry, true);
      expect(vm.isAuthenticated, false);

      final session = await storage.readSession();
      expect(session['refreshToken'], 'old_r', reason: 'Should not clear tokens');
    });

    test('Invalid/revoked refresh token (401) clears tokens', () async {
      await storage.saveSession(token: 'old_t', refreshToken: 'old_r', userId: 'acc_123');
      fakeApi.simulateInvalidRefresh = true;
      final vm = AuthViewModel(tokenStorage: storage, apiService: fakeApi);

      await vm.initialize();

      expect(vm.hasSessionPendingRetry, false);
      expect(vm.isAuthenticated, false);

      final session = await storage.readSession();
      expect(session['refreshToken'], null, reason: 'Should clear tokens');
    });

    test('Successful retry after reconnection restores session', () async {
      await storage.saveSession(token: 'old_t', refreshToken: 'old_r', userId: 'acc_123');
      fakeApi.simulateNetworkOutage = true;
      final vm = AuthViewModel(tokenStorage: storage, apiService: fakeApi);

      await vm.initialize();
      expect(vm.hasSessionPendingRetry, true);

      // Now it reconnects
      fakeApi.simulateNetworkOutage = false;
      await vm.tryAutoLogin();

      expect(vm.hasSessionPendingRetry, false);
      expect(vm.isAuthenticated, true);
      expect(vm.currentUser?.id, 'acc_123');
      expect(vm.currentUser?.role, 'CUSTOMER');
      expect(fakeApi.refreshCallCount, 2);
      expect(fakeApi.getProfileCallCount, 1);

      final session = await storage.readSession();
      expect(session['token'], 'new_token');
    });
  });
}
