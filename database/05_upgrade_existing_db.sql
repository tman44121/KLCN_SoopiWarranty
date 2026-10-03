-- ============================================================================
-- Nâng cấp database ĐÃ CÓ (tạo từ một bản script trước) lên schema/dữ liệu tham chiếu hiện tại, giữ nguyên dữ liệu.
-- Mỗi phần tự kiểm tra trước khi sửa, nên chạy được trên database tạo từ BẤT KỲ bản script nào trước đây và chạy lại
-- nhiều lần không sao. Database tạo mới bằng 01 + 02 + 03 (hoặc TrungTamBaoHanhDB_SqlServer.sql) đã có đủ, không cần chạy.
--   1. Phiếu: bỏ trạng thái CANCELLED, thay bằng AWAITING_RETURN (Chờ trả máy); thêm chuyển
--      AWAITING_CUSTOMER_CONFIRMATION → REPAIRING (khách đồng ý báo giá chỉ có tiền công). YeuCauBaoHanh thêm cột MaKH.
--      DanhMucNhan: nhãn TICKET_STATUS mới.
--   2. Quản lý tài khoản khách: quyền CUSTOMER_ACCOUNT_MANAGE, CUSTOMER_PASSWORD_RESET; Quản trị viên được xem/sửa/lưu trữ/
--      gộp hồ sơ khách, Lễ tân được đặt lại mật khẩu khách.
-- Chạy bằng tài khoản quản trị (cần ALTER TABLE):
--   sqlcmd -S <server> -d <database> -E -C -I -b -f 65001 -i database\05_upgrade_existing_db.sql
-- ============================================================================
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;
GO

-- ----------------------------------------------------------------------------
-- 1. Trạng thái Chờ trả máy, MaKH cho yêu cầu bảo hành
-- ----------------------------------------------------------------------------

IF COL_LENGTH(N'dbo.YeuCauBaoHanh', N'MaKH') IS NULL
    ALTER TABLE YeuCauBaoHanh ADD MaKH NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys fk JOIN sys.foreign_key_columns c ON c.constraint_object_id = fk.object_id
               WHERE fk.parent_object_id = OBJECT_ID(N'dbo.YeuCauBaoHanh') AND fk.referenced_object_id = OBJECT_ID(N'dbo.KhachHang')
                 AND COL_NAME(c.parent_object_id, c.parent_column_id) = N'MaKH')
    ALTER TABLE YeuCauBaoHanh ADD CONSTRAINT FK_YeuCau_KhachHang FOREIGN KEY (MaKH) REFERENCES KhachHang(MaKH);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.YeuCauBaoHanh') AND name = N'IX_YeuCau_KhachHang')
    CREATE INDEX IX_YeuCau_KhachHang ON YeuCauBaoHanh (MaKH, TrangThai, NgayTao);

-- Yêu cầu đã chuyển thành phiếu: lấy khách của phiếu.
UPDATE yc SET MaKH = ptn.MaKH
FROM YeuCauBaoHanh yc JOIN PhieuTiepNhan ptn ON ptn.MaPhieuTN = yc.MaPhieuTN
WHERE yc.MaKH IS NULL;

-- Trạng thái phiếu CANCELLED → AWAITING_RETURN.
IF OBJECT_ID(N'dbo.CK_PTN_TrangThai', N'C') IS NOT NULL
    ALTER TABLE PhieuTiepNhan DROP CONSTRAINT CK_PTN_TrangThai;
UPDATE PhieuTiepNhan SET TrangThaiXuLy = N'AWAITING_RETURN' WHERE TrangThaiXuLy = N'CANCELLED';
UPDATE LichSuTrangThai_ThietBi SET TrangThai = N'AWAITING_RETURN' WHERE TrangThai = N'CANCELLED';
ALTER TABLE PhieuTiepNhan WITH CHECK ADD CONSTRAINT CK_PTN_TrangThai CHECK (TrangThaiXuLy IN (
    'RECEIVED', 'INSPECTING', 'DIAGNOSED', 'AWAITING_QUOTE_APPROVAL', 'AWAITING_CUSTOMER_CONFIRMATION',
    'AWAITING_PARTS', 'AWAITING_RETURN', 'REPAIRING', 'COMPLETED', 'DELIVERED', 'RETURNED_UNREPAIRED'));

DELETE FROM ChuyenTrangThaiHopLe WHERE TuTrangThai = N'CANCELLED' OR DenTrangThai = N'CANCELLED';
MERGE ChuyenTrangThaiHopLe AS t
USING (VALUES
  (N'AWAITING_CUSTOMER_CONFIRMATION', N'AWAITING_PARTS', N'T7a Khách đồng ý, cần chờ linh kiện'),
  (N'AWAITING_CUSTOMER_CONFIRMATION', N'REPAIRING', N'T7a Khách đồng ý, không cần chờ linh kiện'),
  (N'AWAITING_CUSTOMER_CONFIRMATION', N'AWAITING_RETURN', N'T7b Khách từ chối, chờ trả máy'),
  (N'AWAITING_PARTS', N'REPAIRING', N'T9 Duyệt xuất kho / T9c Đủ linh kiện ngoài kho'),
  (N'AWAITING_RETURN', N'RETURNED_UNREPAIRED', N'T12 Trung tâm xác nhận đã trả máy')
) AS s (TuTrangThai, DenTrangThai, MoTa)
ON t.TuTrangThai = s.TuTrangThai AND t.DenTrangThai = s.DenTrangThai
WHEN MATCHED THEN UPDATE SET MoTa = s.MoTa
WHEN NOT MATCHED THEN INSERT (TuTrangThai, DenTrangThai, MoTa) VALUES (s.TuTrangThai, s.DenTrangThai, s.MoTa);

DELETE FROM DanhMucNhan WHERE Nhom = N'TICKET_STATUS' AND Ma = N'CANCELLED';
MERGE DanhMucNhan AS t
USING (VALUES
  (N'TICKET_STATUS', N'AWAITING_RETURN', N'Chờ trả máy', N'Chờ trả máy', N'warning', 9),
  (N'TICKET_STATUS', N'COMPLETED', N'Hoàn thành', N'Hoàn thành – Chờ bàn giao', N'success', 8),
  (N'TICKET_STATUS', N'DELIVERED', N'Đã bàn giao', N'Đã bàn giao', N'success', 11),
  (N'TICKET_STATUS', N'RETURNED_UNREPAIRED', N'Đã trả máy (không sửa)', N'Đã trả máy (không sửa)', N'neutral', 12)
) AS s (Nhom, Ma, NhanNghiepVu, NhanGiaoDien, Tone, ThuTu)
ON t.Nhom = s.Nhom AND t.Ma = s.Ma
WHEN MATCHED THEN UPDATE SET NhanNghiepVu = s.NhanNghiepVu, NhanGiaoDien = s.NhanGiaoDien, Tone = s.Tone, ThuTu = s.ThuTu
WHEN NOT MATCHED THEN INSERT (Nhom, Ma, NhanNghiepVu, NhanGiaoDien, Tone, ThuTu)
    VALUES (s.Nhom, s.Ma, s.NhanNghiepVu, s.NhanGiaoDien, s.Tone, s.ThuTu);
GO

-- ----------------------------------------------------------------------------
-- 2. Quản lý tài khoản khách hàng
-- ----------------------------------------------------------------------------
MERGE QuyenHan AS t
USING (VALUES
  (N'CUSTOMER_ACCOUNT_MANAGE', N'Quản lý tài khoản khách (khóa / mở khóa)'),
  (N'CUSTOMER_PASSWORD_RESET', N'Đặt lại mật khẩu tài khoản khách')
) AS s (MaQuyen, MoTa)
ON t.MaQuyen = s.MaQuyen
WHEN MATCHED THEN UPDATE SET MoTa = s.MoTa
WHEN NOT MATCHED THEN INSERT (MaQuyen, MoTa) VALUES (s.MaQuyen, s.MoTa);

INSERT INTO VaiTro_QuyenHan (MaVaiTro, MaQuyen)
SELECT s.MaVaiTro, s.MaQuyen
FROM (VALUES
  (N'ADMIN', N'CUSTOMER_ACCOUNT_MANAGE'),
  (N'ADMIN', N'CUSTOMER_ARCHIVE'),
  (N'ADMIN', N'CUSTOMER_MERGE'),
  (N'ADMIN', N'CUSTOMER_PASSWORD_RESET'),
  (N'ADMIN', N'CUSTOMER_READ_CONTACT'),
  (N'ADMIN', N'CUSTOMER_UPDATE_CONTACT'),
  (N'RECEPTIONIST', N'CUSTOMER_PASSWORD_RESET')
) AS s (MaVaiTro, MaQuyen)
WHERE NOT EXISTS (SELECT 1 FROM VaiTro_QuyenHan v WHERE v.MaVaiTro = s.MaVaiTro AND v.MaQuyen = s.MaQuyen);

UPDATE VaiTro SET MoTa = N'Tài khoản & phân quyền, tài khoản khách, danh mục, báo cáo, nhật ký' WHERE MaVaiTro = N'ADMIN';
GO

COMMIT;
GO
