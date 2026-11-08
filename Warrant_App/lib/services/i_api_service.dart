import '../models/user_model.dart';
import '../models/portal_request_models.dart';
import '../models/portal_ticket_models.dart';
import '../models/portal_lookup_models.dart';
import '../models/portal_notification_models.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Custom exception
// ─────────────────────────────────────────────────────────────────────────────

/// Typed exception that wraps all API-level errors.
/// The ViewModel catches [ApiException] without leaking Dio internals.
class ApiException implements Exception {
  const ApiException(
    this.message, {
    this.statusCode,
    this.fieldErrors = const {},
    this.code,
  });

  final String message;

  /// HTTP status code when available (null for network errors).
  final int? statusCode;
  final Map<String, String> fieldErrors;
  final String? code;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class NetworkException extends ApiException {
  const NetworkException([
    super.message = 'Lỗi kết nối mạng, vui lòng kiểm tra lại.',
  ]) : super(statusCode: null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Abstract interface — the ViewModel only depends on this
// ─────────────────────────────────────────────────────────────────────────────

/// Defines the contract for all API operations used by [AuthViewModel].
///
/// [RealApiService] is the Dio-backed Soopi API client; tests provide fakes
/// that override only the calls they exercise.
abstract class IApiService {
  /// Authenticates the user and returns a [AuthResponse] containing the JWT.
  /// Throws [ApiException] on invalid credentials.
  Future<AuthResponse> login(String username, String password);

  /// Customer registration is confirmed with an OTP sent by email.
  Future<EmailOtpIssued> requestRegistrationOtp(String email, String phone) =>
      throw UnsupportedError('Email OTP is not supported by this API client.');

  Future<AuthResponse> registerWithEmailOtp({
    required String fullName,
    required String phone,
    required String email,
    required String otp,
    required String password,
  }) =>
      throw UnsupportedError('Email OTP is not supported by this API client.');

  Future<EmailOtpIssued> requestPasswordResetOtp(String email) =>
      throw UnsupportedError(
        'Password reset is not supported by this API client.',
      );

  Future<void> verifyPasswordResetOtp(String email, String otp) =>
      throw UnsupportedError(
        'Password reset is not supported by this API client.',
      );

  Future<void> resetPasswordWithEmailOtp({
    required String email,
    required String otp,
    required String newPassword,
  }) => throw UnsupportedError(
    'Password reset is not supported by this API client.',
  );

  /// Fetches the profile.
  /// Throws [ApiException] if not found.
  Future<UserModel> getProfile();

  /// The customer may edit name, email, and address; phone is read-only.
  Future<UserModel> updateMyProfile({
    required String fullName,
    required String email,
    required String address,
  }) => throw UnsupportedError(
    'Profile editing is not supported by this API client.',
  );

  Future<AuthResponse> changePassword(
    String currentPassword,
    String newPassword,
  ) => throw UnsupportedError(
    'Password change is not supported by this API client.',
  );

  /// Refreshes the session.
  Future<AuthResponse> refresh(String refreshToken);

  /// Logs out.
  Future<void> logout(String? refreshToken);

  /// Fetches owned devices.
  Future<List<OwnedDevice>> getMyDevices();

  /// Customer portal requests and tickets.
  Future<PortalCatalog> getPortalCatalog() => throw UnsupportedError(
    'Portal catalog is not supported by this API client.',
  );
  Future<List<PortalRequestSummary>> getMyWarrantyRequests() =>
      throw UnsupportedError('Portal requests are not supported by this API client.');
  Future<PortalRequestDetail> getMyWarrantyRequest(String code) =>
      throw UnsupportedError(
        'Portal request detail is not supported by this API client.',
      );
  Future<String> submitMyWarrantyRequest(OwnWarrantyRequestData data) =>
      throw UnsupportedError(
        'Portal request submission is not supported by this API client.',
      );
  Future<List<PortalTicketSummary>> getMyTickets() =>
      throw UnsupportedError('Portal tickets are not supported by this API client.');
  Future<PortalTicketDetail> getPortalTicket(String code) =>
      throw UnsupportedError(
        'Portal ticket detail is not supported by this API client.',
      );
  Future<PortalLookupRecord> lookupPortal(String code, String phone) =>
      throw UnsupportedError(
        'Portal lookup is not supported by this API client.',
      );
  Future<PortalWarrantyCheck> checkWarranty(String serial) =>
      throw UnsupportedError(
        'Public warranty lookup is not supported by this API client.',
      );
  Future<PortalTicketDetail> decidePortalQuotation(
    String ticketCode,
    String decision, {
    String? reason,
  }) => throw UnsupportedError(
    'Portal quotation decision is not supported by this API client.',
  );

  Future<PortalNotificationInbox> getNotifications() =>
      throw UnsupportedError('Notifications are not supported by this API client.');
  Future<void> markNotificationRead(String id) =>
      throw UnsupportedError('Notifications are not supported by this API client.');

  /// Attaches a Bearer token to all subsequent requests.
  void setAuthToken(String token);

  /// Removes the Bearer token (called on logout).
  void clearAuthToken();
}
