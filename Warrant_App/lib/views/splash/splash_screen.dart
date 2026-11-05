import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../widgets/soopi_ui.dart';

/// Displayed while [AuthViewModel.tryAutoLogin] is in progress.
/// GoRouter shows this route at `/` and redirects away once loading is done.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.milkCream,
      body: Container(
        width: double.infinity,
        // Nền mint dịu → kem sữa như hero trang khách trên web.
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.mintSoft, AppColors.milkCream],
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.container),
                boxShadow: AppShadows.hero,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.container),
                child: Image.asset(
                  'assets/brand/logo-mark.png',
                  width: 88,
                  height: 88,
                  errorBuilder: (_, _, _) => Container(
                    width: 88,
                    height: 88,
                    color: AppColors.forest,
                    child: const Icon(
                      Icons.verified_user_outlined,
                      color: AppColors.paperWhite,
                      size: 40,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 22),
            const SoopiBrand(showMark: false, wordmarkHeight: 30),
            const SizedBox(height: 10),
            const Text(
              'Tra cứu & quản lý bảo hành sản phẩm',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.sageMuted,
                letterSpacing: 0.2,
              ),
            ),
            const SizedBox(height: 44),
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: AppColors.forest,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
