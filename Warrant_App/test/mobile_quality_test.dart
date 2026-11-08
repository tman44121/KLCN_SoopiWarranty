import 'dart:ui' show Tristate;
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/rendering.dart' show RenderParagraph;
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:warrant_safe/services/token_storage.dart';
import 'package:warrant_safe/theme/app_theme.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/views/auth/login_screen.dart';
import 'package:warrant_safe/views/shell/main_shell.dart';
import 'package:warrant_safe/widgets/soopi_ui.dart';
import 'package:warrant_safe/widgets/notification_count_badge.dart';

class _Storage implements TokenStorage {
  @override
  Future<Map<String, String?>> readSession() async => {};
  @override
  Future<void> clearSession() async {}
  @override
  Future<void> saveSession({
    required String token,
    String? refreshToken,
    required String userId,
  }) async {}
}

void main() {
  testWidgets('large-text statistics retain their complete label', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 100,
              child: MediaQuery(
                data: const MediaQueryData(textScaler: TextScaler.linear(2)),
                child: StatBox(label: 'Chờ bạn xác nhận', value: '1'),
              ),
            ),
          ),
        ),
      ),
    );
    final paragraph = tester.renderObject<RenderParagraph>(
      find.text('Chờ bạn xác nhận'),
    );
    expect(paragraph.didExceedMaxLines, false);
  });

  testWidgets('unread count is announced once', (tester) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: NotificationCountBadge(
              count: 4,
              child: Icon(Icons.notifications),
            ),
          ),
        ),
      ),
    );
    expect(find.bySemanticsLabel('4 thông báo chưa đọc'), findsOneWidget);
    semantics.dispose();
  });
  Tristate selectedState(WidgetTester tester, String label) {
    SemanticsNode? node = tester.getSemantics(find.text(label));
    while (node != null) {
      final selected = node.getSemanticsData().flagsCollection.isSelected;
      if (selected != Tristate.none) return selected;
      node = node.parent;
    }
    return Tristate.none;
  }

  test('enabled input boundary contrasts with fill and page background', () {
    final input = AppTheme.lightTheme.inputDecorationTheme;
    final border = (input.enabledBorder as OutlineInputBorder).borderSide.color;
    for (final background in [input.fillColor!, AppColors.background]) {
      final a = border.computeLuminance();
      final b = background.computeLuminance();
      expect(
        (a > b ? (a + .05) / (b + .05) : (b + .05) / (a + .05)),
        greaterThanOrEqualTo(3),
      );
    }
  });

  testWidgets('text links retain at least a 48dp touch target', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: Center(
            child: SoopiLink(label: 'Xem tất cả →', onTap: () {}),
          ),
        ),
      ),
    );
    expect(
      tester.getSize(find.byType(SoopiLink)).height,
      greaterThanOrEqualTo(48),
    );
    SharedPreferences.setMockInitialValues({});
    final auth = AuthViewModel(tokenStorage: _Storage());
    await auth.initialize();
    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: auth,
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          home: const LoginScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final forgot = find.widgetWithText(TextButton, 'Quên mật khẩu?');
    expect(tester.getSize(forgot).height, greaterThanOrEqualTo(48));
    await tester.pumpWidget(const SizedBox.shrink());
    auth.dispose();
  });

  for (final size in [
    const Size(320, 900),
    const Size(360, 640),
    const Size(840, 900),
    const Size(1000, 360),
  ]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets(
        'navigation retains selection, layout and branches at $size/$scale',
        (tester) async {
          await tester.binding.setSurfaceSize(size);
          addTearDown(() => tester.binding.setSurfaceSize(null));
          final semantics = tester.ensureSemantics();
          final auth = AuthViewModel(tokenStorage: _Storage());
          final router = GoRouter(
            initialLocation: '/home',
            routes: [
              StatefulShellRoute.indexedStack(
                builder: (context, state, shell) =>
                    MainShell(navigationShell: shell),
                branches: [
                  for (final path in [
                    '/home',
                    '/devices',
                    '/requests',
                    '/notifications',
                    '/profile',
                  ])
                    StatefulShellBranch(
                      routes: [
                        GoRoute(
                          path: path,
                          builder: (context, state) =>
                              Scaffold(body: Text('Page $path')),
                          routes: path == '/home'
                              ? [
                                  GoRoute(
                                    path: 'detail',
                                    builder: (_, _) => const Scaffold(
                                      body: Text('Page /home/detail'),
                                    ),
                                  ),
                                ]
                              : [],
                        ),
                      ],
                    ),
                ],
              ),
            ],
          );
          await tester.pumpWidget(
            ChangeNotifierProvider.value(
              value: auth,
              child: MaterialApp.router(
                theme: AppTheme.lightTheme,
                routerConfig: router,
                builder: (context, child) => MediaQuery(
                  data: MediaQuery.of(
                    context,
                  ).copyWith(textScaler: TextScaler.linear(scale)),
                  child: child!,
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          expect(selectedState(tester, 'Trang chủ'), Tristate.isTrue);
          expect(selectedState(tester, 'Thiết bị'), Tristate.isFalse);
          if (size.width < 600) {
            expect(
              tester.getTopLeft(find.byIcon(Icons.home_rounded)).dy,
              closeTo(
                tester.getTopLeft(find.byIcon(Icons.devices_outlined)).dy,
                .01,
              ),
            );
          }
          expect(
            find.byType(NavigationRail),
            size.width >= 600 ? findsOneWidget : findsNothing,
          );
          await tester.tap(find.text('Thiết bị'));
          await tester.pumpAndSettle();
          expect(find.text('Page /devices'), findsOneWidget);
          expect(selectedState(tester, 'Thiết bị'), Tristate.isTrue);
          expect(selectedState(tester, 'Trang chủ'), Tristate.isFalse);
          await tester.tap(find.text('Trang chủ'));
          await tester.pumpAndSettle();
          router.push<void>('/home/detail');
          await tester.pumpAndSettle();
          await tester.tap(find.text('Trang chủ'));
          await tester.pumpAndSettle();
          expect(find.text('Page /home/detail'), findsOneWidget);
          await tester.tap(find.text('Thiết bị'));
          await tester.pumpAndSettle();
          await tester.tap(find.text('Trang chủ'));
          await tester.pumpAndSettle();
          expect(find.text('Page /home/detail'), findsOneWidget);
          await tester.pumpWidget(const SizedBox.shrink());
          router.dispose();
          auth.dispose();
          semantics.dispose();
        },
      );
    }
  }

  test('all bundled font faces are declared as application assets', () async {
    final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
    for (final family in {
      'Inter': ['Regular', 'Medium'],
      'PlusJakartaSans': ['Regular', 'SemiBold', 'Bold', 'ExtraBold'],
      'JetBrainsMono': ['Regular', 'Medium', 'SemiBold'],
    }.entries) {
      for (final weight in family.value) {
        final path = 'assets/fonts/${family.key}-$weight.ttf';
        expect(manifest.listAssets(), contains(path));
        expect((await rootBundle.load(path)).lengthInBytes, greaterThan(0));
      }
    }
  });
}
