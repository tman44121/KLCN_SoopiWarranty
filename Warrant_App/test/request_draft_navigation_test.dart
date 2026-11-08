import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:warrant_safe/models/portal_request_models.dart';
import 'package:warrant_safe/models/user_model.dart';
import 'support/fake_api_service.dart';
import 'package:warrant_safe/theme/app_theme.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/viewmodels/request_viewmodel.dart';
import 'package:warrant_safe/views/requests/real_create_request_screen.dart';

class _CatalogApi extends FakeApiService {
  @override
  Future<PortalCatalog> getPortalCatalog() async => const PortalCatalog([], []);
  @override
  Future<List<OwnedDevice>> getMyDevices() async => [];
}

void main() {
  for (final action in ['cancel', 'discard', 'app bar']) {
    testWidgets('dirty request Back: $action', (tester) async {
      await tester.binding.setSurfaceSize(const Size(360, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final auth = AuthViewModel(apiService: _CatalogApi());
      final requests = RequestViewModel(auth);
      final router = GoRouter(
        initialLocation: '/requests',
        routes: [
          GoRoute(
            path: '/requests',
            builder: (_, _) => const Scaffold(body: Text('Danh sách')),
          ),
          GoRoute(
            path: '/requests/create',
            builder: (_, _) => const RealCreateRequestScreen(),
          ),
        ],
      );
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider.value(value: requests),
          ],
          child: MaterialApp.router(
            theme: AppTheme.lightTheme,
            routerConfig: router,
          ),
        ),
      );
      router.push<void>('/requests/create');
      await tester.pumpAndSettle();
      await tester.tap(
        find.text('Thiết bị chưa có trong danh sách? Nhập thông tin'),
      );
      await tester.pumpAndSettle();
      final symptom = find.byKey(const ValueKey('request-symptom'));
      await tester.ensureVisible(symptom);
      await tester.enterText(symptom, 'Mô tả đang soạn');
      await tester.pump();
      if (action == 'app bar') {
        await tester.tap(find.byTooltip('Quay lại'));
      } else {
        await tester.binding.handlePopRoute();
      }
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      expect(find.byType(RealCreateRequestScreen), findsOneWidget);
      await tester.tap(
        find.text(action == 'discard' ? 'Bỏ thay đổi' : 'Tiếp tục soạn'),
      );
      await tester.pumpAndSettle();
      if (action == 'discard') {
        expect(find.byType(RealCreateRequestScreen), findsNothing);
        expect(find.text('Danh sách'), findsOneWidget);
      } else {
        final field = find.descendant(
          of: symptom,
          matching: find.byType(TextField),
        );
        expect(
          tester.widget<TextField>(field).controller!.text,
          'Mô tả đang soạn',
        );
      }
      await tester.pumpWidget(const SizedBox.shrink());
      router.dispose();
      requests.dispose();
      auth.dispose();
    });
  }

  testWidgets('unchanged request leaves with system Back without prompting', (
    tester,
  ) async {
    final auth = AuthViewModel(apiService: _CatalogApi());
    final router = GoRouter(
      initialLocation: '/requests',
      routes: [
        GoRoute(
          path: '/requests',
          builder: (_, _) => const Scaffold(body: Text('Danh sách')),
        ),
        GoRoute(
          path: '/requests/create',
          builder: (_, _) => const RealCreateRequestScreen(),
        ),
      ],
    );
    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: auth,
        child: MaterialApp.router(
          theme: AppTheme.lightTheme,
          routerConfig: router,
        ),
      ),
    );
    router.push<void>('/requests/create');
    await tester.pumpAndSettle();
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(router.routeInformationProvider.value.uri.path, '/requests');
    await tester.pumpWidget(const SizedBox.shrink());
    router.dispose();
    auth.dispose();
  });
}
