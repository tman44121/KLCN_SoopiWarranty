# Chat khách hàng và người phụ trách phiếu

Nút **Tin nhắn** nằm trên header, cạnh chuông, có badge tổng tin chưa đọc; không còn nút nổi che bảng/phân trang.
Nút mở cửa sổ nhỏ ở góc phải dưới (tối đa 340 × 440 px), không khóa cuộn hay làm mờ trang; điện thoại tự co theo màn hình.
Bấm **Thu gọn (−)** hoặc Escape trong chat để hiện nút tròn nhỏ với tên viết tắt và badge. Bấm nút tròn để mở lại đúng cuộc chat;
bản nháp vẫn giữ trong cùng trang. Bấm **Đóng (×)** để ẩn cả cửa sổ và nút tròn; vẫn mở lại được từ header.
Nút × cạnh vòng tròn đóng nhanh chat đã thu gọn. Thao tác ngoài cửa sổ vẫn dùng được bình thường.
Khách đã đăng nhập cũng có nút trên header trang chủ/tra cứu; khách vãng lai không thấy nút.
Trong chi tiết phiếu, nút **Nhắn người phụ trách** mở danh bạ đúng phiếu để chọn người tiếp nhận hoặc KTV;
**Tất cả liên hệ** bỏ bộ lọc phiếu.
Khách tìm/chọn nhân viên tiếp nhận hoặc KTV hiện được phân công, theo tên, mã phiếu hoặc thiết bị.
Nội bộ tìm khách theo tên/mã khách, mã phiếu, sản phẩm hoặc serial trong phạm vi phiếu mình phụ trách.
Khách/nhân viên cần có hồ sơ và tài khoản hoạt động để bắt đầu hoặc gửi tin.

Mỗi cuộc chat gắn với một phiếu, một tài khoản khách và một tài khoản nhân viên. Cả hai phía có thể bắt đầu;
yêu cầu lặp lại trả về cùng cuộc chat. Không mở quyền đọc khách toàn hệ thống cho KTV, không công khai số điện thoại,
email hay tên đăng nhập nội bộ. Token tra cứu phiếu không dùng được API chat; cần đăng nhập tài khoản.

Khi đổi KTV, người cũ và khách được xem lại cuộc chat cũ nhưng không gửi thêm vào đó. KTV mới có cuộc chat riêng
và không đọc được lịch sử giữa khách và người cũ. Nếu một nhân viên vừa tiếp nhận vừa sửa, chat vẫn dùng một cặp
tài khoản trên phiếu. Khi đổi chủ phiếu/tài khoản khách, cuộc chat cũ không chuyển sang tài khoản khác.

Tin nhắn văn bản tối đa 2.000 đơn vị UTF-16, lưu Unicode trong SQL Server. Gửi lại sau lỗi mạng dùng cùng requestId
để tránh trùng tin. Đánh dấu đã đọc chỉ đến tin đã tải, tăng một chiều; không xóa trạng thái chưa đọc của tin đến sau.
Lịch sử tải 50 tin/lần, có nút xem cũ hơn. Khi mở chat, lấy tin mới mỗi 3 giây theo cursor, tải tiếp các trang khi có
nhiều tin mới; danh bạ/badge cập nhật 5 giây khi mở, 15 giây khi đóng. Tạm ngừng polling khi tab bị ẩn.
Không hiển thị trạng thái trực tuyến/đang gõ giả. Chưa có tệp đính kèm, gọi thoại hoặc push ngoài trình duyệt.

## Cài đặt

Database mới đã có hai bảng trong `01_schema.sql` và file SQL ghép. Database hiện có chạy `database/06_chat.sql`
trước khi dùng backend mới; script không xóa dữ liệu và chạy lại an toàn. Xem `SETUP.md`.

## API

| Method | Đường dẫn dưới `/api/v1/chat` | Nội dung |
|---|---|---|
| GET | `/contacts?q=...&page=0` | 25 người liên hệ theo phiếu, hasMore, tổng unreadCount |
| POST | `/conversations` | `{ticketCode, staffAccountId}` → `{id}` |
| GET | `/conversations/{id}/messages` | 50 tin gần nhất, theo thứ tự tăng |
| GET | `/conversations/{id}/messages?before=...` | Tin cũ hơn, không bao gồm cursor |
| GET | `/conversations/{id}/messages?after=...` | Tin mới hơn, tăng dần; `0` bắt đầu từ tin đầu |
| POST | `/conversations/{id}/messages` | `{text, requestId}`; requestId là UUID khác rỗng |
| POST | `/conversations/{id}/read` | `{lastMessageId}` → 204 |

ID BIGINT truyền dạng chuỗi để giữ chính xác trên JavaScript. Không dùng `before` và `after` cùng lúc.
Mọi thao tác kiểm tra đúng hai tài khoản; gửi tin kiểm tra lại phân công và trạng thái hoạt động trong transaction.

## Kiểm thử

```powershell
dotnet test backend-dotnet/tests/Soopi.Tests
npm --prefix frontend-react test
npm --prefix frontend-react run build
# Chạy từ gốc repo, cần SQL Server dev có dữ liệu demo và User Secrets của backend.
dotnet build verification/chat-probe -o artifacts/chat-probe-build
dotnet artifacts/chat-probe-build/ChatProbe.dll
# Cần Vite đang chạy và Playwright/Edge có sẵn; đặt PLAYWRIGHT_PACKAGE nếu khác đường dẫn mặc định của smoke.mjs.
node frontend-react/scripts/chat.mjs
node frontend-react/scripts/chat-header.mjs
```

ChatProbe tự rollback tin nhắn, phân công và trạng thái tài khoản thử. Không chạy với dữ liệu production.
Browser regression dùng API giả lập chung giữa hai phiên, không gửi tin thật.
