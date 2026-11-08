import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:warrant_safe/models/portal_request_models.dart';
import 'package:warrant_safe/models/portal_ticket_models.dart';
import 'package:warrant_safe/models/portal_lookup_models.dart';
import 'package:warrant_safe/models/portal_notification_models.dart';
import 'package:warrant_safe/models/user_model.dart';
import 'package:warrant_safe/router/app_router.dart';
import 'package:warrant_safe/services/i_api_service.dart';
import 'package:warrant_safe/services/real_api_service.dart';
import 'package:warrant_safe/services/token_storage.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/viewmodels/request_viewmodel.dart';
import 'package:warrant_safe/viewmodels/ticket_viewmodel.dart';
import 'package:warrant_safe/views/requests/real_request_detail_screen.dart';
import 'package:warrant_safe/views/requests/real_ticket_detail_screen.dart';
import 'package:warrant_safe/views/requests/request_list_screen.dart';

final _request = PortalRequestDetail.fromJson({
  'code': 'YC-1',
  'status': 'PENDING_INTAKE',
  'createdAt': '2026-10-28T09:00:00+07:00',
  'brandModel': 'Máy mẫu',
  'serialOrImei': 'SERIAL-1',
  'categoryCode': 'LAPTOP_TABLET',
  'deviceTypeCode': 'LAPTOP',
  'preferredStation': 'HCM',
  'preferredFrom': '2026-10-29T09:00:00+07:00',
  'preferredTo': '2026-10-29T10:00:00+07:00',
  'ticketCode': null,
});

final _ticketSummaryJson = <String, dynamic>{
  'code': 'TN-OLD',
  'productName': 'Máy mẫu',
  'serialOrImei': 'SERIAL-1',
  'receivedAt': '2026-09-07T13:45:00+07:00',
  'status': 'DELIVERED',
  'stopped': false,
  'currentStep': 6,
  'rating': null,
};

Map<String, dynamic> _ticketJson({bool pendingQuote = false}) => {
  'code': 'TN-OLD',
  'productName': 'Máy mẫu',
  'brandName': 'Hãng mẫu',
  'serialOrImei': 'SERIAL-1',
  'receivedAt': '2026-09-07T13:45:00+07:00',
  'promisedReturnAt': null,
  'status': pendingQuote ? 'AWAITING_CUSTOMER_CONFIRMATION' : 'DELIVERED',
  'stopped': false,
  'steps': [
    {'key': 'RECEIVED', 'label': 'Tiếp nhận', 'state': 'DONE'},
    {'key': 'DIAGNOSIS', 'label': 'Chẩn đoán', 'state': 'CURRENT'},
    {'key': 'AWAITING_PARTS', 'label': 'Chờ linh kiện', 'state': 'UPCOMING'},
  ],
  'customerNotes': [
    {'at': '2026-09-07T14:00:00+07:00', 'text': 'Đã kiểm tra'},
  ],
  'costs': {
    'inWarrantyAmount': 0,
    'outOfWarrantyParts': 0,
    'serviceFee': 0,
    'vat': 0,
    'total': 0,
    'paymentStatus': 'UNPAID',
  },
  'pendingQuotation': pendingQuote
      ? {
          'code': 'BG-1',
          'validUntil': '2026-10-20',
          'vatRate': 10,
          'lines': [
            {
              'lineNo': 1,
              'description': 'Linh kiện mẫu',
              'quantity': 2,
              'unitPrice': 100000,
              'laborFee': 50000,
              'lineTotal': 250000,
            },
          ],
          'partsTotal': 200000,
          'laborTotal': 50000,
          'grandTotal': 275000,
        }
      : null,
  'handedOverAt': null,
  'rating': null,
  'canRate': !pendingQuote,
};

class _Adapter implements HttpClientAdapter {
  final paths = <String>[];
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    paths.add(options.uri.path);
    expect(options.method, 'GET');
    expect(options.headers['Authorization'], 'Bearer fixture-token');
    final body = options.uri.path.endsWith('/my/tickets')
        ? [_ticketSummaryJson]
        : _ticketJson();
    return ResponseBody.fromString(
      jsonEncode(body),
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

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

class _FakeApi extends IApiService {
  @override
  Future<PortalNotificationInbox> getNotifications() async =>
      const PortalNotificationInbox([], 0);

  @override
  Future<void> markNotificationRead(String id) async {}
  bool failTicketsOnce = false;
  Object? requestError;
  Object? ticketError;
  PortalRequestDetail request = _request;
  String? lastTicketCode;
  List<PortalTicketSummary> tickets = [];
  PortalTicketDetail detail = PortalTicketDetail.fromJson(_ticketJson());
  String? lastDecision;
  String? lastReason;

  @override
  Future<AuthResponse> login(String username, String password) async =>
      const AuthResponse(
        accessToken: 'fixture-token',
        expiresIn: 60,
        refreshToken: null,
        refreshExpiresIn: null,
        user: UserModel(
          id: 'KH-1',
          fullName: 'Khách mẫu',
          username: 'customer',
          phone: '',
          role: 'CUSTOMER',
        ),
      );
  @override
  Future<UserModel> getProfile() async => (await login('', '')).user;
  @override
  Future<List<OwnedDevice>> getMyDevices() async => [];
  @override
  Future<PortalCatalog> getPortalCatalog() async =>
      throw UnsupportedError('Not used by tracking tests.');
  @override
  Future<List<PortalRequestSummary>> getMyWarrantyRequests() async => [
    _request,
  ];
  @override
  Future<PortalRequestDetail> getMyWarrantyRequest(String code) async {
    if (requestError != null) throw requestError!;
    return request;
  }

  @override
  Future<String> submitMyWarrantyRequest(OwnWarrantyRequestData data) async =>
      throw UnsupportedError('Tracking tests never submit a request.');
  @override
  Future<List<PortalTicketSummary>> getMyTickets() async {
    if (failTicketsOnce) {
      failTicketsOnce = false;
      throw const NetworkException();
    }
    return tickets;
  }

  @override
  Future<PortalTicketDetail> getPortalTicket(String code) async {
    lastTicketCode = code;
    if (ticketError != null) throw ticketError!;
    return detail;
  }

  @override
  Future<PortalLookupRecord> lookupPortal(String code, String phone) async =>
      PortalLookupRecord.request(request);

  @override
  Future<PortalTicketDetail> decidePortalQuotation(
    String ticketCode,
    String decision, {
    String? reason,
  }) async {
    lastDecision = decision;
    lastReason = reason;
    final response = _ticketJson();
    response['status'] = decision == 'DECLINE'
        ? 'AWAITING_RETURN'
        : 'REPAIRING';
    response['stopped'] = decision == 'DECLINE';
    detail = PortalTicketDetail.fromJson(response);
    return detail;
  }

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

Future<AuthViewModel> _auth(_FakeApi api) async {
  SharedPreferences.setMockInitialValues({'isMock': false});
  final auth = AuthViewModel(apiService: api, tokenStorage: _MemoryStorage());
  await auth.initialize();
  expect(await auth.loginUser('customer', ''), isTrue);
  return auth;
}

void main() {
  testWidgets('history detail buttons stay below the intake time', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(700, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final api = _FakeApi()
      ..tickets = [
        PortalTicketSummary.fromJson({
          ..._ticketSummaryJson,
          'code': 'TN-PROCESSING',
          'status': 'REPAIRING',
        }),
        PortalTicketSummary.fromJson({
          ..._ticketSummaryJson,
          'code': 'TN-WAITING',
          'status': 'AWAITING_PARTS',
        }),
      ];
    final auth = await _auth(api);
    final requests = RequestViewModel(auth);
    final tickets = TicketViewModel(auth);
    addTearDown(() {
      requests.dispose();
      tickets.dispose();
      auth.dispose();
    });
    await Future.wait([requests.refresh(), tickets.refresh()]);
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: auth),
          ChangeNotifierProvider.value(value: requests),
          ChangeNotifierProvider.value(value: tickets),
        ],
        child: const MaterialApp(home: RequestListScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Chờ linh kiện / xác nhận (1)'), findsOneWidget);
    expect(find.text('Đang xử lý (1)'), findsOneWidget);
    expect(find.text('Mã phiếu TN-PROCESSING'), findsOneWidget);
    expect(find.text('Mã phiếu TN-WAITING'), findsOneWidget);
    final dates = find.textContaining('Tiếp nhận lúc');
    final buttons = find.text('Xem chi tiết');
    expect(dates, findsNWidgets(2));
    expect(buttons, findsNWidgets(2));
    for (var i = 0; i < 2; i++) {
      expect(
        tester.getTopLeft(buttons.at(i)).dy,
        greaterThan(tester.getBottomLeft(dates.at(i)).dy),
      );
    }
    expect(tester.takeException(), isNull);
  });

  for (final scale in [1.5, 2.0]) {
    testWidgets('history fits a 320px viewport at text scale $scale', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(320, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final api = _FakeApi()
        ..tickets = [
          PortalTicketSummary.fromJson({..._ticketSummaryJson, 'paidAmount': 250000}),
          PortalTicketSummary.fromJson({..._ticketSummaryJson, 'code': 'TN-SECOND', 'paidAmount': 150000}),
        ];
      final auth = await _auth(api);
      final requests = RequestViewModel(auth);
      final tickets = TicketViewModel(auth);
      addTearDown(() {
        requests.dispose();
        tickets.dispose();
        auth.dispose();
      });
      await Future.wait([requests.refresh(), tickets.refresh()]);
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider.value(value: requests),
            ChangeNotifierProvider.value(value: tickets),
          ],
          child: MaterialApp(
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(scale)),
              child: child!,
            ),
            home: const RequestListScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Tổng tiền đã chi: 400.000 đ'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets(
    'large history stays usable from the first ticket to the request section',
    (tester) async {
      final api = _FakeApi()
        ..tickets = List.generate(
          1000,
          (i) => PortalTicketSummary.fromJson({
            ..._ticketSummaryJson,
            'code': 'TN-$i',
            'receivedAt': DateTime(
              2026,
              10,
              30,
            ).subtract(Duration(minutes: i)).toIso8601String(),
          }),
        );
      final auth = await _auth(api);
      final requests = RequestViewModel(auth);
      final tickets = TicketViewModel(auth);
      addTearDown(() {
        requests.dispose();
        tickets.dispose();
        auth.dispose();
      });
      await Future.wait([requests.refresh(), tickets.refresh()]);
      final stopwatch = Stopwatch()..start();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider.value(value: requests),
            ChangeNotifierProvider.value(value: tickets),
          ],
          child: const MaterialApp(home: RequestListScreen()),
        ),
      );
      await tester.pumpAndSettle();
      stopwatch.stop();
      debugPrint(
        'HISTORY_1000_FIRST_FRAME_MS ${stopwatch.elapsedMilliseconds}',
      );
      expect(find.text('Mã phiếu TN-0'), findsOneWidget);
      final scroll = tester
          .stateList<ScrollableState>(find.byType(Scrollable))
          .firstWhere((s) => s.axisDirection == AxisDirection.down);
      for (var i = 0; i < 5; i++) {
        scroll.position.jumpTo(scroll.position.maxScrollExtent);
        await tester.pumpAndSettle();
      }
      expect(find.text('Mã yêu cầu YC-1'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  test(
    'ticket DTO preserves separate status, steps, costs and pending quote',
    () {
      final summary = PortalTicketSummary.fromJson(_ticketSummaryJson);
      expect(summary.code, 'TN-OLD');
      expect(summary.status, 'DELIVERED');
      expect(summary.currentStep, 6);
      final ticket = PortalTicketDetail.fromJson(
        _ticketJson(pendingQuote: true),
      );
      expect(ticket.status, 'AWAITING_CUSTOMER_CONFIRMATION');
      expect(ticket.steps.map((step) => step.state), [
        'DONE',
        'CURRENT',
        'UPCOMING',
      ]);
      expect(ticket.costs.total, 0);
      expect(ticket.pendingQuotation!.grandTotal, 275000);
      expect(ticket.pendingQuotation!.lines.single.quantity, 2);
      expect(
        PortalTicketDetail.fromJson(_ticketJson()).pendingQuotation,
        isNull,
      );
      expect(_request.ticketCode, isNull);
    },
  );

  test('Real ticket GETs use exact paths and Bearer auth', () async {
    final adapter = _Adapter();
    final api = RealApiService(
      baseUrl: 'http://127.0.0.1:8080/api/v1',
      adapter: adapter,
    )..setAuthToken('fixture-token');
    expect((await api.getMyTickets()).single.code, 'TN-OLD');
    expect((await api.getPortalTicket('TN-OLD')).code, 'TN-OLD');
    expect(adapter.paths, [
      '/api/v1/portal/my/tickets',
      '/api/v1/portal/tickets/TN-OLD',
    ]);
  });

  testWidgets('pending request has no ticket link; separate old ticket list', (
    tester,
  ) async {
    final api = _FakeApi()
      ..tickets = [PortalTicketSummary.fromJson(_ticketSummaryJson)];
    final auth = await _auth(api);
    final requests = RequestViewModel(auth);
    final tickets = TicketViewModel(auth);
    addTearDown(() {
      tickets.dispose();
      requests.dispose();
      auth.dispose();
    });
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthViewModel>.value(value: auth),
          ChangeNotifierProvider<RequestViewModel>.value(value: requests),
          ChangeNotifierProvider<TicketViewModel>.value(value: tickets),
        ],
        child: const MaterialApp(home: RequestListScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Mã phiếu TN-OLD'), findsOneWidget);
    expect(find.text('Đã bàn giao'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Mã yêu cầu YC-1'), 200);
    expect(find.text('Mã yêu cầu YC-1'), findsOneWidget);

    await tester.pumpWidget(
      ChangeNotifierProvider<AuthViewModel>.value(
        value: auth,
        child: const MaterialApp(home: RealRequestDetailScreen(code: 'YC-1')),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Gửi lúc:'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Mã nhóm thiết bị: LAPTOP_TABLET'),
      200,
    );
    expect(find.text('Mã nhóm thiết bị: LAPTOP_TABLET'), findsOneWidget);
    expect(find.text('Mã loại thiết bị: LAPTOP'), findsOneWidget);
    expect(find.text('Mã trạm mong muốn: HCM'), findsOneWidget);
    expect(
      find.textContaining('Thời gian mong muốn mang máy tới (chưa xác nhận):'),
      findsOneWidget,
    );
    await tester.scrollUntilVisible(
      find.textContaining('chưa có phiếu tiếp nhận'),
      200,
    );
    expect(find.textContaining('chưa có phiếu tiếp nhận'), findsOneWidget);
    expect(find.text('Xem tiến độ phiếu'), findsNothing);
  });

  testWidgets('ticket empty and retry states are truthful', (tester) async {
    final api = _FakeApi()..failTicketsOnce = true;
    final auth = await _auth(api);
    final requests = RequestViewModel(auth);
    final tickets = TicketViewModel(auth);
    addTearDown(() {
      tickets.dispose();
      requests.dispose();
      auth.dispose();
    });
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthViewModel>.value(value: auth),
          ChangeNotifierProvider<RequestViewModel>.value(value: requests),
          ChangeNotifierProvider<TicketViewModel>.value(value: tickets),
        ],
        child: const MaterialApp(home: RequestListScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Không tải được danh sách phiếu'),
      findsOneWidget,
    );
    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(find.text('Tài khoản chưa có phiếu tiếp nhận nào.'), findsOneWidget);
  });

  testWidgets('linked request opens only its backend ticket code', (
    tester,
  ) async {
    final api = _FakeApi()
      ..request = PortalRequestDetail.fromJson({
        'code': 'YC-LINK',
        'status': 'CONVERTED',
        'ticketCode': 'TN-LINK',
      });
    final auth = await _auth(api);
    final requests = RequestViewModel(auth);
    final tickets = TicketViewModel(auth);
    final router = AppRouter(auth).router;
    addTearDown(() {
      router.dispose();
      tickets.dispose();
      requests.dispose();
      auth.dispose();
    });
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthViewModel>.value(value: auth),
          ChangeNotifierProvider<RequestViewModel>.value(value: requests),
          ChangeNotifierProvider<TicketViewModel>.value(value: tickets),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    router.go('/requests/YC-LINK');
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Xem tiến độ phiếu'),
      300,
      scrollable: find
          .descendant(
            of: find.byType(RealRequestDetailScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.tap(find.text('Xem tiến độ phiếu'));
    await tester.pumpAndSettle();
    expect(api.lastTicketCode, 'TN-LINK');
    expect(find.text('Phiếu tiếp nhận'), findsOneWidget);
  });

  testWidgets('approved pending quotation fixture displays decision actions', (
    tester,
  ) async {
    final api = _FakeApi()
      ..detail = PortalTicketDetail.fromJson(_ticketJson(pendingQuote: true));
    final auth = await _auth(api);
    addTearDown(auth.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider<AuthViewModel>.value(
        value: auth,
        child: const MaterialApp(home: RealTicketDetailScreen(code: 'TN-OLD')),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Hiện tại · Chẩn đoán'), 300);
    expect(find.text('Hiện tại · Chẩn đoán'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Báo giá chờ khách quyết định'),
      300,
    );
    expect(find.text('Báo giá chờ khách quyết định'), findsOneWidget);
    expect(find.text('VAT (10%): 25000 VNĐ'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Tổng báo giá: 275000 VNĐ'), 300);
    expect(find.text('Tổng báo giá: 275000 VNĐ'), findsOneWidget);
    expect(find.text('ĐỒNG Ý'), findsNothing);
    expect(find.text('TỪ CHỐI'), findsNothing);
  });

  testWidgets('completed unpaid ticket shows VietQR from the server', (
    tester,
  ) async {
    final data = _ticketJson()..['status'] = 'COMPLETED';
    (data['costs'] as Map<String, dynamic>)
      ..['total'] = 275000
      ..['paymentQr'] = {
        'imageUrl':
            'https://img.vietqr.io/image/MB-0961575900-compact2.png?amount=275000&addInfo=SOOPI%20TNOLD',
        'bankId': 'MB',
        'accountNo': '0961575900',
        'accountName': null,
        'amount': 275000,
        'transferNote': 'SOOPI TNOLD',
      };
    final api = _FakeApi()..detail = PortalTicketDetail.fromJson(data);
    final auth = await _auth(api);
    addTearDown(auth.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider<AuthViewModel>.value(
        value: auth,
        child: const MaterialApp(home: RealTicketDetailScreen(code: 'TN-OLD')),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('SOOPI TNOLD'), 300);
    expect(find.text('Chuyển khoản VietQR'), findsOneWidget);
    expect(find.text('0961575900'), findsOneWidget);
    final image = tester.widget<Image>(find.byType(Image).last);
    expect(
      (image.image as NetworkImage).url,
      contains('amount=275000&addInfo=SOOPI%20TNOLD'),
    );
  });

  testWidgets('stopped ticket does not show an active repair step', (
    tester,
  ) async {
    final data = _ticketJson()
      ..['status'] = 'AWAITING_RETURN'
      ..['stopped'] = true;
    final api = _FakeApi()..detail = PortalTicketDetail.fromJson(data);
    final auth = await _auth(api);
    addTearDown(auth.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider<AuthViewModel>.value(
        value: auth,
        child: const MaterialApp(home: RealTicketDetailScreen(code: 'TN-OLD')),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text(
        'Phiếu đã dừng xử lý; hiện không có bước sửa chữa đang thực hiện.',
      ),
      300,
    );
    expect(find.text('Hiện tại · Chẩn đoán'), findsNothing);
  });

  testWidgets('customer decline requires reason and confirmation', (
    tester,
  ) async {
    final api = _FakeApi()
      ..detail = PortalTicketDetail.fromJson(_ticketJson(pendingQuote: true));
    final auth = await _auth(api);
    addTearDown(auth.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider<AuthViewModel>.value(
        value: auth,
        child: const MaterialApp(home: RealTicketDetailScreen(code: 'TN-OLD')),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Từ chối'), 300);
    await tester.ensureVisible(find.text('Từ chối'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Từ chối'));
    await tester.pumpAndSettle();
    expect(find.text('Xác nhận'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Xác nhận'))
          .onPressed,
      isNull,
    );
    await tester.enterText(
      find.byType(TextField).last,
      'Không sửa trong mô phỏng',
    );
    await tester.pump();
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();
    expect(api.lastDecision, 'DECLINE');
    expect(api.lastReason, 'Không sửa trong mô phỏng');
    expect(api.detail.status, 'AWAITING_RETURN');
    await tester.drag(find.byType(ListView), const Offset(0, 2000));
    await tester.pumpAndSettle();
    expect(find.textContaining('Chờ trả thiết bị'), findsWidgets);
    expect(find.text('Từ chối'), findsNothing);
  });

  testWidgets('customer accept requires confirmation and uses server status', (
    tester,
  ) async {
    final api = _FakeApi()
      ..detail = PortalTicketDetail.fromJson(_ticketJson(pendingQuote: true));
    final auth = await _auth(api);
    addTearDown(auth.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider<AuthViewModel>.value(
        value: auth,
        child: const MaterialApp(home: RealTicketDetailScreen(code: 'TN-OLD')),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Đồng ý'), 300);
    await tester.ensureVisible(find.text('Đồng ý'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Đồng ý'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hủy'));
    await tester.pumpAndSettle();
    expect(api.lastDecision, isNull);
    await tester.tap(find.text('Đồng ý'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();
    expect(api.lastDecision, 'ACCEPT');
    expect(api.detail.status, 'REPAIRING');
    await tester.drag(find.byType(ListView), const Offset(0, 2000));
    await tester.pumpAndSettle();
    expect(find.textContaining('Đang sửa chữa'), findsWidgets);
    expect(find.text('Đồng ý'), findsNothing);
  });

  testWidgets('404 ownership responses show no other customer data', (
    tester,
  ) async {
    final api = _FakeApi()
      ..requestError = const ApiException('Not found', statusCode: 404)
      ..ticketError = const ApiException('Not found', statusCode: 404);
    final auth = await _auth(api);
    addTearDown(auth.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider<AuthViewModel>.value(
        value: auth,
        child: const MaterialApp(
          home: RealRequestDetailScreen(code: 'YC-OTHER'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('Không tìm thấy yêu cầu trong tài khoản này.'),
      findsOneWidget,
    );
    expect(find.text('Máy mẫu'), findsNothing);

    await tester.pumpWidget(
      ChangeNotifierProvider<AuthViewModel>.value(
        value: auth,
        child: const MaterialApp(
          home: RealTicketDetailScreen(code: 'TN-OTHER'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('Không tìm thấy phiếu tiếp nhận trong tài khoản này.'),
      findsOneWidget,
    );
    expect(find.text('Máy mẫu'), findsNothing);
  });
}
