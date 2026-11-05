# Soopi — xác nhận chất lượng giao diện, 2026-11-03

**20/20 trong phạm vi audit kỹ thuật local đã kiểm.** Không còn finding P0/P1/P2/P3 đã xác nhận trong phạm vi này. Đây là đánh giá kỹ thuật Impeccable, không phải chứng nhận WCAG hay kết quả đo người dùng thật.

| Hạng mục | Điểm | Bằng chứng |
|---|---:|---|
| Accessibility | 4/4 | Axe WCAG 2.2 AA + best practices trên 14 trang và trạng thái tương tác; kiểm ID ARIA; bàn phím, focus, lỗi form, tương phản và touch |
| Performance | 4/4 | Cả 8 mẫu lab đạt LCP ≤2500ms, CLS ≤0,1, độ trễ sự kiện tương tác ≤200ms |
| Responsive | 4/4 | Desktop/tablet/điện thoại; nhãn bấm thực 44px; cuộn bảng bằng bàn phím; cử chỉ chữ ký và phục hồi khi gián đoạn |
| Theming | 4/4 | Màu component dùng palette chung; token contrast có test; font local; dark mode nằm ngoài PRODUCT.md |
| Implementation Integrity | 4/4 | Luồng/API được giữ; nội dung đúng nghiệp vụ; bỏ component chat mô phỏng không dùng; không bỏ qua test hoặc hạ ngưỡng |

## Kiểm chứng

- Build production và lint đạt. `npm run test:quality` đạt toàn bộ: **29 unit test, 502 UI check, 49 kiểm tra accessibility/bố cục, 8 mẫu hiệu năng**.
- Axe 4.14.0: 42 tổ hợp trang/kích thước (1440/768/360px), thêm 7 trạng thái: lỗi đăng ký, yêu cầu mới, chat, báo giá, thanh toán, nhập thẻ và lỗi thẻ. Không violation, ID ARIA bị thiếu, lỗi console hoặc tràn ngang trong các mẫu đã quét.
- Có thêm 3 lượt xác nhận landing được render đầy đủ ở 1440/768/360px. Audit buộc các phần landing dưới màn hình được render khi quét; `content-visibility` không dùng để che nội dung khỏi axe.
- Các mục `incomplete` của axe vẫn được lưu. Đã đối chiếu: màu trên gradient/pseudo-element với palette và hình render; dấu trạng thái/ký tự trang trí không thay cho nhãn; chồng bounding box của tiêu đề/icon không che chữ; `aria-controls="support-chat"` có đích trong DOM khi chat mở, được kiểm bằng ID guard. Không chuyển các mục này thành pass tự động.
- Mọi API đều mock; không ghi DB hay thực hiện thanh toán thật. Microsoft Edge, viewport mô phỏng và touch tổng hợp qua Chromium/CDP; chưa kiểm Safari, thiết bị vật lý, trình đọc màn hình hoặc Core Web Vitals ở percentile 75 của người dùng thật.

Detector cuối có 7 cảnh báo đã đối chiếu: 6 cảnh báo về Inter/Plus Jakarta Sans là font được PRODUCT.md/DESIGN.md chọn chủ động (gồm khai báo font local); 1 cảnh báo animation typing thuộc CSS chat mô phỏng không còn được component nào sử dụng. Không thêm ignore/suppression để làm sạch detector.

## Hiệu năng bản cuối

Cache lạnh, CPU 4x, mạng 1,6 Mbps và độ trễ 150ms. Cột tương tác là thời lượng sự kiện lab, **không phải INP thực địa**. [Tham chiếu ngưỡng Web Vitals](https://web.dev/articles/vitals).

| Trang | Màn hình | LCP (ms) | CLS | Tương tác lab (ms) |
|---|---:|---:|---:|---:|
| `/` | 1440px | 2180 | 0.0477 | 32 |
| `/login` | 1440px | 1976 | 0.0000 | 32 |
| `/portal` | 1440px | 1920 | 0.0017 | 128 |
| `/account` | 1440px | 2068 | 0.0044 | 40 |
| `/` | 390px | 2040 | 0.0129 | 40 |
| `/login` | 390px | 1768 | 0.0000 | 40 |
| `/portal` | 390px | 1980 | 0.0015 | 104 |
| `/account` | 390px | 2044 | 0.0162 | 32 |

Trang tài khoản mobile ở baseline có CLS khoảng 0,53; bản cuối giữ chỗ khi tải và ổn định cấu trúc header. Font WOFF2 nằm cùng app; preloading dùng subset tiếng Việt nhỏ. Logo phụ không chặn nội dung, các section landing ngoài viewport hoãn layout/paint và vẫn hoạt động khi cuộn hoặc focus.

## Cổng kiểm tra chạy lại

Từ `frontend-react`: `npm ci`, `npm run build`, mở `npm run preview -- --host 127.0.0.1 --port 4173`. Trong terminal khác đặt `E2E_BASE_URL=http://127.0.0.1:4173`, chạy `npm run test:quality`. Cần Microsoft Edge đã cài; Playwright và axe nằm trong devDependencies, không cần repo Java hay API thật.

Raw JSON và ảnh: `frontend-react/test-results/quality/`. Snapshot tóm tắt được giữ ở [UI_QUALITY_2026-11-03.json](UI_QUALITY_2026-11-03.json). [Hướng dẫn axe](https://www.deque.com/axe/core-documentation/api-documentation/) yêu cầu mở các trạng thái tương tác trước khi quét; runner thực hiện điều đó.

Fingerprint SHA-256 của 94 file source/script/asset/config frontend tại thời điểm xác nhận: `12680a9d553ccf2b112e6f288f04d874b37391aa38f743a8968168d35b20fc7a`. Khi thay đổi giao diện hoặc dependency, chạy lại các cổng; điểm này không tự áp dụng cho snapshot mới.
