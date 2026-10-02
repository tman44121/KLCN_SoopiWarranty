# PROGRESS — warranty-system-soopi

Tiến độ chuyển Spring Boot → ASP.NET Core + React. Kế hoạch: `MIGRATION_PLAN.md`; quyết định: `docs/DECISIONS.md`.

## Tổng quan

| Giai đoạn | Trạng thái |
|---|---|
| 1 — Phân tích (`MIGRATION_PLAN.md`) | Xong, đã duyệt |
| 2 — Backend .NET | Xong phần code (114/114 endpoint), đã kiểm kết nối và API đọc trên `_Dev`; đã được yêu cầu tiếp tục giai đoạn 3 |
| 3 — Frontend React | Xong: 10 TSX, API/auth/roles; build/lint, 7 test và 49 kiểm tra browser đạt; chủ dự án đã yêu cầu giai đoạn 4 |
| 4 — Kiểm tra tương đương | Đã sửa HTTP/JSON/validation/phiếu thu quan sát được: **28 GET + 16 invalid POST**, 100 quan sát oracle, **45/45 unit test**; 114 route/quyền/lỗi khớp. fieldErrors có order-only diff được giữ; chờ duyệt kiểm DB có token/ghi, chưa nghiệm thu toàn bộ |

## Giai đoạn 2 — các đợt

| Đợt | Nội dung | Endpoint | Trạng thái |
|---|---|---|---|
| 1 | Khung solution, Problem Details + 86 mã lỗi, JSON, header bảo mật, CORS, health | `/actuator/health` | Xong |
| 2 | Hạ tầng chung: `Sql` (+ `ReadBatchAsync`), `TransactionRunner`, `SqlErrors`, `CodeGenerator`, `DbTime`, phân trang, nhật ký, thông báo, push (log) | — | Xong |
| 3 | Identity: JWT, refresh xoay vòng, portal token, quyền, đổi mật khẩu bắt buộc, rate limit, OTP/SMS (log), quản trị nhân viên | `/auth` (5), `/auth/mobile` (7), `/admin/employees` (7) | Xong |
| 4 | Danh mục, khách hàng, thiết bị | `/catalog` (4), `/customers` (6) + `/{code}/devices`, `/devices` (2) | Xong |
| 5 | Yêu cầu online, portal (tra cứu, gửi yêu cầu, hồ sơ, thiết bị), tệp đính kèm | `/warranty-requests` (3), `/portal` (10), `/files` (1) | Xong |
| 6 | Phiếu: tiếp nhận, phân công, chẩn đoán, sửa chữa, ghi chú, truy vấn; KTV; tìm kiếm | `/tickets` (16), `/technicians` (2), `/customers/{code}/tickets`, `/search` | Xong |
| 7 | Báo giá, kho, thu ngân, bàn giao, phiếu trên portal | `/quotations` (7), kho (18), thu ngân (3) + `/customers/{code}/payments`, bàn giao (2), `/portal/tickets*` (3) | Xong |
| 8 | Báo cáo, nhật ký, hộp thông báo + thiết bị push, job SLA | `/reports` (8), `/audit-logs` (1), `/notifications` (5) | Xong |

Đã port: **114/114** endpoint + health. Danh sách method + URL đối chiếu tự động với các controller Java: **trùng khớp 100 %**.
Job nền: dọn refresh token (02:00 giờ VN), cảnh báo SLA (5 phút).

## Kiểm chứng gần nhất (2026-10-01)

- `dotnet build Soopi.slnx --no-restore`: thành công, **0 cảnh báo, 0 lỗi**.
- `dotnet test Soopi.slnx --no-build --no-restore`: **42/42 đạt**, 0 lỗi, 0 bỏ qua — thông điệp lỗi, value object, làm tròn HALF_UP, mã nghiệp vụ, giờ VN, JSON, BCrypt hash của
  Spring, chính sách mật khẩu, khóa tài khoản, ma trận quyền, JWT, rate limit, chiếu dữ liệu khách, nhận diện tệp, yêu cầu
  online, máy trạng thái phiếu (chẩn đoán, QC, báo giá, đổi KTV), tổng/VAT báo giá, chứng từ kho, bước tiến độ portal.
- User Secrets đã có `ConnectionStrings:Default` tới `TrungTamBaoHanhDB_Dev` và `Security:DefaultResetPassword`;
  không chép giá trị bí mật vào repo. Không đọc `.env` của Java để cấu hình .NET.
- Chạy API thật ở Development, cổng kiểm tra `http://127.0.0.1:18080`, chỉ gọi GET:
  - `/actuator/health`: **200**, `{"status":"UP"}`.
  - `/api/v1/portal/catalog`: **200**, 6 nhóm thiết bị, 1 trạm, loại định danh `IMEI`, `SERIAL`.
  - `/openapi/v1.json`: **200**, 102 đường dẫn.
  - `/api/v1/customers` không token: **401**.
- Job SLA tắt trong lần kiểm tra bằng tham số `--Sla:Alerts:Enabled=false`; không gọi đăng nhập, OTP,
  endpoint ghi, EF migration hay script SQL. Job dọn refresh token chưa tới lịch 02:00 giờ Việt Nam.
- **Chưa lấy JSON mẫu từ Java; chưa kiểm API đọc có token và các luồng ghi/đồng thời trên DB.**
  Các kết quả trên xác nhận kết nối và danh mục công khai, chưa chứng minh toàn bộ nghiệp vụ tương đương.
- Frontend chưa có project nên chưa có kết quả `npm run build` / `npm run lint` cho React.

## Việc đang chờ chủ dự án

1. Giai đoạn 4 đã được yêu cầu; xem `docs/MIGRATION_VERIFICATION.md`: đã có snapshot công khai Java/.NET,
   114 method/URL khớp, build/test đạt. Chủ dự án đã chốt “sửa cho khớp tất cả”; health/route sai/Actuator,
   method-specific allowlist, malformed bearer, casing đã sửa; GET strict **28/28 đạt**.
   Đợt sửa sâu thêm JSON/coercion/nullable/date, Java text, Bean Validation, Payment/EF scale và null request body:
   **100 quan sát**, **45/45 test**, **44 HTTP case đạt nội dung** (40 strict, 4 chỉ khác thứ tự fieldErrors).
   Java cũng tự đổi thứ tự lỗi sau restart; raw diff/bằng chứng vẫn giữ, không coi là raw JSON equality.
2. Duyệt riêng login/logout để đọc API có token trên `_Dev` và các luồng ghi/đồng thời trên DB `_IT` có sẵn.
   Đăng nhập cũng ghi bộ đếm/last login, refresh token và nhật ký; chưa chạy thao tác này.

## Điểm cần đối chiếu bằng JSON mẫu (giai đoạn 4)

- `Payment.amount`: đã chứng minh Java @PostLoad bỏ scale số nguyên, giữ phần lẻ; EF converter và test tương ứng đã sửa.
  Response payment trên DB thật vẫn chờ kiểm có token. `vatRate` cần so fixture đọc/ghi.
- Instant đã ghi phần lẻ theo nhóm 3/6/9 chữ số như Java ở các giá trị oracle; DateTimeOffset vẫn có độ chính xác 100ns,
  chưa giữ toàn bộ nano hay bao phủ toàn bộ miền Instant/BigDecimal của Java.
- Thứ tự phần tử khi Java dùng `Set` (vai trò trong nhật ký).

## Lệnh

```bash
cd backend-dotnet
dotnet build
dotnet test
dotnet run --project src/Soopi.Api --launch-profile http   # http://localhost:8080, OpenAPI: /openapi/v1.json
```

## Nhật ký

| Ngày | Việc |
|---|---|
| 2026-10-01 | Giai đoạn 1: `MIGRATION_PLAN.md`. Hỏi đáp chốt D-001 → D-017. Giai đoạn 2 đợt 1–8 (114/114 endpoint, 42 test). |
| 2026-10-01 | Tiếp tục tại repo đích `warranty-system-soopi`: build 0 cảnh báo/lỗi, 42/42 test đạt; User Secrets trỏ `_Dev`; health và danh mục portal 200. Dừng trước giai đoạn React. |
| 2026-10-01 | Giai đoạn 3 theo yêu cầu Ponytail: 10 TSX và JS/CSS cũ; frontend build/lint đạt, 7/7 test; backend build cô lập 0 cảnh báo/lỗi, 42/42 test. API đọc và Vite proxy 200. Browser smoke chưa đạt sau hai lần sửa; dừng chờ chủ dự án. Chi tiết `frontend-react/README.md`. |
| 2026-10-01 | Chủ dự án yêu cầu tiếp tục giai đoạn 3: tái hiện race khi import login trễ; gắn handler đồng bộ trước paint. 49 kiểm tra trên 10 trang đạt ở Vite và ASP.NET; portal browser đọc SQL Server được 6 nhóm/1 trạm. Giai đoạn 3 xong, chờ duyệt giai đoạn 4. |
| 2026-10-02 | Giai đoạn 4 theo Ponytail: 114 route, 7 role/39 quyền, 86 lỗi/status khớp; metadata `_Dev` 47 bảng/404 cột. Java WAR và .NET chỉ GET: catalog và 5 lỗi thiếu token khớp; health/route sai/Actuator khác. Backend 42/42, frontend 7/7, smoke 49 đạt. Báo cáo `docs/MIGRATION_VERIFICATION.md`; chưa nghiệm thu DB có token/ghi, đã dừng server kiểm tra. |
| 2026-10-02 | Theo yêu cầu sửa khớp Java: middleware security trước routing như hai SecurityFilterChain, health thêm groups, static denial/Problem Details, bearer sai/rỗng và casing. Strict live **28/28 khớp**, OpenAPI 114 API operation; .NET build 0 warning/error, 42/42 test; React build/lint, 7/7 test và smoke 49 đạt. Không login/ghi DB, không sửa Java. |
| 2026-10-02 | Tiếp tục “sửa cho khớp tất cả”: oracle Jackson/Hibernate/Payment từ WAR có 100 quan sát; sửa JSON, Java text, Bean Validation, Payment/EF scale và lỗi null body. 45/45 test, build 0 warning/error; React build/lint, 7/7 và smoke 49 đạt. 44 HTTP case đạt nội dung, 4 raw diff chỉ fieldErrors order; Java restart cũng đổi thứ tự ở 6 case. Không login/ghi DB; đã dừng server kiểm tra. |
| 2026-10-02 | Giao diện khách theo KLCN (D-045): `/login` đổi giao diện, thêm `/register`, `/account`, `/portal` đổi giao diện; landing CUSTOMER `/account`. React build/lint, 7/7 test; smoke **77 kiểm tra** (thêm luồng đăng ký OTP, tổng quan, lịch sử, báo giá, gửi yêu cầu, hồ sơ, đổi mật khẩu ở 1440/390 px, mock API). Backend 0 warning/error, 45/45 test. Chưa thử OTP/đăng ký trên DB thật. |
| 2026-10-02 | Bộ màu và logo soopiwarranty cho giao diện khách (`customer.css` biến `--kh-*`; logo, wordmark sáng/tối, favicon trong `public/images/brand/` do backend cho phép prefix `/images`). 3 CSS gốc không đổi; lint, 7/7 test, smoke 77 kiểm tra đạt; detector 0 finding. |
| 2026-10-02 | Bộ màu và logo soopiwarranty cho 8 màn nội bộ: `src/styles/brand.css` chỉ ghi đè token `:root` của tokens.css (3 CSS gốc giữ nguyên byte), logo thay chữ "Soopi" trên sidebar. Sửa class `page-title*` của customer.css trùng với màn nội bộ (đổi thành `kh-page-title*`). Lint, 7/7 test, smoke 77 kiểm tra đạt; smoke chụp thêm mỗi màn nội bộ. |
| 2026-10-02 | Sửa điều hướng header/footer khách: khách đã đăng nhập (cả trên `/portal`) thấy menu tài khoản và link `/account`; khách vãng lai/nhân viên dùng `/portal`, `/portal#dang-ky` (mở form yêu cầu công khai) và `/login?next=/account#lich-su`. Smoke 85 kiểm tra đạt. |
| 2026-10-02 | Phiên nhân viên không còn được tự vào khu khách: `login.js` không tự tiếp tục khi `next` là `/account*` mà tài khoản không có vai trò CUSTOMER (hiện form + thông báo); `auth.js` đưa nhân viên mở `/account` về `/login?next=` thay vì màn nội bộ. Smoke 88 kiểm tra đạt. |
| 2026-10-02 | Chạy trọn luồng nghiệp vụ trên DB `_Dev` thật qua giao diện (`frontend-react/scripts/screenshots.mjs`, 70 ảnh trong `docs/screenshots/`): tiếp nhận → phân công → chẩn đoán → báo giá → duyệt → khách đồng ý → xuất kho → QC → thu tiền → bàn giao (TN-2026-1002-00001). **Sửa lỗi** tạo báo giá: INSERT `PhieuBaoGia` lệch thứ tự cột so với giá trị (mã dịch vụ vào cột tiền → 500; không chọn dịch vụ thì ghi sai cột mà không báo lỗi); INSERT/UPDATE nay dựng từ cùng danh sách cột. Backend 45/45 test. |

## Giai đoạn 3 — kiểm chứng và giới hạn

### Bổ sung 2026-10-02 — Soopi và Impeccable audit

- Đổi brand hiển thị ở index/10 trang/sidebar/portal/phiếu in, default push và SMS OTP thành Soopi.
- Audit 10 trang ở 1440/390 px: axe 0 violation trong trạng thái đã quét, có các kiểm tra incomplete;
  Impeccable detector 0 finding. Audit thủ công ghi 1 P1, 4 P2, 1 P3; **13/20**, không coi là chứng nhận WCAG.
- Build/lint frontend đạt; 7/7 test; smoke 49 kiểm tra. Backend build 0 cảnh báo/lỗi, 42/42 test.
- API thật chỉ GET: health 200/UP, catalog 200 (6 nhóm, 1 trạm), login HTML 200 có tên Soopi.
- Chi tiết/phạm vi/đề xuất: `docs/UI_AUDIT.md`. Không tự sửa finding hoặc thực hiện giai đoạn 4.

- React Router quản lý 10 route; TSX giữ cấu trúc/trường cũ, module JS giữ xử lý DOM động,
  điều hướng giữa trang tải lại tài liệu. Đây là cầu nối tối thiểu, chưa chuyển toàn bộ logic UI sang React state.
- `npm.cmd run build`, `npm.cmd run lint`: đạt. Build có 2 cảnh báo `use client` từ React Router
  và cảnh báo chunk trên 500 kB (601,57 kB, gzip 149,51 kB).
- `npm.cmd test`: 7/7 đạt; syntax JS, ID/name 10 trang và 3 CSS khớp bản gốc.
- Build backend mặc định gặp MSB3027/MSB3021 do `Soopi.Api.exe` bị tiến trình đang chạy giữ;
  không dừng tiến trình của người dùng. `dotnet build Soopi.slnx --artifacts-path artifacts/stage3`:
  **0 cảnh báo, 0 lỗi**. `dotnet test Soopi.slnx --artifacts-path artifacts/stage3 --no-build --no-restore`:
  **42/42 đạt**.
- API kiểm tra cổng 18080: health 200/UP, portal catalog 200; Vite 5173 proxy catalog 200;
  `/login` 200 HTML, API không tồn tại 404 Problem Details. Chỉ GET thật; SLA tắt, job cleanup chưa tới lịch.
- Browser dùng Edge/Playwright đã có, mock toàn bộ API: **49 kiểm tra đạt trên 10 trang**,
  cả Vite 5173 và build ASP.NET 18080. Đã kiểm đổi mật khẩu bắt buộc, chọn vai trò,
  logout, role guard, URL cũ/query/hash, validation/multipart portal; 14 request ghi giả lập mỗi lần.
- Timeout đăng nhập đã xác định: module nhập động đến sau khi form hiển thị, bấm sớm
  kích hoạt GET form mặc định. `runtime.ts` dùng module sẵn và gắn handler trước paint;
  hồi quy trì hoãn module 1,5 giây và cấm query `password` đạt. Không dùng chờ tùy ý để che lỗi.
- Portal browser đọc qua Vite proxy thật: 6 nhóm thiết bị, 1 trạm, không lỗi JS. Proxy lần đầu
  502 do kiểm API ở 18080 khác mặc định 8080; cấu hình env cho lần kiểm tra rồi đọc thành công.
- Chưa kiểm nghiệp vụ ghi trên DB thật hoặc kết luận tương đương; dành cho giai đoạn 4 sau khi duyệt.
- Đã dừng hai server kiểm tra do agent khởi chạy. Git status Java vẫn giống ban đầu;
  không ghi file Java, không chạy SQL/EF migration hoặc endpoint ghi thật.
- Chờ xác nhận thời gian portal (placeholder khoảng thời gian nhưng parser một thời điểm + 1 giờ),
  UI tối đa 3 tệp khác backend 5. Chi tiết và lệnh chạy: `frontend-react/README.md`.
