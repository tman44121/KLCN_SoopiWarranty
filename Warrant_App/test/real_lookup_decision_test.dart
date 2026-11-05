import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:warrant_safe/services/i_api_service.dart';
import 'package:warrant_safe/services/real_api_service.dart';

ResponseBody _json(Object body, int status) => ResponseBody.fromString(
  jsonEncode(body),
  status,
  headers: {
    Headers.contentTypeHeader: ['application/json'],
  },
);

class _Adapter implements HttpClientAdapter {
  _Adapter(this.respond);
  final Future<ResponseBody> Function(RequestOptions) respond;
  final calls = <String>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    calls.add('${options.method} ${options.uri.path}');
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

final _ticket = {
  'code': 'TN-TEST',
  'productName': 'Máy mô phỏng',
  'brandName': null,
  'serialOrImei': 'SERIAL-TEST',
  'receivedAt': '2026-10-15T10:00:00Z',
  'promisedReturnAt': null,
  'status': 'AWAITING_CUSTOMER_CONFIRMATION',
  'stopped': false,
  'steps': <Object>[],
  'customerNotes': <Object>[],
  'costs': {
    'inWarrantyAmount': 0,
    'outOfWarrantyParts': 0,
    'serviceFee': 0,
    'vat': 0,
    'total': 0,
    'paymentStatus': 'UNPAID',
  },
  'pendingQuotation': null,
  'handedOverAt': null,
  'rating': null,
  'canRate': false,
};

void main() {
  test('lookup uses scoped grant only for the matching request', () async {
    final adapter = _Adapter((request) async {
      if (request.uri.path.endsWith('/lookup')) {
        expect(request.method, 'POST');
        expect(request.headers['Authorization'], isNull);
        expect(request.data, {'code': 'YC-TEST', 'phone': '0912345678'});
        return _json({
          'accessToken': 'scoped-token',
          'expiresIn': 600,
          'scope': 'REQUEST',
          'code': 'YC-TEST',
        }, 200);
      }
      expect(request.method, 'GET');
      expect(request.headers['Authorization'], 'Bearer scoped-token');
      return _json({
        'code': 'YC-TEST',
        'status': 'PENDING_INTAKE',
        'ticketCode': null,
      }, 200);
    });
    final api = RealApiService(baseUrl: 'http://test/api/v1', adapter: adapter)
      ..setAuthToken('account-token');
    final result = await api.lookupPortal('yc-test', '0912345678');
    expect(result.request?.status, 'PENDING_INTAKE');
    expect(result.ticket, isNull);
    expect(adapter.calls, [
      'POST /api/v1/portal/lookup',
      'GET /api/v1/portal/warranty-requests/YC-TEST',
    ]);
  });

  test('lookup ticket grant only reads the granted ticket', () async {
    final adapter = _Adapter((request) async {
      if (request.method == 'POST') {
        return _json({
          'accessToken': 'scoped-token',
          'expiresIn': 600,
          'scope': 'TICKET',
          'code': 'TN-TEST',
        }, 200);
      }
      expect(request.headers['Authorization'], 'Bearer scoped-token');
      return _json(_ticket, 200);
    });
    final api = RealApiService(baseUrl: 'http://test/api/v1', adapter: adapter);
    final result = await api.lookupPortal('TN-TEST', '0912345678');
    expect(result.ticket?.code, 'TN-TEST');
    expect(adapter.calls.last, 'GET /api/v1/portal/tickets/TN-TEST');
  });

  for (final status in [404, 429]) {
    test('lookup surfaces HTTP $status without reading a detail', () async {
      final adapter = _Adapter(
        (_) async => _json({
          'type': status == 429 ? 'RATE_LIMITED' : 'PORTAL_NOT_FOUND',
          'code': status == 429 ? 'RATE_LIMITED' : 'PORTAL_NOT_FOUND',
        }, status),
      );
      final api = RealApiService(
        baseUrl: 'http://test/api/v1',
        adapter: adapter,
      );
      await expectLater(
        api.lookupPortal('YC-TEST', '0912345678'),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'status', status),
        ),
      );
      expect(adapter.calls, ['POST /api/v1/portal/lookup']);
    });
  }

  test(
    'lookup network failure stays retryable and does not fake a result',
    () async {
      final adapter = _Adapter(
        (request) async => throw DioException(
          requestOptions: request,
          type: DioExceptionType.connectionError,
        ),
      );
      final api = RealApiService(
        baseUrl: 'http://test/api/v1',
        adapter: adapter,
      );
      await expectLater(
        api.lookupPortal('YC-TEST', '0912345678'),
        throwsA(isA<NetworkException>()),
      );
      expect(adapter.calls, ['POST /api/v1/portal/lookup']);
    },
  );

  test(
    'quotation decision posts once and displays server ticket status',
    () async {
      final adapter = _Adapter((request) async {
        expect(request.method, 'POST');
        expect(request.headers['Authorization'], 'Bearer account-token');
        expect(request.data, {'decision': 'DECLINE', 'reason': 'Không sửa'});
        return _json({..._ticket, 'status': 'AWAITING_RETURN'}, 200);
      });
      final api = RealApiService(
        baseUrl: 'http://test/api/v1',
        adapter: adapter,
      )..setAuthToken('account-token');
      final result = await api.decidePortalQuotation(
        'TN-TEST',
        'DECLINE',
        reason: 'Không sửa',
      );
      expect(result.status, 'AWAITING_RETURN');
      expect(adapter.calls, [
        'POST /api/v1/portal/tickets/TN-TEST/quotation-decision',
      ]);
    },
  );

  test('decision server error never retries a POST', () async {
    final adapter = _Adapter(
      (_) async => _json({'type': 'QUOTE_ALREADY_DECIDED'}, 409),
    );
    final api = RealApiService(baseUrl: 'http://test/api/v1', adapter: adapter)
      ..setAuthToken('account-token');
    await expectLater(
      api.decidePortalQuotation('TN-TEST', 'ACCEPT'),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 409)),
    );
    expect(adapter.calls.length, 1);
  });

  test(
    'quotation decision refreshes once after a rejected expired token',
    () async {
      final adapter = _Adapter((request) async {
        expect(request.data, {'decision': 'DECLINE', 'reason': 'Không sửa'});
        return request.headers['Authorization'] == 'Bearer new-access'
            ? _json({..._ticket, 'status': 'AWAITING_RETURN'}, 200)
            : _json({'type': 'AUTH_TOKEN_INVALID'}, 401);
      });
      final api = RealApiService(
        baseUrl: 'http://test/api/v1',
        adapter: adapter,
      )..setAuthToken('old-access');
      var refreshes = 0;
      api.onAccessTokenExpired = () async {
        refreshes++;
        api.setAuthToken('new-access');
        return 'new-access';
      };

      final result = await api.decidePortalQuotation(
        'TN-TEST',
        'DECLINE',
        reason: 'Không sửa',
      );

      expect(result.status, 'AWAITING_RETURN');
      expect(refreshes, 1);
      expect(adapter.calls.length, 2);
    },
  );
}
