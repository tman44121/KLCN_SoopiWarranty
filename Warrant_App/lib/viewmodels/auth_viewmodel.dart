import 'dart:async';

import 'package:flutter/foundation.dart';
import '../models/user_model.dart';
import '../models/portal_request_models.dart';
import '../models/portal_ticket_models.dart';
import '../services/i_api_service.dart';
import '../services/api_service.dart';
import '../services/real_api_service.dart';
import '../models/portal_lookup_models.dart';
import '../models/portal_notification_models.dart';
import '../services/token_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthViewModel extends ChangeNotifier {
  AuthViewModel({TokenStorage? tokenStorage, IApiService? apiService})
    : _storage = tokenStorage ?? SecureTokenStorage(),
      _api = apiService ?? MockApiService(),
      _hasInjectedApi = apiService != null {
    _attachRealRefresh();
  }

  final bool _hasInjectedApi;

  Future<void> initialize() async {
    _isInitializing = true;
    notifyListeners();
    try {
      await _loadSettings();
      await tryAutoLogin();
    } catch (e) {
      _setError(e.toString());
    } finally {
      _isInitializing = false;
      notifyListeners();
    }
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    // Release has no test-mode control on the sign-in screen.
    _isMock = kDebugMode && (prefs.getBool('isMock') ?? true);

    // Explicit build config for production, fallback to local for debug
    const String envUrl = String.fromEnvironment('API_URL', defaultValue: '');
    String defaultUrl = envUrl.isNotEmpty
        ? envUrl
        : (kDebugMode ? debugDefaultBaseUrl : '');

    if (!kDebugMode && !_isMock) {
      if (defaultUrl.isEmpty) {
        throw Exception('Release build must specify a valid API_URL.');
      }
      final uri = Uri.tryParse(defaultUrl);
      if (uri == null ||
          uri.scheme != 'https' ||
          uri.host.isEmpty ||
          uri.path != '/api/v1') {
        throw Exception(
          'Release build API_URL must be a valid HTTPS URL with a host and /api/v1 path.',
        );
      }
    }

    if (kDebugMode) {
      _baseUrl = prefs.getString('baseUrl') ?? defaultUrl;
    } else {
      _baseUrl = defaultUrl; // Do not allow editing in release
    }

    if (!_hasInjectedApi) {
      if (_isMock) {
        _api = MockApiService();
      } else {
        _api = RealApiService(baseUrl: _baseUrl);
      }
    }
    _attachRealRefresh();
  }

  late IApiService _api;
  final TokenStorage _storage;

  @visibleForTesting
  void setApiForTesting(IApiService api) {
    _api = api;
    _attachRealRefresh();
  }

  int _sessionGeneration = 0;

  int? _notificationUnreadCount;
  bool _notificationCountLoading = false;
  bool _notificationCountError = false;

  /// Server-reported unread count for the current authenticated Real session.
  int? get notificationUnreadCount => _notificationUnreadCount;
  bool get notificationCountLoading => _notificationCountLoading;
  bool get notificationCountError => _notificationCountError;

  void _clearNotificationState() {
    _notificationUnreadCount = null;
    _notificationCountLoading = false;
    _notificationCountError = false;
  }

  bool _isCurrentSessionScope({
    required int generation,
    required String? userId,
    required IApiService api,
    required bool isMock,
    required String baseUrl,
  }) =>
      generation == _sessionGeneration &&
      userId != null &&
      userId == _currentUser?.id &&
      identical(api, _api) &&
      isMock == _isMock &&
      baseUrl == _baseUrl;

  void _attachRealRefresh() {
    if (_api is RealApiService) {
      (_api as RealApiService).onAccessTokenExpired = _refreshForRead;
    }
  }

  Future<String?> _refreshForRead() async {
    final userId = _currentUser?.id;
    if (_isMock || userId == null) return null;
    final generation = _sessionGeneration;
    final api = _api;
    final session = await _storage.readSession(isMock: false);
    final refreshToken = session['refreshToken'];
    if (refreshToken == null) return null;

    try {
      final response = await api.refresh(refreshToken);
      if (generation != _sessionGeneration ||
          _isMock ||
          _currentUser?.id != userId ||
          !identical(api, _api)) {
        return null;
      }
      if (response.user.id != userId || response.refreshToken == null) {
        throw const ApiException('Máy chủ trả về phiên không hợp lệ.');
      }
      await _storage.saveSession(
        token: response.accessToken,
        refreshToken: response.refreshToken,
        userId: userId,
        isMock: false,
      );
      api.setAuthToken(response.accessToken);
      return response.accessToken;
    } on ApiException catch (error) {
      // This backend returns 401 when the refresh credential is invalid,
      // expired or reused. Network and server errors keep the local session.
      if (error.statusCode == 401 &&
          generation == _sessionGeneration &&
          identical(api, _api)) {
        await _storage.clearSession(isMock: false);
        api.clearAuthToken();
        _sessionGeneration++;
        _currentUser = null;
        _isLoading = false;
        _clearNotificationState();
        notifyListeners();
      }
      rethrow;
    }
  }

  bool _isMock = true;
  bool get isMock => _isMock;

  /// API Soopi khi debug: bản Web gọi /api/v1 cùng origin (web_dev_config.yaml
  /// chuyển tiếp sang localhost:8080, không vướng CORS); Android emulator gọi máy
  /// chủ qua 10.0.2.2:8080.
  static String get debugDefaultBaseUrl =>
      kIsWeb ? '${Uri.base.origin}/api/v1' : 'http://10.0.2.2:8080/api/v1';

  String _baseUrl = debugDefaultBaseUrl;
  String get baseUrl => _baseUrl;

  bool _isInitializing = true;
  bool get isInitializing => _isInitializing;

  bool _hasSessionPendingRetry = false;
  bool get hasSessionPendingRetry => _hasSessionPendingRetry;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  UserModel? _currentUser;
  UserModel? get currentUser => _currentUser;

  bool get isAuthenticated => _currentUser != null;

  Future<void> toggleMockMode(bool value) async {
    if (_isMock == value) return;
    if (_isLoading) return;

    _setLoading(true);
    try {
      // Clear session when switching modes (using original API)
      await logout(keepLoading: true);

      _isMock = value;
      if (!_hasInjectedApi) {
        if (_isMock) {
          _api = MockApiService();
        } else {
          _api = RealApiService(baseUrl: _baseUrl);
        }
      }
      _attachRealRefresh();

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('isMock', _isMock);
    } finally {
      _setLoading(false);
    }
  }

  Future<void> setBaseUrl(String url) async {
    if (!kDebugMode) return; // Allow editable local URLs only in debug mode

    // Basic validation
    final uri = Uri.tryParse(url);
    if (uri == null ||
        !uri.hasScheme ||
        (uri.scheme != 'http' && uri.scheme != 'https') ||
        uri.host.isEmpty ||
        uri.path != '/api/v1') {
      throw Exception(
        'Vui lòng nhập một URL hợp lệ có chứa host và path /api/v1 (ví dụ: http://10.0.2.2:8080/api/v1).',
      );
    }

    final urlChanged = _baseUrl != url;
    _baseUrl = url;
    if (!_isMock && _api is RealApiService) {
      (_api as RealApiService).setBaseUrl(url);
    }

    if (urlChanged) _clearNotificationState();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('baseUrl', _baseUrl);

    notifyListeners();
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void _setError(String? message) {
    _errorMessage = message;
    notifyListeners();
  }

  void _begin() {
    _errorMessage = null;
    _isLoading = true;
    notifyListeners();
  }

  void _end() {
    _isLoading = false;
    notifyListeners();
  }

  Future<bool> loginUser(String email, String password) async {
    _sessionGeneration++;
    _clearNotificationState();
    _begin();
    try {
      final response = await _api.login(email.trim(), password);
      _sessionGeneration++;
      await _storage.saveSession(
        token: response.accessToken,
        refreshToken: response.refreshToken,
        userId: response.user.id,
        isMock: _isMock,
      );
      _api.setAuthToken(response.accessToken);
      _currentUser = response.user;
      final generation = _sessionGeneration;
      unawaited(_primeNotificationCount());
      await refreshProfile(); // Load additional profile details
      if (generation != _sessionGeneration) return false;
      _end();
      return true;
    } on NetworkException catch (_) {
      _setError('Lỗi kết nối mạng, vui lòng kiểm tra lại.');
      _setLoading(false);
      return false;
    } on ApiException catch (e) {
      _setError(e.message);
      _setLoading(false);
      return false;
    } catch (_) {
      _setError('Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.');
      _setLoading(false);
      return false;
    }
  }

  Future<bool> registerUser({
    required String fullName,
    required String phone,
    required String email,
    required String password,
    String? emailOtp,
  }) async {
    _sessionGeneration++;
    _clearNotificationState();
    _lastRegistrationError = null;
    _begin();
    try {
      if (!_isMock && (emailOtp == null || emailOtp.trim().isEmpty)) {
        throw const ApiException('Vui lòng nhập mã OTP gửi qua email.');
      }
      final response = _isMock
          ? await _api.register(
              fullName: fullName.trim(),
              phone: phone.trim(),
              email: email.trim(),
              password: password,
            )
          : await _api.registerWithEmailOtp(
              fullName: fullName.trim(),
              phone: phone.trim(),
              email: email.trim(),
              otp: emailOtp!,
              password: password,
            );
      await _storage.saveSession(
        token: response.accessToken,
        refreshToken: response.refreshToken,
        userId: response.user.id,
        isMock: _isMock,
      );
      _api.setAuthToken(response.accessToken);
      _currentUser = response.user;
      final generation = _sessionGeneration;
      if (!_isMock) await refreshProfile();
      if (generation != _sessionGeneration) return false;
      unawaited(_primeNotificationCount());
      _end();
      return true;
    } on ApiException catch (e) {
      _lastRegistrationError = e;
      _setError(e.message);
      _setLoading(false);
      return false;
    } catch (_) {
      _lastRegistrationError = const ApiException(
        'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.',
      );
      _setError('Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.');
      _setLoading(false);
      return false;
    }
  }

  ApiException? _lastRegistrationError;
  ApiException? get lastRegistrationError => _lastRegistrationError;

  Future<EmailOtpIssued> requestRegistrationOtp(String email, String phone) =>
      _api.requestRegistrationOtp(email, phone);

  Future<EmailOtpIssued> requestPasswordResetOtp(String email) =>
      _api.requestPasswordResetOtp(email);

  Future<void> verifyPasswordResetOtp(String email, String otp) =>
      _api.verifyPasswordResetOtp(email, otp);

  Future<void> resetPasswordWithEmailOtp({
    required String email,
    required String otp,
    required String newPassword,
  }) => _api.resetPasswordWithEmailOtp(
    email: email,
    otp: otp,
    newPassword: newPassword,
  );

  Future<void> refreshProfile() async {
    if (_currentUser == null) return;
    final generation = _sessionGeneration;
    final userId = _currentUser!.id;
    final api = _api;
    final isMock = _isMock;
    final baseUrl = _baseUrl;
    bool isCurrent() => _isCurrentSessionScope(
      generation: generation,
      userId: userId,
      api: api,
      isMock: isMock,
      baseUrl: baseUrl,
    );
    _begin();
    try {
      final profile = await api.getProfile();
      if (!isCurrent()) return;
      _currentUser = _currentUser!.copyWith(
        customerCode: profile.customerCode,
        fullName: profile.fullName,
        phone: profile.phone,
        email: profile.email,
        address: profile.address,
      );
    } on ApiException catch (e) {
      if (isCurrent()) _setError(e.message);
    } catch (_) {
      if (isCurrent()) {
        _setError('Không thể tải dữ liệu hồ sơ. Vui lòng thử lại.');
      }
    } finally {
      if (isCurrent()) _end();
    }
  }

  Future<void> updateMyProfile({
    required String fullName,
    required String email,
    required String address,
  }) async {
    final user = _currentUser;
    if (_isMock || user == null) {
      throw const ApiException('Vui lòng đăng nhập tài khoản Real.');
    }
    final generation = _sessionGeneration;
    final api = _api;
    final baseUrl = _baseUrl;
    final updated = await api.updateMyProfile(
      fullName: fullName,
      email: email,
      address: address,
    );
    if (!_isCurrentSessionScope(
      generation: generation,
      userId: user.id,
      api: api,
      isMock: false,
      baseUrl: baseUrl,
    )) {
      throw const ApiException('Phiên đã thay đổi. Vui lòng tải lại hồ sơ.');
    }
    _currentUser = user.copyWith(
      fullName: updated.fullName,
      phone: updated.phone,
      email: updated.email,
      address: updated.address,
      customerCode: updated.customerCode,
    );
    notifyListeners();
  }

  Future<void> changePassword(
    String currentPassword,
    String newPassword,
  ) async {
    final user = _currentUser;
    if (_isMock || user == null) {
      throw const ApiException('Vui lòng đăng nhập tài khoản Real.');
    }
    final generation = _sessionGeneration;
    final api = _api;
    final baseUrl = _baseUrl;
    final response = await api.changePassword(currentPassword, newPassword);
    if (!_isCurrentSessionScope(
          generation: generation,
          userId: user.id,
          api: api,
          isMock: false,
          baseUrl: baseUrl,
        ) ||
        response.user.id != user.id ||
        response.refreshToken == null) {
      throw const ApiException(
        'Phiên mới không hợp lệ. Vui lòng đăng nhập lại.',
      );
    }
    try {
      await _storage.saveSession(
        token: response.accessToken,
        refreshToken: response.refreshToken,
        userId: user.id,
        isMock: false,
      );
    } catch (_) {
      await _storage.clearSession(isMock: false);
      api.clearAuthToken();
      _sessionGeneration++;
      _currentUser = null;
      _clearNotificationState();
      notifyListeners();
      throw const ApiException(
        'Mật khẩu đã đổi nhưng App không lưu được phiên. Vui lòng đăng nhập lại.',
      );
    }
    _sessionGeneration++;
    api.setAuthToken(response.accessToken);
    _currentUser = response.user.copyWith(
      customerCode: user.customerCode,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      address: user.address,
    );
    notifyListeners();
  }

  Future<List<OwnedDevice>> getMyDevices() {
    return _api.getMyDevices();
  }

  Future<PortalCatalog> getPortalCatalog() => _api.getPortalCatalog();

  Future<List<PortalRequestSummary>> getMyWarrantyRequests() =>
      _api.getMyWarrantyRequests();

  Future<PortalRequestDetail> getMyWarrantyRequest(String code) =>
      _api.getMyWarrantyRequest(code);

  Future<List<PortalTicketSummary>> getMyTickets() => _api.getMyTickets();

  Future<PortalTicketDetail> getPortalTicket(String code) =>
      _api.getPortalTicket(code);

  Future<PortalWarrantyCheck> checkWarranty(String serial) =>
      _api.checkWarranty(serial);

  Future<PortalNotificationInbox> getNotifications() async {
    final api = _api;
    final userId = _currentUser?.id;
    final isMock = _isMock;
    if (isMock || userId == null) return api.getNotifications();

    final generation = _sessionGeneration;
    final baseUrl = _baseUrl;
    _notificationCountLoading = true;
    _notificationCountError = false;
    notifyListeners();

    try {
      final inbox = await api.getNotifications();
      if (_isCurrentSessionScope(
        generation: generation,
        userId: userId,
        api: api,
        isMock: isMock,
        baseUrl: baseUrl,
      )) {
        _notificationUnreadCount = inbox.unreadCount;
        _notificationCountLoading = false;
        _notificationCountError = false;
        notifyListeners();
      }
      return inbox;
    } catch (_) {
      if (_isCurrentSessionScope(
        generation: generation,
        userId: userId,
        api: api,
        isMock: isMock,
        baseUrl: baseUrl,
      )) {
        // An unavailable response cannot be treated as the server's current
        // count, so do not leave a stale number visible after a failed read.
        _notificationUnreadCount = null;
        _notificationCountLoading = false;
        _notificationCountError = true;
        notifyListeners();
      }
      rethrow;
    }
  }

  Future<void> _primeNotificationCount() async {
    try {
      await getNotifications();
    } catch (_) {
      // The inbox screen provides the visible retry path for read failures.
    }
  }

  Future<void> markNotificationRead(String id) => _api.markNotificationRead(id);

  Future<PortalLookupRecord> lookupPortal(String code, String phone) =>
      _api.lookupPortal(code, phone);

  Future<PortalTicketDetail> decidePortalQuotation(
    String code,
    String decision, {
    String? reason,
  }) => _api.decidePortalQuotation(code, decision, reason: reason);

  Future<String> submitMyWarrantyRequest(OwnWarrantyRequestData data) =>
      _api.submitMyWarrantyRequest(data);

  Future<void> tryAutoLogin() async {
    _clearNotificationState();
    _setLoading(true);
    try {
      final session = await _storage.readSession(isMock: _isMock);
      final refreshToken = session['refreshToken'];

      if (refreshToken != null) {
        try {
          final response = await _api.refresh(refreshToken);
          await _storage.saveSession(
            token: response.accessToken,
            refreshToken: response.refreshToken,
            userId: response.user.id,
            isMock: _isMock,
          );
          _api.setAuthToken(response.accessToken);
          _sessionGeneration++;
          _currentUser = response.user;
          await refreshProfile(); // Ensure profile is loaded after refresh
          _hasSessionPendingRetry = false;
          unawaited(_primeNotificationCount());
          return;
        } on NetworkException {
          rethrow;
        } on ApiException catch (e) {
          if (e.statusCode == 401) {
            await _storage.clearSession(isMock: _isMock);
            _clearNotificationState();
            _hasSessionPendingRetry = false;
            return;
          }
          rethrow;
        } catch (_) {
          rethrow;
        }
      }

      await _storage.clearSession(isMock: _isMock);
      _hasSessionPendingRetry = false;
    } on NetworkException catch (e) {
      _setError(e.message);
      _hasSessionPendingRetry = true;
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        await _storage.clearSession(isMock: _isMock);
        _clearNotificationState();
        _hasSessionPendingRetry = false;
      } else {
        _hasSessionPendingRetry = true;
      }
      _setError(e.message);
    } catch (_) {
      _hasSessionPendingRetry = true;
      _setError('Đã xảy ra lỗi không xác định. Vui lòng thử lại.');
    } finally {
      _setLoading(false);
    }
  }

  Future<void> logout({bool keepLoading = false}) async {
    _sessionGeneration++;
    _clearNotificationState();
    _setLoading(true);
    try {
      final session = await _storage.readSession(isMock: _isMock);
      await _api.logout(session['refreshToken']);
    } catch (_) {
      // Ignore errors during logout
    }
    await _storage.clearSession(isMock: _isMock);
    _api.clearAuthToken();
    _currentUser = null;
    _errorMessage = null;
    _hasSessionPendingRetry = false;
    if (!keepLoading) _setLoading(false);
  }

  void clearError() => _setError(null);
}
