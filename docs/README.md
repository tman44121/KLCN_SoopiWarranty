# Soopi — mục lục tài liệu

Repository gồm API .NET, web React và mobile Flutter. Cấu trúc theo bộ khung `Test-pro`, giữ nguyên tên dự án,
thư mục ứng dụng, tên file, package và định danh nền tảng.

| Cần làm | Tài liệu |
| --- | --- |
| Xem cấu trúc và quy tắc đặt file | [Bản đồ dự án](01-tong-quan/ban-do-du-an.md) |
| Chạy API/web và hiểu dự án | [README](01-tong-quan/README.md), [SETUP](04-van-hanh/SETUP.md) |
| Chạy mobile, cấu hình API, kiểm thử Flutter | [Mobile README](01-tong-quan/Warrant_App/README.md) |
| Phát triển web | [Frontend README](01-tong-quan/frontend-react/README.md) |
| Kiến trúc và kế hoạch chuyển đổi | [ARCHITECTURE](01-tong-quan/ARCHITECTURE.md), [MIGRATION_PLAN](01-tong-quan/MIGRATION_PLAN.md) |
| API, endpoint và quyết định kỹ thuật | [API](02-ky-thuat/API.md), [ENDPOINTS](02-ky-thuat/ENDPOINTS.md), [DECISIONS](02-ky-thuat/DECISIONS.md) |
| Thống kê, chat và đánh giá công khai | [ACCESS_STATISTICS](02-ky-thuat/ACCESS_STATISTICS.md), [CHAT](02-ky-thuat/CHAT.md), [PUBLIC_REVIEWS](02-ky-thuat/PUBLIC_REVIEWS.md) |
| Phạm vi sản phẩm và kế hoạch đánh giá | [PRODUCT](03-san-pham/PRODUCT.md), [PLAN_CUSTOMER_REVIEWS](03-san-pham/PLAN_CUSTOMER_REVIEWS.md) |
| Kiểm thử và vận hành | [LOCAL_WORKFLOW_TESTING](04-van-hanh/LOCAL_WORKFLOW_TESTING.md), [OPERATIONS](04-van-hanh/OPERATIONS.md), [Verification README](04-van-hanh/verification/README.md) |
| Triển khai và tài khoản thử | [DEPLOY_VPS](04-van-hanh/DEPLOY_VPS.md), [Deploy 08/11/2026: file SQL cần chạy + prompt ChatGPT](04-van-hanh/DEPLOY_CHECKLIST_2026-11-08.md), [TAI_KHOAN_DEMO](04-van-hanh/TAI_KHOAN_DEMO.md) |
| Mẫu tài liệu | [README](05-mau/README.md) |
| Thiết kế, audit giao diện và sơ đồ | [DESIGN](06-design/DESIGN.md), [UI_AUDIT](06-design/UI_AUDIT.md), [ROSE_DIAGRAMS](06-design/ROSE_DIAGRAMS.md), [ERD](06-design/rose/erd/README.md) |
| Audit giao diện mobile sau gộp | [Impeccable audit Flutter](06-design/Warrant_App/UI_AUDIT.md) |
| Thử nghiệm và ghi chú | [LoRA README](99-ghi-chu/experiments/warranty-lora/README.md) |
| Tiến độ và bàn giao | [PROGRESS](handoff/PROGRESS.md), [MIGRATION_VERIFICATION](handoff/MIGRATION_VERIFICATION.md), [Tích hợp mobile](handoff/INTEGRATION_2026-11-04.md), [Mobile review](handoff/Warrant_App/PROJECT_REVIEW_CURRENT.md) |

Các thư mục `database/`, `deploy/` và `verification/` chứa script/cấu hình thực thi; tài liệu hướng dẫn của chúng
nằm trong nhóm tương ứng phía trên. Không chạy script reset database chỉ để kiểm tra cấu trúc.
