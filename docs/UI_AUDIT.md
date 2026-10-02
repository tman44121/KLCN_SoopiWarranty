# Soopi — Impeccable audit

Ngày: **2026-10-02**. Repo: `warranty-system-soopi`. Phạm vi: kiểm tra giao diện React đã chuyển,
đổi tên hiển thị thành Soopi; giữ bố cục, CSS và nghiệp vụ đã được chốt ở giai đoạn 3.

## Implementation Integrity Verdict

**Đạt về tính nhất quán với phạm vi migration.** Cùng hệ thống token, font, sidebar, bảng và form
ở các trang vận hành; hai trang công khai có bố cục riêng phù hợp việc đăng nhập/tra cứu.
Tên Soopi đã có trong index, tiêu đề 10 trang, sidebar, portal, phiếu tiếp nhận in, default push
title và template SMS OTP mặc định. Không còn `LongManLoc` trong các vị trí hiển thị vừa sửa.

Impeccable detector chạy một lần trên `frontend-react/src/pages` và `frontend-react/index.html`:
**exit 0, 0 finding**. Kết quả này chỉ nói về các quy tắc detector và target đã quét;
không thay thế audit browser hay chứng minh không có lỗi UX. Không có finding bị bỏ qua bằng config.

Các token/CSS vẫn giữ nguyên byte so với Java. Không có PRODUCT.md/DESIGN.md; dùng implementation,
kế hoạch migration và ảnh browser hiện tại làm căn cứ cho audit có phạm vi hẹp, không tạo hướng thiết kế mới.
React vẫn dùng cầu nối JS cho bảng/form động và tải lại tài liệu giữa các trang như quyết định giai đoạn 3.

## Audit Health Score

Điểm là đánh giá kỹ thuật theo rubric Impeccable trên phạm vi đã quan sát, không phải chứng nhận WCAG.

| # | Hạng mục | Điểm | Bằng chứng chính |
|---|---|---:|---|
| 1 | Accessibility | 2/4 | Axe không phát hiện violation trong trạng thái đã quét; sắp xếp bảng chưa có đường bàn phím, lỗi form thiếu liên kết mô tả |
| 2 | Performance | 2/4 | JS production 601,29 kB, gzip 149,48 kB; toàn bộ page/controller được nạp sẵn |
| 3 | Responsive Design | 2/4 | Login/portal khớp viewport 390 px; 8 trang nội bộ vẫn rộng 1280 px theo thiết kế cũ |
| 4 | Theming | 3/4 | Token màu/typography/spacing nhất quán; chỉ có giao diện sáng, chưa có chuyển theme trong phạm vi sản phẩm |
| 5 | Implementation Integrity | 4/4 | Nội dung và cấu trúc bám nghiệp vụ; tên Soopi nhất quán, detector không báo finding |
| **Tổng** | | **13/20** | **Acceptable — còn điểm cần xử lý trước khi tuyên bố accessibility đầy đủ** |

## Tóm tắt

- **6 finding:** 0 P0, **1 P1**, **4 P2**, **1 P3**. Bao gồm lỗi kế thừa và giới hạn thiết kế cũ;
  không quy toàn bộ thành regression do migration hoặc đổi tên.
- Ưu tiên: bàn phím cho sorting, liên kết lỗi với input, chốt định dạng thời gian portal.
- Chiều rộng màn nội bộ và bundle là giới hạn đã biết; cần cân nhắc yêu cầu thiết bị/performance trước khi mở rộng phạm vi.
- Lần này chỉ sửa tên app; các finding bên dưới được ghi lại, chưa tự sửa hoặc redesign.

## Phương pháp và kết quả thực tế

- Edge/Chromium headless, context cô lập; Playwright và axe-core đã có trong repo Java, không cài package mới.
- Tái dùng fixture/mock của `scripts/smoke.mjs`; tất cả API trong audit và smoke được giả lập,
  kể cả đăng nhập/refresh/logout. Không chạy OTP/SMS/push thật hoặc thao tác ghi DB.
- Một đợt scan 10 trang, hai viewport **1440×900** và **390×900**; ảnh đại diện login, portal,
  kho, tiếp nhận. Một đợt kiểm chứng thủ công sorting/error state; không có vòng sửa giao diện ngoài đổi tên.
- Axe với tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` trên trạng thái ban đầu desktop:
  **0 violation trên cả 10 trang**. Có `incomplete`: bypass trên login và contrast trên một số nút nội bộ.
  Không tính các trường hợp cần kiểm thủ công này là pass hay tự động kết luận chúng vi phạm.
- Các trang audit không có lỗi JS/React. `oldBrand=false` ở cả hai viewport trên 10 trang.
- Focus bàn phím ở login tới `#login-username`, outline `solid`. Sorting được xác minh bằng computed
  `tabIndex=-1`, không role/button/aria-sort; click chuột vẫn đổi class sang `is-sorted-asc`.
- Portal khi submit rỗng có thông báo “Vui lòng nhập họ và tên.”; `#reg-name` không có
  `aria-invalid` hoặc `aria-describedby` nối tới thông báo đó.
- Viewport là mô phỏng kích thước desktop/mobile, **không phải kiểm thử trên điện thoại thật**.
  Chưa kiểm touch gesture, screen reader, zoom 400%, tất cả modal hoặc bảng có dữ liệu lớn.
- `npm.cmd run build`, `npm.cmd run lint`: **đạt**. Build có 2 cảnh báo directive `use client`
  của React Router và 1 cảnh báo chunk vượt 500 kB.
- `npm.cmd test`: **7/7 đạt**. Kiểm tên Soopi và không còn tên cũ trong 10 TSX/index;
  ID/name và 3 file CSS khớp nguồn Java.
- `node scripts/smoke.mjs`: **49 kiểm tra đạt trên 10 trang**, 14 request ghi giả lập.
- `dotnet build Soopi.slnx --artifacts-path artifacts/stage3`: **0 cảnh báo, 0 lỗi**.
  `dotnet test Soopi.slnx --artifacts-path artifacts/stage3 --no-build --no-restore`: **42/42 đạt**.
- API thật cổng 18080 chỉ GET: health **200/UP**, portal catalog **200**, 6 nhóm/1 trạm;
  `/login` **200** và HTML có `<title>Soopi</title>`. SLA tắt, refresh cleanup chưa tới lịch 02:00.

## Findings

### [P1] Sorting bảng điều phối chỉ hỗ trợ chuột

- **Vị trí:** `frontend-react/src/pages/dispatch.tsx:303,324,330`;
  `frontend-react/src/behaviors/dispatch.js:473`.
- **Loại:** Accessibility.
- **Bằng chứng:** ba `<th data-sort-key>` có `tabIndex=-1`, không button/role/aria-sort;
  chỉ gắn click handler. Click vẫn sắp xếp được; không có điều khiển sorting tương đương cho bàn phím.
- **Tác động:** người dùng chỉ dùng bàn phím không thực hiện được cùng thao tác sắp xếp.
- **Chuẩn:** yêu cầu tương đương bàn phím của [WCAG 2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html).
- **Khuyến nghị:** đặt button native trong `<th>`, dùng Enter/Space native và cập nhật `aria-sort` theo trạng thái.
  Giữ thứ tự/sort logic hiện có.
- **Lệnh phù hợp:** `/impeccable harden`.

### [P2] Lỗi form chưa nối với trường nhập cho công nghệ hỗ trợ

- **Vị trí:** `frontend-react/src/behaviors/ui.js:71,79`;
  `frontend-react/src/behaviors/customer-portal.js:28,42`.
- **Loại:** Accessibility.
- **Bằng chứng:** thêm/ẩn span lỗi và class `.has-error`, nhưng không cập nhật aria-invalid/describedby.
  Browser xác nhận input `#reg-name` không có hai thuộc tính này khi thông báo lỗi đang hiển thị.
- **Tác động:** người dùng nhìn thấy thông báo, nhưng trình đọc màn hình có thể không đọc mô tả lỗi khi focus input.
  Chưa kiểm screen reader nên đây là rủi ro cần kiểm thêm, không kết luận WCAG chỉ từ thiếu một thuộc tính.
- **Khuyến nghị:** gắn ID cho thông báo lỗi, nối với input bằng `aria-describedby`, đặt/clear `aria-invalid`,
  có error summary/live announcement phù hợp; giữ nguyên nội dung validation và response API.
- **Lệnh phù hợp:** `/impeccable harden`.

### [P2] Tám trang vận hành không có bố cục mobile

- **Vị trí:** `frontend-react/src/styles/base.css:22-26,94-136`.
- **Loại:** Responsive Design.
- **Bằng chứng:** `body min-width:1280px`, sidebar cố định. Trong viewport 390 px, cả tám trang nội bộ
  có `scrollWidth=1280`; login/portal có `scrollWidth=390`.
- **Tác động:** phải cuộn ngang để thấy trường/action; khó vận hành trên điện thoại.
- **Ngữ cảnh:** đây là **giới hạn chủ đích của bản cũ**, đã ghi màn nội bộ dùng desktop từ 1280 px;
  không coi là lỗi do đổi tên. Chưa tự mở rộng phạm vi mobile.
- **Chuẩn:** nếu cần đạt reflow/zoom cho phần giao diện không phải bảng hai chiều,
  đối chiếu [WCAG 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
  Ngoại lệ bảng dữ liệu không mặc nhiên áp dụng cho toàn sidebar/form. Chưa đo viewport 320/zoom 400%.
- **Khuyến nghị:** chỉ khi chủ dự án muốn hỗ trợ mobile, thu gọn shell/filter/form;
  giới hạn cuộn ngang trong bảng, giữ nguyên field và luồng nghiệp vụ.
- **Lệnh phù hợp:** `/impeccable adapt`.

### [P2] Toàn bộ page/controller nằm trong bundle đầu tiên

- **Vị trí:** `frontend-react/src/main.tsx:3-12`, `frontend-react/src/runtime.ts:9-12`.
- **Loại:** Performance.
- **Bằng chứng:** build sinh JS **601,29 kB**, gzip **149,48 kB**, cảnh báo >500 kB.
  Tất cả page và controller được import trước khi hiển thị.
- **Tác động:** login/portal phải tải và parse cả mã của các trang quản trị/vận hành.
  Chưa đo trên mạng yếu/CPU yếu nên chưa khẳng định có chậm nhìn thấy.
- **Ngữ cảnh:** eager controller đang bảo đảm handler gắn trước paint, tránh regression GET form đăng nhập.
- **Khuyến nghị:** nếu cần tối ưu, tải trọn page cùng controller qua lazy/Suspense, chỉ hiển thị form khi handler đã sẵn sàng;
  giữ bài kiểm hồi quy module đăng nhập tải chậm. Không chỉ đổi controller về import động rồi render form trước.
- **Lệnh phù hợp:** `/impeccable optimize`.

### [P2] Gợi ý thời gian portal không cùng định dạng với parser

- **Vị trí:** `frontend-react/src/pages/portal.tsx:190`;
  `frontend-react/src/behaviors/customer-portal.js:176-195`.
- **Loại:** Implementation Integrity / UX copy.
- **Bằng chứng:** placeholder là `19/09/2026 14:00 - 16:00`; code dùng `new Date(value)` cho một thời điểm
  rồi cộng một giờ. Guard báo ngày không hợp lệ đã có; định dạng/ý nghĩa chưa được chủ dự án chốt.
- **Tác động:** người dùng làm theo hướng dẫn có thể không gửi được yêu cầu.
- **Khuyến nghị:** xác nhận đây là một thời điểm hay khoảng thời gian, sau đó sửa helper/input và parser cho thống nhất;
  không tự thay khoảng đặt lịch/nghiệp vụ trong lần audit này.
- **Lệnh phù hợp:** `/impeccable clarify` sau khi chốt nghiệp vụ.

### [P3] Tiêu đề tab thu ngân còn hiện entity HTML

- **Vị trí:** `frontend-react/src/pages/cashier.tsx:6`.
- **Loại:** UX copy.
- **Bằng chứng:** `document.title` thực tế là `Soopi — Thu ngân &amp; Bàn giao`.
- **Tác động:** tên tab kém rõ; không cản thao tác nghiệp vụ.
- **Khuyến nghị:** dùng ký tự `&` trong chuỗi truyền vào `document.title`.
- **Lệnh phù hợp:** `/impeccable polish`.

## Pattern và điểm tốt

- Vấn đề keyboard/state thuộc helper/markup chung, nên sửa ở nguồn chung và giữ kiểm hồi quy,
  tránh vá từng trường bằng code riêng.
- Hệ thống token rõ cho màu chữ/status/surface, font, spacing và z-index; không tự thêm dark mode.
- Có `:focus-visible`, số liệu tabular, HTML escaping, loading/busy/empty/error, nhãn form;
  reduced-motion có tín hiệu tĩnh cho spinner/shimmer, không dùng global `0.01ms` để xóa mọi feedback.
- Role guard, đổi mật khẩu bắt buộc, chọn vai trò, logout, query/hash và multipart tiếp tục qua smoke.
- Checkbox 16/20 px là ứng viên target nhỏ nhưng có label click được;
  **không tự báo vi phạm target-size chỉ từ kích thước checkbox**. [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
  có điều kiện khoảng cách/equivalent target; ngưỡng 44 px của audit là mục tiêu usability, không đồng nhất với AA 24 px.

## Hành động khuyến nghị

1. **[P1/P2] `/impeccable harden`**: sorting bằng bàn phím và liên kết lỗi form.
2. **[P2] `/impeccable clarify`**: chỉ sau khi xác nhận cách nhập thời gian portal.
3. **[P2] `/impeccable adapt`**: khi yêu cầu hỗ trợ màn vận hành mobile được duyệt.
4. **[P2] `/impeccable optimize`**: chia bundle nếu chi phí tải thực tế cần giảm, giữ an toàn khởi tạo form.
5. **[P3] `/impeccable polish`**: hoàn thiện tiêu đề/copy sau các thay đổi đã duyệt.

Có thể yêu cầu chạy từng mục hoặc gom các mục được duyệt; chạy lại `/impeccable audit` sau sửa để đối chiếu.
Không coi audit này là duyệt hoặc thực hiện giai đoạn 4 migration.

## File và khả năng chạy lại

- Brand: `frontend-react/index.html`, 10 `src/pages/*.tsx`, `Push.cs`, `OtpService.cs`.
- Kiểm tra: `scripts/check.mjs`, `scripts/smoke.mjs` (export fixture dùng chung), `scripts/audit.mjs`.
- Bằng chứng browser/detector/ảnh nằm trong `frontend-react/test-results/` (Git ignore).
- Khi Vite chạy: `node scripts/audit.mjs`; `node scripts/smoke.mjs`.
- Project Spring Boot không có file bị sửa. Không thay schema/dữ liệu, không thêm dependency.
  JWT issuer, URI loại lỗi, tên bảng và các mã kỹ thuật giữ nguyên để bảo toàn contract;
  chuỗi lịch sử và danh sách chặn mật khẩu cũ không phải tên hiển thị app.
