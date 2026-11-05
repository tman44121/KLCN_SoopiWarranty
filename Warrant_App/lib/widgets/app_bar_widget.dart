import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'notification_count_badge.dart';
import 'soopi_ui.dart';

// ─────────────────────────────────────────────────────────────────────────────
// WarrantSafeAppBar
// ─────────────────────────────────────────────────────────────────────────────

/// Consistent top app bar used across authenticated screens.
///
/// Shows the Soopi logo on the left (giống header trang khách trên web) and a notification bell with optional
/// badge on the right.
///
/// The bell is shown only when its parent supplies a destination.
class WarrantSafeAppBar extends StatelessWidget {
  const WarrantSafeAppBar({
    super.key,
    this.unreadCount = 0,
    this.notificationCountLoading = false,
    this.notificationCountError = false,
    this.onNotificationTap,
  });

  final int? unreadCount;
  final bool notificationCountLoading;
  final bool notificationCountError;
  final VoidCallback? onNotificationTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.white,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      child: Row(
        children: [
          // ── Logo ────────────────────────────────────────────────
          _buildLogo(),
          const Spacer(),

          // ── Notification bell ───────────────────────────────────
          if (onNotificationTap != null)
            NotificationCountBadge(
              count: unreadCount,
              loading: notificationCountLoading,
              error: notificationCountError,
              child: IconButton(
                tooltip: 'Mở thông báo',
                onPressed: onNotificationTap,
                style: IconButton.styleFrom(
                  minimumSize: const Size(48, 48),
                  backgroundColor: AppColors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.control),
                    side: const BorderSide(color: AppColors.border),
                  ),
                ),
                icon: const Icon(
                  Icons.notifications_none_rounded,
                  size: 22,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildLogo() => const SoopiBrand();
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────────────────────────────────────

/// A row with a section title on the left and an optional "Xem tất cả" link
/// on the right.
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.onViewAll,
    this.viewAllLabel = 'Xem tất cả',
  });

  final String title;
  final VoidCallback? onViewAll;
  final String viewAllLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(child: Text(title, style: AppText.cardTitle)),
        if (onViewAll != null)
          SoopiLink(label: '$viewAllLabel →', onTap: onViewAll!),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WarrantSafeTitleRow
// ─────────────────────────────────────────────────────────────────────────────

/// A standard title row used below the WarrantSafeAppBar on secondary screens.
/// Features a rounded back button on the left and a bold screen title.
class WarrantSafeTitleRow extends StatelessWidget {
  const WarrantSafeTitleRow({super.key, required this.title, this.onBackTap});

  final String title;
  final VoidCallback? onBackTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Quay lại',
            onPressed:
                onBackTap ??
                () {
                  if (Navigator.of(context).canPop()) {
                    Navigator.of(context).pop();
                  }
                },
            style: IconButton.styleFrom(
              minimumSize: const Size(48, 48),
              backgroundColor: AppColors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.control),
                side: const BorderSide(color: AppColors.border),
              ),
            ),
            icon: const Icon(
              Icons.arrow_back_ios_new_rounded,
              size: 18,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(title, style: AppText.pageTitle.copyWith(fontSize: 20)),
          ),
        ],
      ),
    );
  }
}
