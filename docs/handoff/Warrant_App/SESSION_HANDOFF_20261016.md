# Bàn giao phiên kiểm thử CUSTOMER Mobile — 16/10/2026

## Đã xác minh trực tiếp

- Pixel_6 chạy App ở Real mode, URL `http://10.0.2.2:8081/api/v1`; tài khoản CUSTOMER `KH-000001` thấy thiết bị `TB-000001`.
- API `localhost:8081` có phiên SQL trong `TrungTamBaoHanhDB_Test_20261015`; Web `localhost:5174` proxy tới API 8081. Phải kiểm tra lại các đích này sau khi khởi động máy, trước mọi thao tác ghi mới.
- Báo giá mô phỏng `BG-2026-1016-00001` của phiếu `TN-2026-1016-00001` được duyệt nội bộ một lần: POST HTTP 200, `APPROVED`, quyết định khách lúc đó `PENDING`.
- App hiển thị dòng công thử nghiệm 100.000đ, VAT 8% là 8.000đ, tổng 108.000đ. Khách bấm Đồng ý và Xác nhận mỗi nút một lần trên App. App nhận phản hồi thành công, hiển thị `REPAIRING` và bỏ nút quyết định. Mã HTTP riêng của POST từ App không được ghi lại; không suy diễn mã từ giao diện.
- GET xác thực `/api/v1/portal/tickets/TN-2026-1016-00001` và `/api/v1/portal/my/tickets` đều HTTP 200 sau quyết định. SQL bản sao: báo giá `APPROVED/ACCEPTED`, phiếu `REPAIRING`, chủ `KH-000001`, thiết bị `TB-000001`, tổng 108.000đ. App mở lại phiếu vẫn hiển thị trạng thái này.
- DB gốc chỉ được đọc. Nó có **phiếu trùng mã** `TN-2026-1016-00001` của khách/thiết bị khác, trạng thái `RECEIVED`, và không có báo giá `BG-2026-1016-00001`. Không dùng riêng mã phiếu để phân biệt hai DB.

## Mã nguồn và kiểm tra

- Chỉ bổ sung dòng VAT báo giá trong `lib/views/requests/real_ticket_detail_screen.dart`; chỉnh fixture VAT và assertion tương ứng trong `test/real_tracking_test.dart`.
- `flutter test --no-pub test/real_tracking_test.dart`: 10/10 đạt. `flutter analyze --no-pub`: không có lỗi. `flutter run -d emulator-5554 --no-pub`: build và chạy được trên Pixel_6.
- Nhiều thay đổi khác đã có sẵn trong working tree; chưa commit/push. Không xóa hay reset chúng.

## Khi tiếp tục ngày mai

1. Mở lại API/Web/App nếu cần; kiểm tra health và **chứng minh lại** API 8081/Web 5174 dùng DB bản sao trước bất kỳ POST nghiệp vụ nào.
2. Kiểm tra `git status` và đọc lại backend contract trước khi sửa code hoặc thử nhánh nghiệp vụ khác.
3. **Không bấm Accept lại** cho báo giá này; nó đã `ACCEPTED`. `REPAIRING` là trạng thái backend sau quyết định, không chứng minh máy đã được sửa, thanh toán hoặc bàn giao.

Không lưu mật khẩu, token hay chuỗi kết nối trong ghi chú này.
