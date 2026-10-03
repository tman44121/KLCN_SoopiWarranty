-- Sinh bởi tools/MySqlToSqlServer.java — không sửa tay.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
BEGIN TRANSACTION;
GO
ALTER TABLE BangGiaDichVu NOCHECK CONSTRAINT ALL;
ALTER TABLE BoDemMa NOCHECK CONSTRAINT ALL;
ALTER TABLE ChinhSachBaoHanh NOCHECK CONSTRAINT ALL;
ALTER TABLE ChiTietBaoGia NOCHECK CONSTRAINT ALL;
ALTER TABLE ChiTietNhapKho NOCHECK CONSTRAINT ALL;
ALTER TABLE ChiTietXuatKho NOCHECK CONSTRAINT ALL;
ALTER TABLE GhiChuPhieu NOCHECK CONSTRAINT ALL;
ALTER TABLE HangSanXuat NOCHECK CONSTRAINT ALL;
ALTER TABLE HangSanXuat_NhomThietBi NOCHECK CONSTRAINT ALL;
ALTER TABLE HoaDon_PhieuThu NOCHECK CONSTRAINT ALL;
ALTER TABLE KetQuaSuaChua NOCHECK CONSTRAINT ALL;
ALTER TABLE KhachHang NOCHECK CONSTRAINT ALL;
ALTER TABLE LichSuPhanCong NOCHECK CONSTRAINT ALL;
ALTER TABLE LichSuTrangThai_ThietBi NOCHECK CONSTRAINT ALL;
ALTER TABLE LinhKien NOCHECK CONSTRAINT ALL;
ALTER TABLE LoaiThietBi NOCHECK CONSTRAINT ALL;
ALTER TABLE MaXacThucOTP NOCHECK CONSTRAINT ALL;
ALTER TABLE NhaCungCap NOCHECK CONSTRAINT ALL;
ALTER TABLE NhanVien NOCHECK CONSTRAINT ALL;
ALTER TABLE NhatKyThaoTac NOCHECK CONSTRAINT ALL;
ALTER TABLE NhomThietBi NOCHECK CONSTRAINT ALL;
ALTER TABLE PhanCong NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuBanGiao NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuBaoGia NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuDieuChuyen NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuKiemTra NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuNhapKho NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuSuaChua NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuTiepNhan NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuXuatKho NOCHECK CONSTRAINT ALL;
ALTER TABLE RefreshToken NOCHECK CONSTRAINT ALL;
ALTER TABLE SanPham NOCHECK CONSTRAINT ALL;
ALTER TABLE TaiKhoan NOCHECK CONSTRAINT ALL;
ALTER TABLE TaiKhoan_VaiTro NOCHECK CONSTRAINT ALL;
ALTER TABLE TepDinhKem NOCHECK CONSTRAINT ALL;
ALTER TABLE ThietBi NOCHECK CONSTRAINT ALL;
ALTER TABLE ThietBiNhanThongBao NOCHECK CONSTRAINT ALL;
ALTER TABLE ThongBao NOCHECK CONSTRAINT ALL;
ALTER TABLE ThongBao_DaDoc NOCHECK CONSTRAINT ALL;
ALTER TABLE TonKhoTheoKe NOCHECK CONSTRAINT ALL;
ALTER TABLE YeuCauBaoHanh NOCHECK CONSTRAINT ALL;
GO
INSERT INTO BangGiaDichVu (MaDichVu, TenDichVu, MaNhom, DonGia, HoatDong) VALUES
  (N'DV-AUDIO', N'Công sửa chữa — Audio/Wearables', N'AUDIO_WEARABLE', 120000.00, 1),
  (N'DV-GIADUNG', N'Công sửa chữa — Thiết bị gia dụng', N'HOME_APPLIANCE', 350000.00, 1),
  (N'DV-LAPTOP', N'Công sửa chữa — Laptop/Tablet', N'LAPTOP_TABLET', 250000.00, 1),
  (N'DV-NHO', N'Công sửa chữa — Điện tử nhỏ', N'SMALL_ELECTRONICS', 150000.00, 1),
  (N'DV-SMARTPHONE', N'Công sửa chữa — Điện thoại', N'PHONE', 150000.00, 1),
  (N'DV-TV', N'Công sửa chữa — TV/Monitor', N'TV_MONITOR', 300000.00, 1);
GO
INSERT INTO BoDemMa (Khoa, GiaTri) VALUES
  (N'BG-2026-0907', 1),
  (N'BG-2026-0912', 1),
  (N'BG-2026-0914', 1),
  (N'CS', 14),
  (N'DC-2026', 1),
  (N'KH', 4),
  (N'KQ-2026', 2),
  (N'NCC', 6),
  (N'NV', 107),
  (N'PBG-2026', 3),
  (N'PC-2026', 4),
  (N'PKT-2026', 4),
  (N'PN-2026', 3),
  (N'PSC-2026', 4),
  (N'PT-2026', 2),
  (N'PX-2026', 2),
  (N'SP', 5),
  (N'TB', 5),
  (N'TN-2026-0907', 1),
  (N'TN-2026-0908', 1),
  (N'TN-2026-0912', 1),
  (N'TN-2026-0914', 1),
  (N'YC-2026-0917', 1);
GO
INSERT INTO ChinhSachBaoHanh (MaChinhSach, PhamVi, MaSP, MaHang, TenChinhSach, SoThangBaoHanh, DieuKienBaoHanh, TruongHopTuChoi, NhaPhanPhoi, HoatDong) VALUES
  (N'CS-0001', N'PRODUCT', N'SP-0001', N'APPLE', N'Bảo hành chính hãng Apple 12 tháng', 12, N'Lỗi phần cứng do nhà sản xuất, còn hạn bảo hành, tem nguyên vẹn.', N'Vào nước, rơi vỡ, tự ý sửa chữa bên ngoài, mất tem bảo hành.', N'Apple Việt Nam (qua FPT Trading)', 1),
  (N'CS-0002', N'PRODUCT', N'SP-0002', N'APPLE', N'Bảo hành chính hãng Apple 12 tháng', 12, N'Lỗi phần cứng do nhà sản xuất, còn hạn bảo hành.', N'Vào nước, cháy nổ do nguồn điện ngoài, màn hình vỡ do va đập.', N'Apple Việt Nam (qua FPT Trading)', 1),
  (N'CS-0003', N'PRODUCT', N'SP-0003', N'SAMSUNG', N'Bảo hành chính hãng Samsung 12 tháng', 12, N'Lỗi phần cứng do nhà sản xuất, còn hạn bảo hành.', N'Vào nước không thuộc dòng kháng nước, rơi vỡ.', N'Samsung Việt Nam', 1),
  (N'CS-0004', N'PRODUCT', N'SP-0004', N'DELL', N'Bảo hành Dell 24 tháng', 24, N'Lỗi bo mạch, bàn phím, pin theo tiêu chuẩn Dell.', N'Cháy nổ do nguồn điện ngoài, hư hỏng do tác động vật lý.', N'Dell Việt Nam', 1),
  (N'CS-0005', N'BRAND', NULL, N'SAMSUNG', N'Chính sách bảo hành Samsung', 24, N'Bảo hành chính hãng', N'Không bảo hành lỗi rơi vỡ/vào nước ngoài dòng chống nước', N'Samsung Việt Nam', 1),
  (N'CS-0006', N'BRAND', NULL, N'APPLE', N'Chính sách bảo hành Apple', 12, N'Bảo hành qua nhà phân phối ủy quyền', N'Không gồm rơi vỡ/vào nước', N'Apple Việt Nam (qua FPT Trading)', 1),
  (N'CS-0007', N'BRAND', NULL, N'LG', N'Chính sách bảo hành LG', 24, N'Bảo hành chính hãng toàn quốc', NULL, N'LG Electronics Việt Nam', 1),
  (N'CS-0008', N'BRAND', NULL, N'ASUS', N'Chính sách bảo hành ASUS', 12, N'Riêng pin bảo hành 6 tháng', N'Không gồm rơi vỡ/vào nước', N'ASUS Việt Nam', 1),
  (N'CS-0009', N'BRAND', NULL, N'ELECTROLUX', N'Chính sách bảo hành Electrolux', 24, N'Bảo hành chính hãng, riêng block máy nén 60 tháng', NULL, N'Electrolux Việt Nam', 1),
  (N'CS-0010', N'BRAND', NULL, N'DAIKIN', N'Chính sách bảo hành Daikin', 24, N'Riêng gas lạnh bảo hành 12 tháng', NULL, N'Daikin Việt Nam', 1),
  (N'CS-0011', N'BRAND', NULL, N'TPLINK', N'Chính sách bảo hành TP-Link', 24, N'Đổi mới trong 12 tháng đầu nếu lỗi nhà sản xuất', NULL, N'TP-Link Việt Nam', 1),
  (N'CS-0012', N'BRAND', NULL, N'CANON', N'Chính sách bảo hành Canon', 12, N'Bảo hành chính hãng', N'Không gồm hao mòn mực/đầu phun do sử dụng', N'Canon Marketing Việt Nam', 1),
  (N'CS-0013', N'BRAND', NULL, N'SONY', N'Chính sách bảo hành Sony', 12, N'Bảo hành chính hãng qua Sony Việt Nam', NULL, N'Sony Việt Nam', 1),
  (N'CS-0014', N'BRAND', NULL, N'DELL', N'Chính sách bảo hành Dell', 36, N'Bảo hành tại chỗ 36 tháng cho dòng UltraSharp', NULL, N'Dell Việt Nam', 1);
GO
SET IDENTITY_INSERT ChiTietBaoGia ON;
INSERT INTO ChiTietBaoGia (MaChiTietBG, MaBaoGia, SoThuTu, MaLK, NoiDungMuc, SoLuong, DonGia, TienCongSuaChua, ThanhTien) VALUES
  (1, N'BG-2026-0907-00001', 1, N'LK002', N'Thay pin MacBook Air M2 chính hãng', 1, 1800000.00, 200000.00, 2000000.00),
  (2, N'BG-2026-0914-00001', 1, N'LK004', N'Thay bàn phím Laptop Dell Inspiron 15', 1, 600000.00, 150000.00, 750000.00),
  (3, N'BG-2026-0912-00001', 1, NULL, N'Củ tai nghe AirPods Pro bên phải (đặt hàng riêng theo hãng)', 1, 1600000.00, 100000.00, 1700000.00);
SET IDENTITY_INSERT ChiTietBaoGia OFF;
GO
SET IDENTITY_INSERT ChiTietNhapKho ON;
INSERT INTO ChiTietNhapKho (MaChiTietNhap, MaPhieuNhap, MaLK, SoLuongNhap, DonGiaNhap, SerialLo, MaKe) VALUES
  (1, N'PN-2026-00001', N'LK001', 4, 2800000.00, N'BATCH-LK001-0901', N'KHO-A-01-01'),
  (2, N'PN-2026-00001', N'LK002', 2, 1200000.00, N'BATCH-LK002-0901', N'KHO-A-02-01'),
  (4, N'PN-2026-00002', N'LK006', 2, 150000.00, NULL, N'KHO-A-03-01'),
  (5, N'PN-2026-00003', N'LK-CHG-MOD01', 30, 217000.00, N'BATCH-CHG-0917A', NULL),
  (6, N'PN-2026-00003', N'LK-PWR-IC01', 50, 67000.00, N'BATCH-IC-0917B', NULL);
SET IDENTITY_INSERT ChiTietNhapKho OFF;
GO
SET IDENTITY_INSERT ChiTietXuatKho ON;
INSERT INTO ChiTietXuatKho (MaChiTietXuat, MaPhieuXuat, MaLK, SoLuongXuat, DonGiaXuat, MaKe, NgayHetHanBaoHanhLK) VALUES
  (1, N'PX-2026-00001', N'LK002', 1, 1200000.00, N'KHO-A-02-01', '2027-03-08'),
  (2, N'PX-2026-00002', N'LK004', 1, 350000.00, NULL, NULL);
SET IDENTITY_INSERT ChiTietXuatKho OFF;
GO
SET IDENTITY_INSERT GhiChuPhieu ON;
INSERT INTO GhiChuPhieu (MaGhiChu, MaPhieuTN, Loai, NoiDung, NguoiViet, VaiTroNguoiViet, ThoiGian) VALUES
  (1, N'TN-2026-0908-00001', N'CUSTOMER', N'Đã hoàn tất kiểm tra nguồn và cập nhật firmware.', N'NV-103', N'TECHNICIAN', '2026-09-08T14:05:00');
SET IDENTITY_INSERT GhiChuPhieu OFF;
GO
INSERT INTO HangSanXuat (MaHang, TenHang, HoatDong) VALUES
  (N'APPLE', N'Apple', 1),
  (N'ASUS', N'ASUS', 1),
  (N'CANON', N'Canon', 1),
  (N'DAIKIN', N'Daikin', 1),
  (N'DELL', N'Dell', 1),
  (N'ELECTROLUX', N'Electrolux', 1),
  (N'LG', N'LG', 1),
  (N'MICROSOFT', N'Microsoft', 1),
  (N'SAMSUNG', N'Samsung', 1),
  (N'SONY', N'Sony', 1),
  (N'TPLINK', N'TP-Link', 1);
GO
INSERT INTO HangSanXuat_NhomThietBi (MaHang, MaNhom) VALUES
  (N'APPLE', N'AUDIO_WEARABLE'),
  (N'SAMSUNG', N'AUDIO_WEARABLE'),
  (N'SONY', N'AUDIO_WEARABLE'),
  (N'DAIKIN', N'HOME_APPLIANCE'),
  (N'ELECTROLUX', N'HOME_APPLIANCE'),
  (N'LG', N'HOME_APPLIANCE'),
  (N'SAMSUNG', N'HOME_APPLIANCE'),
  (N'APPLE', N'LAPTOP_TABLET'),
  (N'ASUS', N'LAPTOP_TABLET'),
  (N'DELL', N'LAPTOP_TABLET'),
  (N'APPLE', N'PHONE'),
  (N'SAMSUNG', N'PHONE'),
  (N'CANON', N'SMALL_ELECTRONICS'),
  (N'MICROSOFT', N'SMALL_ELECTRONICS'),
  (N'SONY', N'SMALL_ELECTRONICS'),
  (N'TPLINK', N'SMALL_ELECTRONICS'),
  (N'DELL', N'TV_MONITOR'),
  (N'LG', N'TV_MONITOR');
GO
INSERT INTO HoaDon_PhieuThu (MaPhieuThu, MaPhieuTN, MaBaoGia, LoaiThu, NgayThu, NguoiNopTien, SoTienThu, HinhThucThanhToan, MaThuNgan, GhiChu) VALUES
  (N'PT-2026-00001', N'TN-2026-0908-00001', NULL, N'FREE_WARRANTY', '2026-09-09T09:00:00', N'Nguyễn Minh Tuấn', 0.00, N'NONE', N'NV-107', N'Bảo hành chính hãng — không thu phí'),
  (N'PT-2026-00002', N'TN-2026-0907-00001', N'BG-2026-0907-00001', N'CHARGED', '2026-09-08T11:30:00', N'Trần Thu Mai', 2160000.00, N'BANK_TRANSFER', N'NV-107', N'Đã đối chiếu đủ theo báo giá');
GO
INSERT INTO KetQuaSuaChua (MaKetQua, MaPhieuSC, MaKTV, NoiDungSuaChua, KetQuaQCTungBuoc, KetQuaKCS, ChiTietTestKCS, NgayGhiNhan) VALUES
  (N'KQ-2026-00001', N'PSC-2026-00001', N'NV-103', N'Cập nhật lại firmware, test ổn định nguồn trong 2 giờ.', N'[{"Buoc": "VISUAL", "KetQua": "PASS"}, {"Buoc": "MAIN_FUNCTION", "KetQua": "PASS"}, {"Buoc": "SECONDARY", "KetQua": "PASS"}, {"Buoc": "POWER_CHARGING", "KetQua": "PASS"}, {"Buoc": "DATA", "KetQua": "PASS"}, {"Buoc": "FINAL", "KetQua": "PASS"}]', N'PASS', N'Test sạc, test camera, test khởi động 20 lần — không tái diễn lỗi.', '2026-09-08T14:00:00'),
  (N'KQ-2026-00002', N'PSC-2026-00002', N'NV-103', N'Thay pin mới, hiệu chỉnh lại chỉ số pin trên hệ thống.', N'[{"Buoc": "VISUAL", "KetQua": "PASS"}, {"Buoc": "MAIN_FUNCTION", "KetQua": "PASS"}, {"Buoc": "SECONDARY", "KetQua": "PASS"}, {"Buoc": "POWER_CHARGING", "KetQua": "PASS"}, {"Buoc": "DATA", "KetQua": "PASS"}, {"Buoc": "FINAL", "KetQua": "PASS"}]', N'PASS', N'Test sạc 3 chu kỳ, đo dung lượng pin đạt 100% thiết kế.', '2026-09-08T11:00:00');
GO
INSERT INTO KhachHang (MaKH, HoTen, SDT, Email, DiaChi, MaTaiKhoan, TrangThai, GopVaoMaKH, NgayTao) VALUES
  (N'KH-000001', N'Nguyễn Minh Tuấn', N'0912223001', N'tuan.nm@gmail.com', N'12 Lê Lợi, Q.1, TP.HCM', 18, N'ACTIVE', NULL, '2026-08-30T08:00:00'),
  (N'KH-000002', N'Trần Thu Mai', N'0912223002', N'mai.tt@gmail.com', N'45 Nguyễn Trãi, Thanh Xuân, Hà Nội', 19, N'ACTIVE', NULL, '2026-08-30T08:05:00'),
  (N'KH-000003', N'Lý Gia Bảo', N'0912223003', NULL, N'88 Trần Phú, Nha Trang', NULL, N'ACTIVE', NULL, '2026-08-30T08:10:00'),
  (N'KH-000004', N'Phan Thị Ngọc', N'0912223004', N'ngoc.pt@gmail.com', N'23 Hai Bà Trưng, Huế', NULL, N'ACTIVE', NULL, '2026-08-30T08:15:00');
GO
SET IDENTITY_INSERT LichSuTrangThai_ThietBi ON;
INSERT INTO LichSuTrangThai_ThietBi (MaLichSu, MaPhieuTN, TrangThai, ThoiGianCapNhat, MoTaChiTiet, NguoiCapNhat, TenNguoiCapNhat, VaiTroNguoiCapNhat) VALUES
  (1, N'TN-2026-0908-00001', N'RECEIVED', '2026-09-08T08:30:00', N'Khách hàng bàn giao thiết bị, lập phiếu tiếp nhận.', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST'),
  (2, N'TN-2026-0908-00001', N'INSPECTING', '2026-09-08T09:00:00', N'Trạng thái đổi từ "Đã tiếp nhận" sang "Đang kiểm tra"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (3, N'TN-2026-0908-00001', N'DIAGNOSED', '2026-09-08T10:00:00', N'Trạng thái đổi từ "Đang kiểm tra" sang "Đã chẩn đoán"', N'NV-103', N'Lê Quốc Bình', N'TECHNICIAN'),
  (4, N'TN-2026-0908-00001', N'REPAIRING', '2026-09-08T10:30:00', N'Trạng thái đổi từ "Đã chẩn đoán" sang "Đang sửa chữa"', N'NV-103', N'Lê Quốc Bình', N'TECHNICIAN'),
  (5, N'TN-2026-0908-00001', N'COMPLETED', '2026-09-08T14:00:00', N'Trạng thái đổi từ "Đang sửa chữa" sang "Hoàn thành" (QC đạt)', N'NV-103', N'Lê Quốc Bình', N'TECHNICIAN'),
  (6, N'TN-2026-0908-00001', N'DELIVERED', '2026-09-09T09:15:00', N'Trạng thái đổi từ "Hoàn thành" sang "Đã bàn giao"', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST'),
  (7, N'TN-2026-0907-00001', N'RECEIVED', '2026-09-07T13:45:00', N'Khách hàng bàn giao thiết bị, lập phiếu tiếp nhận.', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST'),
  (8, N'TN-2026-0907-00001', N'INSPECTING', '2026-09-07T14:00:00', N'Trạng thái đổi từ "Đã tiếp nhận" sang "Đang kiểm tra"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (9, N'TN-2026-0907-00001', N'DIAGNOSED', '2026-09-07T15:00:00', N'Trạng thái đổi từ "Đang kiểm tra" sang "Đã chẩn đoán"', N'NV-103', N'Lê Quốc Bình', N'TECHNICIAN'),
  (10, N'TN-2026-0907-00001', N'AWAITING_QUOTE_APPROVAL', '2026-09-07T15:30:00', N'Trạng thái đổi từ "Đã chẩn đoán" sang "Chờ duyệt giá"', N'NV-103', N'Lê Quốc Bình', N'TECHNICIAN'),
  (11, N'TN-2026-0907-00001', N'AWAITING_CUSTOMER_CONFIRMATION', '2026-09-07T16:00:00', N'Trạng thái đổi từ "Chờ duyệt giá" sang "Chờ khách xác nhận"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (12, N'TN-2026-0907-00001', N'AWAITING_PARTS', '2026-09-07T18:00:00', N'Trạng thái đổi từ "Chờ khách xác nhận" sang "Chờ linh kiện" (khách xác nhận trên Cổng khách hàng)', N'KH:KH-000002', N'Trần Thu Mai', N'CUSTOMER'),
  (13, N'TN-2026-0907-00001', N'REPAIRING', '2026-09-08T08:30:00', N'Trạng thái đổi từ "Chờ linh kiện" sang "Đang sửa chữa"', N'NV-106', N'Vũ Thị Em', N'WAREHOUSE_KEEPER'),
  (14, N'TN-2026-0907-00001', N'COMPLETED', '2026-09-08T11:00:00', N'Trạng thái đổi từ "Đang sửa chữa" sang "Hoàn thành" (QC đạt)', N'NV-103', N'Lê Quốc Bình', N'TECHNICIAN'),
  (15, N'TN-2026-0907-00001', N'DELIVERED', '2026-09-08T16:00:00', N'Trạng thái đổi từ "Hoàn thành" sang "Đã bàn giao"', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST'),
  (16, N'TN-2026-0914-00001', N'RECEIVED', '2026-09-14T09:20:00', N'Khách hàng bàn giao thiết bị, lập phiếu tiếp nhận.', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST'),
  (17, N'TN-2026-0914-00001', N'INSPECTING', '2026-09-14T09:40:00', N'Trạng thái đổi từ "Đã tiếp nhận" sang "Đang kiểm tra"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (18, N'TN-2026-0914-00001', N'DIAGNOSED', '2026-09-14T10:15:00', N'Trạng thái đổi từ "Đang kiểm tra" sang "Đã chẩn đoán"', N'NV-104', N'Phạm Minh Chinh', N'TECHNICIAN'),
  (19, N'TN-2026-0914-00001', N'AWAITING_QUOTE_APPROVAL', '2026-09-14T10:30:00', N'Trạng thái đổi từ "Đã chẩn đoán" sang "Chờ duyệt giá"', N'NV-104', N'Phạm Minh Chinh', N'TECHNICIAN'),
  (20, N'TN-2026-0914-00001', N'AWAITING_CUSTOMER_CONFIRMATION', '2026-09-14T11:00:00', N'Trạng thái đổi từ "Chờ duyệt giá" sang "Chờ khách xác nhận"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (21, N'TN-2026-0914-00001', N'AWAITING_PARTS', '2026-09-14T13:00:00', N'Trạng thái đổi từ "Chờ khách xác nhận" sang "Chờ linh kiện" (khách xác nhận trên Cổng khách hàng)', N'KH:KH-000004', N'Phan Thị Ngọc', N'CUSTOMER'),
  (22, N'TN-2026-0912-00001', N'RECEIVED', '2026-09-12T11:00:00', N'Khách hàng bàn giao thiết bị, lập phiếu tiếp nhận.', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST'),
  (23, N'TN-2026-0912-00001', N'INSPECTING', '2026-09-12T11:20:00', N'Trạng thái đổi từ "Đã tiếp nhận" sang "Đang kiểm tra"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (24, N'TN-2026-0912-00001', N'DIAGNOSED', '2026-09-12T13:00:00', N'Trạng thái đổi từ "Đang kiểm tra" sang "Đã chẩn đoán"', N'NV-105', N'Hoàng Anh Dũng', N'TECHNICIAN'),
  (25, N'TN-2026-0912-00001', N'AWAITING_QUOTE_APPROVAL', '2026-09-12T13:30:00', N'Trạng thái đổi từ "Đã chẩn đoán" sang "Chờ duyệt giá"', N'NV-105', N'Hoàng Anh Dũng', N'TECHNICIAN'),
  (26, N'TN-2026-0912-00001', N'AWAITING_CUSTOMER_CONFIRMATION', '2026-09-12T14:00:00', N'Trạng thái đổi từ "Chờ duyệt giá" sang "Chờ khách xác nhận"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (27, N'TN-2026-0912-00001', N'AWAITING_RETURN', '2026-09-12T16:00:00', N'Trạng thái đổi từ "Chờ khách xác nhận" sang "Chờ trả máy" (khách từ chối báo giá)', N'KH:KH-000003', N'Lý Gia Bảo', N'CUSTOMER'),
  (28, N'TN-2026-0912-00001', N'RETURNED_UNREPAIRED', '2026-09-13T10:00:00', N'Trạng thái đổi từ "Chờ trả máy" sang "Đã trả máy (không sửa)"', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST');
SET IDENTITY_INSERT LichSuTrangThai_ThietBi OFF;
GO
INSERT INTO LinhKien (MaLK, TenLK, DonViTinh, MaNhom, TenHang, DonGiaVon, DonGiaDichVu, SoLuongTon, SoLuongDaGiu, DinhMucTonToiThieu, KeChinh, ThoiHanBaoHanhThang, MaNCC, HoatDong, PhienBan) VALUES
  (N'LK-BAT-LI01', N'Pin Li-ion laptop', N'Cái', N'LAPTOP_TABLET', N'ASUS', 686000.00, 980000.00, 15, 0, 6, N'KHO-B-02-03', 6, N'NCC-005', 1, 0),
  (N'LK-BOARD-RT01', N'Mainboard router', N'Cái', N'SMALL_ELECTRONICS', N'TP-Link', 294000.00, 420000.00, 2, 0, 4, N'KHO-C-03-02', 6, N'NCC-004', 1, 0),
  (N'LK-CART-PR01', N'Cartridge assembly máy in', N'Cái', N'SMALL_ELECTRONICS', N'Canon', 476000.00, 680000.00, 7, 0, 4, N'KHO-C-03-08', 3, N'NCC-006', 1, 0),
  (N'LK-CHG-MOD01', N'Module sạc smartphone', N'Cái', N'PHONE', N'Samsung', 217000.00, 310000.00, 22, 0, 8, N'KHO-C-01-09', 6, N'NCC-005', 1, 0),
  (N'LK-COMP-RF01', N'Block máy nén tủ lạnh inverter', N'Cái', N'HOME_APPLIANCE', N'Samsung', 1995000.00, 2850000.00, 12, 0, 5, N'KHO-A-03-02', 12, N'NCC-004', 1, 0),
  (N'LK-CTRL-GC01', N'Controller board gaming console', N'Cái', N'SMALL_ELECTRONICS', N'Sony', 623000.00, 890000.00, 4, 0, 4, N'KHO-C-04-01', 6, N'NCC-006', 1, 0),
  (N'LK-CTRL-WM02', N'Bo mạch điều khiển máy giặt', N'Cái', N'HOME_APPLIANCE', N'Electrolux', 1015000.00, 1450000.00, 6, 0, 5, N'KHO-A-04-05', 6, N'NCC-004', 1, 0),
  (N'LK-DISP-OLED', N'Màn hình OLED thay thế', N'Cái', N'TV_MONITOR', N'LG', 2240000.00, 3200000.00, 8, 0, 5, N'KHO-B-01-07', 6, N'NCC-005', 1, 0),
  (N'LK-FAN-COOL02', N'Motor quạt dàn lạnh', N'Cái', N'HOME_APPLIANCE', N'Daikin', 427000.00, 610000.00, 5, 0, 6, N'KHO-A-03-06', 6, N'NCC-006', 1, 0),
  (N'LK-MOT-DRN01', N'Motor xả máy giặt', N'Cái', N'HOME_APPLIANCE', N'Electrolux', 364000.00, 520000.00, 9, 0, 4, N'KHO-A-04-08', 6, N'NCC-004', 1, 0),
  (N'LK-PWR-IC01', N'IC nguồn', N'Cái', N'SMALL_ELECTRONICS', N'Generic', 67000.00, 95000.00, 40, 0, 10, N'KHO-C-02-11', 3, N'NCC-005', 1, 0),
  (N'LK001', N'Màn hình iPhone 14 chính hãng', N'Cái', N'PHONE', N'Apple', 2800000.00, 3500000.00, 12, 0, 3, N'KHO-A-01-01', 6, N'NCC-001', 1, 1),
  (N'LK002', N'Pin MacBook Air M2', N'Cái', N'LAPTOP_TABLET', N'Apple', 1200000.00, 1800000.00, 5, 0, 3, N'KHO-A-02-01', 6, N'NCC-001', 1, 3),
  (N'LK003', N'Pin Galaxy S23', N'Cái', N'PHONE', N'Samsung', 450000.00, 750000.00, 12, 0, 5, N'KHO-B-01-01', 6, N'NCC-002', 1, 0),
  (N'LK004', N'Bàn phím Laptop Dell Inspiron 15', N'Cái', N'LAPTOP_TABLET', N'Dell', 350000.00, 600000.00, 6, 1, 4, N'KHO-B-02-01', 3, N'NCC-002', 1, 1),
  (N'LK005', N'Cáp sạc Type-C chính hãng', N'Cái', N'PHONE', N'Generic', 90000.00, 180000.00, 25, 0, 10, N'KHO-C-01-01', 3, N'NCC-003', 1, 0),
  (N'LK006', N'IC nguồn iPhone (đa dụng)', N'Cái', N'PHONE', N'Apple', 150000.00, 400000.00, 4, 0, 5, N'KHO-A-03-01', 3, N'NCC-003', 1, 1);
GO
INSERT INTO LoaiThietBi (MaLoai, MaNhom, TenLoai, LoaiDinhDanh, ChecklistChanDoan, HoatDong) VALUES
  (N'AIR_CONDITIONER', N'HOME_APPLIANCE', N'Máy lạnh', N'SERIAL', N'["Block lạnh", "Gas lạnh", "Bo mạch điều khiển", "Quạt dàn lạnh"]', 1),
  (N'FRIDGE_INVERTER', N'HOME_APPLIANCE', N'Tủ lạnh inverter', N'SERIAL', N'["Block máy nén", "Bo mạch inverter", "Cảm biến nhiệt độ", "Motor quạt"]', 1),
  (N'GAME_CONSOLE', N'SMALL_ELECTRONICS', N'Máy chơi game', N'SERIAL', N'["Bo nguồn", "Ổ đĩa quang học", "Hệ thống tản nhiệt", "Cổng kết nối tay cầm"]', 1),
  (N'LAPTOP', N'LAPTOP_TABLET', N'Laptop', N'SERIAL', N'["Pin", "Bo mạch chủ", "Màn hình", "Hệ thống tản nhiệt"]', 1),
  (N'MONITOR', N'TV_MONITOR', N'Monitor', N'SERIAL', N'["Tấm nền (panel)", "Bo nguồn", "Cổng tín hiệu", "Bo điều khiển"]', 1),
  (N'PRINTER', N'SMALL_ELECTRONICS', N'Máy in', N'SERIAL', N'["Đầu phun / trống mực", "Bo mạch điều khiển", "Motor kéo giấy", "Cảm biến giấy"]', 1),
  (N'ROUTER', N'SMALL_ELECTRONICS', N'Router', N'SERIAL', N'["Bo mạch chính", "Nguồn adapter", "Ăng-ten", "Firmware"]', 1),
  (N'SMARTPHONE', N'PHONE', N'Điện thoại', N'IMEI', N'["Pin", "Màn hình cảm ứng", "Camera", "Loa & micro"]', 1),
  (N'SMARTWATCH', N'AUDIO_WEARABLE', N'Smartwatch', N'SERIAL', N'["Pin", "Màn hình cảm ứng", "Cảm biến", "Kết nối Bluetooth"]', 1),
  (N'TABLET', N'LAPTOP_TABLET', N'Tablet', N'SERIAL', N'["Pin", "Màn hình cảm ứng", "Bo mạch chính", "Cổng sạc"]', 1),
  (N'TV', N'TV_MONITOR', N'TV', N'SERIAL', N'["Bo nguồn", "Bo mạch chính", "Tấm nền (panel)", "Đèn nền (backlight)"]', 1),
  (N'TWS_EARBUDS', N'AUDIO_WEARABLE', N'Tai nghe TWS', N'SERIAL', N'["Pin", "Driver âm thanh", "Kết nối Bluetooth", "Hộp sạc"]', 1),
  (N'WASHER_FRONT', N'HOME_APPLIANCE', N'Máy giặt lồng ngang', N'SERIAL', N'["Motor xả", "Bo mạch điều khiển", "Khóa cửa", "Hệ thống cấp nước"]', 1);
GO
INSERT INTO NhaCungCap (MaNCC, TenNCC, SDT, DiaChi, Email, HoatDong) VALUES
  (N'NCC-001', N'Công ty TNHH Linh kiện Việt Phát', N'0281234001', N'Q.10, TP.HCM', N'sales@vietphat.vn', 1),
  (N'NCC-002', N'Công ty CP Phụ kiện Kim Long', N'0281234002', N'Q.Tân Bình, TP.HCM', N'contact@kimlong.vn', 1),
  (N'NCC-003', N'Global Parts Supply Co.', N'0281234003', N'Q.Bình Thạnh, TP.HCM', N'order@globalparts.com', 1),
  (N'NCC-004', N'Sao Nam Electronics', N'0281234004', N'TP. Thủ Đức, TP.HCM', N'sales@saonam.vn', 1),
  (N'NCC-005', N'Digiworld Distribution', N'0281234005', N'Q.3, TP.HCM', N'order@digiworld.vn', 1),
  (N'NCC-006', N'Digilife Supply Co.', N'0281234006', N'Q.7, TP.HCM', N'supply@digilife.vn', 1);
GO
INSERT INTO NhanVien (MaNV, HoTen, SDT, Email, ChuyenMon, KyNang, TrangThaiLamViec, SoPhieuToiDa, CoMatTaiTram, MaTram, MaTaiKhoan) VALUES
  (N'NV-001', N'Lê Minh Tâm', N'0901000001', N'tam.lm@longmanloc.vn', N'Điều phối vận hành', N'[]', N'ACTIVE', 10, 1, N'HCM', 1),
  (N'NV-002', N'Nguyễn Văn A', N'0901000002', N'a.nv@longmanloc.vn', N'Điện lạnh', N'["Điện lạnh", "Điện tử gia dụng"]', N'ACTIVE', 10, 1, N'HCM', 2),
  (N'NV-003', N'Đặng Văn Kiên', N'0901000003', N'kien.dv@longmanloc.vn', N'Kho vật tư', N'[]', N'ACTIVE', 10, 1, N'HCM', 3),
  (N'NV-004', N'Trần Bảo Trâm', N'0901000004', N'tram.tb@longmanloc.vn', N'Lễ tân, thu ngân', N'[]', N'ACTIVE', 10, 1, N'HCM', 4),
  (N'NV-005', N'Lê Hoàng Phúc', N'0901000005', N'phuc.lh@longmanloc.vn', N'TV, màn hình', N'["TV", "Màn hình", "Audio"]', N'ACTIVE', 8, 1, N'HCM', 5),
  (N'NV-006', N'Ngô Bảo Châu', N'0901000006', N'chau.nb@longmanloc.vn', N'Quản trị hệ thống', N'[]', N'ACTIVE', 10, 1, N'HCM', 6),
  (N'NV-007', N'Phạm Thị Ngọc Hân', N'0901000007', N'han.ptn@longmanloc.vn', N'Smartphone', N'["Smartphone", "Thiết bị đeo"]', N'ACTIVE', 9, 0, N'HCM', 7),
  (N'NV-008', N'Trần Minh Khoa', N'0901000008', N'khoa.tm@longmanloc.vn', N'Laptop', N'["Laptop", "PC Gaming"]', N'ACTIVE', 10, 1, N'HCM', 8),
  (N'NV-009', N'Đỗ Anh Tuấn', N'0901000009', N'tuan.da@longmanloc.vn', N'Điện lạnh', N'["Điện lạnh", "Máy giặt", "Điều hòa"]', N'ACTIVE', 8, 1, N'HCM', 9),
  (N'NV-010', N'Hồ Quỳnh Như', N'0901000010', N'nhu.hq@longmanloc.vn', N'Thu ngân', N'[]', N'ACTIVE', 10, 1, N'HCM', 10),
  (N'NV-101', N'Trần Thị Hoa', N'0901111001', N'hoa.tt@baohanh.vn', N'Quản lý vận hành', N'[]', N'ACTIVE', 10, 1, N'HCM', 11),
  (N'NV-102', N'Nguyễn Văn An', N'0901111002', N'an.nv@baohanh.vn', N'Tiếp nhận khách hàng', N'[]', N'ACTIVE', 10, 1, N'HCM', 12),
  (N'NV-103', N'Lê Quốc Bình', N'0901111003', N'binh.lq@baohanh.vn', N'Phần cứng Apple', N'["Smartphone", "Laptop"]', N'ACTIVE', 10, 1, N'HCM', 13),
  (N'NV-104', N'Phạm Minh Chinh', N'0901111004', N'chinh.pm@baohanh.vn', N'Laptop, nguồn', N'["Laptop"]', N'ACTIVE', 10, 1, N'HCM', 14),
  (N'NV-105', N'Hoàng Anh Dũng', N'0901111005', N'dung.ha@baohanh.vn', N'Android, phụ kiện', N'["Smartphone", "Audio"]', N'ACTIVE', 10, 1, N'HCM', 15),
  (N'NV-106', N'Vũ Thị Em', N'0901111006', N'em.vt@baohanh.vn', N'Thủ kho', N'[]', N'ACTIVE', 10, 1, N'HCM', 16),
  (N'NV-107', N'Đỗ Văn Phúc', N'0901111007', N'phuc.dv@baohanh.vn', N'Thu ngân', N'[]', N'ACTIVE', 10, 1, N'HCM', 17);
GO
SET IDENTITY_INSERT NhatKyThaoTac ON;
INSERT INTO NhatKyThaoTac (MaNhatKy, ThoiGian, MaNguoiThaoTac, TenNguoiThaoTac, VaiTro, HanhDong, NhanHanhDong, LoaiDoiTuong, MaDoiTuong, GiaTriTruoc, GiaTriSau) VALUES
  (1, '2026-08-30T08:00:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'CUSTOMER_CREATED', N'Tạo hồ sơ khách hàng', N'CUSTOMER', N'KH-000001', N'—', N'KH-000001 — Nguyễn Minh Tuấn — 0912223001'),
  (2, '2026-08-30T08:05:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'CUSTOMER_CREATED', N'Tạo hồ sơ khách hàng', N'CUSTOMER', N'KH-000002', N'—', N'KH-000002 — Trần Thu Mai — 0912223002'),
  (3, '2026-08-30T08:10:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'CUSTOMER_CREATED', N'Tạo hồ sơ khách hàng', N'CUSTOMER', N'KH-000003', N'—', N'KH-000003 — Lý Gia Bảo — 0912223003'),
  (4, '2026-08-30T08:15:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'CUSTOMER_CREATED', N'Tạo hồ sơ khách hàng', N'CUSTOMER', N'KH-000004', N'—', N'KH-000004 — Phan Thị Ngọc — 0912223004'),
  (5, '2026-08-30T09:00:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'DEVICE_REGISTERED', N'Đăng ký thiết bị', N'DEVICE', N'TB-000001', N'—', N'TB-000001 — 354812109876540 — KH-000001'),
  (6, '2026-08-30T09:01:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'DEVICE_REGISTERED', N'Đăng ký thiết bị', N'DEVICE', N'TB-000002', N'—', N'TB-000002 — C02FH3ABCDEF — KH-000002'),
  (7, '2026-08-30T09:02:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'DEVICE_REGISTERED', N'Đăng ký thiết bị', N'DEVICE', N'TB-000003', N'—', N'TB-000003 — 356789102345673 — KH-000003'),
  (8, '2026-08-30T09:03:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'DEVICE_REGISTERED', N'Đăng ký thiết bị', N'DEVICE', N'TB-000004', N'—', N'TB-000004 — DL2024LAPTOP0099 — KH-000004'),
  (9, '2026-08-30T09:04:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'DEVICE_REGISTERED', N'Đăng ký thiết bị', N'DEVICE', N'TB-000005', N'—', N'TB-000005 — APAIRPRO2025XZ — KH-000003'),
  (10, '2026-09-01T09:00:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_RECEIPT_CREATED', N'Tạo phiếu nhập kho', N'STOCK_RECEIPT', N'PN-2026-00001', N'—', N'PN-2026-00001 — Chờ duyệt'),
  (11, '2026-09-01T09:10:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_RECEIPT_APPROVED', N'Duyệt phiếu nhập kho', N'STOCK_RECEIPT', N'PN-2026-00001', N'PN-2026-00001 — Chờ duyệt', N'PN-2026-00001 — Đã nhập kho'),
  (12, '2026-09-05T10:30:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_RECEIPT_CREATED', N'Tạo phiếu nhập kho', N'STOCK_RECEIPT', N'PN-2026-00002', N'—', N'PN-2026-00002 — Chờ duyệt'),
  (13, '2026-09-05T10:40:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_RECEIPT_APPROVED', N'Duyệt phiếu nhập kho', N'STOCK_RECEIPT', N'PN-2026-00002', N'PN-2026-00002 — Chờ duyệt', N'PN-2026-00002 — Đã nhập kho'),
  (14, '2026-09-08T08:30:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'TICKET_CREATED', N'Tạo phiếu tiếp nhận', N'TICKET', N'TN-2026-0908-00001', N'—', N'TN-2026-0908-00001 — Chưa phân công'),
  (15, '2026-09-08T09:00:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'TICKET_ASSIGNED', N'Phân công kỹ thuật viên', N'TICKET', N'TN-2026-0908-00001', N'TN-2026-0908-00001 — Chưa phân công', N'TN-2026-0908-00001 — Lê Quốc Bình'),
  (16, '2026-09-08T10:00:00', N'NV-103', N'Lê Quốc Bình', N'Kỹ thuật viên', N'INSPECTION_RECORDED', N'Lưu kết quả kiểm tra', N'TICKET', N'TN-2026-0908-00001', N'Đang chẩn đoán', N'Đã chẩn đoán — Trong bảo hành'),
  (17, '2026-09-08T14:00:00', N'NV-103', N'Lê Quốc Bình', N'Kỹ thuật viên', N'REPAIR_COMPLETED', N'Xác nhận hoàn tất sửa chữa', N'TICKET', N'TN-2026-0908-00001', N'TN-2026-0908-00001 — Đang sửa chữa', N'TN-2026-0908-00001 — Sẵn sàng bàn giao'),
  (18, '2026-09-09T09:00:00', N'NV-107', N'Đỗ Văn Phúc', N'Thu ngân & Bàn giao', N'PAYMENT_FREE_WARRANTY', N'Xác nhận miễn phí bảo hành', N'TICKET', N'TN-2026-0908-00001', N'TN-2026-0908-00001 — Chưa thanh toán', N'TN-2026-0908-00001 — Miễn phí bảo hành'),
  (19, '2026-09-09T09:15:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'HANDOVER_COMPLETED', N'Hoàn tất bàn giao', N'TICKET', N'TN-2026-0908-00001', N'TN-2026-0908-00001 — Sẵn sàng bàn giao', N'TN-2026-0908-00001 — Đã hoàn thành'),
  (20, '2026-09-07T13:45:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'TICKET_CREATED', N'Tạo phiếu tiếp nhận', N'TICKET', N'TN-2026-0907-00001', N'—', N'TN-2026-0907-00001 — Chưa phân công'),
  (21, '2026-09-07T14:00:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'TICKET_ASSIGNED', N'Phân công kỹ thuật viên', N'TICKET', N'TN-2026-0907-00001', N'TN-2026-0907-00001 — Chưa phân công', N'TN-2026-0907-00001 — Lê Quốc Bình'),
  (22, '2026-09-07T15:00:00', N'NV-103', N'Lê Quốc Bình', N'Kỹ thuật viên', N'INSPECTION_RECORDED', N'Lưu kết quả kiểm tra', N'TICKET', N'TN-2026-0907-00001', N'Đang chẩn đoán', N'Đã chẩn đoán — Ngoài bảo hành'),
  (23, '2026-09-07T15:30:00', N'NV-103', N'Lê Quốc Bình', N'Kỹ thuật viên', N'QUOTATION_CREATED', N'Gửi phiếu báo giá', N'QUOTATION', N'BG-2026-0907-00001', N'—', N'BG-2026-0907-00001 — Chờ phê duyệt — 2.160.000 đ'),
  (24, '2026-09-07T16:00:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'QUOTATION_APPROVED', N'Phê duyệt báo giá', N'QUOTATION', N'BG-2026-0907-00001', N'Chờ phê duyệt', N'Đã phê duyệt — chờ khách xác nhận'),
  (25, '2026-09-07T18:00:00', N'KH:KH-000002', N'Trần Thu Mai', N'Khách hàng', N'QUOTATION_ACCEPTED', N'Xác nhận báo giá', N'QUOTATION', N'BG-2026-0907-00001', N'Chờ khách xác nhận', N'Đã xác nhận (khách xác nhận trên Cổng khách hàng)'),
  (26, '2026-09-08T08:00:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_ISSUE_REQUESTED', N'Gửi yêu cầu linh kiện', N'STOCK_ISSUE', N'PX-2026-00001', N'—', N'PX-2026-00001 — TN-2026-0907-00001 — LK002 × 1'),
  (27, '2026-09-08T08:30:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_DEDUCTED', N'Tự động trừ tồn kho', N'PART', N'LK002', N'Tồn 6', N'Đã trừ 1 Pin MacBook Air M2 khỏi tồn kho — còn 5'),
  (28, '2026-09-08T08:30:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_ISSUE_APPROVED', N'Duyệt phiếu xuất kho', N'STOCK_ISSUE', N'PX-2026-00001', N'PX-2026-00001 — Chờ duyệt', N'PX-2026-00001 — Đã xuất kho'),
  (29, '2026-09-08T11:00:00', N'NV-103', N'Lê Quốc Bình', N'Kỹ thuật viên', N'REPAIR_COMPLETED', N'Xác nhận hoàn tất sửa chữa', N'TICKET', N'TN-2026-0907-00001', N'TN-2026-0907-00001 — Đang sửa chữa', N'TN-2026-0907-00001 — Sẵn sàng bàn giao'),
  (30, '2026-09-08T11:30:00', N'NV-107', N'Đỗ Văn Phúc', N'Thu ngân & Bàn giao', N'PAYMENT_COLLECTED', N'Xác nhận đã thanh toán', N'TICKET', N'TN-2026-0907-00001', N'TN-2026-0907-00001 — Chưa thanh toán', N'TN-2026-0907-00001 — Đã thanh toán 2.160.000 đ'),
  (31, '2026-09-08T16:00:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'HANDOVER_COMPLETED', N'Hoàn tất bàn giao', N'TICKET', N'TN-2026-0907-00001', N'TN-2026-0907-00001 — Sẵn sàng bàn giao', N'TN-2026-0907-00001 — Đã hoàn thành'),
  (32, '2026-09-14T09:20:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'TICKET_CREATED', N'Tạo phiếu tiếp nhận', N'TICKET', N'TN-2026-0914-00001', N'—', N'TN-2026-0914-00001 — Chưa phân công'),
  (33, '2026-09-14T09:40:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'TICKET_ASSIGNED', N'Phân công kỹ thuật viên', N'TICKET', N'TN-2026-0914-00001', N'TN-2026-0914-00001 — Chưa phân công', N'TN-2026-0914-00001 — Phạm Minh Chinh'),
  (34, '2026-09-14T10:15:00', N'NV-104', N'Phạm Minh Chinh', N'Kỹ thuật viên', N'INSPECTION_RECORDED', N'Lưu kết quả kiểm tra', N'TICKET', N'TN-2026-0914-00001', N'Đang chẩn đoán', N'Đã chẩn đoán — Ngoài bảo hành'),
  (35, '2026-09-14T10:30:00', N'NV-104', N'Phạm Minh Chinh', N'Kỹ thuật viên', N'QUOTATION_CREATED', N'Gửi phiếu báo giá', N'QUOTATION', N'BG-2026-0914-00001', N'—', N'BG-2026-0914-00001 — Chờ phê duyệt — 810.000 đ'),
  (36, '2026-09-14T11:00:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'QUOTATION_APPROVED', N'Phê duyệt báo giá', N'QUOTATION', N'BG-2026-0914-00001', N'Chờ phê duyệt', N'Đã phê duyệt — chờ khách xác nhận'),
  (37, '2026-09-14T13:00:00', N'KH:KH-000004', N'Phan Thị Ngọc', N'Khách hàng', N'QUOTATION_ACCEPTED', N'Xác nhận báo giá', N'QUOTATION', N'BG-2026-0914-00001', N'Chờ khách xác nhận', N'Đã xác nhận (khách xác nhận trên Cổng khách hàng)'),
  (38, '2026-09-14T14:00:00', N'NV-104', N'Phạm Minh Chinh', N'Kỹ thuật viên', N'STOCK_ISSUE_REQUESTED', N'Gửi yêu cầu linh kiện', N'STOCK_ISSUE', N'PX-2026-00002', N'—', N'PX-2026-00002 — TN-2026-0914-00001 — LK004 × 1'),
  (39, '2026-09-12T11:00:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'TICKET_CREATED', N'Tạo phiếu tiếp nhận', N'TICKET', N'TN-2026-0912-00001', N'—', N'TN-2026-0912-00001 — Chưa phân công'),
  (40, '2026-09-12T11:20:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'TICKET_ASSIGNED', N'Phân công kỹ thuật viên', N'TICKET', N'TN-2026-0912-00001', N'TN-2026-0912-00001 — Chưa phân công', N'TN-2026-0912-00001 — Hoàng Anh Dũng'),
  (41, '2026-09-12T13:00:00', N'NV-105', N'Hoàng Anh Dũng', N'Kỹ thuật viên', N'INSPECTION_RECORDED', N'Lưu kết quả kiểm tra', N'TICKET', N'TN-2026-0912-00001', N'Đang chẩn đoán', N'Đã chẩn đoán — Ngoài bảo hành'),
  (42, '2026-09-12T13:30:00', N'NV-105', N'Hoàng Anh Dũng', N'Kỹ thuật viên', N'QUOTATION_CREATED', N'Gửi phiếu báo giá', N'QUOTATION', N'BG-2026-0912-00001', N'—', N'BG-2026-0912-00001 — Chờ phê duyệt — 1.836.000 đ'),
  (43, '2026-09-12T14:00:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'QUOTATION_APPROVED', N'Phê duyệt báo giá', N'QUOTATION', N'BG-2026-0912-00001', N'Chờ phê duyệt', N'Đã phê duyệt — chờ khách xác nhận'),
  (44, '2026-09-12T16:00:00', N'KH:KH-000003', N'Lý Gia Bảo', N'Khách hàng', N'QUOTATION_DECLINED', N'Từ chối báo giá', N'QUOTATION', N'BG-2026-0912-00001', N'Chờ khách xác nhận', N'Khách từ chối — Chi phí thay 1 bên tai cao hơn giá mua tai nghe mới, khách xin nhận lại máy.'),
  (45, '2026-09-13T10:00:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'HANDOVER_COMPLETED', N'Hoàn tất bàn giao', N'TICKET', N'TN-2026-0912-00001', N'TN-2026-0912-00001 — Chờ trả máy', N'TN-2026-0912-00001 — Đã trả máy (không sửa)'),
  (46, '2026-09-17T21:02:00', N'PORTAL', NULL, NULL, N'WARRANTY_REQUEST_CREATED', N'Đăng ký yêu cầu bảo hành trực tuyến', N'WARRANTY_REQUEST', N'YC-2026-0917-00001', N'—', N'YC-2026-0917-00001 — Chờ tiếp nhận'),
  (47, '2026-09-16T15:00:00', N'NV-003', N'Đặng Văn Kiên', N'Quản lý kho vật tư', N'STOCK_RECEIPT_CREATED', N'Tạo phiếu nhập kho', N'STOCK_RECEIPT', N'PN-2026-00003', N'—', N'PN-2026-00003 — Chờ duyệt'),
  (48, '2026-09-17T09:00:00', N'NV-003', N'Đặng Văn Kiên', N'Quản lý kho vật tư', N'STOCK_TRANSFER_CREATED', N'Tạo phiếu điều chuyển', N'STOCK_TRANSFER', N'DC-2026-00001', N'—', N'LK-PWR-IC01 × 15: KHO-C-02-11 → KHO-C-01-04');
SET IDENTITY_INSERT NhatKyThaoTac OFF;
GO
INSERT INTO NhomThietBi (MaNhom, TenNhom, ThuTu, HoatDong) VALUES
  (N'AUDIO_WEARABLE', N'Audio/Wearables', 4, 1),
  (N'HOME_APPLIANCE', N'Thiết bị gia dụng', 5, 1),
  (N'LAPTOP_TABLET', N'Laptop/Tablet', 2, 1),
  (N'PHONE', N'Điện thoại', 1, 1),
  (N'SMALL_ELECTRONICS', N'Điện tử nhỏ', 6, 1),
  (N'TV_MONITOR', N'TV/Monitor', 3, 1);
GO
INSERT INTO PhanCong (MaPhanCong, MaPhieuTN, MaNVQuanLy, MaKTV, NgayPhanCong, MucDoUuTien, GhiChu) VALUES
  (N'PC-2026-00001', N'TN-2026-0908-00001', N'NV-101', N'NV-103', '2026-09-08T09:00:00', N'NORMAL', N'Đúng chuyên môn Apple'),
  (N'PC-2026-00002', N'TN-2026-0907-00001', N'NV-101', N'NV-103', '2026-09-07T14:00:00', N'NORMAL', N'MacBook — vẫn thuộc chuyên môn Apple'),
  (N'PC-2026-00003', N'TN-2026-0914-00001', N'NV-101', N'NV-104', '2026-09-14T09:40:00', N'NORMAL', N'Đúng chuyên môn Laptop'),
  (N'PC-2026-00004', N'TN-2026-0912-00001', N'NV-101', N'NV-105', '2026-09-12T11:20:00', N'LOW', N'Phụ kiện — KTV Android xử lý');
GO
INSERT INTO PhieuBanGiao (MaBanGiao, MaPhieuTN, LoaiBanGiao, NgayBanGiao, MaNVBanGiao, NguoiNhanMay, HienTrangKhiTra, TraLaiLinhKienCu, ThoiHanBaoHanhMoi, DanhGiaHaiLong, KT_NgoaiQuanDungBienBan, KT_KhoiDongBinhThuong, KT_ChucNangChinhOK, KT_PhuKienDayDu, KT_KhongLoiPhatSinh, MaTepChuKy, KhachXacNhanNhanMay) VALUES
  (N'PBG-2026-00001', N'TN-2026-0908-00001', N'DELIVERED', '2026-09-09T09:15:00', N'NV-102', N'Nguyễn Minh Tuấn', N'Máy hoạt động ổn định, đã test 20 lần khởi động không lỗi.', 1, NULL, 5, 1, 1, 1, 1, 1, 1, 1),
  (N'PBG-2026-00002', N'TN-2026-0907-00001', N'DELIVERED', '2026-09-08T16:00:00', N'NV-102', N'Trần Thu Mai', N'Máy sạc bình thường, pin đầy 100%.', 1, N'Bảo hành pin mới thay 6 tháng', 4, 1, 1, 1, 1, 1, 2, 1),
  (N'PBG-2026-00003', N'TN-2026-0912-00001', N'RETURNED_UNREPAIRED', '2026-09-13T10:00:00', N'NV-102', N'Lý Gia Bảo', N'Trả nguyên trạng như lúc nhận, không can thiệp sửa chữa.', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1);
GO
INSERT INTO PhieuBaoGia (MaBaoGia, MaPhieuTN, MaPhieuKT, MaKTVLap, NgayLapBaoGia, HanHieuLuc, MaDichVu, TongTienLinhKien, TongTienCong, ThueVAT, TongTienThanhToan, TrangThaiDuyetNoiBo, MaNVQuanLyDuyet, NgayDuyetNoiBo, GhiChuDuyet, KhachXacNhan, NgayKhachXacNhan, LyDoKhachTuChoi, KenhXacNhan, NguoiGhiNhanXacNhan) VALUES
  (N'BG-2026-0907-00001', N'TN-2026-0907-00001', N'PKT-2026-00002', N'NV-103', '2026-09-07T15:30:00', '2026-09-10', N'DV-LAPTOP', 1800000.00, 200000.00, 8.00, 2160000.00, N'APPROVED', N'NV-101', '2026-09-07T16:00:00', N'Đã kiểm tra hợp lý, phê duyệt.', N'ACCEPTED', '2026-09-07T18:00:00', NULL, N'PORTAL', N'KH:KH-000002'),
  (N'BG-2026-0912-00001', N'TN-2026-0912-00001', N'PKT-2026-00004', N'NV-105', '2026-09-12T13:30:00', '2026-09-15', N'DV-AUDIO', 1600000.00, 100000.00, 8.00, 1836000.00, N'APPROVED', N'NV-101', '2026-09-12T14:00:00', NULL, N'DECLINED', '2026-09-12T16:00:00', N'Chi phí thay 1 bên tai cao hơn giá mua tai nghe mới, khách xin nhận lại máy.', N'PORTAL', N'KH:KH-000003'),
  (N'BG-2026-0914-00001', N'TN-2026-0914-00001', N'PKT-2026-00003', N'NV-104', '2026-09-14T10:30:00', '2026-09-17', N'DV-LAPTOP', 600000.00, 150000.00, 8.00, 810000.00, N'APPROVED', N'NV-101', '2026-09-14T11:00:00', NULL, N'ACCEPTED', '2026-09-14T13:00:00', NULL, N'PORTAL', N'KH:KH-000004');
GO
INSERT INTO PhieuDieuChuyen (MaPhieuDC, MaLK, SoLuong, TuKe, DenKe, LyDo, TrangThai, MaNguoiLap, NgayLap, MaNguoiDuyet, NgayDuyet, LyDoTuChoi) VALUES
  (N'DC-2026-00001', N'LK-PWR-IC01', 15, N'KHO-C-02-11', N'KHO-C-01-04', N'Gộp hàng để giải phóng kệ C-02 cho lô nhập mới', N'PENDING', N'NV-003', '2026-09-17T09:00:00', NULL, NULL, NULL);
GO
INSERT INTO PhieuKiemTra (MaPhieuKT, MaPhieuTN, MaKTV, NgayKiemTra, KetQuaKiemTraChiTiet, ChecklistKetQua, TinhTrangVaoNuoc, PhanLoaiBaoHanh, LyDoNgoaiBaoHanh, HuongKhacPhucDeXuat, GhiChuPhanLoaiLai, SoLanSuaPhanLoai, NgayCapNhat) VALUES
  (N'PKT-2026-00001', N'TN-2026-0908-00001', N'NV-103', '2026-09-08T10:00:00', N'Lỗi phần mềm/phần cứng nguồn, không phát hiện dấu hiệu vào nước hay va đập.', N'[{"KetQua": "PASS", "HangMuc": "Pin"}, {"KetQua": "PASS", "HangMuc": "Màn hình cảm ứng"}, {"KetQua": "PASS", "HangMuc": "Camera"}, {"KetQua": "PASS", "HangMuc": "Loa & micro"}]', 0, N'FREE_WARRANTY', NULL, N'Cập nhật firmware, kiểm tra lại nguồn.', NULL, 0, NULL),
  (N'PKT-2026-00002', N'TN-2026-0907-00001', N'NV-103', '2026-09-07T15:00:00', N'Pin chai, sụt áp khi cắm sạc gây chập chờn.', NULL, 0, N'OUT_OF_WARRANTY', N'Thiết bị đã hết hạn bảo hành từ 2025-06-15.', N'Thay pin MacBook Air M2 chính hãng.', NULL, 0, NULL),
  (N'PKT-2026-00003', N'TN-2026-0914-00001', N'NV-104', '2026-09-14T10:15:00', N'Bàn phím liệt 4 phím khu vực WASD, nghi do bụi/đổ nước nhẹ trước đó.', NULL, 0, N'OUT_OF_WARRANTY', N'Khách xác nhận từng làm đổ nước ngọt lên bàn phím tháng trước.', N'Thay cụm bàn phím mới.', NULL, 0, NULL),
  (N'PKT-2026-00004', N'TN-2026-0912-00001', N'NV-105', '2026-09-12T13:00:00', N'Màng loa bên phải bị hỏng, không thể sửa chữa — chỉ thay nguyên củ tai.', NULL, 0, N'OUT_OF_WARRANTY', N'Đã hết hạn bảo hành, lỗi phần cứng không thuộc diện đổi trả.', N'Thay tai nghe bên phải (hàng chính hãng đặt riêng).', NULL, 0, NULL);
GO
INSERT INTO PhieuNhapKho (MaPhieuNhap, MaNCC, SoLo, NgayNhap, MaNguoiLap, NgayLap, TrangThai, MaNguoiDuyet, NgayDuyet, LyDoTuChoi, TongTienNhap, GhiChu) VALUES
  (N'PN-2026-00001', N'NCC-001', N'LOT-0901', '2026-09-01', N'NV-106', '2026-09-01T09:00:00', N'APPROVED', N'NV-106', '2026-09-01T09:10:00', NULL, 13600000.00, N'Nhập bổ sung màn hình iPhone 14 + pin MacBook'),
  (N'PN-2026-00002', N'NCC-003', N'LOT-0905', '2026-09-05', N'NV-106', '2026-09-05T10:30:00', N'APPROVED', N'NV-106', '2026-09-05T10:40:00', NULL, 300000.00, N'Nhập bổ sung IC nguồn — tồn chạm định mức tối thiểu'),
  (N'PN-2026-00003', N'NCC-005', N'LOT-24091', '2026-09-16', N'NV-003', '2026-09-16T15:00:00', N'PENDING', NULL, NULL, NULL, 9860000.00, N'Nhập module sạc + IC nguồn');
GO
INSERT INTO PhieuSuaChua (MaPhieuSC, MaPhieuTN, MaPhanCong, MaKTV, NgayTao, NgayBatDau, TrangThaiSuaChua) VALUES
  (N'PSC-2026-00001', N'TN-2026-0908-00001', N'PC-2026-00001', N'NV-103', '2026-09-08T09:00:00', '2026-09-08T10:30:00', N'DONE'),
  (N'PSC-2026-00002', N'TN-2026-0907-00001', N'PC-2026-00002', N'NV-103', '2026-09-07T14:00:00', '2026-09-08T08:30:00', N'DONE'),
  (N'PSC-2026-00003', N'TN-2026-0914-00001', N'PC-2026-00003', N'NV-104', '2026-09-14T09:40:00', NULL, N'PENDING'),
  (N'PSC-2026-00004', N'TN-2026-0912-00001', N'PC-2026-00004', N'NV-105', '2026-09-12T11:20:00', NULL, N'CANCELLED');
GO
INSERT INTO PhieuTiepNhan (MaPhieuTN, MaTram, NgayTiepNhan, KenhTiepNhan, LoaiYeuCau, MaYeuCau, MaKH, MaThietBi, MaNVTiepNhan, BH_TrangThaiLucNhan, BH_NgayKichHoat, BH_NgayHetHan, BH_MaChinhSach, TinhTrangTem, NQ_VetTray, NQ_CanMop, NQ_NutVo, NQ_DauHieuAmNuoc, NQ_PhuKien, PhuKienKemTheo, TinhTrangNgoaiQuan, KhachXacNhanNgoaiQuan, MoTaLoiKhachBao, NgayHenTra, ChiPhiDuKien, MucSLA, HanSLA, TrangThaiXuLy, NgayCapNhatTrangThai, NguoiCapNhatTrangThai, VaiTroCapNhatTrangThai, GhiChuTrangThai, PhienBan, ConMo) VALUES
  (N'TN-2026-0907-00001', N'HCM', '2026-09-07T13:45:00', N'COUNTER', N'PAID_REPAIR', NULL, N'KH-000002', N'TB-000002', N'NV-102', N'OUT_OF_WARRANTY', '2024-06-15', '2025-06-15', N'CS-0002', N'Không còn tem', N'LIGHT', 0, 0, N'NONE', N'COMPLETE', N'Sạc, cáp', N'Trầy nhẹ góc trái', 1, N'Máy sạc chập chờn, đôi khi không nhận sạc', '2026-09-09T17:00:00', 1800000.00, N'STANDARD_48H', '2026-09-09T13:45:00', N'DELIVERED', '2026-09-08T16:00:00', N'NV-102', N'RECEPTIONIST', NULL, 8, 0),
  (N'TN-2026-0908-00001', N'HCM', '2026-09-08T08:30:00', N'COUNTER', N'WARRANTY', NULL, N'KH-000001', N'TB-000001', N'NV-102', N'IN_WARRANTY', '2025-11-01', '2026-11-01', N'CS-0001', N'Tem nguyên vẹn', N'NONE', 0, 0, N'NONE', N'COMPLETE', N'Không có', N'Không trầy xước', 1, N'Máy tự khởi động lại liên tục', '2026-09-10T17:00:00', 0.00, N'STANDARD_48H', '2026-09-10T08:30:00', N'DELIVERED', '2026-09-09T09:15:00', N'NV-102', N'RECEPTIONIST', NULL, 5, 0),
  (N'TN-2026-0912-00001', N'HCM', '2026-09-12T11:00:00', N'COUNTER', N'PAID_REPAIR', NULL, N'KH-000003', N'TB-000005', N'NV-102', N'OUT_OF_WARRANTY', '2025-08-05', '2026-08-05', N'CS-0006', N'Không còn tem', N'LIGHT', 0, 0, N'NONE', N'COMPLETE', N'Hộp sạc, 2 tai nghe', N'Trầy nhẹ hộp sạc', 1, N'Một bên tai nghe không có âm thanh', '2026-09-14T17:00:00', 900000.00, N'STANDARD_48H', '2026-09-14T11:00:00', N'RETURNED_UNREPAIRED', '2026-09-13T10:00:00', N'NV-102', N'RECEPTIONIST', NULL, 6, 0),
  (N'TN-2026-0914-00001', N'HCM', '2026-09-14T09:20:00', N'MOBILE_APP', N'PAID_REPAIR', NULL, N'KH-000004', N'TB-000004', N'NV-102', N'OUT_OF_WARRANTY', '2024-01-20', '2026-01-20', N'CS-0004', N'Không còn tem', N'NONE', 1, 0, N'SUSPECTED', N'COMPLETE', N'Sạc, túi đựng', N'Móp góc phải, còn hoạt động', 1, N'Một số phím bị liệt, gõ không ăn', '2026-09-17T17:00:00', 600000.00, N'STANDARD_48H', '2026-09-16T09:20:00', N'AWAITING_PARTS', '2026-09-14T13:00:00', N'KH:KH-000004', N'CUSTOMER', N'(khách xác nhận trên Cổng khách hàng)', 5, 1);
GO
INSERT INTO PhieuXuatKho (MaPhieuXuat, MaPhieuTN, NguonXuat, MaBaoGia, LyDoXuat, MaKTVNhan, MaNguoiYeuCau, NgayYeuCau, TrangThai, MaThuKhoXuLy, NgayXuLy, LyDoTuChoi, TongTienXuat) VALUES
  (N'PX-2026-00001', N'TN-2026-0907-00001', N'QUOTATION', N'BG-2026-0907-00001', N'Xuất thay thế sửa chữa', N'NV-103', N'NV-106', '2026-09-08T08:00:00', N'ISSUED', N'NV-106', '2026-09-08T08:30:00', NULL, 1200000.00),
  (N'PX-2026-00002', N'TN-2026-0914-00001', N'QUOTATION', N'BG-2026-0914-00001', N'Xuất thay thế sửa chữa', N'NV-104', N'NV-104', '2026-09-14T14:00:00', N'PENDING', NULL, NULL, NULL, 350000.00);
GO
INSERT INTO SanPham (MaSP, TenSP, MaHang, MaLoai, DongSanPham, ThoiHanBaoHanhMacDinhThang, HoatDong) VALUES
  (N'SP-0001', N'iPhone 14', N'APPLE', N'SMARTPHONE', N'iPhone', 12, 1),
  (N'SP-0002', N'MacBook Air M2', N'APPLE', N'LAPTOP', N'MacBook', 12, 1),
  (N'SP-0003', N'Galaxy S23', N'SAMSUNG', N'SMARTPHONE', N'Galaxy S', 12, 1),
  (N'SP-0004', N'Laptop Inspiron 15', N'DELL', N'LAPTOP', N'Inspiron', 24, 1),
  (N'SP-0005', N'Tai nghe Bluetooth AirPods Pro', N'APPLE', N'TWS_EARBUDS', N'AirPods', 12, 1);
GO
SET IDENTITY_INSERT TaiKhoan ON;
INSERT INTO TaiKhoan (MaTaiKhoan, TenDangNhap, MatKhauHash, LoaiChuThe, TrangThai, SoLanSaiLienTiep, KhoaTamDen, BatBuocDoiMatKhau, PhienBanBaoMat, LanDangNhapCuoi, NgayDoiMatKhau, NgayTao) VALUES
  (1, N'dieuphoi', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (2, N'kythuat', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (3, N'khovattu', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (4, N'letan', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (5, N'ktv.phuc', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (6, N'admin', N'{bcrypt}$2a$12$cxK.HYz3LwntHDeYsQout.xTzVnA8B1QsZH55vYWrp4T5/.G7lqby', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (7, N'ktv.han', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (8, N'kythuat_khoa', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'LOCKED', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (9, N'ktv.tuan', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (10, N'thungan.nhu', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (11, N'quanly.hoa', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (12, N'tiepnhan.an', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (13, N'ktv.binh', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (14, N'ktv.chinh', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (15, N'ktv.dung', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (16, N'thukho.em', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (17, N'thungan.phuc', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (18, N'kh.tuan', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'CUSTOMER', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (19, N'kh.mai', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'CUSTOMER', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00');
SET IDENTITY_INSERT TaiKhoan OFF;
GO
INSERT INTO TaiKhoan_VaiTro (MaTaiKhoan, MaVaiTro) VALUES
  (6, N'ADMIN'),
  (4, N'CASHIER'),
  (10, N'CASHIER'),
  (17, N'CASHIER'),
  (18, N'CUSTOMER'),
  (19, N'CUSTOMER'),
  (1, N'DISPATCHER'),
  (11, N'DISPATCHER'),
  (4, N'RECEPTIONIST'),
  (12, N'RECEPTIONIST'),
  (2, N'TECHNICIAN'),
  (5, N'TECHNICIAN'),
  (7, N'TECHNICIAN'),
  (8, N'TECHNICIAN'),
  (9, N'TECHNICIAN'),
  (13, N'TECHNICIAN'),
  (14, N'TECHNICIAN'),
  (15, N'TECHNICIAN'),
  (3, N'WAREHOUSE_KEEPER'),
  (16, N'WAREHOUSE_KEEPER');
GO
SET IDENTITY_INSERT TepDinhKem ON;
INSERT INTO TepDinhKem (MaTep, LoaiChuSoHuu, MaChuSoHuu, TenTep, LoaiNoiDung, KichThuoc, DuongDanLuuTru, NguoiTaiLen, NgayTaiLen) VALUES
  (1, N'HANDOVER_SIGNATURE', N'TN-2026-0908-00001', N'chu-ky-khach.png', N'image/png', 2048, N'seed/signatures/blank.png', N'NV-102', '2026-09-09T09:14:00'),
  (2, N'HANDOVER_SIGNATURE', N'TN-2026-0907-00001', N'chu-ky-khach.png', N'image/png', 2048, N'seed/signatures/blank.png', N'NV-102', '2026-09-08T15:59:00');
SET IDENTITY_INSERT TepDinhKem OFF;
GO
INSERT INTO ThietBi (MaThietBi, MaSP, LoaiDinhDanh, SoSerial_IMEI, MaKH, NgayKichHoatBaoHanh, NgayHetHanBaoHanh, NhaPhanPhoi, NgayTao) VALUES
  (N'TB-000001', N'SP-0001', N'IMEI', N'354812109876540', N'KH-000001', '2025-11-01', '2026-11-01', N'Apple Việt Nam (qua FPT Trading)', '2026-08-30T09:00:00'),
  (N'TB-000002', N'SP-0002', N'SERIAL', N'C02FH3ABCDEF', N'KH-000002', '2024-06-15', '2025-06-15', N'Apple Việt Nam (qua FPT Trading)', '2026-08-30T09:01:00'),
  (N'TB-000003', N'SP-0003', N'IMEI', N'356789102345673', N'KH-000003', '2026-03-10', '2027-03-10', N'Samsung Việt Nam', '2026-08-30T09:02:00'),
  (N'TB-000004', N'SP-0004', N'SERIAL', N'DL2024LAPTOP0099', N'KH-000004', '2024-01-20', '2026-01-20', N'Dell Việt Nam', '2026-08-30T09:03:00'),
  (N'TB-000005', N'SP-0005', N'SERIAL', N'APAIRPRO2025XZ', N'KH-000003', '2025-08-05', '2026-08-05', N'Apple Việt Nam (qua FPT Trading)', '2026-08-30T09:04:00');
GO
SET IDENTITY_INSERT ThongBao ON;
INSERT INTO ThongBao (MaThongBao, MaVaiTroNhan, MaTaiKhoanNhan, Loai, NoiDung, DuongDan, MaDoiTuong, NgayTao) VALUES
  (1, N'DISPATCHER', NULL, N'TICKET_RECEIVED', N'Phiếu TN-2026-0908-00001 mới tiếp nhận, chờ phân công.', N'index.html', N'TN-2026-0908-00001', '2026-09-08T08:30:00'),
  (2, NULL, 13, N'TICKET_ASSIGNED', N'Bạn được giao phiếu TN-2026-0908-00001.', N'pages/technician.html', N'TN-2026-0908-00001', '2026-09-08T09:00:00'),
  (3, N'CASHIER', NULL, N'TICKET_READY_FOR_HANDOVER', N'Phiếu TN-2026-0908-00001 đã QC đạt — sẵn sàng thu tiền và bàn giao.', N'pages/cashier.html', N'TN-2026-0908-00001', '2026-09-08T14:00:00'),
  (4, N'DISPATCHER', NULL, N'TICKET_RECEIVED', N'Phiếu TN-2026-0907-00001 mới tiếp nhận, chờ phân công.', N'index.html', N'TN-2026-0907-00001', '2026-09-07T13:45:00'),
  (5, NULL, 13, N'TICKET_ASSIGNED', N'Bạn được giao phiếu TN-2026-0907-00001.', N'pages/technician.html', N'TN-2026-0907-00001', '2026-09-07T14:00:00'),
  (6, N'DISPATCHER', NULL, N'QUOTATION_PENDING', N'Báo giá BG-2026-0907-00001 đang chờ phê duyệt.', N'index.html#quotes', N'BG-2026-0907-00001', '2026-09-07T15:30:00'),
  (7, N'RECEPTIONIST', NULL, N'QUOTATION_APPROVED', N'Báo giá BG-2026-0907-00001 đã duyệt — chờ khách xác nhận.', N'pages/receptionist.html', N'BG-2026-0907-00001', '2026-09-07T16:00:00'),
  (8, N'WAREHOUSE_KEEPER', NULL, N'STOCK_ISSUE_PENDING', N'Yêu cầu xuất kho PX-2026-00001 cho phiếu TN-2026-0907-00001 đang chờ duyệt.', N'pages/warehouse.html#stockout', N'PX-2026-00001', '2026-09-08T08:00:00'),
  (9, NULL, 13, N'STOCK_ISSUE_APPROVED', N'Phiếu xuất PX-2026-00001 đã xuất kho — nhận linh kiện cho phiếu TN-2026-0907-00001.', N'pages/technician.html', N'PX-2026-00001', '2026-09-08T08:30:00'),
  (10, N'CASHIER', NULL, N'TICKET_READY_FOR_HANDOVER', N'Phiếu TN-2026-0907-00001 đã QC đạt — sẵn sàng thu tiền và bàn giao.', N'pages/cashier.html', N'TN-2026-0907-00001', '2026-09-08T11:00:00'),
  (11, N'DISPATCHER', NULL, N'TICKET_RECEIVED', N'Phiếu TN-2026-0914-00001 mới tiếp nhận, chờ phân công.', N'index.html', N'TN-2026-0914-00001', '2026-09-14T09:20:00'),
  (12, NULL, 14, N'TICKET_ASSIGNED', N'Bạn được giao phiếu TN-2026-0914-00001.', N'pages/technician.html', N'TN-2026-0914-00001', '2026-09-14T09:40:00'),
  (13, N'DISPATCHER', NULL, N'QUOTATION_PENDING', N'Báo giá BG-2026-0914-00001 đang chờ phê duyệt.', N'index.html#quotes', N'BG-2026-0914-00001', '2026-09-14T10:30:00'),
  (14, N'RECEPTIONIST', NULL, N'QUOTATION_APPROVED', N'Báo giá BG-2026-0914-00001 đã duyệt — chờ khách xác nhận.', N'pages/receptionist.html', N'BG-2026-0914-00001', '2026-09-14T11:00:00'),
  (15, N'WAREHOUSE_KEEPER', NULL, N'STOCK_ISSUE_PENDING', N'Yêu cầu xuất kho PX-2026-00002 cho phiếu TN-2026-0914-00001 đang chờ duyệt.', N'pages/warehouse.html#stockout', N'PX-2026-00002', '2026-09-14T14:00:00'),
  (16, N'DISPATCHER', NULL, N'TICKET_RECEIVED', N'Phiếu TN-2026-0912-00001 mới tiếp nhận, chờ phân công.', N'index.html', N'TN-2026-0912-00001', '2026-09-12T11:00:00'),
  (17, NULL, 15, N'TICKET_ASSIGNED', N'Bạn được giao phiếu TN-2026-0912-00001.', N'pages/technician.html', N'TN-2026-0912-00001', '2026-09-12T11:20:00'),
  (18, N'DISPATCHER', NULL, N'QUOTATION_PENDING', N'Báo giá BG-2026-0912-00001 đang chờ phê duyệt.', N'index.html#quotes', N'BG-2026-0912-00001', '2026-09-12T13:30:00'),
  (19, N'RECEPTIONIST', NULL, N'QUOTATION_APPROVED', N'Báo giá BG-2026-0912-00001 đã duyệt — chờ khách xác nhận.', N'pages/receptionist.html', N'BG-2026-0912-00001', '2026-09-12T14:00:00'),
  (20, N'RECEPTIONIST', NULL, N'WARRANTY_REQUEST_NEW', N'Yêu cầu bảo hành online mới YC-2026-0917-00001.', N'pages/receptionist.html', N'YC-2026-0917-00001', '2026-09-17T21:02:00');
SET IDENTITY_INSERT ThongBao OFF;
GO
INSERT INTO TonKhoTheoKe (MaLK, MaKe, SoLuong) VALUES
  (N'LK-BAT-LI01', N'KHO-B-02-03', 15),
  (N'LK-BOARD-RT01', N'KHO-C-03-02', 2),
  (N'LK-CART-PR01', N'KHO-C-03-08', 7),
  (N'LK-CHG-MOD01', N'KHO-C-01-09', 22),
  (N'LK-COMP-RF01', N'KHO-A-03-02', 12),
  (N'LK-CTRL-GC01', N'KHO-C-04-01', 4),
  (N'LK-CTRL-WM02', N'KHO-A-04-05', 6),
  (N'LK-DISP-OLED', N'KHO-B-01-07', 8),
  (N'LK-FAN-COOL02', N'KHO-A-03-06', 5),
  (N'LK-MOT-DRN01', N'KHO-A-04-08', 9),
  (N'LK-PWR-IC01', N'KHO-C-02-11', 40),
  (N'LK001', N'KHO-A-01-01', 12),
  (N'LK002', N'KHO-A-02-01', 5),
  (N'LK003', N'KHO-B-01-01', 12),
  (N'LK004', N'KHO-B-02-01', 6),
  (N'LK005', N'KHO-C-01-01', 25),
  (N'LK006', N'KHO-A-03-01', 4);
GO
INSERT INTO YeuCauBaoHanh (MaYeuCau, HoTenKhach, SDTKhach, EmailKhach, DiaChiKhach, MaNhom, MaLoai, HangModel, LoaiDinhDanh, SoSerial_IMEI, MoTaLoi, MaTramMongMuon, ThoiGianMongMuonTu, ThoiGianMongMuonDen, TrangThai, MaPhieuTN, MaNVXuLy, NgayXuLy, LyDoHuy, NgayTao) VALUES
  (N'YC-2026-0917-00001', N'Võ Thị Kim Ngân', N'0901556210', NULL, NULL, N'SMALL_ELECTRONICS', N'GAME_CONSOLE', N'Microsoft Xbox Series X', N'SERIAL', N'SN-XBSX-90021', N'Máy tự tắt nguồn khi chơi lâu, quạt tản nhiệt kêu to.', N'HCM', '2026-09-19T14:00:00', '2026-09-19T16:00:00', N'PENDING_INTAKE', NULL, NULL, NULL, NULL, '2026-09-17T21:02:00');
GO
ALTER TABLE BangGiaDichVu WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE BoDemMa WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ChinhSachBaoHanh WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ChiTietBaoGia WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ChiTietNhapKho WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ChiTietXuatKho WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE GhiChuPhieu WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE HangSanXuat WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE HangSanXuat_NhomThietBi WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE HoaDon_PhieuThu WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE KetQuaSuaChua WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE KhachHang WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE LichSuPhanCong WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE LichSuTrangThai_ThietBi WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE LinhKien WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE LoaiThietBi WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE MaXacThucOTP WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE NhaCungCap WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE NhanVien WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE NhatKyThaoTac WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE NhomThietBi WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhanCong WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuBanGiao WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuBaoGia WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuDieuChuyen WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuKiemTra WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuNhapKho WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuSuaChua WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuTiepNhan WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuXuatKho WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE RefreshToken WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE SanPham WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE TaiKhoan WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE TaiKhoan_VaiTro WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE TepDinhKem WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ThietBi WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ThietBiNhanThongBao WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ThongBao WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ThongBao_DaDoc WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE TonKhoTheoKe WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE YeuCauBaoHanh WITH CHECK CHECK CONSTRAINT ALL;
GO
COMMIT;
GO
