import '../models/user_model.dart';
import '../models/portal_request_models.dart';
import '../models/portal_ticket_models.dart';
import '../models/portal_lookup_models.dart';
import '../models/portal_notification_models.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Custom exception (shared between Mock and Real implementations)
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

  /// HTTP status code when available (null for network / mock errors).
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
/// Concrete implementations:
///   • [MockApiService]  — demo data without HTTP
///   • [RealApiService]  — Dio-backed Soopi API client
abstract class IApiService {
  /// Authenticates the user and returns a [AuthResponse] containing the JWT.
  /// Throws [ApiException] on invalid credentials.
  Future<AuthResponse> login(String username, String password);

  /// Creates a new account.
  /// Throws [ApiException] if [email] is already registered.
  Future<AuthResponse> register({
    required String fullName,
    required String phone,
    required String email,
    required String password,
  });

  /// Real customer registration uses an email OTP; Mock registration remains
  /// the existing local demonstration flow.
  Future<EmailOtpIssued> requestRegistrationOtp(String email, String phone) =>
      throw UnsupportedError('Email OTP is not available in Mock mode.');

  Future<AuthResponse> registerWithEmailOtp({
    required String fullName,
    required String phone,
    required String email,
    required String otp,
    required String password,
  }) => throw UnsupportedError('Email OTP is not available in Mock mode.');

  Future<EmailOtpIssued> requestPasswordResetOtp(String email) =>
      throw UnsupportedError('Password reset is not available in Mock mode.');

  Future<void> verifyPasswordResetOtp(String email, String otp) =>
      throw UnsupportedError('Password reset is not available in Mock mode.');

  Future<void> resetPasswordWithEmailOtp({
    required String email,
    required String otp,
    required String newPassword,
  }) => throw UnsupportedError('Password reset is not available in Mock mode.');

  /// Fetches the profile.
  /// Throws [ApiException] if not found.
  Future<UserModel> getProfile();

  /// The customer may edit name, email, and address; phone is read-only.
  Future<UserModel> updateMyProfile({
    required String fullName,
    required String email,
    required String address,
  }) =>
      throw UnsupportedError('Profile editing is not available in Mock mode.');

  Future<AuthResponse> changePassword(
    String currentPassword,
    String newPassword,
  ) => throw UnsupportedError('Password change is not available in Mock mode.');

  /// Refreshes the session.
  Future<AuthResponse> refresh(String refreshToken);

  /// Logs out.
  Future<void> logout(String? refreshToken);

  /// Fetches owned devices.
  Future<List<OwnedDevice>> getMyDevices();

  /// Customer portal requests. Mock screens retain their own demo data source.
  Future<PortalCatalog> getPortalCatalog() =>
      throw UnsupportedError('Portal catalog is not available in Mock mode.');
  Future<List<PortalRequestSummary>> getMyWarrantyRequests() =>
      throw UnsupportedError('Portal requests are not available in Mock mode.');
  Future<PortalRequestDetail> getMyWarrantyRequest(String code) =>
      throw UnsupportedError(
        'Portal request detail is not available in Mock mode.',
      );
  Future<String> submitMyWarrantyRequest(OwnWarrantyRequestData data) =>
      throw UnsupportedError(
        'Portal request submission is not available in Mock mode.',
      );
  Future<List<PortalTicketSummary>> getMyTickets() =>
      throw UnsupportedError('Portal tickets are not available in Mock mode.');
  Future<PortalTicketDetail> getPortalTicket(String code) =>
      throw UnsupportedError(
        'Portal ticket detail is not available in Mock mode.',
      );
  Future<PortalLookupRecord> lookupPortal(String code, String phone) =>
      throw UnsupportedError('Portal lookup is not available in Mock mode.');
  Future<PortalWarrantyCheck> checkWarranty(String serial) =>
      throw UnsupportedError(
        'Public warranty lookup is not available in Mock mode.',
      );
  Future<PortalTicketDetail> decidePortalQuotation(
    String ticketCode,
    String decision, {
    String? reason,
  }) => throw UnsupportedError(
    'Portal quotation decision is not available in Mock mode.',
  );

  Future<PortalNotificationInbox> getNotifications() =>
      throw UnsupportedError('Notifications are not available in Mock mode.');
  Future<void> markNotificationRead(String id) =>
      throw UnsupportedError('Notifications are not available in Mock mode.');

  /// Attaches a Bearer token to all subsequent requests.
  void setAuthToken(String token);

  /// Removes the Bearer token (called on logout).
  void clearAuthToken();
}
