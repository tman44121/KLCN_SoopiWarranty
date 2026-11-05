/// Account-scoped in-app notifications returned by GET /notifications.
class PortalNotification {
  const PortalNotification({
    required this.id,
    required this.type,
    required this.message,
    required this.read,
    this.link,
    this.entityId,
    this.createdAt,
  });

  final String id;
  final String type;
  final String message;
  final String? link;
  final String? entityId;
  final DateTime? createdAt;
  final bool read;

  factory PortalNotification.fromJson(Map<String, dynamic> json) =>
      PortalNotification(
        id: json['id'] as String,
        type: json['type'] as String,
        message: json['message'] as String,
        link: json['link'] as String?,
        entityId: json['entityId'] as String?,
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
        read: json['read'] as bool,
      );

  /// The backend's customer link is generic (/portal); entityId carries
  /// the ticket or request code for these specific customer event types.
  String? get customerPath {
    final code = entityId;
    if (code == null || !RegExp(r'^[A-Z]{2}-[A-Z0-9-]+$').hasMatch(code)) {
      return null;
    }
    if (type == 'WARRANTY_REQUEST_CANCELLED' && code.startsWith('YC-')) {
      return '/requests/${Uri.encodeComponent(code)}';
    }
    // Mọi bước tiến độ phiếu (TICKET_RECEIVED, _INSPECTING, _DIAGNOSED,
    // _AWAITING_PARTS, _REPAIRING, _COMPLETED, _CUSTOMER_NOTE…) mở chi tiết phiếu.
    if ((type == 'QUOTATION_AWAITING_CUSTOMER' || type.startsWith('TICKET_')) &&
        code.startsWith('TN-')) {
      return '/requests/tickets/${Uri.encodeComponent(code)}';
    }
    return null;
  }
}

class PortalNotificationInbox {
  const PortalNotificationInbox(this.items, this.unreadCount);
  final List<PortalNotification> items;
  final int unreadCount;

  factory PortalNotificationInbox.fromJson(Map<String, dynamic> json) =>
      PortalNotificationInbox(
        (json['items'] as List<dynamic>)
            .map(
              (item) =>
                  PortalNotification.fromJson(item as Map<String, dynamic>),
            )
            .toList(),
        json['unreadCount'] as int,
      );
}
