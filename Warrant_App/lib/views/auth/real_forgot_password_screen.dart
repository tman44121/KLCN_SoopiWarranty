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

/// Mirrors the Web customer flow: email OTP, verify, then reset password.
class RealForgotPasswordScreen extends StatefulWidget {
  const RealForgotPasswordScreen({super.key});

  @override
  State<RealForgotPasswordScreen> createState() =>
      _RealForgotPasswordScreenState();
}

class _RealForgotPasswordScreenState extends State<RealForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _otp = TextEditingController();
  final _password = TextEditingController();
  final _confirmation = TextEditingController();
  Timer? _timer;
  String? _otpSentTo;
  String? _message;
  String? _emailError;
  int _resendIn = 0;
  int _step = 0; // 0: verify email, 1: new password, 2: done
  bool _sending = false;
  bool _busy = false;
  bool _uncertain = false;
  bool _hidePassword = true;
  bool _hideConfirmation = true;

  @override
  void dispose() {
    _timer?.cancel();
    _email.dispose();
    _otp.dispose();
    _password.dispose();
    _confirmation.dispose();
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

  Future<void> _requestOtp() async {
    if (_sending || _busy || _resendIn > 0) return;
    final error = validateCustomerEmail(_email.text);
    setState(() {
      _emailError = error;
      _message = null;
    });
    if (error != null) return;
    final requestedEmail = _email.text.trim().toLowerCase();
    setState(() => _sending = true);
    try {
      final issued = await context
          .read<AuthViewModel>()
          .requestPasswordResetOtp(requestedEmail);
      if (!mounted) return;
      final emailStillMatches =
          _email.text.trim().toLowerCase() == requestedEmail;
      setState(() {
        _otpSentTo = emailStillMatches ? requestedEmail : null;
        _message = emailStillMatches
            ? 'Máy chủ đã cấp mã xác minh. Vui lòng kiểm tra email.'
            : 'Email đã thay đổi khi gửi mã. Hãy dùng đúng email đã gửi hoặc yêu cầu mã mới sau thời gian chờ.';
      });
      _startCooldown(issued.resendAfter);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _message = error.message);
      if (error.statusCode == null || error.statusCode! >= 500) {
        _startCooldown(60);
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _verify() async {
    if (_busy || _sending) return;
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    if (_otpSentTo != _email.text.trim().toLowerCase()) {
      setState(() => _message = 'Vui lòng gửi mã tới đúng email đang nhập.');
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await context.read<AuthViewModel>().verifyPasswordResetOtp(
        _otpSentTo!,
        _otp.text.trim(),
      );
      if (mounted) setState(() => _step = 1);
    } on ApiException catch (error) {
      if (mounted) setState(() => _message = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reset() async {
    if (_busy || _uncertain) return;
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await context.read<AuthViewModel>().resetPasswordWithEmailOtp(
        email: _otpSentTo!,
        otp: _otp.text.trim(),
        newPassword: _password.text,
      );
      if (mounted) setState(() => _step = 2);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        if (error.code == 'OTP_INVALID') {
          _step = 0;
          _otpSentTo = null;
          _otp.clear();
        }
        _uncertain = error.statusCode == null || error.statusCode! >= 500;
        _message = _uncertain
            ? 'Chưa rõ mật khẩu đã đổi hay chưa. Hãy thử đăng nhập bằng mật khẩu mới trước khi yêu cầu mã khác.'
            : error.message;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (context.watch<AuthViewModel>().isMock) {
      return Scaffold(
        backgroundColor: AppColors.milkCream,
        appBar: AppBar(
          title: Text(
            'Quên mật khẩu',
            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
          ),
        ),
        body: Center(
          child: Text(
            'Chức năng này dùng với tài khoản Real.',
            style: GoogleFonts.inter(color: AppColors.sageMuted),
          ),
        ),
      );
    }
    return Scaffold(
      backgroundColor: AppColors.milkCream,
      appBar: AppBar(
        title: Text(
          'Quên mật khẩu',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.go(AppRoutes.login),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
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
                        _step == 2
                            ? 'Đã đổi mật khẩu'
                            : _step == 1
                            ? 'Đặt mật khẩu mới'
                            : 'Lấy lại mật khẩu',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.penguinNavy,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _step == 0
                            ? 'Nhập email đã đăng ký để nhận mã xác minh OTP.'
                            : _step == 1
                            ? 'Mã email đã được xác minh. Tạo mật khẩu mới.'
                            : 'Bạn có thể đăng nhập bằng số điện thoại và mật khẩu mới.',
                        style: GoogleFonts.inter(
                          color: AppColors.sageMuted,
                          fontSize: 13.5,
                          height: 1.4,
                        ),
                      ),
                      if (_message != null) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: _uncertain ? AppColors.honeyTint : AppColors.mintWash,
                            borderRadius: BorderRadius.circular(AppRadius.control),
                            border: Border.all(
                              color: _uncertain ? AppColors.honeyBorder : AppColors.mintBorder,
                            ),
                          ),
                          child: Text(
                            _message!,
                            key: const ValueKey('password-reset-message'),
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              color: _uncertain ? AppColors.honeyText : AppColors.forestDeep,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 22),
                if (_step == 0) ...[
                  CustomTextField(
                    label: 'Email *',
                    hintText: 'name@example.com',
                    prefixIcon: Icons.mail_outline,
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    validator: validateCustomerEmail,
                    onChanged: (value) {
                      if (_otpSentTo != null &&
                          value.trim().toLowerCase() != _otpSentTo) {
                        setState(() {
                          _otpSentTo = null;
                          _otp.clear();
                        });
                      }
                      if (_emailError != null) {
                        setState(() => _emailError = null);
                      }
                    },
                  ),
                  if (_emailError != null)
                    Text(
                      _emailError!,
                      style: const TextStyle(color: AppColors.error),
                    ),
                  const SizedBox(height: 10),
                  OutlinedButton(
                    key: const ValueKey('send-reset-otp'),
                    onPressed: _sending || _busy || _resendIn > 0
                        ? null
                        : _requestOtp,
                    child: Text(
                      _sending
                          ? 'Đang yêu cầu mã…'
                          : _resendIn > 0
                          ? 'Gửi lại sau ${_resendIn}s'
                          : 'Gửi mã OTP qua email',
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
                  const SizedBox(height: 26),
                  ElevatedButton(
                    key: const ValueKey('verify-reset-otp'),
                    onPressed: _busy || _sending ? null : _verify,
                    child: Text(_busy ? 'Đang xác minh…' : 'Xác minh mã'),
                  ),
                ],
                if (_step == 1) ...[
                  CustomTextField(
                    label: 'Mật khẩu mới *',
                    hintText: 'Tối thiểu 10 ký tự, gồm chữ và số',
                    controller: _password,
                    prefixIcon: Icons.lock_outline,
                    obscureText: _hidePassword,
                    validator: (value) => validateCustomerPassword(value, ''),
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
                    controller: _confirmation,
                    prefixIcon: Icons.lock_outline,
                    obscureText: _hideConfirmation,
                    validator: (value) => value != _password.text
                        ? 'Mật khẩu xác nhận không khớp.'
                        : null,
                    suffixIcon: IconButton(
                      tooltip: _hideConfirmation
                          ? 'Hiện mật khẩu xác nhận'
                          : 'Ẩn mật khẩu xác nhận',
                      onPressed: () => setState(
                        () => _hideConfirmation = !_hideConfirmation,
                      ),
                      icon: Icon(
                        _hideConfirmation
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Mật khẩu không được chứa tên đăng nhập hoặc thuộc danh sách mật khẩu phổ biến.',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 26),
                  ElevatedButton(
                    key: const ValueKey('submit-password-reset'),
                    onPressed: _busy || _uncertain ? null : _reset,
                    child: Text(_busy ? 'Đang đổi…' : 'Đổi mật khẩu'),
                  ),
                ],
                if (_step == 2)
                  ElevatedButton(
                    onPressed: () => context.go(AppRoutes.login),
                    child: const Text('Đăng nhập ngay'),
                  ),
                if (_step != 2) ...[
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _busy ? null : () => context.go(AppRoutes.login),
                    child: const Text('Quay lại đăng nhập'),
                  ),
                ],
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
}
