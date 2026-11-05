import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:warrant_safe/models/portal_notification_models.dart';
import 'package:warrant_safe/models/user_model.dart';
import 'package:warrant_safe/services/api_service.dart';
import 'package:warrant_safe/services/token_storage.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/views/notifications/real_notification_content.dart';

class _MemoryStorage implements TokenStorage {
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

class _InboxApi extends MockApiService {
  bool read = false;
  int markCalls = 0;
  int inboxCalls = 0;

  @override
  Future<AuthResponse> login(String username, String password) async =>
      const AuthResponse(
        accessToken: 'fixture-access',
        expiresIn: 900,
        refreshToken: null,
        refreshExpiresIn: null,
        user: UserModel(
          id: 'fixture-customer',
          fullName: 'Khách kiểm thử',
          username: 'fixture',
          phone: '',
          role: 'CUSTOMER',
        ),
      );

  @override
  Future<UserModel> getProfile() async => (await login('', '')).user;

  @override
  Future<PortalNotificationInbox> getNotifications() async {
    inboxCalls++;
    return PortalNotificationInbox([
      PortalNotification(
        id: '42',
        type: 'QUOTATION_AWAITING_CUSTOMER',
        message: 'Báo giá kiểm thử',
        entityId: 'TN-TEST',
        read: read,
      ),
    ], read ? 0 : 1);
  }

  @override
  Future<void> markNotificationRead(String id) async {
    markCalls++;
    read = true;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'inbox polling pauses offstage and in the background, then refreshes on return',
    (tester) async {
      SharedPreferences.setMockInitialValues({'isMock': false});
      final api = _InboxApi();
      final auth = AuthViewModel(
        tokenStorage: _MemoryStorage(),
        apiService: api,
      );
      addTearDown(auth.dispose);
      await auth.initialize();
      await auth.loginUser('fixture', 'fixture');
      final visible = ValueNotifier(true);
      addTearDown(visible.dispose);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: auth,
          child: MaterialApp(
            home: ValueListenableBuilder<bool>(
              valueListenable: visible,
              builder: (context, active, child) =>
                  TickerMode(enabled: active, child: child!),
              child: const Scaffold(body: RealNotificationContent()),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final initial = api.inboxCalls;
      await tester.pump(const Duration(seconds: 31));
      await tester.pumpAndSettle();
      expect(api.inboxCalls, initial + 1);
      visible.value = false;
      await tester.pump();
      final hidden = api.inboxCalls;
      await tester.pump(const Duration(seconds: 90));
      expect(api.inboxCalls, hidden);
      visible.value = true;
      await tester.pumpAndSettle();
      expect(api.inboxCalls, hidden + 1);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      final background = api.inboxCalls;
      await tester.pump(const Duration(seconds: 90));
      expect(api.inboxCalls, background);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(api.inboxCalls, background + 1);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('opening a quotation leaves no spinner beside notification', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({'isMock': false});
    final api = _InboxApi();
    final auth = AuthViewModel(tokenStorage: _MemoryStorage(), apiService: api);
    addTearDown(auth.dispose);
    await auth.initialize();
    await auth.loginUser('fixture', 'fixture');
    final router = GoRouter(
      initialLocation: '/notifications',
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (context, state, shell) => Scaffold(body: shell),
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/notifications',
                  builder: (context, state) =>
                      const Scaffold(body: RealNotificationContent()),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/requests',
                  builder: (context, state) => const Scaffold(),
                  routes: [
                    GoRoute(
                      path: 'tickets/:code',
                      builder: (context, state) => const Scaffold(
                        body: Center(child: Text('Chi tiết báo giá kiểm thử')),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider<AuthViewModel>.value(
        value: auth,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Báo giá kiểm thử'));
    await tester.pumpAndSettle();
    expect(find.text('Chi tiết báo giá kiểm thử'), findsOneWidget);
    expect(api.markCalls, 1);
    // The indexed shell keeps the notification screen mounted while the
    // ticket is open. Its row must not wait for the ticket route to pop.
    expect(
      find.byType(CircularProgressIndicator, skipOffstage: false),
      findsNothing,
    );
    router.go('/notifications');
    await tester.pumpAndSettle();
    expect(find.text('0 chưa đọc · Thông báo trong ứng dụng'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
}
