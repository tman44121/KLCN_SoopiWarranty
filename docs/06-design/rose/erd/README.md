# ERD của báo cáo khóa luận

Nguồn dữ liệu là `database/01_schema.sql`; công cụ chỉ đọc DDL, không kết nối hay
ghi database. Chạy từ gốc repository:

```powershell
python docs/06-design/rose/erd/sync_schema.py
python docs/06-design/rose/erd/check_schema.py
node docs/06-design/rose/erd/erd.mjs docs/06-design/rose/erd/schema.json <thu-muc-hinh> 3
python docs/06-design/rose/erd/check_schema.py <thu-muc-hinh>
node docs/06-design/rose/erd/shot.cjs <thu-muc-hinh>/erd_6_kiemke.svg <thu-muc-hinh>/erd_6_kiemke.png 3
python docs/06-design/rose/erd/update_report.py <bao-cao-kiem-ke.docx> <bao-cao-erd-moi.docx> <thu-muc-hinh>
```

Khi chạy trong Codex, dùng Node/Python do `load_workspace_dependencies` trả về,
đặt `ARTIFACT_NODE_MODULES` tới thư mục package đi kèm runtime. Bộ vẽ dùng
`@viz-js/viz` trong runtime; khi chạy độc lập không có biến này, dùng
`@hpcc-js/wasm-graphviz` như bản cũ. Xuất PNG cần `playwright-core` và Edge.
Không thêm dependency vào ứng dụng Web/Mobile chỉ để vẽ báo cáo.

Lượt cập nhật 03/11/2026 tạo tám ERD, bao phủ đủ 97 khóa ngoại của 55 bảng.
Sáu bảng độc lập không có khóa ngoại vào hoặc ra được liệt kê trong phần thuyết
minh và bảng cấu trúc, không thêm đường quan hệ suy đoán. `coverage.json` lưu từng
khóa ngoại được vẽ, tính tùy chọn theo NULL và tính duy nhất theo PK/UNIQUE.
Chỉ mục duy nhất có lọc theo trạng thái không biến quan hệ lịch sử thành một–một.

Kiểm kê có bốn quan hệ: hai vai trò lập/duyệt từ `NhanVien` tới `PhieuKiemKe`,
và hai khóa ngoại từ `ChiTietKiemKe` tới `PhieuKiemKe` và `LinhKien`. `MaKe`
không có FK tới `TonKhoTheoKe`; không vẽ quan hệ này như ràng buộc vật lý.

`update_report.py` nhận bản báo cáo đã cập nhật kiểm kê làm đầu vào và lưu bản
mới: thay năm ERD cũ, thêm ba ERD, bổ sung sáu bảng cấu trúc, cập nhật tổng số
bảng/khóa/CHECK. Không dùng nó lặp lại trên chính đầu ra. Sau khi tạo, cập nhật
trường SEQ, mục lục và danh mục hình/bảng bằng Word, xuất PDF và kiểm tra dàn trang.

Ảnh PNG/SVG và DOT có thể sửa lại nằm trong thư mục `rose/erd_20261103` cạnh báo
cáo tại thư mục `doc`. Nội dung UML khác và mô hình Rational Rose được giữ nguyên.
