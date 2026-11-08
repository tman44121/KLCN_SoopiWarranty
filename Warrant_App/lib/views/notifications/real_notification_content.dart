import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/portal_notification_models.dart';
import '../../services/i_api_service.dart';
import '../../theme/app_theme.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../widgets/soopi_ui.dart';

/// In-app inbox: the server owns the recipient, unread state and event code.
/// This is refreshed on demand and periodically; it is not system push.
class RealNotificationContent extends StatefulWidget {
  const RealNotificationContent({super.key});

  @override
  State<RealNotificationContent> createState() =>
      _RealNotificationContentState();
}

class _RealNotificationContentState extends State<RealNotificationContent>
    with WidgetsBindingObserver {
  PortalNotificationInbox? _inbox;
  String? _error;
  bool _loading = false;
  String? _openingId;
  Timer? _poll;
  bool _visible = false;
  AppLifecycleState? _lifecycle;

  bool get _canPoll =>
      _visible &&
      (_lifecycle == null || _lifecycle == AppLifecycleState.resumed);

  @override
  void initState() {
    super.initState();
    _lifecycle = WidgetsBinding.instance.lifecycleState;
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final wasActive = _canPoll;
    _visible = TickerMode.valuesOf(context).enabled;
    _syncPolling(wasActive);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final wasActive = _canPoll;
    _lifecycle = state;
    _syncPolling(wasActive);
  }

  void _syncPolling(bool wasActive) {
    if (!_canPoll) {
      _poll?.cancel();
      _poll = null;
      return;
    }
    _poll ??= Timer.periodic(const Duration(seconds: 30), (_) => _load());
    if (!wasActive) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _canPoll) _load();
      });
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _load() async {
    if (!mounted || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final inbox = await context.read<AuthViewModel>().getNotifications();
      if (mounted) setState(() => _inbox = inbox);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Không tải được thông báo. Vui lòng thử lại.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open(PortalNotification item) async {
    if (_openingId != null) return;
    setState(() => _openingId = item.id);
    try {
      if (!item.read) {
        await context.read<AuthViewModel>().markNotificationRead(item.id);
        // The inbox refresh must not keep the notification tap waiting to
        // open a ticket. The server remains the source of the unread count.
        unawaited(_load());
      }
      if (!mounted) return;
      final path = item.customerPath;
      if (path == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Thông báo này không có trang chi tiết trong App.'),
          ),
        );
      } else {
        // push() completes only when the detail route is popped. Waiting for
        // it kept this row's spinner alive while the customer viewed or
        // decided a quotation, sometimes until logout reset the shell.
        context.go(path);
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Không đánh dấu đã đọc (${error.statusCode ?? 'mạng'}): ${error.message}',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _openingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final inbox = _inbox;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 8, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  inbox == null
                      ? 'Thông báo trong ứng dụng'
                      : '${inbox.unreadCount} chưa đọc · Thông báo trong ứng dụng',
                  style: AppText.cardDesc,
                ),
              ),
              IconButton(
                tooltip: 'Tải thông báo mới',
                onPressed: _loading ? null : _load,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
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
        Expanded(
          child: _loading && inbox == null
              ? const Center(child: CircularProgressIndicator())
              : inbox == null
              ? const Center(child: Text('Chưa tải được thông báo.'))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    itemCount: inbox.items.isEmpty ? 1 : inbox.items.length,
                    itemBuilder: (context, index) {
                      if (inbox.items.isEmpty) {
                        return const Padding(
                          padding: EdgeInsets.only(top: 40),
                          child: SoopiEmpty(
                            icon: Icons.notifications_none_rounded,
                            title: 'Chưa có thông báo',
                            text: 'Chưa có thông báo trong tài khoản này.',
                          ),
                        );
                      }
                      final item = inbox.items[index];
                      final quote = item.type == 'QUOTATION_AWAITING_CUSTOMER';
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: SoopiPanel(
                          elevated: false,
                          padding: EdgeInsets.zero,
                          color: item.read
                              ? AppColors.white
                              : AppColors.mintWash,
                          borderColor: item.read
                              ? AppColors.border
                              : AppColors.mintBorder,
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 4,
                            ),
                            leading: Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: quote
                                    ? AppColors.honeyTint
                                    : AppColors.mintSoft,
                                borderRadius: BorderRadius.circular(
                                  AppRadius.control,
                                ),
                              ),
                              child: Icon(
                                quote
                                    ? Icons.request_quote_rounded
                                    : Icons.notifications_outlined,
                                size: 20,
                                color: quote
                                    ? AppColors.honeyText
                                    : AppColors.forest,
                              ),
                            ),
                            title: Text(
                              item.message,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: item.read
                                    ? FontWeight.w500
                                    : FontWeight.w700,
                                color: AppColors.penguinNavy,
                              ),
                            ),
                            subtitle: item.createdAt == null
                                ? null
                                : Text(
                                    soopiDateTime(item.createdAt!),
                                    style: AppText.meta,
                                  ),
                            trailing: _openingId == item.id
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : item.customerPath == null
                                ? null
                                : const Icon(
                                    Icons.chevron_right,
                                    color: AppColors.sageFaint,
                                  ),
                            onTap: () => _open(item),
                          ),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}
