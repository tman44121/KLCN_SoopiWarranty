import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:warrant_safe/models/user_model.dart';
import 'package:warrant_safe/services/api_service.dart';
import 'package:warrant_safe/services/token_storage.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/views/auth/login_screen.dart';
import 'package:warrant_safe/widgets/custom_text_field.dart';

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

class _LoginApi extends MockApiService {
  String? baseUrlAtLogin;

  @override
  Future<AuthResponse> login(String username, String password) async {
    baseUrlAtLogin = (await SharedPreferences.getInstance()).getString(
      'baseUrl',
    );
    const user = UserModel(
      id: 'customer-test',
      fullName: 'Khách kiểm thử',
      username: 'customer-test',
      phone: '',
      role: 'CUSTOMER',
    );
    return const AuthResponse(
      accessToken: 'test-access',
      expiresIn: 900,
      refreshToken: 'test-refresh',
      refreshExpiresIn: 3600,
      user: user,
    );
  }

  @override
  Future<UserModel> getProfile() async => const UserModel(
    id: 'customer-test',
    fullName: 'Khách kiểm thử',
    username: 'customer-test',
    phone: '',
    role: 'CUSTOMER',
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'Debug settings are hidden until long press and saved before login',
    (tester) async {
      SharedPreferences.setMockInitialValues({
        'isMock': false,
        'baseUrl': 'http://10.0.2.2:8080/api/v1',
      });
      final api = _LoginApi();
      final auth = AuthViewModel(tokenStorage: _Storage(), apiService: api);
      await auth.initialize();

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthViewModel>.value(
          value: auth,
          child: const MaterialApp(home: LoginScreen()),
        ),
      );
      final fields = find.byType(TextFormField);
      expect(fields, findsNWidgets(2));
      expect(find.text('Base URL'), findsNothing);
      final usernameField = tester.widget<CustomTextField>(
        find.byType(CustomTextField).first,
      );
      expect(usernameField.label, 'Số điện thoại / Tên đăng nhập *');
      expect(usernameField.hintText, 'Số điện thoại hoặc tên đăng nhập');
      expect(find.text('Quên mật khẩu?'), findsOneWidget);
      await tester.longPress(
        find.byKey(const ValueKey('debug-settings-gesture')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Cấu hình thử nghiệm'), findsOneWidget);
      await tester.enterText(
        find.byType(TextFormField).last,
        'http://10.0.2.2:8081/api/v1',
      );
      tester.testTextInput.hide();
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Áp dụng Base URL'));
      await tester.pumpAndSettle();
      await tester.tapAt(const Offset(10, 10));
      await tester.pumpAndSettle();
      expect(find.text('Base URL'), findsNothing);
      await tester.enterText(fields.at(0), 'customer-test');
      await tester.enterText(fields.at(1), 'fixture-password');

      final loginButton = find.byType(ElevatedButton);
      await tester.ensureVisible(loginButton);
      await tester.tap(loginButton);
      await tester.pumpAndSettle();

      expect(api.baseUrlAtLogin, 'http://10.0.2.2:8081/api/v1');
      expect(auth.baseUrl, 'http://10.0.2.2:8081/api/v1');
      auth.dispose();
    },
  );
}
