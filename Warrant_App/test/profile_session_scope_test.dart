import 'dart:async';
import 'dart:collection';
import 'package:flutter_test/flutter_test.dart';
import 'package:warrant_safe/models/user_model.dart';
import 'package:warrant_safe/services/api_service.dart';
import 'package:warrant_safe/services/i_api_service.dart';
import 'package:warrant_safe/services/token_storage.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';

UserModel _user(String id, [String? name]) => UserModel(
  id: id,
  fullName: name ?? 'Profile $id',
  username: id,
  phone: id,
  role: 'CUSTOMER',
  customerCode: 'KH-$id',
);

class _Storage implements TokenStorage {
  Map<String, String?> values = {};
  @override
  Future<void> saveSession({
    required String token,
    String? refreshToken,
    required String userId,
    bool isMock = false,
  }) async {
    values = {'token': token, 'refreshToken': refreshToken, 'userId': userId};
  }

  @override
  Future<Map<String, String?>> readSession({bool isMock = false}) async =>
      Map.of(values);
  @override
  Future<void> clearSession({bool isMock = false}) async => values.clear();
}

class _Api extends MockApiService {
  final profiles = Queue<Future<UserModel>>();
  int profileCalls = 0;
  @override
  Future<AuthResponse> login(String username, String password) async =>
      AuthResponse(
        accessToken: username,
        expiresIn: 900,
        refreshToken: 'r$username',
        refreshExpiresIn: 86400,
        user: _user(username),
      );
  @override
  Future<UserModel> getProfile() {
    profileCalls++;
    return profiles.removeFirst();
  }

  @override
  Future<void> logout(String? refreshToken) async {}
}

Future<void> _until(bool Function() ready) async {
  for (var i = 0; i < 100 && !ready(); i++) {
    await Future<void>.delayed(Duration.zero);
  }
  expect(ready(), isTrue);
}

void main() {
  for (final nextId in ['B', 'A']) {
    test('late profile cannot overwrite a new $nextId session', () async {
      final api = _Api();
      final auth = AuthViewModel(apiService: api, tokenStorage: _Storage());
      api.profiles.add(Future.value(_user('A')));
      await auth.loginUser('A', 'fixture');
      final old = Completer<UserModel>();
      api.profiles.add(old.future);
      final refresh = auth.refreshProfile();
      await _until(() => api.profileCalls == 2);
      await auth.logout();
      api.profiles.add(Future.value(_user(nextId, 'Fresh profile')));
      await auth.loginUser(nextId, 'fixture');

      old.complete(_user('A', 'Stale profile'));
      await refresh;

      expect(auth.currentUser!.id, nextId);
      expect(auth.currentUser!.fullName, 'Fresh profile');
      expect(auth.errorMessage, isNull);
      auth.dispose();
    });
  }

  test('late profile error cannot change the next session error', () async {
    final api = _Api();
    final auth = AuthViewModel(apiService: api, tokenStorage: _Storage());
    api.profiles.add(Future.value(_user('A')));
    await auth.loginUser('A', 'fixture');
    final old = Completer<UserModel>();
    api.profiles.add(old.future);
    final refresh = auth.refreshProfile();
    await _until(() => api.profileCalls == 2);
    await auth.logout();
    api.profiles.add(Future.value(_user('B')));
    await auth.loginUser('B', 'fixture');

    old.completeError(const ApiException('Old error'));
    await refresh;

    expect(auth.errorMessage, isNull);
    expect(auth.currentUser!.id, 'B');
    auth.dispose();
  });

  test('old login profile cannot finish the new login loading state', () async {
    final api = _Api();
    final auth = AuthViewModel(apiService: api, tokenStorage: _Storage());
    final old = Completer<UserModel>();
    api.profiles.add(old.future);
    final first = auth.loginUser('A', 'fixture');
    await _until(() => api.profileCalls == 1);
    await auth.logout();
    final latest = Completer<UserModel>();
    api.profiles.add(latest.future);
    final second = auth.loginUser('B', 'fixture');
    await _until(() => api.profileCalls == 2);

    old.complete(_user('A'));
    final firstResult = await first;
    final wasLoading = auth.isLoading;
    latest.complete(_user('B'));
    expect(await second, isTrue);

    expect(firstResult, isFalse);
    expect(wasLoading, isTrue);
    expect(auth.currentUser!.fullName, 'Profile B');
    auth.dispose();
  });
}
