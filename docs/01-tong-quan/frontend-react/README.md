# Frontend React — Soopi

Tài liệu được chuyển vào `docs/01-tong-quan/frontend-react/`; các lệnh và đường dẫn mã nguồn bên dưới
vẫn tính từ thư mục ứng dụng `frontend-react/`.

Giai đoạn 3 đã hoàn tất; giai đoạn 4 đang kiểm tương đương và chưa nghiệm thu luồng DB có token/ghi.
Hướng dẫn toàn project: [README](../README.md), [cài đặt](../../04-van-hanh/SETUP.md),
[API](../../02-ky-thuat/API.md), [kiểm thử/vận hành](../../04-van-hanh/OPERATIONS.md).

React + Vite + TypeScript + React Router, dùng `fetch`; không thêm thư viện UI, state hay HTTP.
Các trang: `/login`, `/dispatch`, `/receptionist`, `/technician`, `/warehouse`, `/cashier`,
`/tickets`, `/reports`, `/admin`, `/portal`. URL `*.html` cũ được chuyển sang route mới, giữ query/hash.

Mỗi trang là TSX theo markup cũ. Ba file CSS được sao chép nguyên byte. Các module trong
`src/behaviors` giữ trình xử lý form, bảng và nghiệp vụ giao diện JavaScript cũ; `usePage`
khởi tạo chúng sau khi React mount. Đây là cách chuyển tối thiểu theo Ponytail, **chưa chuyển
state/bảng động sang React hooks**. Link giữa các trang tải lại tài liệu như bản cũ; tab dùng hash.
Không dùng iframe hay dựng toàn bộ trang từ HTML thô.

## Chạy dev

```powershell
cd frontend-react
npm.cmd ci
npm.cmd run dev
```

Mở `http://localhost:5173/login`. Vite proxy `/api` và `/actuator` tới `http://localhost:8080`.
Cấu hình công khai theo `.env.example`, ghi giá trị riêng vào `.env.local`:
`VITE_API_BASE_URL=/api/v1`, `VITE_PROXY_TARGET=http://localhost:8080`.
Các biến `VITE_*` được gửi tới trình duyệt, không đặt secret hoặc connection string vào đây.
Đăng nhập và thao tác form thật có ghi DB; chỉ thực hiện khi được chủ dự án cho phép.

## Build và kiểm tra

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run test:ui
```

Build ghi vào `../backend-dotnet/src/Soopi.Api/wwwroot`. ASP.NET phục vụ assets và đúng 10 route
giao diện; URL API sai vẫn trả Problem Details, không trả `index.html`. Build frontend trước
`dotnet publish`. Build output, node_modules và ảnh kiểm tra không được đưa vào Git.

`lint` là TypeScript + kiểm cú pháp JS và so sánh ID/name/CSS với repo Java khi repo đó còn ở
bên cạnh; không dùng ESLint. `test` dùng `node:test` với fetch giả lập. `smoke.mjs` tái dùng
Playwright đã cài trong `warranty-system-mysql/e2e` và Edge có sẵn, chặn **mọi API request**
bằng dữ liệu giả; không cài package mới và không ghi DB. Có thể chọn host build thật bằng
`$env:E2E_BASE_URL='http://127.0.0.1:18080'`. Cần chạy server trước.

`test:ui` chạy smoke và `scripts/customer-ui.mjs`: kiểm khối chuyển khoản VietQR, trạng thái
thanh toán từ server và badge chat ở 1440/768/390px.
Nếu Playwright nằm trong runtime có sẵn khác, đặt `NODE_PATH` tới thư mục `node_modules` đó trước khi chạy.
Các API đều được giả lập; không cần khởi động backend để chạy với Vite.

Khi phiếu hoàn tất và còn nợ, trang khách hiện mã VietQR do backend sinh (`costs.paymentQr`, cấu hình
`VietQR__BankId`, `VietQR__AccountNo`, `VietQR__AccountName`) kèm số tài khoản và nội dung chuyển khoản.
Thu ngân xác nhận khi tiền đã vào tài khoản; trạng thái đã thanh toán chỉ lấy từ `costs.paymentStatus`.
Thiếu cấu hình VietQR thì trang chỉ hướng dẫn thanh toán tại quầy khi nhận máy.

Tại `/admin#reports`, chọn khoảng thời gian/trạm rồi bấm **Xuất Excel** để tải báo cáo `.xlsx` gồm 6 sheet.
Nút chỉ bật sau khi báo cáo tải thành công; thao tác tải dùng phiên nhân viên và tự làm mới token như các API khác.
`scripts/report-export-ui.mjs` kiểm bộ lọc, tải file, lỗi mạng, kỳ trống và bố cục 1440/768/390px bằng API mock; chạy cùng `test:ui`.

## Kết quả thực tế ngày 2026-10-01

- Build và lint: đạt. Build có 2 cảnh báo `MODULE_LEVEL_DIRECTIVE` từ `use client` của React Router
  và cảnh báo chunk vượt 500 kB: JS 601,57 kB, gzip 149,51 kB. Không ẩn cảnh báo.
- Test API/native navigation/HTML escaping: **7/7 đạt**.
- So sánh 10 trang: ID và tên trường khớp; 3 CSS giữ nguyên byte.
- Backend build vào `artifacts/stage3`: 0 cảnh báo/lỗi; **42/42 test đạt**.
- API thật chỉ đọc: health 200/UP, portal catalog 200 (6 nhóm, 1 trạm), OpenAPI 200;
  `/login` trả HTML 200, khách hàng không token 401, API không tồn tại 404 Problem Details.
- Browser smoke: **49 kiểm tra đạt trên 10 trang**, cả Vite dev 5173 và bản build ASP.NET 18080.
  Mỗi lần chạy có 14 request ghi **giả lập**, không gửi vào database. Đã kiểm role guard,
  query/hash của URL cũ, đổi mật khẩu bắt buộc, xác nhận mật khẩu, chọn nhiều vai trò,
  đăng xuất, validation và gửi multipart portal. Không có lỗi JS/React không mong đợi;
  HTTP 404 của tình huống tra cứu thất bại được kiểm có chủ đích.
- Đã tái hiện timeout bằng cách trì hoãn module đăng nhập 1,5 giây: form xuất hiện trước
  khi có submit handler, dẫn tới GET form mặc định. Sửa tại `runtime.ts`: tải module sẵn
  và gắn handler đồng bộ trước paint. Kiểm tra hồi quy giữ độ trễ này và chặn mọi request
  có `password` trên query string. Không thêm sleep để che lỗi đăng nhập.
- Browser portal qua proxy thật: **GET catalog**, hiển thị 6 nhóm/1 trạm, không lỗi JS;
  ảnh mobile 390 px và kho 1440 px đã kiểm tra.
- Kiểm proxy ban đầu nhận 502 vì API kiểm tra chạy 18080 còn proxy mặc định là 8080.
  Khởi động Vite với `VITE_PROXY_TARGET=http://127.0.0.1:18080`, portal đã đọc thành công.
  Cổng mặc định dùng hằng ngày vẫn là 8080.
- Đã dừng API thử nghiệm và Vite; không dừng tiến trình khác của chủ dự án.

## Cần xác nhận

1. Duyệt riêng login/logout trên `_Dev` để đọc API có token và kiểm luồng ghi/đồng thời trên DB `_IT` được duyệt.
   Giai đoạn 4 đã được yêu cầu; không cần duyệt lại để bắt đầu giai đoạn này.
2. Portal: placeholder thời gian cũ là khoảng `19/09/2026 14:00 - 16:00` nhưng JavaScript dùng
   `new Date(value)` và tự cộng 1 giờ. Giữ input/parser cũ; bổ sung báo lỗi ngày không hợp lệ
   thay vì ném RangeError. Cần chủ dự án chốt ý nghĩa/định dạng trước khi đổi cách phân tích.
3. Portal ghi tối đa 3 tệp trong UI, backend cho phép 5: giữ nguyên, cần đối chiếu ở giai đoạn 4.

Đã có JSON mẫu Java/.NET cho public/unauthenticated API và invalid DTO; chưa kiểm các thao tác ghi trên SQL Server
hay toàn bộ luồng nghiệp vụ với dữ liệu thật. Đăng nhập/refresh cũng ghi DB; cần duyệt riêng trước kiểm tích hợp thật.

## Cập nhật kiểm chứng 2026-10-02

Frontend build/lint đạt, test 7/7, smoke 49 check trên 10 trang với toàn bộ API mock.
Bundle JS 601,29 kB (gzip 149,48 kB); vẫn có cảnh báo `use client` và chunk >500 kB.
Backend 45/45 test; 100 quan sát oracle và 44 HTTP case đối chiếu nội dung. 4 raw diff chỉ là thứ tự
fieldErrors, Java cũng đổi thứ tự này giữa các lần chạy; xem [báo cáo giai đoạn 4](../../handoff/MIGRATION_VERIFICATION.md).

## Soopi / Impeccable audit — 2026-10-02

Kiểm thử hồi quy cho lượt harden/adapt/animate/extract/polish ngày 2026-11-02: chạy Vite, sau đó `npm run test:ui:hardening`. Script dùng Edge và API mock, kiểm tên/focus hộp thoại, liên kết lỗi form, lịch Chủ nhật, vùng chạm, bàn phím đánh giá, tương phản chip, giảm chuyển động và hủy cử chỉ chữ ký. Nếu repo Java không có Playwright, đặt `PLAYWRIGHT_PACKAGE` tới `package.json` trong thư mục cha của `node_modules` chứa `playwright-core`; không cần cài dependency mới. `E2E_BASE_URL` chọn URL Vite (mặc định `http://localhost:5173`).

Lỗi inline dùng chung: `LML_UI.fieldError(wrapper, message)` đặt thông báo, `aria-invalid` và nối ID lỗi vào `aria-describedby`; `LML_UI.clearFieldErrors(root)` chỉ gỡ lỗi do helper này quản lý, giữ hướng dẫn có sẵn và validation của `BusinessDateTime`. `LML_UI.showError(error, form)` áp dụng cùng pattern cho `fieldErrors` từ API. Ảnh kiểm chứng lưu trong `test-results/impeccable/`.

`npm run test:ui:quotation-payment` kiểm tra hộp thoại báo giá và khối chuyển khoản VietQR ở 1440/768/360px: tên truy cập, giữ/trả focus, Escape, nội dung bảo hành, thông tin tài khoản/nội dung chuyển khoản, vùng chạm và không tràn ngang. Tất cả API được mock; ảnh nằm trong `test-results/quotation-payment/`. Bộ kiểm tra này cũng thuộc `npm run test:ui`.

`npm run test:ui:staff-selection` kiểm trạng thái lựa chọn ngoại quan, đặt lại biểu mẫu, sáu bước QC và phân loại chẩn đoán ở 1440/768/360px. Các lựa chọn công bố `aria-pressed` và giữ focus sau Enter/Space; nội dung đang nhập được giữ qua mỗi lần dựng lại chi tiết. Script dùng API mock, không gửi kết quả QC hay ghi phiếu thật. Ảnh nằm trong `test-results/staff-selection/`; bộ kiểm tra thuộc `npm run test:ui`. Kiểm thử báo giá/thanh toán cũng đo cả hai chiều của bốn ô thẻ trên thiết bị cảm ứng.

Tên hiển thị đã đổi thành Soopi; CSS/layout và luồng nghiệp vụ giữ nguyên. Audit ở
`../docs/06-design/UI_AUDIT.md`: 13/20, 1 P1/4 P2/1 P3 cần xem xét; các finding chưa tự sửa.
Có thể chạy lại `node scripts/audit.mjs` khi Vite đang chạy. Script tái dùng browser/mock API của
smoke và axe-core trong devDependencies của repo này, không ghi DB. Báo cáo migration trên là lịch sử;
cổng kiểm tra chất lượng hiện tại được mô tả bên dưới.

## Cổng chất lượng giao diện

Kết quả đã xác nhận: [báo cáo chất lượng 2026-11-03](../../06-design/UI_QUALITY_2026-11-03.md).

`npm ci` cài cả `axe-core` và `playwright-core`; runner dùng Microsoft Edge đã cài trên máy,
không phụ thuộc repo Java. `PLAYWRIGHT_PACKAGE` chỉ còn là tùy chọn để dùng runner có sẵn ở nơi khác.

Chạy `npm run build`, sau đó mở một terminal chạy `npm run preview -- --host 127.0.0.1 --port 4173`.
Trong terminal thứ hai (PowerShell):

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:4173'
npm run test:quality
```

Cổng này chạy unit test, TypeScript/controller checks, axe WCAG 2.2 AA và best practices,
kiểm tra ID ARIA, toàn bộ hồi quy UI, rồi phép đo hiệu năng trên bản production. Mọi API đều mock.
Không hạ ngưỡng hoặc bỏ qua violation để đạt điểm: tiến trình trả exit khác 0 nếu một cổng thất bại.

- `npm run test:ui:audit`: 14 trang ở 1440/768/360px, thêm trạng thái lỗi form, yêu cầu mới,
  chat, báo giá, thẻ và lỗi thẻ. Báo cáo và ảnh: `test-results/quality/audit.json` và cùng thư mục.
- `npm run test:ui:performance`: 8 mẫu trên 4 trang ở desktop/mobile, cache lạnh, CPU 4x,
  mạng 1,6 Mbps và độ trễ 150ms. Ngưỡng: LCP ≤2500ms, CLS ≤0,1, độ trễ sự kiện tương tác lab ≤200ms.
  Kết quả nằm ở `test-results/quality/performance.json`. Đây là phép đo lab, không phải INP hay
  Core Web Vitals của người dùng thật.
- `npm run test:ui:hardening` kiểm cả nhãn bấm 44px của checkbox xác nhận ngoại quan bằng touch/Space.

Các mục axe `incomplete` được lưu để đối chiếu thủ công, không được coi như đã tự động đạt.
Điểm Impeccable là đánh giá kỹ thuật trong phạm vi đã kiểm, không thay thế chứng nhận WCAG hoặc
kiểm tra Safari, thiết bị thật và trình đọc màn hình. Dark mode không thuộc phạm vi PRODUCT.md.

## Giao diện khách hàng (KLCN) — 2026-10-02

`/` (trang giới thiệu), `/login`, `/register`, `/account`, `/portal` dùng giao diện web khách KLCN (`src/styles/customer.css`, phần dùng chung
`src/customer.tsx`). `/login` và `/portal` vẫn do `login.js`/`customer-portal.js` điều khiển (giữ id/name); `/`, `/register`
và `/account` dựng bằng React state, không có controller trong `src/behaviors`. Mục con của `/account` theo hash:
`#lich-su`, `#phieu/<mã>`, `#yeu-cau-moi[/<serial>]`, `#ho-so`, `#doi-mat-khau`. `node scripts/smoke.mjs` kiểm cả luồng khách.

Bộ màu soopiwarranty khai báo ở đầu `customer.css` (`--kh-forest`, `--kh-navy`, `--kh-cream`, `--kh-mint-soft`,
`--kh-lilac`, `--kh-honey`, `--kh-peach`, trạng thái bảo hành `--kh-warn-*`/`--kh-bad-*`). Logo nằm ở
`public/images/brand/` (`logo-mark.png`, `wordmark.png`, `wordmark-light.png` cho nền tối, `favicon.png`).
Màn nội bộ dùng cùng bộ màu qua `src/styles/brand.css` (nạp sau components.css, chỉ ghi đè token của tokens.css);
không sửa tokens/base/components.css vì `scripts/check.mjs` so byte với bản gốc. Class mới của giao diện khách
nên có tiền tố `kh-` để không trùng class của màn nội bộ.
