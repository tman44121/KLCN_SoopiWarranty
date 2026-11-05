# Bàn giao AppMobile — 19/10/2026

## Mốc công việc cuối ngày

- Đã sửa tra cứu Real cho CUSTOMER **đã đăng nhập**: nhập mã `YC-...` hoặc `TN-...`, không nhập số điện thoại. Mã YC gọi `GET /api/v1/portal/my/warranty-requests/{code}`; mã TN gọi `GET /api/v1/portal/tickets/{code}`. Backend kiểm tra quyền sở hữu và trả 404 nếu bản ghi không thuộc tài khoản. Màn hình này không còn gọi `POST /api/v1/portal/lookup` công khai.
- Nhãn đăng nhập đổi thành **Tên đăng nhập**, đúng với trường `Username` của backend. Không thêm SMS/OTP vào đăng nhập hoặc tra cứu. Giữ nguyên luồng Mock.
- Thay đổi trong `lib/views/devices/real_lookup_screen.dart`, `lib/views/devices/device_list_screen.dart`, `lib/views/auth/login_screen.dart`, `lib/models/portal_lookup_models.dart`, `test/real_lookup_screen_test.dart` và `test/login_base_url_test.dart`.

## Bằng chứng kiểm tra

- `flutter test --no-pub test/real_lookup_screen_test.dart test/login_base_url_test.dart`: **7 test đạt**. Kiểm tra mã YC/TN đi qua API GET của chủ sở hữu, lỗi 404, mất mạng/Retry, phản hồi 429 giả lập và nhãn đăng nhập.
- `flutter analyze --no-pub`: **No issues found**. `git diff --check`: đạt; Git chỉ in cảnh báo chuyển LF/CRLF, không có lỗi whitespace.
- Pixel_6 (`emulator-5554`): sau hot restart, màn hình Tra cứu Real chỉ còn một ô mã YC/TN. Nhập `TN-2026-1016-00001` đã hiển thị trạng thái backend `REPAIRING` mà không nhập điện thoại. Đây là kiểm tra đọc trên App; **không lưu mã trạng thái HTTP thô** của GET. Không thực hiện POST nghiệp vụ hay ghi DB.
- `GET http://localhost:8081/actuator/health` trả HTTP 200, `UP` trong phiên này. Health **không tự chứng minh** API đang trỏ DB nào; phải xác minh lại cấu hình/DB trước lần ghi tiếp theo. Kết quả phiếu trên App phù hợp dữ liệu TEST đã biết, nhưng trạng thái môi trường có thể đổi sau khi tắt máy.

## Git và dữ liệu cần giữ

- Nhánh `main` theo dõi `origin/main`; **chưa commit hoặc push** các thay đổi hôm nay.
- Sáu file mã nguồn/test nêu trên đang modified. Các mục `.agents/`, `PROJECT_REVIEW_CURRENT.md`, `SESSION_HANDOFF_20261016.md`, `SESSION_HANDOFF_20261017.md` đã untracked từ trước; giữ nguyên. File bàn giao này cũng chưa được commit.
- Không ghi mật khẩu, token, số điện thoại, chuỗi kết nối hoặc thông tin cá nhân vào file bàn giao.

## Giới hạn và điểm bắt đầu phiên sau

- Đăng ký **tài khoản** Real là luồng khác với gửi yêu cầu bảo hành/sửa chữa. Hợp đồng backend hiện vẫn yêu cầu số điện thoại/OTP cho đăng ký tài khoản; chưa thay đổi backend hay giả lập đăng ký thành công không cần SMS.
- Endpoint tra cứu công khai `POST /api/v1/portal/lookup` vẫn yêu cầu mã + điện thoại ở backend. Chỉ màn hình tra cứu Real của CUSTOMER đã đăng nhập được đổi sang API kiểm tra quyền sở hữu. Nếu cần tra cứu ẩn danh không dùng điện thoại, phải thiết kế lại cách xác minh quyền truy cập trước khi sửa.
- Khi tiếp tục: kiểm tra `git status`, xác minh lại Pixel_6, Base URL Real `http://10.0.2.2:8081/api/v1` và API 8081 trỏ đúng `TrungTamBaoHanhDB_Test_20261015` trước mọi thao tác ghi. Không dùng health UP làm bằng chứng duy nhất. Không cần lặp lại các POST nghiệp vụ đã kiểm thử.
