# Báo cáo Hiện trạng Dự án WarrantSafe Mobile App

> **Tài liệu lịch sử từ mobile trước khi gộp.** Các nhận xét bên dưới về API chưa nối, endpoint và SDK
> mô tả thời điểm lập báo cáo, không phải trạng thái mã hiện tại. Xem
> [README mobile](../../01-tong-quan/Warrant_App/README.md) để chạy ứng dụng và
> [bàn giao tích hợp](../INTEGRATION_2026-11-04.md) để xem kết quả chín mục audit, kiểm thử và giới hạn còn lại.

## 1. Tổng quan dự án
- **Công nghệ & Phiên bản**: Dự án sử dụng Flutter (SDK `^3.10.7`, Flutter 3.38.7).
- **Kiến trúc & Quản lý trạng thái**: Sử dụng `provider` (^6.1.2) cho State Management (như `AuthViewModel`) và `go_router` (^14.0.0) cho điều hướng có cấu trúc nested routing (như `StatefulShellRoute` trong `main_shell.dart`).
- **Thư viện quan trọng**: `dio` cho HTTP client, `flutter_secure_storage` để lưu token an toàn.
- **Cách chạy**: Dự án có thể chạy trực tiếp bằng lệnh `flutter run`. Hiện tại code đã hoàn toàn pass kiểm tra từ công cụ `flutter analyze`.

## 2. Danh sách toàn bộ màn hình hiện có

| Tên màn hình | Route | File (trong `lib/views/`) | Nguồn dữ liệu | Trạng thái |
|---|---|---|---|---|
| Splash Screen | `/splash` | `splash/splash_screen.dart` | `AuthViewModel` state | Đang hoạt động |
| Login | `/login` | `auth/login_screen.dart` | Mock/API tuỳ mode | Đang hoạt động |
| Register | `/register` | `auth/register_screen.dart` | Mock/API tuỳ mode | Đang hoạt động |
| Main Shell (Tabs) | `/` | `shell/main_shell.dart` | Tab navigation state | Đang hoạt động |
| Home (Trang chủ) | `/home` | `home/home_screen.dart` | `MockRequest` | Đang hoạt động |
| Device List | `/devices` | `devices/device_list_screen.dart` | `MockDevice` | Đang hoạt động |
| Device Detail | `/devices/:id` | `devices/device_detail_screen.dart` | `MockDevice` | Đang hoạt động |
| Lookup Serial | `/devices/lookup` | `devices/lookup_screen.dart` | Mock UI validation | Đang hoạt động |
| Request List | `/requests` | `requests/request_list_screen.dart` | `MockRequest` | Đang hoạt động |
| Request Detail | `/requests/:id` | `requests/request_detail_screen.dart` | `MockRequest` | Đang hoạt động |
| Ticket Detail | `/requests/:id/ticket`| `requests/ticket_detail_screen.dart` | `MockRequest` | Đang hoạt động (timeline mockup) |
| Quotation | `/requests/:id/ticket/quote`| `requests/quotation_detail_screen.dart` | `MockQuotation` | Đang hoạt động (mock mutate state) |
| Notification | `/notifications` | `notifications/notification_screen.dart`| `MockNotification` | Đang hoạt động (tương tác đánh dấu đã đọc) |
| Profile | `/profile` | `profile/profile_screen.dart` | `AuthViewModel` | Đang hoạt động |

*Ghi chú: Toàn bộ dữ liệu hiển thị hiện đang lấy từ file `lib/data/mock_data.dart` ngoại trừ luồng auth có thể cắm service thật nhưng đang để ở MockApiService.*

## 3. Các luồng người dùng
- **Đăng nhập/Đăng ký**: Cho phép đăng nhập/đăng ký với dữ liệu cố định giả lập, nút Submit có loading state và lưu token giả vào secure storage.
- **Xem danh sách/chi tiết Thiết bị & Yêu cầu**: Hoạt động mượt mà. Dữ liệu tính toán hạn bảo hành hợp lệ, giao diện hiển thị badge tương ứng với DB logic.
- **Tra cứu Serial/IMEI**: Hoạt động dưới dạng validate regex và mock loading. (Đã xử lý tìm thấy hoặc không tìm thấy).
- **Gửi Yêu cầu bảo hành (Tạo mới)**: Giao diện cho phép chọn ảnh offline, nhập form nhưng khi gửi chỉ sinh ra delay giả lập rồi hiện success screen, không có call backend.
- **Theo dõi Tiến trình phiếu (Ticket) & Báo giá**:
  - Khi xem ticket chờ xác nhận, nút "Xem báo giá" điều hướng sang luồng Quotation.
  - Form báo giá có nút xác nhận và từ chối (với dialog bắt nhập lý do).
  - Dữ liệu bị thay đổi tạm thời trên RAM (setState mock list) để phản hồi lại màn hình timeline.

## 4. Dữ liệu và API
- **Model / Service**: Dự án có `UserModel`, `IApiService`, `MockApiService`, và `RealApiService`.
- **Mức độ kết nối**: Chưa hề kết nối backend thật đối với các module chính (Device, Request, Quotation...).
- **RealApiService**: Lớp `RealApiService` (sử dụng base URL `https://api.warrantsafe.com/v1`) **đã được viết** (có các hàm login, register, getProfile) nhưng **chưa được dùng thật**, app vẫn khởi tạo `MockApiService()` trong `AuthViewModel`.
- Nơi tạo dữ liệu mẫu chính nằm ở: `lib/data/mock_data.dart`.

## 5. Đối chiếu backend Soopi
Thư mục backend Soopi đã có trong workspace (`Web/KLCN_SoopiWarranty-main`).
Dựa vào `docs/02-ky-thuat/API.md`, `AuthController.cs` và `PortalRequestFileControllers.cs`:

| Chức năng Mobile | Endpoint API theo Swagger/Backend | Tình trạng khớp Contract |
|---|---|---|
| Đăng nhập (Khách) | `POST /api/v1/auth/mobile/login` | Chưa nối. Mismatch: `MobileLoginBody` cần `{username, password}` (hiện tại RealApiService đang truyền `email`). Response backend trả `MobileAuthResponse` (có refreshToken), model app chưa hỗ trợ. |
| Danh sách Thiết bị | `GET /api/v1/portal/my/devices` | Chưa nối. Chưa có code phía mobile cho API này. |
| Profile cá nhân | `GET /api/v1/portal/my/profile` | Chưa nối. Mismatch: `RealApiService` đang gọi `GET /users/$userId` thay vì `/portal/my/profile`. |
| Danh sách Yêu cầu | `GET /api/v1/portal/my/warranty-requests` | Chưa nối. |
| Đăng ký (Register) | `POST /api/v1/auth/mobile/register` (thông qua OTP) | Chưa nối. App mobile hiện gửi `POST /auth/register` không qua OTP. |
| Tạo yêu cầu | `POST /api/v1/portal/my/warranty-requests` | Chưa nối. Yêu cầu gửi `multipart/form-data` gồm `data` và `files`, mobile chưa implement luồng Dio upload này. |

## 6. Chất lượng hiện tại
- **Lỗi Analyze**: App không có lỗi phân tích. Lệnh `flutter analyze` báo 0 issues.
- **Rủi ro code**:
  - Giao diện có tổ chức khá tốt, đáp ứng responsive (SafeArea, cuộn SingleChildScrollView tránh tràn màn hình khi mở keyboard).
  - Lỗi thiết kế tương tác: Hiện app không có cách "Logout" nếu token thực sự hết hạn do chưa có logic gắn Refresh Token Interceptor trong Dio (`real_api_service.dart`). Backend trả lỗi `application/problem+json` nhưng error handler của Dio mới đang đọc data dạng `{message: ...}`, cần update logic lấy mảng `fieldErrors` và `detail`.

## 7. Việc cần làm tiếp theo
1. **Thiết lập Configurable BaseURL & Interceptors Dio**: Cập nhật `RealApiService` để đọc BaseURL động, sửa lại error handler để đọc chuẩn lỗi `application/problem+json` từ backend Soopi. Thêm nút gạt Mock/Real ở màn hình Login ẩn. (File: `real_api_service.dart`).
2. **Cập nhật luồng Login & Token Storage**: Tích hợp `POST /api/v1/auth/mobile/login`, đổi tham số truyền từ `email` sang `username`. Bổ sung lưu/sử dụng cả `refreshToken` trong `token_storage.dart`.
3. **Cập nhật hàm My Profile & My Devices**: Sửa `RealApiService` gọi `GET /api/v1/portal/my/profile` thay vì `/users/$userId`. Thêm hàm `getMyDevices()` để fetch từ `/api/v1/portal/my/devices`.
4. **Tích hợp Token Refresh & Logout**: Hiện thực API `POST /api/v1/auth/mobile/refresh` tự động gia hạn khi gặp lỗi 401, và gọi `POST /api/v1/auth/mobile/logout` thay vì chỉ xoá token local.
5. **Cập nhật các luồng Fetch (Request List / Details)**: Dần thay thế mock `MockRequest` bằng model map từ backend API (`RequestView`, `RequestSummary`).

---

### Tóm tắt tổng kết
Dự án app mobile hiện đã hoàn thiện gần như toàn bộ về mặt giao diện và trải nghiệm người dùng, từ luồng quản lý thiết bị, yêu cầu bảo hành cho đến theo dõi tiến trình và chốt báo giá. Tuy nhiên, toàn bộ luồng hoạt động này **đang dùng mock data** hoàn toàn (cả Auth lẫn Business flow). Việc kết nối API thật (`RealApiService`) mới chỉ có phần khung rỗng và sai endpoint contract so với backend Soopi. Việc nên làm đầu tiên ngay bây giờ là tích hợp luồng Auth cơ bản: thiết lập interceptor bắt lỗi chuẩn `application/problem+json`, sửa API Login/Logout cho đúng đường dẫn Mobile (`/api/v1/auth/mobile/login`), và bổ sung fetch dữ liệu Profile/Devices thật.
