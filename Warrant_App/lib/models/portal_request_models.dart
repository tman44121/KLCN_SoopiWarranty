import 'user_model.dart';

/// One optional file part. The stream factory allows a deliberate resubmission
/// after a known validation failure without reusing an exhausted stream.
class RequestAttachment {
  const RequestAttachment({
    required this.name,
    required this.length,
    required this.openRead,
  });

  final String name;
  final int length;
  final Stream<List<int>> Function() openRead;

  static String? validateSelection(List<RequestAttachment> files) {
    if (files.length > 3) return 'Chỉ chọn tối đa 3 tệp như trên Web.';
    for (final file in files) {
      final extension = file.name.split('.').last.toLowerCase();
      final isVideo = extension == 'mp4';
      if (!['jpg', 'jpeg', 'png', 'webp', 'mp4'].contains(extension)) {
        return 'Chỉ chọn ảnh JPEG, PNG, WebP hoặc video MP4.';
      }
      final maxBytes = (isVideo ? 30 : 5) * 1024 * 1024;
      if (file.length <= 0 || file.length > maxBytes) {
        return isVideo
            ? 'Video MP4 phải lớn hơn 0 và không quá 30 MiB.'
            : 'Mỗi ảnh phải lớn hơn 0 và không quá 5 MiB.';
      }
    }
    return null;
  }
}

class PortalDeviceType {
  const PortalDeviceType(this.code, this.name, this.identifierType);
  final String code;
  final String name;
  final String identifierType;

  factory PortalDeviceType.fromJson(Map<String, dynamic> json) =>
      PortalDeviceType(
        json['code'] as String? ?? '',
        json['name'] as String? ?? '',
        json['identifierType'] as String? ?? '',
      );
}

class PortalCategory {
  const PortalCategory(this.code, this.name, this.deviceTypes);
  final String code;
  final String name;
  final List<PortalDeviceType> deviceTypes;

  factory PortalCategory.fromJson(Map<String, dynamic> json) => PortalCategory(
    json['code'] as String? ?? '',
    json['name'] as String? ?? '',
    (json['deviceTypes'] as List<dynamic>? ?? [])
        .map((item) => PortalDeviceType.fromJson(item as Map<String, dynamic>))
        .where((type) => type.code.isNotEmpty)
        .toList(),
  );
}

class PortalStation {
  const PortalStation(this.code, this.name, this.address);
  final String code;
  final String name;
  final String? address;

  factory PortalStation.fromJson(Map<String, dynamic> json) => PortalStation(
    json['code'] as String? ?? '',
    json['name'] as String? ?? '',
    json['address'] as String?,
  );
}

class PortalCatalog {
  const PortalCatalog(this.categories, this.stations);
  final List<PortalCategory> categories;
  final List<PortalStation> stations;

  factory PortalCatalog.fromJson(Map<String, dynamic> json) => PortalCatalog(
    (json['categories'] as List<dynamic>? ?? [])
        .map((item) => PortalCategory.fromJson(item as Map<String, dynamic>))
        .where((category) => category.code.isNotEmpty)
        .toList(),
    (json['stations'] as List<dynamic>? ?? [])
        .map((item) => PortalStation.fromJson(item as Map<String, dynamic>))
        .where((station) => station.code.isNotEmpty)
        .toList(),
  );
}

class OwnWarrantyRequestData {
  const OwnWarrantyRequestData({
    required this.categoryCode,
    required this.deviceTypeCode,
    required this.brandModel,
    required this.identifierType,
    required this.serialOrImei,
    required this.symptom,
    required this.preferredStation,
    this.preferredFrom,
    this.preferredTo,
    this.attachments = const [],
  });

  final String categoryCode;
  final String deviceTypeCode;
  final String brandModel;
  final String identifierType;
  final String serialOrImei;
  final String symptom;
  final String preferredStation;
  final DateTime? preferredFrom;
  final DateTime? preferredTo;
  final List<RequestAttachment> attachments;

  /// Appointment preference is optional in the API; the customer form asks for it.
  Map<String, dynamic> toJson() => {
    'categoryCode': categoryCode,
    'deviceTypeCode': deviceTypeCode,
    'brandModel': brandModel,
    'identifierType': identifierType,
    'serialOrImei': serialOrImei,
    'symptom': symptom,
    'preferredStation': preferredStation,
    if (preferredFrom != null)
      'preferredFrom': preferredFrom!.toUtc().toIso8601String(),
    if (preferredTo != null)
      'preferredTo': preferredTo!.toUtc().toIso8601String(),
  };

  static String? validatePreferredArrival(DateTime? from, DateTime now) {
    if (from == null) return 'Vui lòng chọn thời gian mong muốn mang máy tới.';
    if (!from.isAfter(now)) return 'Vui lòng chọn thời gian trong tương lai.';
    return null;
  }

  static String brandModelOf(OwnedDevice device) {
    final brand = device.brandName.trim();
    final product = device.productName.trim();
    if (product.isEmpty) return brand;
    if (brand.isEmpty ||
        product.toLowerCase().startsWith(brand.toLowerCase())) {
      return product;
    }
    return '$brand $product';
  }

  /// A new device is identified in the online request, then checked at intake.
  /// This does not register the device or activate its warranty.
  static Map<String, String> validateUnregistered({
    required PortalCatalog catalog,
    required String? categoryCode,
    required String? deviceTypeCode,
    required String brandModel,
    required String serialOrImei,
    required String? stationCode,
    required String symptom,
  }) {
    final errors = <String, String>{};
    final category = catalog.categories
        .where((item) => item.code == categoryCode)
        .firstOrNull;
    if (category == null) {
      errors['categoryCode'] = 'Vui lòng chọn nhóm thiết bị.';
    }
    final type = category?.deviceTypes
        .where((item) => item.code == deviceTypeCode)
        .firstOrNull;
    if (type == null ||
        (type.identifierType.toUpperCase() != 'SERIAL' &&
            type.identifierType.toUpperCase() != 'IMEI')) {
      errors['deviceTypeCode'] = 'Vui lòng chọn loại thiết bị hợp lệ.';
    }
    if (brandModel.trim().isEmpty) {
      errors['brandModel'] = 'Vui lòng nhập hãng và model thiết bị.';
    }
    final identifier = serialOrImei.replaceAll(RegExp(r'\s'), '').toUpperCase();
    if (type?.identifierType.toUpperCase() == 'SERIAL' &&
        !RegExp(r'^[A-Z0-9-]{4,50}$').hasMatch(identifier)) {
      errors['serialOrImei'] =
          'Serial cần 4–50 ký tự chữ, số hoặc dấu gạch ngang.';
    } else if (type?.identifierType.toUpperCase() == 'IMEI' &&
        (!RegExp(r'^\d{15}$').hasMatch(identifier) ||
            !_validImei(identifier))) {
      errors['serialOrImei'] = 'IMEI cần 15 chữ số hợp lệ.';
    }
    if (!catalog.stations.any((station) => station.code == stationCode)) {
      errors['preferredStation'] = 'Vui lòng chọn trạm dịch vụ trong danh mục.';
    }
    if (symptom.trim().isEmpty || symptom.trim().length > 2000) {
      errors['symptom'] = 'Vui lòng mô tả lỗi (tối đa 2000 ký tự).';
    }
    return errors;
  }

  static bool _validImei(String value) {
    var sum = 0;
    for (var index = 0; index < value.length; index++) {
      var digit = value.codeUnitAt(value.length - 1 - index) - 48;
      if (index.isOdd) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    return sum % 10 == 0;
  }

  static Map<String, String> validate({
    required OwnedDevice? device,
    required PortalCatalog catalog,
    required String? categoryCode,
    required String? deviceTypeCode,
    required String? stationCode,
    required String symptom,
  }) {
    final errors = <String, String>{};
    if (device == null) {
      errors['device'] = 'Vui lòng chọn thiết bị của bạn.';
      return errors;
    }
    if (brandModelOf(device).isEmpty || device.serialOrImei.trim().isEmpty) {
      errors['device'] =
          'Thiết bị thiếu tên hoặc Serial/IMEI. Vui lòng kiểm tra hồ sơ thiết bị.';
    }
    final category = catalog.categories
        .where((item) => item.code == categoryCode)
        .firstOrNull;
    if (category == null) {
      errors['categoryCode'] = 'Vui lòng chọn nhóm thiết bị.';
    }
    final validType =
        category?.deviceTypes.any(
          (type) =>
              type.code == deviceTypeCode &&
              type.identifierType.toUpperCase() ==
                  device.identifierType.toUpperCase(),
        ) ??
        false;
    if (!validType) {
      errors['deviceTypeCode'] =
          'Vui lòng chọn loại phù hợp với ${device.identifierType}.';
    }
    if (!catalog.stations.any((station) => station.code == stationCode)) {
      errors['preferredStation'] = 'Vui lòng chọn trạm dịch vụ trong danh mục.';
    }
    if (symptom.trim().isEmpty) {
      errors['symptom'] = 'Vui lòng mô tả lỗi của thiết bị.';
    } else if (symptom.trim().length > 2000) {
      errors['symptom'] = 'Mô tả lỗi tối đa 2000 ký tự.';
    }
    return errors;
  }
}

class PortalRequestSummary {
  const PortalRequestSummary({
    required this.code,
    required this.status,
    this.createdAt,
    this.brandModel,
    this.serialOrImei,
    this.ticketCode,
  });
  final String code;
  final String status;
  final DateTime? createdAt;
  final String? brandModel;
  final String? serialOrImei;
  final String? ticketCode;

  factory PortalRequestSummary.fromJson(Map<String, dynamic> json) =>
      PortalRequestSummary(
        code: json['code'] as String? ?? '',
        status: json['status'] as String? ?? '',
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
        brandModel: json['brandModel'] as String?,
        serialOrImei: json['serialOrImei'] as String?,
        ticketCode: json['ticketCode'] as String?,
      );
}

class PortalRequestDetail extends PortalRequestSummary {
  const PortalRequestDetail({
    required super.code,
    required super.status,
    super.createdAt,
    super.brandModel,
    super.serialOrImei,
    super.ticketCode,
    this.categoryCode,
    this.deviceTypeCode,
    this.identifierType,
    this.symptom,
    this.preferredStation,
    this.preferredFrom,
    this.preferredTo,
    this.cancelReason,
  });
  final String? categoryCode;
  final String? deviceTypeCode;
  final String? identifierType;
  final String? symptom;
  final String? preferredStation;
  final DateTime? preferredFrom;
  final DateTime? preferredTo;
  final String? cancelReason;

  factory PortalRequestDetail.fromJson(Map<String, dynamic> json) =>
      PortalRequestDetail(
        code: json['code'] as String? ?? '',
        status: json['status'] as String? ?? '',
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
        brandModel: json['brandModel'] as String?,
        serialOrImei: json['serialOrImei'] as String?,
        ticketCode: json['ticketCode'] as String?,
        categoryCode: json['categoryCode'] as String?,
        deviceTypeCode: json['deviceTypeCode'] as String?,
        identifierType: json['identifierType'] as String?,
        symptom: json['symptom'] as String?,
        preferredStation: json['preferredStation'] as String?,
        preferredFrom: DateTime.tryParse(
          json['preferredFrom'] as String? ?? '',
        ),
        preferredTo: DateTime.tryParse(json['preferredTo'] as String? ?? ''),
        cancelReason: json['cancelReason'] as String?,
      );
}

String portalRequestStatusLabel(String status) => switch (status) {
  'PENDING_INTAKE' => 'Chờ tiếp nhận thiết bị',
  'CONVERTED' => 'Đã lập phiếu tiếp nhận',
  'CANCELLED' => 'Đã hủy',
  _ => status.isEmpty ? 'Chưa rõ trạng thái' : status,
};
