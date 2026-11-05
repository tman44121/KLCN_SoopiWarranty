import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:warrant_safe/models/user_model.dart';
import 'package:warrant_safe/services/api_service.dart';
import 'package:warrant_safe/services/token_storage.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/views/auth/register_screen.dart';

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

class _PendingOtpApi extends MockApiService {
  final issued = Completer<EmailOtpIssued>();
  int requests = 0;

  @override
  Future<EmailOtpIssued> requestRegistrationOtp(String email, String phone) {
    requests++;
    return issued.future;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Mock registration uses email without a phone field', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({'isMock': true});
    final auth = AuthViewModel(tokenStorage: _Storage());
    await auth.initialize();
    await tester.pumpWidget(
      ChangeNotifierProvider<AuthViewModel>.value(
        value: auth,
        child: const MaterialApp(home: RegisterScreen()),
      ),
    );

    expect(find.text('Tạo tài khoản'), findsOneWidget);
    expect(find.textContaining('Chế độ minh họa'), findsOneWidget);
    expect(find.text('SỐ ĐIỆN THOẠI'), findsNothing);
    expect(find.byType(TextFormField), findsNWidgets(2));

    await tester.enterText(find.byType(TextFormField).first, 'Khách thử');
    await tester.enterText(find.byType(TextFormField).last, 'demo@example.com');
    await tester.tap(find.text('TIẾP TỤC'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Password1!');
    await tester.enterText(find.byType(TextFormField).last, 'Password1!');
    await tester.tap(find.byType(Checkbox));
    await tester.ensureVisible(find.text('TẠO TÀI KHOẢN'));
    await tester.tap(find.text('TẠO TÀI KHOẢN'));
    await tester.pumpAndSettle();

    expect(auth.isAuthenticated, true);
    expect(auth.currentUser?.email, 'demo@example.com');
    expect(auth.currentUser?.phone, isEmpty);
    auth.dispose();
  });

  testWidgets(
    'Real registration matches email OTP contract and blocks empty input',
    (tester) async {
      SharedPreferences.setMockInitialValues({
        'isMock': false,
        'baseUrl': 'http://10.0.2.2:8081/api/v1',
      });
      final auth = AuthViewModel(tokenStorage: _Storage());
      await auth.initialize();
      await tester.pumpWidget(
        ChangeNotifierProvider<AuthViewModel>.value(
          value: auth,
          child: const MaterialApp(home: RegisterScreen()),
        ),
      );

      expect(find.text('Tạo tài khoản mới'), findsOneWidget);
      expect(find.textContaining('không qua SMS'), findsOneWidget);
      expect(find.byType(TextFormField), findsNWidgets(6));
      await tester.ensureVisible(
        find.byKey(const ValueKey('send-registration-otp')),
      );
      await tester.tap(find.byKey(const ValueKey('send-registration-otp')));
      await tester.pump();
      expect(find.text('Vui lòng nhập số điện thoại.'), findsWidgets);
      expect(find.text('Vui lòng nhập email để nhận mã OTP.'), findsWidgets);
      await tester.ensureVisible(
        find.byKey(const ValueKey('submit-registration')),
      );
      await tester.tap(find.byKey(const ValueKey('submit-registration')));
      await tester.pump();
      expect(auth.isAuthenticated, false);
      auth.dispose();
    },
  );

  testWidgets(
    'Changing email during OTP request never binds code to new email',
    (tester) async {
      SharedPreferences.setMockInitialValues({'isMock': false});
      final api = _PendingOtpApi();
      final auth = AuthViewModel(tokenStorage: _Storage(), apiService: api);
      await auth.initialize();
      await tester.pumpWidget(
        ChangeNotifierProvider<AuthViewModel>.value(
          value: auth,
          child: const MaterialApp(home: RegisterScreen()),
        ),
      );
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(1), '0900000000');
      await tester.enterText(fields.at(2), 'first@example.test');
      await tester.ensureVisible(
        find.byKey(const ValueKey('send-registration-otp')),
      );
      await tester.tap(find.byKey(const ValueKey('send-registration-otp')));
      await tester.pump();
      expect(api.requests, 1);

      await tester.enterText(fields.at(2), 'second@example.test');
      api.issued.complete(
        const EmailOtpIssued(expiresIn: 300, resendAfter: 60),
      );
      await tester.pump();
      expect(
        find.textContaining('Email đã thay đổi khi gửi mã'),
        findsOneWidget,
      );
      expect(api.requests, 1);
      auth.dispose();
    },
  );
}
