# Kiểm thử quy trình trên local

Phạm vi: giờ hẹn AM/PM, thứ Hai–thứ Bảy 08:00–17:00 theo giờ Việt Nam; tên “Số phiếu đang xử lý”; tìm toàn bộ báo giá theo mã báo giá/mã phiếu/tên/SĐT, trạng thái, ngày; danh sách mới nhất trước và bộ lọc theo từng màn. Không triển khai VPS.

## Tạo lại toàn bộ dữ liệu

Chạy từ thư mục gốc dự án:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File database/test-data/Reset-LocalData.ps1
```

Lệnh này **xóa toàn bộ dữ liệu trong `localhost,1433 / TrungTamBaoHanhDB_Dev`**, bao gồm tài khoản, phiên đăng nhập, nhật ký, chat và duyệt đánh giá, rồi nạp bộ kiểm thử mới. Không cần bấm xác nhận lần nữa. Chỉ cho phép server local và hai database `_Dev` hoặc `_KiemThu`; không nhận tên database production. Muốn chọn database kiểm thử khác đã có:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File database/test-data/Reset-LocalData.ps1 -Database TrungTamBaoHanhDB_KiemThu
```

Script thực hiện:

1. Sao lưu `COPY_ONLY, CHECKSUM` vào thư mục backup do SQL Server cung cấp, chạy `RESTORE VERIFYONLY`. Thất bại thì dừng trước khi xóa.
2. Tạo database tạm, nạp schema/tham chiếu/demo, cập nhật schema hiện hành và sinh khoảng 600 phiếu với 400 khách. Chạy 46 ca bắt buộc và đối soát tồn/kệ/giữ hàng.
3. Chỉ khi dữ liệu tạm đạt mới xóa và nạp lại dữ liệu đích trong **một transaction**. Lỗi bất kỳ trước commit sẽ rollback; schema và tài khoản kết nối SQL được giữ lại.
4. Bật và kiểm tra lại mọi ràng buộc. Dọn database tạm. Ghi backup, log và `cases.json` vào `artifacts/local-reset/<lần chạy>/`.

Đóng các thao tác đang nhập trước khi chạy. Sau khi hoàn tất, đăng nhập lại vì phiên cũ đã bị xóa. Các mã có thể đổi theo ngày chạy; dùng `cases.json` của lần gần nhất. Dữ liệu là dữ liệu kiểm thử, không dùng để công bố phản hồi khách hàng. Không tự duyệt đánh giá lên trang chủ. Các tệp cũ trên đĩa không bị xóa.

## Tài khoản và ca thực hành

Tài khoản nhân viên/khách trong [TAI_KHOAN_DEMO.md](TAI_KHOAN_DEMO.md) được nạp lại. Mật khẩu demo `1234`, riêng `admin` là `admin123`. Tài khoản `kythuat_khoa` bị khóa có chủ ý. Tên đăng nhập đúng kỹ thuật viên của từng phiếu nằm trong `cases.json`.

| Nhóm | Ca bắt buộc | Kết quả cần kiểm tra |
|---|---|---|
| Tiếp nhận | Yêu cầu online chờ, đã hủy, phiếu RECEIVED | Chuyển yêu cầu thành phiếu; đã hủy không tiếp nhận lại; phân công đúng vai trò |
| Chẩn đoán | INSPECTING, miễn phí, tính phí | Checklist; miễn phí được sửa; tính phí phải báo giá |
| Báo giá | Đang duyệt, đã duyệt, từ chối, hết hạn, chỉ tiền công | Tìm tất cả trạng thái; phân trang; hết hạn không xác nhận; chỉ tiền công không cần xuất kho |
| Kho | Hết hàng, kệ trống, đủ hàng, nhập, điều chuyển | Thiếu hàng không tạo phiếu xuất/giữ hàng; thiếu kệ rollback; đủ hàng trừ đúng tồn và giữ; nhập tăng tồn; chuyển kệ giữ tổng |
| Sửa/QC | Đang sửa, QC FAIL, QC FAIL rồi PASS | FAIL tiếp tục sửa, đủ 6 bước PASS mới hoàn tất; giữ lịch sử các lần |
| Thu ngân | Chưa trả tiền, đã trả tiền, chờ trả nguyên trạng | Chặn bàn giao khi chưa thu/xác nhận miễn phí; chặn thu trùng; không thu tiền sửa khi trả nguyên trạng |
| Đóng phiếu | DELIVERED, RETURNED_UNREPAIRED | Xem phiếu thu/bàn giao/lịch sử; không sửa lại trạng thái đã đóng |
| SLA | Đúng hạn, sắp trễ, đã trễ | Mặc định mới nhất; có thể chọn hạn SLA gần nhất |
| Quyền/khách | Khách có lịch sử, tài khoản khóa | Chỉ thấy dữ liệu của mình; tài khoản khóa không đăng nhập |

Có thêm ca kỹ thuật viên đủ tải/vắng mặt, phiếu trạm HN với tài khoản `ktv.hanoi` / `1234`, vào nước, hết bảo hành, phân loại lại thiếu lý do, nhập/điều chuyển bị từ chối và đánh giá chờ admin duyệt.

`STOCK_RESERVED_FULL` có tồn khả dụng 0 vì toàn bộ hàng đã giữ cho chính phiếu xuất: kho vẫn có thể duyệt phiếu này. Đây là trường hợp khác với hết hàng thật.

`STOCK_ZERO` sử dụng riêng `LK-TEST-ZERO`. `STOCK_BIN_EMPTY` sử dụng `LK-TEST-BIN`: kệ `KHO-Z-01-01` trống, kệ `KHO-Z-01-02` đủ. Giao diện kho chỉ cho chọn kệ có hàng; để kiểm tra mã lỗi kệ trống cần gửi API với kệ thứ nhất.

Mỗi ca là trạng thái ban đầu để thao tác. Nếu đã xử lý một nhánh (đồng ý/từ chối, duyệt/hủy, QC đạt), chạy reset trước khi thử nhánh ngược lại. Bộ ca bao phủ các trạng thái và nhánh chính đã liệt kê; kiểm thử mọi tổ hợp dữ liệu/đồng thời vẫn thuộc bộ test tự động, không thể biểu diễn hết bằng dữ liệu mẫu.

## Quy tắc giao diện

- Ngày hẹn tách ngày và giờ AM/PM, 15 phút mỗi lựa chọn. Chủ nhật bị chặn; API kiểm giờ Việt Nam độc lập múi giờ máy khách. Lịch một giờ được cắt tại 17:00; 17:00 là mốc cuối được phép.
- Bộ lọc từ/đến ngày bao gồm cả hai ngày. Tìm kiếm client không phân biệt dấu; tìm báo giá dùng collation SQL không phân biệt dấu. Ngày bắt đầu sau ngày kết thúc báo lỗi.
- Báo giá và lịch sử phiếu lọc ở máy chủ trước phân trang. Các danh sách trả đầy đủ lọc tại giao diện. Thu ngân tải đủ các trang, không giới hạn 100 phiếu đầu.
- Chỉ báo giá PENDING được phê duyệt/yêu cầu sửa; trạng thái khác chỉ xem chi tiết. Quyền vẫn được kiểm tại API.
