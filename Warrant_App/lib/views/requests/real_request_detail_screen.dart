import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../models/portal_request_models.dart';
import '../../router/app_router.dart';
import '../../services/i_api_service.dart';
import '../../theme/app_theme.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../widgets/app_bar_widget.dart';
import '../../widgets/soopi_ui.dart';

class RealRequestDetailScreen extends StatefulWidget {
  const RealRequestDetailScreen({super.key, required this.code});
  final String code;

  @override
  State<RealRequestDetailScreen> createState() =>
      _RealRequestDetailScreenState();
}

class _RealRequestDetailScreenState extends State<RealRequestDetailScreen> {
  PortalRequestDetail? _request;
  String? _error;
  bool _loading = true;

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
      final request = await context.read<AuthViewModel>().getMyWarrantyRequest(
        widget.code,
      );
      if (mounted) {
        setState(() {
          _request = request;
          _loading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error is ApiException && error.statusCode == 404
              ? 'Không tìm thấy yêu cầu trong tài khoản này.'
              : error is ApiException
              ? error.message
              : 'Không tải được chi tiết yêu cầu.';
          _loading = false;
        });
      }
    }
  }

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.requests);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.background,
    body: SafeArea(
      child: Column(
        children: [
          const WarrantSafeAppBar(),
          WarrantSafeTitleRow(title: 'Chi tiết yêu cầu', onBackTap: _back),
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
                : _details(_request!),
          ),
        ],
      ),
    ),
  );

  Widget _details(PortalRequestDetail request) => RefreshIndicator(
    onRefresh: _load,
    child: ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
      children: [
        // ── Đầu yêu cầu: mã + trạng thái, như ticket-hero-card của web ──
        _card([
          Text(
            request.brandModel?.isNotEmpty == true
                ? request.brandModel!
                : 'Yêu cầu bảo hành',
            style: AppText.pageTitle.copyWith(fontSize: 22),
          ),
          const SizedBox(height: 8),
          Text(request.code, style: AppText.mono.copyWith(fontSize: 14)),
          const SizedBox(height: 12),
          StatusBadge(
            label: portalRequestStatusLabel(request.status),
            tone: requestStatusTone(request.status),
          ),
          if (request.createdAt != null) ...[
            const SizedBox(height: 10),
            Text(
              'Gửi lúc: ${_dateTime(request.createdAt!)}',
              style: AppText.cardDesc,
            ),
          ],
          if (request.status == 'PENDING_INTAKE') ...[
            const SizedBox(height: 12),
            const SoopiAlert(
              message: Text(
                'Yêu cầu đã được ghi nhận trực tuyến. Trung tâm chưa xác nhận đã nhận thiết bị.',
              ),
            ),
          ],
        ]),
        // Phiếu liên kết đặt ngay dưới đầu yêu cầu: đây là việc khách cần làm tiếp.
        if (request.ticketCode?.isNotEmpty == true) ...[
          const SizedBox(height: 16),
          _card([
            const PanelHeading(title: 'Phiếu sửa chữa liên kết'),
            _row('Mã phiếu tiếp nhận', request.ticketCode),
            const SizedBox(height: 4),
            ElevatedButton(
              onPressed: () =>
                  context.push(AppRoutes.realTicket(request.ticketCode!)),
              child: const Text('Xem tiến độ phiếu'),
            ),
          ]),
        ],
        const SizedBox(height: 16),
        _card([
          const PanelHeading(title: 'Thông tin thiết bị'),
          _row('Thiết bị', request.brandModel),
          _row(request.identifierType ?? 'Serial/IMEI', request.serialOrImei),
          _row('Mã nhóm thiết bị', request.categoryCode),
          _row('Mã loại thiết bị', request.deviceTypeCode),
          _row('Mã trạm mong muốn', request.preferredStation),
          _row(
            'Thời gian mong muốn mang máy tới (chưa xác nhận)',
            _preferredArrival(request),
          ),
        ]),
        const SizedBox(height: 16),
        _card([
          const PanelHeading(title: 'Mô tả lỗi'),
          Text(request.symptom ?? 'Không có nội dung', style: AppText.body),
        ]),
        if (request.ticketCode?.isNotEmpty != true &&
            request.status == 'PENDING_INTAKE') ...[
          const SizedBox(height: 16),
          _card([
            Text(
              'Yêu cầu này chưa có phiếu tiếp nhận. Theo dõi mã yêu cầu cho đến khi trung tâm xử lý.',
              style: AppText.cardDesc,
            ),
          ]),
        ],
        if (request.cancelReason?.isNotEmpty == true) ...[
          const SizedBox(height: 16),
          _card([_row('Lý do hủy', request.cancelReason)]),
        ],
      ],
    ),
  );

  Widget _card(List<Widget> children) => SoopiPanel(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    ),
  );

  Widget _row(String label, String? value) => value == null || value.isEmpty
      ? const SizedBox.shrink()
      : Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.sageDivider)),
          ),
          // Một Text.rich giữ nguyên chuỗi "nhãn: giá trị" như trước.
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '$label: ',
                  style: const TextStyle(color: AppColors.sageMuted),
                ),
                TextSpan(
                  text: value,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.penguinNavy,
                  ),
                ),
              ],
            ),
            style: const TextStyle(fontSize: 13.5, height: 1.4),
          ),
        );

  String? _preferredArrival(PortalRequestDetail request) {
    final from = request.preferredFrom;
    if (from == null) return null;
    final to = request.preferredTo;
    return to == null
        ? _dateTime(from)
        : '${_dateTime(from)} – ${_dateTime(to)}';
  }

  String _dateTime(DateTime value) {
    final local = value.toLocal();
    String two(int number) => number.toString().padLeft(2, '0');
    return '${two(local.day)}/${two(local.month)}/${local.year} '
        '${two(local.hour)}:${two(local.minute)}';
  }
}
