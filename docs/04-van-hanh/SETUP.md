# Cài đặt và cấu hình Soopi

Các lệnh dưới đây dùng PowerShell. Thực hiện tại repo Soopi, không phải `warranty-system-mysql`.

## 1. Môi trường

| Thành phần | Project yêu cầu / môi trường đã kiểm |
|---|---|
| .NET | SDK cho `net10.0`; máy hiện tại `10.0.302` |
| Node.js / npm | Máy hiện tại Node `24.19.0`, npm `11.17.0` |
| Frontend | React `19.3.0`, Vite `8.3.2`, TypeScript `7.0.2`, React Router `7.18.4` theo package.json/lockfile |
| Database | SQL Server có sẵn schema nghiệp vụ; không tự tạo DB/bảng |
| Kiểm migration nâng cao | Python, Java và WAR sẵn có; browser smoke cần Edge + Playwright có sẵn ở repo Java |

Kiểm phiên bản:

```powershell
dotnet --version
node --version
npm.cmd --version
```

Đường dẫn trên máy hiện tại:

```powershell
Set-Location 'D:\huit\nosql\Source\warranty-system\warranty-system-soopi'
```

Restore/cài đúng các dependency đã khai báo, không thêm package:

```powershell
dotnet restore backend-dotnet/Soopi.slnx
Set-Location frontend-react
npm.cmd ci
Set-Location ..
```

## 2. Kết nối SQL Server

### Máy mới: tạo database từ script

Thư mục `database/` có script SQL Server mới nhất (lấy từ `warranty-system-mysql/db/sqlserver`): `01_schema.sql`
(56 bảng), `02_reference_data.sql`, `03_demo_data.sql` (tài khoản demo, xem [TAI_KHOAN_DEMO.md](TAI_KHOAN_DEMO.md)),
`04_app_user.sql` (tài khoản ứng dụng cho production) và file ghép `TrungTamBaoHanhDB_SqlServer.sql` (= 01 + 02 + 03,
tự tạo database `TrungTamBaoHanhDB` collation `Latin1_General_100_CI_AI`).
`Script.sql` (= 01 + 02, tạo database, 56 bảng và dữ liệu tham chiếu, không có dữ liệu mẫu) là bản gộp dùng cho
thiết kế dữ liệu trong báo cáo và cho máy cần database sạch.

Database tạo từ một bản script trước (còn trạng thái phiếu `CANCELLED`, `YeuCauBaoHanh` chưa có cột `MaKH`, chưa có
quyền quản lý tài khoản khách, nhãn thông báo `CUSTOM_ANNOUNCEMENT` hoặc các cột nhận xét/thời điểm đánh giá khách) phải nâng cấp trước khi chạy backend hiện tại — giữ nguyên dữ liệu, chạy lại nhiều lần
không sao, dùng được cho database tạo từ bất kỳ bản script nào trước đây:

```powershell
sqlcmd -S <server> -d <database> -E -C -I -b -f 65001 -i database\05_upgrade_existing_db.sql
sqlcmd -S <server> -d <database> -E -C -I -b -f 65001 -i database\06_chat.sql
sqlcmd -S <server> -d <database> -E -C -I -b -f 65001 -i database\07_access_statistics.sql
sqlcmd -S <server> -d <database> -E -C -I -b -f 65001 -i database\08_public_reviews.sql
sqlcmd -S <server> -d <database> -E -C -I -b -f 65001 -i database\11_stocktake.sql
sqlcmd -S <server> -d <database> -E -C -I -b -f 65001 -i database\14_time_settings.sql
sqlcmd -S <server> -d <database> -E -C -I -b -f 65001 -i database\15_issue_service_price.sql
sqlcmd -S <server> -d <database> -E -C -I -b -f 65001 -i database\16_protection_settings.sql
```

`06_chat.sql` thêm hai bảng hội thoại/tin nhắn, không tạo tin nhắn mẫu và không xóa dữ liệu. Chạy trước khi dùng chat.
`07_access_statistics.sql` thêm thống kê truy cập tích lũy từ **31/10/2026**, không tự xóa/reset lịch sử khi sang ngày,
khởi động lại ứng dụng hoặc dọn refresh token. Cần chạy trước khi dùng backend mới. Admin xem tại `/admin#access`;
xem [ACCESS_STATISTICS.md](../02-ky-thuat/ACCESS_STATISTICS.md) để biết cách đếm và kiểm thử.
`08_public_reviews.sql` thêm bảng duyệt đánh giá cho trang chủ; chạy trước backend mới. Không tự công khai nhận xét cũ.
Admin chọn tại `/admin#reports`, cột **Trang chủ**; xem [PUBLIC_REVIEWS.md](../02-ky-thuat/PUBLIC_REVIEWS.md).
`11_stocktake.sql` thêm phiếu kiểm kê kho (`PhieuKiemKe`, `ChiTietKiemKe`) và quyền `STOCKTAKE_MANAGE` cho thủ kho; thiếu script
thì màn Kho vật tư → Kiểm kê báo "Cơ sở dữ liệu chưa được nâng cấp". Chạy lại nhiều lần không sao.
`14_time_settings.sql` thêm bảng `CauHinhThoiGian` cho `/admin#time-settings` (SLA, sắp trễ, hạn báo giá, giờ làm việc). Thiếu
script thì hệ thống chạy bằng giá trị mặc định (SLA Tiêu chuẩn 48h) nhưng không lưu được cấu hình. Chạy lại nhiều lần không sao.
`15_issue_service_price.sql` thêm cột `ChiTietXuatKho.DonGiaDichVuXuat` để giá trị “Miễn phí trong bảo hành” của phiếu cũ không đổi khi
sửa giá danh mục; dòng xuất cũ được điền giá hiện tại lúc chạy. Chạy lại nhiều lần không sao.
`16_protection_settings.sql` (chạy sau file 14) thêm cột `CauHinhThoiGian.CauHinhBaoVe` cho mức khóa đăng nhập, OTP, chống spam
và hạn phiên. Thiếu script thì dùng giá trị cũ nhưng không lưu được phần bảo vệ. Chạy lại nhiều lần không sao.
Chat chỉ dành cho tài khoản đăng nhập: khách và nhân viên tiếp nhận/KTV hiện đang phụ trách phiếu. Khi đổi KTV,
cuộc trò chuyện cũ chỉ xem lịch sử; người mới không được đọc cuộc trò chuyện riêng của người cũ.
Danh bạ nội bộ tìm theo tên/mã khách, mã phiếu, sản phẩm hoặc serial; không mở quyền đọc liên hệ khách toàn hệ thống cho KTV.

`run.bat` tự tạo database mới khi máy chưa có connection string (xem mục 3); database hiện có cần chạy các script nâng cấp ở trên. Muốn tạo DB riêng:

```powershell
.\run.bat initdb                        # tự tìm SQL Server trên máy, không có thì cài SQL Server 2022 Express
.\run.bat initdb localhost\SQLEXPRESS   # chỉ định server (tên trong ô Server name của SSMS)
```

`initdb` cài `sqlcmd` nếu thiếu, tạo database và nạp dữ liệu mẫu bằng đăng nhập Windows (bỏ qua nếu database
`TrungTamBaoHanhDB` đã có), rồi đặt `ConnectionStrings:Default` (`Integrated Security=True`). Tài khoản Windows cần
quyền tạo database (bản Express thường cấp sẵn quyền quản trị cho tài khoản đã cài nó). Sau đó chạy `run.bat`.
Không dùng lệnh này trên máy đang trỏ tới database khác: nó ghi đè connection string. Tự chạy bằng SSMS hoặc
`sqlcmd -S <server> -E -C -I -b -f 65001 -i database\TrungTamBaoHanhDB_SqlServer.sql` cũng được.

### Đặt connection string thủ công

Backend đọc `ConnectionStrings:Default`, gọi `UseSqlServer`; helper SQL dùng chung kết nối đó.
`appsettings.json` chỉ có placeholder, `appsettings.Development.json` không chứa tài khoản DB.
Development nạp User Secrets; biến môi trường/CLI có thể ghi đè cấu hình file và User Secrets.
Backend không tự đọc `.env` của Java hoặc `.env.local` của React.

**Cấu hình đã kiểm trên máy hiện tại:** server `localhost,1433`, database `TrungTamBaoHanhDB_Dev`,
SQL Server Authentication, `Encrypt=True`, `TrustServerCertificate=True`.
Không đặt lại secret này khi chỉ cần chạy app. Không lưu username/password thật trong tài liệu.

Máy mới: tại `backend-dotnet`, thay các placeholder trong ví dụ bằng cấu hình riêng, lưu ngoài repo:

```powershell
dotnet user-secrets set 'ConnectionStrings:Default' 'Server=<SQL_HOST>,<SQL_PORT>;Database=<EXISTING_DATABASE>;User ID=<SQL_USER>;Password=<SQL_PASSWORD>;Encrypt=True;TrustServerCertificate=True;' --project src/Soopi.Api
dotnet user-secrets set 'Security:DefaultResetPassword' '<TEMPORARY_RESET_PASSWORD>' --project src/Soopi.Api
dotnet user-secrets set 'Email:Smtp:Password' '<GMAIL_APP_PASSWORD>' --project src/Soopi.Api
```

UserSecretsId đã có trong `Soopi.Api.csproj`; không cần `user-secrets init`. Tệp User Secrets nằm ngoài repo.
OTP đăng ký/quên mật khẩu gửi từ `hsostd74@gmail.com` qua Gmail SMTP; `<GMAIL_APP_PASSWORD>` là App Password 16 ký tự
(Google Account → Security → bật 2-Step Verification → App passwords), không phải mật khẩu Gmail. Chưa đặt thì mã chỉ
ghi vào log của API.
Muốn dùng tài khoản gửi khác, đặt thêm `Email:Smtp:Username` và `Email:Smtp:From` bằng User Secrets; dùng App Password
của đúng tài khoản đó. Không chép mật khẩu vào `appsettings.json` hoặc commit file cấu hình chứa secret.

### Máy khác vừa pull bản OTP email

1. Giữ connection string riêng của máy. DB đã có từ trước phải chạy `database/05_upgrade_existing_db.sql` bằng tài khoản
   có quyền nâng cấp, theo lệnh ở mục 2; script thay cột OTP `SDT` bằng `Email` và xóa mã OTP đang chờ. Không chạy lại seed trên DB có dữ liệu.
2. Đặt SMTP App Password bằng lệnh User Secrets phía trên để gửi email thật; dùng `Email:Provider=log` chỉ khi thử local.
   Production cần SMTP hợp lệ; cấu hình môi trường mẫu nằm ở `deploy/soopi.env.example`.
3. Chạy `npm.cmd ci` trong `frontend-react`, rồi chạy `run.bat` tại gốc repo (hoặc các lệnh thủ công ở mục 3).

Tên đăng nhập vẫn là số điện thoại; OTP đăng ký/quên mật khẩu gửi qua email. Hồ sơ khách cũ chưa có tài khoản chỉ được
gắn với tài khoản mới khi email OTP khớp email đã lưu. Nếu chưa có email hoặc email sai, trung tâm phải xác minh và cập nhật trước.
Không chạy `user-secrets list` khi chia sẻ màn hình/log vì lệnh hiển thị giá trị secret.
`TrustServerCertificate=True` là cấu hình local hiện tại; môi trường dùng chứng thư tin cậy đặt `False`.

Khi chạy ngoài Development, cung cấp qua cấu hình của host/biến môi trường:

| Khóa .NET | Biến môi trường tương ứng |
|---|---|
| `ConnectionStrings:Default` | `ConnectionStrings__Default` |
| `Security:DefaultResetPassword` | `Security__DefaultResetPassword` |
| `Security:Jwt:PrivateKeyLocation` | `Security__Jwt__PrivateKeyLocation` |
| `Security:Jwt:PublicKeyLocation` | `Security__Jwt__PublicKeyLocation` |
| `Storage:Directory` | `Storage__Directory` |
| `Security:AllowedOrigins` | `Security__AllowedOrigins` |
| `VietQR:BankId`, `VietQR:AccountNo`, `VietQR:AccountName` | `VietQR__BankId`, `VietQR__AccountNo`, `VietQR__AccountName` |

Không thực thi các script SQL Server/schema/seed trong project Java để “sửa kết nối”. Tài khoản DB cần quyền
phù hợp các thao tác được chủ dự án cho phép; tài liệu này không tự tạo login/user hay cấp quyền.

## 3. Chạy backend và React khi phát triển

Cách nhanh (máy Windows 10/11 nào cũng được, kể cả máy trắng): chạy `run.bat` ở thư mục gốc. Script:

1. Cài nếu thiếu .NET SDK 10, Node.js 22+ (qua `winget`) và dependency frontend (`npm ci`).
2. Chưa có `ConnectionStrings:Default` (chỉ kiểm tra khóa, không in giá trị): tìm SQL Server trên máy (`localhost`,
   `localhost\SQLEXPRESS`, LocalDB) bằng đăng nhập Windows; không có thì cài SQL Server 2022 Express bằng `winget`
   (5–15 phút, Windows hỏi quyền quản trị). Sau đó tạo `TrungTamBaoHanhDB` từ `database/` nếu chưa có và đặt
   connection string. Máy đã có connection string (như máy dùng `_Dev`) giữ nguyên.
3. Chọn cổng: API 8080, web 5173; bị chương trình khác chiếm thì tự lấy cổng trống kế tiếp (API 8081/8082/8090/18080,
   web 5174/5175/5180/5190). API/Vite của Soopi đang chạy sẵn thì dùng lại.
4. Mở API, Vite và trình duyệt; chờ API tối đa 6 phút (lần đầu phải tải package và build).

`run.bat check` chỉ kiểm tra/cài, `run.bat build` chạy bản build cùng origin, `run.bat initdb [server]` làm lại bước
database. Máy không có `winget` (App Installer) thì script in link tải thủ công. Tài khoản demo:
[TAI_KHOAN_DEMO.md](TAI_KHOAN_DEMO.md).

Chạy thủ công:

Terminal backend, tại `backend-dotnet`:

```powershell
dotnet run --project src/Soopi.Api --launch-profile http -- --Sla:Alerts:Enabled=false
```

API ở `http://localhost:8080`. Chỉ tắt job SLA; job cleanup 02:00 vẫn tồn tại.
Không gọi login/refresh/logout/OTP hoặc form thật trong phiên chỉ đọc; dừng API trước giờ cleanup.

### API thử riêng trên cổng 8081

`run.bat` có thể dùng lại API Soopi đang mở mà không biên dịch mã mới. Khi kiểm thử App với DB thử,
hãy dừng **chỉ terminal API 8081 cũ** bằng Ctrl+C, rồi chạy từ gốc repository:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File verification\Start-TestApi.ps1 -SqlServer 'localhost\HOMEPC'
```

Thay `localhost\HOMEPC` bằng tên SQL Server hiển thị trong SSMS nếu chạy trên máy khác. Script chỉ nhận
`TrungTamBaoHanhDB_Test_20261015`, kiểm tra kết nối bằng Windows Authentication, từ chối cổng 8081
đang bị chiếm, và **build lại API từ mã nguồn hiện tại** trước khi chạy. Chuỗi kết nối chỉ tồn tại
trong tiến trình này; script không chạy migration/seed, không sửa User Secrets và không đụng API 8080.
Các job nền của API vẫn hoạt động theo cấu hình hiện có trên DB thử.
Giữ terminal này mở. App Android emulator dùng Real `http://10.0.2.2:8081/api/v1`.
Có thể kiểm tra trước mà chưa chạy API bằng cách thêm `-CheckOnly` (cổng 8081 phải trống).

Terminal frontend, tại `frontend-react`:

```powershell
npm.cmd run dev
```

Vite ở `http://localhost:5173`; proxy `/api` và `/actuator` sang `http://localhost:8080`.
Giá trị mặc định hoạt động không cần `.env.local`. Nếu muốn cấu hình riêng, sao chép `.env.example`
sang `.env.local` rồi sửa **chỉ cấu hình công khai**:

```dotenv
VITE_API_BASE_URL=/api/v1
VITE_PROXY_TARGET=http://localhost:8080
```

`VITE_API_BASE_URL` là base URL phía browser, được đóng vào build; `VITE_PROXY_TARGET` chỉ dùng cho Vite dev server.
Khởi động lại Vite sau khi đổi env; build lại frontend nếu đổi base URL cho bản đóng gói.
Không đặt connection string, password hay private key vào biến `VITE_*`.

CORS Development cho phép `http://localhost:5173,http://localhost:8080`. Nếu đổi hostname/cổng hoặc gọi
API trực tiếp khác origin, chỉnh `Security:AllowedOrigins` (danh sách phân cách dấu phẩy) cho đúng origin.
Ví dụ API kiểm tra ở 18080 thì đặt `VITE_PROXY_TARGET=http://127.0.0.1:18080`; trình duyệt vẫn mở Vite qua localhost.

### Chạy đồng thời bản thật và bản thử trên máy phát triển

Khi cần giữ cố định API 8080/8081 và Web 5173/5174, không dùng `run.bat` để mở thêm một
bản: lệnh đó có thể tự chọn cổng khác hoặc dùng lại tiến trình cũ. Mở bốn terminal
PowerShell riêng tại gốc repo, sau khi SQL Server đã chạy:

```powershell
# Terminal API thật: dùng cấu hình User Secrets hiện có; kiểm tra DB đích trước khi ghi.
Set-Location .\backend-dotnet
dotnet run --project src/Soopi.Api --launch-profile http -- --Sla:Alerts:Enabled=false
# Terminal API thử (gốc repo): script từ chối cổng bận và xác minh đúng DB thử.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File verification\Start-TestApi.ps1 -SqlServer '.\HOMEPC'
# Terminal Web thật:
Set-Location .\frontend-react
$env:VITE_PROXY_TARGET='http://127.0.0.1:8080'; npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
# Terminal Web thử:
Set-Location .\frontend-react
$env:VITE_PROXY_TARGET='http://127.0.0.1:8081'; npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Chỉ chạy mỗi lệnh trong terminal/thư mục đã ghi ở chú thích. Vite dùng cache riêng theo
đích proxy nên hai Web có thể mở cùng lúc. Sau khi khởi động, kiểm tra `/actuator/health`
qua cả hai Web và xác minh tiến trình API gắn đúng DB trước mọi thao tác ghi; health UP
một mình chưa chứng minh DB đích. Pixel_6 dùng Real `http://10.0.2.2:8081/api/v1` để
thử; `10.0.2.2` chỉ áp dụng cho Android emulator, không dùng cho điện thoại qua USB.

## 4. Chạy bản build cùng origin

Tại `frontend-react`:

```powershell
npm.cmd run build
```

Build ghi assets vào `backend-dotnet/src/Soopi.Api/wwwroot`. Sau đó chạy backend và mở
`http://localhost:8080/login` hoặc `/portal`; không cần Vite. Không dùng `vite preview` làm cấu hình triển khai thật.

## 5. Kiểm kết nối bằng GET

Khi backend đang chạy:

```powershell
Invoke-RestMethod 'http://localhost:8080/actuator/health'
Invoke-RestMethod 'http://localhost:8080/api/v1/portal/catalog'
```

Health kết nối DB được: 200, `status=UP`, `groups=[liveness,readiness]`; không kết nối được: 503/DOWN.
Catalog đọc dữ liệu danh mục hiện có. Các URL `/actuator/info`, `/actuator/health/liveness` và
`/actuator/health/readiness` bị chặn 403 theo hợp đồng Java, không phải probe riêng để dùng thay health.

Trong Development, `http://localhost:8080/openapi/v1.json` có đặc tả JSON; không có Swagger UI.

## 6. Xử lý lỗi thường gặp

| Hiện tượng | Kiểm / xử lý |
|---|---|
| Connection string vẫn là placeholder | Chạy đúng project ở Development hoặc cung cấp `ConnectionStrings__Default` cho host |
| Login SQL thất bại / DB không tồn tại | Kiểm server, port, DB hiện có và tài khoản ngoài repo; không tự tạo schema hay sửa quyền |
| Health DOWN / lỗi certificate | Kiểm dịch vụ SQL/TCP, firewall, TLS và cấu hình chứng thư; không sửa dữ liệu để chữa lỗi kết nối |
| Vite 502 | Đảm bảo API chạy và proxy target đúng cổng, đặc biệt 8080 so với cổng kiểm 18080 |
| API 401 | Endpoint cần access token; GET không token không chứng minh lỗi kết nối DB |
| Refresh/logout 403 | Kiểm `X-Requested-With: fetch`, Origin và `Security:AllowedOrigins`; xem [API](../02-ky-thuat/API.md) |
| Trang `/login` không có assets | Build frontend trước; kiểm thư mục wwwroot và đúng process backend |
| Port 5173 bận | Vite dùng strictPort; dừng đúng process của mình hoặc chọn/cấu hình cổng khác, không kill process khác |
| Build lỗi DLL bị khóa | Dừng đúng API do mình khởi động trước build hoặc dùng output artifacts khác |
| Production không có RSA key | Cấu hình đường dẫn hai PEM đã cấp; không copy secret/private key vào repo |

Nếu build/test đã sửa hai lần mà vẫn lỗi, dừng và báo chủ dự án theo quy tắc migration.
