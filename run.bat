@echo off
rem Chạy Soopi trên máy dev (xem docs/SETUP.md).
rem   run.bat         API .NET (8080) + Vite (5173), mở http://localhost:5173/login
rem   run.bat build   build React vào wwwroot rồi chỉ chạy API, mở http://localhost:8080/login
rem Cần: .NET SDK 10, Node.js, và User Secrets ConnectionStrings:Default đã đặt (docs/SETUP.md mục 2).
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where dotnet >nul 2>nul || (echo [Lỗi] Chưa cài .NET SDK 10. & pause & exit /b 1)
where npm >nul 2>nul || (echo [Lỗi] Chưa cài Node.js/npm. & pause & exit /b 1)

if not exist "frontend-react\node_modules" (
  echo Cài dependency frontend ^(npm ci^)...
  pushd frontend-react
  call npm ci
  if errorlevel 1 (popd & echo [Lỗi] npm ci thất bại. & pause & exit /b 1)
  popd
)

set "WEB=http://localhost:5173/login"
if /i "%~1"=="build" (
  echo Build frontend vào backend-dotnet\src\Soopi.Api\wwwroot...
  pushd frontend-react
  call npm run build
  if errorlevel 1 (popd & echo [Lỗi] Build frontend thất bại. & pause & exit /b 1)
  popd
  set "WEB=http://localhost:8080/login"
)

rem Job cảnh báo SLA tắt khi chạy dev như docs/SETUP.md.
start "Soopi API (8080)" /d "%~dp0backend-dotnet" cmd /k dotnet run --project src/Soopi.Api --launch-profile http -- --Sla:Alerts:Enabled=false
if /i not "%~1"=="build" start "Soopi Web (5173)" /d "%~dp0frontend-react" cmd /k npm run dev

echo Đang chờ API khởi động...
call :wait http://localhost:8080/actuator/health || (pause & exit /b 1)
start "" "%WEB%"
echo Đã mở %WEB%. Đóng các cửa sổ "Soopi API"/"Soopi Web" để dừng.
exit /b 0

:wait
for /l %%i in (1,1,90) do (
  curl -s -o nul "%~1" && exit /b 0
  ping -n 3 127.0.0.1 >nul
)
echo [Lỗi] API không phản hồi sau 3 phút - xem cửa sổ "Soopi API" (DB, User Secrets, cổng 8080).
exit /b 1
