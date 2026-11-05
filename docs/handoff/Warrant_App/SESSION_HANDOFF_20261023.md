# Bàn giao demo khách hàng Mobile — 23/10/2026

## Môi trường và ranh giới

- App Debug Real: `http://10.0.2.2:8081/api/v1` trên Pixel_6; API: `http://localhost:8081`; Web thử: `http://localhost:5174`.
- API và proxy Web đọc được thiết bị chỉ có trong `TrungTamBaoHanhDB_Test_20261015`: `TB-000006`, Serial `TESTAPP20261023`. SQL gốc không có Serial, yêu cầu hoặc phiếu mô phỏng mới.
- Truy vấn chỉ đọc DB gốc cho thấy yêu cầu cũ `YC-2026-1014-00001` **hiện** là `CONVERTED`, liên kết `TN-2026-1016-00001` ở `RECEIVED`. Tình trạng này khác ghi chú cũ nói còn chờ tiếp nhận; phiên kiểm thử này không ghi DB gốc và chưa xác minh ai/khi nào đã thay đổi yêu cầu cũ.
- TEST DB đã được sao lưu COPY_ONLY có CHECKSUM và RESTORE VERIFYONLY trước khi chạy `database/05_upgrade_existing_db.sql` và `database/06_chat.sql`. Bản sao lưu: `TrungTamBaoHanhDB_Test_20261015_pre_1d7ab50_20261023_002402.bak` trong thư mục Backup của SQL Server. Không chạy hai script này trên DB gốc.
- Tất cả tình trạng tiếp nhận, phụ kiện, chẩn đoán và báo giá trong ca này là **giả định kiểm thử** với dấu `KIEM_THU_MO_PHONG_DEMO_20261023`. Không có bàn giao hay kiểm tra MacBook thật.

## Dữ liệu cần giữ để demo

| Đối tượng | Mã | Trạng thái cuối đã đối chiếu với TEST SQL |
| --- | --- | --- |
| Khách / thiết bị mô phỏng | `KH-000001` / `TB-000006` | MacBook Air M2, chưa kích hoạt bảo hành |
| Yêu cầu gửi từ App | `YC-2026-1023-00001` | `CONVERTED` |
| Phiếu tiếp nhận từ luồng Web/API | `TN-2026-1023-00001` | `AWAITING_CUSTOMER_CONFIRMATION` |
| Báo giá chỉ có công sửa giả định | `BG-2026-1023-00001` | Duyệt nội bộ `APPROVED`; khách `PENDING` |

- Báo giá: linh kiện 0đ + công 100.000đ + VAT 8% = **108.000đ**. Đây là giá thử, không phải bảng giá dịch vụ chính thức.
- Backend tạo đúng một thông báo báo giá cho tài khoản khách. Đã mở thông báo đó trên App nên nó ở trạng thái đã đọc; badge còn 1 thông báo chưa đọc khác. Đây là **thông báo trong ứng dụng**, chưa xác minh Android push.
- Đã tắt hẳn và mở lại App: phiên Real khôi phục, Home đọc lại yêu cầu; thông báo mở được đúng phiếu và báo giá. Đã mở hộp xác nhận “Đồng ý” rồi chọn **Hủy**. SQL xác nhận quyết định khách vẫn `PENDING`.

## Kết quả HTTP và giới hạn kiểm thử

- Đăng ký thiết bị thử qua API: 201. Gửi yêu cầu qua App: màn hình trả mã server; không bắt raw HTTP status của POST App.
- Qua Web proxy 5174: tiếp nhận 201 → phân công 200 → chẩn đoán 200 → lập báo giá 201 → duyệt 200. Sau từng bước đã đọc lại API/TEST SQL. Các thao tác Web được gọi qua đúng proxy/API mà giao diện dùng; **chưa xác minh bằng thao tác nhấp trực tiếp trên từng màn hình Web**.
- App hiển thị đúng tổng, dòng công, VAT và hai nút quyết định. Nhánh Đồng ý/Từ chối **chưa bấm cho báo giá này**, để dành cho buổi demo. Không suy ra sửa xong, thanh toán hoặc bàn giao từ quyết định báo giá.
- Không sửa mã nguồn AppMobile, Web hoặc backend trong ca này. Lệnh `flutter test --no-pub` tập trung không trả output sau khoảng 100 giây khi `flutter run` đang mở; đã hủy, nên **không ghi là PASS**. Chưa chạy analyzer vì không có thay đổi code và công cụ test đang chờ.

## Cách tiếp tục an toàn sáng mai

1. Kiểm tra API 8081 và Web 5174 còn hướng tới TEST DB bằng cách tìm Serial `TESTAPP20261023` qua API/Web và xác nhận nó chỉ có trong TEST SQL; health UP riêng lẻ chưa đủ.
2. Dùng tài khoản CUSTOMER thử của `KH-000001` trên App Real. Mở **Thông báo → BG-2026-1023-00001** hoặc **Yêu cầu → TN-2026-1023-00001**. Thông báo đã đọc vẫn còn trong danh sách.
3. Trên Web thử, xem lịch sử yêu cầu/phiếu, phân công, chẩn đoán và báo giá theo các mã trên. Dữ liệu đã qua các bước này, nên **không bấm lại** thao tác ghi.
4. Khi trình diễn quyết định khách, chọn đúng **một** nhánh. Hộp xác nhận có mã và tổng tiền; sau khi xác nhận, tải lại App và so với TEST SQL. Với báo giá không có SKU này, backend quy định Đồng ý → `REPAIRING`; Từ chối → `AWAITING_RETURN`. Chỉ nói trạng thái hệ thống, không nói đã sửa/trả máy thật.
5. Nếu cần trình diễn toàn bộ thao tác tạo yêu cầu → tiếp nhận → phân công → báo giá từ đầu ngay trước mặt giảng viên, cần một thiết bị mô phỏng **khác** chưa có phiếu mở và một yêu cầu mới trên TEST DB. Không tái dùng `TB-000006` hoặc bấm lại POST của ca này.

Ảnh bằng chứng: `demo_evidence/2026-10-23/request_created.png`, `in_app_notification.png`, `quotation_after_cold_start.png`.

## Cập nhật cuối phiên 23/10 — vòng quay bên cạnh thông báo

- Người dùng xác nhận vòng quay bị kẹt nằm **ngay bên cạnh dòng thông báo** khi mở chi tiết báo giá; trước đây phải đăng xuất rồi vào lại để nó biến mất.
- Nguyên nhân xác định từ App: `RealNotificationContent._open()` chờ `context.push(path)` hoàn tất. Future này chỉ hoàn tất khi trang chi tiết được đóng, trong khi tab Thông báo vẫn được giữ trong `StatefulShellRoute.indexedStack`; vì vậy `_openingId` không được xóa khi khách đang xem hoặc quyết định báo giá. Đăng xuất tạo lại màn hình và chỉ che triệu chứng.
- Đã sửa **chỉ trong AppMobile**: `lib/views/notifications/real_notification_content.dart` dùng `context.go(path)` để điều hướng mà không giữ trạng thái mở; tải lại inbox/số chưa đọc bằng GET độc lập sau khi đánh dấu đã đọc. Không đổi endpoint, logic quyết định báo giá, Web, backend hay SQL.
- Thêm `test/notification_navigation_test.dart`: test tab Thông báo vẫn được giữ khi mở phiếu, nhưng không còn vòng quay ở dòng thông báo; quay lại thấy số chưa đọc do API giả lập trả về. Các test quyết định báo giá hiện có vẫn qua.
- Kiểm tra: `flutter test --no-pub test/notification_navigation_test.dart test/real_notification_test.dart test/real_tracking_test.dart` → **14/14 PASS**; `flutter analyze --no-pub` → **No issues found**; `git diff --check` cho file sửa → không có lỗi whitespace. Pixel_6 được `flutter devices` nhận diện và `GET http://localhost:8081/actuator/health` trả HTTP 200/UP ở thời điểm kiểm tra; health không chứng minh API đang trỏ DB nào.
- **Chưa kiểm chứng bản sửa mới trực tiếp trên Pixel_6** và không bấm Đồng ý/Từ chối lần nữa. Khi tiếp tục: hot reload hoặc khởi động lại App Debug để nạp mã mới, vào Real/8081, mở một thông báo báo giá **đã có** rồi quay về Thông báo, quan sát biểu tượng quay biến mất mà không cần đăng xuất. Không tạo hoặc lặp quyết định báo giá chỉ để kiểm thử UI.
- Git hiện ở nhánh `main`, HEAD `0aa52e7`; còn nhiều thay đổi đã stage/chưa stage từ công việc trước. Hai file của bản sửa này **chưa commit**, và chính file bàn giao này vẫn **untracked**. Giữ nguyên mọi thay đổi khác; chưa commit/push trong phiên này. Các trạng thái SQL ở phần trên là ảnh chụp từ ca demo trước, cần đọc lại từ TEST DB trước thao tác ghi ngày sau.
