import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:file_picker/file_picker.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../models/portal_request_models.dart';
import '../../models/user_model.dart';
import '../../router/app_router.dart';
import '../../services/i_api_service.dart';
import '../../theme/app_theme.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../viewmodels/request_viewmodel.dart';
import '../../widgets/app_bar_widget.dart';

/// Real customer submission. An owned device can be selected, or a new
/// device's identity can be included in the request for staff to verify.
class RealCreateRequestScreen extends StatefulWidget {
  const RealCreateRequestScreen({super.key, this.prefilledDevice});
  final OwnedDevice? prefilledDevice;

  @override
  State<RealCreateRequestScreen> createState() =>
      _RealCreateRequestScreenState();
}

class _RealCreateRequestScreenState extends State<RealCreateRequestScreen> {
  final _symptomController = TextEditingController();
  final _brandModelController = TextEditingController();
  final _serialController = TextEditingController();
  PortalCatalog? _catalog;
  List<OwnedDevice> _devices = [];
  OwnedDevice? _device;
  String? _categoryCode;
  String? _deviceTypeCode;
  String? _stationCode;
  DateTime? _preferredFrom;
  List<RequestAttachment> _attachments = [];
  Map<String, String> _errors = {};
  String? _loadError;
  String? _submitError;
  String? _submittedCode;
  bool _loading = true;
  bool _submitting = false;
  bool _uncertain = false;
  bool _manualDevice = false;
  bool _discardConfirmed = false;
  bool _confirmingDiscard = false;

  bool get _hasUnsavedChanges =>
      _symptomController.text.isNotEmpty ||
      _brandModelController.text.isNotEmpty ||
      _serialController.text.isNotEmpty ||
      (_device != null && widget.prefilledDevice == null) ||
      _categoryCode != null ||
      _deviceTypeCode != null ||
      _stationCode != null ||
      _preferredFrom != null ||
      _attachments.isNotEmpty;

  Future<void> _onPopInvoked(bool didPop, Object? result) async {
    if (didPop || _confirmingDiscard) return;
    if (_submitting) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đang gửi yêu cầu. Vui lòng chờ kết quả.'),
        ),
      );
      return;
    }
    _confirmingDiscard = true;
    try {
      final discard = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Bỏ yêu cầu đang soạn?'),
          content: const Text('Nội dung và tệp đã chọn sẽ không được giữ lại.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Tiếp tục soạn'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Bỏ thay đổi'),
            ),
          ],
        ),
      );
      if (!mounted || discard != true) return;
      setState(() => _discardConfirmed = true);
      await WidgetsBinding.instance.endOfFrame;
      if (mounted) context.pop(result);
    } finally {
      _confirmingDiscard = false;
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _symptomController.dispose();
    _brandModelController.dispose();
    _serialController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final api = context.read<AuthViewModel>();
      final catalog = await api.getPortalCatalog();
      final devices = await api.getMyDevices();
      if (!mounted) return;
      OwnedDevice? selected;
      if (widget.prefilledDevice != null) {
        final original = widget.prefilledDevice!;
        for (final candidate in devices) {
          if (candidate.code == original.code &&
              candidate.serialOrImei == original.serialOrImei) {
            selected = candidate;
            break;
          }
        }
        if (selected == null) {
          throw const ApiException(
            'Thiết bị đã chọn không còn trong danh sách sở hữu. Vui lòng tải lại danh sách thiết bị.',
          );
        }
      }
      setState(() {
        _catalog = catalog;
        _devices = devices;
        _device = selected;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadError = error is ApiException
            ? error.message
            : 'Không tải được danh mục hoặc thiết bị. Vui lòng thử lại.';
        _loading = false;
      });
    }
  }

  List<PortalCategory> get _categories {
    if (_manualDevice) return _catalog?.categories ?? [];
    final identifier = _device?.identifierType.toUpperCase();
    return (_catalog?.categories ?? [])
        .where(
          (category) => category.deviceTypes.any(
            (type) => type.identifierType.toUpperCase() == identifier,
          ),
        )
        .toList();
  }

  List<PortalDeviceType> _typesForCategory(String? code) {
    final category = _categories.where((item) => item.code == code).firstOrNull;
    if (_manualDevice) return category?.deviceTypes ?? [];
    return category?.deviceTypes
            .where(
              (type) =>
                  type.identifierType.toUpperCase() ==
                  _device?.identifierType.toUpperCase(),
            )
            .toList() ??
        [];
  }

  List<PortalDeviceType> get _types => _typesForCategory(_categoryCode);

  Future<void> _pickPreferredTime() async {
    final now = DateTime.now();
    final day = await showDatePicker(
      context: context,
      initialDate: _preferredFrom?.isAfter(now) == true
          ? _preferredFrom!
          : now.add(const Duration(days: 1)),
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime(2100),
      helpText: 'Ngày mong muốn mang máy tới',
    );
    if (!mounted || day == null) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_preferredFrom ?? now),
      helpText: 'Giờ mong muốn mang máy tới',
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
    if (!mounted || time == null) return;
    setState(() {
      _preferredFrom = DateTime(
        day.year,
        day.month,
        day.day,
        time.hour,
        time.minute,
      );
      _errors.remove('preferredFrom');
    });
  }

  String get _preferredTimeLabel {
    final value = _preferredFrom;
    if (value == null) return 'Chọn ngày và giờ';
    String two(int number) => number.toString().padLeft(2, '0');
    return '${two(value.day)}/${two(value.month)}/${value.year} '
        '${two(value.hour)}:${two(value.minute)}';
  }

  Future<void> _pickAttachments() async {
    try {
      final picked = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp', 'mp4'],
        allowMultiple: true,
        withData: kIsWeb,
      );
      if (!mounted || picked == null) return;
      final files = <RequestAttachment>[];
      for (final file in picked.files) {
        if (file.path == null && file.bytes == null) {
          setState(() => _errors['files'] = 'Không đọc được tệp đã chọn.');
          return;
        }
        files.add(
          RequestAttachment(
            name: file.name,
            length: file.size,
            openRead: () => file.xFile.openRead(),
          ),
        );
      }
      final error = RequestAttachment.validateSelection(files);
      setState(() {
        if (error == null) {
          _attachments = files;
          _errors.remove('files');
        } else {
          _errors['files'] = error;
        }
      });
    } catch (_) {
      if (mounted) {
        setState(
          () => _errors['files'] = 'Không thể chọn tệp. Vui lòng thử lại.',
        );
      }
    }
  }

  Future<void> _submit() async {
    if (_submitting || _uncertain || _catalog == null) return;
    FocusScope.of(context).unfocus();
    final errors = _manualDevice
        ? OwnWarrantyRequestData.validateUnregistered(
            catalog: _catalog!,
            categoryCode: _categoryCode,
            deviceTypeCode: _deviceTypeCode,
            brandModel: _brandModelController.text,
            serialOrImei: _serialController.text,
            stationCode: _stationCode,
            symptom: _symptomController.text,
          )
        : OwnWarrantyRequestData.validate(
            device: _device,
            catalog: _catalog!,
            categoryCode: _categoryCode,
            deviceTypeCode: _deviceTypeCode,
            stationCode: _stationCode,
            symptom: _symptomController.text,
          );
    final timeError = OwnWarrantyRequestData.validatePreferredArrival(
      _preferredFrom,
      DateTime.now(),
    );
    if (timeError != null) errors['preferredFrom'] = timeError;
    final filesError = RequestAttachment.validateSelection(_attachments);
    if (filesError != null) errors['files'] = filesError;
    if (errors.isNotEmpty) {
      setState(() => _errors = errors);
      return;
    }
    final device = _device;
    final selectedType = _types
        .where((type) => type.code == _deviceTypeCode)
        .firstOrNull;
    final data = OwnWarrantyRequestData(
      categoryCode: _categoryCode!,
      deviceTypeCode: _deviceTypeCode!,
      brandModel: _manualDevice
          ? _brandModelController.text.trim()
          : OwnWarrantyRequestData.brandModelOf(device!),
      identifierType: _manualDevice
          ? selectedType!.identifierType.toUpperCase()
          : device!.identifierType.toUpperCase(),
      serialOrImei: _manualDevice
          ? _serialController.text.trim()
          : device!.serialOrImei.trim(),
      symptom: _symptomController.text.trim(),
      preferredStation: _stationCode!,
      preferredFrom: _preferredFrom,
      preferredTo: _preferredFrom!.add(const Duration(hours: 1)),
      attachments: _attachments,
    );
    setState(() {
      _submitting = true;
      _errors = {};
      _submitError = null;
    });
    try {
      final requests = context.read<RequestViewModel>();
      final code = await requests.submit(data);
      if (!mounted) return;
      setState(() => _submittedCode = code);
      // Fetch from the API; never insert a local copy of the submitted request.
      requests.refresh();
    } on NetworkException {
      if (!mounted) return;
      setState(() {
        _uncertain = true;
        _submitError =
            'Chưa xác định máy chủ đã nhận yêu cầu hay chưa. Hãy kiểm tra danh sách yêu cầu trước khi gửi lại để tránh tạo trùng.';
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _uncertain =
            error.statusCode == null ||
            error.statusCode! < 400 ||
            error.statusCode! >= 500;
        _errors = error.fieldErrors.map(
          (field, message) => MapEntry(field, _fieldError(field, message)),
        );
        _submitError = _uncertain
            ? 'Chưa xác định yêu cầu đã được tạo hay chưa. Hãy kiểm tra danh sách trước khi gửi lại.'
            : error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _uncertain = true;
        _submitError =
            'Chưa xác định yêu cầu đã được tạo hay chưa. Hãy kiểm tra danh sách trước khi gửi lại.';
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _fieldError(String field, String backendMessage) {
    final label = switch (field) {
      'categoryCode' => 'Nhóm thiết bị',
      'deviceTypeCode' => 'Loại thiết bị',
      'brandModel' => 'Tên thiết bị',
      'identifierType' => 'Loại mã',
      'serialOrImei' => 'Serial/IMEI',
      'symptom' => 'Mô tả lỗi',
      'preferredStation' => 'Trạm dịch vụ',
      'preferredFrom' || 'preferredTo' => 'Thời gian mong muốn',
      'files' => 'Tệp đính kèm',
      _ => field,
    };
    final english = backendMessage.toLowerCase();
    if (english.contains('must not be blank') || english.contains('required')) {
      return '$label là bắt buộc.';
    }
    if (english.contains('size must be between')) {
      return '$label vượt quá độ dài cho phép.';
    }
    return '$label: $backendMessage';
  }

  @override
  Widget build(BuildContext context) {
    if (_submittedCode != null) return _success();
    return PopScope<Object?>(
      canPop: _discardConfirmed || (!_hasUnsavedChanges && !_submitting),
      onPopInvokedWithResult: _onPopInvoked,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Column(
            children: [
              const WarrantSafeAppBar(),
              WarrantSafeTitleRow(
                title: 'Gửi yêu cầu bảo hành / sửa chữa',
                onBackTap: () => Navigator.of(context).maybePop(),
              ),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : _loadError != null
                    ? _loadFailure()
                    : _form(),
              ),
              if (!_loading && _loadError == null && !_uncertain)
                _submitButton(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _loadFailure() => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(_loadError!, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: _load, child: const Text('Tải lại')),
        ],
      ),
    ),
  );

  Widget _form() {
    final device = _device;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        const Text(
          'Thông tin liên hệ được lấy từ hồ sơ tài khoản đang đăng nhập.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 16),
        if (widget.prefilledDevice == null) ...[
          TextButton.icon(
            onPressed: () => setState(() {
              _manualDevice = !_manualDevice;
              _device = null;
              _categoryCode = null;
              _deviceTypeCode = null;
              _errors = {};
            }),
            icon: Icon(
              _manualDevice ? Icons.list_alt : Icons.add_circle_outline,
            ),
            label: Text(
              _manualDevice
                  ? 'Chọn thiết bị đã có trong tài khoản'
                  : 'Thiết bị chưa có trong danh sách? Nhập thông tin',
            ),
          ),
          const SizedBox(height: 8),
        ],
        if (widget.prefilledDevice != null && device != null)
          _deviceIdentity(device)
        else if (!_manualDevice)
          _select(
            'Thiết bị của bạn *',
            device?.code,
            _devices
                .map(
                  (item) => DropdownMenuItem(
                    value: item.code,
                    child: Text(
                      '${OwnWarrantyRequestData.brandModelOf(item)} · ${item.serialOrImei}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            (code) => setState(() {
              _device = _devices.where((item) => item.code == code).firstOrNull;
              _categoryCode = null;
              _deviceTypeCode = null;
              _errors = {};
            }),
            _errors['device'],
          ),
        if (!_manualDevice && device == null && _devices.isEmpty) ...[
          const SizedBox(height: 8),
          const Text(
            'Tài khoản chưa có thiết bị sở hữu. Bạn có thể nhập thông tin thiết bị mới ở trên.',
          ),
        ],
        const SizedBox(height: 16),
        if (device != null || _manualDevice) ...[
          if (widget.prefilledDevice == null && device != null)
            _deviceIdentity(device),
          const SizedBox(height: 16),
          Text(
            _manualDevice
                ? 'Thông tin thiết bị mới sẽ được lễ tân kiểm tra khi tiếp nhận; gửi yêu cầu không đăng ký hoặc kích hoạt bảo hành.'
                : 'Chọn loại thiết bị trong danh mục của trung tâm. Mã loại không có trong hồ sơ thiết bị nên cần bạn xác nhận.',
            style: const TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 16),
          _select(
            'Nhóm thiết bị *',
            _categoryCode,
            _categories
                .map(
                  (item) => DropdownMenuItem(
                    value: item.code,
                    child: Text(item.name),
                  ),
                )
                .toList(),
            (code) => setState(() {
              _categoryCode = code;
              final types = _typesForCategory(code);
              _deviceTypeCode = types.length == 1 ? types.single.code : null;
              _errors = {};
            }),
            _errors['categoryCode'],
          ),
          if (_types.length > 1) ...[
            const SizedBox(height: 16),
            _select(
              'Loại thiết bị *',
              _deviceTypeCode,
              _types
                  .map(
                    (item) => DropdownMenuItem(
                      value: item.code,
                      child: Text(item.name),
                    ),
                  )
                  .toList(),
              (code) => setState(() {
                _deviceTypeCode = code;
                _errors.remove('deviceTypeCode');
              }),
              _errors['deviceTypeCode'],
            ),
          ] else if (_types.length == 1) ...[
            const SizedBox(height: 8),
            Text('Loại theo danh mục: ${_types.single.name}'),
          ] else if (_categoryCode != null) ...[
            const SizedBox(height: 8),
            const Text('Nhóm này chưa có loại thiết bị phù hợp.'),
          ],
          if (_manualDevice) ...[
            const SizedBox(height: 16),
            TextFormField(
              key: const ValueKey('manual-brand-model'),
              controller: _brandModelController,
              onChanged: (_) => setState(() => _errors.remove('brandModel')),
              decoration: InputDecoration(
                labelText: 'Hãng và model *',
                errorText: _errors['brandModel'],
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              key: const ValueKey('manual-serial'),
              controller: _serialController,
              textCapitalization: TextCapitalization.characters,
              onChanged: (_) => setState(() => _errors.remove('serialOrImei')),
              decoration: InputDecoration(
                labelText:
                    _types
                            .where((type) => type.code == _deviceTypeCode)
                            .firstOrNull
                            ?.identifierType
                            .toUpperCase() ==
                        'IMEI'
                    ? 'IMEI *'
                    : 'Serial/IMEI *',
                errorText: _errors['serialOrImei'],
              ),
            ),
          ],
          const SizedBox(height: 16),
          const Text(
            'Mô tả lỗi *',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          TextFormField(
            key: const ValueKey('request-symptom'),
            controller: _symptomController,
            maxLines: 5,
            minLines: 3,
            maxLength: 2000,
            onChanged: (_) => setState(() => _errors.remove('symptom')),
            decoration: InputDecoration(
              hintText: 'Mô tả tình trạng thiết bị đang gặp phải',
              errorText: _errors['symptom'],
            ),
          ),
          const SizedBox(height: 16),
          _select(
            'Trạm dịch vụ mong muốn *',
            _stationCode,
            (_catalog?.stations ?? [])
                .map(
                  (item) => DropdownMenuItem(
                    value: item.code,
                    child: Text(item.name),
                  ),
                )
                .toList(),
            (code) => setState(() {
              _stationCode = code;
              _errors.remove('preferredStation');
            }),
            _errors['preferredStation'],
          ),
          const SizedBox(height: 16),
          const Text(
            'Thời gian mong muốn mang máy tới *',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            key: const ValueKey('preferred-arrival-picker'),
            onPressed: _pickPreferredTime,
            icon: const Icon(Icons.calendar_today_outlined),
            label: Text(_preferredTimeLabel),
          ),
          if (_errors['preferredFrom'] != null)
            Text(
              _errors['preferredFrom']!,
              style: const TextStyle(color: AppColors.error),
            ),
          const SizedBox(height: 8),
          const Text(
            'Khoảng thời gian gửi tới trạm là 1 giờ kể từ thời điểm đã chọn. Đây là mong muốn, chưa phải lịch hẹn được xác nhận.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 24),
          _ownerSummary(),
          const SizedBox(height: 16),
          const Text('Ảnh/video lỗi (tối đa 3 tệp)'),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _submitting ? null : _pickAttachments,
            icon: const Icon(Icons.attach_file),
            label: Text(_attachments.isEmpty ? 'Chọn tệp' : 'Chọn lại tệp'),
          ),
          for (final file in _attachments) Text(file.name),
          if (_attachments.isNotEmpty)
            TextButton(
              onPressed: _submitting
                  ? null
                  : () => setState(() => _attachments = []),
              child: const Text('Bỏ tệp đã chọn'),
            ),
          if (_errors['files'] != null)
            Text(
              _errors['files']!,
              style: const TextStyle(color: AppColors.error),
            ),
          const Text(
            'Tệp không bắt buộc. Chỉ nhận JPEG/PNG/WebP tối đa 5 MiB mỗi ảnh hoặc MP4 tối đa 30 MiB; máy chủ sẽ kiểm tra nội dung tệp.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 12),
          const Text(
            'Gửi yêu cầu trực tuyến không có nghĩa trung tâm đã nhận thiết bị. Trạng thái tiếp nhận sẽ được cập nhật theo quy trình thực tế.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ],
        if (_submitError != null) ...[
          const SizedBox(height: 18),
          Text(_submitError!, style: const TextStyle(color: AppColors.error)),
          for (final message in _errors.values)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                message,
                style: const TextStyle(color: AppColors.error),
              ),
            ),
          if (_uncertain) ...[
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => context.go(AppRoutes.requests),
              child: const Text('Kiểm tra danh sách yêu cầu'),
            ),
          ],
        ],
      ],
    );
  }

  Widget _ownerSummary() {
    final user = context.watch<AuthViewModel>().currentUser;
    String shown(String? value) =>
        value?.trim().isNotEmpty == true ? value!.trim() : 'Chưa có thông tin';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Thông tin chủ sở hữu',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
        const SizedBox(height: 6),
        const Text('Lấy từ hồ sơ tài khoản; không cần nhập lại.'),
        const SizedBox(height: 8),
        Text('Họ và tên: ${shown(user?.fullName)}'),
        Text('Số điện thoại: ${shown(user?.phone)}'),
        Text('Email: ${shown(user?.email)}'),
        Text('Địa chỉ: ${shown(user?.address)}'),
      ],
    );
  }

  Widget _deviceIdentity(OwnedDevice device) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.white,
      borderRadius: BorderRadius.circular(AppRadius.control),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          OwnWarrantyRequestData.brandModelOf(device),
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
        const SizedBox(height: 4),
        Text('${device.identifierType}: ${device.serialOrImei}'),
        if (_errors['device'] != null)
          Text(
            _errors['device']!,
            style: const TextStyle(color: AppColors.error),
          ),
      ],
    ),
  );

  Widget _select(
    String label,
    String? value,
    List<DropdownMenuItem<String>> items,
    ValueChanged<String?>? onChanged,
    String? error,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      DropdownButtonFormField<String>(
        initialValue: value,
        key: ValueKey('$label:$value'),
        isExpanded: true,
        hint: const Text('Vui lòng chọn'),
        items: items,
        onChanged: onChanged,
        decoration: InputDecoration(errorText: error),
      ),
    ],
  );

  Widget _submitButton() => Container(
    color: AppColors.white,
    padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
    child: ElevatedButton(
      onPressed: _submitting ? null : _submit,
      style: ElevatedButton.styleFrom(
        minimumSize: const Size(double.infinity, 52),
      ),
      child: _submitting
          ? const SizedBox(
              height: 22,
              width: 22,
              child: CircularProgressIndicator(
                color: Colors.white,
                strokeWidth: 2,
              ),
            )
          : const Text('GỬI YÊU CẦU'),
    ),
  );

  Widget _success() => Scaffold(
    body: SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.check_circle_rounded,
                color: AppColors.success,
                size: 68,
              ),
              const SizedBox(height: 18),
              const Text(
                'Đã tạo yêu cầu',
                style: TextStyle(fontSize: 23, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              Text(
                'Mã yêu cầu do hệ thống cấp: $_submittedCode',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 17,
                  color: AppColors.primaryBlue,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Yêu cầu đã được ghi nhận trực tuyến. Trung tâm chưa xác nhận đã nhận thiết bị.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => context.go(
                  '${AppRoutes.requests}/${Uri.encodeComponent(_submittedCode!)}',
                ),
                child: const Text('XEM CHI TIẾT YÊU CẦU'),
              ),
              TextButton(
                onPressed: () => context.go(AppRoutes.requests),
                child: const Text('XEM DANH SÁCH'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
