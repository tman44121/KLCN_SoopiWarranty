import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../data/mock_data.dart';
import '../../theme/app_theme.dart';
import '../../router/app_router.dart';
import '../../widgets/app_bar_widget.dart';
import '../../widgets/soopi_ui.dart';
import 'package:provider/provider.dart';
import '../../viewmodels/auth_viewmodel.dart';
import 'real_notification_content.dart';

class NotificationScreen extends StatefulWidget {
  const NotificationScreen({super.key});

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  @override
  Widget build(BuildContext context) {
    final isMock = context.select<AuthViewModel, bool>((vm) => vm.isMock);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const WarrantSafeAppBar(),
            WarrantSafeTitleRow(
              title: 'Thông báo',
              onBackTap: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go(AppRoutes.home);
                }
              },
            ),
            if (isMock && mockNotifications.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    Text(
                      '${mockNotifications.where((n) => !n.isRead).length} chưa đọc',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 14,
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        setState(() {
                          for (int i = 0; i < mockNotifications.length; i++) {
                            mockNotifications[i] = MockNotification(
                              id: mockNotifications[i].id,
                              title: mockNotifications[i].title,
                              body: mockNotifications[i].body,
                              isRead: true,
                              createdAt: mockNotifications[i].createdAt,
                              relatedRequestId:
                                  mockNotifications[i].relatedRequestId,
                            );
                          }
                        });
                        notifyMockDataChanged();
                      },
                      child: const Text(
                        'Đánh dấu đã đọc',
                        style: TextStyle(
                          color: AppColors.forest,
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        setState(() {
                          mockNotifications.clear();
                        });
                        notifyMockDataChanged();
                      },
                      child: const Text(
                        'Xóa tất cả',
                        style: TextStyle(
                          color: AppColors.error,
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: !isMock
                  ? const RealNotificationContent()
                  : (mockNotifications.isEmpty
                        ? _buildEmptyState()
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                            itemCount: mockNotifications.length,
                            itemBuilder: (context, index) {
                              final notif = mockNotifications[index];
                              return _buildNotificationItem(notif, index);
                            },
                          )),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return const Center(
      child: SoopiEmpty(
        icon: Icons.notifications_off_outlined,
        title: 'Không có thông báo mới',
        text: 'Các thông báo về tiến trình sửa chữa sẽ xuất hiện ở đây.',
      ),
    );
  }

  Widget _buildNotificationItem(MockNotification notif, int index) {
    return InkWell(
      onTap: () {
        setState(() {
          mockNotifications[index] = MockNotification(
            id: notif.id,
            title: notif.title,
            body: notif.body,
            isRead: true,
            createdAt: notif.createdAt,
            relatedRequestId: notif.relatedRequestId,
          );
        });
        notifyMockDataChanged();

        if (notif.relatedRequestId != null) {
          // If the title contains "Báo giá", try to navigate to quote
          if (notif.title.toLowerCase().contains('báo giá')) {
            context.push(
              '${AppRoutes.requests}/${notif.relatedRequestId}/ticket/quote',
            );
          } else {
            // Otherwise to ticket/request
            final req = mockRequests
                .where((r) => r.id == notif.relatedRequestId)
                .firstOrNull;
            if (req != null && req.ticketId != null) {
              context.push(
                '${AppRoutes.requests}/${notif.relatedRequestId}/ticket',
              );
            } else {
              context.push('${AppRoutes.requests}/${notif.relatedRequestId}');
            }
          }
        }
      },
      borderRadius: BorderRadius.circular(AppRadius.container),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: notif.isRead ? AppColors.white : AppColors.mintWash,
          borderRadius: BorderRadius.circular(AppRadius.container),
          border: Border.all(
            color: notif.isRead ? AppColors.border : AppColors.mintBorder,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: notif.isRead ? AppColors.cardGrey : AppColors.mintSoft,
                borderRadius: BorderRadius.circular(AppRadius.control),
              ),
              child: Icon(
                notif.title.toLowerCase().contains('báo giá')
                    ? Icons.request_quote_rounded
                    : Icons.info_rounded,
                color: notif.isRead ? AppColors.textHint : AppColors.forest,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notif.title,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: notif.isRead
                                ? FontWeight.w600
                                : FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                      if (!notif.isRead)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColors.forest,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    notif.body,
                    style: TextStyle(
                      fontSize: 14,
                      color: notif.isRead
                          ? AppColors.textSecondary
                          : AppColors.textPrimary,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(_formatTimeAgo(notif.createdAt), style: AppText.meta),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTimeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inDays > 0) return '${diff.inDays} ngày trước';
    if (diff.inHours > 0) return '${diff.inHours} giờ trước';
    if (diff.inMinutes > 0) return '${diff.inMinutes} phút trước';
    return 'Vừa xong';
  }
}
