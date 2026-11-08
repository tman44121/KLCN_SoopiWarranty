-- Cấu hình khóa đăng nhập, chống spam, OTP và hạn phiên. Chạy sau 14_time_settings.sql.
-- Chỉ thêm cột cấu hình; không đổi tài khoản, mật khẩu, phiên hoặc phiếu hiện có.
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF OBJECT_ID(N'dbo.CauHinhThoiGian', N'U') IS NULL
    THROW 50000, N'Cần chạy 14_time_settings.sql trước.', 1;
IF COL_LENGTH('dbo.CauHinhThoiGian', 'CauHinhBaoVe') IS NULL
BEGIN
    ALTER TABLE dbo.CauHinhThoiGian ADD CauHinhBaoVe NVARCHAR(MAX) NULL
        CONSTRAINT CK_CHTG_BaoVe CHECK (CauHinhBaoVe IS NULL OR ISJSON(CauHinhBaoVe) = 1);
END;
GO
