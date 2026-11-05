import 'package:flutter/foundation.dart';
import '../models/portal_ticket_models.dart';
import 'auth_viewmodel.dart';

/// Real customer tickets only. The Mock ticket screens keep their demo source.
class TicketViewModel extends ChangeNotifier {
  TicketViewModel(this._auth) {
    _auth.addListener(_onAuthChanged);
    _identity = _currentIdentity;
  }

  final AuthViewModel _auth;
  String? _identity;
  String? get _currentIdentity =>
      _auth.isMock || !_auth.isAuthenticated ? null : _auth.currentUser!.id;

  List<PortalTicketSummary> _tickets = [];
  List<PortalTicketSummary> get tickets => List.unmodifiable(_tickets);
  bool _loaded = false;
  bool get loaded => _loaded;
  bool _loading = false;
  bool get loading => _loading;
  String? _error;
  String? get error => _error;

  void _onAuthChanged() {
    final next = _currentIdentity;
    if (next == _identity) return;
    _identity = next;
    _tickets = [];
    _loaded = false;
    _loading = false;
    _error = null;
    notifyListeners();
  }

  Future<void> ensureLoaded() async {
    if (_loaded || _loading || _error != null || _identity == null) return;
    await refresh();
  }

  Future<void> refresh() async {
    if (_identity == null || _loading) return;
    final identity = _identity;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final rows = await _auth.getMyTickets();
      if (_identity != identity) return;
      _tickets = rows;
      _loaded = true;
    } catch (_) {
      if (_identity != identity) return;
      _error = 'Không tải được danh sách phiếu tiếp nhận. Vui lòng thử lại.';
    } finally {
      if (_identity == identity) {
        _loading = false;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuthChanged);
    super.dispose();
  }
}
