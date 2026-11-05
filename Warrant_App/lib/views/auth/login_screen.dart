import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../router/app_router.dart';
import '../../theme/app_theme.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../widgets/custom_text_field.dart';

/// Soopi – Login Screen (connected to AuthViewModel)
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  // ── Form ──────────────────────────────────────────────────────────
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  // ── Actions ───────────────────────────────────────────────────────

  Future<void> _onLogin() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;

    final vm = context.read<AuthViewModel>();
    await vm.loginUser(_emailCtrl.text.trim(), _passwordCtrl.text);

    // GoRouter's refreshListenable fires when isAuthenticated changes.
    // If login succeeded, the router redirects to /profile automatically.
    // We only need to handle the error case here.
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
    // Watch only isLoading to rebuild the button spinner efficiently.
    final isLoading = context.select<AuthViewModel, bool>((vm) => vm.isLoading);
    final hasSessionPendingRetry = context.select<AuthViewModel, bool>(
      (vm) => vm.hasSessionPendingRetry,
    );
    final errorMessage = context.select<AuthViewModel, String?>(
      (vm) => vm.errorMessage,
    );
    final isMock = context.select<AuthViewModel, bool>((vm) => vm.isMock);

    if (hasSessionPendingRetry) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.wifi_off_rounded,
                  size: 64,
                  color: AppColors.textHint,
                ),
                const SizedBox(height: 24),
                Text(
                  errorMessage ?? 'Lỗi kết nối',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 16,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: isLoading
                      ? null
                      : () => context.read<AuthViewModel>().tryAutoLogin(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryBlue,
                    foregroundColor: AppColors.white,
                    minimumSize: const Size(200, 48),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text(
                          'THỬ LẠI',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: isLoading
                      ? null
                      : () async {
                          final vm = context.read<AuthViewModel>();
                          await vm.logout();
                          if (!context.mounted) return;
                          // Clear the error and show login form by triggering a state refresh
                          vm.tryAutoLogin(); // This will clear session internally because we logged out
                        },
                  child: const Text(
                    'Đăng nhập tài khoản khác',
                    style: TextStyle(color: AppColors.primaryBlue),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.milkCream,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Container(
                padding: const EdgeInsets.all(28),
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
                      // ── Logo & Brand ────────────────────────────────────
                      GestureDetector(
                        key: const ValueKey('debug-settings-gesture'),
                        // Nhận nhấn giữ trên cả hàng logo, không chỉ phần ảnh.
                        behavior: HitTestBehavior.opaque,
                        onLongPress: kDebugMode ? _showDebugSettings : null,
                        child: _buildLogo(),
                      ),
                      const SizedBox(height: 28),

                      // ── Welcome text ────────────────────────────────────
                      Text(
                        'Đăng nhập tài khoản',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 23,
                          fontWeight: FontWeight.w800,
                          color: AppColors.penguinNavy,
                          letterSpacing: -0.4,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Quản lý yêu cầu & thiết bị bảo hành của bạn.',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          color: AppColors.sageMuted,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 20),

                      if (isMock)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.mintWash,
                            borderRadius: BorderRadius.circular(
                              AppRadius.control,
                            ),
                            border: Border.all(
                              color: AppColors.mintBorder,
                              width: 1.0,
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.info_outline_rounded,
                                size: 18,
                                color: AppColors.forest,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Chế độ Mock: chỉ dùng tài khoản mẫu bên dưới. Nhấn giữ logo để bật/tắt kết nối API thật.',
                                  style: GoogleFonts.inter(
                                    fontSize: 12.5,
                                    color: AppColors.forestDeep,
                                    height: 1.35,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),

                      if (errorMessage != null && !hasSessionPendingRetry) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.expiredTint,
                            borderRadius: BorderRadius.circular(
                              AppRadius.control,
                            ),
                            border: Border.all(
                              color: AppColors.peach,
                              width: 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.error_outline_rounded,
                                color: AppColors.expiredWine,
                                size: 18,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  errorMessage,
                                  style: GoogleFonts.inter(
                                    color: AppColors.expiredWineDeep,
                                    fontSize: 13,
                                    height: 1.35,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 22),

                      // ── Username field ───────────────────────────────────
                      CustomTextField(
                        label: isMock
                            ? 'Tên đăng nhập *'
                            : 'Số điện thoại / Tên đăng nhập *',
                        hintText: isMock
                            ? 'Nhập tên đăng nhập'
                            : 'Số điện thoại hoặc tên đăng nhập',
                        keyboardType: TextInputType.text,
                        controller: _emailCtrl,
                        prefixIcon: Icons.person_outline_rounded,
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) {
                            return 'Vui lòng nhập tên đăng nhập';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 18),

                      // ── Password field ──────────────────────────────────
                      CustomTextField(
                        label: 'Mật khẩu *',
                        hintText: 'Nhập mật khẩu',
                        obscureText: _obscurePassword,
                        controller: _passwordCtrl,
                        prefixIcon: Icons.lock_outline_rounded,
                        validator: (v) {
                          if (v == null || v.isEmpty) {
                            return 'Vui lòng nhập mật khẩu';
                          }
                          return null;
                        },
                        suffixIcon: IconButton(
                          tooltip: _obscurePassword
                              ? 'Hiện mật khẩu'
                              : 'Ẩn mật khẩu',
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 19,
                            color: AppColors.sageMuted,
                          ),
                          onPressed: () => setState(
                            () => _obscurePassword = !_obscurePassword,
                          ),
                        ),
                      ),
                      if (!isMock) ...[
                        const SizedBox(height: 6),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: isLoading
                                ? null
                                : () => context.push(AppRoutes.forgotPassword),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                                vertical: 4,
                              ),
                              minimumSize: const Size(48, 48),
                            ),
                            child: Text(
                              'Quên mật khẩu?',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.forest,
                              ),
                            ),
                          ),
                        ),
                      ],

                      const SizedBox(height: 24),

                      // ── LOGIN button ────────────────────────────────────
                      ElevatedButton(
                        onPressed: isLoading ? null : _onLogin,
                        child: isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Đăng nhập'),
                      ),
                      const SizedBox(height: 20),

                      // ── Hint for demo / testing ─────────────────────────
                      if (isMock) ...[
                        _buildDemoHint(),
                        const SizedBox(height: 16),
                      ],

                      TextButton(
                        onPressed: isLoading
                            ? null
                            : () => context.push(AppRoutes.register),
                        child: Text(
                          isMock
                              ? 'Đăng ký tài khoản'
                              : 'Chưa có tài khoản bảo hành? Đăng ký ngay',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
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

  // ── Helpers ───────────────────────────────────────────────────────

  Widget _buildLogo() {
    return Column(
      children: [
        // Logo chim cánh cụt + chữ "soopiwarranty", cùng ảnh với header trang khách trên Web.
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.container),
            boxShadow: AppShadows.primaryButton,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.container),
            child: Image.asset(
              'assets/brand/logo-mark.png',
              width: 72,
              height: 72,
              semanticLabel: 'Logo Soopi',
            ),
          ),
        ),
        const SizedBox(height: 14),
        Image.asset(
          'assets/brand/wordmark.png',
          height: 26,
          semanticLabel: 'soopiwarranty',
        ),
        const SizedBox(height: 6),
        Text(
          'Trung tâm Dịch vụ & Bảo hành Điện tử',
          style: GoogleFonts.inter(
            fontSize: 12.5,
            color: AppColors.sageMuted,
            letterSpacing: 0.1,
          ),
        ),
      ],
    );
  }

  void _showDebugSettings() {
    if (!kDebugMode) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.paperWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.mintSoft,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.tune_rounded,
                        color: AppColors.forest,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      'Cấu hình thử nghiệm',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.penguinNavy,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                _buildApiConfig(sheetContext),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Small card showing demo credentials – visible during development only.
  Widget _buildDemoHint() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.mintWash,
        borderRadius: BorderRadius.circular(AppRadius.control),
        border: Border.all(color: AppColors.mintBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.lightbulb_outline_rounded,
                size: 15,
                color: AppColors.forest,
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  'Tài khoản thử nghiệm (Mock Data)',
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.forest,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _hintRow('Admin', 'admin@gmail.com', '123456'),
          const SizedBox(height: 4),
          _hintRow('User', 'user@gmail.com', 'password123'),
        ],
      ),
    );
  }

  Widget _hintRow(String role, String email, String pass) {
    return GestureDetector(
      onTap: () {
        setState(() {
          _emailCtrl.text = email;
          _passwordCtrl.text = pass;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.paperWhite,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: AppColors.mintBorder.withValues(alpha: 0.6),
          ),
        ),
        child: Text(
          '[$role] $email / $pass  (nhấn để điền)',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: GoogleFonts.jetBrainsMono(
            fontSize: 11.5,
            color: AppColors.navyBody,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildApiConfig(BuildContext context) {
    final vm = context.watch<AuthViewModel>();
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardGrey,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Chế độ Mock (Giao diện)',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              Switch(
                value: vm.isMock,
                onChanged: (val) =>
                    context.read<AuthViewModel>().toggleMockMode(val),
                activeTrackColor: AppColors.primaryBlue.withValues(alpha: 0.5),
                activeThumbImage: null,
              ),
            ],
          ),
          if (!vm.isMock) ...[
            const SizedBox(height: 8),
            if (kDebugMode)
              _ApiUrlEditor(initialUrl: vm.baseUrl)
            else
              TextFormField(
                initialValue: vm.baseUrl,
                decoration: const InputDecoration(
                  labelText: 'Base URL (Chỉ xem)',
                  isDense: true,
                ),
                enabled: false,
              ),
          ],
        ],
      ),
    );
  }
}

class _ApiUrlEditor extends StatefulWidget {
  final String initialUrl;
  const _ApiUrlEditor({required this.initialUrl});

  @override
  State<_ApiUrlEditor> createState() => _ApiUrlEditorState();
}

class _ApiUrlEditorState extends State<_ApiUrlEditor> {
  late TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.initialUrl);
  }

  @override
  void didUpdateWidget(_ApiUrlEditor old) {
    super.didUpdateWidget(old);
    if (old.initialUrl != widget.initialUrl &&
        _ctrl.text != widget.initialUrl) {
      _ctrl.text = widget.initialUrl;
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<bool> apply({bool showSuccess = true}) async {
    try {
      await context.read<AuthViewModel>().setBaseUrl(_ctrl.text.trim());
      if (showSuccess && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã cập nhật Base URL'),
            backgroundColor: Colors.green,
          ),
        );
      }
      return true;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: AppColors.error,
          ),
        );
      }
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: TextFormField(
            controller: _ctrl,
            decoration: const InputDecoration(
              labelText: 'Base URL',
              isDense: true,
            ),
            onFieldSubmitted: (_) => apply(),
          ),
        ),
        const SizedBox(width: 8),
        IconButton(
          tooltip: 'Áp dụng Base URL',
          icon: const Icon(
            Icons.check_circle_outline,
            color: AppColors.primaryBlue,
          ),
          onPressed: apply,
        ),
      ],
    );
  }
}
