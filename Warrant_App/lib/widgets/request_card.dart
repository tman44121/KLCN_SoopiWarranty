import 'package:flutter/material.dart';
import '../../data/mock_data.dart';
import '../../theme/app_theme.dart';
import 'app_status_chip.dart';

// ─────────────────────────────────────────────────────────────────────────────
// RequestCard
// ─────────────────────────────────────────────────────────────────────────────

/// A card that summarises one [MockRequest] for use in lists on the Home
/// screen and the Yêu cầu tab.
///
/// Shows device icon, name, code, problem snippet, and status chip.
class RequestCard extends StatelessWidget {
  const RequestCard({super.key, required this.request, this.onTap});

  final MockRequest request;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.container),
        child: Ink(
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(AppRadius.container),
            border: Border.all(color: AppColors.border, width: 0.8),
          ),
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Device icon ────────────────────────────────────────
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.cardGrey,
                  borderRadius: BorderRadius.circular(AppRadius.control),
                ),
                child: Icon(
                  _iconForCategory(request.deviceCategory),
                  size: 22,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(width: 12),

              // ── Content ────────────────────────────────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name + chevron
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            request.deviceName,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                              height: 1.2,
                            ),
                          ),
                        ),
                        const Icon(
                          Icons.chevron_right_rounded,
                          size: 20,
                          color: AppColors.textHint,
                        ),
                      ],
                    ),

                    // Request code
                    Text(
                      'Mã ${request.ticketId ?? request.id}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),

                    // Problem description
                    Text(
                      request.problemDescription,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Status chip
                    _buildStatusChip(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusChip() {
    // Prefer ticket status if available, otherwise use request status.
    if (request.ticketStatus != null) {
      return AppStatusChip.forTicket(request.ticketStatus!);
    }
    return AppStatusChip.forRequest(request.status);
  }

  static IconData _iconForCategory(String category) {
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
      case 'earbuds':
        return Icons.headphones_outlined;
      default:
        return Icons.devices_outlined;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionCard
// ─────────────────────────────────────────────────────────────────────────────

/// A highlighted card shown in the "Cần bạn xử lý" section on the Home screen.
///
/// Rendered with a coloured left border and a primary CTA button.
class ActionCard extends StatelessWidget {
  const ActionCard({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.backgroundColor,
    required this.borderColor,
    required this.title,
    required this.subtitle,
    required this.buttonLabel,
    this.onButtonTap,
    this.buttonBackgroundColor,
    this.buttonTextColor,
    this.buttonIsOutlined = false,
  });

  final IconData icon;
  final Color iconColor;
  final Color backgroundColor;
  final Color borderColor;
  final String title;
  final String subtitle;
  final String buttonLabel;
  final VoidCallback? onButtonTap;
  final Color? buttonBackgroundColor;
  final Color? buttonTextColor;
  final bool buttonIsOutlined;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppRadius.container),
        border: Border.all(color: borderColor, width: 1),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Title row ────────────────────────────────────────────
          Row(
            children: [
              Icon(icon, size: 20, color: iconColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: iconColor,
                    height: 1.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),

          // ── Subtitle ─────────────────────────────────────────────
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 12),

          // ── CTA button ──────────────────────────────────────────
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onButtonTap,
              style: ElevatedButton.styleFrom(
                backgroundColor: buttonBackgroundColor ?? AppColors.primaryBlue,
                foregroundColor: buttonTextColor ?? AppColors.white,
                minimumSize: const Size(double.infinity, 44),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.control),
                  side: buttonIsOutlined
                      ? const BorderSide(color: AppColors.border, width: 1.0)
                      : BorderSide.none,
                ),
                elevation: 0,
                textStyle: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              child: Text(buttonLabel),
            ),
          ),
        ],
      ),
    );
  }
}
