# Kiểm thử, đóng gói và vận hành Soopi

Tài liệu cho người tiếp tục phát triển/bàn giao. Giai đoạn 4 chưa nghiệm thu toàn bộ;
không dùng kết quả unit test hoặc bản publish để suy rằng đã sẵn sàng thay Java trong production.

## Kiểm tra trước bàn giao

Tại `backend-dotnet`, dừng đúng process API do mình khởi động trước khi build:

```powershell
dotnet build Soopi.slnx --artifacts-path artifacts/stage4
dotnet test Soopi.slnx --artifacts-path artifacts/stage4 --no-build --no-restore
```

Tại `frontend-react`:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

Unit test backend không kết nối DB; frontend test dùng fetch giả lập. Frontend `lint` là TypeScript,
kiểm cú pháp JS và parity ID/name/CSS, **không phải ESLint**. Parity cần repo Java còn ở vị trí bên cạnh.

| Kiểm gần nhất 02/10/2026 | Kết quả / giới hạn |
|---|---|
| Backend build/test | 0 warning/error; 45/45 test |
| Frontend build/lint/test | Đạt; 7/7 test; build còn cảnh báo React Router `use client` và chunk >500 kB |
| Browser smoke | 49 check / 10 trang, 14 mocked writes, toàn bộ API mock |
| HTTP Java/.NET | 28 GET + 16 POST invalid bị chặn trước service; cùng status/nội dung; 4 raw order-only diff fieldErrors ở lần kiểm đó |
| Oracle | 100 quan sát JSON/validation/text/Payment, không khởi động datasource |
| Nghiệp vụ thật có token/ghi | Chưa nghiệm thu; cần chủ dự án duyệt môi trường và tài khoản kiểm |

Các số trên là bằng chứng của phiên đã ghi, không phải kết quả tự động cho mọi lần sửa sau này.
Chi tiết lệnh/snapshot: [MIGRATION_VERIFICATION](MIGRATION_VERIFICATION.md), [verification README](../verification/README.md).

Browser smoke (cần server UI đang chạy, Edge và Playwright có sẵn; không tự cài gói mới):

```powershell
# Tại frontend-react; chọn đúng host UI đang chạy.
$env:E2E_BASE_URL='http://localhost:8080'
node scripts/smoke.mjs
```

Smoke không chứng minh SQL, auth thật, rollback, tồn kho, thu tiền hay concurrency.
Login/logout để đọc API có token vẫn ghi tài khoản, refresh token và audit; phải được duyệt trước.
Luồng nghiệp vụ ghi/đồng thời dùng DB `_IT` **có sẵn, được duyệt**; không tự clone/tạo/seed DB.
Danh sách nghiệm thu cần tiếp tục nằm ở mục 9 của báo cáo migration.

## CI trên GitHub Actions

Workflow [CI](../.github/workflows/ci.yml) chạy khi mở/cập nhật PR vào `main`, push vào `main`,
hoặc chọn **Actions → CI → Run workflow**. Runner Ubuntu dùng Node.js 24 và .NET SDK 10.

Pipeline cài dependency từ npm lockfile, chạy lint/test frontend, kiểm lỗ hổng npm/NuGet mức
High/Critical (kể cả dependency gián tiếp), build React vào API `wwwroot`, build/test backend rồi
publish. Gói phải có cả `Soopi.Api.dll` và `wwwroot/index.html`; sau đó CI build image .NET,
kiểm user non-root/runtime và lưu `soopi-image.tar.gz` trong artifact
`soopi-<SHA>-<run>-<attempt>` trong 14 ngày.

CI không cần connection string, RSA key hoặc database thật. Test backend dùng snapshot Java
đã commit; frontend bỏ qua đối chiếu ID/name với source Java khi repo Java không có trên runner,
như behavior hiện tại của checker. CI này chưa chạy browser smoke hay luồng ghi DB.

**Đã vá ngày 22/10/2026:** `Microsoft.EntityFrameworkCore.SqlServer 10.0.12`
kéo `Microsoft.Data.SqlClient 6.1.6` → `System.Security.Cryptography.Pkcs 9.0.11`, bị cảnh báo
NU1903 theo [advisory của Microsoft](https://github.com/advisories/GHSA-846f-f764-76mx).
API tham chiếu trực tiếp `System.Security.Cryptography.Pkcs 10.0.13` để dùng bản vá cho cả API
và test (D-051). Giữ nguyên audit và ngưỡng chặn High/Critical trong CI.

Kiểm local cùng ngày: npm ci đạt; frontend lint/build và 15/15 test đạt. Sau bản vá, backend
Release build có 0 warning/error, 60/60 test và publish đạt; restore/audit theo đúng lệnh CI đạt,
`dotnet list ... package --vulnerable --include-transitive --no-restore` không báo package có lỗ hổng.
Gói publish có API, React và DLL Pkcs 10.0.13 đã kiểm cả version và runtime dependency manifest.
Vite được nâng từ 8.3.2 lên 8.3.5 theo bản vá upstream; `npm audit --audit-level=high` hiện đạt
0 lỗ hổng. Frontend build, backend Release build/publish và 11 test activation đạt.
Chưa chạy workflow trên GitHub; các kết quả local không thay thế lần chạy CI đầu tiên.

Workflow có job deploy Docker tới Ubuntu VPS, chỉ bật khi repository variable `DEPLOY_ENABLED=true`;
job dùng artifact đã qua CI, chỉ chạy từ `main`, xác minh host key SSH, kiểm health local/HTTPS
và quay lại release trước nếu restart/health fail. Test logic rollback chạy trong CI.
Chủ dự án chọn Ubuntu 24.04, 4 GB RAM, SQL Server cùng VPS; domain `soopiwarranty.id.vn`
đã có bản ghi A về `180.93.114.36`. VPS kiểm tra ngày 22/10/2026 báo 3916 MiB RAM,
4096 MiB swap; aaPanel và Docker/Compose đã cài, Caddy, SQL Express và app đều đang chạy,
Nginx không chạy. Fingerprint SSH mới đã được xác minh qua console và key setup đã cài.
Compose thêm Caddy để cấp/gia hạn HTTPS và proxy tới app trong Docker; cú pháp đã được Docker kiểm tra.
Caddy đã chạy, Let’s Encrypt cấp chứng thư; HTTP chuyển 308, health HTTPS trả `UP`, trang chủ trả 200
với TLS hợp lệ. Release hiện tại `063acbba7d7d64c7608fd96558e3968703a6140c-0-2` được build từ gói
publish local, không phải GitHub Actions. User `soopi-deploy`,
public key CI và sudo rule giới hạn đã cấu hình; private key được giữ trong thư mục `artifacts/ssh`
bị gitignore. GitHub secrets/variables chưa cấu hình nên auto deploy chưa bật.
SQL Server 2025 Express đang healthy; `TrungTamBaoHanhDB` đã restore từ `_Dev` với 17.469 hàng,
compatibility 170, recovery SIMPLE và login `soopi_app` trong role `warranty_app_role`. Ba file upload
đã chuyển và SHA-256 khớp; 428 bản ghi cùng trỏ tới blob mẫu `seed/signatures/blank.png` hiện không có
file trên máy nguồn. Backup mới đã VERIFYONLY + CHECKSUM thành công; giữ bản local trong `artifacts/`
và bản tạm trên VPS cho tới khi có lịch backup production.
Frontend build, backend Release build/publish, npm audit và 11 test activation đạt. Docker Desktop daemon chưa chạy
trên máy quản trị nên image được build trên VPS. GitHub secrets/variables chưa cấu hình và thay đổi
trong repo chưa commit/push; CI deploy vẫn tắt. Auto deploy chỉ hoạt động sau khi cấu hình secrets/variables,
commit và push lên `main`.
Xem [hướng dẫn cài VPS và GitHub Secrets](DEPLOY_VPS.md). DB/schema/seed không nằm trong pipeline. Secret production ở VPS/deployment
environment, không đưa vào job PR hay artifact. Chưa cấu hình branch protection trên GitHub;
sau lần chạy đầu, đặt `Verify and package` làm required status check cho `main`.

Tham chiếu chính thức: [cú pháp workflow](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[setup-node](https://github.com/actions/setup-node), [setup-dotnet](https://github.com/actions/setup-dotnet),
[upload-artifact](https://github.com/actions/upload-artifact),
[NuGet Audit](https://learn.microsoft.com/en-us/nuget/concepts/auditing-packages).

## Đóng gói

Tại `frontend-react`, build React trước. Sau đó tại `backend-dotnet`, publish riêng API:

```powershell
# frontend-react
npm.cmd run build
# backend-dotnet
dotnet publish src/Soopi.Api/Soopi.Api.csproj -c Release -o artifacts/publish
```

Output chứa API và wwwroot React. Đây là lệnh tạo artifact, không triển khai, không tạo DB/schema.
Chưa có bằng chứng triển khai production; bản publish cần kiểm trên host được duyệt.

Host chạy `Soopi.Api.dll` từ thư mục publish và nhận cấu hình ngoài artifact:

- `ASPNETCORE_ENVIRONMENT=Production`, địa chỉ listen theo host/reverse proxy.
- `ConnectionStrings__Default`, reset password theo cấu hình secret của host.
- Hai đường dẫn PEM `Security__Jwt__PrivateKeyLocation`/`PublicKeyLocation`; Production bắt buộc RSA key.
  Development không có key tự sinh khóa tạm, access/portal token cũ mất hiệu lực khi restart.
- `Storage__Directory` là thư mục bền vững ngoài repo/artifact, nên dùng đường dẫn tuyệt đối.
- `Security__AllowedOrigins` khớp origin thật, `Sms__Provider=log`, `Push__Provider=log` theo phạm vi đã chốt.

ASP.NET phục vụ React cùng origin; HTTPS cần cho cookie Secure. Với proxy, cấu hình host/network chỉ cho
proxy được duyệt truy cập backend vì app nhận forwarded headers khi Production.
OpenAPI JSON không được mở ở Production. Không tạo thêm `/actuator/*` probe; dùng health đã có.

## Storage và dữ liệu cũ

`Storage:Directory` mặc định `./data/files`, được resolve theo working directory của process.
Tệp có relative key dạng năm/tháng/GUID; DB `TepDinhKem` lưu metadata và key này, không lưu binary.
Đổi working directory hoặc thư mục storage mà không giữ tệp sẽ khiến download trả không tìm thấy.

Khi bàn giao, đối chiếu vị trí tệp cũ trước khi chọn storage cho app mới; không sửa metadata DB để chữa đường dẫn,
không tự di chuyển/xóa tệp và không chọn thư mục ghi nằm trong project Java gốc.
Backup/restore được người vận hành duyệt phải giữ **DB + storage + cấu hình/key** tương ứng;
tài liệu này không thực hiện backup, restore hoặc copy dữ liệu.

## Job nền và tích hợp

| Thành phần | Mặc định | Tác động |
|---|---|---|
| SLA alerts | Bật, mỗi 5 phút; ngưỡng sắp trễ 2 giờ | Đọc phiếu và ghi thông báo/audit liên quan theo use case |
| RefreshTokenCleanup | 02:00 giờ Việt Nam mỗi ngày | Xóa refresh token hết hạn quá 7 ngày |
| SMS/push | `log` | Không gửi SMS/FCM thật; log có thể chứa nội dung OTP/thông báo |

Tắt SLA bằng `--Sla:Alerts:Enabled=false` hoặc `Sla__Alerts__Enabled=false`.
Cleanup hiện không có cấu hình bật/tắt: phiên kiểm chỉ đọc không được giữ API chạy qua 02:00.
Mỗi instance API đăng ký job nền; chạy nhiều instance cần nghiệm thu behavior/concurrency và job trước,
không suy từ unit test hiện tại rằng đã có điều phối job phân tán.

Provider SMS/push ngoài `log` làm startup lỗi, không âm thầm gửi giả. Không có email provider trong app hiện tại.
Không đưa log chứa OTP/token, User Secrets, connection string hoặc private key vào Git/báo cáo chia sẻ.

## Khi có sự cố

1. Ghi URL, method, HTTP status, `code` và `correlationId`; không ghi password/token/body nhạy cảm.
2. Kiểm `GET /actuator/health`, process/log và cấu hình server/port/DB đúng môi trường.
3. Với 401/403 kiểm token, quyền, buộc đổi mật khẩu và Origin/header refresh; không bỏ security để thử.
4. Với lỗi build do DLL bị khóa, dừng đúng process của mình. Với lỗi data/constraint/concurrency,
   lưu bằng chứng và xin phép trước thao tác ghi DB; không chạy migration/seed hay xóa dữ liệu chữa lỗi.
5. Sau hai lần sửa build/test vẫn không đạt, dừng báo chủ dự án. Theo dõi khác biệt mới trong báo cáo migration,
   không đổi checker để bỏ qua lỗi nội dung.

Kiểm tra doc/implementation cùng nhau khi đổi cấu hình, endpoint, quyền, lưu trữ hoặc lịch job;
giữ [DECISIONS](DECISIONS.md) làm nơi ghi lựa chọn đã chốt, không tạo một bộ ADR song song.
