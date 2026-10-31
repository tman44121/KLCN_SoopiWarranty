-- Thống kê truy cập tài khoản từ 31/10/2026. Không xóa hoặc đếm bù dữ liệu quá khứ.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO
IF OBJECT_ID(N'dbo.MocThongKeTruyCap', N'U') IS NULL
BEGIN
    CREATE TABLE MocThongKeTruyCap (
        Id INT PRIMARY KEY CHECK (Id=1),
        NgayBatDau DATE NOT NULL
    );
END;
IF NOT EXISTS (SELECT 1 FROM MocThongKeTruyCap WHERE Id=1)
    INSERT MocThongKeTruyCap (Id,NgayBatDau) VALUES (1,CONVERT(DATE,'20261031',112));
GO
IF OBJECT_ID(N'dbo.LuotTruyCap', N'U') IS NULL
BEGIN
    CREATE TABLE LuotTruyCap (
        MaLuot BIGINT IDENTITY(1,1) PRIMARY KEY,
        MaTaiKhoan BIGINT NOT NULL REFERENCES TaiKhoan(MaTaiKhoan),
        MaPhien NCHAR(36) NOT NULL,
        BatDau DATETIME2(0) NOT NULL,
        HoatDongCuoi DATETIME2(0) NOT NULL,
        KetThuc DATETIME2(0) NULL,
        CONSTRAINT CK_LuotTruyCap_Time CHECK (HoatDongCuoi>=BatDau AND (KetThuc IS NULL OR KetThuc>=HoatDongCuoi)),
        INDEX IX_LuotTruyCap_Ngay (BatDau) INCLUDE (MaTaiKhoan),
        INDEX IX_LuotTruyCap_TaiKhoan (MaTaiKhoan,MaPhien),
        INDEX IX_LuotTruyCap_Online (HoatDongCuoi) INCLUDE (MaTaiKhoan,MaPhien,KetThuc)
    );
    CREATE UNIQUE INDEX UX_LuotTruyCap_PhienMo ON LuotTruyCap(MaPhien) WHERE KetThuc IS NULL;
END;
GO
IF OBJECT_ID(N'dbo.TruyCapTheoNgay', N'U') IS NULL
BEGIN
    CREATE TABLE TruyCapTheoNgay (
        Ngay DATE NOT NULL,
        MaTaiKhoan BIGINT NOT NULL REFERENCES TaiKhoan(MaTaiKhoan),
        PRIMARY KEY (Ngay,MaTaiKhoan)
    );
END;
GO
COMMIT;
GO
