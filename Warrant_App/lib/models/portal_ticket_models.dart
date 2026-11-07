/// Read-only customer ticket DTOs from the Soopi portal API.
/// Request status and ticket status are separate backend concepts.
class PortalTicketSummary {
  const PortalTicketSummary({
    required this.code,
    required this.receivedAt,
    required this.status,
    required this.stopped,
    required this.currentStep,
    this.productName,
    this.serialOrImei,
    this.rating,
    this.paidAmount = 0,
  });

  final String code;
  final String? productName;
  final String? serialOrImei;
  final DateTime receivedAt;
  final String status;
  final bool stopped;
  final int currentStep;
  final int? rating;
  final num paidAmount;

  factory PortalTicketSummary.fromJson(Map<String, dynamic> json) =>
      PortalTicketSummary(
        code: json['code'] as String,
        productName: json['productName'] as String?,
        serialOrImei: json['serialOrImei'] as String?,
        receivedAt: DateTime.parse(json['receivedAt'] as String),
        status: json['status'] as String,
        stopped: json['stopped'] as bool,
        currentStep: json['currentStep'] as int,
        rating: json['rating'] as int?,
        paidAmount: json['paidAmount'] as num? ?? 0,
      );
}

class PortalStep {
  const PortalStep(this.key, this.label, this.state);
  final String key;
  final String label;
  final String state;

  factory PortalStep.fromJson(Map<String, dynamic> json) => PortalStep(
    json['key'] as String,
    json['label'] as String,
    json['state'] as String,
  );
}

class PortalNote {
  const PortalNote(this.at, this.text);
  final DateTime at;
  final String text;

  factory PortalNote.fromJson(Map<String, dynamic> json) =>
      PortalNote(DateTime.parse(json['at'] as String), json['text'] as String);
}

class PortalCosts {
  const PortalCosts({
    required this.inWarrantyAmount,
    required this.outOfWarrantyParts,
    required this.serviceFee,
    required this.vat,
    required this.total,
    required this.paymentStatus,
    this.paymentQr,
  });
  final num inWarrantyAmount;
  final num outOfWarrantyParts;
  final num serviceFee;
  final num vat;
  final num total;
  final String paymentStatus;

  /// Chỉ có khi phiếu hoàn tất, còn nợ và server đã cấu hình tài khoản VietQR.
  final PaymentQr? paymentQr;

  factory PortalCosts.fromJson(Map<String, dynamic> json) => PortalCosts(
    inWarrantyAmount: json['inWarrantyAmount'] as num,
    outOfWarrantyParts: json['outOfWarrantyParts'] as num,
    serviceFee: json['serviceFee'] as num,
    vat: json['vat'] as num,
    total: json['total'] as num,
    paymentStatus: json['paymentStatus'] as String,
    paymentQr: json['paymentQr'] == null
        ? null
        : PaymentQr.fromJson(json['paymentQr'] as Map<String, dynamic>),
  );
}

/// Ảnh VietQR do server tạo sẵn số tiền và nội dung chuyển khoản.
class PaymentQr {
  const PaymentQr({
    required this.imageUrl,
    required this.bankId,
    required this.accountNo,
    required this.amount,
    required this.transferNote,
    this.accountName,
  });
  final String imageUrl;
  final String bankId;
  final String accountNo;
  final String? accountName;
  final num amount;
  final String transferNote;

  factory PaymentQr.fromJson(Map<String, dynamic> json) => PaymentQr(
    imageUrl: json['imageUrl'] as String,
    bankId: json['bankId'] as String,
    accountNo: json['accountNo'] as String,
    accountName: json['accountName'] as String?,
    amount: json['amount'] as num,
    transferNote: json['transferNote'] as String,
  );
}

class PortalQuotationLine {
  const PortalQuotationLine({
    required this.lineNo,
    required this.quantity,
    this.description,
    this.unitPrice,
    this.laborFee,
    this.lineTotal,
  });
  final int lineNo;
  final String? description;
  final int quantity;
  final num? unitPrice;
  final num? laborFee;
  final num? lineTotal;

  factory PortalQuotationLine.fromJson(Map<String, dynamic> json) =>
      PortalQuotationLine(
        lineNo: json['lineNo'] as int,
        description: json['description'] as String?,
        quantity: json['quantity'] as int,
        unitPrice: json['unitPrice'] as num?,
        laborFee: json['laborFee'] as num?,
        lineTotal: json['lineTotal'] as num?,
      );
}

class PortalPendingQuotation {
  const PortalPendingQuotation({
    required this.code,
    required this.vatRate,
    required this.lines,
    required this.partsTotal,
    required this.laborTotal,
    required this.grandTotal,
    this.validUntil,
    this.respondBy,
  });
  final String code;
  final DateTime? validUntil;
  final DateTime? respondBy;
  final num vatRate;
  final List<PortalQuotationLine> lines;
  final num partsTotal;
  final num laborTotal;
  final num grandTotal;

  factory PortalPendingQuotation.fromJson(Map<String, dynamic> json) =>
      PortalPendingQuotation(
        code: json['code'] as String,
        validUntil: DateTime.tryParse(json['validUntil'] as String? ?? ''),
        respondBy: DateTime.tryParse(json['respondBy'] as String? ?? ''),
        vatRate: json['vatRate'] as num,
        lines: (json['lines'] as List<dynamic>)
            .map(
              (item) =>
                  PortalQuotationLine.fromJson(item as Map<String, dynamic>),
            )
            .toList(),
        partsTotal: json['partsTotal'] as num,
        laborTotal: json['laborTotal'] as num,
        grandTotal: json['grandTotal'] as num,
      );
}

class PortalTicketDetail {
  const PortalTicketDetail({
    required this.code,
    required this.receivedAt,
    required this.status,
    required this.stopped,
    required this.steps,
    required this.customerNotes,
    required this.costs,
    required this.canRate,
    this.productName,
    this.brandName,
    this.serialOrImei,
    this.promisedReturnAt,
    this.pendingQuotation,
    this.handedOverAt,
    this.rating,
  });

  final String code;
  final String? productName;
  final String? brandName;
  final String? serialOrImei;
  final DateTime receivedAt;
  final DateTime? promisedReturnAt;
  final String status;
  final bool stopped;
  final List<PortalStep> steps;
  final List<PortalNote> customerNotes;
  final PortalCosts costs;
  final PortalPendingQuotation? pendingQuotation;
  final DateTime? handedOverAt;
  final int? rating;
  final bool canRate;

  factory PortalTicketDetail.fromJson(Map<String, dynamic> json) =>
      PortalTicketDetail(
        code: json['code'] as String,
        productName: json['productName'] as String?,
        brandName: json['brandName'] as String?,
        serialOrImei: json['serialOrImei'] as String?,
        receivedAt: DateTime.parse(json['receivedAt'] as String),
        promisedReturnAt: DateTime.tryParse(
          json['promisedReturnAt'] as String? ?? '',
        ),
        status: json['status'] as String,
        stopped: json['stopped'] as bool,
        steps: (json['steps'] as List<dynamic>)
            .map((item) => PortalStep.fromJson(item as Map<String, dynamic>))
            .toList(),
        customerNotes: (json['customerNotes'] as List<dynamic>)
            .map((item) => PortalNote.fromJson(item as Map<String, dynamic>))
            .toList(),
        costs: PortalCosts.fromJson(json['costs'] as Map<String, dynamic>),
        pendingQuotation: json['pendingQuotation'] == null
            ? null
            : PortalPendingQuotation.fromJson(
                json['pendingQuotation'] as Map<String, dynamic>,
              ),
        handedOverAt: DateTime.tryParse(json['handedOverAt'] as String? ?? ''),
        rating: json['rating'] as int?,
        canRate: json['canRate'] as bool,
      );
}

String portalTicketStatusLabel(String status) => switch (status) {
  'RECEIVED' => 'Đã tiếp nhận thiết bị',
  'INSPECTING' => 'Đang kiểm tra',
  'DIAGNOSED' => 'Đã chẩn đoán',
  'AWAITING_QUOTE_APPROVAL' => 'Chờ duyệt báo giá nội bộ',
  'AWAITING_CUSTOMER_CONFIRMATION' => 'Chờ khách xác nhận báo giá',
  'AWAITING_PARTS' => 'Chờ linh kiện',
  'AWAITING_RETURN' => 'Chờ trả thiết bị',
  'REPAIRING' => 'Đang sửa chữa',
  'COMPLETED' => 'Đã hoàn thành sửa chữa',
  'DELIVERED' => 'Đã bàn giao',
  'RETURNED_UNREPAIRED' => 'Đã trả thiết bị chưa sửa',
  _ => status,
};
