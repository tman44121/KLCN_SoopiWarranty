import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../data/mock_data.dart';
import '../../theme/app_theme.dart';
import '../../router/app_router.dart';
import '../../models/user_model.dart';
import '../../widgets/app_bar_widget.dart';

class DeviceDetailScreen extends StatelessWidget {
  const DeviceDetailScreen({super.key, this.deviceObj});

  final Object? deviceObj;

  @override
  Widget build(BuildContext context) {
    if (deviceObj == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Lỗi')),
        body: const Center(child: Text('Không tìm thấy thông tin thiết bị.')),
      );
    }

    if (deviceObj is OwnedDevice) {
      return _buildRealDevice(context, deviceObj as OwnedDevice);
    }

    if (deviceObj is MockDevice) {
      return _buildMockDevice(context, deviceObj as MockDevice);
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Lỗi')),
      body: const Center(child: Text('Định dạng thiết bị không hợp lệ.')),
    );
  }

  Widget _buildRealDevice(BuildContext context, OwnedDevice device) {
    String warrantyText = 'Không xác định';
    Color warrantyColor = AppColors.textSecondary;

    if (device.warrantyStatus == 'IN_WARRANTY') {
      warrantyText = 'Còn bảo hành';
      if (device.warrantyExpiresOn != null) {
        warrantyText += ' (Đến ${device.warrantyExpiresOn})';
      }
      warrantyColor = AppColors.success;
    } else if (device.warrantyStatus == 'OUT_OF_WARRANTY') {
      warrantyText = 'Hết hạn bảo hành';
      warrantyColor = AppColors.error;
    } else if (device.warrantyStatus == 'NOT_ACTIVATED' ||
        device.warrantyActivatedOn == null) {
      warrantyText = 'Chưa kích hoạt bảo hành';
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            const WarrantSafeAppBar(),
            WarrantSafeTitleRow(
              title: 'Chi tiết thiết bị',
              onBackTap: () => context.pop(),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header info
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(
                          AppRadius.container,
                        ),
                        border: Border.all(color: AppColors.border, width: 0.8),
                      ),
                      child: Column(
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: AppColors.primaryLight,
                              borderRadius: BorderRadius.circular(
                                AppRadius.container,
                              ),
                            ),
                            child: const Icon(
                              Icons.devices_outlined,
                              size: 32,
                              color: AppColors.primaryBlue,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            device.productName,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: warrantyColor.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(
                                AppRadius.container,
                              ),
                            ),
                            child: Text(
                              warrantyText,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: warrantyColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Detail list
                    const Text(
                      'Thông tin cơ bản',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(
                          AppRadius.container,
                        ),
                        border: Border.all(color: AppColors.border, width: 0.8),
                      ),
                      child: Column(
                        children: [
                          _buildDetailRow('Thương hiệu', device.brandName),
                          const Divider(height: 1, color: AppColors.divider),
                          _buildDetailRow(
                            device.identifierType,
                            device.serialOrImei,
                          ),
                          if (device.warrantyActivatedOn != null) ...[
                            const Divider(height: 1, color: AppColors.divider),
                            _buildDetailRow(
                              'Kích hoạt',
                              device.warrantyActivatedOn!,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(color: AppColors.white),
              child: ElevatedButton.icon(
                onPressed: () =>
                    context.push(AppRoutes.createRequest, extra: device),
                icon: const Icon(Icons.build_circle_outlined, size: 20),
                label: const Text('Gửi yêu cầu cho thiết bị này'),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 52),
                  backgroundColor: AppColors.primaryBlue,
                  foregroundColor: AppColors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMockDevice(BuildContext context, MockDevice device) {
    final warrantyText = device.warrantyExpiryDate == null
        ? 'Chưa có ngày bảo hành Mock'
        : 'Hạn bảo hành mẫu: ${device.warrantyExpiryDate!.toIso8601String().substring(0, 10)}';
    const warrantyColor = AppColors.textSecondary;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            const WarrantSafeAppBar(),
            WarrantSafeTitleRow(
              title: 'Chi tiết thiết bị',
              onBackTap: () => context.pop(),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header info
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(
                          AppRadius.container,
                        ),
                        border: Border.all(color: AppColors.border, width: 0.8),
                      ),
                      child: Column(
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: AppColors.primaryLight,
                              borderRadius: BorderRadius.circular(
                                AppRadius.container,
                              ),
                            ),
                            child: Icon(
                              _iconForCategory(device.deviceCategory),
                              size: 32,
                              color: AppColors.primaryBlue,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            device.deviceName,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: warrantyColor.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(
                                AppRadius.container,
                              ),
                            ),
                            child: Text(
                              warrantyText,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: warrantyColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Detail list
                    const Text(
                      'Thông tin chi tiết',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(
                          AppRadius.container,
                        ),
                        border: Border.all(color: AppColors.border, width: 0.8),
                      ),
                      child: Column(
                        children: [
                          _buildDetailRow(
                            'Loại định danh',
                            device.identifierType,
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16),
                          _buildDetailRow(
                            device.identifierType,
                            device.identifierValue,
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16),
                          _buildDetailRow('Hãng sản xuất', device.manufacturer),
                          const Divider(height: 1, indent: 16, endIndent: 16),
                          _buildDetailRow('Mã Model', device.model),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Bottom CTA
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.white,
                border: Border(
                  top: BorderSide(color: AppColors.border, width: 0.8),
                ),
              ),
              child: ElevatedButton.icon(
                onPressed: () {
                  // Navigate to create request pre-filled with this device
                  context.push('${AppRoutes.requests}/create', extra: device);
                },
                icon: const Icon(Icons.build_circle_outlined, size: 20),
                label: const Text('Gửi yêu cầu cho thiết bị này'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  foregroundColor: AppColors.white,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.control),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  IconData _iconForCategory(String category) {
    switch (category) {
      case 'phone':
        return Icons.smartphone_outlined;
      case 'laptop':
        return Icons.laptop_outlined;
      case 'camera':
        return Icons.camera_alt_outlined;
      case 'tv':
        return Icons.tv_outlined;
      case 'tablet':
        return Icons.tablet_outlined;
      default:
        return Icons.devices_outlined;
    }
  }
}
