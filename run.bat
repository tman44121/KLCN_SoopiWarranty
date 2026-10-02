@echo off
rem Chạy Soopi trên máy dev (xem docs/SETUP.md).
rem   run.bat         kiểm tra/cài công cụ, chạy API .NET (8080) + Vite (5173), mở http://localhost:5173/login
rem   run.bat build   build React vào wwwroot rồi chỉ chạy API, mở http://localhost:8080/login
rem   run.bat check   chỉ kiểm tra/cài công cụ và cấu hình, không chạy server
rem   run.bat initdb [server]   máy mới: tạo database TrungTamBaoHanhDB (schema + dữ liệu mẫu) bằng đăng nhập Windows
rem                   rồi đặt ConnectionStrings:Default; server mặc định localhost (VD: localhost\SQLEXPRESS)
rem Tự cài nếu thiếu: .NET SDK 10, Node.js 22+, sqlcmd (qua winget), dependency frontend (npm ci).
rem Không tự cài SQL Server: cần SQL Server đang chạy (Express/Developer đều được).
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "MODE=%~1"

echo [1/4] Kiểm tra .NET SDK 10...
call :need_dotnet || goto fail
if /i "%MODE%"=="initdb" goto initdb
echo [2/4] Kiểm tra Node.js 22+...
call :need_node || goto fail

echo [3/4] Kiểm tra dependency frontend...
if not exist "frontend-react\node_modules" (
  echo Cài dependency frontend ^(npm ci^)...
  pushd frontend-react
  call npm ci
  if errorlevel 1 (popd & echo [Lỗi] npm ci thất bại. & goto fail)
  popd
)

echo [4/4] Kiểm tra cấu hình kết nối database...
if defined ConnectionStrings__Default goto db_ok
rem Chỉ kiểm tra khóa có tồn tại; giá trị bí mật không được in ra.
dotnet user-secrets list --project backend-dotnet\src\Soopi.Api 2>nul | findstr /b /c:"ConnectionStrings:Default" >nul
if errorlevel 1 (
  echo [Lỗi] Chưa đặt ConnectionStrings:Default cho backend.
  echo   Máy mới chưa có database: chạy  run.bat initdb  ^(hoặc  run.bat initdb localhost\SQLEXPRESS^)
  echo   Đã có database: chạy lệnh sau với thông tin SQL Server của bạn:
  echo   dotnet user-secrets set "ConnectionStrings:Default" "Server=<HOST>,<PORT>;Database=<DB>;User ID=<USER>;Password=<PASSWORD>;Encrypt=True;TrustServerCertificate=True;" --project backend-dotnet\src\Soopi.Api
  echo   Chi tiết: docs\SETUP.md mục 2.
  goto fail
)
:db_ok
echo Đã đủ công cụ và cấu hình.
if /i "%MODE%"=="check" exit /b 0

set "WEB=http://localhost:5173/login"
if /i "%MODE%"=="build" (
  echo Build frontend vào backend-dotnet\src\Soopi.Api\wwwroot...
  pushd frontend-react
  call npm run build
  if errorlevel 1 (popd & echo [Lỗi] Build frontend thất bại. & goto fail)
  popd
  set "WEB=http://localhost:8080/login"
)

call :port_busy 8080
if errorlevel 1 (
  rem Job cảnh báo SLA tắt khi chạy dev như docs/SETUP.md.
  start "Soopi API (8080)" /d "%~dp0backend-dotnet" cmd /k dotnet run --project src/Soopi.Api --launch-profile http -- --Sla:Alerts:Enabled=false
) else (
  curl -s -o nul -m 5 http://localhost:8080/actuator/health || (echo [Lỗi] Cổng 8080 đang bị chương trình khác dùng. & goto fail)
  echo API đã chạy sẵn ở cổng 8080 - dùng lại.
)
if /i "%MODE%"=="build" goto wait_api
call :port_busy 5173
if errorlevel 1 (
  start "Soopi Web (5173)" /d "%~dp0frontend-react" cmd /k npm run dev
) else (
  echo Vite đã chạy sẵn ở cổng 5173 - dùng lại.
)

:wait_api
echo Đang chờ API khởi động...
call :wait http://localhost:8080/actuator/health || goto fail
curl -s -m 5 http://localhost:8080/actuator/health | findstr /c:"UP" >nul || echo [Cảnh báo] API chạy nhưng chưa kết nối được database - kiểm tra SQL Server và ConnectionStrings:Default.
start "" "%WEB%"
echo Đã mở %WEB%. Tài khoản demo: docs\TAI_KHOAN_DEMO.md. Đóng các cửa sổ "Soopi API"/"Soopi Web" để dừng.
exit /b 0

:fail
pause
exit /b 1

rem ---------------------------------------------------------------- tạo database (máy mới)

:initdb
set "SQLSERVER=%~2"
if "%SQLSERVER%"=="" set "SQLSERVER=localhost"
call :need_sqlcmd || goto fail
echo Kết nối SQL Server "%SQLSERVER%" bằng tài khoản Windows hiện tại...
set "DBEXISTS="
for /f "usebackq delims=" %%n in (`sqlcmd -S "%SQLSERVER%" -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN DB_ID('TrungTamBaoHanhDB') IS NULL THEN 0 ELSE 1 END" 2^>nul`) do set "DBEXISTS=%%n"
if not defined DBEXISTS (
  echo [Lỗi] Không kết nối được SQL Server "%SQLSERVER%" bằng đăng nhập Windows.
  echo   - Kiểm tra tên server trong SSMS ^(ô Server name^), VD: run.bat initdb localhost\SQLEXPRESS
  echo   - Tài khoản Windows phải có quyền tạo database ^(sysadmin hoặc dbcreator^).
  goto fail
)
if "%DBEXISTS%"=="1" (
  echo Database TrungTamBaoHanhDB đã có - bỏ qua bước tạo, chỉ đặt lại connection string.
) else (
  echo Tạo database TrungTamBaoHanhDB và nạp dữ liệu mẫu...
  sqlcmd -S "%SQLSERVER%" -E -C -I -b -f 65001 -i "database\TrungTamBaoHanhDB_SqlServer.sql"
  if errorlevel 1 (echo [Lỗi] Chạy script SQL thất bại - xem thông báo phía trên. & goto fail)
)
dotnet user-secrets set "ConnectionStrings:Default" "Server=%SQLSERVER%;Database=TrungTamBaoHanhDB;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;" --project backend-dotnet\src\Soopi.Api >nul
if errorlevel 1 (echo [Lỗi] Không đặt được User Secrets. & goto fail)
echo Xong: database TrungTamBaoHanhDB sẵn sàng, đã đặt ConnectionStrings:Default.
echo Chạy  run.bat  để mở ứng dụng. Tài khoản demo: docs\TAI_KHOAN_DEMO.md
exit /b 0

rem ---------------------------------------------------------------- hàm phụ

:need_dotnet
call :has_dotnet10 && exit /b 0
echo Chưa có .NET SDK 10 - đang cài bằng winget...
call :winget Microsoft.DotNet.SDK.10 || exit /b 1
set "PATH=%ProgramFiles%\dotnet;%PATH%"
call :has_dotnet10 && exit /b 0
echo [Lỗi] Đã cài nhưng chưa thấy .NET SDK 10. Đóng cửa sổ này, mở lại rồi chạy run.bat.
exit /b 1

:has_dotnet10
where dotnet >nul 2>nul || exit /b 1
dotnet --list-sdks 2>nul | findstr /b "10." >nul
exit /b %errorlevel%

:need_node
call :node_major
if %NODE_MAJOR% GEQ 22 exit /b 0
echo Chưa có Node.js 22+ - đang cài Node.js LTS bằng winget...
call :winget OpenJS.NodeJS.LTS || exit /b 1
set "PATH=%ProgramFiles%\nodejs;%PATH%"
call :node_major
if %NODE_MAJOR% GEQ 22 exit /b 0
echo [Lỗi] Đã cài nhưng chưa thấy Node.js 22+. Đóng cửa sổ này, mở lại rồi chạy run.bat.
exit /b 1

:node_major
set "NODE_MAJOR=0"
where node >nul 2>nul || exit /b 0
for /f "tokens=1 delims=." %%v in ('node -v') do set "NODE_MAJOR=%%v"
set "NODE_MAJOR=%NODE_MAJOR:v=%"
exit /b 0

:need_sqlcmd
where sqlcmd >nul 2>nul && exit /b 0
echo Chưa có sqlcmd - đang cài bằng winget...
call :winget Microsoft.Sqlcmd || exit /b 1
set "PATH=%ProgramFiles%\SqlCmd;%PATH%"
where sqlcmd >nul 2>nul && exit /b 0
echo [Lỗi] Đã cài nhưng chưa thấy sqlcmd. Đóng cửa sổ này, mở lại rồi chạy lại lệnh.
exit /b 1

:winget
where winget >nul 2>nul || (
  echo [Lỗi] Máy không có winget. Cài thủ công rồi chạy lại run.bat:
  echo   .NET SDK 10: https://dotnet.microsoft.com/download/dotnet/10.0
  echo   Node.js LTS: https://nodejs.org
  exit /b 1
)
winget install --id %1 -e --source winget --accept-source-agreements --accept-package-agreements
if errorlevel 1 winget upgrade --id %1 -e --source winget --accept-source-agreements --accept-package-agreements
exit /b 0

:port_busy
rem errorlevel 0 = cổng đang được dùng, 1 = trống.
netstat -ano | findstr /r /c:":%1 .*LISTENING" >nul
exit /b %errorlevel%

:wait
for /l %%i in (1,1,90) do (
  curl -s -o nul -m 5 "%~1" && exit /b 0
  ping -n 3 127.0.0.1 >nul
)
echo [Lỗi] API không phản hồi sau 3 phút - xem cửa sổ "Soopi API" (DB, User Secrets, cổng 8080).
exit /b 1
