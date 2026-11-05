import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../models/portal_ticket_models.dart';
import '../../router/app_router.dart';
import '../../services/i_api_service.dart';
import '../../theme/app_theme.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../viewmodels/request_viewmodel.dart';
import '../../viewmodels/ticket_viewmodel.dart';
import '../../widgets/app_bar_widget.dart';
import '../../widgets/soopi_ui.dart';

class RealTicketDetailScreen extends StatefulWidget {
  const RealTicketDetailScreen({super.key, required this.code});
  final String code;

  @override
  State<RealTicketDetailScreen> createState() => _RealTicketDetailScreenState();
}

class _RealTicketDetailScreenState extends State<RealTicketDetailScreen> {
  PortalTicketDetail? _ticket;
  String? _error;
  bool _loading = true;
  bool _deciding = false;
  bool _decisionUncertain = false;
  String? _decisionMessage;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final ticket = await context.read<AuthViewModel>().getPortalTicket(
        widget.code,
      );
      if (!mounted) return;
      setState(() {
        _ticket = ticket;
        _loading = false;
        _decisionUncertain = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException && error.statusCode == 404
            ? 'Không tìm thấy phiếu tiếp nhận trong tài khoản này.'
            : 'Không tải được chi tiết phiếu tiếp nhận. Vui lòng thử lại.';
        _loading = false;
      });
    }
  }

  void _back() =>
      context.canPop() ? context.pop() : context.go(AppRoutes.requests);

  Future<void> _decide(String decision) async {
    if (_deciding || _decisionUncertain || _ticket?.pendingQuotation == null) {
      return;
    }
    final quote = _ticket!.pendingQuotation!;
    var reasonText = '';
    try {
      final reason = await showDialog<String>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (dialogContext, update) => AlertDialog(
            title: Text(
              decision == 'ACCEPT' ? 'Đồng ý báo giá?' : 'Từ chối báo giá?',
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Mã ${quote.code} · Tổng ${_money(quote.grandTotal)}'),
                const SizedBox(height: 8),
                const Text(
                  'Quyết định sẽ được ghi nhận trên hệ thống. Trạng thái tiếp theo do máy chủ trả về.',
                ),
                if (decision == 'DECLINE') ...[
                  const SizedBox(height: 12),
                  TextField(
                    maxLength: 500,
                    onChanged: (value) => update(() => reasonText = value),
                    decoration: const InputDecoration(
                      labelText: 'Lý do từ chối *',
                    ),
                  ),
                ],
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('Hủy'),
              ),
              FilledButton(
                onPressed: decision == 'DECLINE' && reasonText.trim().isEmpty
                    ? null
                    : () => Navigator.of(dialogContext).pop(reasonText.trim()),
                child: const Text('Xác nhận'),
              ),
            ],
          ),
        ),
      );
      if (!mounted || reason == null) return;
      setState(() {
        _deciding = true;
        _decisionMessage = null;
      });
      try {
        final updated = await context
            .read<AuthViewModel>()
            .decidePortalQuotation(
              widget.code,
              decision,
              reason: decision == 'DECLINE' ? reason : null,
            );
        if (!mounted) return;
        setState(() {
          _ticket = updated;
          _decisionMessage =
              'Máy chủ đã ghi nhận quyết định. Trạng thái phiếu: ${portalTicketStatusLabel(updated.status)}.';
        });
        // Refresh the list state from GETs; never infer a status from the tap.
        Provider.of<TicketViewModel?>(context, listen: false)?.refresh();
        Provider.of<RequestViewModel?>(context, listen: false)?.refresh();
      } on ApiException catch (error) {
        if (!mounted) return;
        setState(() {
          _decisionUncertain =
              error.statusCode == null || error.statusCode == 409;
          _decisionMessage = error.statusCode == 409
              ? 'Báo giá đã có quyết định hoặc không còn chờ xác nhận. Tải lại phiếu trước khi thao tác tiếp.'
              : error.statusCode == null
              ? 'Chưa rõ máy chủ đã ghi nhận hay chưa. Tải lại phiếu để kiểm tra trước khi thao tác tiếp.'
              : 'Chưa ghi nhận quyết định (${error.statusCode}): ${error.message}';
        });
      }
    } finally {
      if (mounted) setState(() => _deciding = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.background,
    body: SafeArea(
      child: Column(
        children: [
          const WarrantSafeAppBar(),
          WarrantSafeTitleRow(title: 'Phiếu tiếp nhận', onBackTap: _back),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: SoopiAlert(
                        tone: StatusTone.danger,
                        message: Text(_error!),
                        action: SoopiSecondaryButton(
                          compact: true,
                          label: 'Thử lại',
                          onPressed: _load,
                        ),
                      ),
                    ),
                  )
                : _details(_ticket!),
          ),
        ],
      ),
    ),
  );

  Widget _details(PortalTicketDetail ticket) => RefreshIndicator(
    onRefresh: _load,
    child: ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
      children: [
        // ── Đầu phiếu (ticket-hero-card) ────────────────────────────
        SoopiPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _deviceTitle(ticket),
                style: AppText.pageTitle.copyWith(fontSize: 22),
              ),
              const SizedBox(height: 10),
              Text.rich(
                TextSpan(
                  children: [
                    const TextSpan(text: 'Mã phiếu: '),
                    TextSpan(text: ticket.code, style: AppText.mono),
                  ],
                ),
                style: AppText.cardDesc,
              ),
              if (ticket.serialOrImei?.isNotEmpty == true)
                Text.rich(
                  TextSpan(
                    children: [
                      const TextSpan(text: 'Serial/IMEI: '),
                      TextSpan(text: ticket.serialOrImei, style: AppText.mono),
                    ],
                  ),
                  style: AppText.cardDesc,
                ),
              const SizedBox(height: 12),
              StatusBadge(
                label:
                    'Trạng thái phiếu: ${portalTicketStatusLabel(ticket.status)}',
                tone: ticketStatusTone(ticket.status),
              ),
              if (ticket.stopped) ...[
                const SizedBox(height: 8),
                Text(
                  'Phiếu đã dừng theo trạng thái trên hệ thống.',
                  style: AppText.cardDesc,
                ),
              ],
            ],
          ),
        ),
        if (_decisionMessage != null) ...[
          const SizedBox(height: 12),
          SoopiAlert(
            tone: _decisionUncertain ? StatusTone.warning : StatusTone.success,
            message: Text(_decisionMessage!),
            action: _decisionUncertain
                ? SoopiSecondaryButton(
                    compact: true,
                    label: 'Tải lại phiếu',
                    onPressed: _load,
                  )
                : null,
          ),
        ],

        // ── Báo giá chờ khách quyết định (quote-card) ───────────────
        if (ticket.pendingQuotation case final quote?) ...[
          const SizedBox(height: 16),
          SoopiPanel(
            borderColor: AppColors.honeyBorder,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                PanelHeading(
                  title: 'Báo giá chờ khách quyết định',
                  description: quote.validUntil != null
                      ? 'Hiệu lực đến: ${_date(quote.validUntil!)}'
                      : null,
                  trailing: const StatusBadge(
                    label: 'Chờ bạn xác nhận',
                    tone: StatusTone.warning,
                  ),
                ),
                Text('Mã báo giá: ${quote.code}', style: AppText.mono),
                for (final line in quote.lines)
                  Container(
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.milkCream,
                      borderRadius: BorderRadius.circular(AppRadius.control),
                      border: Border.all(color: AppColors.sageDivider),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${line.lineNo}. ${line.description ?? 'Hạng mục'} · SL ${line.quantity}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: AppColors.penguinNavy,
                          ),
                        ),
                        if (line.unitPrice != null)
                          Text(
                            'Đơn giá: ${_money(line.unitPrice!)}',
                            style: AppText.meta,
                          ),
                        if (line.laborFee != null)
                          Text(
                            'Công: ${_money(line.laborFee!)}',
                            style: AppText.meta,
                          ),
                        if (line.lineTotal != null)
                          Text(
                            'Thành tiền: ${_money(line.lineTotal!)}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: AppColors.penguinNavy,
                            ),
                          ),
                      ],
                    ),
                  ),
                const SizedBox(height: 12),
                _amountLine('Linh kiện: ${_money(quote.partsTotal)}'),
                _amountLine('Tiền công: ${_money(quote.laborTotal)}'),
                _amountLine(
                  'VAT (${quote.vatRate}%): ${_money(quote.grandTotal - quote.partsTotal - quote.laborTotal)}',
                ),
                _amountLine(
                  'Tổng báo giá: ${_money(quote.grandTotal)}',
                  total: true,
                ),
                const SizedBox(height: 10),
                Text(
                  'Báo giá đã duyệt nội bộ và đang chờ quyết định của khách hàng.',
                  style: AppText.cardDesc,
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _deciding || _decisionUncertain
                            ? null
                            : () => _decide('DECLINE'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.expiredWine,
                          side: const BorderSide(color: AppColors.peach),
                        ),
                        child: const Text('Từ chối'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _deciding || _decisionUncertain
                            ? null
                            : () => _decide('ACCEPT'),
                        child: _deciding
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text('Đồng ý'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],

        // ── Tiến độ xử lý (timeline-stepper) ────────────────────────
        const SizedBox(height: 16),
        SoopiPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const PanelHeading(
                title: 'Tiến độ xử lý',
                description:
                    'Tiến độ tổng hợp do hệ thống trả về, không phải nhật ký từng công đoạn.',
              ),
              if (ticket.stopped)
                const SoopiAlert(
                  tone: StatusTone.neutral,
                  message: Text(
                    'Phiếu đã dừng xử lý; hiện không có bước sửa chữa đang thực hiện.',
                  ),
                )
              else
                for (var i = 0; i < ticket.steps.length; i++)
                  _timelineStep(
                    ticket.steps[i],
                    index: i,
                    last: i == ticket.steps.length - 1,
                  ),
            ],
          ),
        ),

        // ── Ghi chú từ trung tâm ────────────────────────────────────
        if (ticket.customerNotes.isNotEmpty) ...[
          const SizedBox(height: 16),
          SoopiPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const PanelHeading(title: 'Ghi chú cho khách'),
                for (final note in ticket.customerNotes)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.milkCream,
                      borderRadius: BorderRadius.circular(AppRadius.control),
                    ),
                    child: Text(
                      '${_dateTime(note.at)} · ${note.text}',
                      style: AppText.body,
                    ),
                  ),
              ],
            ),
          ),
        ],

        // ── Thông tin phiếu ─────────────────────────────────────────
        const SizedBox(height: 16),
        SoopiPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const PanelHeading(title: 'Thông tin phiếu'),
              KvRow(
                label: 'Ngày tiếp nhận',
                value: _dateTime(ticket.receivedAt),
              ),
              KvRow(
                label: 'Hẹn trả máy',
                value: ticket.promisedReturnAt == null
                    ? 'Chưa hẹn'
                    : _dateTime(ticket.promisedReturnAt!),
                valueColor: AppColors.forest,
              ),
              if (ticket.handedOverAt != null)
                KvRow(
                  label: 'Bàn giao lúc',
                  value: _dateTime(ticket.handedOverAt!),
                ),
              if (ticket.productName?.isNotEmpty == true)
                KvRow(label: 'Thiết bị', value: ticket.productName!),
              if (ticket.brandName?.isNotEmpty == true)
                KvRow(label: 'Hãng', value: ticket.brandName!),
            ],
          ),
        ),

        // ── Chi phí theo hệ thống ───────────────────────────────────
        const SizedBox(height: 16),
        SoopiPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const PanelHeading(title: 'Chi phí theo hệ thống'),
              KvRow(
                label: 'Giá trị bảo hành miễn phí',
                value: _money(ticket.costs.inWarrantyAmount),
              ),
              KvRow(
                label: 'Linh kiện tính phí',
                value: _money(ticket.costs.outOfWarrantyParts),
              ),
              KvRow(
                label: 'Phí dịch vụ',
                value: _money(ticket.costs.serviceFee),
              ),
              KvRow(label: 'VAT', value: _money(ticket.costs.vat)),
              KvRow(
                label: 'Thanh toán',
                value: _paymentStatus(ticket.costs.paymentStatus),
              ),
              KvRow(
                label: 'Tổng đã ghi nhận',
                value: _money(ticket.costs.total),
                total: true,
              ),
            ],
          ),
        ),
      ],
    ),
  );

  /// Một bước trên timeline: chấm tròn (xong = xanh rừng có dấu tích, hiện tại =
  /// mật ong, chưa tới = viền lá) nối với nhau bằng vạch dọc.
  Widget _timelineStep(
    PortalStep step, {
    required int index,
    required bool last,
  }) {
    final done = step.state == 'DONE';
    final current = step.state == 'CURRENT';
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 28,
            child: Column(
              children: [
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: done
                        ? AppColors.forest
                        : current
                        ? AppColors.honeyTint
                        : AppColors.paperWhite,
                    border: Border.all(
                      color: done
                          ? AppColors.forest
                          : current
                          ? AppColors.honey
                          : AppColors.sageBorder,
                      width: current ? 2 : 1,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: done
                      ? const Icon(
                          Icons.check_rounded,
                          size: 15,
                          color: AppColors.paperWhite,
                        )
                      : Text(
                          '${index + 1}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: current
                                ? AppColors.honeyText
                                : AppColors.sageMuted,
                          ),
                        ),
                ),
                if (!last)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 2),
                      color: done ? AppColors.forest : AppColors.sageDivider,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(top: 3, bottom: last ? 0 : 16),
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: '${_stepState(step.state)} · ',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: current
                            ? AppColors.honeyText
                            : AppColors.sageMuted,
                      ),
                    ),
                    TextSpan(
                      text: step.label,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: current ? FontWeight.w800 : FontWeight.w600,
                        color: AppColors.penguinNavy,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _amountLine(String text, {bool total = false}) => Container(
    padding: const EdgeInsets.symmetric(vertical: 7),
    decoration: BoxDecoration(
      border: total
          ? const Border(top: BorderSide(color: AppColors.sageBorder))
          : const Border(bottom: BorderSide(color: AppColors.sageDivider)),
    ),
    child: Text(
      text,
      textAlign: TextAlign.right,
      style: TextStyle(
        fontSize: total ? 16 : 13,
        fontWeight: total ? FontWeight.w800 : FontWeight.w500,
        color: total ? AppColors.forest : AppColors.navyBody,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    ),
  );

  String _deviceTitle(PortalTicketDetail ticket) {
    final name = [
      ticket.brandName,
      ticket.productName,
    ].whereType<String>().where((v) => v.trim().isNotEmpty).join(' ');
    return name.isEmpty ? 'Thiết bị' : name;
  }

  String _stepState(String state) => switch (state) {
    'DONE' => 'Hoàn tất',
    'CURRENT' => 'Hiện tại',
    'UPCOMING' => 'Chưa tới',
    _ => state,
  };

  String _paymentStatus(String status) => switch (status) {
    'UNPAID' => 'Chưa ghi nhận thanh toán',
    'PAID' => 'Đã thanh toán',
    'FREE_WARRANTY' => 'Bảo hành miễn phí',
    _ => status,
  };

  String _money(num value) => '${value.toString()} VNĐ';
  String _date(DateTime value) =>
      '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';
  String _dateTime(DateTime value) {
    final local = value.toLocal();
    return '${_date(local)} ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }
}
