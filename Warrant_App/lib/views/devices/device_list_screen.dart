import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_bar_widget.dart';
import 'package:go_router/go_router.dart';
import '../../router/app_router.dart';
import 'package:provider/provider.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../models/user_model.dart';

class DeviceListScreen extends StatefulWidget {
  const DeviceListScreen({super.key});

  @override
  State<DeviceListScreen> createState() => _DeviceListScreenState();
}

class _DeviceListScreenState extends State<DeviceListScreen> {
  bool _isLoading = true;
  String? _error;
  List<OwnedDevice> _devices = [];

  @override
  void initState() {
    super.initState();
    _fetchDevices();
  }

  Future<void> _fetchDevices() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final devices = await context.read<AuthViewModel>().getMyDevices();
      if (mounted) {
        setState(() {
          _devices = devices;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Lỗi tải danh sách thiết bị. Vui lòng thử lại.';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthViewModel>();
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            WarrantSafeAppBar(
              unreadCount: auth.notificationUnreadCount,
              notificationCountLoading: auth.notificationCountLoading,
              notificationCountError: auth.notificationCountError,
              onNotificationTap: () => context.go(AppRoutes.notifications),
            ),
            const Divider(height: 1),

            // Tra cứu CTA
            Container(
              color: AppColors.milkCream,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: InkWell(
                onTap: () => context.push(AppRoutes.lookup),
                borderRadius: BorderRadius.circular(AppRadius.control),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 13,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.paperWhite,
                    borderRadius: BorderRadius.circular(AppRadius.control),
                    border: Border.all(color: AppColors.sageBorder, width: 1),
                    boxShadow: AppShadows.card,
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.mintSoft,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.search_rounded,
                          color: AppColors.forest,
                          size: 18,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Tra cứu Serial / IMEI hoặc mã YC / TN…',
                          style: GoogleFonts.inter(
                            color: AppColors.sageMuted,
                            fontSize: 13.5,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ),
                      Icon(
                        Icons.arrow_forward_ios_rounded,
                        color: AppColors.sageMuted.withValues(alpha: 0.6),
                        size: 14,
                      ),
                    ],
                  ),
                ),
              ),
            ),

            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _buildContent(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_error != null) return _buildErrorState();
    if (_devices.isEmpty) return _buildEmptyState();
    return RefreshIndicator(
      onRefresh: _fetchDevices,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        itemCount: _devices.length,
        itemBuilder: (context, index) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _RealDeviceCard(device: _devices[index]),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.cardGrey,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(
              Icons.devices_outlined,
              size: 36,
              color: AppColors.textHint,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Chưa có thiết bị nào',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Thiết bị đứng tên bạn sẽ xuất hiện tại đây khi có dữ liệu.',
            style: TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () => context.push(AppRoutes.lookup),
            icon: const Icon(Icons.search_rounded, size: 18),
            label: const Text('Tra cứu thiết bị'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryBlue,
              foregroundColor: AppColors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.error_outline_rounded,
            size: 64,
            color: AppColors.error,
          ),
          const SizedBox(height: 16),
          Text(
            _error ?? 'Đã xảy ra lỗi',
            style: const TextStyle(fontSize: 16, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _fetchDevices,
            child: const Text('Thử lại'),
          ),
        ],
      ),
    );
  }
}

class _RealDeviceCard extends StatelessWidget {
  const _RealDeviceCard({required this.device});

  final OwnedDevice device;

  @override
  Widget build(BuildContext context) {
    String warrantyText = 'Chưa xác định';
    Color bg = AppColors.milkCream;
    Color fg = AppColors.sageMuted;
    Color border = AppColors.sageBorder;

    if (device.warrantyStatus == 'IN_WARRANTY') {
      warrantyText = 'Còn bảo hành';
      if (device.warrantyExpiresOn != null) {
        warrantyText += ' (Đến ${device.warrantyExpiresOn})';
      }
      bg = AppColors.mintSoft;
      fg = AppColors.forest;
      border = AppColors.mintBorder;
    } else if (device.warrantyStatus == 'OUT_OF_WARRANTY') {
      warrantyText = 'Hết hạn bảo hành';
      bg = AppColors.expiredTint;
      fg = AppColors.expiredWine;
      border = AppColors.peach;
    } else if (device.warrantyStatus == 'NOT_ACTIVATED' ||
        device.warrantyActivatedOn == null) {
      warrantyText = 'Chưa kích hoạt bảo hành';
      bg = AppColors.honeyTint;
      fg = AppColors.honeyText;
      border = AppColors.honeyBorder;
    }

    return GestureDetector(
      onTap: () => context.push('${AppRoutes.devices}/detail', extra: device),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.paperWhite,
          borderRadius: BorderRadius.circular(AppRadius.container),
          border: Border.all(color: AppColors.sageBorder, width: 1),
          boxShadow: AppShadows.card,
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppColors.mintSoft,
                borderRadius: BorderRadius.circular(AppRadius.control),
              ),
              child: const Icon(
                Icons.devices_outlined,
                size: 24,
                color: AppColors.forest,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          device.productName,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 15.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.penguinNavy,
                            height: 1.25,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 14,
                        color: AppColors.sageMuted.withValues(alpha: 0.6),
                      ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  Text(
                    '${device.identifierType}: ${device.serialOrImei}',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500,
                      color: AppColors.slateQuiet,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: bg,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                      border: Border.all(color: border),
                    ),
                    child: Text(
                      warrantyText,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: fg,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
