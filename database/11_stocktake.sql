-- Kiểm kê kho: phiếu kiểm kê ghi tồn hệ thống lúc đếm và số đếm thực tế theo từng linh kiện × kệ/ngăn.
-- Duyệt phiếu điều chỉnh tồn theo chênh lệch (thực tế − hệ thống lúc đếm). Chạy được nhiều lần.
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.PhieuKiemKe', N'U') IS NULL
BEGIN
    CREATE TABLE PhieuKiemKe (
        MaPhieuKK     NVARCHAR(30)  PRIMARY KEY,
        PhamVi        NVARCHAR(100) NOT NULL,
        GhiChu        NVARCHAR(255) NULL,
        TrangThai     NVARCHAR(10)  NOT NULL DEFAULT 'PENDING',
        MaNguoiLap    NVARCHAR(20)  NOT NULL,
        NgayLap       DATETIME2(0)  NOT NULL,
        MaNguoiDuyet  NVARCHAR(20)  NULL,
        NgayDuyet     DATETIME2(0)  NULL,
        LyDoTuChoi    NVARCHAR(255) NULL,
        INDEX IX_KiemKe_TrangThai (TrangThai, NgayLap),
        FOREIGN KEY (MaNguoiLap) REFERENCES NhanVien(MaNV),
        FOREIGN KEY (MaNguoiDuyet) REFERENCES NhanVien(MaNV),
        CONSTRAINT CK_KK_TrangThai CHECK (TrangThai IN ('PENDING', 'COMPLETED', 'REJECTED')),
        CONSTRAINT CK_KK_XuLy CHECK (TrangThai = 'PENDING' OR (MaNguoiDuyet IS NOT NULL AND NgayDuyet IS NOT NULL)),
        CONSTRAINT CK_KK_TuChoi CHECK (TrangThai <> 'REJECTED' OR (LyDoTuChoi IS NOT NULL AND TRIM(LyDoTuChoi) <> ''))
    );
END;

IF OBJECT_ID(N'dbo.ChiTietKiemKe', N'U') IS NULL
BEGIN
    CREATE TABLE ChiTietKiemKe (
        MaChiTietKK     BIGINT IDENTITY(1,1) PRIMARY KEY,
        MaPhieuKK       NVARCHAR(30)  NOT NULL,
        MaLK            NVARCHAR(30)  NOT NULL,
        MaKe            NVARCHAR(20)  NOT NULL,
        SoLuongHeThong  INT           NOT NULL,
        SoLuongThucTe   INT           NOT NULL,
        GhiChu          NVARCHAR(255) NULL,
        CONSTRAINT UX_CTKK_LinhKienKe UNIQUE (MaPhieuKK, MaLK, MaKe),
        FOREIGN KEY (MaPhieuKK) REFERENCES PhieuKiemKe(MaPhieuKK),
        FOREIGN KEY (MaLK) REFERENCES LinhKien(MaLK),
        CONSTRAINT CK_CTKK_SoLuong CHECK (SoLuongHeThong >= 0 AND SoLuongThucTe >= 0),
        CONSTRAINT CK_CTKK_Ke CHECK (MaKe LIKE 'KHO-[A-Z]-[0-9][0-9]-[0-9][0-9]')
    );
END;

IF OBJECT_ID(N'dbo.QuyenHan', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM QuyenHan WHERE MaQuyen = N'STOCKTAKE_MANAGE')
    INSERT INTO QuyenHan (MaQuyen, MoTa) VALUES (N'STOCKTAKE_MANAGE', N'Kiểm kê kho');
IF OBJECT_ID(N'dbo.VaiTro_QuyenHan', N'U') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM VaiTro_QuyenHan WHERE MaVaiTro = N'WAREHOUSE_KEEPER' AND MaQuyen = N'STOCKTAKE_MANAGE')
    INSERT INTO VaiTro_QuyenHan (MaVaiTro, MaQuyen) VALUES (N'WAREHOUSE_KEEPER', N'STOCKTAKE_MANAGE');

COMMIT;
