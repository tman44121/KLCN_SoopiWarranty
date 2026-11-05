import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../data/mock_data.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_status_chip.dart';
import '../../router/app_router.dart';
import '../../widgets/app_bar_widget.dart';

class TicketDetailScreen extends StatelessWidget {
  const TicketDetailScreen({super.key, required this.requestId});

  final String requestId;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: mockDataRevision,
    builder: (context, _) => _buildBody(context),
  );

  Widget _buildBody(BuildContext context) {
    if (!context.watch<AuthViewModel>().isMock) {
      return const Scaffold(
        body: Center(
          child: Text('Chi tiết phiếu Real chưa được tích hợp API.'),
        ),
      );
    }
    final request = mockRequests.where((r) => r.id == requestId).firstOrNull;

    if (request == null ||
        request.ticketId == null ||
        request.ticketStatus == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Lỗi')),
        body: const Center(child: Text('Phiếu tiếp nhận không tồn tại.')),
      );
    }

    final ticketStatus = request.ticketStatus!;
    final quote = mockQuotations
        .where((q) => q.ticketId == request.ticketId)
        .firstOrNull;
    final hasQuoteToReview =
        quote != null &&
        quote.internalStatus == InternalQuoteStatus.approved &&
        quote.customerStatus == CustomerQuoteStatus.pending &&
        ticketStatus == TicketStatus.awaitingCustomerConfirmation;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            const WarrantSafeAppBar(),
            WarrantSafeTitleRow(
              title: request.ticketId!,
              onBackTap: () => context.pop(),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Current Status Header
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(
                          AppRadius.container,
                        ),
                        border: Border.all(color: AppColors.border, width: 0.8),
                      ),
                      child: Column(
                        children: [
                          const Text(
                            'Trạng thái hiện tại',
                            style: TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          AppStatusChip.forTicket(ticketStatus),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Quotation Action Block
                    if (hasQuoteToReview) ...[
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppColors.warning.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(
                            AppRadius.container,
                          ),
                          border: Border.all(
                            color: AppColors.warning.withValues(alpha: 0.5),
                            width: 1.5,
                          ),
                        ),
                        child: Column(
                          children: [
                            const Icon(
                              Icons.request_quote_rounded,
                              color: AppColors.warning,
                              size: 36,
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'Cần xác nhận báo giá',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Trung tâm đã hoàn tất chẩn đoán và lập báo giá sửa chữa. Vui lòng xem chi tiết và xác nhận để quá trình sửa chữa được tiến hành.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                color: AppColors.textSecondary,
                                height: 1.4,
                              ),
                            ),
                            const SizedBox(height: 20),
                            ElevatedButton(
                              onPressed: () => context.push(
                                '${AppRoutes.requests}/${request.id}/ticket/quote',
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.warning,
                                foregroundColor: AppColors.white,
                                minimumSize: const Size(double.infinity, 44),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                    AppRadius.control,
                                  ),
                                ),
                              ),
                              child: const Text(
                                'XEM & XÁC NHẬN BÁO GIÁ',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],

                    if (quote != null &&
                        !hasQuoteToReview &&
                        (quote.customerStatus == CustomerQuoteStatus.accepted ||
                            quote.customerStatus ==
                                CustomerQuoteStatus.declined)) ...[
                      InkWell(
                        onTap: () => context.push(
                          '${AppRoutes.requests}/${request.id}/ticket/quote',
                        ),
                        borderRadius: BorderRadius.circular(
                          AppRadius.container,
                        ),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 16,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.white,
                            borderRadius: BorderRadius.circular(
                              AppRadius.container,
                            ),
                            border: Border.all(
                              color: AppColors.border,
                              width: 0.8,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.request_quote_outlined,
                                color: AppColors.primaryBlue,
                              ),
                              const SizedBox(width: 12),
                              const Expanded(
                                child: Text(
                                  'Xem lại báo giá',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              const Icon(
                                Icons.chevron_right_rounded,
                                color: AppColors.textHint,
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],

                    // Timeline
                    const Text(
                      'Tiến trình xử lý',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(
                          AppRadius.container,
                        ),
                        border: Border.all(color: AppColors.border, width: 0.8),
                      ),
                      child: Column(
                        children: _buildTimeline(ticketStatus, quote),
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

  List<Widget> _buildTimeline(
    TicketStatus currentStatus,
    MockQuotation? quote,
  ) {
    // Determine the path based on quotation rejection or normal flow
    final isRejected =
        quote?.customerStatus == CustomerQuoteStatus.declined ||
        currentStatus == TicketStatus.awaitingReturn ||
        currentStatus == TicketStatus.returnedUnrepaired;

    // Nodes format: [Label, isCompleted, isCurrent, isSkipped]
    final nodes = <Map<String, dynamic>>[];

    // 1. Tiếp nhận
    nodes.add({
      'label': 'Tiếp nhận & Kiểm tra',
      'state': _getTimelineState(
        current: currentStatus,
        target: [TicketStatus.received, TicketStatus.inspecting],
        past: [
          TicketStatus.diagnosed,
          TicketStatus.awaitingQuoteApproval,
          TicketStatus.awaitingCustomerConfirmation,
          TicketStatus.awaitingParts,
          TicketStatus.awaitingReturn,
          TicketStatus.repairing,
          TicketStatus.completed,
          TicketStatus.delivered,
          TicketStatus.returnedUnrepaired,
        ],
      ),
    });

    // 2. Chẩn đoán & Báo giá
    nodes.add({
      'label': 'Chẩn đoán & Báo giá',
      'state': _getTimelineState(
        current: currentStatus,
        target: [
          TicketStatus.diagnosed,
          TicketStatus.awaitingQuoteApproval,
          TicketStatus.awaitingCustomerConfirmation,
        ],
        past: [
          TicketStatus.awaitingParts,
          TicketStatus.awaitingReturn,
          TicketStatus.repairing,
          TicketStatus.completed,
          TicketStatus.delivered,
          TicketStatus.returnedUnrepaired,
        ],
      ),
    });

    if (isRejected) {
      // Customer declined; return is a later, separate handover transition.
      nodes.add({
        'label': 'Chờ trả máy',
        'state': _getTimelineState(
          current: currentStatus,
          target: [TicketStatus.awaitingReturn],
          past: [TicketStatus.returnedUnrepaired],
        ),
      });
      nodes.add({
        'label': 'Đã trả máy (không sửa)',
        'state': _getTimelineState(
          current: currentStatus,
          target: [TicketStatus.returnedUnrepaired],
          past: [],
        ),
      });
    } else {
      if (currentStatus == TicketStatus.awaitingParts ||
          quote?.items.any((item) => item.isComponent) == true) {
        nodes.add({
          'label': 'Chờ linh kiện',
          'state': _getTimelineState(
            current: currentStatus,
            target: [TicketStatus.awaitingParts],
            past: [
              TicketStatus.repairing,
              TicketStatus.completed,
              TicketStatus.delivered,
            ],
          ),
        });
      }

      nodes.add({
        'label': 'Đang sửa chữa',
        'state': _getTimelineState(
          current: currentStatus,
          target: [TicketStatus.repairing],
          past: [TicketStatus.completed, TicketStatus.delivered],
        ),
      });

      // 4. Bàn giao
      nodes.add({
        'label': 'Sẵn sàng bàn giao',
        'state': _getTimelineState(
          current: currentStatus,
          target: [TicketStatus.completed],
          past: [TicketStatus.delivered],
        ),
      });

      // 5. Đã bàn giao
      nodes.add({
        'label': 'Đã bàn giao',
        'state': _getTimelineState(
          current: currentStatus,
          target: [TicketStatus.delivered],
          past: [],
        ),
      });
    }

    final widgets = <Widget>[];
    for (int i = 0; i < nodes.length; i++) {
      final node = nodes[i];
      final isLast = i == nodes.length - 1;
      final state = node['state'] as _NodeState;

      widgets.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Column(
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: state == _NodeState.completed
                          ? AppColors.success
                          : (state == _NodeState.current
                                ? AppColors.primaryBlue
                                : AppColors.cardGrey),
                      border: Border.all(
                        color: state == _NodeState.current
                            ? AppColors.primaryBlue
                            : Colors.transparent,
                        width: 4,
                      ),
                    ),
                    child: state == _NodeState.completed
                        ? const Icon(Icons.check, size: 14, color: Colors.white)
                        : null,
                  ),
                  if (!isLast)
                    Expanded(
                      child: Container(
                        width: 2,
                        color: state == _NodeState.completed
                            ? AppColors.success
                            : AppColors.cardGrey,
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        node['label'] as String,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: state == _NodeState.current
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color: state == _NodeState.upcoming
                              ? AppColors.textHint
                              : AppColors.textPrimary,
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
    return widgets;
  }

  _NodeState _getTimelineState({
    required TicketStatus current,
    required List<TicketStatus> target,
    required List<TicketStatus> past,
  }) {
    if (past.contains(current)) return _NodeState.completed;
    if (target.contains(current)) return _NodeState.current;
    return _NodeState.upcoming;
  }
}

enum _NodeState { completed, current, upcoming }
