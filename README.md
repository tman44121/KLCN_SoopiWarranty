# Soopi — hệ thống quản lý bảo hành

Soopi chuyển ứng dụng Spring Boot sang ASP.NET Core Web API và React, giữ nghiệp vụ và schema SQL Server hiện có.
Project Java `../warranty-system-mysql` là nguồn đối chiếu chỉ đọc.

**Trạng thái 02/10/2026:** backend có 114 endpoint, frontend có 10 trang. Giai đoạn 4 đã đối chiếu một phần;
chưa nghiệm thu toàn bộ API có token và luồng ghi/đồng thời. Xem [báo cáo kiểm chứng](docs/MIGRATION_VERIFICATION.md).

## Bắt đầu

1. Đọc [cài đặt và cấu hình](docs/SETUP.md). Máy hiện tại đã có User Secrets nối `TrungTamBaoHanhDB_Dev`;
   không chạy lại lệnh đặt connection string nếu cấu hình đó vẫn đúng.
2. Mở terminal tại `warranty-system-soopi` và chạy backend:

   ```powershell
   Set-Location backend-dotnet
   dotnet run --project src/Soopi.Api --launch-profile http -- --Sla:Alerts:Enabled=false
   ```

3. Terminal thứ hai tại `warranty-system-soopi`, chạy frontend:

   ```powershell
   Set-Location frontend-react
   npm.cmd ci
   npm.cmd run dev
   ```

4. Mở trang giới thiệu `http://localhost:5173/`, đăng nhập `http://localhost:5173/login` hoặc portal `http://localhost:5173/portal`.
   Kiểm kết nối bằng `GET http://localhost:8080/actuator/health`.

Đăng nhập, refresh/logout và các form thật có thể ghi DB. Tham số trên chỉ tắt job SLA;
job dọn refresh token vẫn chạy lúc 02:00 giờ Việt Nam. Trong phiên chỉ đọc, dừng API trước lịch này.
Hướng dẫn chi tiết và giới hạn kiểm thử nằm ở [verification](verification/README.md).

## Cấu trúc

```text
warranty-system-soopi/
├── backend-dotnet/       # Soopi.Api (.NET 10) và Soopi.Tests
├── frontend-react/       # React, Vite, TypeScript, React Router
├── docs/                 # Cấu hình, kiến trúc, API, vận hành và quyết định
├── verification/         # Đối chiếu Java/.NET, oracle và metadata DB
├── contract-snapshots/   # Response mẫu không chứa secret
└── MIGRATION_PLAN.md     # Entity, endpoint, giao diện và kế hoạch chuyển đổi
```

React dùng `fetch`; backend dùng EF Core SQL Server và T-SQL tham số hóa trên cùng connection/transaction.
Không có EF migration hay tự tạo schema. Bản build React được phục vụ từ `Soopi.Api/wwwroot`.

## Tài liệu

| Cần làm | Đọc |
|---|---|
| Cài máy, nối DB, chạy local, xử lý lỗi khởi động | [SETUP](docs/SETUP.md) |
| Hiểu luồng xử lý, lưu trữ, phân quyền và phạm vi migration | [ARCHITECTURE](docs/ARCHITECTURE.md) |
| Gọi API, đăng nhập, JSON, phân trang, lỗi và upload | [API](docs/API.md) |
| Kiểm thử, đóng gói và vận hành | [OPERATIONS](docs/OPERATIONS.md) |
| Danh sách đủ 114 method/URL | [ENDPOINTS](verification/ENDPOINTS.md) |
| Entity/bảng, trang UI và logic Java gốc | [MIGRATION_PLAN](MIGRATION_PLAN.md) |
| Lý do các lựa chọn đã chốt | [DECISIONS](docs/DECISIONS.md) |
| Tiến độ và bằng chứng tương đương | [PROGRESS](docs/PROGRESS.md), [MIGRATION_VERIFICATION](docs/MIGRATION_VERIFICATION.md) |
| Chi tiết frontend và audit giao diện | [Frontend README](frontend-react/README.md), [UI_AUDIT](docs/UI_AUDIT.md) |
| Chạy oracle/đối chiếu mà không ghi DB | [Verification README](verification/README.md) |

## Kiểm tra

Trong `backend-dotnet`:

```powershell
dotnet build Soopi.slnx --artifacts-path artifacts/stage4
dotnet test Soopi.slnx --artifacts-path artifacts/stage4 --no-build --no-restore
```

Trong `frontend-react`:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

Kết quả gần nhất: backend 45/45 test; frontend 7/7; smoke 49 kiểm tra dùng API mock.
44 HTTP case đã đối chiếu nội dung, trong đó 4 raw diff chỉ là thứ tự lỗi validation; chưa chứng minh toàn bộ nghiệp vụ.

## Quy tắc khi tiếp tục phát triển

- Chỉ sửa repo Soopi; không sửa, xóa, di chuyển hoặc build trong project Java gốc.
- Giữ schema/dữ liệu SQL Server; không chạy migration, seed hay script DDL/DML trong phiên chỉ đọc.
- Secret nằm ngoài Git, trong User Secrets/biến môi trường; `VITE_*` chỉ chứa cấu hình công khai.
- Package mới ngoài danh sách đã duyệt và kiểm thử ghi DB phải được chủ dự án duyệt trước.
- Cập nhật quyết định/báo cáo khi thay đổi hợp đồng API hoặc phát hiện lệch nghiệp vụ. Không commit tự động.
