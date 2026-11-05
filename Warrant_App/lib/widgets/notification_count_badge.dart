import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// A compact unread-count indicator shared by the app bar and bottom nav.
/// `count == null` means no server count is currently available.
class NotificationCountBadge extends StatelessWidget {
  const NotificationCountBadge({
    super.key,
    required this.child,
    this.count,
    this.loading = false,
    this.error = false,
  });

  final Widget child;
  final int? count;
  final bool loading;
  final bool error;

  @override
  Widget build(BuildContext context) {
    if (!loading && !error && (count ?? 0) > 0) {
      return Badge(
        backgroundColor: AppColors.error,
        textColor: AppColors.white,
        textStyle: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
        label: Semantics(
          label: '$count thông báo chưa đọc',
          excludeSemantics: true,
          child: Text(count! > 9 ? '9+' : '$count'),
        ),
        child: child,
      );
    }
    return Stack(
      clipBehavior: Clip.none,
      children: [
        child,
        if (loading)
          Positioned(
            top: -3,
            right: -3,
            child: Semantics(
              label: 'Đang tải số thông báo chưa đọc',
              child: Container(
                width: 14,
                height: 14,
                padding: const EdgeInsets.all(2),
                decoration: const BoxDecoration(
                  color: AppColors.white,
                  shape: BoxShape.circle,
                ),
                child: const CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          )
        else if (error)
          Positioned(
            top: -3,
            right: -3,
            child: Semantics(
              label: 'Không tải được số thông báo chưa đọc',
              child: Container(
                width: 14,
                height: 14,
                decoration: const BoxDecoration(
                  color: AppColors.error,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.priority_high,
                  size: 12,
                  color: Colors.white,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
