-- Lưu giá tính khách của linh kiện tại lúc lập phiếu xuất (ChiTietXuatKho.DonGiaDichVuXuat) để giá trị "Miễn phí trong
-- bảo hành" của phiếu cũ không đổi khi quản trị viên sửa giá danh mục. Chạy được nhiều lần.
-- Dòng xuất đã có trước script được điền bằng giá hiện tại của linh kiện tại thời điểm chạy (không còn dữ liệu giá cũ hơn).
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF OBJECT_ID(N'dbo.ChiTietXuatKho', N'U') IS NULL
    THROW 50000, N'Không tìm thấy bảng dbo.ChiTietXuatKho.', 1;
IF COL_LENGTH('dbo.ChiTietXuatKho', 'DonGiaDichVuXuat') IS NULL
    ALTER TABLE dbo.ChiTietXuatKho ADD DonGiaDichVuXuat DECIMAL(18,2) NULL
        CONSTRAINT CK_CTXK_DonGiaDichVu CHECK (DonGiaDichVuXuat IS NULL OR DonGiaDichVuXuat >= 0);
GO
UPDATE c SET DonGiaDichVuXuat = l.DonGiaDichVu
FROM dbo.ChiTietXuatKho c JOIN dbo.LinhKien l ON l.MaLK = c.MaLK
WHERE c.DonGiaDichVuXuat IS NULL;
GO
