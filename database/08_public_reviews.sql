-- Admin chọn nhận xét thật để công khai. Không tự công khai đánh giá cũ.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO
IF OBJECT_ID(N'dbo.DanhGiaCongKhai', N'U') IS NULL
BEGIN
    CREATE TABLE DanhGiaCongKhai (
        MaPhieuTN NVARCHAR(30) PRIMARY KEY REFERENCES PhieuBanGiao(MaPhieuTN),
        MaCongKhai UNIQUEIDENTIFIER NOT NULL UNIQUE,
        SoSao INT NOT NULL CHECK (SoSao BETWEEN 1 AND 5),
        NoiDung NVARCHAR(1000) NULL,
        NgayDanhGia DATETIME2(0) NOT NULL,
        MaNguoiDuyet BIGINT NOT NULL REFERENCES TaiKhoan(MaTaiKhoan),
        NgayDuyet DATETIME2(0) NOT NULL
    );
END;
GO
COMMIT;
GO
