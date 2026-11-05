import 'portal_request_models.dart';
import 'portal_ticket_models.dart';

/// Public warranty summary; contains no owner, ticket codes or repair details.
class PortalWarrantyCheck {
  PortalWarrantyCheck.fromJson(Map<String, dynamic> json)
    : productName = json['productName'] as String?,
      brandName = json['brandName'] as String?,
      serialOrImei = json['serialOrImei'] as String,
      warrantyStatus = json['warrantyStatus'] as String,
      warrantyActivatedOn = DateTime.tryParse(
        json['warrantyActivatedOn'] as String? ?? '',
      ),
      warrantyExpiresOn = DateTime.tryParse(
        json['warrantyExpiresOn'] as String? ?? '',
      ),
      daysRemaining = json['daysRemaining'] as int?,
      warrantyMonths = json['warrantyMonths'] as int,
      repairCount = json['repairCount'] as int,
      lastReceivedOn = DateTime.tryParse(
        json['lastReceivedOn'] as String? ?? '',
      ),
      atServiceCenter = json['atServiceCenter'] as bool;

  final String? productName, brandName;
  final String serialOrImei, warrantyStatus;
  final DateTime? warrantyActivatedOn, warrantyExpiresOn, lastReceivedOn;
  final int? daysRemaining;
  final int warrantyMonths, repairCount;
  final bool atServiceCenter;
}

/// A request or ticket returned after backend authorization.
class PortalLookupRecord {
  const PortalLookupRecord.request(this.request) : ticket = null;
  const PortalLookupRecord.ticket(this.ticket) : request = null;

  final PortalRequestDetail? request;
  final PortalTicketDetail? ticket;
}
