import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../data/mock_data.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_bar_widget.dart';

import 'package:provider/provider.dart';
import '../../viewmodels/auth_viewmodel.dart';

class QuotationDetailScreen extends StatefulWidget {
  const QuotationDetailScreen({super.key, required this.requestId});

  final String requestId;

  @override
  State<QuotationDetailScreen> createState() => _QuotationDetailScreenState();
}

class _QuotationDetailScreenState extends State<QuotationDetailScreen> {
  MockRequest? _request;
  MockQuotation? _quote;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  void _loadData() {
    _request = mockRequests.where((r) => r.id == widget.requestId).firstOrNull;
    if (_request != null) {
      _quote = mockQuotations
          .where((q) => q.ticketId == _request!.ticketId)
          .firstOrNull;
    }
  }

  void _handleAccept() => _decide(CustomerQuoteStatus.accepted);

  Future<void> _decide(CustomerQuoteStatus decision, {String? reason}) async {
    if (!context.read<AuthViewModel>().isMock) return;
    setState(() => _isProcessing = true);
    await Future.delayed(const Duration(seconds: 1));
    if (!mounted) return;

    try {
      final nextStatus = decideMockQuotation(
        widget.requestId,
        decision,
        reason: reason,
      );
      setState(() => _isProcessing = false);
      final message = decision == CustomerQuoteStatus.declined
          ? 'Đã từ chối báo giá. Phiếu đang chờ trả máy.'
          : nextStatus == TicketStatus.awaitingParts
          ? 'Đã đồng ý báo giá. Phiếu đang chờ linh kiện.'
          : 'Đã đồng ý báo giá. Phiếu chuyển sang đang sửa chữa.';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
      context.pop();
    } on StateError catch (error) {
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message.toString())));
    }
  }

  void _showRejectDialog() {
    final reasonCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Từ chối sửa chữa'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Nếu từ chối báo giá, trung tâm sẽ ngừng sửa chữa và gửi trả lại thiết bị nguyên trạng. Vui lòng cho biết lý do:',
              style: TextStyle(fontSize: 14),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: reasonCtrl,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'Nhập lý do từ chối...',
              ),
              maxLines: 3,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'HỦY',
              style: TextStyle(color: AppColors.textHint),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              if (reasonCtrl.text.trim().isEmpty) {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  const SnackBar(content: Text('Vui lòng nhập lý do từ chối.')),
                );
                return;
              }
              Navigator.pop(ctx);
              _decide(
                CustomerQuoteStatus.declined,
                reason: reasonCtrl.text.trim(),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            child: const Text('XÁC NHẬN TỪ CHỐI'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!context.watch<AuthViewModel>().isMock) {
      return const Scaffold(
        body: Center(child: Text('Báo giá Real chưa được tích hợp API.')),
      );
    }
    if (_request == null || _quote == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Lỗi')),
        body: const Center(
          child: Text('Báo giá không tồn tại hoặc đã bị xóa.'),
        ),
      );
    }

    final isPendingCustomer =
        _quote!.internalStatus == InternalQuoteStatus.approved &&
        _quote!.customerStatus == CustomerQuoteStatus.pending;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            const WarrantSafeAppBar(),
            WarrantSafeTitleRow(
              title: 'Báo giá sửa chữa',
              onBackTap: () => context.pop(),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Status Badge
                    if (!isPendingCustomer) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color:
                              _quote!.customerStatus ==
                                  CustomerQuoteStatus.accepted
                              ? AppColors.success.withValues(alpha: 0.1)
                              : AppColors.error.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(
                            AppRadius.control,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _quote!.customerStatus ==
                                      CustomerQuoteStatus.accepted
                                  ? Icons.check_circle_rounded
                                  : Icons.cancel_rounded,
                              color:
                                  _quote!.customerStatus ==
                                      CustomerQuoteStatus.accepted
                                  ? AppColors.success
                                  : AppColors.error,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _quote!.customerStatus ==
                                        CustomerQuoteStatus.accepted
                                    ? 'Bạn đã ĐỒNG Ý sửa chữa theo báo giá này.'
                                    : 'Bạn đã TỪ CHỐI sửa chữa. Lý do: ${_quote!.customerRejectionReason}',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color:
                                      _quote!.customerStatus ==
                                          CustomerQuoteStatus.accepted
                                      ? AppColors.success
                                      : AppColors.error,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],

                    // Quote Information
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
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Phiếu: ${_quote!.ticketId}',
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _request!.deviceName,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const Divider(height: 32),
                          const Text(
                            'CHI TIẾT HẠNG MỤC',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textHint,
                              letterSpacing: 1.2,
                            ),
                          ),
                          const SizedBox(height: 16),
                          ..._quote!.items.map(
                            (item) => Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: AppColors.cardGrey,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(
                                      item.isComponent
                                          ? Icons.memory_rounded
                                          : Icons.handyman_rounded,
                                      size: 16,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item.name,
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '${item.quantity} x ${_formatVND(item.unitPrice)}',
                                          style: const TextStyle(
                                            fontSize: 13,
                                            color: AppColors.textSecondary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    _formatVND(item.total),
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const Divider(height: 32),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'TỔNG CỘNG',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              Text(
                                _formatVND(_quote!.totalAmount),
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.primaryBlue,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            if (isPendingCustomer)
              Container(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                decoration: BoxDecoration(
                  color: AppColors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, -2),
                    ),
                  ],
                ),
                child: _isProcessing
                    ? const Center(child: CircularProgressIndicator())
                    : Row(
                        children: [
                          Expanded(
                            flex: 1,
                            child: OutlinedButton(
                              onPressed: _showRejectDialog,
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.error,
                                side: const BorderSide(color: AppColors.error),
                                minimumSize: const Size(double.infinity, 52),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                    AppRadius.control,
                                  ),
                                ),
                              ),
                              child: const Text(
                                'TỪ CHỐI',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            flex: 2,
                            child: ElevatedButton(
                              onPressed: _handleAccept,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primaryBlue,
                                foregroundColor: AppColors.white,
                                minimumSize: const Size(double.infinity, 52),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                    AppRadius.control,
                                  ),
                                ),
                              ),
                              child: const Text(
                                'ĐỒNG Ý SỬA CHỮA',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                            ),
                          ),
                        ],
                      ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatVND(double amount) {
    final str = amount.toInt().toString();
    final buffer = StringBuffer();
    for (int i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) buffer.write('.');
      buffer.write(str[i]);
    }
    return '$buffer VNĐ';
  }
}
