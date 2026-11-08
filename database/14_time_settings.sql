-- Thêm bảng CauHinhThoiGian để quản trị viên chỉnh SLA, ngưỡng sắp trễ, hạn báo giá và giờ làm việc.
-- Chỉ tạo bảng, không sửa dữ liệu khác. Chạy được nhiều lần. Chưa chạy thì ứng dụng dùng giá trị mặc định
-- (SLA Tiêu chuẩn 48h) nhưng không lưu được cấu hình.
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
-- Cấu hình thời gian do quản trị viên chỉnh (một dòng Id = 1). Không có dòng thì ứng dụng dùng mặc định:
-- SLA 12/24/48 giờ, mặc định Tiêu chuẩn 48h, sắp trễ 120 phút, báo giá 72 giờ, thứ Hai–thứ Bảy 08:00–17:00.
IF OBJECT_ID(N'dbo.CauHinhThoiGian', N'U') IS NULL
BEGIN
    CREATE TABLE CauHinhThoiGian (
        Id               TINYINT       NOT NULL PRIMARY KEY CONSTRAINT CK_CHTG_MotDong CHECK (Id = 1),
        SlaNhanhGio      INT           NOT NULL,
        SlaUuTienGio     INT           NOT NULL,
        SlaTieuChuanGio  INT           NOT NULL,
        MucSlaMacDinh    NVARCHAR(20)  NOT NULL,
        NguongSapTrePhut INT           NOT NULL,
        HanBaoGiaGio     INT           NOT NULL,
        PhutMoCua        INT           NOT NULL,
        PhutDongCua      INT           NOT NULL,
        NgayLamViec      NVARCHAR(20)  NOT NULL,
        NguoiCapNhat     NVARCHAR(30)  NULL,
        NgayCapNhat      DATETIME2(0)  NULL,
        CONSTRAINT CK_CHTG_Sla CHECK (SlaNhanhGio BETWEEN 1 AND 720 AND SlaUuTienGio BETWEEN 1 AND 720 AND SlaTieuChuanGio BETWEEN 1 AND 720
            AND SlaNhanhGio <= SlaUuTienGio AND SlaUuTienGio <= SlaTieuChuanGio),
        CONSTRAINT CK_CHTG_MucSla CHECK (MucSlaMacDinh IN ('EXPRESS_12H', 'PRIORITY_24H', 'STANDARD_48H')),
        CONSTRAINT CK_CHTG_SapTre CHECK (NguongSapTrePhut BETWEEN 1 AND 1440),
        CONSTRAINT CK_CHTG_BaoGia CHECK (HanBaoGiaGio BETWEEN 1 AND 720),
        CONSTRAINT CK_CHTG_Gio CHECK (PhutMoCua BETWEEN 0 AND 1439 AND PhutDongCua BETWEEN 0 AND 1439 AND PhutMoCua < PhutDongCua),
        CONSTRAINT CK_CHTG_Ngay CHECK (NgayLamViec <> '' AND NgayLamViec NOT LIKE '%[^1-7,]%')
    );
END;
GO
