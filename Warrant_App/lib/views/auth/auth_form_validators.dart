/// Client-side guidance matching the public customer auth contract. The
/// backend remains authoritative, including its common-password list.
String? validateCustomerPhone(String? raw) {
  final value = (raw ?? '').trim();
  if (value.isEmpty) return 'Vui lòng nhập số điện thoại.';
  final digits = value.replaceAll(RegExp(r'[^0-9+]'), '');
  final normalized = digits.startsWith('+84')
      ? '0${digits.substring(3)}'
      : digits.replaceAll('+', '');
  if (!RegExp(r'^0[0-9]{9,10}$').hasMatch(normalized)) {
    return 'Số điện thoại cần có 10–11 chữ số và bắt đầu bằng 0.';
  }
  return null;
}

String? validateCustomerEmail(String? raw) {
  final value = (raw ?? '').trim();
  if (value.isEmpty) return 'Vui lòng nhập email để nhận mã OTP.';
  if (value.length > 100 ||
      !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value)) {
    return 'Email chưa đúng định dạng.';
  }
  return null;
}

String? validateEmailOtp(String? raw) {
  if ((raw ?? '').trim().isEmpty) return 'Vui lòng nhập mã OTP.';
  if (!RegExp(r'^[0-9]{6}$').hasMatch(raw!.trim())) {
    return 'Mã OTP gồm 6 chữ số.';
  }
  return null;
}

String? validateCustomerPassword(String? password, String username) {
  final value = password ?? '';
  if (value.isEmpty) return 'Vui lòng nhập mật khẩu.';
  if (value.length < 10 ||
      !value.contains(RegExp(r'\p{L}', unicode: true)) ||
      !value.contains(RegExp(r'[0-9]'))) {
    return 'Mật khẩu cần ít nhất 10 ký tự, có chữ và số.';
  }
  final phone = username.trim().replaceAll(RegExp(r'[^0-9+]'), '');
  final normalized = phone.startsWith('+84')
      ? '0${phone.substring(3)}'
      : phone.replaceAll('+', '');
  if (normalized.isNotEmpty && value.toLowerCase().contains(normalized)) {
    return 'Mật khẩu không được chứa số điện thoại.';
  }
  return null;
}
