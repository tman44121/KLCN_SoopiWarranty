import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

// Các khối giao diện dùng chung, dựng theo class CSS của trang khách trên Web
// (customer.css): hero-section, content-panel-card, dash-stat-box, ticket-item-row,
// mini-steps, kv-row, kh-alert, empty-state và badge trạng thái.

/// Các bước tiến độ hiển thị cho khách, cùng STEP_LABELS của web.
const List<String> kCustomerStepLabels = [
  'Tiếp nhận',
  'Chẩn đoán',
  'Chờ linh kiện',
  'Đang sửa',
  'Kiểm tra chất lượng',
  'Sẵn sàng nhận máy',
];

/// Nhóm trạng thái phiếu như bộ lọc "Lịch sử bảo hành" trên web (TICKET_GROUPS).
const Map<String, List<String>> kTicketGroups = {
  'PROCESSING': ['RECEIVED', 'INSPECTING', 'DIAGNOSED', 'REPAIRING'],
  'WAITING': [
    'AWAITING_PARTS',
    'AWAITING_QUOTE_APPROVAL',
    'AWAITING_CUSTOMER_CONFIRMATION',
  ],
  'READY': ['COMPLETED', 'AWAITING_RETURN'],
  'COMPLETED': ['DELIVERED', 'RETURNED_UNREPAIRED'],
};

bool ticketInGroup(String group, String status) =>
    group == 'ALL' || (kTicketGroups[group]?.contains(status) ?? false);

// ─────────────────────────────────────────────────────────────────────────────
// Thương hiệu
// ─────────────────────────────────────────────────────────────────────────────

/// Logo Soopi (chim cánh cụt + chữ soopiwarranty) như header trang khách.
class SoopiBrand extends StatelessWidget {
  const SoopiBrand({
    super.key,
    this.markSize = 34,
    this.wordmarkHeight = 20,
    this.showMark = true,
  });

  final double markSize;
  final double wordmarkHeight;
  final bool showMark;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showMark) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.control),
            child: Image.asset(
              'assets/brand/logo-mark.png',
              width: markSize,
              height: markSize,
              errorBuilder: (_, _, _) => Container(
                width: markSize,
                height: markSize,
                color: AppColors.forest,
                child: const Icon(
                  Icons.verified_user_outlined,
                  color: AppColors.paperWhite,
                  size: 18,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
        Image.asset(
          'assets/brand/wordmark.png',
          height: wordmarkHeight,
          semanticLabel: 'Soopi',
          errorBuilder: (_, _, _) => const Text(
            'Soopi',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.forest,
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

/// Dải đầu trang: nền chuyển mint dịu → kem sữa (hero-section).
class SoopiHero extends StatelessWidget {
  const SoopiHero({
    super.key,
    required this.children,
    this.padding = const EdgeInsets.fromLTRB(16, 24, 16, 24),
  });

  final List<Widget> children;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppColors.mintSoft, AppColors.milkCream],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Thẻ nội dung
// ─────────────────────────────────────────────────────────────────────────────

/// Thẻ trắng viền lá bo 10px (content-panel-card / ticket-card-box).
class SoopiPanel extends StatelessWidget {
  const SoopiPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.color = AppColors.paperWhite,
    this.borderColor = AppColors.sageBorder,
    this.onTap,
    this.elevated = true,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color color;
  final Color borderColor;
  final VoidCallback? onTap;
  final bool elevated;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(AppRadius.container);
    return Container(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: elevated ? AppShadows.card : null,
      ),
      child: Material(
        color: color,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: BorderSide(color: borderColor),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

/// Tiêu đề thẻ (card-heading-title) + mô tả (card-heading-desc) + nút phụ bên phải.
class PanelHeading extends StatelessWidget {
  const PanelHeading({
    super.key,
    required this.title,
    this.description,
    this.trailing,
  });

  final String title;
  final String? description;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppText.cardTitle),
                if (description != null) ...[
                  const SizedBox(height: 4),
                  Text(description!, style: AppText.cardDesc),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 12), trailing!],
        ],
      ),
    );
  }
}

/// Liên kết chữ xanh rừng kiểu "Xem tất cả →" (dispatch-link).
class SoopiLink extends StatelessWidget {
  const SoopiLink({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.control),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.forest,
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trạng thái
// ─────────────────────────────────────────────────────────────────────────────

/// Badge trạng thái: cặp nền nhạt + chữ đậm cùng sắc, bo 8px, có biểu tượng
/// riêng cho tốt / cảnh báo / lỗi để không chỉ khác nhau ở màu.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.label, required this.tone});

  final String label;
  final StatusTone tone;

  IconData? get _icon => switch (tone) {
    StatusTone.success => Icons.check_rounded,
    StatusTone.warning => Icons.schedule_rounded,
    StatusTone.danger => Icons.close_rounded,
    _ => null,
  };

  @override
  Widget build(BuildContext context) {
    final icon = _icon;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: BorderRadius.circular(AppRadius.control),
        border: Border.all(color: tone.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: tone.foreground),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: tone.foreground,
                height: 1.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Dãy 6 vạch tiến độ nhỏ (mini-steps) trên thẻ phiếu.
class MiniSteps extends StatelessWidget {
  const MiniSteps({super.key, required this.current});

  /// Bước hiện tại (0-based); âm khi phiếu đã dừng.
  final int current;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < kCustomerStepLabels.length; i++) ...[
          if (i > 0) const SizedBox(width: 4),
          Expanded(
            child: Container(
              height: 5,
              decoration: BoxDecoration(
                color: i < current
                    ? AppColors.forest
                    : i == current
                    ? AppColors.honey
                    : AppColors.sageDivider,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ô số liệu và hàng phiếu
// ─────────────────────────────────────────────────────────────────────────────

/// Ô số liệu trên thẻ hero (dash-stat-box).
class StatBox extends StatelessWidget {
  const StatBox({
    super.key,
    required this.label,
    required this.value,
    this.valueColor = AppColors.penguinNavy,
    this.onTap,
  });

  final String label;
  final String value;
  final Color valueColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.milkCream,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.container),
        side: const BorderSide(color: AppColors.sageDivider),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: AppColors.sageMuted,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: valueColor,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Hàng phiếu gọn trong thẻ "Tiến độ sửa chữa" (ticket-item-row).
class TicketRow extends StatelessWidget {
  const TicketRow({
    super.key,
    required this.title,
    required this.meta,
    required this.badge,
    this.done = false,
    this.onTap,
  });

  final String title;
  final String meta;
  final Widget badge;
  final bool done;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.milkCream,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.control),
        side: const BorderSide(color: AppColors.sageDivider),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: done ? AppColors.mintSoft : AppColors.mistLilac,
                  borderRadius: BorderRadius.circular(AppRadius.control),
                ),
                child: Icon(
                  Icons.build_outlined,
                  size: 17,
                  color: done ? AppColors.forest : AppColors.penguinNavy,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.penguinNavy,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      meta,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.meta,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Flexible(child: badge),
            ],
          ),
        ),
      ),
    );
  }
}

/// Một dòng nhãn – giá trị (kv-row); [total] in đậm như dòng tổng tiền.
class KvRow extends StatelessWidget {
  const KvRow({
    super.key,
    required this.label,
    required this.value,
    this.total = false,
    this.valueColor,
  });

  final String label;
  final String value;
  final bool total;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: BoxDecoration(
        border: total
            ? const Border(top: BorderSide(color: AppColors.sageBorder))
            : const Border(bottom: BorderSide(color: AppColors.sageDivider)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: total ? 14 : 13,
                fontWeight: total ? FontWeight.w700 : FontWeight.w400,
                color: total ? AppColors.penguinNavy : AppColors.sageMuted,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: total ? 15 : 13,
                fontWeight: total ? FontWeight.w800 : FontWeight.w600,
                color:
                    valueColor ??
                    (total ? AppColors.forest : AppColors.penguinNavy),
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Thông báo và trạng thái rỗng
// ─────────────────────────────────────────────────────────────────────────────

/// Dải thông báo nhấn (kh-alert) với nút hành động tùy chọn.
class SoopiAlert extends StatelessWidget {
  const SoopiAlert({
    super.key,
    required this.message,
    this.tone = StatusTone.warning,
    this.action,
  });

  final Widget message;
  final StatusTone tone;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: BorderRadius.circular(AppRadius.container),
        border: Border.all(color: tone.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DefaultTextStyle.merge(
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: tone.foreground,
              height: 1.4,
            ),
            child: message,
          ),
          if (action != null) ...[const SizedBox(height: 10), action!],
        ],
      ),
    );
  }
}

/// Trạng thái rỗng (empty-state): biểu tượng, tiêu đề, mô tả, hành động.
class SoopiEmpty extends StatelessWidget {
  const SoopiEmpty({
    super.key,
    required this.icon,
    required this.title,
    required this.text,
    this.action,
  });

  final IconData icon;
  final String title;
  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.mintSoft,
              borderRadius: BorderRadius.circular(AppRadius.container),
            ),
            child: Icon(icon, size: 28, color: AppColors.forest),
          ),
          const SizedBox(height: 14),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.penguinNavy,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            text,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.sageMuted,
              height: 1.5,
            ),
          ),
          if (action != null) ...[const SizedBox(height: 16), action!],
        ],
      ),
    );
  }
}

/// Nút chính kiểu web (btn-primary-teal): xanh rừng, bo 10px, bóng xanh nhẹ.
class SoopiPrimaryButton extends StatelessWidget {
  const SoopiPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.compact = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final style = ElevatedButton.styleFrom(
      minimumSize: Size(compact ? 0 : double.infinity, compact ? 36 : 44),
      padding: EdgeInsets.symmetric(horizontal: compact ? 14 : 20),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.container),
      ),
      textStyle: TextStyle(
        fontSize: compact ? 13 : 14,
        fontWeight: FontWeight.w600,
      ),
    );
    final button = icon == null
        ? ElevatedButton(onPressed: onPressed, style: style, child: Text(label))
        : ElevatedButton.icon(
            onPressed: onPressed,
            style: style,
            icon: Icon(icon, size: 18),
            label: Text(label),
          );
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.container),
        boxShadow: onPressed == null ? null : AppShadows.primaryButton,
      ),
      child: button,
    );
  }
}

/// Nút phụ kiểu web (btn-secondary-white): nền trắng, viền lá, chữ xanh chim cánh cụt.
class SoopiSecondaryButton extends StatelessWidget {
  const SoopiSecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.compact = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final style = OutlinedButton.styleFrom(
      minimumSize: Size(compact ? 0 : double.infinity, compact ? 36 : 44),
      padding: EdgeInsets.symmetric(horizontal: compact ? 14 : 20),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.container),
      ),
      textStyle: TextStyle(
        fontSize: compact ? 13 : 14,
        fontWeight: FontWeight.w600,
      ),
    );
    return icon == null
        ? OutlinedButton(onPressed: onPressed, style: style, child: Text(label))
        : OutlinedButton.icon(
            onPressed: onPressed,
            style: style,
            icon: Icon(icon, size: 18),
            label: Text(label),
          );
  }
}

/// Ngày dd/MM/yyyy và giờ HH:mm theo giờ máy, như fmt().date / fmt().dateTime của web.
String soopiDate(DateTime value) {
  final local = value.toLocal();
  return '${local.day.toString().padLeft(2, '0')}/'
      '${local.month.toString().padLeft(2, '0')}/${local.year}';
}

String soopiDateTime(DateTime value) {
  final local = value.toLocal();
  return '${soopiDate(local)} ${local.hour.toString().padLeft(2, '0')}:'
      '${local.minute.toString().padLeft(2, '0')}';
}

/// Tiền kiểu Việt Nam như fmt.money của web: 3337200 → "3.337.200 đ" (làm tròn tới đồng).
String soopiMoney(num value) {
  final rounded = value.round();
  final digits = rounded.abs().toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
  return '${rounded < 0 ? '-' : ''}$digits đ';
}
