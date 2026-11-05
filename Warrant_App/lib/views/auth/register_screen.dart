import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../router/app_router.dart';
import '../../theme/app_theme.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../widgets/custom_text_field.dart';
import 'real_register_screen.dart';

/// WarrantSafe – Register Screen (connected to AuthViewModel)
///
/// Mock uses the existing two-step demo flow. Real uses the email OTP form.
///   Step 1 — YOUR INFO   : Full Name, Email
///   Step 2 — SECURITY    : Password, Confirm Password, strength rules, T&C
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  // ── Navigation ────────────────────────────────────────────────────
  final PageController _pageController = PageController();
  int _currentStep = 0;

  // ── Step 1 controllers ────────────────────────────────────────────
  final _step1FormKey = GlobalKey<FormState>();
  final _fullNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();

  // ── Step 2 controllers ────────────────────────────────────────────
  final _step2FormKey = GlobalKey<FormState>();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  // ── Step 2 UI state ───────────────────────────────────────────────
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _agreedToTerms = false;

  // ── Password validation ───────────────────────────────────────────
  String _password = '';
  bool get _hasMinLength => _password.length >= 8;
  bool get _hasUppercase => _password.contains(RegExp(r'[A-Z]'));
  bool get _hasNumberOrSymbol =>
      _password.contains(RegExp(r'[0-9!@#\$%^&*(),.?":{}|<>]'));
  bool get _isPasswordValid =>
      _hasMinLength && _hasUppercase && _hasNumberOrSymbol;

  @override
  void dispose() {
    _pageController.dispose();
    _fullNameCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  // ── Navigation helpers ────────────────────────────────────────────

  void _goToStep(int step) {
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOut,
    );
    setState(() => _currentStep = step);
  }

  /// Validates Step 1 before advancing.
  void _onContinue() {
    FocusScope.of(context).unfocus();
    if (_step1FormKey.currentState!.validate()) {
      _goToStep(1);
    }
  }

  /// Validates Step 2 then calls [AuthViewModel.registerUser].
  Future<void> _onCreateAccount() async {
    FocusScope.of(context).unfocus();
    if (!_step2FormKey.currentState!.validate()) return;

    if (!_agreedToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Vui lòng đồng ý với Điều khoản Dịch vụ'),
          backgroundColor: AppColors.warning,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      return;
    }

    final vm = context.read<AuthViewModel>();

    if (!vm.isMock) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Đăng ký qua OTP chưa khả dụng.'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      return;
    }

    await vm.registerUser(
      fullName: _fullNameCtrl.text.trim(),
      phone: '',
      email: _emailCtrl.text.trim(),
      password: _passwordCtrl.text,
    );

    // GoRouter redirects to /profile automatically when isAuthenticated → true.
    if (mounted && vm.errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(vm.errorMessage!),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      vm.clearError();
    }
  }

  // ── Build ─────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final isLoading = context.select<AuthViewModel, bool>((vm) => vm.isLoading);

    if (!context.select<AuthViewModel, bool>((vm) => vm.isMock)) {
      return const RealRegisterScreen();
    }

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // ── Step indicator bar ──────────────────────────────────
            _buildStepIndicator(isLoading: isLoading),

            // ── Page content ────────────────────────────────────────
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                onPageChanged: (i) => setState(() => _currentStep = i),
                children: [
                  _buildStep1(isLoading: isLoading),
                  _buildStep2(isLoading: isLoading),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────
  //  STEP INDICATOR
  // ──────────────────────────────────────────────────────────────────

  Widget _buildStepIndicator({required bool isLoading}) {
    final labels = ['THÔNG TIN', 'BẢO MẬT'];
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 28, 0),
      child: Column(
        children: [
          Row(
            children: [
              if (_currentStep > 0)
                IconButton(
                  tooltip: 'Quay lại thông tin',
                  icon: const Icon(Icons.chevron_left, size: 28),
                  onPressed: isLoading
                      ? null
                      : () => _goToStep(_currentStep - 1),
                  color: AppColors.textSecondary,
                )
              else
                IconButton(
                  tooltip: 'Quay lại đăng nhập',
                  icon: const Icon(Icons.chevron_left, size: 28),
                  onPressed: isLoading ? null : () => Navigator.pop(context),
                  color: AppColors.textSecondary,
                ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'BƯỚC ${_currentStep + 1} TRÊN 2 — ${labels[_currentStep]}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.6,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Animated progress bar
          Padding(
            padding: const EdgeInsets.only(left: 20),
            child: Row(
              children: List.generate(2, (i) {
                return Expanded(
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    height: 3.5,
                    margin: EdgeInsets.only(right: i == 0 ? 6 : 0),
                    decoration: BoxDecoration(
                      color: i <= _currentStep
                          ? AppColors.primaryBlue
                          : AppColors.border,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                );
              }),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────
  //  STEP 1 — YOUR INFO
  // ──────────────────────────────────────────────────────────────────

  Widget _buildStep1({required bool isLoading}) {
    return Form(
      key: _step1FormKey,
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),
            const Text(
              'Tạo tài khoản',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                height: 1.2,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Đăng ký để theo dõi và bảo vệ thiết bị của bạn',
              style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
            const Text(
              'Chế độ minh họa: tài khoản này không được tạo trên hệ thống thật.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 32),

            // Full Name
            CustomTextField(
              label: 'Họ và tên',
              hintText: 'Alex Morgan',
              prefixIcon: Icons.person_outline_rounded,
              keyboardType: TextInputType.name,
              controller: _fullNameCtrl,
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'Vui lòng nhập họ tên';
                }
                if (v.trim().length < 2) return 'Tên quá ngắn';
                return null;
              },
            ),
            const SizedBox(height: 22),

            // Email Address
            CustomTextField(
              label: 'Địa chỉ Email',
              hintText: 'alex@email.com',
              prefixIcon: Icons.mail_outline_rounded,
              keyboardType: TextInputType.emailAddress,
              controller: _emailCtrl,
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'Vui lòng nhập email';
                }
                final emailRegex = RegExp(r'^[\w-.]+@([\w-]+\.)+[\w-]{2,}$');
                if (!emailRegex.hasMatch(v.trim())) {
                  return 'Email không hợp lệ';
                }
                return null;
              },
            ),
            const SizedBox(height: 36),

            // CONTINUE button
            ElevatedButton(
              onPressed: isLoading ? null : _onContinue,
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Flexible(
                    child: Text('TIẾP TỤC', textAlign: TextAlign.center),
                  ),
                  SizedBox(width: 8),
                  Icon(Icons.arrow_forward, size: 18),
                ],
              ),
            ),
            const SizedBox(height: 24),

            _buildLoginLink(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────
  //  STEP 2 — SECURITY
  // ──────────────────────────────────────────────────────────────────

  Widget _buildStep2({required bool isLoading}) {
    return Form(
      key: _step2FormKey,
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),
            const Text(
              'Bảo mật tài khoản',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                height: 1.2,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Tạo một mật khẩu mạnh để bảo vệ dữ liệu của bạn',
              style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 32),

            // Password
            CustomTextField(
              label: 'Mật khẩu',
              hintText: 'Tối thiểu 8 ký tự',
              prefixIcon: Icons.lock_outline_rounded,
              obscureText: _obscurePassword,
              controller: _passwordCtrl,
              onChanged: (v) => setState(() => _password = v),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Vui lòng nhập mật khẩu';
                if (!_isPasswordValid) {
                  return 'Mật khẩu chưa đáp ứng các yêu cầu bên dưới';
                }
                return null;
              },
              suffixIcon: IconButton(
                tooltip: _obscurePassword ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 20,
                  color: AppColors.textHint,
                ),
                onPressed: () =>
                    setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
            const SizedBox(height: 22),

            // Confirm Password
            CustomTextField(
              label: 'Xác nhận Mật khẩu',
              hintText: 'Nhập lại mật khẩu của bạn',
              prefixIcon: Icons.lock_outline_rounded,
              obscureText: _obscureConfirm,
              controller: _confirmCtrl,
              validator: (v) {
                if (v == null || v.isEmpty) {
                  return 'Vui lòng nhập lại mật khẩu';
                }
                if (v != _passwordCtrl.text) {
                  return 'Mật khẩu không khớp';
                }
                return null;
              },
              suffixIcon: IconButton(
                tooltip: _obscureConfirm
                    ? 'Hiện xác nhận mật khẩu'
                    : 'Ẩn xác nhận mật khẩu',
                icon: Icon(
                  _obscureConfirm
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 20,
                  color: AppColors.textHint,
                ),
                onPressed: () =>
                    setState(() => _obscureConfirm = !_obscureConfirm),
              ),
            ),
            const SizedBox(height: 20),

            // Password strength rules
            _buildPasswordRules(),
            const SizedBox(height: 20),

            // Terms checkbox
            _buildTermsCheckbox(),
            const SizedBox(height: 28),

            // CREATE ACCOUNT button
            ElevatedButton(
              onPressed: isLoading ? null : _onCreateAccount,
              child: isLoading
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    )
                  : const Text('TẠO TÀI KHOẢN'),
            ),
            const SizedBox(height: 24),

            _buildLoginLink(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildPasswordRules() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(AppRadius.control),
      ),
      child: Column(
        children: [
          _ruleRow('Ít nhất 8 ký tự', _hasMinLength),
          const SizedBox(height: 10),
          _ruleRow('Một chữ cái viết hoa', _hasUppercase),
          const SizedBox(height: 10),
          _ruleRow('Một số hoặc ký tự đặc biệt', _hasNumberOrSymbol),
        ],
      ),
    );
  }

  Widget _ruleRow(String text, bool met) {
    return Row(
      children: [
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: Icon(
            met ? Icons.check_circle : Icons.radio_button_unchecked,
            key: ValueKey(met),
            size: 18,
            color: met ? AppColors.success : AppColors.textHint,
          ),
        ),
        const SizedBox(width: 10),
        Text(
          text,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: met ? AppColors.success : AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildTermsCheckbox() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(
          width: 24,
          height: 24,
          child: Checkbox(
            value: _agreedToTerms,
            activeColor: AppColors.primaryBlue,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(5),
            ),
            side: const BorderSide(color: AppColors.border, width: 1.5),
            onChanged: (v) => setState(() => _agreedToTerms = v ?? false),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: RichText(
            text: const TextSpan(
              style: TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
                fontFamily: 'Roboto',
              ),
              children: [
                TextSpan(text: 'Tôi đồng ý với '),
                TextSpan(
                  text: 'Điều khoản Dịch vụ',
                  style: TextStyle(
                    color: AppColors.primaryBlue,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                TextSpan(text: ' và '),
                TextSpan(
                  text: 'Chính sách Bảo mật',
                  style: TextStyle(
                    color: AppColors.primaryBlue,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────────────────────────────
  //  SHARED
  // ──────────────────────────────────────────────────────────────────

  Widget _buildLoginLink() {
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(
          _currentStep == 0 ? 'Đã có tài khoản? ' : 'Đã đăng ký? ',
          style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
        ),
        TextButton(
          onPressed: () => context.go(AppRoutes.login),
          child: const Text(
            'ĐĂNG NHẬP',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.primaryBlue,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ],
    );
  }
}
