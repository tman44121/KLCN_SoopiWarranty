import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:warrant_safe/services/i_api_service.dart';
import 'package:warrant_safe/services/real_api_service.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.respond);
  final ResponseBody Function(RequestOptions) respond;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => respond(options);
  @override
  void close({bool force = false}) {}
}

ResponseBody _json(Object value, int status) => ResponseBody.fromString(
  jsonEncode(value),
  status,
  headers: {
    Headers.contentTypeHeader: ['application/json'],
  },
);

void main() {
  test(
    'warranty lookup is anonymous, normalizes serial and preserves shared bearer',
    () async {
      final adapter = _Adapter((request) {
        if (request.uri.path.endsWith('/warranty-check')) {
          expect(request.method, 'GET');
          expect(request.queryParameters, {'serial': 'SERIAL-123'});
          expect(request.headers['Authorization'], isNull);
          return _json({
            'productName': 'Máy mẫu',
            'brandName': null,
            'serialOrImei': 'SERIAL-123',
            'warrantyStatus': 'IN_WARRANTY',
            'warrantyActivatedOn': '2025-11-03',
            'warrantyExpiresOn': '2026-11-03',
            'warrantyMonths': 12,
            'daysRemaining': 0,
            'repairCount': 2,
            'lastReceivedOn': '2026-10-01',
            'atServiceCenter': true,
          }, 200);
        }
        expect(request.uri.path, '/api/v1/portal/my/devices');
        expect(request.headers['Authorization'], 'Bearer account-token');
        return _json([], 200);
      });
      final api = RealApiService(
        baseUrl: 'http://test/api/v1',
        adapter: adapter,
      )..setAuthToken('account-token');
      final result = await api.checkWarranty(' serial- 123 ');
      expect(result.productName, 'Máy mẫu');
      expect(result.daysRemaining, 0);
      expect(result.warrantyExpiresOn, DateTime(2026, 11, 3));
      expect(result.repairCount, 2);
      expect(result.atServiceCenter, isTrue);
      await api.getMyDevices();
    },
  );

  for (final status in [404, 429, 401]) {
    test(
      'public warranty HTTP $status is typed without refreshing account session',
      () async {
        var refreshes = 0;
        final api =
            RealApiService(
                baseUrl: 'http://test/api/v1',
                adapter: _Adapter(
                  (_) => _json({
                    'detail': 'Không tra cứu được',
                    'code': 'TEST',
                  }, status),
                ),
              )
              ..setAuthToken('expired-token')
              ..onAccessTokenExpired = () async {
                refreshes++;
                return 'renewed';
              };
        await expectLater(
          api.checkWarranty('123456789012345'),
          throwsA(
            isA<ApiException>().having((e) => e.statusCode, 'status', status),
          ),
        );
        expect(refreshes, 0);
      },
    );
  }
}
