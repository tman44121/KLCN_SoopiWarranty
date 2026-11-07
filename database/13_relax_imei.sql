-- Chỉ cập nhật ràng buộc định dạng IMEI; không sửa/xóa dữ liệu.
-- Chạy thủ công trên database đã được chủ dự án cho phép.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.ThietBi', N'U') IS NULL
    THROW 50000, N'Không tìm thấy bảng dbo.ThietBi.', 1;

ALTER TABLE dbo.ThietBi DROP CONSTRAINT CK_ThietBi_IMEI;
ALTER TABLE dbo.ThietBi WITH CHECK ADD CONSTRAINT CK_ThietBi_IMEI
    CHECK (LoaiDinhDanh <> 'IMEI' OR
        (LEN(SoSerial_IMEI) BETWEEN 4 AND 50
         AND SoSerial_IMEI COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^A-Za-z0-9-]%'));

COMMIT TRANSACTION;
