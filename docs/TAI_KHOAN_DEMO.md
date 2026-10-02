# Tài khoản đăng nhập demo

Danh sách lấy từ dữ liệu mẫu `db/sqlserver/03_demo_data.sql` và `docs/danh-sach-tai-khoan.txt` của project
`warranty-system-mysql`. **Chỉ dùng cho dev/demo; không nạp dữ liệu mẫu hay dùng các mật khẩu này trong production.**

> Chưa đối chiếu với database `_Dev` đang dùng: nếu ai đó đã đổi mật khẩu hoặc vai trò trên DB thì bảng này không còn
> đúng. Kiểm tra bằng câu SQL ở cuối file.

Đăng nhập tại `http://localhost:5173/login` (chạy `run.bat`) hoặc `http://localhost:8080/login` (bản build).
Sai mật khẩu 5 lần liên tiếp thì tài khoản bị khóa tạm 15 phút.

## Nhân viên

Nhân viên đăng nhập bằng tên đăng nhập **hoặc** mã nhân viên (ví dụ `NV-006` thay cho `admin`).

| Tên đăng nhập | Mật khẩu | Vai trò | Vào trang | Mã NV | Họ tên |
|---|---|---|---|---|---|
| `admin` | `admin123` | Quản trị viên | `/admin` | NV-006 | Ngô Bảo Châu |
| `dieuphoi` | `1234` | Điều phối viên | `/dispatch` | NV-001 | Lê Minh Tâm |
| `quanly.hoa` | `1234` | Điều phối viên | `/dispatch` | NV-101 | Trần Thị Hoa |
| `letan` | `1234` | Tiếp nhận & Lễ tân + Thu ngân (chọn vai trò khi đăng nhập) | `/receptionist` hoặc `/cashier` | NV-004 | Trần Bảo Trâm |
| `tiepnhan.an` | `1234` | Tiếp nhận & Lễ tân | `/receptionist` | NV-102 | Nguyễn Văn An |
| `kythuat` | `1234` | Kỹ thuật viên | `/technician` | NV-002 | Nguyễn Văn A |
| `ktv.phuc` | `1234` | Kỹ thuật viên | `/technician` | NV-005 | Lê Hoàng Phúc |
| `ktv.han` | `1234` | Kỹ thuật viên | `/technician` | NV-007 | Phạm Thị Ngọc Hân |
| `ktv.tuan` | `1234` | Kỹ thuật viên | `/technician` | NV-009 | Đỗ Anh Tuấn |
| `ktv.binh` | `1234` | Kỹ thuật viên | `/technician` | NV-103 | Lê Quốc Bình |
| `ktv.chinh` | `1234` | Kỹ thuật viên | `/technician` | NV-104 | Phạm Minh Chinh |
| `ktv.dung` | `1234` | Kỹ thuật viên | `/technician` | NV-105 | Hoàng Anh Dũng |
| `khovattu` | `1234` | Quản lý kho vật tư | `/warehouse` | NV-003 | Đặng Văn Kiên |
| `thukho.em` | `1234` | Quản lý kho vật tư | `/warehouse` | NV-106 | Vũ Thị Em |
| `thungan.nhu` | `1234` | Thu ngân & Bàn giao | `/cashier` | NV-010 | Hồ Quỳnh Như |
| `thungan.phuc` | `1234` | Thu ngân & Bàn giao | `/cashier` | NV-107 | Đỗ Văn Phúc |
| `kythuat_khoa` | `1234` | Kỹ thuật viên — **bị khóa có chủ ý** để thử đăng nhập bị từ chối | — | NV-008 | Trần Minh Khoa |

## Khách hàng

| Tên đăng nhập | Mật khẩu | Vào trang | Mã KH | Họ tên | Số điện thoại |
|---|---|---|---|---|---|
| `kh.tuan` | `1234` | `/account` | KH-000001 | Nguyễn Minh Tuấn | 0912223001 |
| `kh.mai` | `1234` | `/account` | KH-000002 | Trần Thu Mai | 0912223002 |

- Khách đăng ký mới tại `/register` dùng **số điện thoại làm tên đăng nhập**. Mã OTP khi chạy dev không gửi SMS mà
  ghi vào log của cửa sổ "Soopi API".
- Khách KH-000003, KH-000004 chưa có tài khoản: đăng ký bằng số điện thoại `0912223003` / `0912223004` thì tài khoản
  tự gắn với hồ sơ và thấy phiếu cũ.
- Tra cứu không cần đăng nhập ở `/portal` bằng mã phiếu + số điện thoại của khách.

## Lưu ý

- Mật khẩu `1234`/`admin123` ngắn hơn chính sách mật khẩu hiện tại (tối thiểu 10 ký tự, có chữ và số) vì được tạo
  trước khi áp chính sách; đăng nhập vẫn được, nhưng khi đổi mật khẩu phải dùng mật khẩu đúng chính sách.
- Quản trị viên đặt lại mật khẩu nhân viên về mật khẩu tạm cấu hình ở User Secrets `Security:DefaultResetPassword`
  (không ghi giá trị vào repo); nhân viên phải đổi ở lần đăng nhập kế tiếp.

## Kiểm tra trên database đang dùng

Chạy trong SSMS/Azure Data Studio với database của `ConnectionStrings:Default` (chỉ đọc):

```sql
SELECT tk.TenDangNhap, COALESCE(nv.MaNV, kh.MaKH) AS Ma, COALESCE(nv.HoTen, kh.HoTen) AS HoTen,
       STUFF((SELECT ',' + v.MaVaiTro FROM TaiKhoan_VaiTro v WHERE v.MaTaiKhoan = tk.MaTaiKhoan
              ORDER BY v.MaVaiTro FOR XML PATH('')), 1, 1, '') AS VaiTro,
       tk.TrangThai, tk.BatBuocDoiMatKhau,
       CASE tk.MatKhauHash
         WHEN N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm' THEN N'1234 (mẫu)'
         WHEN N'{bcrypt}$2a$12$cxK.HYz3LwntHDeYsQout.xTzVnA8B1QsZH55vYWrp4T5/.G7lqby' THEN N'admin123 (mẫu)'
         ELSE N'đã đổi' END AS MatKhau
FROM TaiKhoan tk
LEFT JOIN NhanVien nv ON nv.MaTaiKhoan = tk.MaTaiKhoan
LEFT JOIN KhachHang kh ON kh.MaTaiKhoan = tk.MaTaiKhoan
ORDER BY tk.LoaiChuThe DESC, tk.TenDangNhap;
```

Cột `MatKhau` chỉ so hash với dữ liệu mẫu, không giải mã được mật khẩu đã đổi.
