import 'package:flutter/foundation.dart';

// Centralised mock data for the WarrantSafe prototype.
//
// All screen-level mock content must be sourced from here so that later
// screens (Thiết bị, Yêu cầu, Lịch sử, Thông báo) reuse the same records.
//
// Business status values (e.g. [TicketStatus], [RequestStatus]) are aligned
// with the approved SQL schema (TrungTamBaoHanhDB_SqlServer.sql).
// Device names, request IDs and descriptions are plausible demo content only;
// no real centre addresses, fees or warranty expiry rules are invented.

// ─────────────────────────────────────────────────────────────────────────────
// Enums — aligned with DB CHECK constraints
// ─────────────────────────────────────────────────────────────────────────────

/// Maps to PhieuTiepNhan.TrangThaiXuLy CHECK constraint values.
enum TicketStatus {
  received('RECEIVED', 'Đã tiếp nhận'),
  inspecting('INSPECTING', 'Đang kiểm tra'),
  diagnosed('DIAGNOSED', 'Đã chẩn đoán'),
  awaitingQuoteApproval('AWAITING_QUOTE_APPROVAL', 'Chờ duyệt báo giá'),
  awaitingCustomerConfirmation(
    'AWAITING_CUSTOMER_CONFIRMATION',
    'Chờ khách xác nhận',
  ),
  awaitingParts('AWAITING_PARTS', 'Chờ linh kiện'),
  awaitingReturn('AWAITING_RETURN', 'Chờ trả máy'),
  repairing('REPAIRING', 'Đang sửa chữa'),
  completed('COMPLETED', 'Sẵn sàng bàn giao'),
  delivered('DELIVERED', 'Đã bàn giao'),
  returnedUnrepaired('RETURNED_UNREPAIRED', 'Đã trả máy (không sửa)');

  const TicketStatus(this.dbValue, this.label);
  final String dbValue;
  final String label;
}

/// Maps to YeuCauBaoHanh.TrangThai CHECK constraint values.
enum RequestStatus {
  pendingIntake('PENDING_INTAKE', 'Chờ tiếp nhận thiết bị'),
  converted('CONVERTED', 'Đã tiếp nhận'),
  cancelled('CANCELLED', 'Đã hủy');

  const RequestStatus(this.dbValue, this.label);
  final String dbValue;
  final String label;
}

/// TrangThaiDuyetNoiBo
enum InternalQuoteStatus {
  pending('PENDING', 'Chờ duyệt nội bộ'),
  approved('APPROVED', 'Đã duyệt'),
  rejected('REJECTED', 'Từ chối');

  const InternalQuoteStatus(this.dbValue, this.label);
  final String dbValue;
  final String label;
}

/// KhachXacNhan
enum CustomerQuoteStatus {
  pending('PENDING', 'Chờ xác nhận'),
  accepted('ACCEPTED', 'Đồng ý sửa'),
  declined('DECLINED', 'Không đồng ý');

  const CustomerQuoteStatus(this.dbValue, this.label);
  final String dbValue;
  final String label;
}

// ─────────────────────────────────────────────────────────────────────────────
// Model classes
// ─────────────────────────────────────────────────────────────────────────────

/// A mock warranty / repair request submitted online by the customer.
/// Corresponds to YeuCauBaoHanh in the DB schema.
class MockRequest {
  const MockRequest({
    required this.id,
    required this.deviceName,
    required this.deviceCategory,
    required this.problemDescription,
    required this.status,
    required this.submittedAt,
    this.ticketStatus,
    this.ticketId,
    this.quoteTotal,
    this.customerName,
    this.phone,
    this.identifierType,
    this.serialOrImei,
    this.preferredStation,
  });

  /// WRQ-XXXX style identifier (maps to MaYeuCau).
  final String id;

  /// Human-readable device name (e.g. "MacBook Pro 16"")
  final String deviceName;

  /// Device category for icon selection (e.g. 'laptop', 'phone', 'camera', 'tv')
  final String deviceCategory;

  /// Customer-supplied problem description (maps to MoTaLoi).
  final String problemDescription;

  /// Online request status (maps to YeuCauBaoHanh.TrangThai).
  final RequestStatus status;

  /// Date/time the request was submitted.
  final DateTime submittedAt;

  /// If the request was converted to a service ticket, the ticket's status.
  final TicketStatus? ticketStatus;

  /// REP-XXXX style identifier (maps to MaPhieuTN).
  final String? ticketId;

  /// Quoted total if a quote has been issued (maps to PhieuBaoGia.TongTienThanhToan).
  final double? quoteTotal;

  // Entered form data for this in-memory demo request.
  final String? customerName;
  final String? phone;
  final String? identifierType;
  final String? serialOrImei;
  final String? preferredStation;

  MockRequest withTicketStatus(TicketStatus nextStatus) => MockRequest(
    id: id,
    deviceName: deviceName,
    deviceCategory: deviceCategory,
    problemDescription: problemDescription,
    status: status,
    submittedAt: submittedAt,
    ticketStatus: nextStatus,
    ticketId: ticketId,
    quoteTotal: quoteTotal,
    customerName: customerName,
    phone: phone,
    identifierType: identifierType,
    serialOrImei: serialOrImei,
    preferredStation: preferredStation,
  );

  /// Returns true when the customer must take action (confirm quote, pick up device).
  bool get requiresAction =>
      ticketStatus == TicketStatus.awaitingCustomerConfirmation ||
      ticketStatus == TicketStatus.completed;
}

class MockQuoteItem {
  const MockQuoteItem({
    required this.id,
    required this.name,
    required this.isComponent,
    required this.quantity,
    required this.unitPrice,
    required this.total,
  });

  final String id;
  final String name;
  final bool isComponent; // true = linh kiện, false = nhân công
  final int quantity;
  final double unitPrice;
  final double total;
}

class MockQuotation {
  const MockQuotation({
    required this.id,
    required this.ticketId,
    required this.internalStatus,
    required this.customerStatus,
    required this.items,
    required this.totalAmount,
    this.customerRejectionReason,
  });

  final String id;
  final String ticketId;
  final InternalQuoteStatus internalStatus;
  final CustomerQuoteStatus customerStatus;
  final List<MockQuoteItem> items;
  final double totalAmount;
  final String? customerRejectionReason;

  MockQuotation withCustomerDecision(
    CustomerQuoteStatus decision, {
    String? reason,
  }) => MockQuotation(
    id: id,
    ticketId: ticketId,
    internalStatus: internalStatus,
    customerStatus: decision,
    items: items,
    totalAmount: totalAmount,
    customerRejectionReason: reason,
  );
}

/// A mock push notification.
/// Corresponds to ThongBao in the DB schema.
class MockNotification {
  const MockNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.isRead,
    required this.createdAt,
    this.relatedRequestId,
  });

  final String id;
  final String title;
  final String body;
  final bool isRead;
  final DateTime createdAt;
  final String? relatedRequestId;
}

/// A mock registered device for the customer.
/// Corresponds to ThietBi in the DB schema.
class MockDevice {
  const MockDevice({
    required this.id,
    required this.identifierType,
    required this.identifierValue,
    required this.deviceName,
    required this.deviceCategory,
    required this.model,
    required this.manufacturer,
    this.warrantyActivationDate,
    this.warrantyExpiryDate,
  });

  /// Internal DB id (e.g. 'DEV-001')
  final String id;

  /// Identity type: 'SERIAL' or 'IMEI'
  final String identifierType;

  /// The actual serial number or IMEI
  final String identifierValue;

  /// Human-readable device name (e.g. "MacBook Pro 16"")
  final String deviceName;

  /// Device category for icon selection (e.g. 'laptop', 'phone')
  final String deviceCategory;

  /// Specific model (e.g. "A2141")
  final String model;

  /// Manufacturer (e.g. "Apple")
  final String manufacturer;

  /// Date the warranty was activated
  final DateTime? warrantyActivationDate;

  /// Date the warranty expires
  final DateTime? warrantyExpiryDate;

  bool get isWarrantyExpired {
    if (warrantyExpiryDate == null) return false;
    return DateTime.now().isAfter(warrantyExpiryDate!);
  }

  int? get warrantyDaysRemaining {
    if (warrantyExpiryDate == null) return null;
    final diff = warrantyExpiryDate!.difference(DateTime.now()).inDays;
    return diff > 0 ? diff : 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sample data
// ─────────────────────────────────────────────────────────────────────────────

/// Mock devices registered to the customer.
final List<MockDevice> mockDevices = [
  MockDevice(
    id: 'DEV-101',
    identifierType: 'SERIAL',
    identifierValue: 'C02CG123MD6R',
    deviceName: 'MacBook Pro 16"',
    deviceCategory: 'laptop',
    model: 'A2141',
    manufacturer: 'Apple',
    warrantyActivationDate: _d(2025, 5, 10),
    warrantyExpiryDate: _d(2027, 5, 10),
  ),
  MockDevice(
    id: 'DEV-102',
    identifierType: 'IMEI',
    identifierValue: '358912345678901',
    deviceName: 'Galaxy S24 Ultra',
    deviceCategory: 'phone',
    model: 'SM-S928B',
    manufacturer: 'Samsung',
    warrantyActivationDate: _d(2026, 1, 15),
    warrantyExpiryDate: _d(2027, 1, 15),
  ),
  MockDevice(
    id: 'DEV-103',
    identifierType: 'SERIAL',
    identifierValue: 'S01V1234567',
    deviceName: 'OLED TV 55"',
    deviceCategory: 'tv',
    model: 'OLED55C1',
    manufacturer: 'LG',
    warrantyActivationDate: _d(2021, 11, 20),
    warrantyExpiryDate: _d(2023, 11, 20), // Expired
  ),
];

/// Mock requests — use these in all screens that list or detail requests.
///
/// Records are taken from the demo data in TrungTamBaoHanhDB_SqlServer.sql
/// and adapted for the customer app perspective.
final List<MockRequest> mockRequests = [
  // ① Laptop — ticket COMPLETED → customer needs to pick up (needs action).
  MockRequest(
    id: 'WRQ-4817',
    deviceName: 'MacBook Pro 16"',
    deviceCategory: 'laptop',
    problemDescription: 'Bàn phím bị liệt phím Space, gõ không ăn.',
    status: RequestStatus.converted,
    submittedAt: _d(2026, 10, 1, 9, 41),
    ticketStatus: TicketStatus.completed,
    ticketId: 'REP-3052',
  ),

  // ② Smartphone — quote awaiting customer confirmation (needs action).
  MockRequest(
    id: 'WRQ-4790',
    deviceName: 'Galaxy S24 Ultra',
    deviceCategory: 'phone',
    problemDescription:
        'Màn hình xuất hiện sọc dọc màu xanh sau khi cập nhật phần mềm.',
    status: RequestStatus.converted,
    submittedAt: _d(2026, 9, 30, 20, 15),
    ticketStatus: TicketStatus.awaitingCustomerConfirmation,
    ticketId: 'REP-3047',
    quoteTotal: 8650000,
  ),

  // ③ Camera — awaiting parts (in progress, no action needed).
  MockRequest(
    id: 'WRQ-4749',
    deviceName: 'Sony Alpha A7 IV',
    deviceCategory: 'camera',
    problemDescription:
        'Màn trập kêu bất thường, ảnh chụp bị tối một nửa khung hình.',
    status: RequestStatus.converted,
    submittedAt: _d(2026, 9, 28, 14, 0),
    ticketStatus: TicketStatus.awaitingParts,
    ticketId: 'REP-3049',
  ),

  // ④ TV — repairing (in progress).
  MockRequest(
    id: 'WRQ-4703',
    deviceName: 'OLED TV 55"',
    deviceCategory: 'tv',
    problemDescription: 'Màn hình hiện sọc ngang, một vùng bị tối.',
    status: RequestStatus.converted,
    submittedAt: _d(2026, 9, 25, 10, 30),
    ticketStatus: TicketStatus.repairing,
    ticketId: 'REP-3041',
  ),

  // ⑤ Laptop — pending intake (newly submitted, centre hasn't received yet).
  MockRequest(
    id: 'WRQ-4800',
    deviceName: 'Dell Inspiron 15',
    deviceCategory: 'laptop',
    problemDescription:
        'Máy không nhận sạc, đèn sạc không sáng dù đã thử nhiều dây.',
    status: RequestStatus.pendingIntake,
    submittedAt: _d(2026, 10, 5, 8, 0),
  ),
];

final List<MockQuotation> mockQuotations = [
  MockQuotation(
    id: 'QTE-1001',
    ticketId: 'REP-3047', // Maps to WRQ-4790 (Galaxy S24 Ultra)
    internalStatus: InternalQuoteStatus.approved,
    customerStatus: CustomerQuoteStatus.pending,
    totalAmount: 8650000,
    items: const [
      MockQuoteItem(
        id: 'QI-1',
        name: 'Màn hình Samsung Galaxy S24 Ultra (dữ liệu Mock)',
        isComponent: true,
        quantity: 1,
        unitPrice: 8200000,
        total: 8200000,
      ),
      MockQuoteItem(
        id: 'QI-2',
        name: 'Công thay màn hình',
        isComponent: false,
        quantity: 1,
        unitPrice: 450000,
        total: 450000,
      ),
    ],
  ),
];

/// Mock notifications for the Thông báo tab.
final List<MockNotification> mockNotifications = [
  MockNotification(
    id: 'notif_001',
    title: 'Thiết bị đã sẵn sàng để nhận',
    body: 'MacBook Pro 16" (REP-3052) đã hoàn thành, đang chờ bàn giao.',
    isRead: false,
    createdAt: _d(2026, 10, 7, 16, 40),
    relatedRequestId: 'WRQ-4817',
  ),
  MockNotification(
    id: 'notif_002',
    title: 'Báo giá sửa chữa đã có',
    body:
        'Vui lòng xác nhận báo giá sửa chữa cho thiết bị Galaxy S24 Ultra (REP-3047).',
    isRead: false,
    createdAt: _d(2026, 9, 30, 20, 20),
    relatedRequestId: 'WRQ-4790',
  ),
  MockNotification(
    id: 'notif_003',
    title: 'Chờ xác nhận báo giá',
    body:
        'Báo giá sửa chữa cho Galaxy S24 Ultra (REP-3047) đang chờ bạn xác nhận.',
    isRead: false,
    createdAt: _d(2026, 10, 1, 8, 0),
    relatedRequestId: 'WRQ-4790',
  ),
  MockNotification(
    id: 'notif_004',
    title: 'Đã gửi yêu cầu trực tuyến',
    body: 'Yêu cầu WRQ-4790 đã được gửi. Trung tâm chưa nhận thiết bị.',
    isRead: true,
    createdAt: _d(2026, 9, 30, 20, 15),
    relatedRequestId: 'WRQ-4790',
  ),
];

int _nextDemoRequestNumber = 0;
final ValueNotifier<int> mockDataRevision = ValueNotifier<int>(0);

void notifyMockDataChanged() => mockDataRevision.value++;

/// Adds one request to the list shared by Home, request list and details.
/// Demo codes and records exist only until the app process restarts.
MockRequest submitMockRequest({
  required String deviceName,
  required String deviceCategory,
  required String problemDescription,
  required String customerName,
  required String phone,
  required String identifierType,
  required String serialOrImei,
  required String preferredStation,
  DateTime? submittedAt,
  List<MockRequest>? requests,
}) {
  final records = requests ?? mockRequests;
  if ([
    deviceName,
    deviceCategory,
    problemDescription,
    customerName,
    phone,
    identifierType,
    serialOrImei,
    preferredStation,
  ].any((value) => value.trim().isEmpty)) {
    throw ArgumentError('Mock request fields must not be empty');
  }
  String code;
  do {
    code = 'WRQ-DEMO-${(++_nextDemoRequestNumber).toString().padLeft(4, '0')}';
  } while (records.any((request) => request.id == code));

  final request = MockRequest(
    id: code,
    deviceName: deviceName.trim(),
    deviceCategory: deviceCategory.trim(),
    problemDescription: problemDescription.trim(),
    customerName: customerName.trim(),
    phone: phone.trim(),
    identifierType: identifierType.trim(),
    serialOrImei: serialOrImei.trim(),
    preferredStation: preferredStation.trim(),
    status: RequestStatus.pendingIntake,
    submittedAt: submittedAt ?? DateTime.now(),
  );
  records.insert(0, request);
  if (identical(records, mockRequests)) notifyMockDataChanged();
  return request;
}

/// Mirrors the approved customer quotation transitions for an in-memory demo.
/// A component line represents the sample scenario that needs parts.
TicketStatus decideMockQuotation(
  String requestId,
  CustomerQuoteStatus decision, {
  String? reason,
  List<MockRequest>? requests,
  List<MockQuotation>? quotations,
}) {
  final requestRecords = requests ?? mockRequests;
  final quoteRecords = quotations ?? mockQuotations;
  final requestIndex = requestRecords.indexWhere(
    (item) => item.id == requestId,
  );
  if (requestIndex < 0) throw StateError('Không tìm thấy yêu cầu Mock.');
  final request = requestRecords[requestIndex];
  final quoteIndex = quoteRecords.indexWhere(
    (item) => item.ticketId == request.ticketId,
  );
  if (quoteIndex < 0) throw StateError('Không tìm thấy báo giá Mock.');
  final quote = quoteRecords[quoteIndex];
  if (request.ticketStatus != TicketStatus.awaitingCustomerConfirmation ||
      quote.internalStatus != InternalQuoteStatus.approved ||
      quote.customerStatus != CustomerQuoteStatus.pending) {
    throw StateError('Báo giá Mock không còn chờ khách xác nhận.');
  }

  late final TicketStatus nextStatus;
  if (decision == CustomerQuoteStatus.accepted) {
    nextStatus = quote.items.any((item) => item.isComponent)
        ? TicketStatus.awaitingParts
        : TicketStatus.repairing;
  } else if (decision == CustomerQuoteStatus.declined &&
      reason != null &&
      reason.trim().isNotEmpty) {
    nextStatus = TicketStatus.awaitingReturn;
  } else {
    throw ArgumentError('Quyết định Mock hoặc lý do từ chối không hợp lệ.');
  }

  quoteRecords[quoteIndex] = quote.withCustomerDecision(
    decision,
    reason: decision == CustomerQuoteStatus.declined ? reason!.trim() : null,
  );
  requestRecords[requestIndex] = request.withTicketStatus(nextStatus);
  if (identical(requestRecords, mockRequests)) notifyMockDataChanged();
  return nextStatus;
}

/// Returns requests that require the customer's action right now.
List<MockRequest> get actionRequiredRequests =>
    mockRequests.where((r) => r.requiresAction).toList();

/// Returns requests currently in progress at the service centre.
List<MockRequest> get inProgressRequests => mockRequests
    .where(
      (r) =>
          r.ticketStatus != null &&
          r.ticketStatus != TicketStatus.completed &&
          r.ticketStatus != TicketStatus.delivered &&
          r.ticketStatus != TicketStatus.returnedUnrepaired &&
          !r.requiresAction,
    )
    .toList();

/// Unread notification count.
int get unreadNotificationCount =>
    mockNotifications.where((n) => !n.isRead).length;

// Helper — construct a DateTime without relying on named constructor params.
DateTime _d(int y, int m, int d, [int h = 0, int min = 0]) =>
    DateTime(y, m, d, h, min);
