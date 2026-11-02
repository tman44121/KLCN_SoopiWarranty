# Impeccable audit — luồng vận hành local

Ngày: 02/11/2026. Phạm vi: tiếp nhận, điều phối/báo giá, kỹ thuật, kho, thu ngân, lịch sử và giờ hẹn khách hàng. Đánh giá trên mã hiện tại và dữ liệu local; không triển khai VPS.

## Kết luận về tính nhất quán

**Đạt trong phạm vi kiểm tra.** Các điều khiển dùng lại bảng màu, nút, trạng thái và bố cục của Soopi. Tìm kiếm/lọc bám theo mã nghiệp vụ và trạng thái thật; thao tác nhạy cảm vẫn kiểm quyền tại API. Không thêm nội dung đánh giá tự công khai.

| Tiêu chí | Điểm /4 | Bằng chứng và giới hạn |
|---|---:|---|
| Accessibility | 3 | Nhãn cho ngày/giờ và bộ lọc; lỗi được thông báo; nút sắp xếp hoạt động bằng Enter. Các cặp màu token đạt test tương phản. Chưa kiểm chứng đầy đủ bằng trình đọc màn hình hoặc axe. |
| Hiệu năng | 3 | Route tách chunk; phần lọc dùng chung khoảng 1,8 KB gzip; tìm báo giá debounce, lọc trước phân trang, bỏ kết quả cũ. Danh sách kho vẫn vẽ toàn bộ dữ liệu. Chưa chạy Lighthouse/profiling. |
| Responsive | 3 | Quan sát thật ở 1440 và 390 px; không tràn ngang trong các màn được thử. Điều khiển bộ lọc mới cao 44 px trên màn nhỏ. Đây là viewport mô phỏng, chưa thử thiết bị cảm ứng vật lý. |
| Theming | 3 | Điều khiển mới dùng token hiện có. Một số phần cũ của trang khách vẫn ghi màu trực tiếp. Dark mode không thuộc yêu cầu sản phẩm hiện tại. |
| Implementation integrity | 3 | Giữ thương hiệu và luồng xử lý; dùng lại một bộ điều khiển danh sách. Detector còn 5 cảnh báo ở phần giao diện khách đã có từ trước. |
| **Tổng** | **15/20** | **Tốt trong phạm vi này; chưa phải chứng nhận WCAG hay đánh giá toàn bộ hệ thống.** |

## Kết quả quan trọng đã xử lý

- Giờ hẹn AM/PM có mốc 12:00 PM và 05:00 PM đúng; chặn Chủ nhật/ngoài giờ ở cả client và API, độc lập múi giờ máy khách. Đổi sang ngày hợp lệ xóa lỗi. Các input ngày React xử lý cả sự kiện nhập và thay đổi.
- Báo giá tìm theo mã, phiếu, tên và SĐT; lọc mọi trạng thái/ngày; phân trang thực tế vượt 100 dòng. Báo giá đã xử lý chỉ xem, không hiện nút duyệt lại. Đổi bộ lọc đặt lại trang, chặn phản hồi cũ và xử lý trang cuối sau khi duyệt.
- Điều phối và danh sách phiếu mặc định mới nhất; kỹ thuật lấy đủ phiếu đang mở trước khi lọc, tránh cắt 100 dòng rồi mới bỏ phiếu đã đóng. Thu ngân tải đủ các trang. Giữ lựa chọn SLA tại điều phối/kỹ thuật.
- Phân biệt “không có dữ liệu” và “không có kết quả khớp bộ lọc”. Khoảng ngày ngược có thông báo; xóa bộ lọc phục hồi kết quả.
- Bộ dữ liệu có 46 ca, 2 trạm và tài khoản theo ca. Tồn thực tế bằng tổng các kệ; giữ hàng bằng tổng yêu cầu xuất PENDING. Các ràng buộc đều được bật và tin cậy sau reset. Cấu hình thống kê truy cập được nạp lại, heartbeat hoạt động.
- Lỗi hết hàng không tạo phiếu xuất/giữ hàng; lỗi kệ trống hoàn tác thay đổi; báo giá hết hạn bị chặn. Mọi kiểm tra này dùng API local thật.

## Phát hiện của lượt audit ban đầu

Không phát hiện P0/P1 trong các thao tác đã kiểm chứng. Hai mục P2 dưới đây đã được xử lý ở lượt optimize/extract tiếp theo; xem [kết quả và số đo](UI_OPTIMIZE_EXTRACT.md). Điểm 15/20 bên trên là điểm của lượt audit ban đầu, chưa chấm lại toàn bộ hệ thống.

1. **[P2] Danh sách kho chưa phân trang.** Vị trí: `frontend-react/src/behaviors/warehouse.js`, `loadList` (khoảng dòng 181). Nhận toàn bộ danh sách và tạo DOM cho mọi dòng, kể cả trong các mục đang ẩn. Khi dữ liệu tăng, lọc sẽ phải dựng lại nhiều dòng; chưa đo được ngưỡng gây chậm. Khuyến nghị thêm phân trang tại API/UI khi mở rộng khối lượng. Lệnh phù hợp: `/impeccable optimize`.
2. **[P2] Màu ghi trực tiếp trong một số phần cũ của trang khách.** Vị trí: `frontend-react/src/pages/account.tsx`, các phần thanh toán/QR quanh dòng 868, 996, 1049. Các giá trị như `#64748b`, `#f8fafc` không đi qua token, nên thay bảng màu sẽ không cập nhật đồng bộ. Không kết luận vi phạm tương phản khi chưa đo đúng từng cặp. Khuyến nghị đối chiếu và thay bằng token phù hợp trong một lượt riêng. Lệnh phù hợp: `/impeccable extract`.

Mẫu lặp cần theo dõi: danh sách đầy đủ được lọc tại client; màu trực tiếp nằm trong JSX của trang khách. Các thay đổi lần này không mở rộng hai mẫu đó sang bộ điều khiển mới.

## Diễn giải detector và điều đã đính chính

Detector quét `frontend-react/src`: 2 cảnh báo font Inter/Plus Jakarta Sans, 2 cảnh báo chuyển động chat, 1 cảnh báo dải màu 5 px của thẻ đánh giá. Font đã được chốt trong `DESIGN.md`, nên không coi đây là lỗi bắt buộc sửa. Chuyển động/dải màu thuộc các phần cũ ngoài những thao tác vừa sửa; ghi nhận, không thay thiết kế theo máy móc. Không có cảnh báo mới ở các điều khiển lọc/giờ hẹn.

Nhận định sơ bộ rằng tiêu đề cột thiếu hỗ trợ bàn phím là **không đúng**: bên trong đã có button. Đã thử Enter trực tiếp và xác nhận `aria-sort` thay đổi; giữ cơ chế đó.

## Kiểm chứng và bằng chứng

- Backend: 144 test đạt; frontend: build đạt và 26 test đạt.
- `node verification/workflow-probe.mjs`: 30 kiểm tra API local đạt, gồm phân trang/tìm kiếm, quyền, giờ hẹn, thiếu hàng, thiếu kệ, rollback tồn, báo giá hết hạn, tệp mẫu thật và heartbeat. Không xử lý thành công các ca nghiệp vụ trong bộ dữ liệu, để người dùng còn thao tác tiếp.
- Script reset đã chạy thực tế: backup có checksum và VERIFYONLY; staging nạp thành công trước khi thay dữ liệu. Kiểm tra chặn tên database production và server VPS đều đạt. Thử lỗi cưỡng bức sau xóa/nạp đã rollback, giữ số phiếu/phiên bản, số báo giá và checksum tồn/kệ.
- Giao diện thật: tìm báo giá; sắp xếp bằng bàn phím; AM/PM/chặn Chủ nhật/xóa lỗi; tìm phiếu kỹ thuật và nhận lỗi hết hàng; menu kho/bộ lọc; thu ngân; lịch sử khách; lọc ngày tại bảng phiếu và xóa bộ lọc.
- Ảnh và kết quả trong `artifacts/workflow-audit/`; danh mục ca theo lần chạy trong `artifacts/local-reset/<lần chạy>/cases.json`.

Không chạy được bộ Playwright CLI cũ vì Edge tự đóng khi khởi động; kiểm tra giao diện được thực hiện bằng trình duyệt trong ứng dụng. Không kiểm chứng đầy đủ mọi tổ hợp trong 46 ca bằng UI, không đo hiệu năng tải lớn và không thử thiết bị vật lý.

Hai mục P2 đã được xử lý: phân trang/lazy load danh sách kho và đưa màu của trang tài khoản về token chung. Có thể chạy `/impeccable audit` lại để chấm toàn bộ phạm vi; bước hoàn thiện thị giác tiếp theo: `/impeccable polish`.
