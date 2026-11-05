# Impeccable audit — mobile Soopi

## Kiểm tra lại sau sửa — 2026-11-05

**Đạt phần kiểm tra kỹ thuật Android trong phạm vi audit: 20/20, từ 12/20.** Đã sửa cả 7 phát hiện,
kiểm chứng bằng regression tests và chạy native Android 36 AVD. Đây là điểm của source, hành vi đã
kiểm thử và giao diện Android/light theme hiện có; không phải chứng nhận mọi thiết bị hoặc phát hành production.
Không còn phát hiện mở trong danh sách ban đầu: P0: 0; P1: 0; P2: 0; P3: 0.

| Nhóm | Trước | Sau | Bằng chứng nâng điểm |
| --- | --- | --- | --- |
| Accessibility | 2/4 | 4/4 | Tab có role/selected; vùng chạm đã sửa ≥48dp; nhãn tab và thống kê không cắt ở 200%; badge đọc số một lần; animation tab tôn trọng disableAnimations |
| Hiệu năng | 3/4 | 4/4 | Đóng gói 9 font face, tắt tải font runtime; giữ danh sách builder/sliver; release mở offline trên AVD |
| Giao diện và theme | 3/4 | 4/4 | Token viền điều khiển đạt ≥3:1; giữ palette và typography Soopi trong light theme đã chốt |
| Tuân thủ nền tảng | 2/4 | 4/4 | NavigationRail Material, semantics có trạng thái; Back bảo vệ nội dung; chọn lại tab giữ màn hình con |
| Thích ứng | 2/4 | 4/4 | Tab co giãn/rail cuộn; kiểm hẹp/rộng, dọc/ngang và chữ 100%/200% |
| **Tổng** | **12/20** | **20/20** | **7/7 phát hiện đã xử lý** |

Dark mode chưa được chốt trong PRODUCT, không tính là lỗi của phạm vi light theme. Điểm hiệu năng
không thay thế benchmark FPS/GPU trên máy vật lý hoặc tạo cam kết SLA từ số đo emulator.

### 1. Đã sửa thanh tab tràn khi tăng cỡ chữ

[main_shell.dart](../../../Warrant_App/lib/views/shell/main_shell.dart): bỏ chiều cao cố định 64dp,
dùng chiều cao tối thiểu và chiều cao nội tại theo nội dung; nhãn được xuống dòng, không khóa text scale.
Biểu tượng giữ cùng hàng khi nhãn khác số dòng. Kiểm bằng 8 tổ hợp kích thước/cỡ chữ và ảnh native.
Lượt kiểm native còn phát hiện nhãn thống kê bị cắt: đã bỏ giới hạn hai dòng tại
[soopi_ui.dart](../../../Warrant_App/lib/widgets/soopi_ui.dart), xếp dọc ô thống kê trên cửa sổ hẹp
khi chữ lớn tại [home_screen.dart](../../../Warrant_App/lib/views/home/home_screen.dart).

### 2. Đã sửa trạng thái tab cho accessibility

MainShell công bố role tabBar/tab, selected và nhóm chọn loại trừ; rail dùng semantics Material.
Tách semantic container của Navigator con để không che trạng thái rail. Animation tab tôn trọng
`disableAnimations`. Regression và UIAutomator xác nhận selected true/false đổi đúng khi chọn tab.
Đây là kiểm cầu nối accessibility native, chưa phải nghe thử TalkBack.
[notification_count_badge.dart](../../../Warrant_App/lib/widgets/notification_count_badge.dart)
dùng Material Badge và chỉ công bố số chưa đọc một lần.

### 3. Đã sửa vùng chạm liên kết và quên mật khẩu

SoopiLink và nút quên mật khẩu trong
[login_screen.dart](../../../Warrant_App/lib/views/auth/login_screen.dart) có kích thước tối thiểu
48×48dp; bỏ cấu hình thu nhỏ vùng chạm của nút. Regression đo lại chiều cao đạt ≥48dp.

### 4. Đã sửa độ tương phản viền input

[app_theme.dart](../../../Warrant_App/lib/theme/app_theme.dart): thêm `controlBorder #798980` cho
viền mặc định/enabled; giữ sageBorder cho đường trang trí. Regression tính luminance, xác nhận ≥3:1
với cả nền input và nền trang, thay cặp màu cũ chỉ đạt 1.316:1.

### 5. Đã sửa mất nội dung khi Back hoặc bấm lại tab

[real_create_request_screen.dart](../../../Warrant_App/lib/views/requests/real_create_request_screen.dart):
PopScope nhận biết nội dung, thiết bị, danh mục, trạm, lịch và tệp đã đổi. Back hệ thống/app bar cùng hỏi
“Bỏ yêu cầu đang soạn?”; “Tiếp tục soạn” giữ nội dung, “Bỏ thay đổi” mới rời form. Form trống thoát bình thường.
Trong lúc POST, Back yêu cầu chờ kết quả, không tạo thêm request. Không thêm lưu nháp xuống DB.
MainShell bỏ reset initialLocation khi chọn lại tab: đổi tab rồi quay về vẫn giữ màn hình con.
Regression bao phủ Back/hủy/bỏ thay đổi/form trống, lúc POST đang chờ và giữ route qua chọn tab.

### 6. Đã sửa điều hướng cửa sổ rộng

MainShell dùng tab dưới 600dp; từ 600dp dùng Material NavigationRail cuộn được, giữ đủ 5 nhánh và
StatefulShellRoute. Nội dung rộng giới hạn 1040dp. Regression chạy 320×900, 360×640, 840×900,
1000×360dp ở scale 1.0/2.0; tablet AVD xác nhận rail hoạt động và selected đổi đúng.

### 7. Đã sửa font phụ thuộc tải mạng

[pubspec.yaml](../../../Warrant_App/pubspec.yaml), [main.dart](../../../Warrant_App/lib/main.dart)
và `Warrant_App/assets/fonts/`: đóng gói Inter Regular/Medium; Plus Jakarta Sans
Regular/SemiBold/Bold/ExtraBold; JetBrains Mono Regular/Medium/SemiBold.
Chín TTF được đối chiếu kích thước và SHA-256 với metadata google_fonts 9.0.0; giữ 3 giấy phép OFL,
đăng ký LicenseRegistry. Tổng font và giấy phép khoảng 1.25 MB. Tắt tải font runtime.
Regression kiểm khai báo/đọc assets; Android tắt Wi-Fi và bật airplane mode vẫn hiện font tiếng Việt.

### Kiểm chứng sau sửa

- `flutter analyze --no-pub`: không có lỗi; `flutter test --no-pub`: **173/173 đạt**, từ 156 ban đầu.
- Test mới: [mobile_quality_test.dart](../../../Warrant_App/test/mobile_quality_test.dart),
  [request_draft_navigation_test.dart](../../../Warrant_App/test/request_draft_navigation_test.dart).
  Bổ sung Back lúc gửi tại [real_request_flow_test.dart](../../../Warrant_App/test/real_request_flow_test.dart);
  chọn đúng Scrollable khi thêm rail tại [real_tracking_test.dart](../../../Warrant_App/test/real_tracking_test.dart).
- Build Android debug/release và Web release với `API_URL=https://ci.invalid/api/v1` để kiểm biên dịch.
  Đây là build kiểm chứng; release Android vẫn dùng debug signing hiện có, chưa phải gói phân phối.
- Native: AVD thử riêng `Soopi_Audit_Phone` và `Soopi_Audit_Tablet`, Android 36 Google APIs x86_64.
  Màn hình dùng Mock fixture, không gọi backend thật/ghi database. Tablet 2560×1600px, density 320.
- Log/ảnh tạm được Git bỏ qua ở `artifacts/mobile-integration/`: `quality-analyze.log`,
  `quality-full-tests.log`, `quality-apk-debug.log`, `quality-apk-release.log`, `quality-web.log`;
  `native-quality/phone-home-100.png`, `phone-home-200.png`, `phone-statistics-200.png`, `phone-devices-100.png`,
  `tablet-home-100.png`, `tablet-home-200.png`, `tablet-devices-100.png` và XML tương ứng.
- Release cold activity launch trên tablet AVD: `TotalTime: 2625ms` (`am start -W`, một lượt).
  Đây không phải thời gian tải dữ liệu backend hoặc benchmark GPU.
- Tablet từng ANR ở System UI khi chạy nhiều emulator/build cùng lúc; chạy riêng AVD với tài nguyên phù hợp
  đã kiểm tra được. Không sửa mã ứng dụng để né lỗi môi trường.

### Giới hạn và công cụ

Chưa nghiệm thu điện thoại vật lý, nghe TalkBack, iOS/VoiceOver, bàn phím OEM, foldable hinge và FPS 60/120Hz.
Ma trận widget không thay thế kiểm đa cửa sổ thật. Nếu mở rộng phạm vi hoặc thêm dark mode, cần kiểm tiếp.
Audit không kiểm lại backend/SQL hoặc chứng minh tích hợp end-to-end với hệ thống vận hành.

Theo lựa chọn của người dùng, đã chạy `npx --yes impeccable update`: bản cài người dùng lên 4.8.0;
không sửa plugin cache 4.4.0 đã ghim. Đánh giá lại giữ cùng 5 nhóm và ngữ cảnh sản phẩm của audit đầu.
Không gộp GitHub mobile vì người dùng đã xác nhận không cần; không commit/push.

---

## Bản audit ban đầu — lưu lịch sử, các trạng thái chưa sửa bên dưới đã được thay thế

Ngày: 2026-11-05. Skill: Impeccable 4.4.0, playbook `audit.native`, chuẩn Android/Material.
Phạm vi: `Warrant_App`, chế độ Operate cho khách hàng theo dõi thiết bị, gửi yêu cầu và xác nhận báo giá.

## Kết luận nền tảng

**Chưa đạt để phát hành về accessibility.** Ứng dụng dùng Flutter/Material 3, có SafeArea, điều hướng
GoRouter và nhiều điều khiển Material đúng nền tảng. Thanh tab tự dựng còn lỗi cỡ chữ lớn và không công bố
trạng thái được chọn; một số thao tác quan trọng có vùng chạm quá nhỏ.

GitHub mobile `longdinh231005-hue/Warrant_App` đã được kiểm tra: `main` ở `787d39a`, đúng mốc đã nhập;
`Long` ở `9c30568` là commit cũ hơn. Không có PR mở. Người dùng xác nhận không cần gộp, nên audit trên
mã hiện tại, giữ các chỉnh sửa chưa commit. Không sửa giao diện trong lượt này.

Launcher context không tự tìm thấy PRODUCT/DESIGN đã chuyển thư mục. Đã đọc ngữ cảnh tại
[PRODUCT](../../03-san-pham/PRODUCT.md), [DESIGN](../DESIGN.md) và
[README mobile](../../01-tong-quan/Warrant_App/README.md); không di chuyển hoặc viết lại tài liệu thiết kế.
PRODUCT hiện mô tả web, nên kết luận native dựa thêm vào source Flutter và hướng dẫn Android của skill.

## Điểm sức khỏe

| Nhóm | Điểm | Bằng chứng chính |
| --- | --- | --- |
| Accessibility | 2/4 | Tab thiếu selected semantics; vùng chạm 21–27dp; cỡ chữ lớn gây tràn |
| Hiệu năng | 3/4 | Danh sách dùng builder/sliver; font chưa đóng gói nên có đường tải HTTP lần đầu |
| Giao diện và theme | 3/4 | Token Soopi dùng nhất quán; viền input mặc định quá nhạt |
| Tuân thủ nền tảng | 2/4 | Material 3 và Back hoạt động; thanh tab tự dựng thiếu hành vi accessibility chuẩn |
| Thích ứng | 2/4 | Cỡ chữ 200% làm vỡ tab; cửa sổ rộng vẫn giữ nguyên điều hướng điện thoại |
| **Tổng** | **12/20** | **Chấp nhận được, còn việc đáng kể trước khi phát hành** |

Điểm là đánh giá source có kiểm chứng bằng Flutter widget engine headless. Chưa đo FPS, thời gian khởi động
hoặc TalkBack trên thiết bị. Hiệu năng và thích ứng cần xác nhận lại trên Android thật/AVD.

**7 vấn đề: P0: 0; P1: 4; P2: 3; P3: 0.** Ưu tiên thanh tab, vùng chạm và độ tương phản trước.

## Chi tiết theo mức ưu tiên

### 1. [P1] Thanh tab tràn khi người dùng tăng cỡ chữ

**Vị trí:** [main_shell.dart](../../../Warrant_App/lib/views/shell/main_shell.dart), dòng 114 và 195–206.
Nhóm: Accessibility / Adaptivity.

Thanh điều hướng cao cố định 64dp, còn nhãn vẫn tăng theo text scale. Probe ở 320dp và 840dp,
text scale 2.0, ghi nhận cả năm mục `RenderFlex overflowed by 11 pixels on the bottom`.
Ở scale 1.0 các trường hợp tương ứng không có overflow. Số đo thuộc font của widget test, cần xác nhận
thêm bằng font thực trên thiết bị.

Người dùng cỡ chữ lớn gặp nhãn bị cắt/tràn ở điều hướng chính. Dùng NavigationBar thích ứng hoặc cho vùng
điều hướng tăng chiều cao theo nội dung; không khóa text scale để che lỗi. Kiểm lại ở 320dp/360dp, 200%.
Hướng dẫn: hỗ trợ cỡ chữ hệ thống của Android. Lệnh đề xuất: `/impeccable adapt`.

### 2. [P1] Trình đọc màn hình không biết tab nào đang được chọn

**Vị trí:** [main_shell.dart](../../../Warrant_App/lib/views/shell/main_shell.dart), dòng 149–206.
Nhóm: Accessibility / Platform Conformance.

`isActive` chỉ thay biểu tượng, nền và chữ. Probe semantics của mục Trang chủ đang hoạt động trả
`isSelected = Tristate.none` ở cả hai chiều rộng và hai text scale. Không có Semantics selected trong
widget thanh tab.

Người dùng TalkBack không nhận được trạng thái tab hiện tại. Dùng NavigationBar/NavigationDestination,
hoặc công bố selected và vai trò/tab index trên cùng semantic node có hành động nhấn. Kiểm tra cây
semantics rồi nghe thử TalkBack. Hướng dẫn: công bố vai trò và trạng thái điều khiển của Android;
tham chiếu WCAG 4.1.2. Lệnh đề xuất: `/impeccable harden`.

### 3. [P1] Vùng chạm của liên kết và quên mật khẩu quá thấp

**Vị trí:** [soopi_ui.dart](../../../Warrant_App/lib/widgets/soopi_ui.dart), dòng 216–239;
[login_screen.dart](../../../Warrant_App/lib/views/auth/login_screen.dart), dòng 326–347.
Nhóm: Accessibility / Platform Conformance.

SoopiLink dùng InkWell với padding dọc 4dp, không đặt chiều cao tối thiểu. Nút quên mật khẩu đặt
`minimumSize: Size.zero` và `MaterialTapTargetSize.shrinkWrap`. Widget probe đo vùng tương ứng cao
27dp và 21dp ở cỡ chữ mặc định, thấp hơn mức 48dp của Android. Chiều rộng/font của probe là môi trường
headless, không phải số đo pixel trên điện thoại.

Người hạn chế vận động hoặc dùng máy một tay khó nhấn đúng. Giữ chữ hiện tại, mở vùng tương tác lên
ít nhất 48×48dp; tránh vùng chạm lấn nhau. Theo
[hướng dẫn accessibility Android](https://developer.android.com/guide/topics/ui/accessibility/apps).
Lệnh đề xuất: `/impeccable adapt`.

### 4. [P1] Viền input ở trạng thái thường khó phân biệt với nền

**Vị trí:** [app_theme.dart](../../../Warrant_App/lib/theme/app_theme.dart), dòng 22 và 377–384;
ví dụ ô mô tả tại [real_create_request_screen.dart](../../../Warrant_App/lib/views/requests/real_create_request_screen.dart),
dòng 528–538. Nhóm: Accessibility / Theming.

Viền enabled dùng sageBorder `#D9E3DB` trên nền trắng; phép tính luminance từ token cho tỷ lệ
**1.316:1**. Các ô không có biểu tượng hay affordance bổ sung phụ thuộc vào khung/nền để nhận biết
vùng nhập; cặp màu này quá gần nhau. Viền focus xanh rừng không giải quyết trạng thái chưa focus.

Người thị lực thấp dễ bỏ sót hoặc khó xác định vùng nhập. Thêm token viền điều khiển riêng đạt ít nhất
3:1 với nền liền kề, giữ sageBorder nhạt cho đường phân cách trang trí. Quy tắc chỉ áp dụng khi khung
là dấu hiệu cần thiết để nhận biết điều khiển; không suy rộng thành lỗi cho mọi đường viền hay nút chữ.
Tham chiếu [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
Lệnh đề xuất: `/impeccable colorize`.

### 5. [P2] Bấm Back làm mất bản yêu cầu đang soạn mà không xác nhận

**Vị trí:** [real_create_request_screen.dart](../../../Warrant_App/lib/views/requests/real_create_request_screen.dart),
dòng 54–58 và 333–355. Nhóm: Platform Conformance / luồng nhập liệu.

Form giữ dữ liệu trong controller cục bộ rồi dispose khi rời route. Không có PopScope hoặc cơ chế giữ draft.
Probe đi vào form thiết bị mới, nhập mô tả, gọi Back hệ thống: route về `/requests`, không có hộp xác nhận;
mở lại form thì mô tả rỗng.

Người dùng có thể phải nhập lại mô tả dài và chọn lại tệp sau một lần Back nhầm. Thêm xác nhận bỏ thay đổi
khi form bẩn hoặc lưu draft có chủ đích. Giữ Back mặc định khi form chưa đổi; tránh chặn Back toàn ứng dụng.
Lệnh đề xuất: `/impeccable harden`.

### 6. [P2] Cửa sổ rộng vẫn dùng nguyên thanh tab điện thoại

**Vị trí:** [main_shell.dart](../../../Warrant_App/lib/views/shell/main_shell.dart), dòng 28–53 và 99–136.
Nhóm: Adaptivity / Platform Conformance.

Mọi kích thước đều gắn `_WarrantSafeBottomNav` vào bottomNavigationBar. Không chọn dạng điều hướng theo
window width; probe 840dp vẫn có cùng thanh tab và không có NavigationRail. Source không cung cấp nhánh
điều hướng cho cửa sổ mở rộng.

Khi dùng tablet hoặc cửa sổ Android lớn, điều hướng chưa tận dụng không gian và bố cục giữ dạng điện thoại.
Chuyển sang rail/drawer ở độ rộng phù hợp, giữ nguyên năm nhánh và trạng thái của StatefulShellRoute.
Mức ưu tiên này giả định app hỗ trợ cửa sổ rộng; chưa có yêu cầu sản phẩm riêng xác nhận tablet.
Lệnh đề xuất: `/impeccable adapt`.

### 7. [P2] Font thương hiệu còn phụ thuộc tải mạng trên máy chưa có cache

**Vị trí:** [app_theme.dart](../../../Warrant_App/lib/theme/app_theme.dart), dòng 103–170 và 238;
[pubspec.yaml](../../../Warrant_App/pubspec.yaml), dòng 79–80. Nhóm: Performance / Appearance.

Theme gọi GoogleFonts cho Inter, Plus Jakarta Sans và JetBrains Mono; assets hiện chỉ gồm hai ảnh thương hiệu,
không có font đóng gói. Với hành vi mặc định của package, font thiếu trong assets/cache sẽ đi qua đường tải HTTP.
Đây là đường chạy xác minh từ source và tài liệu package, chưa phải số đo startup trên Android.

Máy mới dùng mạng yếu hoặc offline chưa có bảo đảm hiển thị ngay đúng font và kích thước chữ đã thiết kế.
Đóng gói đúng font/weight đang dùng, giữ giấy phép tương ứng, rồi kiểm cold start không có mạng. Package
hỗ trợ ưu tiên font trong assets theo [tài liệu google_fonts](https://pub.dev/packages/google_fonts/versions/9.0.0#bundling-fonts-when-releasing).
Không suy diễn thành crash ứng dụng từ log HTTP bị chặn của widget test. Lệnh đề xuất: `/impeccable optimize`.

## Mẫu lặp và điểm tốt cần giữ

- Các vấn đề lặp tập trung ở thành phần tự dựng: nav/SoopiLink và token viền, nên sửa tại thành phần dùng chung.
- Bộ kiểm thử accessibility hiện bao phủ registration/notifications ở nhiều cỡ chữ, nhưng chưa bao phủ MainShell.
- Soopi giữ hệ màu, kiểu chữ, logo và trạng thái có biểu tượng nhất quán; không cần đổi thế giới thị giác.
- Material 3, SafeArea, scaffold và điều hướng GoRouter đã có. Thanh tab ẩn khi bàn phím mở.
- ListView.builder/sliver được dùng cho danh sách, có refresh và trạng thái tải/lỗi; chưa có bằng chứng jank để gắn lỗi.
- CustomTextField giữ tên truy cập khi đã nhập giá trị. Probe riêng ô mô tả yêu cầu cũng vẫn có accessible label
  từ hint khi đã có nội dung, nên không báo lỗi thiếu nhãn cho ô này.
- Trạng thái xác minh hồ sơ không bị bịa; tính năng hồ sơ chưa hỗ trợ được ghi rõ là chưa hỗ trợ.
- Light theme là ngữ cảnh hiện có; dark mode chưa được chốt trong PRODUCT nên không tính việc thiếu dark mode
  thành một lỗi phát hành trong báo cáo này. Không báo lỗi Reduce Motion chỉ dựa vào sự có mặt của AnimatedContainer.

## Bằng chứng và giới hạn

- `flutter analyze --no-pub`: không có lỗi. Toàn bộ **156 test Flutter** hiện có đạt.
- Sáu probe đo theme/vùng chạm/nav, cộng một probe form/Back, chạy bằng Flutter widget engine headless
  trên Windows. Các probe ghi nhận lỗi/layout/semantics để chẩn đoán, không phải tuyên bố UI đã đạt nghiệm thu.
- Probe nằm ở `Warrant_App/build/audit/`, log tại `artifacts/mobile-integration/impeccable-*.log`;
  đều là dữ liệu tạm bị Git bỏ qua. Không thêm test khẳng định lỗi hiện tại vào bộ regression chính.
- Không chạy trên điện thoại, AVD hoặc iOS Simulator; chưa nghe TalkBack/VoiceOver hoặc kiểm predictive Back,
  xoay màn hình, IME thật và hiệu năng GPU trên phần cứng. Không có ảnh native mới trong lượt này.
- Không chạy detector DOM vì playbook native không áp dụng detector web cho Flutter.
- Không kiểm lại bảo mật backend/SQL trong audit UI này. Không sửa source UI, không commit/push.

## Thứ tự xử lý đề xuất

1. **P1 — `/impeccable adapt`**: mục 1 và 3, bảo đảm vùng chạm và cỡ chữ; xử lý thêm mục 6 khi chốt tablet.
2. **P1 — `/impeccable harden`**: mục 2, công bố selected semantics; thêm kiểm thử tránh tái phát.
3. **P1 — `/impeccable colorize`**: mục 4, chỉ sửa token biên điều khiển, giữ palette Soopi.
4. **P2 — `/impeccable harden`**: mục 5, bảo vệ bản nháp khi Back.
5. **P2 — `/impeccable optimize`**: mục 7, đóng gói font và kiểm cold start.
6. **Sau cùng — `/impeccable polish`**, rồi chạy lại `/impeccable audit` để đối chiếu điểm.

Có thể yêu cầu sửa từng mục, toàn bộ hoặc theo thứ tự khác. Nếu cần ngữ cảnh native bền vững cho những
lượt thiết kế sau, có thể dùng `/impeccable init` riêng cho mobile; việc này không chặn audit hiện tại.
Đã ghi nhận yêu cầu cập nhật Impeccable ở lượt sau; không thay skill trong khi đang chạy lượt audit này.
