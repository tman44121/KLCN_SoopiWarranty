import 'package:flutter/material.dart';
import '../../data/mock_data.dart';
import '../../theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
// AppStatusChip
// ─────────────────────────────────────────────────────────────────────────────

/// A small stamp-style status label used throughout the app (bo 8px như web).
///
/// Color is never the sole indicator of status; the [label] text always conveys
/// the state. Colors are consistent with [AppColors] semantic tokens:
///   • [TicketStatus.completed] and [TicketStatus.delivered] → success green
///   • [TicketStatus.awaitingCustomerConfirmation] and quote-related → warning amber
///   • [TicketStatus.received] and [RequestStatus.pendingIntake] → neutral grey
///   • [TicketStatus.awaitingReturn] → warning; returnedUnrepaired → muted
///   • Everything else in progress → tím sương (processing)
class AppStatusChip extends StatelessWidget {
  const AppStatusChip({
    super.key,
    required this.label,
    required this.chipColor,
    required this.textColor,
  });

  final String label;
  final Color chipColor;
  final Color textColor;

  /// Creates a chip pre-styled for a [TicketStatus].
  factory AppStatusChip.forTicket(TicketStatus status) {
    final (bg, fg) = _ticketColors(status);
    return AppStatusChip(label: status.label, chipColor: bg, textColor: fg);
  }

  /// Creates a chip pre-styled for a [RequestStatus].
  factory AppStatusChip.forRequest(RequestStatus status) {
    final (bg, fg) = _requestColors(status);
    return AppStatusChip(label: status.label, chipColor: bg, textColor: fg);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: chipColor,
        borderRadius: BorderRadius.circular(AppRadius.control),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: textColor,
          height: 1.2,
        ),
      ),
    );
  }

  // Cùng bảng tông TICKET_STATUS_CUSTOMER / WARRANTY_REQUEST_STATUS của web.
  static (Color bg, Color fg) _ticketColors(TicketStatus s) {
    final tone = switch (s) {
      TicketStatus.completed || TicketStatus.delivered => StatusTone.success,
      TicketStatus.awaitingCustomerConfirmation ||
      TicketStatus.awaitingQuoteApproval ||
      TicketStatus.awaitingParts ||
      TicketStatus.awaitingReturn => StatusTone.warning,
      TicketStatus.returnedUnrepaired ||
      TicketStatus.received => StatusTone.neutral,
      // Đang xử lý: inspecting, diagnosed, repairing
      _ => StatusTone.processing,
    };
    return (tone.background, tone.foreground);
  }

  static (Color bg, Color fg) _requestColors(RequestStatus s) {
    final tone = switch (s) {
      RequestStatus.pendingIntake => StatusTone.warning,
      RequestStatus.converted => StatusTone.success,
      RequestStatus.cancelled => StatusTone.neutral,
    };
    return (tone.background, tone.foreground);
  }
}
