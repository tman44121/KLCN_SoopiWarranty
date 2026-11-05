import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:warrant_safe/models/portal_notification_models.dart';
import 'package:warrant_safe/models/user_model.dart';
import 'package:warrant_safe/services/api_service.dart';
import 'package:warrant_safe/services/token_storage.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/widgets/notification_count_badge.dart';

class _Storage implements TokenStorage {
  @override
  Future<void> clearSession({bool isMock = false}) async {}

  @override
  Future<Map<String, String?>> readSession({bool isMock = false}) async => {};

  @override
  Future<void> saveSession({
    required String token,
    String? refreshToken,
    required String userId,
    bool isMock = false,
  }) async {}
}

class _NotificationApi extends MockApiService {
  String accountId = 'account-a';
  int unreadCount = 3;
  Completer<PortalNotificationInbox>? nextInbox;
  bool includeNotification = false;
  bool notificationRead = false;
  int markReadCalls = 0;

  @override
  Future<AuthResponse> login(String username, String password) async {
    final user = UserModel(
      id: accountId,
      fullName: 'Khách kiểm thử',
      username: username,
      phone: '',
      role: 'CUSTOMER',
    );
    return AuthResponse(
      accessToken: 'access-$accountId',
      expiresIn: 900,
      refreshToken: 'refresh-$accountId',
      refreshExpiresIn: 3600,
      user: user,
    );
  }

  @override
  Future<UserModel> getProfile() async => UserModel(
    id: accountId,
    fullName: 'Khách kiểm thử',
    username: 'customer',
    phone: '',
    role: 'CUSTOMER',
    customerCode: 'KH-TEST',
  );

  @override
  Future<PortalNotificationInbox> getNotifications() async {
    final pending = nextInbox;
    if (pending != null) {
      nextInbox = null;
      return pending.future;
    }
    final items = includeNotification
        ? [
            PortalNotification(
              id: '42',
              type: 'TEST_EVENT',
              message: 'Thông báo kiểm thử',
              read: notificationRead,
            ),
          ]
        : const <PortalNotification>[];
    return PortalNotificationInbox(items, notificationRead ? 0 : unreadCount);
  }

  @override
  Future<void> markNotificationRead(String id) async {
    markReadCalls++;
    notificationRead = true;
  }

  @override
  Future<void> logout(String? refreshToken) async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('badge renders count, zero, loading and error states', (
    tester,
  ) async {
    Widget buildBadge({int? count, bool loading = false, bool error = false}) =>
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: NotificationCountBadge(
                count: count,
                loading: loading,
                error: error,
                child: const Icon(Icons.notifications),
              ),
            ),
          ),
        );

    await tester.pumpWidget(buildBadge(count: 0));
    expect(find.text('0'), findsNothing);

    await tester.pumpWidget(buildBadge(count: 4));
    expect(find.text('4'), findsOneWidget);

    await tester.pumpWidget(buildBadge(loading: true));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('4'), findsNothing);

    await tester.pumpWidget(buildBadge(error: true));
    expect(
      find.bySemanticsLabel('Không tải được số thông báo chưa đọc'),
      findsOneWidget,
    );
  });

  test(
    'inbox refresh updates shared count and session changes clear stale data',
    () async {
      SharedPreferences.setMockInitialValues({'isMock': false});
      final api = _NotificationApi();
      final auth = AuthViewModel(tokenStorage: _Storage(), apiService: api);
      await auth.initialize();

      await auth.loginUser('customer-a', 'test-only');
      await Future<void>.delayed(Duration.zero);
      expect(auth.notificationUnreadCount, 3);

      api.unreadCount = 0;
      await auth.getNotifications();
      expect(auth.notificationUnreadCount, 0);

      final staleRead = Completer<PortalNotificationInbox>();
      api.nextInbox = staleRead;
      final oldSessionRead = auth.getNotifications();
      await auth.logout();
      expect(auth.notificationUnreadCount, isNull);
      expect(auth.notificationCountLoading, isFalse);
      expect(auth.notificationCountError, isFalse);

      api.accountId = 'account-b';
      api.unreadCount = 1;
      await auth.loginUser('customer-b', 'test-only');
      await Future<void>.delayed(Duration.zero);
      expect(auth.notificationUnreadCount, 1);

      staleRead.complete(const PortalNotificationInbox([], 99));
      await oldSessionRead;
      expect(auth.notificationUnreadCount, 1);

      auth.dispose();
    },
  );

  test(
    'failed inbox read clears displayed count and exposes error state',
    () async {
      SharedPreferences.setMockInitialValues({'isMock': false});
      final api = _NotificationApi();
      final auth = AuthViewModel(tokenStorage: _Storage(), apiService: api);
      await auth.initialize();
      await auth.loginUser('customer-a', 'test-only');
      await Future<void>.delayed(Duration.zero);
      api.nextInbox = Completer<PortalNotificationInbox>()
        ..completeError(StateError('offline'));

      await expectLater(auth.getNotifications(), throwsA(isA<StateError>()));
      expect(auth.notificationUnreadCount, isNull);
      expect(auth.notificationCountError, isTrue);
      auth.dispose();
    },
  );
}
