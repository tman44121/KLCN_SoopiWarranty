# Gộp mobile và tổ chức thư mục — 2026-11-04

Ứng dụng Flutter từ `../Warrant_App` được sao chép vào `Warrant_App/` của repository Soopi,
gồm cả chỉnh sửa và test chưa commit ở nguồn. Mốc Git nguồn: `787d39a`, nhánh
`codex/fix-lookup-mobile-overflow`. Thư mục nguồn và lịch sử Git nguồn giữ nguyên;
không mang `.git`, `.dart_tool`, build output, cấu hình máy hoặc bộ skill `.agents` vào mobile mới.
Repository chính quản lý mã mobile như các file thông thường.

Giữ nguyên tên `warranty-system-soopi`, `backend-dotnet`, `frontend-react`, `Warrant_App`,
package Dart `warrant_safe`, package web `soopi-frontend` và mọi định danh nền tảng.
Không nâng cấp dependency. Các thay đổi chưa commit của web, thiết kế và ERD được giữ lại khi chuyển vị trí.

Theo bố cục `Test-pro`, ứng dụng nằm cùng cấp ở gốc; tài liệu chia thành tám nhóm trong `docs/`.
Giữ tên file cũ, cập nhật đường dẫn Markdown, script sinh tài liệu/ảnh và hướng dẫn chạy.
README của mobile, web và verification chuyển vào nhóm tài liệu tương ứng.
`database/`, `deploy/`, `verification/`, `contract-snapshots/` và `experiments/` giữ nguyên tên.
`run.bat` và `.gitignore` giữ ở gốc để bảo toàn lệnh chạy và quy tắc Git.

API .NET mặc định `8080`, React `5173`, Flutter Web `5175`. Proxy web và mặc định Android emulator
của bản mobile trong monorepo đổi sang API `8080`. Base URL người dùng đã lưu trong debug vẫn được ưu tiên;
nếu còn lưu `8081`, sửa trong màn cấu hình thử nghiệm. Release vẫn yêu cầu `API_URL` HTTPS hợp lệ.

Chạy `python verification/check-layout.py` từ gốc để kiểm tên ứng dụng/package, nhóm tài liệu,
liên kết local và Git lồng. Kiểm thử chức năng theo từng ứng dụng; không khởi động API hoặc ghi database
chỉ để kiểm chứng việc gộp thư mục. Không tự commit/push thay đổi lần này.

## Kết quả kiểm tra lần nhập ngày 2026-11-04

- Cấu trúc: 3 ứng dụng, 8 nhóm tài liệu, 94 liên kết local hợp lệ; 129 file di chuyển giữ nguyên tên.
- Nguồn mobile gốc giữ nguyên theo SHA-256 của toàn bộ 201 file được nhập. Tệp package/lockfile và định danh
  Android/iOS/Windows trong bản sao giữ nguyên; chỉ cấu hình cổng API và đường dẫn tài liệu được cập nhật.
- Backend: 187/187 unit test đạt; không mở kết nối SQL Server để kiểm thử lần này.
- React: 29/29 test đạt, lint đạt, build production đạt. Build cảnh báo chỉ thị `use client` của React Router.
- Flutter 3.47.8 / Dart 3.13.7: `pub get --offline --enforce-lockfile` đạt; `flutter analyze --no-pub`
  không có lỗi; 137/137 test đạt; `flutter build web --no-pub` thành công.
- Flutter Web build JavaScript thành công; bước kiểm tra khả năng Wasm báo plugin dùng `dart:html`/`dart:js_util`
  chưa hỗ trợ Wasm. Chưa kiểm chứng bản Wasm, APK/iOS hoặc chạy trên điện thoại thật/API thật.
- ERD: 55 bảng, 97 khóa ngoại hợp lệ; ảnh và báo cáo nhị phân di chuyển khớp byte với bản trước khi chuyển.
- CI YAML/shell và `git diff --check` đạt. Chưa chạy GitHub Actions, commit hoặc push lần tổ chức này.

Windows hiện không cho tiến trình tạo symlink plugin desktop. Khi kiểm tra, dùng junction chỉ trong
`Warrant_App/windows/flutter/ephemeral/.plugin_symlinks` tới package cache; đây là dữ liệu sinh, bị Git bỏ qua.
Không đổi Developer Mode, quyền hệ thống hay Flutter SDK. Trên máy mới, Flutter có thể yêu cầu quyền symlink
theo hướng dẫn của công cụ. Bản build release để chạy thật vẫn cần `--dart-define=API_URL=https://<host>/api/v1`.

## Trạng thái audit sau gộp — cập nhật 2026-11-05

Đã xử lý đủ chín mục của lượt audit sau gộp; các kết quả ở trên là mốc nhập source, không phải số test hiện tại.

| Mục | Đã sửa | Kiểm chứng |
| --- | --- | --- |
| 1 | Yêu cầu/tệp đã gắn khách dùng `MaKH`; tái sử dụng SĐT không chuyển quyền; gộp khách chuyển cả yêu cầu | Ca SQL đổi SĐT, kiểm quyền tệp và gộp khách |
| 2 | Khóa và commit lượt OTP sai, kiểm hạn sau chờ khóa, tiêu mã một lần | Unit test OTP và SQL đoán/tiêu mã đồng thời |
| 3 | Khóa dòng tài khoản, đọc lại sau retry; không mất lượt đăng nhập sai | Unit test retry và SQL đăng nhập đồng thời |
| 4 | Hồ sơ, lỗi và loading cũ không ghi đè phiên mới, kể cả đăng nhập lại cùng tài khoản | Bốn ca `profile_session_scope_test.dart` |
| 5 | POST được refresh một lần sau 401; tạo lại multipart; không tự gửi lại timeout/409/5xx | Ca refresh POST, luồng tệp, quyết định báo giá và đổi phiên |
| 6 | Kiểm quyền trên metadata trước khi đọc nội dung tệp | Tám ca quyền khách/kỹ thuật/portal, tệp khóa, đường dẫn sai và tệp thiếu |
| 7 | CI có job Flutter; deploy chờ analyze/test/build Web đạt | actionlint, YAML, các lệnh Flutter tương ứng tại local |
| 8 | Bỏ hàm interceptor rỗng cùng lời gọi | Analyze và bộ test Real API |
| 9 | Gộp hai nhánh thiếu refresh token giống nhau; giữ vùng lưu phiên của chế độ khác | Bốn ca Mock/Real có/không có access token |

Chi tiết triển khai và giới hạn nằm tại D-058, D-059, D-060 trong
[DECISIONS](../02-ky-thuat/DECISIONS.md).

Kiểm lại tại local ngày 2026-11-05: backend đạt 204 unit test; React đạt 29 test, lint và build production.
Flutter đạt 156 test, analyze không có lỗi và build Web release thành công. Kiểm tra mở bản Flutter release
trên Edge ở 360px và 1440px đạt: có màn đăng nhập, không hiện chế độ Mock, không lỗi JavaScript và không gọi API.
Mười ba ca SQL đã đạt trên `_Dev` trong lượt sửa D-059. Sau khi người dùng bật Docker ngày 2026-11-05,
đã chạy lại đủ 13 ca trên SQL Server 2022 trong container mới, database `SoopiIntegrationTests`, mật khẩu ngẫu nhiên
và cổng loopback tự cấp. Tất cả đạt, container đã được dọn theo nhãn sở hữu; không ghi vào database local có sẵn.

Toàn bộ tám script trong `npm run test:ui` đạt trên Edge với API giả lập: chọn trạng thái kỹ thuật,
chọn thanh toán thu ngân, tương tác/khả năng truy cập, báo giá/thanh toán, smoke các vai trò, màn khách hàng,
xuất Excel và phân quyền quản trị. Trong đó smoke có 158 kiểm tra trên 13 trang; màn khách có 159 kiểm tra,
xuất báo cáo có 85 và phân quyền quản trị có 54. Không ghi database hoặc thay tài khoản thật.
`npm audit --audit-level=high` báo 0 lỗ hổng; 13 test triển khai/rollback đạt. Cấu trúc và 98 liên kết local
hợp lệ; `git diff --check` đạt. Các server tạm dùng kiểm thử đã được dừng sau khi kiểm xong.

Các giới hạn môi trường đã xác minh:

- Chưa chạy ứng dụng trên Android thật hoặc AVD; máy chưa có system image/AVD và chưa kết nối điện thoại.
- CI mới chưa chạy trên GitHub vì source hiện tại chưa commit/push. Lần CI đã đạt trên GitHub thuộc commit cũ
  `ad42a61`, không chứng minh cho thay đổi hiện tại.
- Chưa kiểm bản Wasm; plugin lưu token Web hiện còn dùng `dart:html`/`dart:js_util`. Bản Web JavaScript đã đạt.
- Android release vẫn dùng debug signing; cần khóa ký phát hành thực tế trước khi phân phối. Chưa tạo/thay khóa ký.

Không tự commit/push hoặc thay dữ liệu ngoài phạm vi kiểm thử. Android SDK được cài theo yêu cầu trực tiếp
của người dùng ngày 2026-11-05, như mục dưới.

## Bổ sung Android toolchain — 2026-11-05

- SDK: `%USERPROFILE%\development\android-sdk`; command-line tools `22.0`, platform Android 36,
  Build-Tools `36.0.0`, Platform-Tools `37.0.1`, NDK `28.2.13676358`, CMake `3.22.1`.
- JDK Temurin `21.0.13+9`: `%USERPROFILE%\development\jdk-21`. Archive JDK và tools Google đều khớp SHA-256
  của nhà phát hành trước khi giải nén. SDK/installer/cache nằm ngoài repository.
- Flutter đã lưu `android-sdk` và `jdk-dir`; `ANDROID_HOME` và PATH người dùng đã được thêm đường dẫn SDK.
  Không đổi `JAVA_HOME` Java 25 hoặc tên package/định danh ứng dụng. Terminal/editor đang mở cần khởi động lại
  để nhận PATH mới. `flutter doctor -v` xác nhận Android toolchain đạt và license đã chấp nhận.
- Lần build Android đầu tiên, Flutter tự thêm `android.builtInKotlin=false` và `android.newDsl=false`
  vào `Warrant_App/android/gradle.properties`. Giữ cờ tương thích do SDK sinh; không nâng AGP/Gradle/Kotlin.
- Gradle tự cài thêm Platform 34/35 và Build-Tools `35.0.0` mà plugin yêu cầu. Lần build đầu ghi lỗi cache
  Kotlin ở file_picker/shared_preferences do Pub cache trên C: còn project trên D:, sau đó compiler dùng fallback.
  Đặt `kotlin.incremental=false` trong ứng dụng để biên dịch đầy đủ, không đổi vị trí project/cache hoặc tắt kiểm tra
  compiler. Chấp nhận lượt biên dịch Kotlin chậm hơn; bật lại khi hai bên cùng ổ hoặc compiler sửa được lỗi này.
- Đã ép biên dịch lại hai task `file_picker:compileReleaseKotlin` và
  `shared_preferences_android:compileReleaseKotlin` với `--rerun-tasks`: 24 task thực thi, build đạt,
  không còn lỗi cache khác ổ/daemon compilation. Sau đó `flutter build apk --release --no-pub
  --dart-define=API_URL=https://ci.invalid/api/v1` đạt, không còn lỗi cache Kotlin trong log.
- APK kiểm chứng: `Warrant_App/build/app/outputs/flutter-apk/app-release.apk`, 57.236.783 byte
  (Flutter hiển thị 54,6 MB). Đã kiểm bằng `aapt`/`apksigner`: package `com.warrantsafe.warrant_safe`,
  min SDK 24, target SDK 36, chữ ký Android Debug hợp lệ. SHA-256:
  `DF7DB118E53567145E89D592C1101457C97306686C895E5B2AF3F5CE967898B2`.
  URL `ci.invalid` và debug signing chỉ phục vụ kiểm chứng; cần build lại với API thật và khóa ký phát hành
  trước khi phân phối. SDK/APK/cache/local.properties và TRX không được đưa vào Git.
- Các cảnh báo sắp ngừng hỗ trợ Gradle `8.14`, AGP `8.11.1`, Kotlin `2.2.20` còn được giữ nguyên;
  không dùng cờ bỏ qua kiểm tra dependency. Chưa chạy GitHub Actions hoặc thử trên điện thoại/AVD.
- Bộ duyệt tự động chặn lệnh dọn mảnh tải JDK tạm với lý do `blocked by policy`; giữ nguyên cache tải,
  không thử lại bằng cách khác. SDK/JDK đã cài và build được kiểm chứng độc lập với cache này.
