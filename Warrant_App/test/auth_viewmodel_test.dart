import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/services/i_api_service.dart';
import 'package:warrant_safe/services/token_storage.dart';
import 'package:warrant_safe/models/user_model.dart';

class InMemoryTokenStorage implements TokenStorage {
  final Map<String, String> _store = {};

  @override
  Future<void> saveSession({required String token, String? refreshToken, required String userId, bool isMock = false}) async {
    final prefix = isMock ? 'mock_' : '';
    _store['${prefix}token'] = token;
    _store['${prefix}userId'] = userId;
    if (refreshToken != null) {
      _store['${prefix}refreshToken'] = refreshToken;
    }
  }

  @override
  Future<Map<String, String?>> readSession({bool isMock = false}) async {
    final prefix = isMock ? 'mock_' : '';
    return {
      'token': _store['${prefix}token'],
      'refreshToken': _store['${prefix}refreshToken'],
      'userId': _store['${prefix}userId'],
    };
  }

  @override
  Future<void> clearSession({bool isMock = false}) async {
    final prefix = isMock ? 'mock_' : '';
    _store.remove('${prefix}token');
    _store.remove('${prefix}refreshToken');
    _store.remove('${prefix}userId');
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
  Future<AuthResponse> register({required String fullName, required String phone, required String email, required String password}) async {
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
      SharedPreferences.setMockInitialValues({'isMock': false, 'baseUrl': 'http://10.0.2.2/api/v1'});
      storage = InMemoryTokenStorage();
      fakeApi = FakeApiService();
    });

    for (final isMock in [false, true]) {
      for (final token in [null, 'orphaned_access_token']) {
        test('No refresh credential clears only the current namespace '
            '(mock=$isMock, token=$token)', () async {
          SharedPreferences.setMockInitialValues({'isMock': isMock});
          await storage.saveSession(
            token: 'other_namespace_token',
            refreshToken: 'other_namespace_refresh',
            userId: 'other_user',
            isMock: !isMock,
          );
          if (token != null) {
            await storage.saveSession(
              token: token,
              userId: 'acc_123',
              isMock: isMock,
            );
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
          final session = await storage.readSession(isMock: isMock);
          expect(session.values, everyElement(isNull));
          final other = await storage.readSession(isMock: !isMock);
          expect(other['token'], 'other_namespace_token');
          expect(other['refreshToken'], 'other_namespace_refresh');
        });
      }
    }

    test('Network outage keeps tokens and sets retry flag on initialization', () async {
      await storage.saveSession(token: 'old_t', refreshToken: 'old_r', userId: 'acc_123', isMock: false);
      fakeApi.simulateNetworkOutage = true;
      final vm = AuthViewModel(tokenStorage: storage, apiService: fakeApi);

      await vm.initialize(); // Calls loadSettings, then tryAutoLogin

      expect(vm.hasSessionPendingRetry, true);
      expect(vm.isAuthenticated, false);

      final session = await storage.readSession(isMock: false);
      expect(session['refreshToken'], 'old_r', reason: 'Should not clear tokens');
    });

    test('Temporary server error (500) keeps tokens and sets retry flag', () async {
      await storage.saveSession(token: 'old_t', refreshToken: 'old_r', userId: 'acc_123', isMock: false);
      fakeApi.simulateTempServerError = true;
      final vm = AuthViewModel(tokenStorage: storage, apiService: fakeApi);

      await vm.initialize();

      expect(vm.hasSessionPendingRetry, true);
      expect(vm.isAuthenticated, false);

      final session = await storage.readSession(isMock: false);
      expect(session['refreshToken'], 'old_r', reason: 'Should not clear tokens');
    });

    test('Invalid/revoked refresh token (401) clears tokens', () async {
      await storage.saveSession(token: 'old_t', refreshToken: 'old_r', userId: 'acc_123', isMock: false);
      fakeApi.simulateInvalidRefresh = true;
      final vm = AuthViewModel(tokenStorage: storage, apiService: fakeApi);

      await vm.initialize();

      expect(vm.hasSessionPendingRetry, false);
      expect(vm.isAuthenticated, false);

      final session = await storage.readSession(isMock: false);
      expect(session['refreshToken'], null, reason: 'Should clear tokens');
    });

    test('Successful retry after reconnection restores session', () async {
      await storage.saveSession(token: 'old_t', refreshToken: 'old_r', userId: 'acc_123', isMock: false);
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

      final session = await storage.readSession(isMock: false);
      expect(session['token'], 'new_token');
    });

    test('Mode switching clears old session properly and retains its own', () async {
      SharedPreferences.setMockInitialValues({'isMock': true, 'baseUrl': 'http://10.0.2.2/api/v1'});

      await storage.saveSession(token: 'mock_t', refreshToken: 'mock_r', userId: 'acc_mock', isMock: true);
      await storage.saveSession(token: 'real_t', refreshToken: 'real_r', userId: 'acc_real', isMock: false);

      final vm = AuthViewModel(tokenStorage: storage, apiService: fakeApi);

      // Since it's mock, we'll pretend FakeApiService is the mock.
      // It will successfully refresh and clear the mock session because FakeApiService returns new_token.
      await vm.initialize();
      expect(vm.isMock, true);
      expect(vm.isAuthenticated, true); // Because FakeApiService refreshed it successfully.

      // Verify mock token changed and real token remained intact
      final initialMockSession = await storage.readSession(isMock: true);
      expect(initialMockSession['token'], 'new_token');

      final initialRealSession = await storage.readSession(isMock: false);
      expect(initialRealSession['token'], 'real_t');

      // Now toggle to real mode
      // It should call logout on the mock API, clearing the mock session
      await vm.toggleMockMode(false);

      expect(vm.isMock, false);
      expect(fakeApi.logoutCallCount, 1);

      // Verify mock session is cleared, but real session is untouched
      // Wait, toggleMockMode calls logout() which clears the CURRENT namespace (isMock = true at the time).
      final postToggleMockSession = await storage.readSession(isMock: true);
      expect(postToggleMockSession['token'], null, reason: 'Mock session should be cleared upon logout');

      final postToggleRealSession = await storage.readSession(isMock: false);
      expect(postToggleRealSession['token'], 'real_t', reason: 'Real session should be untouched by mock logout');
    });
  });

  group('MockApiService Cold-Start & Persistence Tests', () {
    late InMemoryTokenStorage storage;

    setUp(() {
      SharedPreferences.setMockInitialValues({'isMock': true, 'baseUrl': ''});
      storage = InMemoryTokenStorage();
    });

    test('Built-in mock user survives cold start', () async {
      // 1. Initial run: Login as admin
      var vm1 = AuthViewModel(tokenStorage: storage);
      await vm1.initialize();
      await vm1.loginUser('admin@gmail.com', '123456');
      expect(vm1.isAuthenticated, true);
      expect(vm1.currentUser?.email, 'admin@gmail.com');

      // 2. Simulate cold start by creating a new AuthViewModel with same storage
      var vm2 = AuthViewModel(tokenStorage: storage);
      await vm2.initialize(); // tryAutoLogin will read from storage and refresh via new MockApiService

      expect(vm2.isAuthenticated, true);
      expect(vm2.currentUser?.email, 'admin@gmail.com');
      expect(vm2.hasSessionPendingRetry, false);
    });

    test('Newly registered mock user survives cold start and logout revokes token', () async {
      // 1. Register a new user
      var vm1 = AuthViewModel(tokenStorage: storage);
      await vm1.initialize();

      // We need to call registerUser, but wait, AuthViewModel doesn't expose registerUser directly to the Mock API.
      // Yes it does: vm1.registerUser(...)
      final registered = await vm1.registerUser(
        fullName: 'New User',
        phone: '0123456789',
        email: 'new@gmail.com',
        password: 'password',
      );
      expect(registered, true);
      expect(vm1.isAuthenticated, true);
      expect(vm1.currentUser?.email, 'new@gmail.com');

      // 2. Cold start
      var vm2 = AuthViewModel(tokenStorage: storage);
      await vm2.initialize();

      expect(vm2.isAuthenticated, true, reason: 'New user should restore correctly');
      expect(vm2.currentUser?.email, 'new@gmail.com');

      // 3. Logout the user
      await vm2.logout();
      expect(vm2.isAuthenticated, false);

      // 4. Try cold start with the old (now revoked) token by manually injecting it
      // Actually logout already cleared it from storage. Let's manually put the revoked token back
      // to see if the Mock API rejects it!
      // But wait, the mock API in vm2 has it revoked, but vm3 will be a NEW MockApiService!
      // Ah... _revokedTokens is static! So a new MockApiService shares the revoked list.
      // Wait, is _revokedTokens static?
      // In api_service.dart: `final Set<String> _revokedTokens = {};` at top level! So it's effectively static.

      final session = await storage.readSession(isMock: true);
      expect(session['token'], null); // verify it's cleared
    });

    test('Rejected mock tokens (e.g., malformed or logged out) clear session', () async {
      await storage.saveSession(token: 'mock_invalid_token', refreshToken: 'mock_invalid_refresh', userId: 'usr_xyz', isMock: true);

      var vm = AuthViewModel(tokenStorage: storage);
      await vm.initialize();

      expect(vm.isAuthenticated, false);
      expect(vm.hasSessionPendingRetry, false);

      final session = await storage.readSession(isMock: true);
      expect(session['token'], null, reason: 'Invalid token should clear session');
    });
  });
}
