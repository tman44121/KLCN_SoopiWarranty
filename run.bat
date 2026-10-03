@echo off
rem Chạy Soopi trên bất kỳ máy Windows 10/11 nào (xem docs/SETUP.md).
rem   run.bat                   kiểm tra/cài mọi thứ còn thiếu, chạy API .NET + Vite, mở trang chủ (đăng nhập ở góc phải)
rem   run.bat build             build React vào wwwroot rồi chỉ chạy API (một cổng)
rem   run.bat check             chỉ kiểm tra/cài công cụ và database, không chạy server
rem   run.bat initdb [server]   tạo lại cấu hình database: tìm (hoặc dùng [server]) SQL Server, tạo TrungTamBaoHanhDB
rem                             (schema + dữ liệu mẫu) bằng đăng nhập Windows và đặt ConnectionStrings:Default
rem Tự cài nếu thiếu (qua winget): .NET SDK 10, Node.js 22+, sqlcmd, SQL Server 2022 Express; dependency frontend (npm ci).
rem Cổng mặc định 8080 (API) và 5173 (web); bị chương trình khác chiếm thì tự chọn cổng trống kế tiếp.
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "MODE=%~1"

echo [1/5] Kiểm tra .NET SDK 10...
call :need_dotnet || goto fail
if /i "%MODE%"=="initdb" goto initdb_mode
echo [2/5] Kiểm tra Node.js 22+...
call :need_node || goto fail

echo [3/5] Kiểm tra dependency frontend...
if not exist "frontend-react\node_modules" (
  echo Cài dependency frontend ^(npm ci^)...
  pushd frontend-react
  call npm ci
  if errorlevel 1 (popd & echo [Lỗi] npm ci thất bại. & goto fail)
  popd
)

echo [4/5] Kiểm tra database...
call :has_connection
if errorlevel 1 (
  echo Chưa cấu hình database - tự tìm SQL Server trên máy, chưa có thì cài.
  call :auto_db || goto fail
)
echo Đã đủ công cụ và cấu hình.
if /i "%MODE%"=="check" exit /b 0

echo [5/5] Khởi động...
if /i "%MODE%"=="build" (
  echo Build frontend vào backend-dotnet\src\Soopi.Api\wwwroot...
  pushd frontend-react
  call npm run build
  if errorlevel 1 (popd & echo [Lỗi] Build frontend thất bại. & goto fail)
  popd
)

call :pick_api || goto fail
if defined API_RUNNING (
  echo API Soopi đã chạy sẵn ở cổng %API_PORT% - dùng lại.
) else (
  rem Job cảnh báo SLA tắt khi chạy dev như docs/SETUP.md.
  start "Soopi API (%API_PORT%)" /d "%~dp0backend-dotnet" cmd /k dotnet run --project src/Soopi.Api --launch-profile http -- --urls http://localhost:%API_PORT% --Sla:Alerts:Enabled=false
)
set "WEB=http://localhost:%API_PORT%/"
if /i "%MODE%"=="build" goto wait_api

call :pick_web || goto fail
if defined WEB_RUNNING (
  echo Web Soopi đã chạy sẵn ở cổng %WEB_PORT% - dùng lại.
) else (
  set "VITE_PROXY_TARGET=http://localhost:%API_PORT%"
  start "Soopi Web (%WEB_PORT%)" /d "%~dp0frontend-react" cmd /k npm run dev -- --port %WEB_PORT%
)
set "WEB=http://localhost:%WEB_PORT%/"

:wait_api
echo Đang chờ API khởi động ^(lần đầu trên máy mới có thể mất vài phút để tải và build^)...
call :wait http://localhost:%API_PORT%/actuator/health || goto fail
curl -s -m 5 http://localhost:%API_PORT%/actuator/health | findstr /c:"UP" >nul || echo [Cảnh báo] API chạy nhưng chưa kết nối được database - chạy "run.bat initdb" hoặc kiểm tra SQL Server.
start "" "%WEB%"
echo Đã mở %WEB%. Tài khoản demo: docs\TAI_KHOAN_DEMO.md. Đóng các cửa sổ "Soopi API"/"Soopi Web" để dừng.
exit /b 0

:initdb_mode
if "%~2"=="" (call :auto_db) else (call :need_sqlcmd && call :setup_db "%~2")
if errorlevel 1 goto fail
echo Chạy  run.bat  để mở ứng dụng.
exit /b 0

:fail
pause
exit /b 1

rem ================================================================ database

:has_connection
if defined ConnectionStrings__Default exit /b 0
rem Chỉ kiểm tra khóa có tồn tại; giá trị bí mật không được in ra.
dotnet user-secrets list --project backend-dotnet\src\Soopi.Api 2>nul | findstr /b /c:"ConnectionStrings:Default" >nul
exit /b %errorlevel%

:auto_db
call :need_sqlcmd || exit /b 1
set "SQLSERVER="
for %%s in ("localhost" "localhost\SQLEXPRESS" "(localdb)\MSSQLLocalDB") do if not defined SQLSERVER call :try_server "%%~s"
if defined SQLSERVER goto auto_db_found
echo Không tìm thấy SQL Server trên máy - cài SQL Server 2022 Express bằng winget.
echo Có thể mất 5-15 phút và Windows sẽ hỏi quyền quản trị.
call :winget Microsoft.SQLServer.2022.Express || exit /b 1
call :try_server "localhost\SQLEXPRESS"
if defined SQLSERVER goto auto_db_found
echo [Lỗi] Đã cài SQL Server Express nhưng chưa kết nối được. Khởi động lại máy rồi chạy lại run.bat,
echo   hoặc chỉ định server có sẵn: run.bat initdb ^<tên server trong SSMS^>
exit /b 1
:auto_db_found
call :setup_db "%SQLSERVER%"
exit /b %errorlevel%

:try_server
sqlcmd -S "%~1" -E -C -l 5 -h -1 -W -Q "SET NOCOUNT ON; SELECT 1" >nul 2>nul && set "SQLSERVER=%~1"
exit /b 0

:setup_db
set "SQLSERVER=%~1"
echo Dùng SQL Server "%SQLSERVER%" với tài khoản Windows hiện tại.
set "DBEXISTS="
for /f "usebackq delims=" %%n in (`sqlcmd -S "%SQLSERVER%" -E -C -l 10 -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN DB_ID('TrungTamBaoHanhDB') IS NULL THEN 0 ELSE 1 END" 2^>nul`) do set "DBEXISTS=%%n"
if not defined DBEXISTS (
  echo [Lỗi] Không kết nối được SQL Server "%SQLSERVER%" bằng đăng nhập Windows.
  echo   - Kiểm tra tên server trong SSMS ^(ô Server name^), VD: run.bat initdb localhost\SQLEXPRESS
  echo   - Tài khoản Windows phải có quyền tạo database ^(sysadmin hoặc dbcreator^).
  exit /b 1
)
if "%DBEXISTS%"=="1" (
  echo Database TrungTamBaoHanhDB đã có - giữ nguyên dữ liệu.
) else (
  echo Tạo database TrungTamBaoHanhDB và nạp dữ liệu mẫu...
  sqlcmd -S "%SQLSERVER%" -E -C -I -b -f 65001 -i "database\TrungTamBaoHanhDB_SqlServer.sql"
  if errorlevel 1 (echo [Lỗi] Chạy script SQL thất bại - xem thông báo phía trên. & exit /b 1)
)
dotnet user-secrets set "ConnectionStrings:Default" "Server=%SQLSERVER%;Database=TrungTamBaoHanhDB;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;" --project backend-dotnet\src\Soopi.Api >nul
if errorlevel 1 (echo [Lỗi] Không đặt được User Secrets. & exit /b 1)
echo Đã đặt ConnectionStrings:Default tới "%SQLSERVER%" / TrungTamBaoHanhDB.
exit /b 0

rem ================================================================ cổng

:pick_api
rem Cổng trống thì dùng; đang có API Soopi (OpenAPI dev chỉ bản .NET có) thì dùng lại; chương trình khác thì thử cổng sau.
set "API_RUNNING="
for %%p in (8080 8081 8082 8090 18080) do (
  call :port_busy %%p
  if errorlevel 1 (set "API_PORT=%%p" & exit /b 0)
  call :is_soopi_api %%p && (set "API_PORT=%%p" & set "API_RUNNING=1" & exit /b 0)
)
echo [Lỗi] Các cổng 8080, 8081, 8082, 8090, 18080 đều bị chương trình khác dùng.
exit /b 1

:pick_web
set "WEB_RUNNING="
for %%p in (5173 5174 5175 5180 5190) do (
  call :port_busy %%p
  if errorlevel 1 (set "WEB_PORT=%%p" & exit /b 0)
  call :is_soopi_web %%p && (set "WEB_PORT=%%p" & set "WEB_RUNNING=1" & exit /b 0)
)
echo [Lỗi] Các cổng 5173, 5174, 5175, 5180, 5190 đều bị chương trình khác dùng.
exit /b 1

:port_busy
rem errorlevel 0 = cổng đang được dùng, 1 = trống.
netstat -ano | findstr /r /c:":%1 .*LISTENING" >nul
exit /b %errorlevel%

:is_soopi_api
for /f %%c in ('curl -s -o nul -m 3 -w "%%{http_code}" http://localhost:%1/openapi/v1.json') do if "%%c"=="200" exit /b 0
exit /b 1

:is_soopi_web
curl -s -m 3 http://localhost:%1/ | findstr /c:"<title>Soopi</title>" >nul
exit /b %errorlevel%

:wait
for /l %%i in (1,1,180) do (
  curl -s -o nul -m 5 "%~1" && exit /b 0
  ping -n 3 127.0.0.1 >nul
)
echo [Lỗi] API không phản hồi sau 6 phút - xem cửa sổ "Soopi API" ^(lỗi build, database, cổng^).
exit /b 1

rem ================================================================ công cụ

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
  echo [Lỗi] Máy không có winget ^(App Installer^). Cài từ Microsoft Store hoặc cài thủ công rồi chạy lại:
  echo   .NET SDK 10: https://dotnet.microsoft.com/download/dotnet/10.0
  echo   Node.js LTS: https://nodejs.org
  echo   SQL Server Express: https://www.microsoft.com/sql-server/sql-server-downloads
  exit /b 1
)
winget install --id %1 -e --source winget --accept-source-agreements --accept-package-agreements
if errorlevel 1 winget upgrade --id %1 -e --source winget --accept-source-agreements --accept-package-agreements
exit /b 0
