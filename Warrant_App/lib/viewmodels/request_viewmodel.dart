import 'package:flutter/foundation.dart';
import '../models/portal_request_models.dart';
import 'auth_viewmodel.dart';

/// Keeps the Real request list shared by Home and the Requests tab.
/// The Mock screens continue to use mock_data.dart only.
class RequestViewModel extends ChangeNotifier {
  RequestViewModel(this._auth) {
    _auth.addListener(_onAuthChanged);
    _identity = _currentIdentity;
  }

  final AuthViewModel _auth;
  String? _identity;
  String? get _currentIdentity =>
      _auth.isMock || !_auth.isAuthenticated ? null : _auth.currentUser!.id;

  List<PortalRequestSummary> _requests = [];
  List<PortalRequestSummary> get requests => List.unmodifiable(_requests);
  bool _loaded = false;
  bool get loaded => _loaded;
  bool _loading = false;
  bool get loading => _loading;
  bool _refreshQueued = false;
  String? _error;
  String? get error => _error;
  bool _submitting = false;
  bool get submitting => _submitting;

  void _onAuthChanged() {
    final next = _currentIdentity;
    if (next == _identity) return;
    _identity = next;
    _requests = [];
    _loaded = false;
    _loading = false;
    _refreshQueued = false;
    _error = null;
    _submitting = false;
    notifyListeners();
  }

  Future<void> ensureLoaded() async {
    if (_loaded || _loading || _identity == null) return;
    await refresh();
  }

  Future<void> refresh() async {
    if (_identity == null) return;
    if (_loading) {
      _refreshQueued = true;
      return;
    }
    final identity = _identity;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final rows = await _auth.getMyWarrantyRequests();
      if (_identity != identity) return;
      if (!_refreshQueued) {
        _requests = rows;
        _loaded = true;
      }
    } catch (_) {
      if (_identity != identity) return;
      _error = 'Không tải được danh sách yêu cầu. Vui lòng thử lại.';
    } finally {
      if (_identity == identity) {
        _loading = false;
        final refreshAgain = _refreshQueued;
        _refreshQueued = false;
        notifyListeners();
        if (refreshAgain) await refresh();
      }
    }
  }

  Future<String> submit(OwnWarrantyRequestData data) async {
    if (_identity == null || _submitting) {
      throw StateError(
        'Yêu cầu đang được gửi hoặc phiên đăng nhập đã kết thúc.',
      );
    }
    _submitting = true;
    notifyListeners();
    try {
      final code = await _auth.submitMyWarrantyRequest(data);
      // Only a confirmed POST invalidates the cached list. No local request is fabricated.
      _loaded = false;
      notifyListeners();
      return code;
    } finally {
      _submitting = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuthChanged);
    super.dispose();
  }
}
