---
name: Soopi
description: Hệ thống quản lý bảo hành và sửa chữa cho trung tâm dịch vụ — nhân viên vận hành, khách theo dõi phiếu.
colors:
  forest: "#244c43"
  forest-deep: "#1b3c35"
  mint-soft: "#ddefe4"
  mint-border: "#b9d5c3"
  mint-wash: "#f4faf6"
  penguin-navy: "#29354a"
  navy-body: "#364257"
  slate-quiet: "#4a5853"
  sage-muted: "#62716c"
  sage-faint: "#b8c4bc"
  milk-cream: "#f8f7f2"
  paper-white: "#ffffff"
  sage-border: "#d9e3db"
  sage-divider: "#eaefe9"
  honey: "#efb952"
  mist-lilac: "#dcd8ed"
  peach: "#f2c5bf"
  expired-wine: "#8b4248"
  expired-wine-deep: "#6f3439"
  expired-tint: "#fbe7e8"
  honey-text: "#795b18"
  honey-tint: "#fff1ce"
  honey-border: "#f3d58a"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "24px"
  title-section:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  body-mobile:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.05em"
  data:
    fontFamily: "JetBrains Mono, Roboto Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\" 1"
rounded:
  control: "8px"
  container: "10px"
  circle: "50%"
spacing:
  page: "24px"
  page-tablet: "20px"
  page-phone: "12px"
  section: "20px"
  card: "16px"
  table-row: "38px"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.forest-deep}"
  button-secondary:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.navy-body}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 14px"
  button-destructive:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.expired-wine}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 14px"
  button-submit-customer:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.control}"
    height: "46px"
    padding: "12px 20px"
  input:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.penguin-navy}"
    rounded: "{rounded.control}"
    height: "30px"
    padding: "0 10px"
  input-customer:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.penguin-navy}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "11px 14px"
  card:
    backgroundColor: "{colors.paper-white}"
    rounded: "{rounded.container}"
    padding: "{spacing.card}"
  badge-success:
    backgroundColor: "{colors.mint-soft}"
    textColor: "{colors.forest}"
    rounded: "{rounded.control}"
  badge-warning:
    backgroundColor: "{colors.honey-tint}"
    textColor: "{colors.honey-text}"
    rounded: "{rounded.control}"
  badge-danger:
    backgroundColor: "{colors.expired-tint}"
    textColor: "{colors.expired-wine}"
    rounded: "{rounded.control}"
  badge-processing:
    backgroundColor: "{colors.mist-lilac}"
    textColor: "{colors.penguin-navy}"
    rounded: "{rounded.control}"
  nav-item-active:
    backgroundColor: "{colors.mint-soft}"
    textColor: "{colors.forest}"
    rounded: "{rounded.control}"
---

# Design System: Soopi

## Overview

**Creative North Star: "Thẻ bảo hành"**

Mọi màn hình của Soopi được dựng như một tấm thẻ bảo hành tốt: giấy kem sữa, mực xanh chim cánh cụt, một dấu xanh rừng cho việc quan trọng nhất, và những ô trạng thái bo góc gọn như con dấu đóng lên phiếu. Bảng màu lấy trực tiếp từ thẻ bảo hành mẫu của thương hiệu. Hệ thống không trang trí cho đẹp: nó cho người cầm phiếu biết máy đang ở đâu, việc gì đến lượt mình, và ai chịu trách nhiệm.

Cảm giác chủ đạo là **bình tĩnh, tin cậy, gọn**. Màn nhân viên dày thông tin (chữ thân 13px, hàng bảng 38px) nhưng thở được nhờ nền kem, viền mảnh và khoảng cách đều. Trang khách (đăng nhập, cổng tra cứu, tài khoản) dùng cùng bảng màu nhưng chữ lớn hơn và có tiêu đề Plus Jakarta Sans đậm, vì khách đọc trên điện thoại và ít khi quay lại.

Mọi thành phần **bo góc vừa phải**, như góc của một tấm thẻ cầm tay: nút, ô nhập, badge và tab bo 8px; thẻ, bảng, hộp thoại và ngăn kéo bo 10px. Chỉ những thứ vốn tròn (chấm trạng thái, spinner, avatar, vòng bước tiến độ) mới tròn hẳn. Bề mặt phẳng; chiều sâu đến từ viền và sắc độ nền, không từ bóng đổ.

**Key Characteristics:**
- Nền kem sữa ấm, chữ xanh chim cánh cụt, một màu hành động duy nhất là xanh rừng.
- Bo góc thống nhất: điều khiển 8px, khung chứa 10px; không có góc vuông sắc hay dạng viên thuốc.
- Trạng thái nói bằng cặp nền nhạt + chữ đậm cùng sắc (mint, mật ong, tím sương, đỏ rượu), không bằng màu bão hòa.
- Mã nghiệp vụ (TN-, YC-, BG-, serial/IMEI, tiền, SLA) luôn dùng font mono với số cân cột.
- Một bố cục co giãn từ 360px đến desktop; trên màn cảm ứng vùng chạm tối thiểu 44px.

## Colors

Bảng màu ấm và trầm của một tấm thẻ in: một màu mực, một màu dấu, và các màu trạng thái pha nhạt như giấy màu.

### Primary
- **Xanh rừng** (forest): màu hành động duy nhất. Dùng cho nút chính, mục điều hướng đang chọn, liên kết, viền focus và chuỗi dữ liệu thứ nhất trong biểu đồ. Khi rê chuột thì chuyển sang **Xanh rừng sâu** (forest-deep).
- **Mint dịu** (mint-soft): nền của trạng thái "tốt" và của mục đang chọn (mục nav, lựa chọn trong nhóm nút). Chữ trên nền này luôn là Xanh rừng (8:1).
- **Viền mint** (mint-border) và **Mint phủ** (mint-wash): viền và nền khi rê chuột lên thẻ ứng viên, hàng chọn được.

### Secondary
- **Vàng mật ong** (honey): điểm nhấn hiếm. Dùng cho chuỗi thứ hai trong biểu đồ và chi tiết minh họa trên banner khách. Không dùng làm nền nút.
- **Tím sương** (mist-lilac): nền trạng thái "đang xử lý" và khối hướng dẫn.
- **Hồng đào** (peach): viền nút hủy/xóa khi ở trạng thái nghỉ, và minh họa.

### Tertiary
- **Đỏ rượu "Đã hết hạn"** (expired-wine, nền expired-tint): lỗi, quá hạn SLA, hết bảo hành, thao tác phá hủy. Khi rê chuột thì chuyển sang expired-wine-deep.
- **Mật ong đậm** (honey-text trên honey-tint, viền honey-border): cảnh báo, chờ xử lý, sắp trễ SLA.

### Neutral
- **Xanh chim cánh cụt** (penguin-navy): tiêu đề, số liệu, giá trị chính; nền banner tối và tooltip.
- **Xanh than thân bài** (navy-body): đoạn văn, nội dung ô, nhãn trường.
- **Xám đá** (slate-quiet): chữ phụ cần đọc kỹ; tab chưa chọn.
- **Xám lá xô thơm** (sage-muted): meta, nhãn cột, gợi ý (4,7:1 trên kem; tối thiểu 12px).
- **Xám nhạt** (sage-faint): chỉ cho biểu tượng trang trí, không bao giờ cho chữ.
- **Kem sữa** (milk-cream): nền trang, thanh công cụ, đầu bảng.
- **Giấy trắng** (paper-white): mặt thẻ, ô nhập, header, sidebar.
- **Viền lá** (sage-border) và **Vạch chia** (sage-divider): viền khung và vạch giữa các hàng.

### Named Rules
**The One Ink Rule.** Xanh rừng là màu hành động duy nhất trên một màn hình. Nếu hai nút cùng màu đặc, một trong hai phải là nút phụ.

**The Stamp Pair Rule.** Mỗi trạng thái là một cặp nền nhạt + chữ đậm cùng sắc, đạt ≥ 4,5:1. Không dùng màu bão hòa làm nền cho chữ trạng thái.

**The Shape Not Hue Rule.** Tốt, cảnh báo và lỗi khác nhau bằng icon (✓ tròn, đồng hồ, ✕ tròn), không chỉ bằng màu: với người mù màu đỏ, nền mint và nền đỏ nhạt gần như trùng nhau (ΔE 4). Áp dụng cho badge, thông báo và chú thích biểu đồ. Đang xử lý và trung tính giữ chấm tròn.

**The Dark Accent Rule.** Vàng mật ong và Hồng đào chỉ làm màu chữ trên nền tối (xanh chim cánh cụt, xanh rừng: ≥ 5,4:1). Trên nền sáng chúng chỉ làm nền (chữ xanh chim cánh cụt: 6,9:1 và 7,9:1) hoặc trang trí; làm chữ trên trắng chỉ đạt 1,8:1 và 1,6:1.

**The Quiet On Tint Rule.** Chữ phụ trên nền nhạt có màu (Mint dịu, Tím sương, nền trạng thái) dùng `--text-quiet` (#4a5853, ≥ 6,2:1), không dùng `--text-muted` (#62716c chỉ đạt 4,28:1 trên Mint dịu).

**The Plain Ink Is A Link Rule.** Chữ xanh rừng trơn đọc như liên kết. Báo thành công luôn đi kèm nền Mint và icon, không bao giờ chỉ là chữ xanh rừng.

**The Visible Change Rule.** Xanh rừng → xanh rừng sâu chỉ khác 1,26:1, nên rê chuột không thể chỉ đổi sắc: liên kết thêm gạch chân, trạng thái đang chọn đổi nền hoặc viền xanh rừng. Viền lá (#d9e3db, 1,3:1) chỉ để trang trí, không bao giờ là dấu hiệu duy nhất của trạng thái đang chọn hay lỗi.

Các quy tắc trên được kiểm tự động trong `frontend-react/scripts/contrast.test.mjs` (chạy cùng `npm test`).

## Typography

**Display Font:** Plus Jakarta Sans (dự phòng Inter, system-ui), chỉ trên trang khách.
**Body Font:** Inter (dự phòng system-ui, -apple-system, Segoe UI).
**Label/Mono Font:** JetBrains Mono (dự phòng Roboto Mono, ui-monospace) cho mã, số tiền, đồng hồ SLA.

**Character:** Inter trung tính và rõ ở cỡ nhỏ, gánh toàn bộ màn vận hành. Plus Jakarta Sans đậm 800 cho tiêu đề trang khách, tạo giọng thân thiện mà không cần trang trí. Mono chỉ xuất hiện khi giá trị là dữ liệu cần so cột.

### Hierarchy
- **Display** (800, 36px, 1.2, -0.02em): tiêu đề hero của cổng tra cứu khách.
- **Headline** (800, 26–28px, 1.2–1.3): tiêu đề form đăng nhập/đăng ký, tiêu đề trang tài khoản, câu khẩu hiệu trên banner.
- **Title** (700, 18px/24px): tiêu đề trang nhân viên.
- **Title section** (600, 15px/20px): tiêu đề thẻ, hộp thoại, ngăn kéo.
- **Body** (400, 13px/18px trên desktop; 14px/20px dưới 768px): nội dung ô, đoạn văn, nhãn. Ô nhập dùng 16px trên điện thoại để Safari không tự phóng to.
- **Label** (600, 11px, 0.05em, viết hoa): đầu cột bảng, nhãn khóa trong lưới chi tiết.
- **Data** (mono 500, 12px, số cân cột): mã phiếu, serial/IMEI, tiền, đồng hồ SLA.

### Named Rules
**The Data Wears Mono Rule.** Chỉ mã nghiệp vụ, số tiền và thời gian đếm ngược mới dùng mono; nhãn, tiêu đề và văn bản thì không bao giờ.

## Layout

- **Desktop:** sidebar cố định 260px (224px dưới 1280px) và header cố định 64px. Vùng làm việc xếp các thẻ theo cột dọc, cách nhau 20px, lề trang 24px.
- **Bố cục trong trang:**
  - Kỹ thuật, Thu ngân: danh sách + chi tiết, cột trái 340px.
  - Tiếp nhận: form tối đa 860px.
  - Báo cáo: lưới 2 cột, hàng chỉ số 4 ô.
- **Từ 1023px trở xuống:**
  - Sidebar thành ngăn kéo trượt từ trái, mở bằng nút menu trên header, đóng bằng Esc, chạm nền mờ hoặc chọn mục.
  - Danh sách + chi tiết xếp chồng; chọn phiếu thì cuộn tới chi tiết.
  - Báo cáo còn 1 cột, chỉ số 2 cột.
- **Từ 767px trở xuống:**
  - Header hai hàng (menu và thao tác tài khoản; ô tìm kiếm rộng hết màn), lề 12px.
  - Form và lưới chi tiết một cột.
  - Mỗi hàng bảng thành một thẻ, nhãn cột đứng trước giá trị; cột sắp xếp được hiện thành dãy nút phía trên.
  - Hộp thoại mở từ đáy màn hình.
- **Trên màn cảm ứng** (`pointer: coarse`): nút, ô nhập và mục điều hướng cao tối thiểu 44px (nút nhỏ 36px).
- **Trang khách:** khối nội dung giữa màn, form tối đa 440px. Đăng nhập và đăng ký phủ đúng một màn hình từ 768px trở lên (laptop, tablet ngang lẫn dọc): hai cột cao 100dvh, khoảng cách dọc co theo chiều cao màn; trên màn ngang form đăng ký chia 2 cột và banner còn 38%. Trên màn lớn hơn 1366px cả bố cục phóng theo chiều ngang (tối đa 1,6 lần), giới hạn để mỗi cột vẫn vừa chiều cao màn — một tấm thẻ phóng to, không phải khoảng trắng nới rộng. Dưới 768px banner xếp lên trên, khung form kéo dài phủ phần còn lại.

## Elevation & Depth

Hệ thống phẳng. Chiều sâu đến từ ba lớp sắc độ: nền kem, mặt thẻ trắng, vạch và viền lá. Bóng đổ chỉ dành cho những thứ nổi lên trên nội dung (menu thả, thông báo, hộp thoại, ngăn kéo, toast), cộng với một bóng xanh mờ dưới nút gửi chính của trang khách.

### Shadow Vocabulary
- **Flyout** (`box-shadow: 0 6px 16px rgba(41, 53, 74, 0.1)`): menu thả, popover thông báo, hộp thoại, ngăn kéo, toast, sidebar khi mở trên tablet/điện thoại.
- **Submit glow** (`box-shadow: 0 4px 12px rgba(36, 76, 67, 0.25)`; khi rê chuột `0 6px 16px rgba(36, 76, 67, 0.35)`): nút gửi chính trên trang khách.

### Named Rules
**The Flat Desk Rule.** Thẻ, bảng và ô nhập không đổ bóng khi ở trạng thái nghỉ. Chỉ lớp nổi trên nội dung mới có bóng.

## Shapes

- **Điều khiển bo 8px** (rounded.control): nút, ô nhập, select, badge trạng thái, tab, nhóm lựa chọn, toast, ô tìm kiếm.
- **Khung chứa bo 10px** (rounded.container): thẻ, bảng, hộp thoại, ngăn kéo, banner, khối hero của trang khách. Hộp thoại mở từ đáy trên điện thoại chỉ bo hai góc trên.
- **Chỉ hình tròn thật** (50%) mới tròn hẳn: chấm trạng thái, chấm chưa đọc, spinner, avatar, vòng bước tiến độ, số thứ tự bước QC.
- **Viền:**
  - Viền 1px viền lá cho khung.
  - Vạch chia 1px giữa các hàng.
  - Mục nav đang chọn có vạch xanh rừng 3px ở mép trái của cả dải.

### Named Rules
**The Card Corner Rule.** Chỉ có ba bán kính: 8px cho điều khiển, 10px cho khung chứa, 50% cho hình tròn thật. Không góc vuông sắc, không dạng viên thuốc 999px.

## Components

### Buttons
Gọn, đặc, bo góc vừa tay như phím trên máy in phiếu.
- **Shape:** bo 8px. Cao 32px trên desktop, nút nhỏ 26px; 44px/36px trên màn cảm ứng.
- **Primary:** nền xanh rừng, chữ trắng 12,5px đậm 600, đệm 0 14px.
- **Hover / Focus:** nền chuyển sang xanh rừng sâu trong 0,12s. Focus bàn phím là viền 2px xanh rừng, cách 1px.
- **Secondary:** nền trắng, chữ xanh than, viền lá; rê chuột thì nền kem.
- **Destructive:** nền trắng, chữ đỏ rượu, viền hồng đào; rê chuột thì nền đỏ nhạt.
- **Loading:** chữ ẩn, spinner tròn 0,6s; khi giảm chuyển động thì spinner nhịp mờ chậm.
- **Nút gửi trang khách:** cao 46px, rộng hết form, xanh rừng kèm bóng xanh mờ.

### Chips
- **Style:** nhóm nút lựa chọn (kênh tiếp nhận, mức SLA, kết quả QC) là các ô bo 8px viền lá trên nền trắng.
- **State:** mục đang chọn nền mint dịu, viền và chữ xanh rừng. Kết quả QC: Đạt màu mint, Lỗi màu đỏ rượu, N/A trung tính.

### Cards / Containers
- **Corner Style:** bo 10px.
- **Background:** giấy trắng trên nền kem.
- **Shadow Strategy:** không bóng (xem The Flat Desk Rule).
- **Border:** 1px viền lá; đầu thẻ ngăn với thân bằng 1px.
- **Internal Padding:** 16px (14px trên điện thoại); đầu thẻ 14px 16px.

### Inputs / Fields
- **Style:**
  - Màn nhân viên: nền trắng, viền lá 1px, bo 8px, cao 30px, chữ 12,5px.
  - Trang khách: cao 44px, chữ 14px, có biểu tượng bên trái.
- **Focus:** viền chuyển xanh rừng; trang khách thêm vòng mờ 3px `rgba(36, 76, 67, 0.15)`.
- **Error / Disabled:** viền và thông điệp đỏ rượu ngay dưới trường. Ô chỉ đọc nền kem.

### Navigation
- **Desktop:** sidebar trắng, nhóm có nhãn viết hoa 11px. Mục điều hướng có biểu tượng nét 1,6px, cỡ 13px.
- **States:**
  - Đang chọn: nền mint dịu, chữ xanh rừng, vạch trái 3px.
  - Rê chuột: nền kem.
- **Tablet/điện thoại:** ngăn kéo trượt từ trái (rộng tối đa 300px, 86vw) kèm nền mờ xanh chim cánh cụt 40%. Mục điều hướng cao 44px trên màn cảm ứng.

### Status badge (signature)
Con dấu trạng thái của phiếu: ô bo 8px viền 1px, đệm 3px 8px, chữ 12px (500), theo cặp màu của The Stamp Pair Rule.
- Thành công: mint.
- Cảnh báo: mật ong.
- Lỗi/quá hạn: đỏ rượu.
- Đang xử lý: tím sương.
- Trung tính: kem.

Thành công, cảnh báo và lỗi có icon riêng phía trước nhãn (The Shape Not Hue Rule); đang xử lý và trung tính có chấm tròn. Trên header, badge trạm có chấm tròn phía trước.

### Data table → card
Bảng dày trên desktop:
- Đầu cột kem, chữ 11px viết hoa; hàng 38px; số cân cột.
- Cột sắp xếp được là nút thật, có `aria-sort`.

Dưới 768px mỗi hàng thành một thẻ, mỗi ô là một dòng "nhãn — giá trị".

## Do's and Don'ts

### Do:
- **Do** dùng token `var(--color-primary)`, `var(--text-strong)`, `var(--surface-page)`… thay vì mã hex. Trang khách dùng các biến `--kh-*`, vốn trỏ về cùng token.
- **Do** bo 8px cho điều khiển và 10px cho khung chứa, qua token `--radius-*`. Chỉ chấm, spinner, avatar và vòng bước mới tròn (50%).
- **Do** hiển thị mã phiếu, serial/IMEI, tiền và SLA bằng font mono 12px với số cân cột.
- **Do** biểu đạt trạng thái bằng cặp nền nhạt + chữ đậm cùng sắc, đạt ≥ 4,5:1.
- **Do** kiểm mọi màn ở 390px, 768px và 1280px. Không được cuộn ngang; vùng chạm 44px trên màn cảm ứng.

### Don't:
- **Don't** dùng bán kính khác 8px, 10px hoặc 50% (The Card Corner Rule).
- **Don't** đặt hai nút xanh rừng đặc cạnh nhau (The One Ink Rule).
- **Don't** đổ bóng cho thẻ, bảng hay ô nhập ở trạng thái nghỉ.
- **Don't** dùng xám nhạt (sage-faint) cho chữ, hay chữ dưới 12px cho nội dung cần đọc.
- **Don't** dùng Vàng mật ong hoặc Hồng đào làm màu chữ trên nền sáng (The Dark Accent Rule).
- **Don't** phân biệt tốt / cảnh báo / lỗi chỉ bằng màu (The Shape Not Hue Rule).
- **Don't** đưa số liệu, lời chứng thực, hotline hay huy hiệu không có thật vào giao diện.
