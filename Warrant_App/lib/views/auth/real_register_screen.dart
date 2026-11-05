import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../router/app_router.dart';
import '../../services/i_api_service.dart';
import '../../theme/app_theme.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../widgets/custom_text_field.dart';
import 'auth_form_validators.dart';

/// Real customer registration: phone is the login/contact, email receives OTP.
class RealRegisterScreen extends StatefulWidget {
  const RealRegisterScreen({super.key});

  @override
  State<RealRegisterScreen> createState() => _RealRegisterScreenState();
}

class _RealRegisterScreenState extends State<RealRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _otp = TextEditingController();
  final _password = TextEditingController();
  final _confirmation = TextEditingController();
  Timer? _timer;
  String? _otpSentTo;
  String? _message;
  String? _phoneError;
  String? _emailError;
  int _resendIn = 0;
  bool _sending = false;
  bool _submitting = false;
  bool _uncertain = false;
  bool _hidePassword = true;
  bool _hideConfirmation = true;

  @override
  void dispose() {
    _timer?.cancel();
    for (final controller in [
      _name,
      _phone,
      _email,
      _otp,
      _password,
      _confirmation,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _startCooldown(int seconds) {
    _timer?.cancel();
    setState(() => _resendIn = seconds.clamp(0, 600));
    if (_resendIn == 0) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      setState(() => _resendIn--);
      if (_resendIn <= 0) timer.cancel();
    });
  }

  void _emailChanged(String value) {
    if (_otpSentTo != null && value.trim().toLowerCase() != _otpSentTo) {
      setState(() {
        _otpSentTo = null;
        _otp.clear();
        _message = 'Email đã thay đổi. Vui lòng yêu cầu mã OTP mới.';
      });
    }
    if (_emailError != null) setState(() => _emailError = null);
  }

  Future<void> _requestOtp() async {
    if (_sending || _submitting || _resendIn > 0) return;
    final phoneError = validateCustomerPhone(_phone.text);
    final emailError = validateCustomerEmail(_email.text);
    setState(() {
      _phoneError = phoneError;
      _emailError = emailError;
      _message = null;
    });
    if (phoneError != null || emailError != null) return;
    final requestedEmail = _email.text.trim().toLowerCase();
    final requestedPhone = _phone.text.trim();
    setState(() => _sending = true);
    try {
      final issued = await context.read<AuthViewModel>().requestRegistrationOtp(
        requestedEmail,
        requestedPhone,
      );
      if (!mounted) return;
      final emailStillMatches =
          _email.text.trim().toLowerCase() == requestedEmail;
      setState(() {
        _otpSentTo = emailStillMatches ? requestedEmail : null;
        _message = emailStillMatches
            ? 'Máy chủ đã cấp mã xác minh. Kiểm tra email; mã có hiệu lực ${issued.expiresIn ~/ 60} phút.'
            : 'Email đã thay đổi khi gửi mã. Hãy dùng đúng email đã gửi hoặc yêu cầu mã mới sau thời gian chờ.';
      });
      _startCooldown(issued.resendAfter);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _message = error.message);
      // The server may have issued the code even if its response was lost.
      if (error.statusCode == null || error.statusCode! >= 500) {
        _startCooldown(60);
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _submit() async {
    if (_submitting || _sending || _uncertain) return;
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    final email = _email.text.trim().toLowerCase();
    if (_otpSentTo != email) {
      setState(
        () => _message = 'Vui lòng gửi mã OTP tới đúng email đang nhập.',
      );
      return;
    }
    setState(() {
      _submitting = true;
      _message = null;
    });
    final auth = context.read<AuthViewModel>();
    final success = await auth.registerUser(
      fullName: _name.text.trim(),
      phone: _phone.text.trim(),
      email: email,
      emailOtp: _otp.text.trim(),
      password: _password.text,
    );
    if (!mounted) return;
    if (!success) {
      final error = auth.lastRegistrationError;
      setState(() {
        _uncertain =
            error?.statusCode == null || (error?.statusCode ?? 0) >= 500;
        _message = _uncertain
            ? 'Chưa rõ tài khoản đã được tạo hay chưa. Hãy thử đăng nhập trước khi đăng ký lại.'
            : auth.errorMessage;
      });
      auth.clearError();
    }
    setState(() => _submitting = false);
    // On success the existing authenticated router redirect opens Home.
  }

  Widget _error(String? message) => message == null
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            message,
            style: const TextStyle(color: AppColors.error, fontSize: 12),
          ),
        );

  @override
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.milkCream,
    appBar: AppBar(
      title: Text(
        'Đăng ký tài khoản',
        style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
      ),
      leading: IconButton(
        tooltip: 'Quay lại đăng nhập',
        icon: const Icon(Icons.arrow_back_rounded),
        onPressed: _submitting
            ? null
            : () => context.canPop()
                  ? context.pop()
                  : context.go(AppRoutes.login),
      ),
    ),
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Container(
              padding: const EdgeInsets.all(26),
              decoration: BoxDecoration(
                color: AppColors.paperWhite,
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: AppColors.sageBorder, width: 1),
                boxShadow: AppShadows.smoothCard,
              ),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Tạo tài khoản mới',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.penguinNavy,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Đăng ký tài khoản để theo dõi và quản lý bảo hành thiết bị.',
                      style: GoogleFonts.inter(
                        color: AppColors.sageMuted,
                        fontSize: 13.5,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.mintWash,
                        borderRadius: BorderRadius.circular(AppRadius.control),
                        border: Border.all(color: AppColors.mintBorder),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.info_outline_rounded, size: 16, color: AppColors.forest),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Số điện thoại dùng để đăng nhập và liên hệ khi cần. Mã OTP gửi qua email, không qua SMS.',
                              style: GoogleFonts.inter(fontSize: 12, color: AppColors.forestDeep),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_message != null) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: _uncertain ? AppColors.honeyTint : AppColors.mintWash,
                          borderRadius: BorderRadius.circular(AppRadius.control),
                          border: Border.all(color: _uncertain ? AppColors.honeyBorder : AppColors.mintBorder),
                        ),
                        child: Text(
                          _message!,
                          key: const ValueKey('registration-message'),
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            color: _uncertain ? AppColors.honeyText : AppColors.forestDeep,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
              CustomTextField(
                label: 'Họ và tên *',
                hintText: 'Ví dụ: Nguyễn Văn A',
                prefixIcon: Icons.person_outline,
                controller: _name,
                keyboardType: TextInputType.name,
                validator: (value) => (value ?? '').trim().isEmpty
                    ? 'Vui lòng nhập họ và tên.'
                    : null,
              ),
              const SizedBox(height: 18),
              CustomTextField(
                label: 'Số điện thoại *',
                hintText: '09xxxxxxxx',
                prefixIcon: Icons.phone_outlined,
                controller: _phone,
                keyboardType: TextInputType.phone,
                validator: validateCustomerPhone,
                onChanged: (_) {
                  if (_phoneError != null) setState(() => _phoneError = null);
                },
              ),
              _error(_phoneError),
              const Text(
                'Dùng làm tên đăng nhập.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 18),
              CustomTextField(
                label: 'Email *',
                hintText: 'name@example.com',
                prefixIcon: Icons.mail_outline,
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                validator: validateCustomerEmail,
                onChanged: _emailChanged,
              ),
              _error(_emailError),
              const SizedBox(height: 8),
              OutlinedButton(
                key: const ValueKey('send-registration-otp'),
                onPressed: _sending || _submitting || _resendIn > 0
                    ? null
                    : _requestOtp,
                child: Text(
                  _sending
                      ? 'Đang yêu cầu mã…'
                      : _resendIn > 0
                      ? 'Gửi lại sau ${_resendIn}s'
                      : _otpSentTo == null
                      ? 'Gửi mã OTP qua email'
                      : 'Gửi lại mã OTP',
                ),
              ),
              const SizedBox(height: 18),
              CustomTextField(
                label: 'Mã OTP *',
                hintText: 'Nhập mã gồm 6 chữ số',
                prefixIcon: Icons.shield_outlined,
                controller: _otp,
                keyboardType: TextInputType.number,
                validator: (value) => _otpSentTo == null
                    ? 'Bấm “Gửi mã OTP” để nhận mã xác minh.'
                    : validateEmailOtp(value),
              ),
              const SizedBox(height: 18),
              CustomTextField(
                label: 'Mật khẩu *',
                hintText: 'Tối thiểu 10 ký tự, gồm chữ và số',
                prefixIcon: Icons.lock_outline,
                controller: _password,
                obscureText: _hidePassword,
                validator: (value) =>
                    validateCustomerPassword(value, _phone.text),
                suffixIcon: IconButton(
                  tooltip: _hidePassword ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
                  onPressed: () =>
                      setState(() => _hidePassword = !_hidePassword),
                  icon: Icon(
                    _hidePassword
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                  ),
                ),
              ),
              const SizedBox(height: 18),
              CustomTextField(
                label: 'Xác nhận mật khẩu *',
                hintText: 'Nhập lại mật khẩu',
                prefixIcon: Icons.lock_outline,
                controller: _confirmation,
                obscureText: _hideConfirmation,
                validator: (value) => value != _password.text
                    ? 'Mật khẩu xác nhận không khớp.'
                    : null,
                suffixIcon: IconButton(
                  tooltip: _hideConfirmation
                      ? 'Hiện mật khẩu xác nhận'
                      : 'Ẩn mật khẩu xác nhận',
                  onPressed: () =>
                      setState(() => _hideConfirmation = !_hideConfirmation),
                  icon: Icon(
                    _hideConfirmation
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                  ),
                ),
              ),
              const SizedBox(height: 28),
              ElevatedButton(
                key: const ValueKey('submit-registration'),
                onPressed: _submitting || _sending || _uncertain
                    ? null
                    : _submit,
                child: _submitting
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('Tạo tài khoản'),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: _submitting
                    ? null
                    : () => context.go(AppRoutes.login),
                child: const Text('Đã có tài khoản? Đăng nhập ngay'),
              ),
            ],
          ),
        ),
      ),
    ),
  ),
),
),
);
}
