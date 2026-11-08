import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../router/app_router.dart';
import '../../theme/app_theme.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../widgets/app_bar_widget.dart';
import '../../widgets/soopi_ui.dart';

/// Soopi – Tài khoản (Profile & Settings) Screen
///
/// Thông tin hồ sơ lấy từ [AuthViewModel.currentUser]; chỉnh sửa hồ sơ và đổi
/// mật khẩu gọi API cổng khách.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  @override
  Widget build(BuildContext context) {
    final vm = context.watch<AuthViewModel>();
    final user = vm.currentUser;
    final isLoading = vm.isLoading;

    final fullName = user?.fullName.trim();
    final phone = user?.phone.trim();
    final email = user?.email.trim();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // ── App bar ─────────────────────────────────────────────
            WarrantSafeAppBar(
              unreadCount: vm.notificationUnreadCount,
              notificationCountLoading: vm.notificationCountLoading,
              notificationCountError: vm.notificationCountError,
              onNotificationTap: () => context.push(AppRoutes.notifications),
            ),
            const Divider(height: 1),

            // ── Scrollable content ───────────────────────────────────
            Expanded(
              child: RefreshIndicator(
                onRefresh: vm.refreshProfile,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.only(bottom: 32),
                  child: Column(
                    children: [
                      // ── Profile header ──────────────────────────────
                      if (isLoading)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 40),
                          child: Center(child: CircularProgressIndicator()),
                        )
                      else if (vm.errorMessage != null &&
                          user?.customerCode == null)
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: 40,
                            horizontal: 20,
                          ),
                          child: Column(
                            children: [
                              Text(
                                vm.errorMessage!,
                                style: const TextStyle(color: AppColors.error),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 12),
                              ElevatedButton(
                                onPressed: () => vm.refreshProfile(),
                                child: const Text('Thử lại'),
                              ),
                            ],
                          ),
                        )
                      else
                        _buildProfileHeader(
                          fullName: fullName,
                          phone: phone,
                          email: email,
                        ),
                      const SizedBox(height: 20),

                      // ── CÁ NHÂN ────────────────────────────────────
                      _buildSectionLabel('CÁ NHÂN'),
                      _buildGroupCard([
                        _buildMenuTile(
                          icon: Icons.person_outline_rounded,
                          iconBgColor: AppColors.primaryLight,
                          iconColor: AppColors.primaryBlue,
                          title: 'Chỉnh sửa thông tin cá nhân',
                          subtitle: 'Họ tên, email, địa chỉ · SĐT qua trạm',
                          onTap: () => context.go(AppRoutes.editProfile),
                        ),
                      ]),
                      const SizedBox(height: 12),

                      // ── BẢO MẬT ────────────────────────────────────
                      _buildSectionLabel('BẢO MẬT'),
                      _buildGroupCard([
                        _buildMenuTile(
                          icon: Icons.lock_outline_rounded,
                          iconBgColor: AppColors.honeyTint,
                          iconColor: AppColors.honeyText,
                          title: 'Đổi mật khẩu',
                          subtitle: 'Cập nhật mật khẩu đăng nhập',
                          onTap: () => context.go(AppRoutes.changePassword),
                        ),
                      ]),
                      const SizedBox(height: 12),

                      // ── TUỲ CHỈNH ──────────────────────────────────
                      _buildSectionLabel('TUỲ CHỈNH'),
                      _buildGroupCard([
                        _buildMenuTile(
                          icon: Icons.notifications_none_rounded,
                          iconBgColor: AppColors.primaryLight,
                          iconColor: AppColors.primaryBlue,
                          title: 'Thông báo trong ứng dụng',
                          subtitle: 'Xem thông báo và trạng thái chưa đọc',
                          onTap: () => context.push(AppRoutes.notifications),
                        ),
                      ]),
                      const SizedBox(height: 28),

                      // ── ĐĂNG XUẤT ──────────────────────────────────
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: OutlinedButton.icon(
                          onPressed: () => _confirmLogout(context),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.expiredWine,
                            side: const BorderSide(color: AppColors.peach),
                            minimumSize: const Size(double.infinity, 46),
                          ),
                          icon: const Icon(Icons.logout_rounded, size: 20),
                          label: const Text(
                            'Đăng xuất',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // ── Footer ─────────────────────────────────────
                      Text(
                        'Soopi · Trung tâm Dịch vụ & Bảo hành Điện tử',
                        style: AppText.meta.copyWith(fontSize: 11),
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────
  //  PROFILE HEADER
  // ──────────────────────────────────────────────────────────────────

  Widget _buildProfileHeader({
    required String? fullName,
    required String? phone,
    required String? email,
  }) {
    final displayName = (fullName != null && fullName.isNotEmpty)
        ? fullName
        : 'Khách hàng';
    final initials = _initials(displayName);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: SoopiPanel(
        padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 16),
        child: SizedBox(
          width: double.infinity,
          child: Column(
            children: [
              // ── Avatar (chữ cái đầu trên nền xanh rừng) ───────────
              CircleAvatar(
                radius: 36,
                backgroundColor: AppColors.forest,
                child: Text(
                  initials,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: AppColors.paperWhite,
                    letterSpacing: 1,
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ── Name ─────────────────────────────────────────────
              Text(
                displayName,
                textAlign: TextAlign.center,
                style: AppText.cardTitle.copyWith(fontSize: 20),
              ),
              const SizedBox(height: 4),

              // ── Phone ────────────────────────────────────────────
              if (phone != null && phone.isNotEmpty)
                Text(
                  phone,
                  style: AppText.mono.copyWith(color: AppColors.forest),
                ),

              // ── Email ─────────────────────────────────────────────
              if (email != null && email.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  email,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
              const SizedBox(height: 12),

              // ── Customer badge ────────────────────────────────────
              const StatusBadge(
                label: 'Tài khoản Soopi',
                tone: StatusTone.neutral,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────
  //  SECTION HELPERS
  // ──────────────────────────────────────────────────────────────────

  Widget _buildSectionLabel(String text) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text(text, style: AppText.label),
      ),
    );
  }

  Widget _buildGroupCard(List<Widget> children) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: SoopiPanel(
        padding: EdgeInsets.zero,
        child: Column(children: children),
      ),
    );
  }

  Widget _buildMenuTile({
    required IconData icon,
    required Color iconBgColor,
    required Color iconColor,
    required String title,
    required String subtitle,
    Widget? trailing,
    VoidCallback? onTap,
  }) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: iconBgColor,
          borderRadius: BorderRadius.circular(AppRadius.control),
        ),
        child: Icon(icon, color: iconColor, size: 20),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
      ),
      trailing:
          trailing ??
          const Icon(Icons.chevron_right_rounded, color: AppColors.sageFaint),
      onTap: onTap,
    );
  }

  // ──────────────────────────────────────────────────────────────────
  //  ACTIONS
  // ──────────────────────────────────────────────────────────────────

  Future<void> _confirmLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Đăng xuất'),
        content: const Text(
          'Bạn có chắc muốn đăng xuất khỏi tài khoản này không?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Huỷ'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.logout),
            child: const Text('Đăng xuất'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      await context.read<AuthViewModel>().logout();
      // GoRouter detects isAuthenticated=false and redirects to /login.
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  UTILITIES
  // ──────────────────────────────────────────────────────────────────

  /// Extracts up to 2 initials from a full name.
  String _initials(String name) {
    final words = name.trim().split(RegExp(r'\s+'));
    if (words.isEmpty) return '?';
    if (words.length == 1) return words[0][0].toUpperCase();
    // First letter of first word + first letter of last word.
    return '${words.first[0]}${words.last[0]}'.toUpperCase();
  }
}
