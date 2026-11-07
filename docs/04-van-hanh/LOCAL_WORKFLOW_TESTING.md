# Kiểm thử quy trình trên local

Phạm vi: giờ hẹn 24 giờ, thứ Hai–thứ Bảy 08:00–17:00 theo giờ Việt Nam; tên “Số phiếu đang xử lý”; tìm toàn bộ báo giá theo mã báo giá/mã phiếu/tên/SĐT, trạng thái, ngày; danh sách mới nhất trước và bộ lọc theo từng màn. Không triển khai VPS.

## Cập nhật quy trình ngày 07/11/2026

- Web và Flutter hiển thị “Kiểm tra chất lượng”; mã bước `QC` và hợp đồng kết quả 6 bước giữ nguyên.
- Web cho chọn gợi ý hoặc nhập giờ/phút dạng `HH:mm`; Flutter dùng bộ chọn 24 giờ, có chế độ nhập. Giữ lịch liên tục 08:00–17:00, thứ Hai–thứ Bảy; giờ nhập tay không bắt buộc bội số 15 phút.
- Điều phối mặc định xem báo giá `PENDING`; danh sách làm mới mỗi phút, khi quay lại cửa sổ và khi mở liên kết thông báo `#quotes`. Bộ lọc vẫn cho xem mọi trạng thái.
- Cảnh báo SLA sắp trễ và đã quá hạn là hai loại riêng, mỗi loại một lần mỗi phiếu; gửi điều phối và KTV có tài khoản nhận thông báo. Job quét mặc định mỗi 5 phút.
- Báo giá hết hạn sau ngày hiệu lực (00:00 ngày kế tiếp, giờ Việt Nam). Nếu không ghi ngày hiệu lực, hạn là đúng 72 giờ từ lúc duyệt, tính cả Chủ nhật. Job quét mỗi phút, áp dụng cả báo giá cũ còn chờ; ghi `DECLINED` bởi `SYSTEM`, hủy lệnh sửa và chuyển phiếu sang `AWAITING_RETURN` trong một transaction. Thông báo web/app mời khách nhận máy nguyên trạng; không tích hợp SMS/FCM mới.
- Lịch sử khách cộng tiền thực thu từ `HoaDon_PhieuThu` của chính khách; không cộng báo giá chưa trả hoặc giá vốn. Tổng toàn bộ lịch sử không đổi khi lọc phiếu.
- IMEI dùng 4–50 ký tự chữ ASCII, số hoặc dấu `-`; không kiểm tra Luhn. Giữ chuẩn hóa chữ hoa/khoảng trắng và cách tra IMEI 15 số chia gạch cũ; bắt buộc có, không trùng, kiểm chủ máy và phiếu mở như trước.
- Nút “Kiểm tra bảo hành” của lễ tân hiện thông báo khi tìm thấy thiết bị hoặc thiết bị chưa đăng ký, ngoài phần chi tiết nằm phía dưới. Lỗi dịch vụ vẫn có thông báo lỗi; tự điền từ yêu cầu online không tạo thêm thông báo tra cứu trùng. `npm run test:ui:staff-selection` kiểm cả tìm thấy/không tìm thấy/lỗi trên desktop, tablet và mobile bằng API giả lập.

Database đã có cần được người vận hành cho phép chạy [13_relax_imei.sql](../../database/13_relax_imei.sql) để nới `CK_ThietBi_IMEI`; file chỉ đổi CHECK, không sửa dữ liệu. Ngày 07/11/2026 đã áp dụng theo yêu cầu chủ dự án trên VPS, database `TrungTamBaoHanhDB`: CHECK bật và trusted, `DBCC CHECKCONSTRAINTS` không báo vi phạm; trước/sau đều 621 thiết bị, gồm 136 IMEI; health nội bộ và HTTPS đều `UP`. Chưa chạy kiểm thử ghi dữ liệu SQL hoặc deploy bộ mã ứng dụng mới trong lượt này.

Kiểm thử trình duyệt riêng bằng API giả lập (chạy Vite trước):

```powershell
cd frontend-react
npm run test:ui:workflow
```

Ca kiểm: nhập giờ từng ký tự và giờ sai, Chủ nhật/giờ đóng cửa; tổng thực trả ở màn 320px và desktop; báo giá mới xuất hiện khi quay lại điều phối; IMEI linh hoạt và dữ liệu ngoài giới hạn. Không ghi DB thật.

## Kiểm thử ghi và đồng thời trên SQL Server, không reset dữ liệu

Chạy từ thư mục gốc dự án, chỉ trên database thử được phép ghi:

```powershell
dotnet test backend-dotnet/tests/Soopi.SqlServer.Tests/Soopi.SqlServer.Tests.csproj --configuration Release
```

Project này tách khỏi `Soopi.slnx` để lệnh unit test thông thường không truy cập database.
Kết nối ưu tiên biến `SOOPI_SQL_TEST_CONNECTION`, sau đó User Secrets `ConnectionStrings:Default`
của API. Nếu cả hai chưa có, dùng `MSSQL_TEST_URL`, `MSSQL_TEST_USER`, `MSSQL_TEST_PASSWORD`
đang có trong môi trường để nối tới `TrungTamBaoHanhDB_Dev`. Không ghi mật khẩu vào source/log.
Chỉ chấp nhận tên database chính xác `TrungTamBaoHanhDB_Dev` hoặc `SoopiIntegrationTests`;
database cần có schema hiện hành, gồm thống kê truy cập. Thiếu cấu hình/schema thì báo lỗi,
không tự tạo, nâng cấp hoặc bỏ qua kiểm thử.

Mười ba ca chạy service thật và các kết nối độc lập để kiểm đua refresh token, duyệt xuất, thu tiền
có phí/miễn phí, hoàn tác khi thiếu tồn kệ hoặc lỗi sau thu tiền, và chặn ngừng linh kiện đang chờ xuất.
Gồm 5 ca bảo mật bổ sung: đếm đăng nhập sai đồng thời/khóa tạm; đăng nhập đúng xóa bộ đếm; giới hạn OTP sai đồng thời;
hai lần tiêu cùng OTP chỉ có một lần thành công; đổi SĐT không chuyển quyền xem yêu cầu/tệp, gộp khách chuyển đúng quyền.
Mỗi ca tạo bộ dữ liệu riêng có mã `IT` + UUID rồi dọn đúng bộ đó. Tài khoản ứng dụng không được
xóa nhật ký thì các dòng nhật ký thử được giữ lại theo quyền hiện hành. Bộ đếm mã/IDENTITY có thể
tăng; kiểm thử không chỉnh lùi bộ đếm chung. Không chạy lệnh reset ở mục tiếp theo để chạy bộ này.

CI tự tạo container SQL Server với database tạm `SoopiIntegrationTests`, chạy bộ kiểm thử và lưu
kết quả TRX; deploy bị chặn nếu job SQL thất bại. Không dùng database hay bí mật local trong CI.

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

## Đối chiếu mốc kho và kiểm kê bổ sung ngày 03/11/2026

Mốc đã chốt tại [D-054](../02-ky-thuat/DECISIONS.md#d-054--trừ-tồn-khi-thực-xuất-linh-kiện-2026-11-03):
yêu cầu xuất chỉ giữ hàng; thủ kho duyệt thực xuất mới giảm tồn tổng, tồn kệ và
lượng đã giữ; xác nhận sửa chữa và QC không trừ lần nữa.

Các ca dưới là hướng dẫn nghiệm thu trên database thử riêng, chưa được xem là
kết quả kiểm thử SQL Server của lượt cập nhật này. Không chạy trên dữ liệu vận hành.

| Ca | Thao tác | Kết quả cần đối chiếu |
|---|---|---|
| KK-01 | Thủ kho vào `/warehouse#stocktake`, tải danh sách theo nhóm/kệ, nhập số đếm bằng tồn | Lập phiếu PENDING, tồn chưa đổi; duyệt thành COMPLETED, chênh lệch 0 |
| KK-02 | Đếm thấp/cao hơn tồn và ghi lý do | Lưu cả tồn lúc lập và số đếm; duyệt cộng chênh lệch vào tồn tổng và đúng kệ, thẻ kho có STOCKTAKE |
| KK-03 | Thiếu lý do chênh lệch, trùng SKU/kệ, số âm hoặc sai mã kệ | API từ chối; không có thay đổi tồn một phần |
| KK-04 | Từ chối phiếu có lý do; duyệt lại phiếu COMPLETED/REJECTED | Từ chối không đổi tồn; chứng từ đã xử lý không áp dụng lần hai |
| KK-05 | Điều chỉnh giảm làm tồn nhỏ hơn số đã giữ hoặc tồn kệ âm | Toàn bộ giao dịch rollback; trạng thái phiếu và mọi dòng tồn giữ nguyên |
| KK-06 | Sau khi lập phiếu, có nhập/xuất hợp lệ rồi mới duyệt kiểm kê | Tồn sau = tồn hiện tại + chênh lệch lúc lập; không ghi đè nhập/xuất xen giữa |
| KK-07 | Kỹ thuật viên hoặc khách gọi API kiểm kê | Thiếu STOCKTAKE_MANAGE bị từ chối; không đổi tồn |
| XK-01 | Ghi tồn tổng/kệ/đã giữ, yêu cầu xuất 2, duyệt xuất, ghi kết quả sửa/QC | Giữ tăng 2 khi yêu cầu; duyệt giảm tồn và giữ 2; sửa/QC giữ nguyên số tồn sau xuất |

Nguồn triển khai: `database/11_stocktake.sql`, `StocktakeService`, `Stocktake`,
`InventoryStore.AdjustAsync` và `InventoryStore.MovementsAsync`. Unit test hiện có
trong `QuotationInventoryTests` kiểm tra chênh lệch, lý do, dòng trùng, định dạng
kệ, phiếu rỗng và chặn xử lý lại; không thay thế các ca transaction ở bảng trên.

## Quy tắc giao diện

- Ngày hẹn tách ngày và giờ AM/PM, 15 phút mỗi lựa chọn. Chủ nhật bị chặn; API kiểm giờ Việt Nam độc lập múi giờ máy khách. Lịch một giờ được cắt tại 17:00; 17:00 là mốc cuối được phép.
- Bộ lọc từ/đến ngày bao gồm cả hai ngày. Tìm kiếm client không phân biệt dấu; tìm báo giá dùng collation SQL không phân biệt dấu. Ngày bắt đầu sau ngày kết thúc báo lỗi.
- Báo giá và lịch sử phiếu lọc ở máy chủ trước phân trang. Các danh sách trả đầy đủ lọc tại giao diện. Thu ngân tải đủ các trang, không giới hạn 100 phiếu đầu.
- Chỉ báo giá PENDING được phê duyệt/yêu cầu sửa; trạng thái khác chỉ xem chi tiết. Quyền vẫn được kiểm tại API.
