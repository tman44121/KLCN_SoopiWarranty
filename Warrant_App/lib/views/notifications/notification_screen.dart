import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../theme/app_theme.dart';
import '../../router/app_router.dart';
import '../../widgets/app_bar_widget.dart';
import 'real_notification_content.dart';

class NotificationScreen extends StatelessWidget {
  const NotificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
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
            const Expanded(child: RealNotificationContent()),
          ],
        ),
      ),
    );
  }
}
