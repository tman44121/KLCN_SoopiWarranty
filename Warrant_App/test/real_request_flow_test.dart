import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:warrant_safe/models/portal_request_models.dart';
import 'package:warrant_safe/models/user_model.dart';
import 'package:warrant_safe/router/app_router.dart';
import 'package:warrant_safe/services/i_api_service.dart';
import 'package:warrant_safe/services/real_api_service.dart';
import 'package:warrant_safe/services/token_storage.dart';
import 'package:warrant_safe/viewmodels/auth_viewmodel.dart';
import 'package:warrant_safe/viewmodels/request_viewmodel.dart';
import 'package:warrant_safe/views/requests/real_create_request_screen.dart';

const _device = OwnedDevice(
  code: 'TB-1',
  productName: 'Máy mẫu',
  brandName: 'Hãng mẫu',
  identifierType: 'SERIAL',
  serialOrImei: 'SERIAL-1234',
);
const _catalog = PortalCatalog(
  [
    PortalCategory('CAT', 'Nhóm mẫu', [
      PortalDeviceType('TYPE', 'Loại mẫu', 'SERIAL'),
      PortalDeviceType('PHONE', 'Điện thoại', 'IMEI'),
    ]),
  ],
  [PortalStation('STATION', 'Trạm mẫu', null)],
  products: [
    PortalProduct('SP-1', 'Máy nhập tay', null, 'CAT', 'TYPE'),
    PortalProduct('SP-2', 'Máy khác', null, 'CAT', 'TYPE'),
  ],
);

class _RequestAdapter implements HttpClientAdapter {
  _RequestAdapter(this.respond);
  final Future<ResponseBody> Function(RequestOptions, Stream<Uint8List>?)
  respond;
  int calls = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    calls++;
    return respond(options, requestStream);
  }

  @override
  void close({bool force = false}) {}
}

class _MemoryStorage implements TokenStorage {
  @override
  Future<void> clearSession() async {}
  @override
  Future<Map<String, String?>> readSession() async => {};
  @override
  Future<void> saveSession({
    required String token,
    String? refreshToken,
    required String userId,
  }) async {}
}

class _FakePortalApi extends IApiService {
  int submitCount = 0;
  OwnWarrantyRequestData? submittedData;
  int listCount = 0;
  Completer<String>? pending;
  Completer<List<PortalRequestSummary>>? pendingList;
  Object? submitError;

  @override
  Future<AuthResponse> login(String username, String password) async =>
      const AuthResponse(
        accessToken: '',
        expiresIn: 60,
        refreshToken: null,
        refreshExpiresIn: null,
        user: UserModel(
          id: 'ACCOUNT',
          fullName: 'Khách thử',
          username: 'customer',
          phone: '',
          role: 'CUSTOMER',
        ),
      );
  @override
  Future<UserModel> getProfile() async => const UserModel(
    id: 'ACCOUNT',
    fullName: 'Khách thử',
    username: 'customer',
    phone: '',
    role: 'CUSTOMER',
  );
  @override
  Future<List<OwnedDevice>> getMyDevices() async => [_device];
  @override
  Future<PortalCatalog> getPortalCatalog() async => _catalog;
  @override
  Future<List<PortalRequestSummary>> getMyWarrantyRequests() {
    listCount++;
    return pendingList?.future ?? Future.value([]);
  }

  @override
  Future<String> submitMyWarrantyRequest(OwnWarrantyRequestData data) {
    submitCount++;
    submittedData = data;
    if (submitError != null) return Future.error(submitError!);
    return pending?.future ?? Future.value('YC-TEST');
  }

  @override
  Future<AuthResponse> refresh(String refreshToken) => login('', '');
  @override
  Future<void> logout(String? refreshToken) async {}
  @override
  void setAuthToken(String token) {}
  @override
  void clearAuthToken() {}
}

Future<AuthViewModel> _authenticated(_FakePortalApi api) async {
  SharedPreferences.setMockInitialValues({});
  final auth = AuthViewModel(apiService: api, tokenStorage: _MemoryStorage());
  await auth.initialize();
  expect(await auth.loginUser('customer', ''), isTrue);
  return auth;
}

Future<void> _choosePreferredArrival(WidgetTester tester) async {
  final picker = find.byKey(
    const ValueKey('preferred-arrival-picker'),
    skipOffstage: false,
  );
  await tester.ensureVisible(picker);
  await tester.pumpAndSettle();
  await tester.tap(picker);
  await tester.pumpAndSettle();
  await tester.tap(find.text('OK').last);
  await tester.pumpAndSettle();
  await tester.tap(find.text('OK').last);
  await tester.pumpAndSettle();
}

void main() {
  test(
    'catalog accepts product metadata and older responses without products',
    () {
      expect(PortalCatalog.fromJson({}).products, isEmpty);
      final catalog = PortalCatalog.fromJson({
        'products': [
          {
            'code': 'SP-1',
            'name': 'Galaxy S24',
            'brandName': 'Samsung',
            'categoryCode': 'PHONE',
            'deviceTypeCode': 'SMARTPHONE',
          },
        ],
      });
      expect(catalog.products.single.label, 'Samsung Galaxy S24');
      expect(catalog.products.single.deviceTypeCode, 'SMARTPHONE');
    },
  );

  test(
    'catalog type must match the owned device identifier; no guessed code',
    () {
      final errors = OwnWarrantyRequestData.validate(
        device: _device,
        catalog: _catalog,
        categoryCode: 'CAT',
        deviceTypeCode: 'PHONE',
        stationCode: 'STATION',
        symptom: 'Máy không lên nguồn',
      );
      expect(errors['deviceTypeCode'], isNotNull);
      expect(
        OwnWarrantyRequestData.validate(
          device: _device,
          catalog: _catalog,
          categoryCode: 'CAT',
          deviceTypeCode: 'TYPE',
          stationCode: 'STATION',
          symptom: ' ',
        )['symptom'],
        isNotNull,
      );
      expect(
        OwnWarrantyRequestData.validate(
          device: _device,
          catalog: _catalog,
          categoryCode: 'CAT',
          deviceTypeCode: 'TYPE',
          stationCode: 'STATION',
          symptom: 'Máy không lên nguồn',
        ),
        isEmpty,
      );
    },
  );

  test('new device identity follows catalog type and backend serial rules', () {
    Map<String, String> validate(String type, String serial) =>
        OwnWarrantyRequestData.validateUnregistered(
          catalog: _catalog,
          categoryCode: 'CAT',
          deviceTypeCode: type,
          brandModel: 'Máy mẫu',
          serialOrImei: serial,
          stationCode: 'STATION',
          symptom: 'Không nhận sạc',
        );

    expect(validate('TYPE', 'SERIAL-1234'), isEmpty);
    expect(validate('TYPE', 'abc'), contains('serialOrImei'));
    expect(validate('PHONE', '490154203237518'), isEmpty);
    expect(validate('PHONE', '490154203237519'), isEmpty);
    expect(validate('PHONE', 'imei-1234'), isEmpty);
    expect(validate('PHONE', '1234'), isEmpty);
    expect(validate('PHONE', 'A' * 50), isEmpty);
    for (final invalid in ['', '123', 'A' * 51, 'IMEI@1234']) {
      expect(validate('PHONE', invalid), contains('serialOrImei'));
    }
    expect(
      OwnWarrantyRequestData.validateUnregistered(
        catalog: _catalog,
        categoryCode: 'CAT',
        deviceTypeCode: 'TYPE',
        brandModel: ' ',
        serialOrImei: 'SERIAL-1234',
        stationCode: 'STATION',
        symptom: ' ',
      ).keys,
      containsAll(['brandModel', 'symptom']),
    );
  });

  test('request model uses server fields and omits optional time/customer', () {
    const payload = OwnWarrantyRequestData(
      categoryCode: 'CAT',
      deviceTypeCode: 'TYPE',
      brandModel: 'Máy mẫu',
      identifierType: 'SERIAL',
      serialOrImei: 'SERIAL-1234',
      symptom: 'Máy không lên nguồn',
      preferredStation: 'STATION',
    );
    expect(
      payload.toJson().keys,
      containsAll([
        'categoryCode',
        'deviceTypeCode',
        'brandModel',
        'identifierType',
        'serialOrImei',
        'symptom',
        'preferredStation',
      ]),
    );
    expect(payload.toJson(), isNot(contains('customer')));
    expect(payload.toJson(), isNot(contains('preferredFrom')));
    final arrival = DateTime.utc(2026, 10, 24, 9);
    final scheduled = OwnWarrantyRequestData(
      categoryCode: 'CAT',
      deviceTypeCode: 'TYPE',
      brandModel: 'Máy mẫu',
      identifierType: 'SERIAL',
      serialOrImei: 'SERIAL-1234',
      symptom: 'Máy không lên nguồn',
      preferredStation: 'STATION',
      preferredFrom: arrival,
      preferredTo: arrival.add(const Duration(hours: 1)),
    );
    expect(scheduled.toJson()['preferredFrom'], '2026-10-24T09:00:00.000Z');
    expect(scheduled.toJson()['preferredTo'], '2026-10-24T10:00:00.000Z');
    expect(
      OwnWarrantyRequestData.validatePreferredArrival(null, arrival),
      isNotNull,
    );
    expect(
      OwnWarrantyRequestData.validatePreferredArrival(arrival, arrival),
      isNotNull,
    );
    expect(
      OwnWarrantyRequestData.validatePreferredArrival(
        arrival.add(const Duration(minutes: 1)),
        arrival,
      ),
      isNull,
    );
    expect(
      PortalRequestSummary.fromJson({
        'code': 'YC-1',
        'status': 'PENDING_INTAKE',
        'brandModel': 'Máy mẫu',
      }).status,
      'PENDING_INTAKE',
    );
    expect(
      portalRequestStatusLabel('PENDING_INTAKE'),
      'Chờ tiếp nhận thiết bị',
    );
  });

  test('attachment limits follow Web selection and backend file sizes', () {
    RequestAttachment file(String name, int length) => RequestAttachment(
      name: name,
      length: length,
      openRead: () => Stream.value([1]),
    );
    expect(
      RequestAttachment.validateSelection([file('fault.png', 5 * 1024 * 1024)]),
      isNull,
    );
    expect(
      RequestAttachment.validateSelection([file('clip.mp4', 30 * 1024 * 1024)]),
      isNull,
    );
    expect(
      RequestAttachment.validateSelection([
        file('fault.png', 5 * 1024 * 1024 + 1),
      ]),
      isNotNull,
    );
    expect(
      RequestAttachment.validateSelection([file('report.pdf', 10)]),
      isNotNull,
    );
    expect(
      RequestAttachment.validateSelection(
        List.filled(4, file('fault.jpg', 10)),
      ),
      isNotNull,
    );
  });

  test(
    'multipart submission sends one data part and accepts only server code',
    () async {
      final adapter = _RequestAdapter((options, stream) async {
        final bytes = await stream!.fold<List<int>>(
          [],
          (result, chunk) => result..addAll(chunk),
        );
        final body = utf8.decode(bytes);
        expect(options.method, 'POST');
        expect(options.uri.path, '/api/v1/portal/my/warranty-requests');
        expect(options.contentType, contains('multipart/form-data'));
        expect(body, contains('name="data"'));
        expect(body, contains('"categoryCode":"CAT"'));
        expect(body, isNot(contains('"customer"')));
        return ResponseBody.fromString(
          '{"code":"YC-SERVER"}',
          201,
          headers: {
            Headers.contentTypeHeader: ['application/json'],
          },
        );
      });
      final api = RealApiService(
        baseUrl: 'http://127.0.0.1:8080/api/v1',
        adapter: adapter,
      );
      final code = await api.submitMyWarrantyRequest(
        const OwnWarrantyRequestData(
          categoryCode: 'CAT',
          deviceTypeCode: 'TYPE',
          brandModel: 'Máy mẫu',
          identifierType: 'SERIAL',
          serialOrImei: 'SERIAL-1234',
          symptom: 'Máy không lên nguồn',
          preferredStation: 'STATION',
        ),
      );
      expect(adapter.calls, 1);
      expect(code, 'YC-SERVER');
    },
  );

  test(
    'multipart submission uses exact files part name with one POST',
    () async {
      final adapter = _RequestAdapter((options, stream) async {
        final bytes = await stream!.fold<List<int>>(
          [],
          (result, chunk) => result..addAll(chunk),
        );
        final body = utf8.decode(bytes, allowMalformed: true);
        expect(options.method, 'POST');
        expect(body, contains('name="data"'));
        expect(body, contains('name="files"; filename="proof.png"'));
        expect(body, isNot(contains('name="files[]"')));
        return ResponseBody.fromString(
          '{"code":"YC-FILE"}',
          201,
          headers: {
            Headers.contentTypeHeader: ['application/json'],
          },
        );
      });
      final api = RealApiService(
        baseUrl: 'http://127.0.0.1:8080/api/v1',
        adapter: adapter,
      );
      final code = await api.submitMyWarrantyRequest(
        OwnWarrantyRequestData(
          categoryCode: 'CAT',
          deviceTypeCode: 'TYPE',
          brandModel: 'Máy mẫu',
          identifierType: 'SERIAL',
          serialOrImei: 'SERIAL-1234',
          symptom: 'Máy không lên nguồn',
          preferredStation: 'STATION',
          attachments: [
            RequestAttachment(
              name: 'proof.png',
              length: 4,
              openRead: () => Stream.value([1, 2, 3, 4]),
            ),
          ],
        ),
      );
      expect(code, 'YC-FILE');
      expect(adapter.calls, 1);
    },
  );

  test(
    'problem+json keeps status and fieldErrors without a second POST',
    () async {
      final adapter = _RequestAdapter((options, stream) async {
        await stream!.drain<void>();
        return ResponseBody.fromString(
          jsonEncode({
            'type': 'https://example.invalid/errors/VALIDATION_FAILED',
            'detail': 'Dữ liệu không hợp lệ',
            'fieldErrors': [
              {'field': 'symptom', 'message': 'Không được để trống'},
            ],
          }),
          400,
          headers: {
            Headers.contentTypeHeader: ['application/problem+json'],
          },
        );
      });
      final api = RealApiService(
        baseUrl: 'http://127.0.0.1:8080/api/v1',
        adapter: adapter,
      );
      try {
        await api.submitMyWarrantyRequest(
          const OwnWarrantyRequestData(
            categoryCode: 'CAT',
            deviceTypeCode: 'TYPE',
            brandModel: 'Máy mẫu',
            identifierType: 'SERIAL',
            serialOrImei: 'SERIAL-1234',
            symptom: '',
            preferredStation: 'STATION',
          ),
        );
        fail('Expected an API validation error');
      } on ApiException catch (error) {
        expect(error.statusCode, 400);
        expect(error.fieldErrors['symptom'], 'Không được để trống');
      }
      expect(adapter.calls, 1);
    },
  );

  test('transport timeout stays uncertain and is not retried', () async {
    final adapter = _RequestAdapter((options, stream) async {
      await stream!.drain<void>();
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.receiveTimeout,
      );
    });
    final api = RealApiService(
      baseUrl: 'http://127.0.0.1:8080/api/v1',
      adapter: adapter,
    );
    await expectLater(
      api.submitMyWarrantyRequest(
        const OwnWarrantyRequestData(
          categoryCode: 'CAT',
          deviceTypeCode: 'TYPE',
          brandModel: 'Máy mẫu',
          identifierType: 'SERIAL',
          serialOrImei: 'SERIAL-1234',
          symptom: 'Máy không lên nguồn',
          preferredStation: 'STATION',
        ),
      ),
      throwsA(isA<NetworkException>()),
    );
    expect(adapter.calls, 1);
  });

  test('authenticated list and detail use the customer portal paths', () async {
    final adapter = _RequestAdapter((options, stream) async {
      if (options.uri.path == '/api/v1/portal/my/warranty-requests') {
        return ResponseBody.fromString(
          '[{"code":"YC-1","status":"PENDING_INTAKE","brandModel":"Máy mẫu"}]',
          200,
          headers: {
            Headers.contentTypeHeader: ['application/json'],
          },
        );
      }
      expect(options.uri.path, '/api/v1/portal/my/warranty-requests/YC-1');
      return ResponseBody.fromString(
        '{"code":"YC-1","status":"PENDING_INTAKE","symptom":"Không lên nguồn"}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });
    final api = RealApiService(
      baseUrl: 'http://127.0.0.1:8080/api/v1',
      adapter: adapter,
    );
    final list = await api.getMyWarrantyRequests();
    final detail = await api.getMyWarrantyRequest(list.single.code);
    expect(list.single.status, 'PENDING_INTAKE');
    expect(detail.symptom, 'Không lên nguồn');
    expect(adapter.calls, 2);
  });

  test('submission guard prevents concurrent duplicate request', () async {
    final api = _FakePortalApi()..pending = Completer<String>();
    final auth = await _authenticated(api);
    final requests = RequestViewModel(auth);
    addTearDown(() {
      requests.dispose();
      auth.dispose();
    });
    const payload = OwnWarrantyRequestData(
      categoryCode: 'CAT',
      deviceTypeCode: 'TYPE',
      brandModel: 'Máy mẫu',
      identifierType: 'SERIAL',
      serialOrImei: 'SERIAL-1234',
      symptom: 'Máy không lên nguồn',
      preferredStation: 'STATION',
    );
    final first = requests.submit(payload);
    await expectLater(requests.submit(payload), throwsStateError);
    expect(api.submitCount, 1);
    api.pending!.complete('YC-SERVER');
    expect(await first, 'YC-SERVER');
    expect(requests.requests, isEmpty); // The API list must supply records.
  });

  test('confirmed POST queues a fresh list after an older GET', () async {
    final api = _FakePortalApi()
      ..pendingList = Completer<List<PortalRequestSummary>>();
    final auth = await _authenticated(api);
    final requests = RequestViewModel(auth);
    addTearDown(() {
      requests.dispose();
      auth.dispose();
    });
    final oldList = api.pendingList!;
    final firstLoad = requests.refresh();
    const payload = OwnWarrantyRequestData(
      categoryCode: 'CAT',
      deviceTypeCode: 'TYPE',
      brandModel: 'Máy mẫu',
      identifierType: 'SERIAL',
      serialOrImei: 'SERIAL-1234',
      symptom: 'Máy không lên nguồn',
      preferredStation: 'STATION',
    );
    expect(await requests.submit(payload), 'YC-TEST');
    final queued = requests.refresh();
    api.pendingList = Completer<List<PortalRequestSummary>>();
    oldList.complete([]);
    await Future<void>.delayed(Duration.zero);
    api.pendingList!.complete([
      const PortalRequestSummary(code: 'YC-TEST', status: 'PENDING_INTAKE'),
    ]);
    await Future.wait([firstLoad, queued]);
    expect(api.listCount, 2);
    expect(requests.requests.single.code, 'YC-TEST');
  });

  testWidgets('device path fixes identity and rejects an incomplete form', (
    tester,
  ) async {
    final api = _FakePortalApi();
    final auth = await _authenticated(api);
    final requests = RequestViewModel(auth);
    addTearDown(() {
      requests.dispose();
      auth.dispose();
    });
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthViewModel>.value(value: auth),
          ChangeNotifierProvider<RequestViewModel>.value(value: requests),
        ],
        child: const MaterialApp(
          home: RealCreateRequestScreen(prefilledDevice: _device),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('SERIAL: SERIAL-1234'), findsOneWidget);
    expect(find.text('Thiết bị của bạn *'), findsNothing);
    expect(
      find.text('Thiết bị chưa có trong danh sách? Nhập thông tin'),
      findsNothing,
    );
    await tester.tap(find.text('GỬI YÊU CẦU'));
    await tester.pump();
    expect(find.text('Vui lòng chọn nhóm thiết bị.'), findsOneWidget);
    expect(api.submitCount, 0);
  });

  testWidgets(
    'general Real form offers new device without posting incomplete data',
    (tester) async {
      final api = _FakePortalApi();
      final auth = await _authenticated(api);
      final requests = RequestViewModel(auth);
      addTearDown(() {
        requests.dispose();
        auth.dispose();
      });
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthViewModel>.value(value: auth),
            ChangeNotifierProvider<RequestViewModel>.value(value: requests),
          ],
          child: const MaterialApp(home: RealCreateRequestScreen()),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(
        find.text('Thiết bị chưa có trong danh sách? Nhập thông tin'),
      );
      await tester.pumpAndSettle();
      expect(find.text('Thiết bị của bạn *'), findsNothing);
      expect(find.byType(TextFormField, skipOffstage: false), findsNWidgets(2));
      expect(
        find.descendant(
          of: find.byKey(
            const ValueKey('manual-brand-model'),
            skipOffstage: false,
          ),
          matching: find.byType(DropdownMenu<String>, skipOffstage: false),
        ),
        findsOneWidget,
      );
      await tester.tap(find.text('GỬI YÊU CẦU'));
      await tester.pump();
      expect(find.text('Vui lòng chọn nhóm thiết bị.'), findsOneWidget);
      expect(api.submitCount, 0);
    },
  );

  testWidgets('manual Real form submits the entered identity once', (
    tester,
  ) async {
    final api = _FakePortalApi()..pending = Completer<String>();
    final auth = await _authenticated(api);
    final requests = RequestViewModel(auth);
    addTearDown(() {
      requests.dispose();
      auth.dispose();
    });
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthViewModel>.value(value: auth),
          ChangeNotifierProvider<RequestViewModel>.value(value: requests),
        ],
        child: const MaterialApp(home: RealCreateRequestScreen()),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(
      find.text('Thiết bị chưa có trong danh sách? Nhập thông tin'),
    );
    await tester.pumpAndSettle();
    final dropdowns = find.byType(DropdownButtonFormField<String>);
    await tester.tap(dropdowns.at(0));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nhóm mẫu').last);
    await tester.pumpAndSettle();
    await tester.tap(dropdowns.at(1));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Loại mẫu').last);
    await tester.pumpAndSettle();
    final brand = find.byKey(
      const ValueKey('manual-brand-model'),
      skipOffstage: false,
    );
    final serial = find.byKey(
      const ValueKey('manual-serial'),
      skipOffstage: false,
    );
    final symptom = find.byKey(
      const ValueKey('request-symptom'),
      skipOffstage: false,
    );
    await tester.ensureVisible(brand);
    await tester.pumpAndSettle();
    final modelText = find.descendant(
      of: brand,
      matching: find.byType(TextField, skipOffstage: false),
    );
    await _typeModel(tester, modelText, 'nhập');
    await tester.pumpAndSettle();
    expect(find.widgetWithText(MenuItemButton, 'Máy khác'), findsNothing);
    expect(find.widgetWithText(MenuItemButton, 'Máy nhập tay'), findsOneWidget);
    await tester.tap(find.text('Máy nhập tay').last);
    await tester.pumpAndSettle();
    for (final choice in [('TYPE', 'Điện thoại'), ('PHONE', 'Loại mẫu')]) {
      final typePicker = find.byKey(
        ValueKey('Loại thiết bị *:${choice.$1}'),
        skipOffstage: false,
      );
      await tester.ensureVisible(typePicker);
      await tester.pumpAndSettle();
      await tester.tap(typePicker);
      await tester.pumpAndSettle();
      await tester.tap(find.text(choice.$2).last);
      await tester.pumpAndSettle();
    }
    final modelDropdown = find.descendant(
      of: brand,
      matching: find.byType(DropdownMenu<String>, skipOffstage: false),
    );
    expect(
      tester.widget<DropdownMenu<String>>(modelDropdown).initialSelection,
      isNull,
    );
    await tester.ensureVisible(brand);
    await tester.pumpAndSettle();
    await _typeModel(tester, modelText, 'nhập');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Máy nhập tay').last);
    await tester.pumpAndSettle();
    await tester.ensureVisible(serial);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('manual-serial')),
      'NEW-1234',
    );
    await tester.ensureVisible(symptom);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('request-symptom')),
      'Không nhận sạc',
    );
    final station = find
        .byType(DropdownButtonFormField<String>, skipOffstage: false)
        .last;
    await tester.ensureVisible(station);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(DropdownButtonFormField<String>).last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Trạm mẫu').last);
    await tester.pumpAndSettle();
    await _choosePreferredArrival(tester);
    await tester.ensureVisible(brand);
    await tester.pumpAndSettle();
    await tester.enterText(modelText, 'Model không có trong danh mục');
    await tester.tap(find.text('GỬI YÊU CẦU'));
    await tester.pumpAndSettle();
    expect(api.submitCount, 0);
    expect(
      find.text('Vui lòng chọn hãng/model có sẵn trong danh sách.'),
      findsOneWidget,
    );
    await tester.ensureVisible(brand);
    await tester.pumpAndSettle();
    await _typeModel(tester, modelText, 'nhập');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Máy nhập tay').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('GỬI YÊU CẦU'));
    await tester.pump();
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(
      find.text('Đang gửi yêu cầu. Vui lòng chờ kết quả.'),
      findsOneWidget,
    );
    expect(api.submitCount, 1);
    api.pending!.complete('YC-TEST');
    await tester.pumpAndSettle();
    expect(api.submitCount, 1);
    expect(api.submittedData?.brandModel, 'Máy nhập tay');
    expect(api.submittedData?.serialOrImei, 'NEW-1234');
    expect(api.submittedData?.identifierType, 'SERIAL');
    expect(api.submittedData?.preferredFrom, isNotNull);
    expect(
      api.submittedData!.preferredTo!.difference(
        api.submittedData!.preferredFrom!,
      ),
      const Duration(hours: 1),
    );
  });

  testWidgets('owned-device action hands the same device to the Real form', (
    tester,
  ) async {
    final api = _FakePortalApi();
    final auth = await _authenticated(api);
    final requests = RequestViewModel(auth);
    final router = AppRouter(auth);
    addTearDown(() {
      router.router.dispose();
      requests.dispose();
      auth.dispose();
    });
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthViewModel>.value(value: auth),
          ChangeNotifierProvider<RequestViewModel>.value(value: requests),
        ],
        child: MaterialApp.router(routerConfig: router.router),
      ),
    );
    router.router.go('${AppRoutes.devices}/detail', extra: _device);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gửi yêu cầu cho thiết bị này'));
    await tester.pumpAndSettle();
    expect(find.byType(RealCreateRequestScreen), findsOneWidget);
    expect(find.text('SERIAL: SERIAL-1234'), findsOneWidget);
  });

  testWidgets(
    'uncertain submission removes the send action and offers list check',
    (tester) async {
      final api = _FakePortalApi()..submitError = const NetworkException();
      final auth = await _authenticated(api);
      final requests = RequestViewModel(auth);
      addTearDown(() {
        requests.dispose();
        auth.dispose();
      });
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthViewModel>.value(value: auth),
            ChangeNotifierProvider<RequestViewModel>.value(value: requests),
          ],
          child: const MaterialApp(
            home: RealCreateRequestScreen(prefilledDevice: _device),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final dropdowns = find.byType(DropdownButtonFormField<String>);
      tester
          .widget<DropdownButtonFormField<String>>(dropdowns.at(0))
          .onChanged
          ?.call('CAT');
      await tester.pump();
      expect(find.text('Loại theo danh mục: Loại mẫu'), findsOneWidget);
      expect(find.text('Loại thiết bị *'), findsNothing);
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey('request-symptom')),
        250,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.enterText(
        find.byKey(const ValueKey('request-symptom')),
        'Máy không lên nguồn',
      );
      await tester.scrollUntilVisible(
        find.text('Trạm dịch vụ mong muốn *'),
        250,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pump();
      tester
          .widget<DropdownButtonFormField<String>>(
            find.byKey(const ValueKey('Trạm dịch vụ mong muốn *:null')),
          )
          .onChanged
          ?.call('STATION');
      await tester.pump();
      await _choosePreferredArrival(tester);
      await tester.tap(find.text('GỬI YÊU CẦU'));
      await tester.pumpAndSettle();
      expect(api.submitCount, 1);
      expect(find.text('GỬI YÊU CẦU'), findsNothing);
      await tester.scrollUntilVisible(
        find.text('Kiểm tra danh sách yêu cầu'),
        250,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Kiểm tra danh sách yêu cầu'), findsOneWidget);
    },
  );
}

/// Chạm vào ô Hãng/model để mở danh sách như người dùng thật, rồi gõ để lọc.
Future<void> _typeModel(WidgetTester tester, Finder field, String text) async {
  await tester.tap(field);
  await tester.pumpAndSettle();
  await tester.enterText(field, text);
}
