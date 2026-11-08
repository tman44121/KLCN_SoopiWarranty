import 'dart:ui' show SemanticsRole;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../widgets/notification_count_badge.dart';

// ─────────────────────────────────────────────────────────────────────────────
// MainShell
// ─────────────────────────────────────────────────────────────────────────────

/// The adaptive navigation shell that wraps all authenticated tabs.
///
/// Uses GoRouter's [StatefulShellRoute] via the [navigationShell] parameter.
/// Bottom nav items:
///   0  Trang chủ   (/home)
///   1  Thiết bị    (/devices)
///   2  Yêu cầu     (/requests)
///   3  Thông báo   (/notifications)
///   4  Hồ sơ       (/profile)
class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) => Builder(
    builder: (context) {
      final auth = context.watch<AuthViewModel>();
      // Re-selecting a tab must preserve nested screens and unsaved forms.
      void select(int index) => navigationShell.goBranch(index);
      final count = auth.notificationUnreadCount;
      final loading = auth.notificationCountLoading;
      final error = auth.notificationCountError;
      return LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 600;
          return Scaffold(
            body: wide
                ? Row(
                    children: [
                      SafeArea(
                        child: NavigationRail(
                          selectedIndex: navigationShell.currentIndex,
                          onDestinationSelected: select,
                          scrollable: true,
                          minWidth: 112,
                          backgroundColor: AppColors.paperWhite,
                          indicatorColor: AppColors.mintSoft,
                          labelType: NavigationRailLabelType.all,
                          selectedIconTheme: const IconThemeData(
                            color: AppColors.forest,
                          ),
                          unselectedIconTheme: const IconThemeData(
                            color: AppColors.sageMuted,
                          ),
                          selectedLabelTextStyle: const TextStyle(
                            color: AppColors.forest,
                            fontWeight: FontWeight.w700,
                          ),
                          unselectedLabelTextStyle: const TextStyle(
                            color: AppColors.sageMuted,
                          ),
                          destinations: [
                            for (
                              var i = 0;
                              i < _WarrantSafeBottomNav._items.length;
                              i++
                            )
                              NavigationRailDestination(
                                icon: NotificationCountBadge(
                                  count: i == 3 ? count : null,
                                  loading: i == 3 && loading,
                                  error: i == 3 && error,
                                  child: Icon(
                                    i == navigationShell.currentIndex
                                        ? _WarrantSafeBottomNav
                                              ._items[i]
                                              .activeIcon
                                        : _WarrantSafeBottomNav._items[i].icon,
                                  ),
                                ),
                                label: Text(
                                  _WarrantSafeBottomNav._items[i].label,
                                  textAlign: TextAlign.center,
                                ),
                              ),
                          ],
                        ),
                      ),
                      const VerticalDivider(width: 1),
                      Expanded(
                        child: Align(
                          alignment: Alignment.topCenter,
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 1040),
                            child: Semantics(
                              container: true,
                              explicitChildNodes: true,
                              child: navigationShell,
                            ),
                          ),
                        ),
                      ),
                    ],
                  )
                : navigationShell,
            bottomNavigationBar: wide
                ? null
                : _WarrantSafeBottomNav(
                    currentIndex: navigationShell.currentIndex,
                    unreadCount: count,
                    notificationCountLoading: loading,
                    notificationCountError: error,
                    onTap: select,
                  ),
          );
        },
      );
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// _WarrantSafeBottomNav
// ─────────────────────────────────────────────────────────────────────────────

class _WarrantSafeBottomNav extends StatelessWidget {
  const _WarrantSafeBottomNav({
    required this.currentIndex,
    required this.onTap,
    required this.unreadCount,
    required this.notificationCountLoading,
    required this.notificationCountError,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;
  final int? unreadCount;
  final bool notificationCountLoading;
  final bool notificationCountError;

  static const _items = [
    _NavItem(
      icon: Icons.home_outlined,
      activeIcon: Icons.home_rounded,
      label: 'Trang chủ',
    ),
    _NavItem(
      icon: Icons.devices_outlined,
      activeIcon: Icons.devices_rounded,
      label: 'Thiết bị',
    ),
    _NavItem(
      icon: Icons.list_alt_outlined,
      activeIcon: Icons.list_alt_rounded,
      label: 'Yêu cầu',
    ),
    _NavItem(
      icon: Icons.notifications_none_outlined,
      activeIcon: Icons.notifications_rounded,
      label: 'Thông báo',
    ),
    _NavItem(
      icon: Icons.person_outline_rounded,
      activeIcon: Icons.person_rounded,
      label: 'Tài khoản',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    // Hide bottom navigation when the keyboard is visible
    final isKeyboardOpen = MediaQuery.of(context).viewInsets.bottom > 0;
    if (isKeyboardOpen) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Semantics(
          role: SemanticsRole.tabBar,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 72),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: List.generate(_items.length, (index) {
                  final item = _items[index];
                  final isActive = index == currentIndex;
                  return Expanded(
                    child: _NavButton(
                      item: item,
                      isActive: isActive,
                      notificationBadge: index == 3,
                      unreadCount: unreadCount,
                      notificationCountLoading: notificationCountLoading,
                      notificationCountError: notificationCountError,
                      onTap: () => onTap(index),
                    ),
                  );
                }),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
  final IconData icon;
  final IconData activeIcon;
  final String label;
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.item,
    required this.isActive,
    required this.notificationBadge,
    required this.unreadCount,
    required this.notificationCountLoading,
    required this.notificationCountError,
    required this.onTap,
  });

  final _NavItem item;
  final bool isActive;
  final bool notificationBadge;
  final int? unreadCount;
  final bool notificationCountLoading;
  final bool notificationCountError;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return MergeSemantics(
      child: Semantics(
        role: SemanticsRole.tab,
        selected: isActive,
        inMutuallyExclusiveGroup: true,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                // Mục đang chọn: nền mint dịu + chữ xanh rừng (nav-item-active của web).
                AnimatedContainer(
                  duration: MediaQuery.disableAnimationsOf(context)
                      ? Duration.zero
                      : const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: isActive ? AppColors.mintSoft : Colors.transparent,
                    borderRadius: BorderRadius.circular(AppRadius.control),
                  ),
                  child: NotificationCountBadge(
                    count: notificationBadge ? unreadCount : null,
                    loading: notificationBadge && notificationCountLoading,
                    error: notificationBadge && notificationCountError,
                    child: Icon(
                      isActive ? item.activeIcon : item.icon,
                      size: 22,
                      color: isActive ? AppColors.forest : AppColors.sageMuted,
                    ),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  item.label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                    color: isActive ? AppColors.forest : AppColors.sageMuted,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PlaceholderTab
// ─────────────────────────────────────────────────────────────────────────────

/// A clearly labelled placeholder used for tabs not yet implemented in this pass.
///
/// Shows a lock icon, the tab name, and an explanation so testers know it is
/// intentionally incomplete, not broken.
class PlaceholderTab extends StatelessWidget {
  const PlaceholderTab({
    super.key,
    required this.tabName,
    required this.description,
    required this.icon,
  });

  final String tabName;
  final String description;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.cardGrey,
                    borderRadius: BorderRadius.circular(AppRadius.container),
                  ),
                  child: Icon(icon, size: 36, color: AppColors.textHint),
                ),
                const SizedBox(height: 20),
                Text(
                  tabName,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Sẽ có trong phiên bản tiếp theo',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primaryBlue,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
