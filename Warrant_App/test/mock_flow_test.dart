import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:warrant_safe/data/mock_data.dart';
import 'package:warrant_safe/models/user_model.dart';
import 'package:warrant_safe/router/app_router.dart';
import 'package:warrant_safe/services/i_api_service.dart';
import 'package:warrant_safe/services/token_storage.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/views/devices/device_detail_screen.dart';

class _MemoryTokenStorage implements TokenStorage {
  @override
  Future<void> saveSession({
    required String token,
    String? refreshToken,
    required String userId,
    bool isMock = false,
  }) async {}

  @override
  Future<Map<String, String?>> readSession({bool isMock = false}) async => {};

  @override
  Future<void> clearSession({bool isMock = false}) async {}
}

class _FastMockApi extends IApiService {
  static const user = UserModel(
    id: 'demo',
    fullName: 'Khách Mock',
    username: 'demo',
    phone: '0000000000',
    role: 'CUSTOMER',
  );

  @override
  Future<AuthResponse> login(String username, String password) async =>
      const AuthResponse(
        accessToken: 'demo',
        expiresIn: 3600,
        refreshToken: 'demo',
        refreshExpiresIn: 3600,
        user: user,
      );

  @override
  Future<UserModel> getProfile() async => user;

  @override
  Future<List<OwnedDevice>> getMyDevices() async => [];

  @override
  Future<AuthResponse> refresh(String refreshToken) => login('', '');

  @override
  Future<void> logout(String? refreshToken) async {}

  @override
  Future<AuthResponse> register({
    required String fullName,
    required String phone,
    required String email,
    required String password,
  }) => login('', '');

  @override
  void setAuthToken(String token) {}

  @override
  void clearAuthToken() {}
}

MockRequest _request(String id) => MockRequest(
  id: id,
  deviceName: 'Thiết bị mẫu',
  deviceCategory: 'phone',
  problemDescription: 'Lỗi mẫu',
  status: RequestStatus.converted,
  submittedAt: DateTime(2026, 10, 1),
  ticketId: 'REP-TEST',
  ticketStatus: TicketStatus.awaitingCustomerConfirmation,
);

MockQuotation _quotation({required bool hasComponent}) => MockQuotation(
  id: 'QTE-TEST',
  ticketId: 'REP-TEST',
  internalStatus: InternalQuoteStatus.approved,
  customerStatus: CustomerQuoteStatus.pending,
  items: [
    MockQuoteItem(
      id: 'line',
      name: 'Hạng mục mẫu',
      isComponent: hasComponent,
      quantity: 1,
      unitPrice: 1,
      total: 1,
    ),
  ],
  totalAmount: 1,
);

void main() {
  test('yêu cầu Mock có mã riêng và nằm trong danh sách dùng chung', () {
    final original = List<MockRequest>.of(mockRequests);
    addTearDown(() {
      mockRequests
        ..clear()
        ..addAll(original);
      notifyMockDataChanged();
    });

    MockRequest submit() => submitMockRequest(
      deviceName: 'Máy mẫu',
      deviceCategory: 'phone',
      problemDescription: 'Không lên màn hình',
      customerName: 'Khách mẫu',
      phone: '0000000000',
      identifierType: 'IMEI',
      serialOrImei: '123456789012345',
      preferredStation: 'HCM',
      submittedAt: DateTime(2026, 10, 14),
    );

    final first = submit();
    final second = submit();
    expect(first.id, startsWith('WRQ-DEMO-'));
    expect(second.id, isNot(first.id));
    expect(mockRequests.take(2), [same(second), same(first)]);
    expect(first.status, RequestStatus.pendingIntake);
    expect(first.ticketId, isNull);
    expect(first.serialOrImei, '123456789012345');
  });

  test('đồng ý báo giá có linh kiện mới chuyển chờ linh kiện', () {
    final requests = [_request('WRQ-TEST')];
    final quotations = [_quotation(hasComponent: true)];
    final status = decideMockQuotation(
      'WRQ-TEST',
      CustomerQuoteStatus.accepted,
      requests: requests,
      quotations: quotations,
    );
    expect(status, TicketStatus.awaitingParts);
    expect(requests.single.ticketStatus, TicketStatus.awaitingParts);
    expect(quotations.single.customerStatus, CustomerQuoteStatus.accepted);
    expect(requests.single.status, RequestStatus.converted);
  });

  test('báo giá chỉ có công sửa chuyển thẳng sang sửa chữa', () {
    final requests = [_request('WRQ-TEST')];
    final quotations = [_quotation(hasComponent: false)];
    expect(
      decideMockQuotation(
        'WRQ-TEST',
        CustomerQuoteStatus.accepted,
        requests: requests,
        quotations: quotations,
      ),
      TicketStatus.repairing,
    );
  });

  test('từ chối chờ trả máy và không đánh dấu đã trả', () {
    final requests = [_request('WRQ-TEST')];
    final quotations = [_quotation(hasComponent: true)];
    expect(
      decideMockQuotation(
        'WRQ-TEST',
        CustomerQuoteStatus.declined,
        reason: 'Không đồng ý chi phí',
        requests: requests,
        quotations: quotations,
      ),
      TicketStatus.awaitingReturn,
    );
    expect(requests.single.ticketStatus, TicketStatus.awaitingReturn);
    expect(quotations.single.customerStatus, CustomerQuoteStatus.declined);
    expect(quotations.single.customerRejectionReason, 'Không đồng ý chi phí');
    expect(
      () => decideMockQuotation(
        'WRQ-TEST',
        CustomerQuoteStatus.accepted,
        requests: requests,
        quotations: quotations,
      ),
      throwsStateError,
    );
  });

  testWidgets('tra cứu Mock mở route chi tiết với đúng object', (tester) async {
    SharedPreferences.setMockInitialValues({'isMock': true});
    final vm = AuthViewModel(
      tokenStorage: _MemoryTokenStorage(),
      apiService: _FastMockApi(),
    );
    await vm.initialize();
    await vm.loginUser('demo', 'demo');
    final appRouter = AppRouter(vm);
    addTearDown(() {
      appRouter.router.dispose();
      vm.dispose();
    });

    await tester.pumpWidget(
      ChangeNotifierProvider<AuthViewModel>.value(
        value: vm,
        child: MaterialApp.router(routerConfig: appRouter.router),
      ),
    );
    appRouter.router.go(AppRoutes.lookup);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextFormField).first,
      mockDevices.first.identifierValue,
    );
    await tester.tap(find.text('TRA CỨU'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xem chi tiết thiết bị'));
    await tester.pumpAndSettle();

    final detail = tester.widget<DeviceDetailScreen>(
      find.byType(DeviceDetailScreen),
    );
    expect(identical(detail.deviceObj, mockDevices.first), isTrue);
  });
}
