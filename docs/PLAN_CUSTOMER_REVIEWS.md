# Kế hoạch sửa đánh giá khách hàng và bổ sung báo cáo dành riêng cho admin

Ngày cập nhật: 22/10/2026. Trạng thái: đã triển khai backend, migration, form khách và báo cáo admin; đã áp dụng migration lên DB phát triển local.

## 1. Kết quả kiểm tra

### Lỗi gửi đánh giá đã tái hiện

`TicketRatingRequest` trong `backend-dotnet/src/Soopi.Api/Services/Portal/PortalTicketService.cs` đặt `[property: NotNull, Min(1), Max(5)]` trên thuộc tính `Rating` của positional record. MVC yêu cầu validation metadata nằm trên tham số constructor của loại record này.

Đã chạy MVC `IObjectModelValidator` với dữ liệu hợp lệ `{ rating: 5, comment: "Dịch vụ tốt" }` và nhận `InvalidOperationException`: validation metadata nằm trên property thay vì constructor parameter. Lỗi xảy ra trước khi gọi `RateTicketAsync`; exception handler hiện ánh xạ thành lỗi hệ thống.

Kiểm tra chẩn đoán không gửi đánh giá hoặc ghi dữ liệu thật. Đã bổ sung test MVC để bắt lỗi metadata thay vì chỉ kiểm tra `Ticket.UpdateRating`.

Hai lỗi liên quan phát hiện khi triển khai cũng đã được sửa: ghi chú phiếu có khóa ngoại người viết tới nhân viên nên không thể dùng để lưu nhận xét do khách viết; cấu hình JWT thiếu `RoleClaimType = "roles"` khiến `[Authorize(Roles = ...)]` chặn cả admin hợp lệ.

### Những phần chưa đầy đủ

- Backend chỉ lưu số sao trong `PhieuBanGiao.DanhGiaHaiLong`; nhận xét được ghép tiền tố rồi thêm vào `GhiChuPhieu`, chưa có trường nhận xét/thời điểm đánh giá riêng.
- `PortalTicketView` trả `rating`, `canRate`, nhưng không trả lại nhận xét hiện tại. Form chỉnh sửa khởi tạo nhận xét rỗng và không hiển thị lại nội dung đã gửi sau khi tải trang.
- Textarea cho nhập 1.000 ký tự, sau đó frontend còn ghép các nhãn cảm nhận; backend lại thêm tiền tố trước khi cắt ghi chú xuống 1.000 ký tự. Có nguy cơ mất phần cuối nhận xét.
- Phiếu được đọc trước transaction trong `RateTicketAsync`. Khi xung đột phiên bản, cơ chế retry có thể dùng lại đối tượng cũ. Cần đọc lại phiếu trong mỗi lượt transaction.
- Chưa có API hoặc bảng danh sách đánh giá khách hàng trong phần báo cáo admin. Báo cáo kỹ thuật viên hiện chỉ có điểm trung bình.

## 2. Quy tắc dữ liệu và quyền truy cập

- Khách chỉ gửi/sửa đánh giá cho phiếu thuộc quyền của mình, đã `DELIVERED` hoặc `RETURNED_UNREPAIRED`, có dữ liệu bàn giao.
- Mỗi phiếu giữ một đánh giá hiện tại. Cập nhật thay thế số sao/nhận xét hiện tại; nhật ký thao tác giữ dấu vết cập nhật.
- Số sao nguyên từ 1 đến 5; nhận xét tùy chọn, tối đa 1.000 ký tự tính cả các nhãn cảm nhận được ghép vào nội dung.
- Danh sách quản trị chỉ ADMIN được truy cập. Chặn tại API và service; các vai trò khác bị từ chối dù gọi API trực tiếp.
- Khách vẫn xem/sửa được đánh giá của chính mình. Không mở API liệt kê đánh giá của khách khác cho khách hoặc nhân viên.

## 3. Thứ tự triển khai

| Bước | Công việc | Phạm vi chính | Điều kiện hoàn thành |
|---|---|---|---|
| 1 — Backend | Sửa validation của `TicketRatingRequest`; bổ sung giới hạn nhận xét và lỗi dữ liệu đầu vào | `Services/Portal/PortalTicketService.cs`, tests | Gửi 1–5 sao đi qua MVC; thiếu sao, sai kiểu, ngoài khoảng và nhận xét quá dài bị từ chối đúng |
| 2 — Database/backend | Lưu và đọc đánh giá đầy đủ, giữ tương thích dữ liệu cũ | `01_schema.sql`, `05_upgrade_existing_db.sql`, file SQL ghép, `Domain/Tickets/Ticket.cs`, `Data/Stores/TicketStore.cs` | Số sao, nhận xét và thời điểm cập nhật được lưu cùng transaction; tải lại không mất dữ liệu |
| 3 — Backend | Hoàn thiện gửi/sửa: kiểm tra chủ phiếu, trạng thái, bàn giao; đọc lại phiếu bên trong transaction; trả nhận xét hiện tại trong DTO | `PortalTicketService.cs`, `PortalTicketView`, tests | Sửa đánh giá không tạo bản ghi đánh giá trùng; lỗi/retry không gây lưu một phần hoặc dùng dữ liệu cũ |
| 4 — Backend | Thêm API báo cáo đánh giá chỉ dành cho admin, có phân trang và bộ lọc | `Controllers/ReportNotificationControllers.cs`, `Services/Reporting/ReportService.cs`, DTO báo cáo | ADMIN xem được; khách và mọi vai trò nhân viên khác bị từ chối |
| 5 — Frontend khách | Nạp nhận xét cũ khi chỉnh sửa; đồng bộ số sao; tính giới hạn nội dung sau khi ghép nhãn; giữ bản nháp nếu gửi lỗi; hiển thị theo điều kiện backend | `pages/account.tsx`, `behaviors/api.js`, CSS nếu cần | Gửi mới → sửa → tải lại đều hiển thị đúng; không báo thành công khi API lỗi |
| 6 — Frontend admin | Thêm mục “Đánh giá khách hàng” trong `/admin#reports`, nối API và bộ lọc hiện có | `pages/admin.tsx`, `behaviors/admin.js`, `behaviors/api.js`, CSS bảng hiện có | Danh sách, phân trang, số liệu, trạng thái tải/rỗng/lỗi và màn hình nhỏ hoạt động |
| 7 — Kiểm tra | Test MVC, service/SQL, phân quyền và trình duyệt; build/lint | `backend-dotnet/tests/Soopi.Tests`, `frontend-react/scripts` | Các tiêu chí bên dưới đạt, không làm lệch báo cáo cũ |

## 4. Phương án database tối thiểu

Tận dụng `PhieuBanGiao`, vốn có quan hệ duy nhất với phiếu tiếp nhận và đã lưu số sao:

- Giữ `DanhGiaHaiLong` để báo cáo điểm trung bình hiện có tiếp tục hoạt động.
- Thêm `NhanXetDanhGia NVARCHAR(1000) NULL`.
- Thêm `NgayDanhGia DATETIME2(0) NULL`: thời điểm gửi/cập nhật đánh giá gần nhất từ luồng khách hàng.
- Không tiếp tục dùng ghi chú phiếu làm nguồn dữ liệu chính của đánh giá mới.

Giữ nguyên ghi chú, số sao và nhật ký cũ. Trước khi backfill, đối chiếu ghi chú do CUSTOMER viết với sự kiện `TICKET_RATED`; chỉ chuyển trường hợp có thể xác định chắc chắn. Nếu thiếu bằng chứng về nhận xét, ngày hoặc nguồn gửi, hiển thị “Dữ liệu cũ chưa xác định” thay vì suy diễn ngày đánh giá từ ngày bàn giao hoặc coi mọi điểm do nhân viên nhập là khách tự đánh giá. Không tự xóa lịch sử cũ.

Migration phải chạy lại an toàn và đồng bộ giữa script tạo mới, script nâng cấp và file SQL ghép.

## 5. API và giao diện báo cáo đề xuất

`GET /api/v1/reports/customer-reviews`

- Quyền: `[Authorize(Roles = "ADMIN")]` tại endpoint, kiểm tra quyền `REPORT_SYSTEM` tại service theo cấu trúc hiện tại.
- Bộ lọc: `from`, `to`, `station`, `rating`, `q`, `page`, `size`.
- Khoảng ngày tính theo thời điểm đánh giá/cập nhật gần nhất, theo giờ Việt Nam; ghi rõ trên giao diện.
- `q` tìm mã phiếu, tên hoặc SĐT khách; mặc định 25 dòng/trang, mới nhất trước và có khóa phụ để phân trang ổn định.
- Trả danh sách phân trang cùng tổng số và điểm trung bình trên toàn bộ tập dữ liệu sau lọc.

Trong `/admin#reports`, thêm bảng “Đánh giá khách hàng”:

| Cột | Nội dung |
|---|---|
| Thời điểm đánh giá | Ngày/giờ gửi hoặc cập nhật gần nhất; dữ liệu cũ không rõ thời điểm có nhãn riêng |
| Khách hàng | Tên và số điện thoại |
| Phiếu / thiết bị | Mã phiếu, tên thiết bị |
| Trạm | Trạm dịch vụ của phiếu |
| Số sao | 1–5 sao, có giá trị dạng chữ/số để không phụ thuộc màu |
| Nhận xét | Toàn bộ nội dung đánh giá hiện tại, hiển thị như văn bản an toàn |

Tái sử dụng bộ lọc thời gian/trạm của báo cáo; thêm lọc số sao và tìm kiếm cho bảng. Hai số liệu “Tổng đánh giá” và “Điểm trung bình” dùng cùng bộ lọc, không tính riêng trên trang đang xem. Lỗi tải bảng đánh giá không làm mất các biểu đồ báo cáo đang có.

## 6. Tiêu chí nghiệm thu

1. Khách gửi 1–5 sao thành công, tải lại vẫn thấy đúng số sao và nhận xét; sửa thay thế dữ liệu hiện tại.
2. Đánh giá không có nhận xét vẫn hợp lệ; cập nhật nhận xét thành rỗng phải xóa nhận xét hiện tại rõ ràng.
3. Nội dung đủ giới hạn được giữ nguyên; nội dung quá giới hạn bị báo lỗi, không cắt âm thầm. Kiểm tra cả nhãn cảm nhận và Unicode.
4. Khách không đánh giá được phiếu người khác, phiếu chưa bàn giao hoặc phiếu thiếu dữ liệu bàn giao.
5. Nhấn gửi liên tiếp, gửi đồng thời và xung đột phiên bản không tạo đánh giá trùng hoặc nhật ký/nhận xét bị lặp do retry.
6. ADMIN xem được danh sách; CUSTOMER, RECEPTIONIST, DISPATCHER, TECHNICIAN, CASHIER và WAREHOUSE_KEEPER không gọi được API danh sách.
7. Tìm kiếm, lọc ngày/trạm/sao và phân trang trả đúng dữ liệu; tổng và trung bình tính trên toàn bộ kết quả lọc; dữ liệu trống không hiển thị trung bình giả bằng 0.
8. Nhận xét chứa ký tự HTML hiển thị như văn bản; không thực thi nội dung người dùng nhập.
9. Dữ liệu cũ được giữ nguyên, nguồn gửi và ngày không rõ được thể hiện đúng; báo cáo kỹ thuật viên hiện có không bị thay đổi ngoài ý muốn.
10. Build/lint, test backend/frontend và kiểm tra trình duyệt desktop/mobile đạt.

## 7. Giới hạn phạm vi

Chưa bổ sung xuất Excel/PDF, trả lời đánh giá, xóa/ẩn đánh giá, biểu đồ mới hoặc phân tích cảm xúc. Không gửi đánh giá thật trong kiểm thử: các bài kiểm tra ghi DB đều rollback. Migration schema đã áp dụng lên DB phát triển local. Việc khôi phục đầy đủ nhận xét/thời điểm đánh giá cũ phụ thuộc dữ liệu ghi chú và nhật ký thực tế.

## 8. Kết quả triển khai

- Giới hạn 1.000 ký tự tính cả cảm nhận và nhận xét; giữ nguyên Unicode, không cắt âm thầm. Form tải lại và khôi phục được nội dung/cảm nhận khi sửa; nhận xét rỗng xóa nội dung hiện tại.
- Đọc phiếu lại trong mỗi lượt transaction; gửi lại cùng nội dung không thêm nhật ký trùng. Phiếu thiếu bàn giao không được đánh giá.
- Hai trường đánh giá mới được ẩn khỏi JSON bàn giao chung; chủ phiếu nhận qua DTO portal và admin nhận qua DTO báo cáo.
- Báo cáo mặc định hiển thị mọi thời gian để không giấu điểm cũ. Có thể chọn dùng khoảng thời gian báo cáo phía trên; trạm luôn dùng chung với báo cáo. Số sao, tìm kiếm, phân trang và số dòng có bộ điều khiển riêng.
- Điểm cũ chưa xác định nguồn/ngày vẫn có trong danh sách nhưng không tính vào số lượng/điểm trung bình đánh giá khách đã xác nhận; hiển thị tổng điểm cũ riêng.
- Đã qua 80 test backend, 17 test frontend, build/lint và kiểm tra trình duyệt desktop/mobile trong `frontend-react/scripts/reviews.mjs`.
- Kiểm tra DB local đã xác minh lưu/tải lại đủ 1.000 ký tự Unicode, gửi lại, xóa nhận xét, quyền sở hữu, thiếu bàn giao, bộ lọc/tổng/trung bình, dữ liệu cũ và migration lặp lại; mọi dữ liệu thử đã rollback.
- 25 kiểm tra HTTP thật đã đạt: phân quyền, payload hợp lệ đi tới bước kiểm tra phiếu, payload sai/nhận xét quá dài trả 400, năm báo cáo cũ vẫn tải được và endpoint thông báo nhận đúng vai trò sau khi sửa JWT.
- Đã mở báo cáo bằng admin thật trên desktop/mobile, xác minh không lỗi tải hoặc tràn ngang. Backend local đã khởi động lại tại cổng 8080 với bản sửa; frontend tại cổng 5173 dùng mã hiện tại.
