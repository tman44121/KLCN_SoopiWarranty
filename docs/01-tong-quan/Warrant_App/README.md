# Soopi — Ứng dụng bảo hành điện tử

Ứng dụng Flutter dành cho khách hàng của hệ thống Soopi: quản lý thiết bị, gửi yêu cầu bảo hành, theo dõi sửa chữa và phản hồi báo giá. Giao diện sử dụng tiếng Việt và bộ nhận diện Soopi.

Tên package Dart hiện tại là `warrant_safe`; một số class và định danh nền tảng vẫn giữ tên WarrantSafe.
Ứng dụng nằm trong thư mục `Warrant_App/` của repository Soopi, bên cạnh `backend-dotnet/` và `frontend-react/`.
Giữ nguyên tên thư mục, package, class và định danh nền tảng. Hướng dẫn này nằm trong `docs/01-tong-quan/Warrant_App/`;
các lệnh Flutter bên dưới chạy tại thư mục mã nguồn `Warrant_App/`.

## Chức năng

- **Tài khoản:** đăng nhập, lưu và khôi phục phiên, đăng xuất; đăng ký và đặt lại mật khẩu bằng OTP email; sửa hồ sơ và đổi mật khẩu.
- **Trang chủ:** tổng quan thiết bị, yêu cầu và báo giá cần phản hồi.
- **Thiết bị:** xem danh sách thiết bị của khách hàng và chi tiết bảo hành; tạo yêu cầu từ thiết bị đã có.
- **Yêu cầu bảo hành:** tạo yêu cầu từ thiết bị có sẵn hoặc nhập thông tin thiết bị mới, chọn trạm tiếp nhận và thời gian mong muốn, đính kèm ảnh/video.
- **Theo dõi:** xem yêu cầu, phiếu tiếp nhận/sửa chữa, tiến trình và báo giá; xác nhận đồng ý hoặc từ chối báo giá.
- **Tra cứu:** Serial/IMEI qua thông tin bảo hành công khai và mã YC/TN qua các API kiểm tra quyền sở hữu.
- **Thông báo:** hộp thư trong ứng dụng, số chưa đọc, đánh dấu đã đọc và mở phiếu liên quan.

Tệp đính kèm là tùy chọn, tối đa 3 tệp: JPEG/PNG/WebP tối đa 5 MiB mỗi ảnh hoặc MP4 tối đa 30 MiB mỗi video. Máy chủ tiếp tục kiểm tra nội dung tệp.

## Công nghệ và cấu trúc

| Thành phần | Sử dụng |
| --- | --- |
| Flutter / Dart | Giao diện đa nền tảng |
| Provider / ChangeNotifier | Quản lý trạng thái qua ViewModel |
| GoRouter | Điều hướng và chuyển hướng theo trạng thái đăng nhập |
| Dio | Gọi API, Bearer token và xử lý lỗi mạng |
| flutter_secure_storage | Lưu access token, refresh token và định danh phiên |
| shared_preferences | Lưu Base URL khi debug |
| file_picker | Chọn tệp đính kèm |
| google_fonts | Phông chữ giao diện |

```text
lib/
├── main.dart          # Khởi tạo ứng dụng, Provider và Router
├── models/            # Tài khoản, thiết bị, yêu cầu, phiếu và thông báo
├── router/            # Route và kiểm soát truy cập theo phiên
├── services/          # Hợp đồng API, client Dio, lưu phiên
├── theme/             # Màu sắc, typography và theme Soopi
├── viewmodels/        # Trạng thái xác thực, yêu cầu và phiếu sửa chữa
├── views/             # Màn hình theo từng chức năng
└── widgets/           # Thành phần giao diện dùng chung
assets/brand/          # Logo và wordmark Soopi
test/                  # Unit test và widget test
web_dev_config.yaml    # Máy chủ Web debug và proxy API cục bộ
```

`AuthViewModel` gọi backend qua `RealApiService` (hợp đồng `IApiService`); test thay bằng `test/support/fake_api_service.dart` hoặc fake riêng của từng file. Router giữ màn hình khởi động trong lúc khôi phục phiên và yêu cầu đăng nhập trước khi vào các tab chính.

## Yêu cầu môi trường

- Flutter stable có Dart tương thích với các phiên bản trong `pubspec.lock`. Lockfile hiện yêu cầu **Flutter >= 3.47.0, Dart >= 3.13.0 và < 4.0.0**; môi trường kiểm tra sử dụng Flutter 3.47.8 / Dart 3.13.7.
- Chrome hoặc Edge để chạy Web; Android SDK và emulator/thiết bị để chạy Android.
- JDK 17 tương thích với cấu hình Java/Kotlin của dự án Android.
- Backend Soopi tương thích với các endpoint bên dưới.

Repository có thư mục nền tảng Android, iOS, Web, Windows, macOS và Linux. Việc có thư mục nền tảng không thay thế kiểm thử trên từng hệ điều hành.

## Cài đặt và chạy nhanh

```sh
# Từ thư mục gốc warranty-system-soopi
cd Warrant_App
flutter doctor
flutter pub get
flutter devices
```

Chạy Web:

```sh
flutter run -d chrome
```

Có thể thay `chrome` bằng `edge`. File `web_dev_config.yaml` cấu hình địa chỉ `http://localhost:5175` và chuyển tiếp `/api/*` sang backend `http://localhost:8080/`.

Chạy Android hoặc một thiết bị khác trong kết quả `flutter devices`:

```sh
flutter run -d <device-id>
```

### Kết nối backend Soopi

1. Khởi động backend riêng; cấu hình phát triển hiện tại hướng tới cổng `8080`.
2. Bản debug: tại màn hình đăng nhập, nhấn giữ logo để mở **Máy chủ API (bản debug)**, kiểm tra **Base URL**, sửa nếu cần và bấm **Áp dụng Base URL**.
3. Đăng nhập bằng số điện thoại/tên đăng nhập của tài khoản khách hàng trên backend, hoặc đăng ký bằng OTP email.

| Nơi chạy ứng dụng | Base URL khi phát triển |
| --- | --- |
| Web qua cấu hình có sẵn | `http://localhost:5175/api/v1` — proxy đến backend cổng `8080` |
| Android emulator | `http://10.0.2.2:8080/api/v1` |
| Windows/macOS/Linux trên máy chạy backend | Đặt thủ công `http://localhost:8080/api/v1` |
| Điện thoại thật cùng mạng | Đặt `http://<IP-LAN-may-chay-backend>:8080/api/v1` |

Base URL phải có giao thức `http`/`https`, host và path đúng `/api/v1`. Mặc định debug của Web dùng origin hiện tại; các nền tảng khác mặc định dùng địa chỉ Android emulator. Nếu đã lưu Base URL cũ, giá trị đó được ưu tiên hơn mặc định và `--dart-define` trong bản debug.

Có thể cung cấp cấu hình lúc chạy:

```sh
flutter run -d <device-id> --dart-define=API_URL=http://10.0.2.2:8080/api/v1
```

Các lệnh ghi như gửi yêu cầu và quyết định báo giá không được tự động gửi lại khi lỗi mạng; hãy kiểm tra danh sách/trạng thái trước khi thao tác lại.

## API ứng dụng sử dụng

Các đường dẫn dưới đây tương đối so với Base URL `/api/v1`. Chi tiết request/response nằm trong `lib/services/real_api_service.dart` và `lib/models/`.

| Phương thức | Đường dẫn | Mục đích |
| --- | --- | --- |
| POST | `/auth/mobile/login`, `/auth/mobile/refresh`, `/auth/mobile/logout` | Quản lý phiên |
| POST | `/auth/mobile/otp`, `/auth/mobile/register` | OTP và đăng ký |
| POST | `/auth/mobile/password-reset/verify`, `/auth/mobile/password-reset` | Xác minh OTP và đổi mật khẩu |
| GET | `/portal/my/profile`, `/portal/my/devices` | Hồ sơ và thiết bị của khách hàng |
| GET | `/portal/catalog` | Danh mục thiết bị và trạm |
| GET / POST | `/portal/my/warranty-requests` | Danh sách / tạo yêu cầu bằng multipart |
| GET | `/portal/my/warranty-requests/{code}` | Chi tiết yêu cầu của khách hàng |
| GET | `/portal/my/tickets`, `/portal/tickets/{code}` | Danh sách và chi tiết phiếu |
| POST | `/portal/tickets/{code}/quotation-decision` | Phản hồi báo giá |
| GET | `/notifications` | Hộp thư và số chưa đọc |
| POST | `/notifications/{id}/read` | Đánh dấu đã đọc |

Service còn có luồng cấp quyền tra cứu giới hạn qua `POST /portal/lookup`; lựa chọn mã YC/TN trên màn hình tra cứu Real dùng phiên đăng nhập và các API đọc yêu cầu/phiếu, không yêu cầu nhập số điện thoại để tra cứu.

Trong màn hình Tra cứu, chọn **Serial / IMEI** để xem hạn bảo hành, số ngày còn
lại, số lần tiếp nhận và tình trạng đang xử lý. `GET /portal/warranty-check?serial=...`
không gửi Bearer và không kích hoạt refresh phiên; kết quả không chứa chủ máy,
mã phiếu hay nội dung sửa chữa. Chọn **Mã YC / TN** để xem chi tiết hồ sơ của
chính tài khoản. Số Serial được chuẩn hóa bỏ khoảng trắng và chuyển chữ hoa;
không tự tính lại tình trạng bảo hành theo đồng hồ điện thoại.

Phản hồi hồ sơ chỉ được áp dụng khi vẫn cùng phiên, tài khoản và cấu hình API; dữ liệu/lỗi đến trễ sau đăng xuất
không ghi đè phiên mới. GET và các POST cần đăng nhập dùng chung một lượt refresh khi nhận 401, rồi thử lại tối đa
một lần. Gửi yêu cầu bảo hành tạo lại multipart và luồng tệp cho lần thử lại. Timeout, lỗi mạng, lỗi nghiệp vụ
hoặc lỗi máy chủ không tự gửi lại POST vì thao tác trước có thể đã được lưu. Login/refresh/logout không tự refresh
và không gửi kèm Bearer cũ; đăng xuất tách lượt refresh đang chờ khỏi phiên mới.

## Kiểm tra

```sh
flutter analyze
flutter test
```

Các test hiện có bao phủ phân tích dữ liệu API, khôi phục/refresh phiên, OTP email, cấu hình đăng nhập, hồ sơ và đổi mật khẩu, tạo yêu cầu, đính kèm, tra cứu, theo dõi phiếu, quyết định báo giá và trạng thái/điều hướng thông báo. Các test sử dụng dữ liệu và bộ giả lập API, không chứng minh việc tích hợp với backend đang chạy.

Job `flutter` trong [CI](../../../.github/workflows/ci.yml) dùng Flutter stable `3.47.8`, cài dependency
với `flutter pub get --enforce-lockfile`, chạy analyze, toàn bộ test và build Web release. Deploy chờ job này đạt.
Build CI dùng `API_URL=https://ci.invalid/api/v1` chỉ để kiểm tra biên dịch; không gọi API, không triển khai mobile
và không thay thế build phát hành với địa chỉ backend thực tế. Cấu hình action theo
[hướng dẫn flutter-action](https://github.com/subosito/flutter-action), cố định action bằng commit SHA.

### Android SDK trên máy phát triển Windows

Môi trường local đã được cài Android command-line tools từ
[Google](https://developer.android.com/studio#command-tools), platform Android 36, Build-Tools `36.0.0`,
Platform-Tools, NDK `28.2.13676358` và CMake `3.22.1`. SDK đặt tại
`%USERPROFILE%\development\android-sdk`; JDK Temurin 21 đặt tại `%USERPROFILE%\development\jdk-21`.
Cả hai archive được kiểm SHA-256 trước khi cài. Flutter dùng JDK riêng; không đổi `JAVA_HOME` Java 25 của máy.

Đường dẫn đã lưu trong cấu hình Flutter, `ANDROID_HOME` và PATH người dùng. Mở lại terminal/editor để nhận PATH mới.
Khi cần cấu hình lại trên máy đã có các thư mục này, chạy PowerShell:

```powershell
flutter config --android-sdk="$env:USERPROFILE\development\android-sdk"
flutter config --jdk-dir="$env:USERPROFILE\development\jdk-21"
flutter doctor -v
```

`flutter doctor` đã xác nhận Android toolchain và các license. Máy đã cài emulator và system image Google APIs
Android 36 x86_64; hai AVD thử riêng là `Soopi_Audit_Phone` và `Soopi_Audit_Tablet`, lưu tại
`%USERPROFILE%\development\android-avd`. Chạy từng AVD để tránh thiếu RAM. Chưa kiểm trên điện thoại vật lý.
Các cảnh báo Chrome/Visual Studio desktop là môi trường riêng.

### Giao diện mobile sau audit

- Cửa sổ dưới 600dp dùng thanh tab tăng chiều cao theo chữ; từ 600dp dùng Material NavigationRail có thể cuộn.
  Chọn hoặc bấm lại tab giữ màn hình con và dữ liệu đang soạn. Trạng thái tab được công bố qua semantics.
- Back trong form tạo yêu cầu thật hỏi trước khi bỏ nội dung đã đổi; form trống thoát bình thường.
  Trong lúc gửi, Back yêu cầu chờ kết quả; xác nhận bỏ thay đổi không gửi thêm request.
- Font Inter, Plus Jakarta Sans và JetBrains Mono được đóng gói trong `Warrant_App/assets/fonts/`,
  kèm giấy phép OFL và đăng ký LicenseRegistry. GoogleFonts không tải font qua mạng lúc chạy.
- Kiểm thử regression bao phủ cỡ chữ 100%/200%, cửa sổ hẹp/rộng, vùng chạm, tương phản, semantics,
  giữ màn hình con, bảo vệ nội dung và font assets. Bằng chứng và giới hạn nằm trong
  [audit mobile](../../06-design/Warrant_App/UI_AUDIT.md).

## Build bản release

Bản release bắt buộc cung cấp `API_URL` có **HTTPS**, host hợp lệ và path chính xác `/api/v1`. Thay tên miền ví dụ bằng backend thực tế:

```sh
flutter build apk --release --dart-define=API_URL=https://api.example.com/api/v1
flutter build web --release --dart-define=API_URL=https://api.example.com/api/v1
```

Bản APK/AAB phát hành được ký bằng keystore riêng: tạo `android/key.properties` (không commit) với
`storeFile`, `storePassword`, `keyAlias`, `keyPassword`. Thiếu file này, `build.gradle.kts` dùng khóa debug
để vẫn build được trên máy cá nhân, nhưng bản đó không dùng để phát hành.

- APK: `build/app/outputs/flutter-apk/app-release.apk`.
- Web: `build/web/`. Proxy trong `web_dev_config.yaml` chỉ áp dụng khi phát triển; khi triển khai cần cấu hình reverse proxy hoặc CORS phù hợp trên backend.
- Android release hiện vẫn dùng **debug signing** trong `android/app/build.gradle.kts`; cần cấu hình khóa ký phát hành trước khi phân phối chính thức.

## Xử lý lỗi thường gặp

- **Windows báo thiếu quyền symlink plugin:** Flutter yêu cầu Developer Mode hoặc quyền tạo symlink cho phần
  plugin desktop. Đây là yêu cầu môi trường, không phải tên package hay vị trí source. Không đưa thư mục
  `windows/flutter/ephemeral/` hoặc các liên kết package cache vào Git.
- **Kotlin báo `this and base files have different roots`:** project ở ổ D: còn Pub cache ở ổ C: làm cache Kotlin
  không chuyển được đường dẫn tương đối. `android/gradle.properties` đặt `kotlin.incremental=false` theo
  [tài liệu Kotlin](https://kotlinlang.org/docs/gradle-compilation-and-caches.html) để biên dịch Kotlin đầy đủ.
  Kiểm tra mã vẫn chạy; lượt biên dịch Kotlin có thể chậm hơn. Bật lại khi project và Pub cache cùng ổ đĩa.
- **Không kết nối được API:** kiểm tra backend, Base URL đã lưu, cổng `8080` và địa chỉ phù hợp với emulator/thiết bị thật. `localhost` trên điện thoại là chính điện thoại đó.
- **Web lỗi CORS hoặc gọi nhầm cổng:** chạy từ thư mục dự án để Flutter đọc `web_dev_config.yaml`, rồi đặt Base URL về origin hiện tại kèm `/api/v1`.
- **Release báo thiếu/sai `API_URL`:** build lại với `--dart-define=API_URL=https://<host>/api/v1`; không dùng HTTP hoặc thêm dấu `/` sau `/api/v1`.
- **Không nhận OTP:** kiểm tra tài khoản, email và cấu hình gửi thư trên backend.
- **Gửi yêu cầu bị timeout:** kiểm tra danh sách yêu cầu trước khi gửi lại để tránh tạo trùng.
- **Mất mạng lúc khôi phục phiên:** ứng dụng giữ phiên khi lỗi tạm thời và cho phép thử lại; phiên bị backend từ chối mới bị xóa.
