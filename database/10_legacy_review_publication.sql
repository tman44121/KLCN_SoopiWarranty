-- Allow admin approval of stored handover scores without inventing a review date.
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.DanhGiaCongKhai', N'U') IS NULL
    THROW 50001, N'Run 08_public_reviews.sql before this upgrade.', 1;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.DanhGiaCongKhai')
    AND name = N'NgayDanhGia' AND is_nullable = 0)
    ALTER TABLE dbo.DanhGiaCongKhai ALTER COLUMN NgayDanhGia DATETIME2(0) NULL;
COMMIT;
