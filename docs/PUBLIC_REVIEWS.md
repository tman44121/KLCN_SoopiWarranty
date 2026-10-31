# Đánh giá trên trang chủ

Khách chưa đăng nhập thấy đánh giá thật thay cho phiếu và số liệu minh họa. Khách đã đăng nhập vẫn xem phiếu của mình.

Xem thử 24 đánh giá mẫu khi chạy Vite development: `http://localhost:5173/?reviewPreview=1`.
Dữ liệu mẫu có nhãn riêng, không gọi API đánh giá hay ghi database, không được đóng gói vào bản production.
Bấm **Xem thêm đánh giá** để cuộn qua danh sách; **Thoát xem thử** trở về dữ liệu thật.

Admin vào **Báo cáo thống kê → Đánh giá khách hàng → Trang chủ → Hiển thị**. Kiểm tra nhận xét không chứa tên, số điện thoại, địa chỉ hay thông tin riêng trước khi xác nhận. Nút **Ẩn** gỡ khỏi trang chủ, giữ nguyên đánh giá gốc.

Chỉ đánh giá từ khách sau bàn giao (có thời điểm đánh giá, phiếu đã trả) được duyệt. Dữ liệu cũ chưa xác định nguồn/ngày bị vô hiệu hóa nút. API công khai chỉ trả mã ngẫu nhiên, điểm, nhận xét và ngày; giao diện ghi “Khách hàng ẩn danh”, không trả hồ sơ khách, mã phiếu, thiết bị hoặc nhân viên.

Điểm trung bình và số lượt tính từ **tất cả đánh giá xác thực**, gồm điểm thấp và nhận xét chưa được chọn. Tối đa sáu nhận xét mới nhất được admin chọn xuất hiện. Nếu chưa có nhận xét công khai, trang giới thiệu tiện ích thực tế, không thêm đánh giá hoặc số liệu giả.

Quyết định duyệt gắn với đúng điểm, nội dung và thời điểm đánh giá. Khi khách sửa, nhận xét tự biến mất khỏi trang chủ và admin cần xem, duyệt lại. Nếu khách vừa sửa trong lúc admin duyệt bản cũ, API báo xung đột để tải lại báo cáo.

Database hiện có: chạy `database/08_public_reviews.sql` trước backend mới, bằng tài khoản có quyền tạo bảng. Script có thể chạy lại, không sửa đánh giá gốc và không tự công khai dữ liệu. Database mới dùng `01_schema.sql` hoặc bộ script ghép đã bao gồm bảng này.

Kiểm thử (tại thư mục gốc):

```powershell
dotnet run --project verification/public-reviews-probe
```

Probe dùng cấu hình User Secrets của API trên database phát triển, chạy migration và các tình huống duyệt/sửa/ẩn trong transaction rồi rollback toàn bộ. Không công khai đánh giá thật sau khi chạy.
