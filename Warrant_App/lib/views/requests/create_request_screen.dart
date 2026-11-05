import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_text_field.dart';
import '../../data/mock_data.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../router/app_router.dart';
import '../../models/user_model.dart';
import '../../widgets/app_bar_widget.dart';
import 'real_create_request_screen.dart';

class CreateRequestScreen extends StatefulWidget {
  const CreateRequestScreen({super.key, this.prefilledDevice});

  final Object? prefilledDevice;

  @override
  State<CreateRequestScreen> createState() => _CreateRequestScreenState();
}

class _CreateRequestScreenState extends State<CreateRequestScreen> {
  final _formKey = GlobalKey<FormState>();

  // Customer Info
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();

  // Device Info
  String? _deviceType = 'laptop';
  final _hangModelCtrl = TextEditingController();
  String _identifierType = 'SERIAL';
  final _identifierCtrl = TextEditingController();

  // Request Details
  final _problemCtrl = TextEditingController();
  String? _serviceStation = 'HCM'; // Code from the checked-in reference data
  final _timeCtrl = TextEditingController(); // Optional desired time

  // Photos Mock
  final List<String> _mockPhotoPaths = [];

  bool _isSubmitting = false;
  MockRequest? _submittedRequest;

  final Map<String, String> _stations = {
    'HCM': 'Trạm HCM (dữ liệu tham chiếu)',
  };

  final Map<String, String> _deviceTypes = {
    'phone': 'Điện thoại di động',
    'laptop': 'Máy tính xách tay',
    'tablet': 'Máy tính bảng',
    'tv': 'Tivi / Màn hình',
    'camera': 'Máy ảnh',
    'earbuds': 'Tai nghe / Phụ kiện',
  };

  @override
  void initState() {
    super.initState();
    // Prefill customer info from AuthViewModel if available
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = context.read<AuthViewModel>().currentUser;
      if (user != null) {
        _nameCtrl.text = user.fullName;
        _phoneCtrl.text = user.phone;
        _emailCtrl.text = user.email;
      }
    });

    // Prefill device info if passed
    if (widget.prefilledDevice != null) {
      if (widget.prefilledDevice is MockDevice) {
        final dev = widget.prefilledDevice as MockDevice;
        _deviceType = _deviceTypes.containsKey(dev.deviceCategory)
            ? dev.deviceCategory
            : 'laptop';
        _hangModelCtrl.text = '${dev.manufacturer} ${dev.model}';
        _identifierType = dev.identifierType;
        _identifierCtrl.text = dev.identifierValue;
      } else if (widget.prefilledDevice is OwnedDevice) {
        // We import user_model.dart since OwnedDevice is there
        final dev =
            widget.prefilledDevice as dynamic; // Using dynamic or OwnedDevice
        _deviceType = 'laptop';
        _hangModelCtrl.text = '${dev.brandName} ${dev.productName}';
        _identifierType = dev.identifierType;
        _identifierCtrl.text = dev.serialOrImei;
      }
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    _hangModelCtrl.dispose();
    _identifierCtrl.dispose();
    _problemCtrl.dispose();
    _timeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final isMock = context.read<AuthViewModel>().isMock;
    if (!isMock) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tính năng tạo yêu cầu chưa khả dụng ở chế độ thực.'),
        ),
      );
      return;
    }

    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    // Mock network delay
    await Future.delayed(const Duration(seconds: 2));

    if (!mounted) return;

    final request = submitMockRequest(
      deviceName: _hangModelCtrl.text,
      deviceCategory: _deviceType!,
      problemDescription: _problemCtrl.text,
      customerName: _nameCtrl.text,
      phone: _phoneCtrl.text,
      identifierType: _identifierType,
      serialOrImei: _identifierCtrl.text,
      preferredStation: _serviceStation!,
    );
    setState(() {
      _isSubmitting = false;
      _submittedRequest = request;
    });
  }

  void _pickMockImage() {
    final isMock = context.read<AuthViewModel>().isMock;
    if (!isMock) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Chức năng tải ảnh chưa khả dụng ở chế độ thực.'),
        ),
      );
      return;
    }

    if (_mockPhotoPaths.length >= 3) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Tối đa 3 ảnh đính kèm.')));
      return;
    }
    setState(() {
      _mockPhotoPaths.add(
        'mock_path_${DateTime.now().millisecondsSinceEpoch}.jpg',
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_submittedRequest != null) return _buildSuccessState();
    if (!context.watch<AuthViewModel>().isMock) {
      return RealCreateRequestScreen(
        prefilledDevice: widget.prefilledDevice is OwnedDevice
            ? widget.prefilledDevice as OwnedDevice
            : null,
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            const WarrantSafeAppBar(),
            WarrantSafeTitleRow(
              title: 'Gửi yêu cầu bảo hành / sửa chữa',
              onBackTap: () => context.pop(),
            ),
            // Warning Banner
            Container(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
              alignment: Alignment.centerLeft,
              child: const Text(
                'Chế độ Mock: yêu cầu chỉ được lưu tạm trong ứng dụng, không gửi đến trung tâm.',
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
              ),
            ),
            Expanded(
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    _buildSectionTitle('Thông tin liên hệ'),
                    const SizedBox(height: 12),
                    CustomTextField(
                      label: 'Họ và tên *',
                      hintText: 'Nhập họ tên',
                      controller: _nameCtrl,
                      validator: (v) =>
                          v!.trim().isEmpty ? 'Bắt buộc nhập' : null,
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      label: 'Số điện thoại *',
                      hintText: 'Nhập số điện thoại',
                      keyboardType: TextInputType.phone,
                      controller: _phoneCtrl,
                      validator: (v) =>
                          v!.trim().isEmpty ? 'Bắt buộc nhập' : null,
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      label: 'Email (Tùy chọn)',
                      hintText: 'Nhập email',
                      keyboardType: TextInputType.emailAddress,
                      controller: _emailCtrl,
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      label: 'Địa chỉ (Tùy chọn)',
                      hintText: 'Nhập địa chỉ của bạn',
                      controller: _addressCtrl,
                    ),

                    const SizedBox(height: 32),
                    _buildSectionTitle('Thông tin thiết bị'),
                    const SizedBox(height: 12),

                    if (widget.prefilledDevice != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.success.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(
                            AppRadius.control,
                          ),
                          border: Border.all(
                            color: AppColors.success.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.check_circle_rounded,
                              color: AppColors.success,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Đang gửi yêu cầu cho: ${widget.prefilledDevice is MockDevice ? (widget.prefilledDevice as MockDevice).deviceName : (widget.prefilledDevice as OwnedDevice).productName}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.success,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    _buildDropdown(
                      label: 'Loại thiết bị *',
                      value: _deviceType,
                      items: _deviceTypes,
                      onChanged: widget.prefilledDevice != null
                          ? null
                          : (v) => setState(() => _deviceType = v),
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      label: 'Hãng và Model *',
                      hintText: 'VD: Apple MacBook Pro A2141',
                      controller: _hangModelCtrl,
                      validator: (v) =>
                          v!.trim().isEmpty ? 'Bắt buộc nhập' : null,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 2,
                          child: _buildDropdown(
                            label: 'Loại mã *',
                            value: _identifierType,
                            items: const {'SERIAL': 'Serial', 'IMEI': 'IMEI'},
                            onChanged: widget.prefilledDevice != null
                                ? null
                                : (v) => setState(() => _identifierType = v!),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 5,
                          child: CustomTextField(
                            label: 'Giá trị mã *',
                            hintText: 'Nhập số mã',
                            controller: _identifierCtrl,
                            validator: (v) =>
                                v!.trim().isEmpty ? 'Bắt buộc nhập' : null,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 32),
                    _buildSectionTitle('Chi tiết yêu cầu'),
                    const SizedBox(height: 12),
                    CustomTextField(
                      label: 'Mô tả lỗi *',
                      hintText:
                          'Mô tả chi tiết vấn đề thiết bị đang gặp phải...',
                      controller: _problemCtrl,
                      validator: (v) =>
                          v!.trim().isEmpty ? 'Bắt buộc nhập' : null,
                    ),
                    const SizedBox(height: 16),
                    _buildDropdown(
                      label: 'Trạm dịch vụ mong muốn *',
                      value: _serviceStation,
                      items: _stations,
                      onChanged: (v) => setState(() => _serviceStation = v),
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      label: 'Thời gian dự kiến mang máy đến (Tùy chọn)',
                      hintText: 'Ví dụ: chiều mai (chỉ minh họa)',
                      controller: _timeCtrl,
                    ),

                    const SizedBox(height: 32),
                    _buildSectionTitle(
                      'Ảnh minh họa Mock (không tải tệp thật)',
                    ),
                    const SizedBox(height: 12),
                    _buildPhotoSelector(),

                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),

            // Bottom CTA
            Container(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              decoration: BoxDecoration(
                color: AppColors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  foregroundColor: AppColors.white,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.control),
                  ),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text(
                        'GỬI YÊU CẦU',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title.toUpperCase(),
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.2,
        color: AppColors.textSecondary,
      ),
    );
  }

  Widget _buildDropdown({
    required String label,
    required String? value,
    required Map<String, String> items,
    required void Function(String?)? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.4,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: onChanged == null ? AppColors.cardGrey : AppColors.inputFill,
            borderRadius: BorderRadius.circular(AppRadius.control),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              isExpanded: true,
              value: value,
              icon: Icon(
                Icons.keyboard_arrow_down_rounded,
                color: onChanged == null
                    ? AppColors.textHint
                    : AppColors.textPrimary,
              ),
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w500,
                color: onChanged == null
                    ? AppColors.textSecondary
                    : AppColors.textPrimary,
              ),
              onChanged: onChanged,
              items: items.entries.map((e) {
                return DropdownMenuItem(value: e.key, child: Text(e.value));
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPhotoSelector() {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        ..._mockPhotoPaths.map((path) => _buildMockImagePreview(path)),
        if (_mockPhotoPaths.length < 3)
          GestureDetector(
            onTap: _pickMockImage,
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(AppRadius.control),
                border: Border.all(
                  color: AppColors.border,
                  style: BorderStyle.solid,
                ),
              ),
              child: const Icon(
                Icons.add_a_photo_outlined,
                color: AppColors.primaryBlue,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildMockImagePreview(String path) {
    return Stack(
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: AppColors.cardGrey,
            borderRadius: BorderRadius.circular(AppRadius.control),
          ),
          child: const Center(
            child: Icon(
              Icons.image_outlined,
              color: AppColors.textHint,
              size: 32,
            ),
          ),
        ),
        Positioned(
          top: -4,
          right: -4,
          child: GestureDetector(
            onTap: () {
              setState(() => _mockPhotoPaths.remove(path));
            },
            child: Container(
              padding: const EdgeInsets.all(2),
              decoration: const BoxDecoration(
                color: AppColors.error,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.close, size: 14, color: Colors.white),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSuccessState() {
    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  size: 64,
                  color: AppColors.success,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Đã tạo yêu cầu Mock',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Mã yêu cầu trong phiên demo:',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),
              Text(
                _submittedRequest!.id,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryBlue,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.cardGrey,
                  borderRadius: BorderRadius.circular(AppRadius.control),
                ),
                child: const Text(
                  'Dữ liệu này chỉ có trong bộ nhớ của chế độ Mock và sẽ mất khi ứng dụng khởi động lại. Không có yêu cầu nào được gửi tới API hoặc cơ sở dữ liệu.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                ),
              ),
              const SizedBox(height: 40),
              OutlinedButton(
                onPressed: () => context.go(
                  '${AppRoutes.requests}/${_submittedRequest!.id}',
                ),
                child: const Text('XEM YÊU CẦU MOCK'),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () {
                  context.go(AppRoutes.home);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  foregroundColor: AppColors.white,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.control),
                  ),
                ),
                child: const Text('VỀ TRANG CHỦ'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
