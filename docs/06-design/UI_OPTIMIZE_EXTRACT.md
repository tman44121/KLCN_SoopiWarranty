# Kết quả optimize và extract

Thực hiện trên local, giữ dữ liệu kiểm thử hiện có. Không reset database, thay schema hay triển khai VPS.

## Danh sách kho

- Nhập, xuất và điều chuyển dùng phân trang tại máy chủ, mặc định 25 dòng, có thể chọn 50/100.
- Tìm mã phiếu, mã liên quan, linh kiện, kỹ thuật viên/nhà cung cấp/kệ tùy loại phiếu. Trạng thái và khoảng ngày được lọc **trước** khi phân trang; giữ sắp xếp mới nhất/cũ nhất và khóa phụ bằng mã phiếu.
- Chỉ tải danh sách đang mở qua sự kiện `lml:panel-shown` của menu hiện có. Các mục khác tải khi mở; cập nhật kho làm dữ liệu đã xem cần tải mới. Tìm kiếm chờ 250 ms, kết quả của yêu cầu cũ bị bỏ qua.
- Chuyển bộ lọc đặt về trang đầu. Trang cuối được điều chỉnh lại nếu số phiếu giảm. Có trạng thái tải/rỗng/lỗi, thử lại và phân trang bằng bàn phím. Điều khiển mới đạt vùng chạm 44 px trên màn nhỏ.
- Ba endpoint mới: `GET /stock-receipts/search`, `/stock-issues/search`, `/stock-transfers/search`; trả `PageResponse`. Tham số: `q`, `status`, `from`, `to`, `sort=newest|oldest`, `page=0`, `size=25|50|100`. Endpoint cũ vẫn trả mảng, giữ quyền và dữ liệu như trước cho các client khác.

## Số đo trước/sau

Cùng bộ dữ liệu local: 32 phiếu nhập, 297 phiếu xuất, 8 phiếu điều chuyển. Kích thước là JSON UTF-8 **chưa nén**; số thời gian là trung vị của 3 lượt localhost sau một lượt làm nóng, không phải p95 hay Core Web Vitals.

| Chỉ số | Trước | Sau |
|---|---:|---:|
| Phiếu được dựng sẵn khi mở màn tồn kho | 337 | 0 |
| Tổng phần tử DOM ở màn tồn kho | 5.047 | 1.380 (giảm khoảng 72,7%) |
| Dòng phiếu xuất ở lần mở đầu | 297 | 25 |
| JSON phiếu xuất | 142.147 byte | 9.939 byte (giảm khoảng 93%) |
| JSON phiếu nhập | 22.829 byte | 17.808 byte |
| JSON điều chuyển | 2.608 byte | 2.667 byte, do chỉ có 8 dòng và thêm thông tin trang |
| Phản hồi phiếu xuất, trung vị local | 14,72 ms | 15,16 ms |

Lợi ích xác nhận được là giảm dữ liệu/DOM và không tải các danh sách chưa mở. Không kết luận API phản hồi nhanh hơn: các số thời gian gần nhau. Với ít phiếu, thông tin phân trang làm phản hồi lớn hơn một chút; API vẫn trả đủ các dòng phù hợp.

Nguồn đo: `artifacts/impeccable-optimize/api-before.json`, `api-after.json`, `ui-before.json`, `ui-after.json`.

## Màu dùng chung

`frontend-react/src/pages/account.tsx` không còn mã màu hex viết trực tiếp. Chữ phụ, số tiền, thông báo thành công/lỗi/thông tin dùng token Soopi hiện có. Không tạo bộ component chung mới cho những khối chỉ xuất hiện một lần.

Màu nhận diện MoMo/ZaloPay được đặt một nơi trong `styles/brand.css`, tách rõ màu QR, màu chữ và viền. Canvas QR đọc giá trị CSS đã tính thay vì chép màu trong JavaScript. Đã kiểm tra trực tiếp:

- MoMo: QR `#a21caf`, chữ nút `#9d174d`.
- ZaloPay: QR `#0284c7`, chữ nút `#0369a1`.
- QR ngân hàng: màu chung `#29354a`, nền trắng `#ffffff`.

Tên token và cách dùng được ghi trong `DESIGN.md`. Test kiểm tra tương phản chữ 4.5:1, QR 3:1 và ngăn màu hex quay lại trang tài khoản. Các màn thanh toán vẫn là mô phỏng, không ghi nhận giao dịch.

## Kiểm chứng

- Build frontend đạt; 27 test frontend và 146 test backend đạt.
- `node verification/inventory-pages-probe.mjs`: 49 kiểm tra API thật đạt, gồm dữ liệu phân trang khớp endpoint cũ, thứ tự, tìm linh kiện, khoảng ngày, ký tự `%`, đầu vào sai và phân quyền.
- Bộ kiểm tra quy trình cũ: `node verification/workflow-probe.mjs` (30 kiểm tra).
- Trình duyệt thật: chuyển menu mà không tải lại trang, trang đầu/trang sau/trang cuối, lọc trạng thái, tìm từ trang sau về trang đầu, mở đúng chi tiết, QR ba phương thức, màn 1440/390 px và vùng chạm 44 px. Ảnh trong `artifacts/impeccable-optimize/`.

Chưa đo tải sản xuất, Core Web Vitals hoặc thiết bị cảm ứng vật lý. Các danh sách đã mở có thể giữ lại tối đa một trang trong DOM để chuyển qua lại; số dòng không tăng theo tổng dữ liệu kho. Bước hoàn thiện thị giác tiếp theo nếu cần: `/impeccable polish`.
