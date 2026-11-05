import 'package:flutter/material.dart';
import '../models/portal_request_models.dart';
import '../theme/app_theme.dart';
import 'soopi_ui.dart';

/// Một yêu cầu trực tuyến, dựng như hàng ticket-item-row trong thẻ
/// "Yêu cầu bảo hành trực tuyến" của web.
class RealRequestCard extends StatelessWidget {
  const RealRequestCard({super.key, required this.request, this.onTap});
  final PortalRequestSummary request;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.milkCream,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadius.control),
      side: const BorderSide(color: AppColors.sageDivider),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: AppColors.honeyTint,
                borderRadius: BorderRadius.circular(AppRadius.control),
              ),
              child: const Icon(
                Icons.description_outlined,
                size: 17,
                color: AppColors.honeyText,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    request.brandModel?.isNotEmpty == true
                        ? request.brandModel!
                        : 'Thiết bị',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.penguinNavy,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'Mã yêu cầu ${request.code}',
                    style: AppText.mono.copyWith(
                      fontSize: 12,
                      color: AppColors.sageMuted,
                    ),
                  ),
                  if (request.createdAt != null)
                    Text(
                      'Gửi ${soopiDate(request.createdAt!)}',
                      style: AppText.meta,
                    ),
                  if (request.serialOrImei?.isNotEmpty == true)
                    Text(
                      request.serialOrImei!,
                      style: AppText.mono.copyWith(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppColors.sageMuted,
                      ),
                    ),
                  const SizedBox(height: 8),
                  StatusBadge(
                    label: portalRequestStatusLabel(request.status),
                    tone: requestStatusTone(request.status),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.sageFaint),
          ],
        ),
      ),
    ),
  );
}
