-- Optional homepage examples. Never insert sample feedback into customer handovers or approvals.
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO
IF OBJECT_ID(N'dbo.DanhGiaMinhHoa', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DanhGiaMinhHoa (
        MaMinhHoa UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SoSao INT NOT NULL CHECK (SoSao BETWEEN 1 AND 5),
        NoiDung NVARCHAR(1000) NOT NULL,
        NgayMinhHoa DATE NOT NULL
    );
END;
GO
INSERT INTO dbo.DanhGiaMinhHoa (MaMinhHoa, SoSao, NoiDung, NgayMinhHoa)
SELECT s.MaMinhHoa, s.SoSao, s.NoiDung, s.NgayMinhHoa
FROM (VALUES
    (CONVERT(UNIQUEIDENTIFIER, 'da7a0000-0000-4000-8000-000000000001'), 5,
     N'Laptop bị tắt nguồn đột ngột, kỹ thuật viên kiểm tra và giải thích rõ nguyên nhân trước khi sửa. Nhận lại máy đúng hẹn, dùng vài ngày thấy ổn định.', CONVERT(DATE, '20261030')),
    (CONVERT(UNIQUEIDENTIFIER, 'da7a0000-0000-4000-8000-000000000002'), 4,
     N'Thay pin điện thoại có báo giá trước, chi phí khi thanh toán đúng như đã xác nhận. Nhân viên hướng dẫn kiểm tra máy khá kỹ lúc nhận lại.', CONVERT(DATE, '20261029')),
    (CONVERT(UNIQUEIDENTIFIER, 'da7a0000-0000-4000-8000-000000000003'), 5,
     N'Tôi gửi yêu cầu trên web trước khi mang máy tới nên tiếp nhận nhanh. Tra cứu được tiến độ sửa và không phải gọi điện hỏi nhiều lần.', CONVERT(DATE, '20261028')),
    (CONVERT(UNIQUEIDENTIFIER, 'da7a0000-0000-4000-8000-000000000004'), 3,
     N'Máy đã sửa được lỗi sạc nhưng phải chờ linh kiện lâu hơn dự kiến hai ngày. Mong trung tâm chủ động báo sớm hơn khi thay đổi lịch trả máy.', CONVERT(DATE, '20261027')),
    (CONVERT(UNIQUEIDENTIFIER, 'da7a0000-0000-4000-8000-000000000005'), 4,
     N'Kỹ thuật viên tư vấn phương án sửa phù hợp, giải thích rõ phần được bảo hành và phần có phí. Máy được vệ sinh sạch sẽ trước khi bàn giao.', CONVERT(DATE, '20261026')),
    (CONVERT(UNIQUEIDENTIFIER, 'da7a0000-0000-4000-8000-000000000006'), 2,
     N'Lần đầu nhận lại máy vẫn còn lỗi kết nối, phải mang đến kiểm tra thêm một lần. Nhân viên hỗ trợ lịch sự nhưng khâu kiểm tra cuối cần kỹ hơn.', CONVERT(DATE, '20261025'))
) s (MaMinhHoa, SoSao, NoiDung, NgayMinhHoa)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.DanhGiaMinhHoa d WITH (UPDLOCK, HOLDLOCK) WHERE d.MaMinhHoa = s.MaMinhHoa
);
GO
COMMIT;
GO
