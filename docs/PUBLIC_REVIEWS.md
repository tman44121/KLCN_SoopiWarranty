# Đánh giá trên trang chủ

Đầu trang chủ: khách chưa đăng nhập thấy quy trình bảo hành sáu bước và nút đăng nhập xem phiếu;
khách đã đăng nhập thấy các phiếu và tiến độ của mình như trước.
Khối đánh giá nằm riêng bên dưới, hiển thị cho cả hai nhóm **chỉ khi có ít nhất một điểm/nhận xét
được admin chọn Hiển thị**. Khi ẩn hết, toàn bộ khối (gồm tổng lượt và điểm trung bình) biến mất,
kể cả khi DB vẫn có nhiều điểm. Tổng lượt/điểm khi khối xuất hiện vẫn tính từ tất cả điểm đã lưu.

Xem thử 24 đánh giá mẫu khi chạy Vite development: `http://localhost:5173/?reviewPreview=1`.
Dữ liệu mẫu có nhãn riêng, không gọi API đánh giá hay ghi database, không được đóng gói vào bản production.
Bấm **Xem thêm đánh giá** để cuộn qua danh sách; **Thoát xem thử** trở về dữ liệu thật.

Khi cần dữ liệu minh họa được lưu trong DB, quản trị chạy riêng `database/09_sample_public_reviews.sql`.
Script tạo bảng tùy chọn `DanhGiaMinhHoa` và thêm sáu nhận xét giả định, chạy lại không tạo trùng.
Không sửa phiếu bàn giao, đánh giá khách hàng hay quyết định duyệt. Theo yêu cầu gỡ phần minh họa,
dữ liệu trong bảng này được giữ lại nhưng không trả qua API công khai và không hiển thị trên trang chủ.

`GET /api/v1/public/reviews` giữ trường `sampleItems` dưới dạng mảng rỗng để tương thích với client
đã triển khai. `reviewCount`, `averageRating` tính các điểm 1–5 đã lưu trên phiếu bàn giao đã trả máy,
bao gồm điểm cũ chưa lưu ngày; không dùng số liệu này để khẳng định đánh giá đã được xác thực qua cổng khách.

Admin vào **Báo cáo thống kê → Đánh giá khách hàng → Trang chủ → Hiển thị**. Kiểm tra nhận xét không chứa tên, số điện thoại, địa chỉ hay thông tin riêng trước khi xác nhận. Nút **Ẩn** gỡ khỏi trang chủ, giữ nguyên đánh giá gốc.

Điểm 1–5 trên phiếu đã trả máy được duyệt, kể cả điểm cũ chỉ có số sao. Thiếu ngày hiển thị
“Chưa lưu ngày đánh giá”, thiếu nhận xét hiển thị “Chỉ chấm sao, không kèm nhận xét.”; không tự gán ngày
hay nội dung. API công khai trả mã ngẫu nhiên, điểm, nhận xét và `reviewedOn` có thể null. Với điểm
chưa lưu ngày, giao diện ghi “Phiếu bàn giao ẩn danh” / “Điểm trên phiếu bàn giao”, không gắn huy hiệu
đánh giá xác thực. Không trả hồ sơ khách, mã phiếu, thiết bị hoặc nhân viên.

Điểm trung bình và số lượt tính từ **tất cả điểm đã lưu trên phiếu bàn giao đã trả máy**, gồm điểm thấp
và điểm chưa được chọn. Tối đa sáu điểm/nhận xét được admin chọn xuất hiện. Khi thiếu ngày đánh giá,
ngày bàn giao chỉ dùng để sắp thứ tự, không hiển thị thành ngày đánh giá. Không tự công khai hàng loạt;
admin dùng nút **Hiển thị** sau khi kiểm tra bản ghi.

Quyết định duyệt gắn với đúng điểm, nội dung và thời điểm đánh giá. Khi khách sửa, nhận xét tự biến mất khỏi trang chủ và admin cần xem, duyệt lại. Nếu khách vừa sửa trong lúc admin duyệt bản cũ, API báo xung đột để tải lại báo cáo.

Database hiện có: chạy `database/08_public_reviews.sql`, rồi `database/10_legacy_review_publication.sql`
để cột ngày trong bản duyệt cho phép null. Các script có thể chạy lại, không sửa đánh giá gốc và không
tự công khai dữ liệu. Database mới dùng `01_schema.sql` hoặc bộ script ghép đã bao gồm cột nullable.

Kiểm thử (tại thư mục gốc):

```powershell
dotnet run --project verification/public-reviews-probe
```

Probe dùng cấu hình User Secrets của API trên database phát triển, chạy migration và các tình huống duyệt/sửa/ẩn trong transaction rồi rollback toàn bộ. Không công khai đánh giá thật sau khi chạy.
Kết nối chạy probe cần quyền tạo bảng cho cả bảng duyệt và bảng minh họa; tài khoản ứng dụng chỉ có
quyền nghiệp vụ sẽ bị từ chối. Không cấp thêm quyền DDL cho tài khoản production để chạy probe.

## Cập nhật VPS ngày 31/10/2026

- Đã chạy script 09 trực tiếp trên `TrungTamBaoHanhDB`, hai lần để kiểm tra không trùng: 6 hàng
  trong `DanhGiaMinhHoa`; giữ nguyên 472 phiếu bàn giao, 366 điểm cũ và checksum dữ liệu đánh giá.
- Backup trước khi ghi: `/var/opt/mssql/backup/before-sample-reviews-20261031T114037Z.bak`,
  `COPY_ONLY`, `CHECKSUM`, đã qua `RESTORE VERIFYONLY`.
- Release khi bật minh họa: `c28d6ba1be8dda403385a8e67540bd5a893cd584-20261031114422-0`.
  Bản vá nguồn và manifest được giữ tại `/root/soopi-sample-reviews/<release>/`; chưa commit/push.
- Backend 137/137, frontend 23/23; kiểm thử đánh giá công khai và preview đạt ở 1440px/390px;
  npm audit không có lỗ hổng. Probe DB cục bộ bị từ chối CREATE TABLE, transaction được rollback.
- Kiểm tra container trước triển khai và HTTPS production đạt: API trả `sampleItems=6`,
  `items=[]`, `reviewCount=0`, `averageRating=null`; giao diện thật hiển thị nhãn minh họa,
  mở rộng/thu gọn hoạt động, không tràn ngang hay lỗi trình duyệt ở hai kích thước.
- Rollback ứng dụng bằng script activation với release trước:
  `c28d6ba1be8dda403385a8e67540bd5a893cd584-41174059585-1`. Không cần khôi phục dữ liệu thật
  để ẩn mẫu; chỉ xóa các hàng trong `DanhGiaMinhHoa` nếu muốn gỡ minh họa.

### Đã gỡ hiển thị minh họa theo yêu cầu

Release khi gỡ minh họa: `c28d6ba1be8dda403385a8e67540bd5a893cd584-20261031115146-1`.
API công khai luôn trả `sampleItems=[]`, không đọc bảng minh họa; sáu hàng trong DB được giữ nguyên.
Trang chủ trở lại khối “An tâm bảo hành tại Soopi” khi chưa có đánh giá thật.
Backend 137/137 đạt; probe biên dịch thành công. Container kiểm tra và HTTPS production đều đạt;
đã kiểm tra không còn khối minh họa, không tràn ngang/lỗi trình duyệt ở 1440px và 390px.

### Hỗ trợ điểm cũ chưa lưu ngày

Release hỗ trợ điểm cũ: `c28d6ba1be8dda403385a8e67540bd5a893cd584-20261031120058-2`.
Đã chạy script 10 hai lần; backup trước nâng cấp:
`/var/opt/mssql/backup/before-legacy-publication-20261031T115933Z.bak`, đã verify checksum.
Giữ nguyên 472 phiếu, 366 điểm cũ, ngày/nhận xét gốc, 6 hàng mẫu và 0 bản duyệt công khai.
API/trang chủ nhận đủ 366 lượt chấm điểm, trung bình 4,3/5; admin có thể duyệt từng dòng thiếu ngày.
Không tự bổ sung nội dung hoặc ngày, không tự chọn công khai điểm cũ.

Backend 137/137, frontend 23/23; các luồng trình duyệt public/admin/customer/preview đạt.
Probe chạy bằng tài khoản ứng dụng trên VPS đạt 28 kiểm tra, gồm duyệt/ẩn/sửa điểm không có ngày;
mọi thay đổi hoàn tác, checksum điểm, số hàng duyệt và số hàng nhật ký trước/sau bằng nhau.
Đã kiểm tra HTTPS thật ở 1440px/390px, không lỗi trình duyệt hay tràn ngang; npm audit sạch.
Bản vá nguồn, manifest và kết quả probe nằm trong `/root/soopi-legacy-publication/<release>/`.

### Giữ phiếu/quy trình, chỉ hiện đánh giá khi admin duyệt

Release đang chạy: `c28d6ba1be8dda403385a8e67540bd5a893cd584-20261031122516-3`.
Quy trình sáu bước xuất hiện đầu trang cho khách chưa đăng nhập; khách đăng nhập vẫn có phiếu riêng.
Đánh giá chuyển xuống khối độc lập, chỉ render tổng lượt/điểm và các dòng duyệt khi `items` có dữ liệu.
Ẩn bản duyệt cuối cùng sẽ gỡ cả khối; không tự bật chỉ vì `reviewCount` lớn hơn 0.
Không sửa dữ liệu hoặc quyết định duyệt trong DB. Khi kiểm tra production có 0 bản duyệt;
API vẫn trả 366 điểm/4,3 trung bình nhưng giao diện ẩn khối và hiển thị quy trình đúng yêu cầu.
Frontend 23/23, kiểm tra public/admin/preview đạt: khách vãng lai, khách có phiếu, bật/tắt dòng cuối,
điểm thiếu ngày, lỗi/thử lại, hai kích thước 1440px/390px. npm audit sạch.
HTTPS thật đạt ở cả hai kích thước, không lỗi trình duyệt/tràn ngang. Bản vá và manifest được giữ
trong `/root/soopi-approved-home-reviews/<release>/`; chưa commit/push.
