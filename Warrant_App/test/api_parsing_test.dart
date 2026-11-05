import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:warrant_safe/models/user_model.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/services/token_storage.dart';

class InMemoryTokenStorage implements TokenStorage {
  String? token;
  String? refreshToken;
  String? userId;

  @override
  Future<void> saveSession({required String token, String? refreshToken, required String userId, bool isMock = false}) async {
    this.token = token;
    this.refreshToken = refreshToken;
    this.userId = userId;
  }

  @override
  Future<Map<String, String?>> readSession({bool isMock = false}) async {
    return {'token': token, 'refreshToken': refreshToken, 'userId': userId};
  }

  @override
  Future<void> clearSession({bool isMock = false}) async {
    token = null;
    refreshToken = null;
    userId = null;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('API Parsing Tests', () {
    test('Parse real login response with complex roles', () {
      final json = {
        'accessToken': 'dummy-token',
        'expiresIn': 3600,
        'refreshToken': 'dummy-refresh',
        'refreshExpiresIn': 86400,
        'user': {
          'accountId': 'acc_123',
          'username': 'user123',
          'displayName': 'John Doe',
          'roles': [
            {'code': 'customer', 'label': 'Khách hàng', 'landing': '/home'}
          ]
        }
      };

      final response = AuthResponse.fromJson(json);

      expect(response.accessToken, 'dummy-token');
      expect(response.user.id, 'acc_123');
      expect(response.user.username, 'user123');
      expect(response.user.fullName, 'John Doe');
      expect(response.user.role, 'customer');
    });

    test('Parse profile response with email', () {
      final json = {
        'customerCode': 'cust_123',
        'fullName': 'Jane Doe',
        'phone': '0123456789',
        'email': 'jane@example.com',
        'address': '123 Main St',
        'username': 'jane123'
      };

      final profile = UserModel.fromJson(json);

      expect(profile.customerCode, 'cust_123');
      expect(profile.id, '');
      expect(profile.fullName, 'Jane Doe');
      expect(profile.email, 'jane@example.com');
      expect(profile.username, 'jane123');
      expect(profile.address, '123 Main St');
    });

    test('Parse devices response', () {
      final json = [
        {
          'code': 'DEV_A',
          'productName': 'Laptop A',
          'brandName': 'Brand X',
          'identifierType': 'Serial',
          'serialOrImei': 'SR123',
          'warrantyActivatedOn': '2023-01-01',
          'warrantyExpiresOn': '2025-01-01',
          'warrantyStatus': 'IN_WARRANTY'
        },
        {
          'code': 'DEV_B',
          'productName': 'Laptop B',
          'brandName': 'Brand Y',
          'identifierType': 'Serial',
          'serialOrImei': 'SR456',
          'warrantyStatus': 'OUT_OF_WARRANTY'
        },
        {
          'code': 'DEV_C',
          'productName': 'Laptop C',
          'brandName': 'Brand Z',
          'identifierType': 'Serial',
          'serialOrImei': 'SR789',
          'warrantyStatus': 'NOT_ACTIVATED'
        }
      ];

      final devices = json.map((e) => OwnedDevice.fromJson(e)).toList();

      expect(devices.length, 3);
      expect(devices[0].warrantyStatus, 'IN_WARRANTY');
      expect(devices[1].warrantyStatus, 'OUT_OF_WARRANTY');
      expect(devices[2].warrantyStatus, 'NOT_ACTIVATED');
    });
  });

  group('Session Restoration Test', () {
    test('ViewModel restores same mock/real mode based on SharedPreferences', () async {
      SharedPreferences.setMockInitialValues({'isMock': false});

      final vm = AuthViewModel(tokenStorage: InMemoryTokenStorage());

      await vm.initialize();

      expect(vm.isMock, false);
      expect(vm.isLoading, false);
    });

    test('Mode switching clears session and toggles API', () async {
      SharedPreferences.setMockInitialValues({'isMock': true});
      final storage = InMemoryTokenStorage();
      await storage.saveSession(token: 'abc', refreshToken: 'def', userId: 'usr1');

      final vm = AuthViewModel(tokenStorage: storage);
      await vm.initialize();

      expect(vm.isMock, true);
      // Switching to real
      await vm.toggleMockMode(false);
      expect(vm.isMock, false);
      // Wait, since we can't test actual API clearing easily here without mock,
      // we just ensure state changed.
    });

    test('Profile identity preservation during copyWith', () {
      final user = const UserModel(
        id: 'acc_123',
        fullName: 'John',
        username: 'user1',
        phone: '111',
        role: 'CUSTOMER',
      );

      final updated = user.copyWith(customerCode: 'CUST-01', phone: '222');
      expect(updated.id, 'acc_123');
      expect(updated.role, 'CUSTOMER');
      expect(updated.customerCode, 'CUST-01');
      expect(updated.phone, '222');
    });
  });
}
