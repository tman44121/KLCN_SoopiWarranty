# Nhật ký đăng nhập & Truy cập

Admin mở `/admin#access`. Cả controller và service chỉ chấp nhận vai trò ADMIN; quyền đọc nhật ký của điều phối
không cho phép xem thống kê tài khoản. Khách và mọi vai trò nội bộ khác đều bị từ chối.

## Mốc bắt đầu và lưu lịch sử

Mốc bắt đầu là **31/10/2026 theo giờ Việt Nam**, lưu trong `MocThongKeTruyCap`. Migration chạy lại không đổi mốc,
không xóa dữ liệu, không tạo lượt truy cập quá khứ. Các lượt thực tế được lưu từ khi chức năng được kích hoạt;
không thể khôi phục lượt truy cập chưa từng được ghi nhận trước đó.

`LuotTruyCap` lưu từng phiên sử dụng; `TruyCapTheoNgay` lưu mỗi cặp tài khoản/ngày có hoạt động. Hai bảng không bị
reset lúc nửa đêm, không có tác vụ tự xóa và không phụ thuộc vòng đời bảng RefreshToken. Khởi động lại backend,
làm mới trình duyệt và dọn token hết hạn không làm mất số liệu. Backup DB cũng phải bao gồm ba bảng thống kê này.

**Tổng lượt tích lũy** luôn đếm từ mốc bắt đầu đến hiện tại, theo bộ lọc tài khoản/vai trò. Chọn riêng một ngày chỉ
thay đổi **Lượt trong kỳ**, tài khoản hoạt động trong kỳ và nhật ký trong kỳ; không ghi đè tổng tích lũy.
Mặc định để trống ngày là toàn bộ lịch sử đến hôm nay. Người dùng có thể xem lại ngày/tháng/năm cũ về sau.

## Quy tắc đếm

- Lượt đăng nhập: ghi `AUTH_LOGIN_SUCCESS` sau khi cấp phiên thành công; có tính tự đăng nhập sau đăng ký OTP.
  Refresh token và cấp lại token sau đổi mật khẩu không tính thành lần đăng nhập mới.
- Thất bại: lấy sự kiện `AUTH_LOGIN_FAILED` đã ghi trong nhật ký xác thực. Tên chưa có tài khoản được đánh dấu
  chưa xác định, chỉ nằm trong bộ lọc tất cả, không gán nhầm vào nhân viên/khách hàng.
- Lượt truy cập: heartbeat đầu tiên của một phiên đăng nhập hoặc lần quay lại sau ít nhất 30 phút không có heartbeat.
  Dùng claim `sid` do server ký, giữ nguyên qua refresh. F5, đổi trang hoặc các tab dùng cùng phiên không tạo thêm lượt.
  Đăng nhập ở thiết bị khác tạo một phiên riêng; cùng tài khoản vẫn chỉ tính một tài khoản online.
- Lượt thuộc ngày bắt đầu phiên. Nếu phiên kéo qua nửa đêm, ngày mới có một tài khoản hoạt động nhưng không tạo
  lượt mới chỉ vì đổi ngày. Tổng tài khoản trong kỳ là số tài khoản khác nhau, không cộng trùng số tài khoản từng ngày.
- Heartbeat 30 giây/lần khi tab hiển thị và có mạng; online khi có tín hiệu trong 2 phút gần nhất, tài khoản và phiên
  refresh còn hoạt động. Đóng trình duyệt/mất mạng tự ngừng tính online sau thời hạn này.
- Đăng xuất kết thúc đúng họ token của thiết bị, ghi log một lần. Đăng xuất mọi thiết bị/đổi mật khẩu thu hồi các phiên
  liên quan. Access token cũ không thể tạo lại online sau khi phiên refresh bị thu hồi.
- Phiên access cũ chưa có `sid` tự refresh một lần để tương thích. Chỉ theo dõi người có tài khoản trên khu riêng và
  khi họ về trang chủ/portal còn mang access token; khách vãng lai/token tra cứu phiếu không được tính.
- Không thu thập IP, đường dẫn trang, mật khẩu hoặc token vào bảng thống kê mới. ID tài khoản truyền dạng chuỗi.

## Giao diện và xuất file

Sáu ô số liệu: tổng tích lũy, lượt trong kỳ, tài khoản trong kỳ, online hiện tại, đăng nhập thành công và thất bại.
Biểu đồ dùng tối đa 90 ngày có dữ liệu gần nhất trong kỳ; bảng ngày phân trang vẫn giữ toàn bộ dữ liệu. Ngày vắng dòng
tương ứng số liệu 0. Bảng online và lịch sử đăng nhập có phân trang, tìm tên/tài khoản/mã và lọc loại/vai trò.
Sự kiện chỉ lọc bảng nhật ký; ngày không lọc số online vì online luôn là hiện tại. Tự cập nhật 15 giây khi đang mở tab admin.

Excel gồm tổng quan, dữ liệu theo ngày và nhật ký đúng bộ lọc; tối đa 10.000 sự kiện mỗi file để giới hạn bộ nhớ.
Nếu vượt thì thu hẹp bộ lọc, không cắt âm thầm và không xóa dữ liệu. Các tên bắt đầu bằng `=` được ghi dạng text,
không thành công thức Excel. Lỗi API giữ số liệu cũ kèm thời điểm cập nhật và báo lỗi, không thay bằng số 0 giả.

## Cài đặt và kiểm tra

Database hiện có: chạy `database/07_access_statistics.sql` trước khi khởi động backend mới; schema mới và SQL ghép
đã chứa ba bảng. Trên DB dev cấu hình bằng User Secrets có thể áp dụng bằng:

```powershell
dotnet build verification/access-probe -o artifacts/access-probe-build
dotnet artifacts/access-probe-build/AccessProbe.dll --apply-schema
```

Kiểm thử tích hợp trên DB dev, không dùng production; mọi fixture và sự kiện thử được rollback:

```powershell
dotnet artifacts/access-probe-build/AccessProbe.dll
dotnet test backend-dotnet/tests/Soopi.Tests
npm --prefix frontend-react test
# Cần Vite và Playwright/Edge có sẵn; xem PLAYWRIGHT_PACKAGE trong scripts/smoke.mjs.
node frontend-react/scripts/access.mjs
```

API: `POST /api/v1/access/heartbeat`; admin đọc `GET /api/v1/admin/access/{summary,online,logs,export}`.
Bộ lọc: `from`, `to` (bao gồm hai đầu), `kind` (EMPLOYEE/CUSTOMER), `role`, `q`; online/logs hỗ trợ page/size 25/50/100,
nhật ký thêm `action` (AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILED, AUTH_LOGOUT, AUTH_LOGOUT_ALL).
