import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter/foundation.dart';
import '../models/user_model.dart';
import '../models/portal_request_models.dart';
import '../models/portal_ticket_models.dart';
import '../models/portal_lookup_models.dart';
import '../models/portal_notification_models.dart';
import 'i_api_service.dart';

class RealApiService implements IApiService {
  RealApiService({required String baseUrl, HttpClientAdapter? adapter})
    : _dio = Dio(
        BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 15),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        ),
      ) {
    if (adapter != null) _dio.httpClientAdapter = adapter;
  }

  final Dio _dio;
  Future<String?> Function()? onAccessTokenExpired;
  Future<String?>? _refreshInFlight;
  String? _lastRenewedFromAuthorization;
  int _sessionEpoch = 0;

  // Set baseUrl dynamically
  void setBaseUrl(String url) {
    _dio.options.baseUrl = url;
  }

  Future<Response<dynamic>> _postWithoutAuthorization(
    String path,
    Map<String, dynamic> data,
  ) {
    final request = Options(
      method: 'POST',
    ).compose(_dio.options, path, data: data);
    // Keep the shared Bearer for concurrent GETs. Public auth endpoints must
    // not inherit an expired access token from the Dio defaults.
    request.headers.remove('Authorization');
    return _dio.fetch<dynamic>(request);
  }

  Future<Response<dynamic>> _get(String path) => _authenticatedRequest(
    () => Options(method: 'GET').compose(_dio.options, path),
  );

  Future<Response<dynamic>> _post(
    String path, {
    Object? Function()? data,
    Options? options,
  }) => _authenticatedRequest(
    () => (options ?? Options())
        .copyWith(method: 'POST')
        .compose(_dio.options, path, data: data?.call()),
  );

  Future<Response<dynamic>> _authenticatedRequest(
    RequestOptions Function() createRequest,
  ) async {
    final sessionEpoch = _sessionEpoch;
    try {
      return await _dio.fetch<dynamic>(createRequest());
    } on DioException catch (error) {
      final failedAuthorization =
          error.requestOptions.headers['Authorization'] as String?;
      if (error.response?.statusCode != 401 ||
          failedAuthorization == null ||
          sessionEpoch != _sessionEpoch ||
          onAccessTokenExpired == null) {
        _handleDioError(error);
      }
      if (kDebugMode) {
        debugPrint(
          '${error.requestOptions.method} ${error.requestOptions.path} -> 401; refresh pending',
        );
      }

      // A different request may already have refreshed the token. Otherwise only
      // one refresh may rotate the backend refresh credential at a time.
      final currentAuthorization =
          _dio.options.headers['Authorization'] as String?;
      String? accessToken;
      if (currentAuthorization != null &&
          currentAuthorization != failedAuthorization &&
          _lastRenewedFromAuthorization == failedAuthorization &&
          currentAuthorization.startsWith('Bearer ')) {
        accessToken = currentAuthorization.substring(7);
      } else {
        if (currentAuthorization != failedAuthorization &&
            _refreshInFlight == null) {
          _handleDioError(error);
        }
        final pending = _refreshInFlight ??= onAccessTokenExpired!();
        try {
          accessToken = await pending;
          if (accessToken != null && sessionEpoch == _sessionEpoch) {
            _lastRenewedFromAuthorization = failedAuthorization;
          }
        } finally {
          if (identical(_refreshInFlight, pending)) _refreshInFlight = null;
        }
      }
      if (accessToken == null || sessionEpoch != _sessionEpoch) {
        _handleDioError(error);
      }

      // Only a rejected 401 is retried, once. Rebuild multipart and file streams;
      // timeouts and other errors may follow a committed write and must not replay it.
      try {
        final retry = createRequest();
        retry.headers['Authorization'] = 'Bearer $accessToken';
        final response = await _dio.fetch<dynamic>(retry);
        if (kDebugMode) {
          debugPrint(
            '${error.requestOptions.method} ${error.requestOptions.path} retry -> ${response.statusCode}',
          );
        }
        return response;
      } on DioException catch (retryError) {
        if (kDebugMode) {
          debugPrint(
            '${error.requestOptions.method} ${error.requestOptions.path} retry -> ${retryError.response?.statusCode ?? 'network'}',
          );
        }
        _handleDioError(retryError);
      }
    }
  }

  Never _handleDioError(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.connectionError ||
        e.response == null) {
      // Android may keep a stale pooled socket after airplane mode or a brief
      // network loss. A later user-triggered retry must open a fresh client.
      final adapter = _dio.httpClientAdapter;
      if (adapter is IOHttpClientAdapter) {
        adapter.close(force: true);
        _dio.httpClientAdapter = IOHttpClientAdapter();
      }
      throw const NetworkException();
    }

    if (e.response != null && e.response!.data != null) {
      final data = e.response!.data;
      if (data is Map<String, dynamic>) {
        if (data['detail'] != null || data['type'] != null) {
          final detail = data['detail'] as String?;
          final fieldErrors = data['fieldErrors'] as List<dynamic>?;
          final sb = StringBuffer();
          final errors = <String, String>{};
          if (detail != null) sb.writeln(detail);
          if (fieldErrors != null && fieldErrors.isNotEmpty) {
            for (final fe in fieldErrors) {
              if (fe is Map<String, dynamic>) {
                final field = fe['field'] as String?;
                final message = fe['message'] as String?;
                if (field != null && message != null) errors[field] = message;
              }
            }
          }
          throw ApiException(
            sb.toString().trim().isEmpty
                ? 'Dữ liệu gửi đi không hợp lệ.'
                : sb.toString().trim(),
            statusCode: e.response?.statusCode,
            fieldErrors: errors,
            code: data['code'] is String ? data['code'] as String : null,
          );
        }
      }
    }
    final message =
        (e.response?.data is Map<String, dynamic>
            ? (e.response!.data as Map<String, dynamic>)['message'] as String?
            : null) ??
        e.message ??
        'Đã xảy ra lỗi không mong muốn.';
    throw ApiException(message, statusCode: e.response?.statusCode);
  }

  @override
  void setAuthToken(String token) =>
      _dio.options.headers['Authorization'] = 'Bearer $token';

  @override
  void clearAuthToken() {
    _sessionEpoch++;
    _refreshInFlight = null;
    _lastRenewedFromAuthorization = null;
    _dio.options.headers.remove('Authorization');
  }

  @override
  Future<AuthResponse> login(String username, String password) async {
    try {
      final response = await _postWithoutAuthorization('/auth/mobile/login', {
        'username': username.trim().toLowerCase(),
        'password': password,
      });
      return AuthResponse.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      _handleDioError(e);
    }
  }

  @override
  Future<AuthResponse> refresh(String refreshToken) async {
    try {
      final response = await _postWithoutAuthorization('/auth/mobile/refresh', {
        'refreshToken': refreshToken,
      });
      if (kDebugMode) {
        debugPrint('POST /auth/mobile/refresh -> ${response.statusCode}');
      }
      return AuthResponse.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (kDebugMode) {
        final data = e.response?.data;
        final rawCode = data is Map<String, dynamic> ? data['code'] : null;
        final code =
            rawCode is String &&
                RegExp(r'^[A-Z][A-Z0-9_]{0,63}$').hasMatch(rawCode)
            ? rawCode
            : 'unavailable';
        debugPrint(
          'POST /auth/mobile/refresh -> ${e.response?.statusCode ?? 'network'} code=$code',
        );
      }
      _handleDioError(e);
    }
  }

  @override
  Future<void> logout(String? refreshToken) async {
    try {
      await _postWithoutAuthorization('/auth/mobile/logout', {
        'refreshToken': refreshToken,
        'all': false,
      });
    } on DioException catch (e) {
      _handleDioError(e);
    }
  }

  Future<EmailOtpIssued> _requestEmailOtp(
    String email,
    String purpose, {
    String? phone,
  }) async {
    try {
      final response = await _postWithoutAuthorization('/auth/mobile/otp', {
        'email': email.trim(),
        'phone': phone,
        'purpose': purpose,
      });
      return EmailOtpIssued.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (error) {
      _handleDioError(error);
    }
  }

  @override
  Future<EmailOtpIssued> requestRegistrationOtp(String email, String phone) =>
      _requestEmailOtp(email, 'REGISTER', phone: phone.trim());

  @override
  Future<AuthResponse> registerWithEmailOtp({
    required String fullName,
    required String phone,
    required String email,
    required String otp,
    required String password,
  }) async {
    try {
      final response =
          await _postWithoutAuthorization('/auth/mobile/register', {
            'phone': phone.trim(),
            'email': email.trim(),
            'otp': otp.trim(),
            'fullName': fullName.trim(),
            'password': password,
          });
      return AuthResponse.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (error) {
      _handleDioError(error);
    }
  }

  @override
  Future<EmailOtpIssued> requestPasswordResetOtp(String email) =>
      _requestEmailOtp(email, 'RESET_PASSWORD');

  @override
  Future<void> verifyPasswordResetOtp(String email, String otp) async {
    try {
      await _postWithoutAuthorization('/auth/mobile/password-reset/verify', {
        'email': email.trim(),
        'otp': otp.trim(),
      });
    } on DioException catch (error) {
      _handleDioError(error);
    }
  }

  @override
  Future<void> resetPasswordWithEmailOtp({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    try {
      await _postWithoutAuthorization('/auth/mobile/password-reset', {
        'email': email.trim(),
        'otp': otp.trim(),
        'newPassword': newPassword,
      });
    } on DioException catch (error) {
      _handleDioError(error);
    }
  }

  @override
  Future<UserModel> getProfile() async {
    final response = await _get('/portal/my/profile');
    return UserModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<UserModel> updateMyProfile({
    required String fullName,
    required String email,
    required String address,
  }) async {
    // Refresh an expired access token with a GET before the write. Never
    // replay a profile mutation after an uncertain response.
    await _get('/auth/me');
    try {
      final response = await _dio.patch<dynamic>(
        '/portal/my/profile',
        data: {
          'fullName': fullName.trim(),
          'email': email.trim(),
          'address': address.trim(),
        },
      );
      final updated = UserModel.fromJson(response.data as Map<String, dynamic>);
      if (updated.fullName != fullName.trim()) {
        throw ApiException(
          'Máy chủ chưa cập nhật họ tên. Vui lòng kiểm tra lại hồ sơ và phiên bản API đang chạy.',
          statusCode: response.statusCode,
        );
      }
      return updated;
    } on DioException catch (error) {
      _handleDioError(error);
    }
  }

  @override
  Future<AuthResponse> changePassword(
    String currentPassword,
    String newPassword,
  ) async {
    // This write is sent once. A timeout might follow a committed change.
    await _get('/auth/me');
    try {
      final response = await _dio.post<dynamic>(
        '/auth/mobile/change-password',
        data: {'currentPassword': currentPassword, 'newPassword': newPassword},
      );
      return AuthResponse.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (error) {
      _handleDioError(error);
    }
  }

  @override
  Future<List<OwnedDevice>> getMyDevices() async {
    final response = await _get('/portal/my/devices');
    final list = response.data as List<dynamic>;
    return list
        .map((e) => OwnedDevice.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<PortalCatalog> getPortalCatalog() async {
    final response = await _get('/portal/catalog');
    return PortalCatalog.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<List<PortalRequestSummary>> getMyWarrantyRequests() async {
    final response = await _get('/portal/my/warranty-requests');
    return (response.data as List<dynamic>)
        .map(
          (item) => PortalRequestSummary.fromJson(item as Map<String, dynamic>),
        )
        .toList();
  }

  @override
  Future<PortalRequestDetail> getMyWarrantyRequest(String code) async {
    final response = await _get(
      '/portal/my/warranty-requests/${Uri.encodeComponent(code)}',
    );
    return PortalRequestDetail.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<List<PortalTicketSummary>> getMyTickets() async {
    final response = await _get('/portal/my/tickets');
    return (response.data as List<dynamic>)
        .map(
          (item) => PortalTicketSummary.fromJson(item as Map<String, dynamic>),
        )
        .toList();
  }

  @override
  Future<PortalTicketDetail> getPortalTicket(String code) async {
    final response = await _get('/portal/tickets/${Uri.encodeComponent(code)}');
    return PortalTicketDetail.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<PortalWarrantyCheck> checkWarranty(String serial) async {
    final request = Options(method: 'GET').compose(
      _dio.options,
      '/portal/warranty-check',
      queryParameters: {
        'serial': serial.replaceAll(RegExp(r'\s'), '').toUpperCase(),
      },
    );
    // Public summary must not inherit or refresh the signed-in session.
    request.headers.remove('Authorization');
    try {
      final response = await _dio.fetch<dynamic>(request);
      return PortalWarrantyCheck.fromJson(
        response.data as Map<String, dynamic>,
      );
    } on DioException catch (error) {
      _handleDioError(error);
    }
  }

  @override
  Future<PortalNotificationInbox> getNotifications() async {
    final response = await _get('/notifications');
    return PortalNotificationInbox.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  @override
  Future<void> markNotificationRead(String id) async {
    try {
      await _post('/notifications/${Uri.encodeComponent(id)}/read');
    } on DioException catch (error) {
      _handleDioError(error);
    }
  }

  @override
  Future<PortalLookupRecord> lookupPortal(String code, String phone) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/portal/lookup',
        data: {'code': code.trim().toUpperCase(), 'phone': phone.trim()},
        options: Options(headers: {'Authorization': null}),
      );
      final grant = response.data!;
      final scope = grant['scope'] as String?;
      final grantedCode = grant['code'] as String?;
      final token = grant['accessToken'] as String?;
      if (grantedCode == null || token == null || token.isEmpty) {
        throw const ApiException('Phản hồi tra cứu không hợp lệ.');
      }
      // Keep the scoped token in this method. It must never replace the
      // signed-in customer's token or be persisted with the session.
      final path = switch (scope) {
        'REQUEST' =>
          '/portal/warranty-requests/${Uri.encodeComponent(grantedCode)}',
        'TICKET' => '/portal/tickets/${Uri.encodeComponent(grantedCode)}',
        _ => throw const ApiException('Phạm vi tra cứu không hợp lệ.'),
      };
      final detail = await _dio.get<Map<String, dynamic>>(
        path,
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      return scope == 'REQUEST'
          ? PortalLookupRecord.request(
              PortalRequestDetail.fromJson(detail.data!),
            )
          : PortalLookupRecord.ticket(
              PortalTicketDetail.fromJson(detail.data!),
            );
    } on DioException catch (error) {
      _handleDioError(error);
    }
  }

  @override
  Future<PortalTicketDetail> decidePortalQuotation(
    String ticketCode,
    String decision, {
    String? reason,
  }) async {
    try {
      final response = await _post(
        '/portal/tickets/${Uri.encodeComponent(ticketCode)}/quotation-decision',
        data: () => {'decision': decision, 'reason': reason},
      );
      return PortalTicketDetail.fromJson(response.data!);
    } on DioException catch (error) {
      _handleDioError(error);
    }
  }

  @override
  Future<String> submitMyWarrantyRequest(OwnWarrantyRequestData data) async {
    FormData createForm() {
      final form = FormData();
      form.fields.add(MapEntry('data', jsonEncode(data.toJson())));
      for (final file in data.attachments) {
        form.files.add(
          MapEntry(
            'files',
            MultipartFile.fromStream(
              file.openRead,
              file.length,
              filename: file.name,
            ),
          ),
        );
      }
      return form;
    }

    try {
      final response = await _post(
        '/portal/my/warranty-requests',
        data: createForm,
        options: Options(contentType: Headers.multipartFormDataContentType),
      );
      if (response.statusCode != 201) {
        throw ApiException(
          'Máy chủ chưa xác nhận tạo yêu cầu.',
          statusCode: response.statusCode,
        );
      }
      final code = (response.data as Map<String, dynamic>)['code'] as String?;
      if (code == null || code.trim().isEmpty) {
        throw const ApiException(
          'Máy chủ không trả mã yêu cầu. Vui lòng kiểm tra danh sách trước khi gửi lại.',
        );
      }
      return code;
    } on DioException catch (e) {
      _handleDioError(e);
    }
  }
}
