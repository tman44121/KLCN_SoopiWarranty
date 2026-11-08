import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:warrant_safe/models/portal_request_models.dart';
import 'package:warrant_safe/theme/app_theme.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/views/auth/real_register_screen.dart';
import 'package:warrant_safe/views/notifications/notification_screen.dart';
import 'package:warrant_safe/views/profile/profile_screen.dart';
import 'package:warrant_safe/widgets/app_bar_widget.dart';
import 'package:warrant_safe/widgets/custom_text_field.dart';
import 'package:warrant_safe/widgets/real_request_card.dart';

void main() {
  testWidgets(
    'filled inputs retain their accessible name and required guidance',
    (tester) async {
      final semantics = tester.ensureSemantics();
      final controller = TextEditingController(text: 'fixture@example.com');
      addTearDown(controller.dispose);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomTextField(
              label: 'Email *',
              hintText: 'Nhập email',
              controller: controller,
            ),
          ),
        ),
      );
      final data = tester
          .getSemantics(find.byType(TextField))
          .getSemanticsData();
      semantics.dispose();
      expect(data.label, contains('Email'));
      expect(data.label, contains('bắt buộc'));
      expect(data.value, 'fixture@example.com');
    },
  );

  test('input hints meet minimum text contrast on their actual fill', () {
    final input = AppTheme.lightTheme.inputDecorationTheme;
    final background = input.fillColor!;
    final foreground = Color.alphaBlend(input.hintStyle!.color!, background);
    final a = foreground.computeLuminance();
    final b = background.computeLuminance();
    final contrast = (a > b ? (a + .05) / (b + .05) : (b + .05) / (a + .05));
    expect(contrast, greaterThanOrEqualTo(4.5));
  });

  testWidgets(
    'app-bar actions can be reached and activated with the keyboard',
    (tester) async {
      var notifications = 0;
      var backs = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                WarrantSafeAppBar(onNotificationTap: () => notifications++),
                WarrantSafeTitleRow(
                  title: 'Chi tiết',
                  onBackTap: () => backs++,
                ),
              ],
            ),
          ),
        ),
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      expect(notifications, 1);
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      expect(backs, 1);
      expect(find.byTooltip('Mở thông báo'), findsOneWidget);
      expect(find.byTooltip('Quay lại'), findsOneWidget);
    },
  );

  testWidgets('request cards open with the keyboard', (tester) async {
    var opens = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RealRequestCard(
            request: const PortalRequestSummary(
              code: 'YC-TEST',
              status: 'PENDING_INTAKE',
            ),
            onTap: () => opens++,
          ),
        ),
      ),
    );
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();
    expect(opens, 1);
  });

  testWidgets('profile does not claim an unreported verification state', (
    tester,
  ) async {
    final auth = AuthViewModel();
    addTearDown(auth.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: auth,
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          home: const ProfileScreen(),
        ),
      ),
    );
    expect(find.text('Khách hàng đã xác minh'), findsNothing);
    expect(find.text('Tài khoản Soopi'), findsOneWidget);
  });

  for (final width in [320.0, 375.0, 768.0, 1440.0]) {
    for (final scale in [1.5, 2.0]) {
      for (final register in [true, false]) {
        testWidgets(
          '${register ? 'registration' : 'notifications'} fits ${width}px at scale $scale',
          (tester) async {
            await tester.binding.setSurfaceSize(Size(width, 900));
            addTearDown(() => tester.binding.setSurfaceSize(null));
            final auth = AuthViewModel();
            addTearDown(auth.dispose);
            await tester.pumpWidget(
              ChangeNotifierProvider.value(
                value: auth,
                child: MaterialApp(
                  theme: AppTheme.lightTheme,
                  builder: (context, child) => MediaQuery(
                    data: MediaQuery.of(
                      context,
                    ).copyWith(textScaler: TextScaler.linear(scale)),
                    child: child!,
                  ),
                  home: register
                      ? const RealRegisterScreen()
                      : const NotificationScreen(),
                ),
              ),
            );
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);
          },
        );
      }
    }
  }
}
