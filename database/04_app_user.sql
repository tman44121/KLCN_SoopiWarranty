-- ============================================================================
-- Tài khoản ứng dụng (D-080). Chạy bằng tài khoản QUẢN TRỊ trên database đích, sau 01_schema.sql.
-- Tên và mật khẩu lấy từ biến môi trường APP_USER, APP_PASSWORD (sqlcmd tự đọc biến môi trường; không dùng -v để
-- mật khẩu không nằm trong lịch sử shell/danh sách tiến trình; mật khẩu không chứa dấu '):
--   sqlcmd -S <server>.database.windows.net -d TrungTamBaoHanhDB -U <quản trị> -I -b -i db/sqlserver/04_app_user.sql
-- Chạy lại không đổi mật khẩu của user đã có (đổi bằng ALTER USER ... WITH PASSWORD).
-- DENY không áp dụng cho dbo/quản trị (khác trigger MySQL chặn mọi người): chỉnh nhật ký bằng tài khoản quản trị phải
-- theo quy trình đối soát riêng (D-080).
-- Azure SQL Database dùng contained user (người dùng thuộc database, không cần login ở master). SQL Server tự quản
-- không bật contained database thì thay bằng CREATE LOGIN ... rồi CREATE USER [...] FOR LOGIN [...].
-- Tài khoản ứng dụng chỉ đọc/ghi dữ liệu: không tạo/sửa/xóa bảng, không đổi quyền.
-- ============================================================================
SET NOCOUNT ON;
GO

IF DATABASE_PRINCIPAL_ID('warranty_app_role') IS NULL CREATE ROLE warranty_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO warranty_app_role;
-- Nhật ký thao tác chỉ ghi thêm (thay trigger trg_NhatKy_ChanSua / trg_NhatKy_ChanXoa của bản MySQL).
DENY UPDATE, DELETE ON dbo.NhatKyThaoTac TO warranty_app_role;
GO

IF DATABASE_PRINCIPAL_ID(N'$(APP_USER)') IS NULL
    CREATE USER [$(APP_USER)] WITH PASSWORD = N'$(APP_PASSWORD)';
ALTER ROLE warranty_app_role ADD MEMBER [$(APP_USER)];
GO
