# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Soopi phục vụ một trung tâm bảo hành và sửa chữa thiết bị điện tử đang hoạt động thật, cho hai nhóm người dùng:

- **Nhân viên trung tâm**, chia theo vai trò. Một tài khoản có thể giữ nhiều vai trò và chọn vai trò khi đăng nhập.
  - **Lễ tân / Tiếp nhận:** nhận máy tại quầy hoặc từ yêu cầu online, tra khách và serial/IMEI, lập phiếu tiếp nhận, xác nhận báo giá thay khách tại quầy.
  - **Điều phối viên:** theo dõi phiếu đang xử lý và cờ SLA, phân công hoặc đổi kỹ thuật viên, duyệt báo giá, xem báo cáo SLA, hiệu suất và nhật ký.
  - **Kỹ thuật viên:** làm việc trên hàng đợi của mình: chẩn đoán theo checklist, lập báo giá, yêu cầu xuất linh kiện, sửa, ghi kết quả và QC 6 bước, ghi chú cho khách hoặc nội bộ.
  - **Quản lý kho vật tư:** quản lý tồn kho; lập và duyệt phiếu nhập, phiếu xuất, điều chuyển.
  - **Thu ngân & Bàn giao:** thu tiền hoặc xác nhận miễn phí; bàn giao máy kèm kiểm tra lại, chữ ký vẽ tay và đánh giá.
  - **Quản trị viên:** quản lý tài khoản nhân viên, vai trò, khóa/mở, đặt lại mật khẩu, danh mục và báo cáo tổng.
- **Khách hàng mang máy đi bảo hành/sửa:** tra cứu tiến độ bằng mã phiếu và số điện thoại mà không cần đăng nhập; hoặc đăng ký bằng số điện thoại có OTP để xem lịch sử, chi tiết phiếu, đồng ý hoặc từ chối báo giá, và gửi yêu cầu bảo hành online kèm ảnh/video.

Có một app di động cho khách do bên khác phát triển, dùng chung API.

## Product Purpose

Soopi giúp trung tâm quản lý toàn bộ vòng đời một ca bảo hành/sửa chữa trên một hệ thống: yêu cầu online → tiếp nhận → phân công → chẩn đoán → báo giá → khách xác nhận → xuất linh kiện → sửa và QC → thu tiền → bàn giao.

Hệ thống được dùng hằng ngày tại trung tâm thật. Thành công nghĩa là:

- nhân viên xử lý phiếu nhanh và đúng quy trình, không trễ SLA;
- khách tự biết máy mình đang ở bước nào, tự quyết định báo giá mà không cần gọi điện hỏi.

## Positioning

*(Suy ra từ code, chưa xác nhận)* Nhân viên và khách nhìn cùng một chuỗi bước của phiếu sửa chữa: Tiếp nhận → Chẩn đoán → Chờ linh kiện → Đang sửa → QC → Sẵn sàng nhận máy. Báo giá đi thẳng từ kỹ thuật viên tới khách để khách quyết định online. Mỗi chuyển trạng thái đều có nhật ký và kiểm quyền theo vai trò.

## Operating Context

- **Ngôn ngữ:** giao diện chỉ có tiếng Việt. Tiền hiển thị theo vi-VN (ví dụ "2.160.000 đ"); giờ theo giờ Việt Nam.
- **Thiết bị:**
  - Mọi màn hình, kể cả màn nhân viên, phải dùng được trên điện thoại và tablet, không chỉ trên máy tính. Ví dụ: kỹ thuật viên cầm tablet tại bàn sửa, thu ngân bàn giao tại quầy.
  - Từ D-046 (2026-10-02) các màn nhân viên co giãn từ 360px: sidebar thành ngăn kéo dưới 1024px, bảng thành thẻ dưới 768px, vùng chạm 44px trên màn cảm ứng (`frontend-react/src/styles/responsive.css`).
- **Giấy tờ và nghi thức thật trong quy trình:** phiếu tiếp nhận in, báo giá có VAT, phiếu nhập/xuất/điều chuyển kho, chữ ký khách khi bàn giao, kiểm tra ngoại quan khi nhận máy.
- **Mã nghiệp vụ** mà người dùng đọc và gõ hằng ngày:
  - phiếu: `TN-YYYY-MMDD-NNNNN`;
  - yêu cầu online: `YC-…`;
  - báo giá: `BG-…`;
  - khách: `KH-…`;
  - nhân viên: `NV-…`;
  - thiết bị: serial/IMEI.
- **Thông báo:** chuông thông báo trong web cho nhân viên. Push và SMS OTP hiện chỉ ghi log; nhà cung cấp thật (eSMS/FCM) chưa được tích hợp.

## Capabilities and Constraints

- **Kiến trúc:** ASP.NET Core Web API (.NET 10) phục vụ bản build React + Vite + TypeScript cùng origin, dùng SQL Server có sẵn (47 bảng). Có 114 endpoint REST `/api/v1`.
- **Hợp đồng API giữ nguyên** (URL, JSON, mã lỗi RFC 9457) để app di động không phải sửa. Không đổi schema DB.
- **Phân quyền** kiểm tại backend theo vai trò/quyền. Ẩn hiện trên frontend chỉ phục vụ điều hướng.
- **Ràng buộc giao diện nhân viên** (thay đổi so với D-014):
  - Được *tinh chỉnh*: sửa CSS/token để cải thiện accessibility, hiệu năng, responsive và đồng bộ thương hiệu.
  - Phải giữ bố cục, nghiệp vụ và luồng thao tác hiện có.
  - Ràng buộc cũ "CSS gốc giữ nguyên byte" (`scripts/check.mjs`) không còn là mục tiêu sản phẩm.
- **Giao diện khách** (`/login`, `/register`, `/account`, `/portal`) port từ web khách KLCN theo D-045, style riêng trong `customer.css`.
- **Chưa có hoặc chưa quyết định:**
  - khách tự kích hoạt bảo hành (backend chưa có endpoint);
  - gửi SMS/push thật;
  - dark mode;
  - ngôn ngữ ngoài tiếng Việt.

## Brand Commitments

- **Tên sản phẩm:** Soopi. Logo chữ là "soopiwarranty", kèm linh vật chim cánh cụt có khiên.
  - Tài sản: `frontend-react/public/images/brand/` (`logo-mark.png`, `wordmark.png`, `wordmark-light.png`, `favicon.png`).
- **Không còn dùng** tên cũ "LongManLoc" ở bất kỳ chỗ hiển thị nào.
- **Giọng văn:** tiếng Việt rõ ràng, lịch sự, đi thẳng vào việc. Gọi người dùng là "bạn"/"khách hàng". Thông báo lỗi nói rõ phải làm gì tiếp.

## Evidence on Hand

- Dữ liệu mẫu 4 ca nghiệp vụ và tài khoản demo:
  - `database/03_demo_data.sql`;
  - `docs/TAI_KHOAN_DEMO.md` (chỉ dùng cho dev/demo).
- Ảnh chụp mọi trang và luồng: `docs/screenshots/`.
- Response mẫu Java/.NET: `contract-snapshots/`.
- Kiểm chứng migration: `verification/`, `docs/MIGRATION_VERIFICATION.md`.
- **Không có và không được bịa:**
  - số liệu khách hàng/thống kê;
  - lời chứng thực (testimonial);
  - hotline, QR, mạng xã hội;
  - giải thưởng, đối tác.

  D-045 đã gỡ những thứ này khỏi bản cũ vì là dữ liệu giả.

## Product Principles

1. **Quy trình là sản phẩm.** Mỗi màn hình phục vụ đúng một bước trong vòng đời phiếu. Trạng thái, SLA và bước tiếp theo phải luôn rõ hơn mọi thứ khác.
2. **Khách thấy sự thật, không cần gọi hỏi.** Những gì khách xem (tiến độ, báo giá, chi phí) lấy từ chính dữ liệu nhân viên đang làm; không làm đẹp hay tô vẽ.
3. **Dùng được ở nơi công việc diễn ra.** Quầy tiếp nhận, bàn kỹ thuật, kho, quầy thu ngân và điện thoại của khách đều là bối cảnh hạng nhất.
4. **Không đổi hợp đồng ngầm.** API, mã nghiệp vụ và dữ liệu cũ phải giữ ổn định cho app di động và lịch sử phiếu.
5. **Không thông tin giả.** Chỉ hiển thị dữ liệu và năng lực hệ thống thật sự có.

## Accessibility & Inclusion

- **Mục tiêu:** WCAG 2.2 AA cho mọi màn hình, cả nhân viên lẫn khách.
- **Thao tác:** dùng được bằng bàn phím và cảm ứng; vùng chạm đủ lớn trên tablet và điện thoại.
- **Hỗ trợ sẵn có:** tôn trọng `prefers-reduced-motion` và `forced-colors`, như CSS hiện đã làm.
