# Bản đồ dự án

```text
warranty-system-soopi/
├── AGENTS.md
├── CLAUDE.md
├── .gitignore
├── run.bat
├── .github/                 # CI/CD
├── .claude/                 # Cấu hình công cụ hiện có
├── .impeccable/             # Dữ liệu thiết kế hiện có
├── backend-dotnet/          # API .NET 10 và kiểm thử
├── frontend-react/          # Web React/Vite
├── Warrant_App/             # Flutter; package warrant_safe, giữ nguyên định danh
├── database/                # Schema, tham chiếu và script dữ liệu
├── deploy/                  # Docker, Caddy và công cụ triển khai
├── verification/            # Script kiểm chứng và kiểm tra cấu trúc
├── contract-snapshots/      # Hợp đồng/response mẫu
├── experiments/             # Thử nghiệm mã nguồn riêng
└── docs/
    ├── README.md
    ├── 01-tong-quan/        # Hướng dẫn, kiến trúc, kế hoạch; README từng ứng dụng
    ├── 02-ky-thuat/         # API, quyết định kỹ thuật, bản quyền tài nguyên
    ├── 03-san-pham/         # Phạm vi sản phẩm, kế hoạch, báo cáo
    ├── 04-van-hanh/         # Cài đặt, kiểm thử, triển khai
    ├── 05-mau/              # Mẫu tài liệu
    ├── 06-design/           # Design system, audit, ảnh và công cụ sơ đồ
    ├── 99-ghi-chu/          # Ghi chú/thử nghiệm
    └── handoff/             # Tiến độ và bàn giao, gồm tài liệu mobile gốc
```

Các ứng dụng ở cùng cấp như bản mẫu `Test-pro`. Không tạo các ứng dụng Trello, chatbot hay MCP trống
vì dự án hiện tại chưa có các thành phần đó. `database`, `deploy` và các thư mục hỗ trợ giữ nguyên tên.

Gốc giữ thêm `.gitignore` vì Git cần quy tắc bỏ qua và `run.bat` để không đổi lệnh chạy Windows hiện có.
README dự án trước đây chuyển vào nhóm tổng quan; GitHub có thể hiển thị mục lục `docs/README.md`.
Tên file cũ được giữ nguyên, chỉ đổi vị trí. Tài nguyên/script đi kèm sơ đồ và ảnh nằm cùng nhóm thiết kế.

API mặc định `http://localhost:8080`, web React `http://localhost:5173`, Flutter Web `http://localhost:5175`.
Flutter Web proxy `/api/` tới API `8080`; Android emulator dùng `http://10.0.2.2:8080/api/v1`.
Máy/thiết bị thật dùng Base URL phù hợp theo [hướng dẫn mobile](Warrant_App/README.md).
