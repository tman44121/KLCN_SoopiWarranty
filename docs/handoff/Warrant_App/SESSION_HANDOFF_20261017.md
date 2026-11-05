# Bàn giao AppMobile — 17/10/2026

## Trạng thái đã kiểm tra hôm nay

- Nhánh AppMobile tại `e625cae`; working tree có nhiều thay đổi và file chưa theo dõi từ các lượt trước. Không reset, clean, commit hoặc push.
- Luồng phục hồi phiên Real khi App đang mở đã được xác minh ở lượt kiểm trước trong ngày: hai GET xác thực nhận 401 sau khi access token hết hạn, một refresh nhận 200, hai GET thử lại nhận 200; App vẫn đăng nhập. Không lặp chu kỳ này trong lượt kiểm lookup.
- Tra cứu CUSTOMER dùng `POST /api/v1/portal/lookup` với mã YC/TN và số điện thoại; backend trả cùng `404 PORTAL_NOT_FOUND` cho mã sai hoặc số không khớp, và `429 RATE_LIMITED` khi quá giới hạn. Lookup Serial của nhân viên không được App dùng.
- API `localhost:8081` health UP; PID `24168` trùng tiến trình đã được xác minh dùng `TrungTamBaoHanhDB_Test_20261015` ở lượt trước. Cần xác minh lại sau khi khởi động máy; health UP riêng lẻ không chứng minh đích DB.
- Đúng một lần tra cứu mã không tồn tại và một lần tra cứu mã có thật với số không khớp trên API 8081: cả hai nhận `404 PORTAL_NOT_FOUND`, không trả chi tiết khách hàng. Không ghi số điện thoại vào file này.

## Thay đổi AppMobile và kiểm tra

- `lib/views/devices/real_lookup_screen.dart`: chặn mã thiếu phần nội dung và số không đủ chữ số; thêm nút **Thử lại** cho lỗi mạng, giữ nguyên đầu vào và không báo sai là “không tìm thấy”.
- `test/real_lookup_screen_test.dart`: test widget cho form không gọi API khi sai, lỗi mạng rồi Retry thành công với đầu vào cũ, và thông báo 429 không lộ bản ghi.
- `test/real_lookup_decision_test.dart`: fixture 429 dùng đúng mã lỗi `RATE_LIMITED` của backend.
- `flutter test --no-pub test/real_lookup_screen_test.dart test/real_lookup_decision_test.dart`: 10 test đạt. `flutter analyze --no-pub`: không có lỗi. `git diff --check`: không có lỗi khoảng trắng.
- Chưa kiểm trực tiếp thao tác tắt mạng rồi bấm **Thử lại** trên Pixel_6 sau bản sửa; trường hợp đó mới được xác minh bằng test widget. Không chạy Android build hay sửa Mock/Web/backend/SQL trong lượt lookup.

## Khi tiếp tục

1. Kiểm tra `git status`, cấu hình Real và API/DB sau khi bật máy; giữ mọi thay đổi chưa commit.
2. Nếu cần xác minh trực quan trên Pixel_6, chạy bản App chứa thay đổi mới và thử một lần mất mạng → **Thử lại** với đầu vào hợp lệ; không in số điện thoại hoặc token.
3. Trước mọi thao tác ghi nghiệp vụ mới, chứng minh lại API/Web đang dùng đúng DB thử. Không lặp các POST đã hoàn tất hoặc tác động DB gốc.
