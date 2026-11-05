# Soopi — hướng dẫn làm việc

Đọc `docs/README.md` và `docs/01-tong-quan/ban-do-du-an.md` trước khi chọn phần cần sửa.

- `backend-dotnet/`: API .NET; `frontend-react/`: web React; `Warrant_App/`: ứng dụng Flutter.
- Giữ nguyên tên thư mục ứng dụng, package `warrant_safe` và các định danh nền tảng.
- Mã nguồn, cấu hình và test nằm trong ứng dụng tương ứng. Không tạo Git repository lồng.
- Tài liệu dự án nằm trong các nhóm của `docs/`; giữ tên file khi di chuyển và cập nhật mục lục/liên kết.
  README do SDK sinh bên trong thư mục nền tảng được giữ cùng tài nguyên của SDK.
- Ngoài `AGENTS.md`, `CLAUDE.md`, gốc giữ `.gitignore` cho Git và `run.bat` làm lệnh chạy Windows hiện có.
- `database/`, `deploy/`, `verification/`, `contract-snapshots/`, `experiments/` giữ tên và vai trò hiện tại.
- Không sửa project Java `../warranty-system-mysql`, mobile gốc `../Warrant_App` hoặc thư mục mẫu `Test-pro`.
- Giữ các chỉnh sửa chưa commit của người dùng. Không tự commit/push nếu chưa được yêu cầu.
- Không đưa bí mật, cache hoặc build output vào Git. Không reset/seed/sửa schema hoặc ghi DB nếu chưa được phép.

Kiểm tra theo phạm vi thay đổi:

```text
python verification/check-layout.py
dotnet test backend-dotnet/Soopi.slnx --configuration Release
cd frontend-react && npm test && npm run lint
cd Warrant_App && flutter analyze && flutter test
```

Kiểm thử SQL ghi dữ liệu chạy riêng theo `docs/04-van-hanh/LOCAL_WORKFLOW_TESTING.md`.
Quy ước giao diện web ở `docs/06-design/DESIGN.md`; không thay thiết kế chỉ để tổ chức lại thư mục.
