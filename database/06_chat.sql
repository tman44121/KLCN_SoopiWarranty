-- Nâng cấp DB hiện có: chat riêng khách hàng và người phụ trách phiếu. Chạy lặp lại an toàn.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO
IF OBJECT_ID(N'dbo.HoiThoai', N'U') IS NULL
BEGIN
    CREATE TABLE HoiThoai (
        MaHoiThoai       BIGINT IDENTITY(1,1) PRIMARY KEY,
        MaPhieuTN        NVARCHAR(30) NOT NULL,
        MaTaiKhoanKhach  BIGINT NOT NULL,
        MaTaiKhoanNV     BIGINT NOT NULL,
        KhachDaDocDen    BIGINT NOT NULL DEFAULT 0,
        NVDaDocDen       BIGINT NOT NULL DEFAULT 0,
        NgayCapNhat      DATETIME2(0) NOT NULL,
        CONSTRAINT UX_HoiThoai_Participants UNIQUE (MaPhieuTN, MaTaiKhoanKhach, MaTaiKhoanNV),
        FOREIGN KEY (MaPhieuTN) REFERENCES PhieuTiepNhan(MaPhieuTN),
        FOREIGN KEY (MaTaiKhoanKhach) REFERENCES TaiKhoan(MaTaiKhoan),
        FOREIGN KEY (MaTaiKhoanNV) REFERENCES TaiKhoan(MaTaiKhoan),
        CONSTRAINT CK_HoiThoai_Participants CHECK (MaTaiKhoanKhach <> MaTaiKhoanNV),
        CONSTRAINT CK_HoiThoai_Read CHECK (KhachDaDocDen >= 0 AND NVDaDocDen >= 0),
        INDEX IX_HoiThoai_Khach (MaTaiKhoanKhach, NgayCapNhat),
        INDEX IX_HoiThoai_NV (MaTaiKhoanNV, NgayCapNhat)
    );
END;
GO
IF OBJECT_ID(N'dbo.TinNhan', N'U') IS NULL
BEGIN
    CREATE TABLE TinNhan (
        MaTinNhan    BIGINT IDENTITY(1,1) PRIMARY KEY,
        MaHoiThoai   BIGINT NOT NULL,
        MaNguoiGui   BIGINT NOT NULL,
        MaYeuCau     UNIQUEIDENTIFIER NOT NULL,
        NoiDung      NVARCHAR(2000) NOT NULL,
        NgayTao      DATETIME2(0) NOT NULL,
        CONSTRAINT UX_TinNhan_Retry UNIQUE (MaHoiThoai, MaYeuCau),
        FOREIGN KEY (MaHoiThoai) REFERENCES HoiThoai(MaHoiThoai),
        FOREIGN KEY (MaNguoiGui) REFERENCES TaiKhoan(MaTaiKhoan),
        CONSTRAINT CK_TinNhan_Text CHECK (LEN(LTRIM(RTRIM(NoiDung))) > 0),
        INDEX IX_TinNhan_HoiThoai (MaHoiThoai, MaTinNhan) INCLUDE (MaNguoiGui)
    );
END;
GO
COMMIT;
GO
