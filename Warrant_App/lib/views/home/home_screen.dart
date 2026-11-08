import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../router/app_router.dart';
import '../../models/portal_ticket_models.dart';
import '../../theme/app_theme.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../viewmodels/request_viewmodel.dart';
import '../../viewmodels/ticket_viewmodel.dart';
import '../../widgets/app_bar_widget.dart';
import '../../widgets/real_request_card.dart';
import '../../widgets/soopi_ui.dart';

// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen
// ─────────────────────────────────────────────────────────────────────────────

/// Trang chủ khách hàng, cùng bố cục trang "Tổng quan" tài khoản trên web:
///   1. Hero mint → kem: "Xin chào, {tên}", mô tả, nút gửi yêu cầu / thiết bị
///   2. Thẻ tiến độ: 3 ô số liệu + "Tiến độ sửa chữa thiết bị của bạn" (tối đa 4 phiếu)
///   3. Cảnh báo báo giá đang chờ khách xác nhận
///   4. Thẻ "Yêu cầu bảo hành trực tuyến" (tối đa 3 yêu cầu)
///
/// Dữ liệu lấy từ API cổng khách qua RequestViewModel / TicketViewModel.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.select<AuthViewModel, dynamic>((vm) => vm.currentUser);
    final String? fullName = user?.fullName;
    final name = fullName == null || fullName.trim().isEmpty
        ? 'bạn'
        : fullName.trim();

    final unreadCount = context.select<AuthViewModel, int?>(
      (vm) => vm.notificationUnreadCount,
    );
    final notificationCountLoading = context.select<AuthViewModel, bool>(
      (vm) => vm.notificationCountLoading,
    );
    final notificationCountError = context.select<AuthViewModel, bool>(
      (vm) => vm.notificationCountError,
    );

    final tickets = _realTickets(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // ── App bar ─────────────────────────────────────────────
            WarrantSafeAppBar(
              unreadCount: unreadCount,
              notificationCountLoading: notificationCountLoading,
              notificationCountError: notificationCountError,
              onNotificationTap: () => context.go(AppRoutes.notifications),
            ),
            const Divider(height: 1),

            // ── Scrollable content ───────────────────────────────────
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.only(bottom: 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SoopiHero(
                      children: [
                        _buildGreeting(name),
                        const SizedBox(height: 18),
                        _buildHeroActions(context),
                        const SizedBox(height: 20),
                        _buildDashboardCard(context, tickets),
                      ],
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // ── Báo giá chờ khách xác nhận ────────────────
                          for (final t in tickets.where(
                            (t) => t.status == 'AWAITING_CUSTOMER_CONFIRMATION',
                          ))
                            Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: _buildQuoteAlert(t),
                            ),

                          // ── Yêu cầu bảo hành trực tuyến ───────────────
                          SoopiPanel(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                PanelHeading(
                                  title: 'Yêu cầu bảo hành trực tuyến',
                                  description:
                                      'Yêu cầu bạn đã gửi trước khi mang máy tới trạm.',
                                  trailing: SoopiLink(
                                    label: 'Xem tất cả →',
                                    onTap: () => context.go(AppRoutes.requests),
                                  ),
                                ),
                                _buildRealRecent(context),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Hero ─────────────────────────────────────────────────────────

  Widget _buildGreeting(String name) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Xin chào, $name', style: AppText.display),
        const SizedBox(height: 10),
        const Text(
          'Theo dõi tiến độ sửa chữa, hạn bảo hành và yêu cầu trực tuyến của '
          'bạn tại một nơi. Cần sửa thiết bị? Gửi yêu cầu trước khi mang máy tới trạm.',
          style: TextStyle(
            fontSize: 15,
            color: AppColors.penguinNavy,
            height: 1.55,
          ),
        ),
      ],
    );
  }

  Widget _buildHeroActions(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        SoopiPrimaryButton(
          compact: true,
          icon: Icons.build_outlined,
          label: 'Gửi yêu cầu bảo hành',
          onPressed: () => context.push(AppRoutes.createRequest),
        ),
        SoopiSecondaryButton(
          compact: true,
          icon: Icons.devices_outlined,
          label: 'Thiết bị của tôi',
          onPressed: () => context.go(AppRoutes.devices),
        ),
      ],
    );
  }

  /// Thẻ trắng nổi trên hero (hero-dashboard-card).
  Widget _buildDashboardCard(BuildContext context, List<_HomeTicket> tickets) {
    int count(String group) =>
        tickets.where((t) => ticketInGroup(group, t.status)).length;
    final awaiting = tickets
        .where((t) => t.status == 'AWAITING_CUSTOMER_CONFIRMATION')
        .toList();
    final loading = !_isLoaded(context);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.paperWhite,
        borderRadius: BorderRadius.circular(AppRadius.container),
        border: Border.all(color: AppColors.sageBorder),
        boxShadow: AppShadows.hero,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final stack =
                  constraints.maxWidth < 600 &&
                  MediaQuery.textScalerOf(context).scale(12) > 18;
              final width = stack
                  ? constraints.maxWidth
                  : (constraints.maxWidth - 16) / 3;
              return Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  SizedBox(
                    width: width,
                    child: StatBox(
                      label: 'Đang xử lý',
                      value: '${count('PROCESSING')}',
                      onTap: () => context.go(AppRoutes.requests),
                    ),
                  ),
                  SizedBox(
                    width: width,
                    child: StatBox(
                      label: 'Chờ bạn xác nhận',
                      value: '${awaiting.length}',
                      valueColor: awaiting.isEmpty
                          ? AppColors.penguinNavy
                          : AppColors.honeyText,
                      onTap: awaiting.isEmpty
                          ? () => context.go(AppRoutes.requests)
                          : awaiting.first.onTap(context),
                    ),
                  ),
                  SizedBox(
                    width: width,
                    child: StatBox(
                      label: 'Chờ nhận máy',
                      value: '${count('READY')}',
                      onTap: () => context.go(AppRoutes.requests),
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Tiến độ sửa chữa thiết bị của bạn',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.penguinNavy,
                  ),
                ),
              ),
              if (tickets.isNotEmpty)
                SoopiLink(
                  label: 'Xem tất cả →',
                  onTap: () => context.go(AppRoutes.requests),
                ),
            ],
          ),
          const SizedBox(height: 10),
          if (loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (tickets.isEmpty)
            Text(
              'Chưa có phiếu sửa chữa nào. Phiếu tạo tại trạm với số điện thoại '
              'của bạn sẽ tự hiện ở đây.',
              style: AppText.meta,
            )
          else
            for (final t in tickets.take(4))
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: TicketRow(
                  title: t.title,
                  meta: '${t.code} · Nhận ${soopiDate(t.receivedAt)}',
                  done: t.currentStep >= 5,
                  badge: t.badge,
                  onTap: t.onTap(context),
                ),
              ),
        ],
      ),
    );
  }

  /// Chỉ hiện vòng quay khi danh sách phiếu đang tải lần đầu.
  bool _isLoaded(BuildContext context) {
    final vm = Provider.of<TicketViewModel?>(context, listen: false);
    if (vm == null) return true;
    return !(vm.loading && !vm.loaded);
  }

  Widget _buildQuoteAlert(_HomeTicket t) {
    return Builder(
      builder: (context) => SoopiAlert(
        message: Text.rich(
          TextSpan(
            children: [
              const TextSpan(text: 'Phiếu '),
              TextSpan(text: t.code, style: AppText.mono),
              TextSpan(
                text:
                    ' (${t.title}) có báo giá sửa chữa đang chờ bạn xác nhận.',
              ),
            ],
          ),
        ),
        action: Align(
          alignment: Alignment.centerLeft,
          child: SoopiPrimaryButton(
            compact: true,
            label: 'Xem báo giá',
            onPressed: t.onTap(context),
          ),
        ),
      ),
    );
  }

  // ── Dữ liệu phiếu ────────────────────────────────────────────────

  List<_HomeTicket> _realTickets(BuildContext context) {
    // Nullable: một số màn thử chỉ cung cấp AuthViewModel/RequestViewModel.
    final vm = Provider.of<TicketViewModel?>(context);
    if (vm == null) return const [];
    if (!vm.loaded && !vm.loading && vm.error == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) vm.ensureLoaded();
      });
    }
    final rows = [...vm.tickets]
      ..sort((a, b) => b.receivedAt.compareTo(a.receivedAt));
    return rows.map(_HomeTicket.fromPortal).toList();
  }

  // ── Yêu cầu trực tuyến ───────────────────────────────────────────

  Widget _buildRealRecent(BuildContext context) {
    final requests = context.watch<RequestViewModel>();
    if (!requests.loaded && !requests.loading && requests.error == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.read<RequestViewModel>().ensureLoaded();
      });
    }
    if (requests.loading && !requests.loaded) {
      return const Center(child: CircularProgressIndicator());
    }
    if (requests.error != null) {
      return TextButton(
        onPressed: requests.refresh,
        child: const Text('Không tải được yêu cầu. Chạm để thử lại.'),
      );
    }
    if (requests.requests.isEmpty) return _buildEmptyState(context);
    return Column(
      children: requests.requests
          .take(3)
          .map(
            (request) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: RealRequestCard(
                request: request,
                onTap: () => context.push(
                  '${AppRoutes.requests}/${Uri.encodeComponent(request.code)}',
                ),
              ),
            ),
          )
          .toList(),
    );
  }

  // ── Empty state ───────────────────────────────────────────────────

  Widget _buildEmptyState(BuildContext context) {
    return SoopiEmpty(
      icon: Icons.inbox_outlined,
      title: 'Chưa có yêu cầu nào',
      text:
          'Gửi yêu cầu bảo hành hoặc sửa chữa để bắt đầu theo dõi tình trạng thiết bị.',
      action: SoopiPrimaryButton(
        compact: true,
        label: 'Gửi yêu cầu bảo hành',
        onPressed: () => context.push(AppRoutes.createRequest),
      ),
    );
  }
}

/// Một phiếu hiển thị trên Trang chủ.
class _HomeTicket {
  const _HomeTicket({
    required this.code,
    required this.title,
    required this.status,
    required this.receivedAt,
    required this.currentStep,
    required this.badge,
    required this.path,
  });

  factory _HomeTicket.fromPortal(PortalTicketSummary t) => _HomeTicket(
    code: t.code,
    title: t.productName?.isNotEmpty == true ? t.productName! : 'Thiết bị',
    status: t.status,
    receivedAt: t.receivedAt,
    currentStep: t.stopped ? -1 : t.currentStep,
    badge: StatusBadge(
      label: portalTicketStatusLabel(t.status),
      tone: ticketStatusTone(t.status),
    ),
    path: AppRoutes.realTicket(t.code),
  );

  final String code;
  final String title;
  final String status;
  final DateTime receivedAt;
  final int currentStep;
  final Widget badge;
  final String path;

  VoidCallback onTap(BuildContext context) =>
      () => context.push(path);
}
