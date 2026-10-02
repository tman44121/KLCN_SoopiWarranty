# Frontend React — Soopi

Giai đoạn 3 đã hoàn tất; giai đoạn 4 đang kiểm tương đương và chưa nghiệm thu luồng DB có token/ghi.
Hướng dẫn toàn project: [README](../README.md), [cài đặt](../docs/SETUP.md),
[API](../docs/API.md), [kiểm thử/vận hành](../docs/OPERATIONS.md).

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
node scripts/smoke.mjs
```

Build ghi vào `../backend-dotnet/src/Soopi.Api/wwwroot`. ASP.NET phục vụ assets và đúng 10 route
giao diện; URL API sai vẫn trả Problem Details, không trả `index.html`. Build frontend trước
`dotnet publish`. Build output, node_modules và ảnh kiểm tra không được đưa vào Git.

`lint` là TypeScript + kiểm cú pháp JS và so sánh ID/name/CSS với repo Java khi repo đó còn ở
bên cạnh; không dùng ESLint. `test` dùng `node:test` với fetch giả lập. `smoke.mjs` tái dùng
Playwright đã cài trong `warranty-system-mysql/e2e` và Edge có sẵn, chặn **mọi API request**
bằng dữ liệu giả; không cài package mới và không ghi DB. Có thể chọn host build thật bằng
`$env:E2E_BASE_URL='http://127.0.0.1:18080'`. Cần chạy server trước.

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
fieldErrors, Java cũng đổi thứ tự này giữa các lần chạy; xem [báo cáo giai đoạn 4](../docs/MIGRATION_VERIFICATION.md).

## Soopi / Impeccable audit — 2026-10-02

Tên hiển thị đã đổi thành Soopi; CSS/layout và luồng nghiệp vụ giữ nguyên. Audit ở
`../docs/UI_AUDIT.md`: 13/20, 1 P1/4 P2/1 P3 cần xem xét; các finding chưa tự sửa.
Có thể chạy lại `node scripts/audit.mjs` khi Vite đang chạy. Script tái dùng browser/mock API của
smoke và axe-core có sẵn trong repo Java, không ghi DB hoặc cài dependency.

## Giao diện khách hàng (KLCN) — 2026-10-02

`/login`, `/register`, `/account`, `/portal` dùng giao diện web khách KLCN (`src/styles/customer.css`, phần dùng chung
`src/customer.tsx`). `/login` và `/portal` vẫn do `login.js`/`customer-portal.js` điều khiển (giữ id/name); `/register`
và `/account` dựng bằng React state, không có controller trong `src/behaviors`. Mục con của `/account` theo hash:
`#lich-su`, `#phieu/<mã>`, `#yeu-cau-moi[/<serial>]`, `#ho-so`, `#doi-mat-khau`. `node scripts/smoke.mjs` kiểm cả luồng khách.
