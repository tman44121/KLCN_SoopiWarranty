class AuthResponse {
  const AuthResponse({
    required this.accessToken,
    required this.expiresIn,
    required this.refreshToken,
    required this.refreshExpiresIn,
    required this.user,
  });

  final String accessToken;
  final int expiresIn;
  final String? refreshToken;
  final int? refreshExpiresIn;
  final UserModel user;

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      accessToken: json['accessToken'] as String,
      expiresIn: json['expiresIn'] as int? ?? 0,
      refreshToken: json['refreshToken'] as String?,
      refreshExpiresIn: json['refreshExpiresIn'] as int?,
      user: UserModel.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}

/// Backend response from POST /auth/mobile/otp (HTTP 202).
class EmailOtpIssued {
  const EmailOtpIssued({required this.expiresIn, required this.resendAfter});

  final int expiresIn;
  final int resendAfter;

  factory EmailOtpIssued.fromJson(Map<String, dynamic> json) => EmailOtpIssued(
    expiresIn: (json['expiresIn'] as num).toInt(),
    resendAfter: (json['resendAfter'] as num).toInt(),
  );
}

class UserModel {
  const UserModel({
    required this.id,
    required this.fullName,
    required this.username,
    required this.phone,
    required this.role,
    this.email = '',
    this.address = '',
    this.customerCode,
  });

  final String id;
  final String? customerCode;
  final String fullName;
  final String username;
  final String phone;
  final String role;
  final String email;
  final String address;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    String? extractRole(dynamic rolesList) {
      if (rolesList is List && rolesList.isNotEmpty) {
        final firstRole = rolesList.first;
        if (firstRole is Map<String, dynamic>) {
          return firstRole['code'] as String?;
        }
        if (firstRole is String) return firstRole;
      }
      return null;
    }

    // Handle both Mock schema and Real backend UserView/Profile schema
    return UserModel(
      id: json['accountId'] as String? ?? json['id'] as String? ?? '',
      customerCode: json['customerCode'] as String?,
      fullName:
          json['displayName'] as String? ??
          json['fullName'] as String? ??
          'N/A',
      username: json['username'] as String? ?? json['email'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      email: json['email'] as String? ?? '',
      address: json['address'] as String? ?? '',
      role: extractRole(json['roles']) ?? json['role'] as String? ?? 'customer',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'fullName': fullName,
    'username': username,
    'phone': phone,
    'email': email,
    'address': address,
    'role': role,
  };

  UserModel copyWith({
    String? customerCode,
    String? fullName,
    String? phone,
    String? email,
    String? address,
  }) {
    return UserModel(
      id: id,
      customerCode: customerCode ?? this.customerCode,
      fullName: fullName ?? this.fullName,
      username: username,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      address: address ?? this.address,
      role: role,
    );
  }
}

class OwnedDevice {
  const OwnedDevice({
    required this.code,
    required this.productName,
    required this.brandName,
    required this.identifierType,
    required this.serialOrImei,
    this.warrantyActivatedOn,
    this.warrantyExpiresOn,
    this.warrantyStatus,
  });

  final String code; // identifier value
  final String productName;
  final String brandName;
  final String identifierType;
  final String serialOrImei;
  final String? warrantyActivatedOn;
  final String? warrantyExpiresOn;
  final String? warrantyStatus;

  factory OwnedDevice.fromJson(Map<String, dynamic> json) {
    return OwnedDevice(
      code: json['code'] as String? ?? '',
      productName: json['productName'] as String? ?? '',
      brandName: json['brandName'] as String? ?? '',
      identifierType: json['identifierType'] as String? ?? '',
      serialOrImei: json['serialOrImei'] as String? ?? '',
      warrantyActivatedOn: json['warrantyActivatedOn'] as String?,
      warrantyExpiresOn: json['warrantyExpiresOn'] as String?,
      warrantyStatus: json['warrantyStatus'] as String?,
    );
  }
}
