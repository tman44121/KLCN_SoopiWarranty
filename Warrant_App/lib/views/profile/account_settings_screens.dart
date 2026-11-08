import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../router/app_router.dart';
import '../../services/i_api_service.dart';
import '../../theme/app_theme.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../widgets/app_bar_widget.dart';
import '../../widgets/soopi_ui.dart';
import '../auth/auth_form_validators.dart';

/// The customer portal permits editing name, email and address.
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _email = TextEditingController();
  final _address = TextEditingController();
  bool _initialized = false;
  bool _busy = false;
  String? _message;
  bool _saved = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    final user = context.read<AuthViewModel>().currentUser;
    _fullName.text = user?.fullName ?? '';
    _email.text = user?.email ?? '';
    _address.text = user?.address ?? '';
    _initialized = true;
  }

  @override
  void dispose() {
    _fullName.dispose();
    _email.dispose();
    _address.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_busy || !_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _message = null;
      _saved = false;
    });
    try {
      await context.read<AuthViewModel>().updateMyProfile(
        fullName: _fullName.text.trim(),
        email: _email.text.trim(),
        address: _address.text.trim(),
      );
      if (mounted) {
        setState(() {
          _saved = true;
          _message = 'Đã cập nhật hồ sơ cá nhân.';
        });
      }
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          _message = error.statusCode == null || error.statusCode! >= 500
              ? 'Chưa rõ thông tin đã được lưu hay chưa. Hãy kiểm tra lại hồ sơ trước khi gửi lại.'
              : error.fieldErrors['fullName'] ??
                    error.fieldErrors['email'] ??
                    error.fieldErrors['address'] ??
                    error.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _message = 'Không thể lưu hồ sơ. Vui lòng thử lại.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthViewModel>().currentUser;
    return _AccountScaffold(
      title: 'Hồ sơ cá nhân',
      child: Form(
        key: _formKey,
        child: SoopiPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Thông tin cá nhân', style: AppText.cardTitle),
              const SizedBox(height: 8),
              const Text('Số điện thoại đăng nhập do trạm dịch vụ xác minh.'),
              const SizedBox(height: 16),
              TextFormField(
                controller: _fullName,
                maxLength: 100,
                decoration: const InputDecoration(labelText: 'Họ và tên *'),
                validator: (value) {
                  final name = (value ?? '').trim();
                  if (name.length < 2 || RegExp(r'[0-9]').hasMatch(name)) {
                    return 'Họ và tên cần từ 2 đến 100 ký tự và không chứa chữ số.';
                  }
                  return null;
                },
              ),
              _ReadOnlyRow(label: 'Số điện thoại', value: user?.phone ?? '—'),
              _ReadOnlyRow(
                label: 'Mã khách hàng',
                value: user?.customerCode ?? '—',
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                maxLength: 100,
                decoration: const InputDecoration(labelText: 'Email'),
                validator: (value) {
                  if ((value ?? '').trim().isEmpty) return null;
                  return validateCustomerEmail(value);
                },
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _address,
                autofillHints: const [AutofillHints.streetAddressLine1],
                maxLength: 255,
                decoration: const InputDecoration(labelText: 'Địa chỉ liên hệ'),
              ),
              const SizedBox(height: 8),
              if (_message != null) ...[
                Text(
                  _message!,
                  style: TextStyle(
                    color: _saved ? AppColors.forest : AppColors.error,
                  ),
                ),
                const SizedBox(height: 12),
              ],
              ElevatedButton(
                onPressed: _busy || user == null ? null : _save,
                child: Text(_busy ? 'Đang lưu…' : 'Lưu thay đổi'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A confirmed change returns a new mobile access/refresh pair.
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  bool _uncertain = false;
  bool _saved = false;
  bool _obscure = true;
  String? _message;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_busy || _uncertain || !_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _saved = false;
      _message = null;
    });
    try {
      await context.read<AuthViewModel>().changePassword(
        _current.text,
        _next.text,
      );
      _current.clear();
      _next.clear();
      _confirm.clear();
      if (mounted) {
        setState(() {
          _saved = true;
          _message = 'Đổi mật khẩu thành công. Các phiên khác đã đăng xuất.';
        });
      }
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          _uncertain = error.statusCode == null || error.statusCode! >= 500;
          _message = _uncertain
              ? 'Chưa rõ mật khẩu đã đổi hay chưa. Hãy đăng xuất và thử đăng nhập bằng mật khẩu mới trước khi thao tác lại.'
              : error.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _uncertain = true;
          _message =
              'Chưa rõ mật khẩu đã đổi hay chưa. Hãy đăng nhập lại để kiểm tra.';
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final vm = context.watch<AuthViewModel>();
    final username = vm.currentUser?.username ?? '';
    return _AccountScaffold(
      title: 'Đổi mật khẩu',
      child: Form(
        key: _formKey,
        child: SoopiPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Mật khẩu đăng nhập', style: AppText.cardTitle),
              const SizedBox(height: 8),
              const Text(
                'Mật khẩu mới cần ít nhất 10 ký tự, có chữ và số, không chứa tên đăng nhập.',
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _current,
                obscureText: _obscure,
                autocorrect: false,
                enableSuggestions: false,
                autofillHints: const [AutofillHints.password],
                decoration: const InputDecoration(
                  labelText: 'Mật khẩu hiện tại *',
                ),
                validator: (value) => (value ?? '').isEmpty
                    ? 'Vui lòng nhập mật khẩu hiện tại.'
                    : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _next,
                obscureText: _obscure,
                autocorrect: false,
                enableSuggestions: false,
                autofillHints: const [AutofillHints.newPassword],
                decoration: const InputDecoration(labelText: 'Mật khẩu mới *'),
                validator: (value) {
                  final error = validateCustomerPassword(value, username);
                  if (error != null) return error;
                  return value == _current.text
                      ? 'Mật khẩu mới phải khác mật khẩu hiện tại.'
                      : null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _confirm,
                obscureText: _obscure,
                autocorrect: false,
                enableSuggestions: false,
                autofillHints: const [AutofillHints.newPassword],
                decoration: const InputDecoration(
                  labelText: 'Xác nhận mật khẩu mới *',
                ),
                validator: (value) => (value ?? '').isEmpty
                    ? 'Vui lòng nhập lại mật khẩu mới.'
                    : value != _next.text
                    ? 'Mật khẩu xác nhận chưa khớp.'
                    : null,
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => setState(() => _obscure = !_obscure),
                  icon: Icon(
                    _obscure ? Icons.visibility : Icons.visibility_off,
                  ),
                  label: Text(_obscure ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'),
                ),
              ),
              if (_message != null) ...[
                Text(
                  _message!,
                  style: TextStyle(
                    color: _saved ? AppColors.forest : AppColors.error,
                  ),
                ),
                const SizedBox(height: 12),
              ],
              ElevatedButton(
                onPressed: _busy || _uncertain || vm.currentUser == null
                    ? null
                    : _save,
                child: Text(_busy ? 'Đang đổi…' : 'Đổi mật khẩu'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AccountScaffold extends StatelessWidget {
  const _AccountScaffold({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.background,
    body: SafeArea(
      child: Column(
        children: [
          const WarrantSafeAppBar(),
          WarrantSafeTitleRow(
            title: title,
            onBackTap: () => context.go(AppRoutes.profile),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              child: child,
            ),
          ),
        ],
      ),
    ),
  );
}

class _ReadOnlyRow extends StatelessWidget {
  const _ReadOnlyRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppText.label),
        const SizedBox(height: 4),
        Text(value.isEmpty ? '—' : value),
      ],
    ),
  );
}
