# Giai đoạn 4 — đối chiếu Java → Soopi

Ngày kiểm: **2026-10-02**, SQL Server `TrungTamBaoHanhDB_Dev`, schema `dbo`.

**Đã đối chiếu phần code, build/test, frontend giả lập và API đọc công khai. Chưa nghiệm thu tương đương toàn bộ.**
114 method/URL có implementation; ma trận quyền và mã lỗi khớp. JSON catalog khớp thực tế.
Theo yêu cầu “sửa cho khớp tất cả”, đã sửa các lệch HTTP, JSON, validation và phiếu thu tìm được.
**28/28 GET khớp status/body/Content-Type; 16 POST bị từ chối trước service có cùng status và nội dung lỗi.**
Trong lần kiểm cuối: 40/44 response khớp cả thứ tự mảng, 4 khác duy nhất thứ tự `fieldErrors`;
Java tự đổi thứ tự này sau khi khởi động lại (có bằng chứng). Snapshot/diff gốc vẫn được giữ.
Oracle độc lập từ thư viện WAR có **100 quan sát**, backend **45/45 test đạt**.
Chưa kiểm đăng nhập, API có token, transaction
và luồng ghi DB thật; chưa nghiệm thu toàn bộ nghiệp vụ. Tên Soopi/route React theo các quyết định đã chốt được giữ.

## 1. Phạm vi và bằng chứng

- Nguồn Java: `../warranty-system-mysql`, chỉ đọc. Không build Java trong repo gốc.
- Đích: `backend-dotnet/`, `frontend-react/` trong `warranty-system-soopi`.
- Chạy WAR sẵn có của Java ở `127.0.0.1:18081`; .NET ở `127.0.0.1:18080`.
  Credentials lấy trong bộ nhớ từ User Secrets đang có, không đọc `.env`, không lưu secret vào snapshot.
- Java: profile `verification`, `--app.sla.alerts.enabled=false`, `--spring.sql.init.mode=never`,
  `--spring.jpa.hibernate.ddl-auto=none`; thư mục làm việc/lưu tệp trỏ repo đích.
- .NET: Development, `--Sla:Alerts:Enabled=false`. Cleanup refresh token chờ 02:00 giờ VN ngày tiếp theo;
  phiên kiểm chạy sau 06:50 và đã dừng, không tới lịch cleanup.
- DB thật chỉ được đọc: GET và SELECT metadata `sys.tables/sys.columns/sys.types/sys.schemas`.
  Thêm 16 POST thiếu trường bắt buộc/body hỏng: bị `@Valid`/model binding từ chối 400 trước controller/service,
  không thực hiện login/OTP/register/reset. Không login thành công, refresh, logout, upload, ghi DB, SQL script hay EF migration.
- Browser chạy Edge/Playwright có sẵn, mock toàn bộ API; 14 request ghi trong smoke là giả lập.
- WAR có **37 resource khớp byte** với nguồn, không có Java source mới hơn WAR.
  Giới hạn: timestamp/resource không chứng minh tuyệt đối bytecode khớp mọi source; không có build Java mới.
- Git status repo Java cuối phiên giống danh sách thay đổi có sẵn đầu phiên; agent chỉ tạo/sửa file ở repo đích.

Bằng chứng lưu trong:

- [Endpoint appendix](../verification/ENDPOINTS.md): toàn bộ 114 endpoint, controller Java/.NET.
- [Kết quả đối chiếu](../verification/results.json): route, quyền, lỗi, tham chiếu 47 bảng, SHA-256 WAR,
  44 so sánh HTTP thực tế, giữ raw diff và cờ `field_error_order_only`, đủ 114 API operation trong OpenAPI.
- [Metadata DB đọc thực tế](../verification/schema-dev.json): **47 bảng, 404 cột**; không chứa dữ liệu khách/tài khoản.
- [JSON Java](../contract-snapshots/java.json), [JSON .NET](../contract-snapshots/dotnet.json): **28 GET + 16 POST bị từ chối mỗi backend**,
  health/catalog, thiếu token, bearer sai/rỗng, sai method, URL không tồn tại và khác hoa thường.
  Không có access token thật; Correlation ID cố định `stage4-readonly`.

## 2. Entity, bảng và quan hệ — mục 1 của kế hoạch

**Trạng thái: đã có mapping/access layer; DB hiện tại đọc được. Chưa kiểm toàn bộ mapping bằng CRUD.**

- Đối chiếu tên bảng trong `01_schema.sql` với metadata `_Dev`: **47/47**, không thiếu/thừa bảng `dbo`.
- **52 khai báo `HasColumnName`** trong `AppDbContext` đều trỏ cột tồn tại trên `_Dev`.
  Đây là kiểm tên cột; chưa chứng minh mọi SQL, kiểu dữ liệu, nullability, precision, FK và constraint đều đúng khi ghi.
- EF map 7 bảng: `TaiKhoan`, `TaiKhoan_VaiTro`, `RefreshToken`, `KhachHang`, `ThietBi`,
  `HoaDon_PhieuThu`, `NhanVien` (chỉ liên kết tài khoản).
- Aggregate phiếu và chứng từ dùng SQL theo D-031; không bắt buộc số entity EF bằng 21 entity/collection JPA.
  `TicketStore` tăng `PhienBan` với điều kiện phiên bản cũ; nạp 11 result set trong một lệnh theo D-032.
- Quan hệ vẫn dùng FK/schema hiện có; không tạo hay cập nhật schema.
- 4 bảng không có tham chiếu tên trong mã .NET: `DanhMucNhan`, `ChuyenTrangThaiHopLe`, `QuyenHan`,
  `VaiTro_QuyenHan`. Mã Java cũng không tham chiếu trực tiếp 4 bảng này; luật/nhãn/quyền nằm trong code,
  bảng seed/tham chiếu được giữ nguyên. Không kết luận “thiếu 4 chức năng”.
- `VaiTro` vẫn được truy cập qua catalog. Danh sách file tham chiếu từng bảng nằm trong `results.json`;
  tìm thấy tên bảng chỉ chứng minh có tham chiếu, không chứng minh query đã chạy.

| Nhóm trong kế hoạch | Bảng giữ nguyên / access layer |
|---|---|
| Hệ thống, tài khoản | DanhMucNhan; ChuyenTrangThaiHopLe; BoDemMa; VaiTro; QuyenHan; VaiTro_QuyenHan; TaiKhoan; TaiKhoan_VaiTro; RefreshToken; TramDichVu; NhanVien; KhachHang; MaXacThucOTP; ThietBiNhanThongBao — AppDbContext, AccountStore, IdentityStores, StaffDirectory, PushDeviceStore, CodeGenerator |
| Danh mục, thiết bị | NhomThietBi; LoaiThietBi; HangSanXuat; HangSanXuat_NhomThietBi; SanPham; ChinhSachBaoHanh; BangGiaDichVu; ThietBi — CatalogStore, ProductCatalog, EF Device |
| Yêu cầu/tệp | YeuCauBaoHanh; TepDinhKem — WarrantyRequestStore, AttachmentService/FileStorage |
| Phiếu/sửa chữa | PhieuTiepNhan; LichSuTrangThai_ThietBi; GhiChuPhieu; PhanCong; LichSuPhanCong; PhieuKiemTra; PhieuSuaChua; KetQuaSuaChua; PhieuBanGiao — TicketStore |
| Báo giá/kho/thu tiền | PhieuBaoGia; ChiTietBaoGia; NhaCungCap; LinhKien; TonKhoTheoKe; PhieuNhapKho; ChiTietNhapKho; PhieuXuatKho; ChiTietXuatKho; PhieuDieuChuyen; HoaDon_PhieuThu — QuotationStore, InventoryStores, EF Payment |
| Nhật ký/thông báo | NhatKyThaoTac; ThongBao; ThongBao_DaDoc — AuditService, NotificationService/QueryService |

## 3. Controller và endpoint — mục 2 của kế hoạch

**Trạng thái: 114/114 có method/URL tương ứng; chưa chứng minh 114/114 response/validation/phân quyền tương đương.**
Đối chiếu URL chuẩn hóa tên placeholder (`{customerCode}`/`{code}`), giữ method và cấu trúc đường dẫn.
Parser chỉ hỗ trợ annotation/attribute literal của repo này, fail nếu số endpoint không đúng 114 hoặc trùng route.

| Controller Java | Số endpoint | Implementation .NET | Kiểm thực tế / còn thiếu |
|---|---:|---|---|
| AuthController | 5 | Controllers/Identity/AuthController.cs | GET me thiếu token khớp 401; login/refresh/logout/change-password chưa kiểm DB |
| MobileAuthController | 7 | Cùng file AuthController.cs | Có route; mobile login/refresh/OTP/register/reset chưa kiểm DB |
| AdminEmployeeController | 7 | Identity/AdminEmployeesController.cs | Có route; tạo/sửa/roles/lock/reset chưa kiểm DB |
| CustomerController | 6 | CatalogCustomerDeviceControllers.cs | GET danh sách thiếu token khớp 401; CRUD/archive/merge chưa kiểm DB |
| CustomerDeviceController | 1 | Cùng file catalog/customer/device | Có route; response có token chưa đối chiếu |
| DeviceController | 2 | Cùng file catalog/customer/device | Có route; lookup/register chưa kiểm dữ liệu thật |
| CustomerTicketController | 1 | TicketControllers.cs | Có route; response có token chưa đối chiếu |
| TicketController | 18 | TicketControllers.cs + controller bàn giao trong QuotationInventoryBillingControllers.cs | GET danh sách thiếu token khớp 401; các thao tác phiếu chưa kiểm DB |
| TechnicianController | 2 | TicketControllers.cs | Có route; workload/queue có token chưa kiểm |
| QuotationController | 7 | QuotationInventoryBillingControllers.cs | Có route; lập/sửa/duyệt/quyết định chưa kiểm DB |
| InventoryController | 18 | Cùng file quotation/inventory/billing | Có route; xuất/nhập/điều chuyển chưa kiểm DB |
| PaymentController | 3 | Cùng file quotation/inventory/billing | Có route; billing/thu tiền/miễn phí chưa kiểm DB |
| CustomerPaymentController | 1 | Cùng file quotation/inventory/billing | Có route; response có token chưa đối chiếu |
| WarrantyRequestController | 3 | PortalRequestFileControllers.cs | Có route; danh sách/detail/cancel có token chưa kiểm |
| PortalController | 13 | PortalRequestFileControllers.cs | Catalog khớp; my/profile thiếu token khớp 401; scope/multipart/quyết định chưa kiểm DB |
| FileController | 1 | PortalRequestFileControllers.cs | GET thiếu token khớp 401; ownership/download thật chưa kiểm |
| CatalogController | 4 | CatalogCustomerDeviceControllers.cs | Có route; GET có token và ghi danh mục chưa kiểm |
| ReportController | 8 | ReportNotificationControllers.cs | Có route; kết quả aggregate/scale trên dữ liệu thật chưa kiểm |
| AuditLogController | 1 | Cùng file report/notification | Có route; đọc/append-only theo quyền chưa kiểm DB |
| NotificationController | 5 | Cùng file report/notification | Có route; read/read-all/push device chưa kiểm DB |
| SearchController | 1 | TicketControllers.cs | Có route; quyền/LIKE/phân trang có token chưa kiểm |

OpenAPI Development trả **200, 113 paths / 126 operations**: đủ 114 operation `/api/v1`, thêm 12 GET
health/root/redirect HTML cũ. Không thiếu operation API trong so sánh tập route đọc từ OpenAPI.
Con số paths trước đây trong PROGRESS là lịch sử, không phải kết quả phiên này.

## 4. 10 trang → React — mục 3 của kế hoạch

**Trạng thái: đã chuyển 10 TSX/route; ID/name và 3 CSS khớp bản gốc; smoke dùng API giả lập đạt.**
Nguồn không có Thymeleaf: 10 HTML tĩnh + JS gọi REST. React vẫn dùng module JS quản lý DOM động;
đây là bridge đã ghi ở DECISIONS, không phải mọi form/table đã dùng React state.

| Trang Java | React route / file trong src/pages | Dữ liệu/form đối chiếu | Kiểm / giới hạn |
|---|---|---|---|
| login.html | /login — login.tsx | Login, remember, đổi mật khẩu bắt buộc | Smoke login, validation, đổi mật khẩu, nhiều vai trò/logout; API giả lập |
| index.html | /dispatch — dispatch.tsx | Phiếu/SLA, báo giá, workload; phân công/duyệt | Login/role/API binding/console đạt; transaction thật chưa kiểm |
| receptionist.html | /receptionist — receptionist.tsx | Yêu cầu online, khách/thiết bị; tiếp nhận/đồng ý báo giá thay khách | ID/name giữ; binding/role đạt; chưa kiểm tạo phiếu thật |
| technician.html | /technician — technician.tsx | Queue, chẩn đoán, báo giá, xuất, sửa, QC, ghi chú | Binding/role đạt; unit test aggregate có QC; chưa E2E dữ liệu thật |
| warehouse.html | /warehouse — warehouse.tsx | Tồn, nhập, xuất, điều chuyển; tab/hash | Binding/role đạt; chưa kiểm cộng/trừ/giữ tồn thật |
| cashier.html | /cashier — cashier.tsx | Billing, thu tiền/miễn phí, chữ ký và bàn giao | Binding/role đạt; chưa ghi payment/file thật |
| tickets.html | /tickets — tickets.tsx | Bộ lọc, phân trang, detail/history/billing | Binding/role đạt; dữ liệu/ownership thật chưa kiểm |
| reports.html | /reports — reports.tsx | SLA, performance, audit | Binding/role đạt; chưa so aggregate thật |
| admin.html | /admin — admin.tsx | Nhân viên/roles, danh mục, biểu đồ | Binding/role đạt; chưa kiểm account/catalog mutation |
| customer-portal.html | /portal — portal.tsx | Lookup, tiến độ/báo giá, gửi yêu cầu multipart | Required/error/multipart/invalid date đạt bằng mock; catalog thật khớp |

Smoke giữ query/hash và URL HTML cũ; kiểm role guard, logout, token portal không refresh theo staff,
lỗi validation, boundary multipart, lỗi mạng, escape HTML. Không suy ra tất cả modal/thao tác đã E2E.
Impeccable audit trước đó: [UI_AUDIT.md](UI_AUDIT.md), 13/20, 1 P1/4 P2/1 P3; không sửa/redesign ở giai đoạn 4.

## 5. Service/nghiệp vụ — mục 4 của kế hoạch

“Có code” dưới đây là đối chiếu implementation/nguồn và test đã có. “Chưa kiểm DB” là điều kiện nghiệm thu còn thiếu.

| Nhóm / logic quan trọng | Code/test đã có | Chưa kiểm / cần xác nhận |
|---|---|---|
| ErrorCode/Problem Details/validation | 86 tên lỗi + status khớp; 100 quan sát oracle JSON/validation/text/payment; 16 POST invalid DTO/body khớp nội dung lỗi; null body đã sửa | Validation HTTP lồng nhau, constraint SQL và DTO có token chưa so thực tế; thứ tự fieldErrors không ổn định ở Java |
| Sinh mã/giờ/tiền | CodeGenerator MERGE HOLDLOCK; DbTime VN→UTC, HALF_UP; SharedTests đạt | Sinh mã đồng thời, format số/scale/thời điểm trả ngay sau ghi chưa so thực tế |
| Transaction/SQL | READ COMMITTED, retry 3 lần concurrency/deadlock/timeout, LOCK_TIMEOUT 10000, AfterCommit | Rollback, retry và callback sau commit chưa integration test |
| Tiếp nhận/phân công | ReceptionService, AssignmentService, StaffDirectory, Ticket aggregate/Store | Một phiếu mở, capacity KTV, chuyển yêu cầu online và snapshot cần fixture thật |
| Chẩn đoán/sửa/QC | TicketTests kiểm warranty hết hạn/lý do/reclass, FREE flow/history, QC 6 bước, transition, đổi KTV | Phân quyền assigned employee và update aggregate qua SQL chưa kiểm thật |
| Báo giá | QuotationServices/Store; test totals/VAT HALF_UP, tự duyệt/hạn/quyết định | Một báo giá hiệu lực, cập nhật chéo phiếu/history/notification chưa kiểm DB |
| Kho | InventoryServices/Stores; test trạng thái chứng từ; UPDATE có điều kiện giữ/trừ tồn, khóa chứng từ | Bất biến tổng tồn=kệ, không âm, hai người duyệt, trả giữ khi reject chưa kiểm DB |
| Thu ngân | PaymentService kiểm ACTIVE CASHIER, COMPLETED, báo giá đúng phiếu/ACCEPTED, expectedAmount, một lần thu; miễn phí 0/NONE. Payment trim/null note và EF đọc integral scale đã sửa theo oracle Java | Chưa có test service tích hợp payment; chưa kiểm unique/race/rollback |
| Bàn giao | HandoverService: đã thanh toán/miễn phí, PNG ≤200 KB, 5 mục, hạn bảo hành linh kiện | Chưa E2E chữ ký/file cleanup/transaction lỗi; cần DB riêng |
| Khách/thiết bị | CustomerService/DeviceService; CustomerDataPolicy, Phone/IMEI tests | Merge/archive/account transfer, unique serial/SĐT, chính sách BH thật chưa kiểm |
| Yêu cầu/portal/tệp | PortalServices, WarrantyRequestService, AttachmentService; magic bytes/size/data projection tests | Scope của portal token, owner, các file rollback, UI 3/backend 5 và khoảng thời gian cần xác nhận |
| Identity/account admin | AuthService, OTP, EmployeeAdminService, AccountPolicy; BCrypt Spring/JWT/password/lock/rate limit/roles tests | Refresh rotation/reuse, CSRF/origin/cookie, admin cuối, mobile OTP/register/reset chưa integration |
| Reports/search/audit/notification | 8 report routes, search, audit, notification/query/push device đã có code | Response thật, scale/Set ordering và từng quyền chưa đối chiếu |
| Jobs/integrations | Cleanup lịch 02:00 được unit test; SlaAlertJob, push/SMS log có code | Job ghi đã tắt/chưa tới lịch; eSMS/FCM thật chưa chuyển theo D-003 |

Không có chức năng controller trong kế hoạch bị thiếu method/URL qua kiểm tĩnh. Những mục “chưa kiểm”
không được đánh dấu tương đương chỉ vì compile, route hoặc test helper đạt.

## 6. Bảo mật, cấu hình, thư viện — mục 5–7 của kế hoạch

- Spring Security resource server → JwtBearer RS256, TTL/issuer/claims giữ theo D-004.
  `SpringSecurityBoundaryMiddleware` chép quy tắc public URL/method của hai Java SecurityFilterChain;
  API bảo vệ cả route không match/sai method; các static URL ngoài allowlist trả 403 không body.
  Bearer filter chỉ chạy dưới `/api/**`, kiểm prefix/path phân biệt hoa thường như Java;
  bearer sai/rỗng vẫn trả 401 trên URL API công khai. React route/assets và OpenAPI dev là phần đã chốt của kiến trúc mới.
  Có middleware buộc đổi mật khẩu, refresh-cookie Origin + X-Requested-With, CurrentActor kiểm permission ở service.
  So sánh đủ 7 role/39 permission và từng tập quyền đạt; chưa chứng minh mọi service guard qua HTTP.
- Cookie giữ `LML_RT`, HttpOnly, Secure, Strict, Path `/api/v1/auth`; mobile refresh trong body.
  Dev khóa tạm/Production PEM, BCrypt tiền tố Spring; không đổi phương án auth trong phiên này.
- CORS Development cho localhost:5173/8080; build React phục vụ cùng origin qua ASP.NET.
- SQL Server EF/manual SQL giữ bảng/cột; Bean Validation → attribute validation/MultipartJson;
  Jackson → System.Text.Json; Spring transaction → TransactionRunner; scheduled → BackgroundService;
  DiskFileStorage → FileStorage; Clock → TimeProvider. Mapping công nghệ đã có implementation, không thêm package.
- Connection string placeholder ở appsettings; secret thật chỉ User Secrets/env. Không chép secret vào code/report.
- Upload request tối đa 100 MB; ảnh ≤5 MB/video ≤30 MB, nhận diện magic bytes; chữ ký ≤200 KB PNG.
  Chưa test HTTP quá dung lượng hoặc upload thật trong phiên này.
- Email: không phát hiện luồng gửi email cần chuyển trong kế hoạch; không thêm email provider.
- Không thêm NuGet/npm/test framework. Tái dùng xUnit, Node test, Edge/Playwright có sẵn;
  script đối chiếu dùng Python stdlib. Frontend lint là TypeScript + check syntax/parity, không phải ESLint.

## 7. Khác biệt và lý do — mục 8 / yêu cầu giai đoạn 4

| Mã | Khác biệt/hành vi | Nguồn / lý do / trạng thái |
|---|---|---|
| V-01 | Health trước đây thiếu `groups` ở .NET | **Đã sửa, khớp** `{"groups":["liveness","readiness"],"status":"UP"}`; 200, kể cả header bearer sai. Shape theo WAR hiện đang kiểm; DB DOWN/Production chưa kiểm |
| V-02 | API route không tồn tại, thiếu token trước đây trả 404 ở .NET | **Đã sửa, khớp** 401 AUTH_TOKEN_INVALID; middleware kiểm security trước dispatch. API 404 sau token hợp lệ chưa integration test |
| V-03 | info/liveness/readiness trước đây trả 404 ở .NET | **Đã sửa, khớp** 403 không body. Đọc SecurityConfiguration cho thấy static chain `denyAll` các URL này, kể cả người có token; không mở thêm endpoint vận hành |
| V-04 | Landing/link thông báo dùng route React; HTML cũ redirect 301, giữ query/hash | Đã chốt D-011/D-041. Thông báo cũ được dịch phía client; không sửa DB cũ |
| V-05 | Tên hiển thị/app title/receipt/push/SMS mặc định là Soopi | Theo yêu cầu đổi tên. Giữ issuer/error URI/cookie và tên kỹ thuật để giữ contract |
| V-06 | React TSX/router + JS imperative, tải lại tài liệu giữa trang; frontend API dùng env base URL | Bridge giai đoạn 3 đã ghi DECISIONS. Chưa thuần React state; UI/CSS/form giữ bản cũ |
| V-07 | Portal ngày không parse được: React báo validation thay vì RangeError khi toISOString | Guard đã bổ sung giai đoạn 3; smoke hồi quy đạt. Ý nghĩa khoảng giờ vẫn cần xác nhận |
| V-08 | Nạp aggregate/thông báo bằng SQL batch, không ConcurrentReads; aggregate phiếu không EF tracking 9 bảng | D-031/D-032/D-040 đã ghi; tránh DbContext đa luồng. Chưa so performance/concurrency thực tế |
| V-09 | Thiếu reset password config: .NET báo lỗi khi reset; Java kiểm cấu hình lúc khởi động | D-012 đã chốt; không có password mặc định trong code .NET |
| V-10 | SMS/push chỉ log, cấu hình provider thật bị từ chối lúc startup | D-003 đã chốt; không nghiệm thu eSMS/FCM production trong phạm vi hiện tại |
| V-11 | Response tạo/đọc có token và thứ tự vai trò Java Set so .NET | Chưa lấy response có token/ghi. Format phần lẻ và scale EF Payment đã sửa theo oracle (V-15/V-16), nhưng chưa kiểm luồng lưu/đọc thật; giữ đây là rủi ro tích hợp |
| V-12 | Bundle JS 601,29 kB do module nạp sẵn để tránh form handler đến trễ | Giới hạn bridge; build cảnh báo chunk >500 kB, không bỏ handler an toàn chỉ để chia chunk |
| V-13 | API công khai với bearer sai/rỗng trước đây vẫn trả catalog 200 | **Đã sửa, khớp** 401; thử cả `Bearer`, bearer rỗng, prefix sai, bearer thường. Header Basic vẫn bị bỏ qua như Java, catalog 200 |
| V-14 | GET portal/warranty-requests và URL `/API/**`, `/JS/**`, URL static không cho phép / file JS thiếu trước đây khác status/body | **Đã sửa, khớp** method-specific allowlist, prefix/path case-sensitive, static denyAll, routing error Problem Details. 28 phép so không có diff |
| V-15 | JSON enum trước đây nhận sai chữ thường/tên ghép, từ chối ordinal; scalar/nullable/ngày và validation khác Java | **Đã sửa theo oracle** Jackson Boot thật: tên enum phân biệt hoa/thường, ordinal hợp lệ, string/bool/int coercion, nullable empty/`null`, LocalDate, Instant UTC với phần lẻ nhóm 3/6/9 chữ số. NotBlank/Pattern/Email và Java trim/blank ở domain, báo giá/thu tiền/yêu cầu cũng đã sửa. 100 quan sát, không kết nối DB |
| V-16 | Payment trước đây trim note sai, reject tiền lẻ/normalize scale khi tạo và đọc EF thiếu PostLoad | **Đã sửa** constructor giữ amount/scale, note blank→null/Java trim; EF converter chỉ bỏ scale khi đọc số nguyên, giữ `12.50`. Không đổi cột `decimal(18,2)` hay dữ liệu |
| V-17 | Body `null` trước đây trả một lỗi tiếng Anh ở field rỗng | **Đã sửa**, cùng Java unreadable body: 400 VALIDATION_FAILED với `fieldErrors: []`; có unit test + HTTP snapshot |
| V-18 | Thứ tự mảng `fieldErrors` khác giữa framework | **Không có thứ tự cố định để tái tạo**: Java đổi thứ tự ở 6/16 case khi khởi động lại JVM. Checker chỉ so mảng lỗi này theo multiset, giữ số lần xuất hiện/field/message và mọi trường khác; raw diff vẫn lưu. Không sort response app hay mảng nghiệp vụ |
| V-19 | Phạm vi kiểu dữ liệu .NET khác Java | `DateTimeOffset` chính xác 100ns, không giữ nano thấp hơn; `decimal` có giới hạn precision/range so với BigDecimal, lịch .NET không bao trùm mọi năm của Java. Oracle hiện chưa chứng minh toàn bộ miền giá trị; IDN Unicode cũng cần case bổ sung. Không suy từ 100 quan sát thành tương đương mọi input |

UI “3 tệp” so backend tối đa 5, placeholder khoảng giờ so parser một thời điểm +1 giờ,
desktop nội bộ min-width 1280, lỗi không liên kết aria, sort bằng chuột, title thu ngân `&amp;`
được ghi trong UI audit/README. Đây là vấn đề/không rõ của bản gốc giữ lại, không tự đổi nghiệp vụ.

## 8. Kết quả lệnh thực tế

| Lệnh / phép kiểm | Kết quả |
|---|---|
| `dotnet build Soopi.slnx --artifacts-path artifacts/stage4` | Exit 0; 0 warning, 0 error. Output cô lập để không đụng binary tiến trình người dùng |
| `dotnet test Soopi.slnx --artifacts-path artifacts/stage4 --no-build --no-restore` | Exit 0; **45/45**, 0 failed, 0 skipped |
| `npm.cmd run build` | Exit 0; 55 modules; JS **601,29 kB / gzip 149,48 kB**, CSS 42,80 kB / gzip 7,93 kB; 2 cảnh báo use client + 1 chunk >500 kB |
| `npm.cmd run lint` | Exit 0; TypeScript, JS syntax, 10 trang ID/name, 3 CSS giữ nguyên |
| `npm.cmd test` | Exit 0; **7/7**, 0 failed/skipped |
| `E2E_BASE_URL=http://127.0.0.1:18080 node scripts/smoke.mjs` | Exit 0; **10 trang, 49 kiểm tra**, 14 mocked writes; không ghi DB thật |
| `python verification/compare.py` | Exit 0; **114 route**, 7 role/39 permission/tập quyền, 86 tên lỗi/status, 47 bảng tham chiếu |
| `python verification/compare.py --live` | **Exit 0**, **44/44** status và nội dung contract khớp; 40 strict, 4 raw diff chỉ là thứ tự fieldErrors. 28 GET + 16 POST bị từ chối trước service mỗi server, không ghi DB |
| `java --class-path 'verification/artifacts/java-probe/classes;verification/artifacts/java-probe/lib/*' verification/JavaContractProbe.java verification/java-domain-snapshots.json` | Exit 0; **100 quan sát**: 46 JSON primitive/enum/Instant, 17 nullable/date/decimal, 25 validation, 9 Java text, 3 Payment. Chỉ Jackson auto-config + Hibernate Validator, không Spring app/DB context |
| `dotnet test ... --filter FullyQualifiedName~JavaContractTests` | Test mới tái hiện lệch trước sửa; kết quả cuối trong full suite: 3/3 đạt (oracle JSON/validation/text, Payment/EF model, null body) |
| Public/unauthenticated contract | Catalog 200 khớp (6 nhóm/1 trạm), health/groups 200 khớp; lỗi 401/403/404/405, malformed bearer, path case-sensitive đều khớp |
| OpenAPI GET | 200; đủ 114 API operation. Script lọc `/api/v1/` để so controller, các GET health/root/redirect được kiểm theo phạm vi riêng |
| Metadata SELECT | 47 bảng/404 cột; tên bảng đúng schema file, 52 tên cột map EF tồn tại |

Lịch sử: phiên đối chiếu đầu đã dừng sau hai lần sửa parser, strict live fail ở health.
Chủ dự án yêu cầu “sửa cho khớp tất cả” và cho tiếp tục sửa phần này. Đã tái hiện 21 case đỏ trước sửa app,
sau đó thêm 7 case casing/header, tái hiện chênh lệch rồi sửa ở middleware chung. Kiểm cuối **28/28 đạt**.

Checker chấp nhận body rỗng (`None`), không biến nó thành JSON giả; ghi toàn bộ snapshot/diff trước assertion,
lọc đúng phạm vi OpenAPI API. `--live` cần hai server đang chạy. Diff nội dung luôn exit 1; chỉ hoán vị
`fieldErrors` của VALIDATION_FAILED/400 được đánh dấu riêng sau chứng minh Java không ổn định.
Có self-check đảm bảo thiếu/thừa lỗi, đổi message/status/trường khác vẫn thất bại.
Metadata DB là kết quả SELECT ở phiên đối chiếu đầu, không chạy lại schema/seed/migration trong phiên sửa.

File sửa đợt HTTP: `Program.cs`, `Infrastructure/Security/AuthSetup.cs`, `verification/compare.py`.
Đợt đối chiếu sâu: `Infrastructure/Json/JsonSetup.cs`, `Infrastructure/Validation/Constraints.cs`,
`Infrastructure/Errors/ValidationProblems.cs`, `Domain/Shared/ValueObjects.cs`, `Domain/{Tickets,Quotations,Inventory}`,
`Data/Entities/{Payment,Customer,Account}.cs`, `Data/AppDbContext.cs`,
`Services/{Billing,Quotations,WarrantyRequests}`, `SharedTests.cs`, `JavaContractTests.cs`.
Thêm oracle, fixture 16 invalid POST, snapshot 100 quan sát, bằng chứng lỗi đổi thứ tự và hướng dẫn `verification/README.md`.
Giữ license Hibernate cho regex port; không thêm package/commit/sửa Java. Browser smoke đạt 49 kiểm tra/10 trang,
toàn bộ API trong smoke giả lập. Đã dừng các server kiểm tra do agent khởi động.

Nguồn Email ngoài oracle: [AbstractEmailValidator 9.1.3](https://github.com/hibernate/hibernate-validator/blob/9.1.3.Final/engine/src/main/java/org/hibernate/validator/internal/constraintvalidators/AbstractEmailValidator.java),
[DomainNameUtil 9.1.3](https://github.com/hibernate/hibernate-validator/blob/9.1.3.Final/engine/src/main/java/org/hibernate/validator/internal/util/DomainNameUtil.java);
license tại [HIBERNATE_VALIDATOR_APACHE_2.0.txt](licenses/HIBERNATE_VALIDATOR_APACHE_2.0.txt).

## 9. Cần chủ dự án quyết định / bước nghiệm thu tiếp

1. **Đã chốt và làm xong phần HTTP quan sát được**: sửa để khớp Java; V-01/V-02/V-03/V-13/V-14 đều đạt
   kiểm lại. Không cần duyệt lại phương án này. Kết quả chỉ bao phủ 28 case đã chạy; valid-token/concurrency chưa kiểm.
2. **Cho phép login/logout để đối chiếu API đọc có token trên `_Dev`?** Các thao tác này ghi
   `TaiKhoan` (bộ đếm/last login), `RefreshToken`, `NhatKyThaoTac`; logout thu hồi token.
   Chỉ đọc sau khi login: customer/device/ticket/detail/history/quotation/inventory/billing/report/search/notification
   theo từng vai trò. Cần tài khoản kiểm hợp lệ từng vai trò qua cơ chế secret, không ghi mật khẩu vào báo cáo.
3. **Kiểm ghi/đồng thời trên DB `_IT` có sẵn** theo D-008, cần duyệt riêng và connection do chủ dự án cung cấp.
   Không tự tạo/clone DB hay seed. Chuỗi kiểm cụ thể: khách+thiết bị → phiếu → phân công → chẩn đoán →
   báo giá/duyệt/quyết định → giữ/xuất kho → sửa/QC → thu tiền hoặc miễn phí → bàn giao/chữ ký;
   thêm nhập/điều chuyển, portal request/cancel, account/OTP/refresh, kiểm hai request đồng thời.
   Ghi bảng nghiệp vụ/bộ đếm/history/audit/notification và lưu tệp, vì vậy chưa được chạy.
4. Portal tối đa **3 hay 5 tệp**? Thời gian mong muốn là **một thời điểm +1 giờ hay một khoảng từ–đến**?
   Giữ hiện trạng đến khi có quyết định; không đoán.

Điều kiện nghiệm thu cuối: tất cả dòng có-token/ghi ở mục 3–5 có bằng chứng Java/.NET với cùng fixture,
không có chênh lệch chưa chốt; kiểm tồn/thu tiền/phiên bản/rollback/concurrency đạt trên DB được duyệt.
Hiện tại **chưa đủ điều kiện xác nhận tương đương toàn bộ hoặc triển khai thay Java**.
