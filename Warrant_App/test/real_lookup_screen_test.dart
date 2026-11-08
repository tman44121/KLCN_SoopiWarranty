import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:warrant_safe/models/portal_lookup_models.dart';
import 'package:warrant_safe/models/portal_request_models.dart';
import 'package:warrant_safe/models/portal_ticket_models.dart';
import 'support/fake_api_service.dart';
import 'package:warrant_safe/services/i_api_service.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/views/devices/real_lookup_screen.dart';

class _LookupApi extends FakeApiService {
  final requestCodes = <String>[];
  final ticketCodes = <String>[];
  final requestResponses = <Object>[];
  final ticketResponses = <Object>[];
  final serials = <String>[];
  final warrantyResponses = <Object>[];
  int publicLookupCalls = 0;

  @override
  Future<PortalWarrantyCheck> checkWarranty(String serial) async {
    serials.add(serial);
    final response = warrantyResponses.removeAt(0);
    if (response is Exception) throw response;
    return response as PortalWarrantyCheck;
  }

  @override
  Future<PortalRequestDetail> getMyWarrantyRequest(String code) async {
    requestCodes.add(code);
    final response = requestResponses.removeAt(0);
    if (response is Exception) throw response;
    return response as PortalRequestDetail;
  }

  @override
  Future<PortalTicketDetail> getPortalTicket(String code) async {
    ticketCodes.add(code);
    final response = ticketResponses.removeAt(0);
    if (response is Exception) throw response;
    return response as PortalTicketDetail;
  }

  @override
  Future<PortalLookupRecord> lookupPortal(String code, String phone) async {
    publicLookupCalls++;
    throw StateError('Signed-in lookup must not use the public endpoint');
  }
}

const _request = PortalRequestDetail(code: 'YC-TEST', status: 'PENDING_INTAKE');

PortalTicketDetail _ticket({
  String code = 'TN-TEST',
  String status = 'REPAIRING',
  List<PortalStep> steps = const [],
  PortalPendingQuotation? pendingQuotation,
}) => PortalTicketDetail(
  code: code,
  receivedAt: DateTime(2026, 10, 16),
  status: status,
  stopped: false,
  steps: steps,
  pendingQuotation: pendingQuotation,
  customerNotes: const [],
  costs: const PortalCosts(
    inWarrantyAmount: 0,
    outOfWarrantyParts: 0,
    serviceFee: 0,
    vat: 0,
    total: 0,
    paymentStatus: 'UNPAID',
  ),
  canRate: false,
);

Future<void> _open(
  WidgetTester tester,
  _LookupApi api, {
  double textScale = 1,
}) async {
  final auth = AuthViewModel(apiService: api);
  addTearDown(auth.dispose);
  await tester.pumpWidget(
    ChangeNotifierProvider<AuthViewModel>.value(
      value: auth,
      child: MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: const RealLookupScreen(),
      ),
    ),
  );
}

Future<void> _submit(WidgetTester tester, String code) async {
  await tester.enterText(find.byType(TextFormField), code);
  await tester.tap(find.text('Tra cứu').last);
  await tester.pumpAndSettle();
}

void main() {
  for (final status in ['IN_WARRANTY', 'OUT_OF_WARRANTY', 'NOT_ACTIVATED']) {
    testWidgets('serial lookup displays server warranty status $status', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(320, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final api = _LookupApi()
        ..warrantyResponses.add(
          PortalWarrantyCheck.fromJson({
            'productName': 'Thiết bị mẫu',
            'serialOrImei': 'SERIAL-TEST',
            'warrantyStatus': status,
            'warrantyMonths': 12,
            'warrantyActivatedOn': null,
            'warrantyExpiresOn': null,
            'daysRemaining': status == 'IN_WARRANTY' ? 0 : null,
            'repairCount': 2,
            'lastReceivedOn': '2026-10-16',
            'atServiceCenter': true,
          }),
        );
      await _open(tester, api, textScale: 2);
      await tester.tap(find.text('Serial / IMEI').first);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField), ' serial-test ');
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Tra cứu').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Tra cứu').last);
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Thiết bị mẫu'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(api.serials, ['SERIAL-TEST']);
      expect(api.requestCodes, isEmpty);
      expect(api.ticketCodes, isEmpty);
      expect(api.publicLookupCalls, 0);
      expect(
        find.text(switch (status) {
          'IN_WARRANTY' => 'Còn bảo hành',
          'OUT_OF_WARRANTY' => 'Hết bảo hành',
          _ => 'Chưa kích hoạt',
        }),
        findsOneWidget,
      );
      expect(find.text('Phiếu tiếp nhận'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets(
    'serial errors distinguish not found, network retry and throttling',
    (tester) async {
      final api = _LookupApi()
        ..warrantyResponses.addAll([
          const ApiException('missing', statusCode: 404),
          const NetworkException(),
          const ApiException('limited', statusCode: 429),
        ]);
      await _open(tester, api);
      await tester.tap(find.text('Serial / IMEI').first);
      await tester.pumpAndSettle();
      await _submit(tester, 'SERIAL-TEST');
      expect(find.textContaining('Chưa tìm thấy thiết bị'), findsOneWidget);
      await _submit(tester, 'SERIAL-TEST');
      expect(find.text('Thử lại'), findsOneWidget);
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(find.textContaining('tra cứu quá nhiều lần'), findsOneWidget);
      expect(api.serials, ['SERIAL-TEST', 'SERIAL-TEST', 'SERIAL-TEST']);
    },
  );

  testWidgets('invalid serial stays local and switching mode clears result', (
    tester,
  ) async {
    final api = _LookupApi()..requestResponses.add(_request);
    await _open(tester, api);
    await _submit(tester, 'YC-TEST');
    await tester.tap(find.text('Serial / IMEI').first);
    await tester.pumpAndSettle();
    expect(find.text('Yêu cầu YC-TEST'), findsNothing);
    await _submit(tester, '<bad>');
    expect(api.serials, isEmpty);
    expect(find.textContaining('4–50'), findsOneWidget);
  });

  for (final width in [320.0, 375.0, 768.0, 1440.0]) {
    for (final textScale in [1.0, 1.5]) {
      for (final isTicket in [true, false]) {
        testWidgets(
          '${isTicket ? 'ticket' : 'request'} lookup fits ${width}px at text scale $textScale',
          (tester) async {
            await tester.binding.setSurfaceSize(Size(width, 900));
            addTearDown(() => tester.binding.setSurfaceSize(null));
            const codeSuffix = '2026-1016-00002';
            final code = '${isTicket ? 'TN' : 'YC'}-$codeSuffix';
            final api = _LookupApi();
            if (isTicket) {
              api.ticketResponses.add(
                _ticket(
                  code: code,
                  status: 'AWAITING_CUSTOMER_CONFIRMATION',
                  steps: const [
                    PortalStep('INTAKE', 'Tiếp nhận', 'DONE'),
                    PortalStep('DIAGNOSIS', 'Chẩn đoán', 'CURRENT'),
                    PortalStep('READY', 'Sẵn sàng nhận máy', 'PENDING'),
                  ],
                  pendingQuotation: const PortalPendingQuotation(
                    code: 'BG-2026-1016-00002',
                    vatRate: 10,
                    lines: [],
                    partsTotal: 1000000,
                    laborTotal: 200000,
                    grandTotal: 1320000,
                  ),
                ),
              );
            } else {
              api.requestResponses.add(
                PortalRequestDetail(
                  code: code,
                  status: 'PENDING_INTAKE',
                  brandModel: 'Laptop Inspiron 15',
                  serialOrImei: 'DLINS15-51484899',
                  ticketCode: 'TN-$codeSuffix',
                ),
              );
            }
            await _open(tester, api, textScale: textScale);
            await _submit(tester, code);
            expect(tester.takeException(), isNull);
            final title = '${isTicket ? 'Phiếu' : 'Yêu cầu'} $code';
            await tester.ensureVisible(find.text(title));
            expect(find.text(title), findsOneWidget);
            await tester.drag(find.byType(ListView), const Offset(0, -1200));
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);
            if (isTicket) {
              expect(find.text('Báo giá: BG-2026-1016-00002'), findsOneWidget);
              expect(find.text('1320000 VNĐ'), findsOneWidget);
            }
          },
        );
      }
    }
  }

  testWidgets('empty and incomplete code stays local; phone is not requested', (
    tester,
  ) async {
    final api = _LookupApi();
    await _open(tester, api);
    expect(find.byType(TextFormField), findsOneWidget);
    expect(find.textContaining('Số điện thoại'), findsNothing);

    await tester.tap(find.text('Tra cứu').last);
    await tester.pump();
    expect(find.textContaining('Nhập đầy đủ mã'), findsOneWidget);

    await _submit(tester, 'YC--');
    expect(api.requestCodes, isEmpty);
    expect(api.ticketCodes, isEmpty);
    expect(api.publicLookupCalls, 0);
  });

  testWidgets('YC code uses the owner-checked request GET', (tester) async {
    final api = _LookupApi()..requestResponses.add(_request);
    await _open(tester, api);
    await _submit(tester, 'yc-test');

    expect(api.requestCodes, ['YC-TEST']);
    expect(api.ticketCodes, isEmpty);
    expect(api.publicLookupCalls, 0);
    expect(find.text('Yêu cầu YC-TEST'), findsOneWidget);
  });

  testWidgets('TN code uses the owner-checked ticket GET', (tester) async {
    final api = _LookupApi()..ticketResponses.add(_ticket());
    await _open(tester, api);
    await _submit(tester, 'tn-test');

    expect(api.requestCodes, isEmpty);
    expect(api.ticketCodes, ['TN-TEST']);
    expect(api.publicLookupCalls, 0);
    expect(find.text('Phiếu TN-TEST'), findsOneWidget);
  });

  testWidgets('404 does not expose a record', (tester) async {
    final api = _LookupApi()
      ..requestResponses.add(const ApiException('NOT_FOUND', statusCode: 404));
    await _open(tester, api);
    await _submit(tester, 'YC-TEST');

    expect(api.requestCodes, ['YC-TEST']);
    expect(find.textContaining('trong tài khoản của bạn'), findsOneWidget);
    expect(find.text('Yêu cầu YC-TEST'), findsNothing);
    expect(find.text('Thử lại'), findsNothing);
  });

  testWidgets('network error keeps code and Retry loads the record', (
    tester,
  ) async {
    final api = _LookupApi()
      ..requestResponses.addAll([const NetworkException(), _request]);
    await _open(tester, api);
    await _submit(tester, 'YC-TEST');

    expect(find.textContaining('Không kết nối được máy chủ'), findsOneWidget);
    expect(find.text('Thử lại'), findsOneWidget);
    expect(find.textContaining('Không tìm thấy'), findsNothing);
    expect(
      tester.widget<TextFormField>(find.byType(TextFormField)).controller!.text,
      'YC-TEST',
    );

    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(api.requestCodes, ['YC-TEST', 'YC-TEST']);
    expect(find.text('Yêu cầu YC-TEST'), findsOneWidget);
    expect(find.text('Thử lại'), findsNothing);
  });

  testWidgets('429 is explained without exposing a record', (tester) async {
    final api = _LookupApi()
      ..requestResponses.add(
        const ApiException('RATE_LIMITED', statusCode: 429),
      );
    await _open(tester, api);
    await _submit(tester, 'YC-TEST');

    expect(api.requestCodes, ['YC-TEST']);
    expect(find.textContaining('tra cứu quá nhiều lần'), findsOneWidget);
    expect(find.text('Yêu cầu YC-TEST'), findsNothing);
    expect(find.text('Thử lại'), findsNothing);
  });
}
