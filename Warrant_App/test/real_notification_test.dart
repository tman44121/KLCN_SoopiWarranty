import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:warrant_safe/models/portal_notification_models.dart';
import 'package:warrant_safe/services/real_api_service.dart';

ResponseBody _json(Object body, int status) => ResponseBody.fromString(
  jsonEncode(body), status,
  headers: {Headers.contentTypeHeader: ['application/json']},
);

class _Adapter implements HttpClientAdapter {
  _Adapter(this.respond);
  final Future<ResponseBody> Function(RequestOptions) respond;
  final calls = <String>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) {
    calls.add('${options.method} ${options.uri.path}');
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test('customer quotation notification routes by ticket entity, not Web link', () {
    final inbox = PortalNotificationInbox.fromJson({
      'unreadCount': 1,
      'items': [{
        'id': '42',
        'type': 'QUOTATION_AWAITING_CUSTOMER',
        'message': 'Báo giá BG-TEST cho phiếu TN-TEST đang chờ xác nhận.',
        'link': '/portal',
        'entityId': 'TN-TEST',
        'createdAt': '2026-10-16T08:00:00Z',
        'read': false,
      }],
    });
    expect(inbox.unreadCount, 1);
    expect(inbox.items.single.customerPath, '/requests/tickets/TN-TEST');
    expect(inbox.items.single.read, false);
  });

  test('unsupported entity and event cannot open an arbitrary route', () {
    const item = PortalNotification(
      id: '1', type: 'QUOTATION_AWAITING_CUSTOMER',
      message: 'test', entityId: '../profile', read: false,
    );
    expect(item.customerPath, isNull);
    const staff = PortalNotification(
      id: '2', type: 'QUOTATION_APPROVED',
      message: 'test', entityId: 'TN-TEST', read: false,
    );
    expect(staff.customerPath, isNull);
  });

  test('inbox GET and mark-read POST use authenticated existing endpoints', () async {
    final adapter = _Adapter((request) async {
      expect(request.headers['Authorization'], 'Bearer account-token');
      if (request.method == 'GET') {
        return _json({'items': [], 'unreadCount': 0}, 200);
      }
      expect(request.method, 'POST');
      return ResponseBody.fromString('', 204);
    });
    final api = RealApiService(baseUrl: 'http://test/api/v1', adapter: adapter)
      ..setAuthToken('account-token');
    expect((await api.getNotifications()).items, isEmpty);
    await api.markNotificationRead('42');
    expect(adapter.calls, [
      'GET /api/v1/notifications',
      'POST /api/v1/notifications/42/read',
    ]);
  });
}
