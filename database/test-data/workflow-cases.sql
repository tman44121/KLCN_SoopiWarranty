-- Synthetic LOCAL fixtures. Run only after 02 + 03 + generated bulk data.
-- No reviews are approved for publication by this seed.
SET NOCOUNT ON; SET XACT_ABORT ON; SET QUOTED_IDENTIFIER ON;
IF DB_NAME() NOT IN (N'TrungTamBaoHanhDB_Dev',N'TrungTamBaoHanhDB_KiemThu') AND DB_NAME() NOT LIKE N'SoopiSeed[_]%'
    THROW 50000,N'Workflow fixtures are restricted to local test databases.',1;
DECLARE @now datetime2(0)=CONVERT(datetime2(0),SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time');
DECLARE @cases table (CaseCode nvarchar(50) PRIMARY KEY, Code nvarchar(50), Account nvarchar(100), Action nvarchar(250), Expected nvarchar(500));

-- Keep actionable quotes valid. Preserve one expired quote for the negative test.
UPDATE q SET HanHieuLuc=DATEADD(day,14,CONVERT(date,@now)) FROM PhieuBaoGia q
JOIN PhieuTiepNhan p ON p.MaPhieuTN=q.MaPhieuTN WHERE p.ConMo=1 AND q.TrangThaiDuyetNoiBo<>'REJECTED';
DECLARE @expired nvarchar(30)=(SELECT TOP 1 q.MaBaoGia FROM PhieuBaoGia q JOIN PhieuTiepNhan p ON p.MaPhieuTN=q.MaPhieuTN
 WHERE p.TrangThaiXuLy='AWAITING_CUSTOMER_CONFIRMATION' AND q.KhachXacNhan='PENDING' AND q.TrangThaiDuyetNoiBo='APPROVED' ORDER BY q.NgayLapBaoGia);
IF @expired IS NULL THROW 50000,N'Missing expired-quote fixture.',1;
UPDATE PhieuBaoGia SET HanHieuLuc=DATEADD(day,-1,CONVERT(date,@now)) WHERE MaBaoGia=@expired;
INSERT @cases VALUES(N'QUOTE_EXPIRED',@expired,N'letan',N'Xác nhận đồng ý báo giá tại quầy',N'422 QUOTE_EXPIRED; không thay đổi phiếu');

-- Isolate shortage SKUs so one scenario cannot corrupt the other stock fixtures.
DECLARE @zeroIssue nvarchar(30),@zeroTicket nvarchar(30),@zeroQuote nvarchar(30),@originalSku nvarchar(30);
SELECT TOP 1 @zeroIssue=x.MaPhieuXuat,@zeroTicket=x.MaPhieuTN,@zeroQuote=x.MaBaoGia
FROM PhieuXuatKho x JOIN PhieuTiepNhan p ON p.MaPhieuTN=x.MaPhieuTN
WHERE x.TrangThai='PENDING' AND x.NguonXuat='QUOTATION' AND p.TrangThaiXuLy='AWAITING_PARTS'
AND (SELECT COUNT(*) FROM ChiTietXuatKho c WHERE c.MaPhieuXuat=x.MaPhieuXuat)=1 ORDER BY x.NgayYeuCau DESC;
IF @zeroIssue IS NULL THROW 50000,N'Missing stock shortage fixture.',1;
SELECT @originalSku=MaLK FROM ChiTietXuatKho WHERE MaPhieuXuat=@zeroIssue;
INSERT LinhKien(MaLK,TenLK,DonViTinh,MaNhom,TenHang,DonGiaVon,DonGiaDichVu,SoLuongTon,SoLuongDaGiu,DinhMucTonToiThieu,KeChinh,ThoiHanBaoHanhThang,MaNCC,HoatDong,PhienBan)
SELECT N'LK-TEST-ZERO',TenLK+N' (kiểm thử hết hàng)',DonViTinh,MaNhom,TenHang,DonGiaVon,DonGiaDichVu,0,0,5,KeChinh,ThoiHanBaoHanhThang,MaNCC,1,0 FROM LinhKien WHERE MaLK=@originalSku;
INSERT TonKhoTheoKe SELECT N'LK-TEST-ZERO',KeChinh,0 FROM LinhKien WHERE MaLK=N'LK-TEST-ZERO';
UPDATE l SET SoLuongDaGiu=SoLuongDaGiu-c.SoLuongXuat FROM LinhKien l JOIN ChiTietXuatKho c ON c.MaLK=l.MaLK WHERE c.MaPhieuXuat=@zeroIssue;
UPDATE ChiTietBaoGia SET MaLK=N'LK-TEST-ZERO' WHERE MaBaoGia=@zeroQuote AND MaLK=@originalSku;
DELETE ChiTietXuatKho WHERE MaPhieuXuat=@zeroIssue;
DELETE PhieuXuatKho WHERE MaPhieuXuat=@zeroIssue;
INSERT @cases SELECT N'STOCK_ZERO',@zeroTicket,a.TenDangNhap,N'Gửi yêu cầu linh kiện theo báo giá',N'409 STOCK_INSUFFICIENT; không tạo phiếu xuất, không giữ hàng'
FROM PhanCong pc JOIN NhanVien n ON n.MaNV=pc.MaKTV JOIN TaiKhoan a ON a.MaTaiKhoan=n.MaTaiKhoan WHERE pc.MaPhieuTN=@zeroTicket;

DECLARE @binIssue nvarchar(30),@binTicket nvarchar(30),@binSku nvarchar(30),@qty int;
SELECT TOP 1 @binIssue=x.MaPhieuXuat,@binTicket=x.MaPhieuTN FROM PhieuXuatKho x
WHERE x.TrangThai='PENDING' AND (SELECT COUNT(*) FROM ChiTietXuatKho c WHERE c.MaPhieuXuat=x.MaPhieuXuat)=1 ORDER BY x.NgayYeuCau DESC;
IF @binIssue IS NULL THROW 50000,N'Missing bin shortage fixture.',1;
SELECT @binSku=MaLK,@qty=SoLuongXuat FROM ChiTietXuatKho WHERE MaPhieuXuat=@binIssue;
INSERT LinhKien(MaLK,TenLK,DonViTinh,MaNhom,TenHang,DonGiaVon,DonGiaDichVu,SoLuongTon,SoLuongDaGiu,DinhMucTonToiThieu,KeChinh,ThoiHanBaoHanhThang,MaNCC,HoatDong,PhienBan)
SELECT N'LK-TEST-BIN',TenLK+N' (kiểm thử kệ trống)',DonViTinh,MaNhom,TenHang,DonGiaVon,DonGiaDichVu,@qty+5,@qty,5,N'KHO-Z-01-01',ThoiHanBaoHanhThang,MaNCC,1,0 FROM LinhKien WHERE MaLK=@binSku;
INSERT TonKhoTheoKe VALUES(N'LK-TEST-BIN',N'KHO-Z-01-01',0),(N'LK-TEST-BIN',N'KHO-Z-01-02',@qty+5);
UPDATE LinhKien SET SoLuongDaGiu=SoLuongDaGiu-@qty WHERE MaLK=@binSku;
UPDATE ChiTietBaoGia SET MaLK=N'LK-TEST-BIN' WHERE MaBaoGia=(SELECT MaBaoGia FROM PhieuXuatKho WHERE MaPhieuXuat=@binIssue) AND MaLK=@binSku;
UPDATE ChiTietXuatKho SET MaLK=N'LK-TEST-BIN',MaKe=N'KHO-Z-01-01' WHERE MaPhieuXuat=@binIssue;
INSERT @cases VALUES(N'STOCK_BIN_EMPTY',@binIssue,N'khovattu',N'Gửi duyệt API với kệ KHO-Z-01-01',N'409 STOCK_BIN_INSUFFICIENT; phiếu vẫn PENDING. Trên giao diện chỉ chọn được kệ còn hàng KHO-Z-01-02');

-- A failed QC remains in REPAIRING so the technician can repair and submit again.
DECLARE @qcTicket nvarchar(30),@repair nvarchar(30),@tech nvarchar(20);
SELECT TOP 1 @qcTicket=p.MaPhieuTN,@repair=s.MaPhieuSC,@tech=s.MaKTV FROM PhieuTiepNhan p JOIN PhieuSuaChua s ON s.MaPhieuTN=p.MaPhieuTN
WHERE p.TrangThaiXuLy='REPAIRING' ORDER BY p.NgayTiepNhan DESC;
IF @qcTicket IS NULL THROW 50000,N'Missing QC retry fixture.',1;
INSERT KetQuaSuaChua(MaKetQua,MaPhieuSC,MaKTV,NoiDungSuaChua,KetQuaQCTungBuoc,KetQuaKCS,ChiTietTestKCS,NgayGhiNhan)
VALUES(N'KQ-TEST-QCFAIL',@repair,@tech,N'Đã sửa lần đầu, cần xử lý lại bước kiểm tra cuối.',
N'[{"Buoc":"VISUAL","KetQua":"PASS"},{"Buoc":"MAIN_FUNCTION","KetQua":"PASS"},{"Buoc":"SECONDARY","KetQua":"PASS"},{"Buoc":"POWER_CHARGING","KetQua":"PASS"},{"Buoc":"DATA","KetQua":"PASS"},{"Buoc":"FINAL","KetQua":"FAIL"}]',N'FAIL',N'Ca kiểm thử QC chưa đạt, không được bàn giao.',@now);
INSERT @cases SELECT N'QC_RETRY',@qcTicket,a.TenDangNhap,N'Sửa lại và gửi đủ 6 bước QC đạt',N'Chuyển COMPLETED sau QC PASS; chưa đạt thì vẫn REPAIRING' FROM NhanVien n JOIN TaiKhoan a ON a.MaTaiKhoan=n.MaTaiKhoan WHERE n.MaNV=@tech;

-- One fixture for every supported ticket state; technician credentials match the actual assignment.
INSERT @cases
SELECT N'STATE_'+s.Status,t.MaPhieuTN,COALESCE(t.Login,N'letan'),s.Action,s.Expected
FROM (VALUES
 (N'RECEIVED',N'Phân công kỹ thuật viên',N'Điều phối: chuyển INSPECTING'),
 (N'INSPECTING',N'Lưu chẩn đoán đủ checklist',N'Chuyển DIAGNOSED'),
 (N'DIAGNOSED',N'Chọn bước tiếp theo theo phân loại',N'Miễn phí: sửa/yêu cầu linh kiện; tính phí: lập báo giá'),
 (N'AWAITING_QUOTE_APPROVAL',N'Duyệt hoặc yêu cầu sửa báo giá',N'Điều phối: chờ khách xác nhận hoặc về DIAGNOSED'),
 (N'AWAITING_CUSTOMER_CONFIRMATION',N'Khách đồng ý hoặc từ chối tại quầy',N'Đồng ý: chờ linh kiện/sửa; từ chối: chờ trả máy'),
 (N'AWAITING_PARTS',N'Kho duyệt phiếu xuất đang chờ',N'Đủ tồn và kệ: ISSUED, chuyển REPAIRING'),
 (N'REPAIRING',N'Ghi kết quả sửa và 6 bước QC',N'QC PASS chuyển COMPLETED; QC FAIL tiếp tục sửa'),
 (N'COMPLETED',N'Thu ngân kiểm tra tiền và bàn giao',N'Chưa thanh toán phải thu/xác nhận miễn phí trước'),
 (N'DELIVERED',N'Xem lịch sử, phiếu thu và bàn giao',N'Phiếu đóng; không sửa lại lịch sử'),
 (N'AWAITING_RETURN',N'Trả thiết bị không sửa',N'RETURNED_UNREPAIRED; không thu tiền sửa'),
 (N'RETURNED_UNREPAIRED',N'Tra lịch sử trả máy',N'Phiếu đóng, trả nguyên trạng')
) s(Status,Action,Expected)
OUTER APPLY (SELECT TOP 1 p.MaPhieuTN,a.TenDangNhap Login FROM PhieuTiepNhan p LEFT JOIN PhanCong pc ON pc.MaPhieuTN=p.MaPhieuTN
 LEFT JOIN NhanVien n ON n.MaNV=pc.MaKTV LEFT JOIN TaiKhoan a ON a.MaTaiKhoan=n.MaTaiKhoan
 WHERE p.TrangThaiXuLy=s.Status AND p.MaPhieuTN NOT IN (@zeroTicket,@binTicket,@qcTicket)
 AND NOT EXISTS(SELECT 1 FROM PhieuBaoGia q WHERE q.MaPhieuTN=p.MaPhieuTN AND q.MaBaoGia=@expired)
 ORDER BY p.NgayTiepNhan DESC,p.MaPhieuTN DESC) t;
IF EXISTS(SELECT 1 FROM @cases WHERE Code IS NULL) THROW 50000,N'Seed does not cover every ticket state. Original data was not replaced.',1;
UPDATE @cases SET Account=N'dieuphoi' WHERE CaseCode IN (N'STATE_RECEIVED',N'STATE_AWAITING_QUOTE_APPROVAL');
UPDATE @cases SET Account=N'letan' WHERE CaseCode=N'STATE_AWAITING_CUSTOMER_CONFIRMATION';
UPDATE @cases SET Account=N'khovattu' WHERE CaseCode=N'STATE_AWAITING_PARTS';
UPDATE @cases SET Account=N'thungan.nhu' WHERE CaseCode IN(N'STATE_COMPLETED',N'STATE_AWAITING_RETURN');

INSERT @cases SELECT TOP 1 N'FREE_WARRANTY',p.MaPhieuTN,a.TenDangNhap,N'Bắt đầu sửa miễn phí, không cần báo giá',N'REPAIRING; thu ngân xác nhận miễn phí'
FROM PhieuTiepNhan p JOIN PhieuKiemTra k ON k.MaPhieuTN=p.MaPhieuTN JOIN PhanCong pc ON pc.MaPhieuTN=p.MaPhieuTN
JOIN NhanVien n ON n.MaNV=pc.MaKTV JOIN TaiKhoan a ON a.MaTaiKhoan=n.MaTaiKhoan
WHERE p.TrangThaiXuLy='DIAGNOSED' AND k.PhanLoaiBaoHanh='FREE_WARRANTY' ORDER BY p.NgayTiepNhan DESC;
INSERT @cases SELECT TOP 1 N'CHARGEABLE',p.MaPhieuTN,a.TenDangNhap,N'Lập báo giá tính phí',N'AWAITING_QUOTE_APPROVAL; khách phải xác nhận trước sửa'
FROM PhieuTiepNhan p JOIN PhieuKiemTra k ON k.MaPhieuTN=p.MaPhieuTN JOIN PhanCong pc ON pc.MaPhieuTN=p.MaPhieuTN
JOIN NhanVien n ON n.MaNV=pc.MaKTV JOIN TaiKhoan a ON a.MaTaiKhoan=n.MaTaiKhoan
WHERE p.TrangThaiXuLy='DIAGNOSED' AND k.PhanLoaiBaoHanh='OUT_OF_WARRANTY' ORDER BY p.NgayTiepNhan DESC;

INSERT @cases SELECT TOP 1 N'QUOTE_REJECTED',MaBaoGia,N'dieuphoi',N'Tìm báo giá trạng thái từ chối',N'Xem chi tiết; không hiện nút duyệt lần nữa' FROM PhieuBaoGia WHERE TrangThaiDuyetNoiBo='REJECTED' ORDER BY NgayLapBaoGia DESC;
INSERT @cases SELECT TOP 1 N'QUOTE_LABOR_ONLY',MaBaoGia,N'dieuphoi',N'Tra báo giá chỉ có tiền công',N'Khách đồng ý có thể sửa không cần xuất linh kiện' FROM PhieuBaoGia q WHERE NOT EXISTS(SELECT 1 FROM ChiTietBaoGia c WHERE c.MaBaoGia=q.MaBaoGia AND c.MaLK IS NOT NULL);
INSERT @cases SELECT TOP 1 N'PAYMENT_UNPAID',p.MaPhieuTN,N'thungan.nhu',N'Bàn giao trước khi thu tiền',N'Bị chặn HANDOVER_UNPAID; thu đúng tiền hoặc xác nhận miễn phí'
FROM PhieuTiepNhan p WHERE p.TrangThaiXuLy='COMPLETED' AND NOT EXISTS(SELECT 1 FROM HoaDon_PhieuThu h WHERE h.MaPhieuTN=p.MaPhieuTN);
INSERT @cases SELECT TOP 1 N'PAYMENT_PAID',p.MaPhieuTN,N'thungan.nhu',N'Bàn giao sau khi kiểm tra và ký nhận',N'DELIVERED; thu trùng bị chặn PAYMENT_ALREADY_EXISTS'
FROM PhieuTiepNhan p WHERE p.TrangThaiXuLy='COMPLETED' AND EXISTS(SELECT 1 FROM HoaDon_PhieuThu h WHERE h.MaPhieuTN=p.MaPhieuTN);
INSERT @cases SELECT TOP 1 N'QC_HISTORY',s.MaPhieuTN,N'letan',N'Xem lịch sử QC trượt rồi đạt',N'Giữ cả hai lần kiểm tra'
FROM PhieuSuaChua s WHERE EXISTS(SELECT 1 FROM KetQuaSuaChua k WHERE k.MaPhieuSC=s.MaPhieuSC AND k.KetQuaKCS='FAIL')
AND EXISTS(SELECT 1 FROM KetQuaSuaChua k WHERE k.MaPhieuSC=s.MaPhieuSC AND k.KetQuaKCS='PASS');
INSERT @cases SELECT TOP 1 N'REQUEST_PENDING',MaYeuCau,N'letan',N'Tiếp nhận yêu cầu online',N'CONVERTED, liên kết mã phiếu tiếp nhận' FROM YeuCauBaoHanh WHERE TrangThai='PENDING_INTAKE';
INSERT @cases SELECT TOP 1 N'REQUEST_CANCELLED',MaYeuCau,N'letan',N'Tra yêu cầu đã hủy',N'Hiện lý do hủy, không được tiếp nhận lại' FROM YeuCauBaoHanh WHERE TrangThai='CANCELLED';
INSERT @cases SELECT TOP 1 N'RECEIPT_APPROVE',MaPhieuNhap,N'khovattu',N'Duyệt phiếu nhập',N'Tăng tồn thực tế và đúng kệ; duyệt lại bị chặn' FROM PhieuNhapKho WHERE TrangThai='PENDING';
INSERT @cases SELECT TOP 1 N'TRANSFER_APPROVE',MaPhieuDC,N'khovattu',N'Duyệt điều chuyển kệ',N'Chuyển số lượng giữa kệ, tổng tồn không đổi' FROM PhieuDieuChuyen WHERE TrangThai='PENDING';
INSERT @cases VALUES(N'LOGIN_LOCKED',N'kythuat_khoa',N'kythuat_khoa',N'Đăng nhập tài khoản bị khóa',N'403 AUTH_ACCOUNT_LOCKED');
INSERT @cases SELECT TOP 1 N'CUSTOMER_PORTAL',k.MaKH,a.TenDangNhap,N'Đăng nhập khách và xem lịch sử',N'Chỉ thấy phiếu của chính mình, có ngày/trạng thái/mã để lọc'
FROM KhachHang k JOIN TaiKhoan a ON a.MaTaiKhoan=k.MaTaiKhoan WHERE a.TrangThai='ACTIVE' AND EXISTS(SELECT 1 FROM PhieuTiepNhan p WHERE p.MaKH=k.MaKH) ORDER BY k.MaKH;

-- Three valid SLA situations. Shift the selected ticket's complete timeline together, not just its badge.
DECLARE @sla table (Code nvarchar(30), HoursAgo int, CaseCode nvarchar(50));
INSERT @sla SELECT TOP 1 MaPhieuTN,1,N'SLA_ON_TRACK' FROM PhieuTiepNhan WHERE TrangThaiXuLy='RECEIVED' ORDER BY NgayTiepNhan DESC;
INSERT @sla SELECT TOP 1 MaPhieuTN,47,N'SLA_AT_RISK' FROM PhieuTiepNhan WHERE TrangThaiXuLy='RECEIVED' AND MaPhieuTN NOT IN(SELECT Code FROM @sla) ORDER BY NgayTiepNhan DESC;
INSERT @sla SELECT TOP 1 MaPhieuTN,50,N'SLA_BREACHED' FROM PhieuTiepNhan WHERE TrangThaiXuLy='RECEIVED' AND MaPhieuTN NOT IN(SELECT Code FROM @sla) ORDER BY NgayTiepNhan DESC;
UPDATE h SET ThoiGianCapNhat=DATEADD(hour,-s.HoursAgo,@now) FROM LichSuTrangThai_ThietBi h JOIN @sla s ON s.Code=h.MaPhieuTN;
UPDATE p SET NgayTiepNhan=DATEADD(hour,-s.HoursAgo,@now),NgayCapNhatTrangThai=DATEADD(hour,-s.HoursAgo,@now),MucSLA='STANDARD_48H',HanSLA=DATEADD(hour,48-s.HoursAgo,@now)
FROM PhieuTiepNhan p JOIN @sla s ON s.Code=p.MaPhieuTN;
INSERT @cases SELECT CaseCode,Code,N'dieuphoi',N'Lọc/xếp theo hạn SLA',N'Đúng hẹn, sắp trễ hoặc đã trễ tương ứng' FROM @sla;

-- Make every pending customer appointment usable now and within office hours.
DECLARE @next date=DATEADD(day,1,CONVERT(date,@now));
IF DATEDIFF(day,'19000101',@next)%7=6 SET @next=DATEADD(day,1,@next);
UPDATE YeuCauBaoHanh SET ThoiGianMongMuonTu=DATEADD(hour,9,CONVERT(datetime2,@next)),ThoiGianMongMuonDen=DATEADD(hour,10,CONVERT(datetime2,@next)) WHERE TrangThai='PENDING_INTAKE';
-- A reserved issue may still be approved when available stock is zero: its units are already held.
DECLARE @reservedIssue nvarchar(30),@reservedSku nvarchar(30),@reservedQty int;
SELECT TOP 1 @reservedIssue=x.MaPhieuXuat FROM PhieuXuatKho x WHERE x.TrangThai='PENDING' AND x.MaPhieuXuat<>@binIssue
AND (SELECT COUNT(*) FROM ChiTietXuatKho c WHERE c.MaPhieuXuat=x.MaPhieuXuat)=1 ORDER BY x.NgayYeuCau DESC;
SELECT @reservedSku=MaLK,@reservedQty=SoLuongXuat FROM ChiTietXuatKho WHERE MaPhieuXuat=@reservedIssue;
IF @reservedIssue IS NULL THROW 50000,N'Missing fully reserved issue.',1;
INSERT LinhKien(MaLK,TenLK,DonViTinh,MaNhom,TenHang,DonGiaVon,DonGiaDichVu,SoLuongTon,SoLuongDaGiu,DinhMucTonToiThieu,KeChinh,ThoiHanBaoHanhThang,MaNCC,HoatDong,PhienBan)
SELECT N'LK-TEST-HELD',TenLK+N' (đã giữ hết)',DonViTinh,MaNhom,TenHang,DonGiaVon,DonGiaDichVu,@reservedQty,@reservedQty,5,KeChinh,ThoiHanBaoHanhThang,MaNCC,1,0 FROM LinhKien WHERE MaLK=@reservedSku;
INSERT TonKhoTheoKe SELECT N'LK-TEST-HELD',KeChinh,@reservedQty FROM LinhKien WHERE MaLK=N'LK-TEST-HELD';
UPDATE LinhKien SET SoLuongDaGiu=SoLuongDaGiu-@reservedQty WHERE MaLK=@reservedSku;
UPDATE ChiTietBaoGia SET MaLK=N'LK-TEST-HELD' WHERE MaBaoGia=(SELECT MaBaoGia FROM PhieuXuatKho WHERE MaPhieuXuat=@reservedIssue) AND MaLK=@reservedSku;
UPDATE ChiTietXuatKho SET MaLK=N'LK-TEST-HELD' WHERE MaPhieuXuat=@reservedIssue;
INSERT @cases VALUES(N'STOCK_RESERVED_FULL',@reservedIssue,N'khovattu',N'Duyệt phiếu đã giữ hết số hàng',N'Vẫn xuất được: tồn thực tế đủ và hàng đã giữ cho phiếu; tồn khả dụng 0 không đồng nghĩa hết hàng');

INSERT @cases SELECT TOP 1 N'WARRANTY_EXPIRED',p.MaPhieuTN,a.TenDangNhap,N'Chẩn đoán chọn bảo hành miễn phí',N'Bị chặn WARRANTY_EXPIRED_CANNOT_BE_FREE'
FROM PhieuTiepNhan p JOIN PhanCong pc ON pc.MaPhieuTN=p.MaPhieuTN JOIN NhanVien n ON n.MaNV=pc.MaKTV JOIN TaiKhoan a ON a.MaTaiKhoan=n.MaTaiKhoan WHERE p.TrangThaiXuLy='INSPECTING' AND p.BH_TrangThaiLucNhan='OUT_OF_WARRANTY';
INSERT @cases SELECT TOP 1 N'WATER_DAMAGE',p.MaPhieuTN,a.TenDangNhap,N'Chọn vào nước và miễn phí',N'Bị chặn WATER_DAMAGE_CANNOT_BE_FREE'
FROM PhieuTiepNhan p JOIN PhanCong pc ON pc.MaPhieuTN=p.MaPhieuTN JOIN NhanVien n ON n.MaNV=pc.MaKTV JOIN TaiKhoan a ON a.MaTaiKhoan=n.MaTaiKhoan WHERE p.TrangThaiXuLy='INSPECTING' AND p.BH_TrangThaiLucNhan='IN_WARRANTY';
INSERT @cases SELECT N'RECLASS_NOTE',Code,Account,N'Đổi phân loại không nhập lý do',N'Bị chặn RECLASS_NOTE_REQUIRED' FROM @cases WHERE CaseCode=N'FREE_WARRANTY';
INSERT @cases SELECT TOP 1 N'STOCK_REJECT',MaPhieuXuat,N'khovattu',N'Từ chối yêu cầu xuất, nhập lý do',N'REJECTED; trả lại số đã giữ, tổng tồn không giảm' FROM PhieuXuatKho WHERE TrangThai='PENDING' AND MaPhieuXuat NOT IN(@binIssue,@reservedIssue);
INSERT PhieuNhapKho(MaPhieuNhap,MaNCC,SoLo,NgayNhap,MaNguoiLap,NgayLap,TrangThai,MaNguoiDuyet,NgayDuyet,LyDoTuChoi,TongTienNhap,GhiChu)
SELECT TOP 1 N'PN-TEST-REJECTED',MaNCC,N'TEST-REJECTED',CONVERT(date,@now),MaNguoiLap,@now,N'REJECTED',N'NV-003',@now,N'Lô kiểm thử không đạt chất lượng',TongTienNhap,N'Không tăng tồn' FROM PhieuNhapKho WHERE TrangThai='PENDING' ORDER BY MaPhieuNhap;
INSERT ChiTietNhapKho(MaPhieuNhap,MaLK,SoLuongNhap,DonGiaNhap,SerialLo,MaKe)
SELECT N'PN-TEST-REJECTED',c.MaLK,c.SoLuongNhap,c.DonGiaNhap,c.SerialLo,c.MaKe FROM ChiTietNhapKho c
WHERE c.MaPhieuNhap=(SELECT TOP 1 MaPhieuNhap FROM PhieuNhapKho WHERE TrangThai='PENDING' ORDER BY MaPhieuNhap);
-- Match the copied lines to their header (the source choice must be identical).
UPDATE PhieuNhapKho SET TongTienNhap=(SELECT SUM(SoLuongNhap*DonGiaNhap) FROM ChiTietNhapKho WHERE MaPhieuNhap=N'PN-TEST-REJECTED') WHERE MaPhieuNhap=N'PN-TEST-REJECTED';
INSERT @cases VALUES(N'RECEIPT_REJECTED',N'PN-TEST-REJECTED',N'khovattu',N'Lọc phiếu nhập bị từ chối',N'Giữ lý do từ chối; không thể duyệt lại');
INSERT PhieuDieuChuyen(MaPhieuDC,MaLK,SoLuong,TuKe,DenKe,LyDo,TrangThai,MaNguoiLap,NgayLap,MaNguoiDuyet,NgayDuyet,LyDoTuChoi)
SELECT TOP 1 N'DC-TEST-REJECTED',MaLK,SoLuong,TuKe,DenKe,N'Điều chuyển kiểm thử',N'REJECTED',MaNguoiLap,@now,N'NV-003',@now,N'Kệ đích đang bảo trì' FROM PhieuDieuChuyen;
INSERT @cases VALUES(N'TRANSFER_REJECTED',N'DC-TEST-REJECTED',N'khovattu',N'Lọc điều chuyển bị từ chối',N'Không thay đổi số lượng giữa kệ; không duyệt lại');
INSERT @cases SELECT N'PAYMENT_AMOUNT',Code,Account,N'Thu số tiền khác tổng báo giá',N'Bị chặn PAYMENT_AMOUNT_MISMATCH' FROM @cases WHERE CaseCode=N'PAYMENT_UNPAID';
INSERT @cases SELECT N'QC_INCONSISTENT',Code,Account,N'Gửi QC PASS nhưng một bước FAIL',N'Bị chặn REPAIR_QC_INCONSISTENT, không hoàn tất sửa' FROM @cases WHERE CaseCode=N'QC_RETRY';
INSERT @cases SELECT N'TECH_NOT_ASSIGNED',Code,CASE WHEN Account=N'kythuat' THEN N'ktv.phuc' ELSE N'kythuat' END,N'Kỹ thuật viên khác mở hoặc sửa phiếu này',N'Không được xem/sửa phiếu chưa được giao' FROM @cases WHERE CaseCode=N'QC_RETRY';
INSERT @cases SELECT TOP 1 N'REVIEW_APPROVAL',MaPhieuTN,N'admin',N'Duyệt hiện rồi ẩn điểm trên phiếu bàn giao',N'Chỉ hiện phần đánh giá khi có lựa chọn được duyệt; ẩn hết thì phần đánh giá biến mất' FROM PhieuBanGiao WHERE DanhGiaHaiLong IS NOT NULL;
INSERT @cases SELECT TOP 1 N'REQUEST_CONVERTED',MaYeuCau,N'letan',N'Lọc yêu cầu đã tiếp nhận',N'Hiện liên kết phiếu tiếp nhận, không tiếp nhận trùng' FROM YeuCauBaoHanh WHERE TrangThai='CONVERTED';

IF NOT EXISTS(SELECT 1 FROM TramDichVu WHERE MaTram=N'HN') INSERT TramDichVu VALUES(N'HN',N'Trạm Hà Nội (kiểm thử)',N'Địa chỉ trạm kiểm thử local',1);
INSERT TaiKhoan(TenDangNhap,MatKhauHash,LoaiChuThe,TrangThai,SoLanSaiLienTiep,BatBuocDoiMatKhau,PhienBanBaoMat,NgayTao)
SELECT N'ktv.hanoi',MatKhauHash,N'EMPLOYEE',N'ACTIVE',0,0,1,@now FROM TaiKhoan WHERE TenDangNhap=N'kythuat';
DECLARE @hnAccount bigint=SCOPE_IDENTITY();
INSERT TaiKhoan_VaiTro VALUES(@hnAccount,N'TECHNICIAN');
INSERT NhanVien(MaNV,HoTen,SDT,Email,ChuyenMon,KyNang,TrangThaiLamViec,SoPhieuToiDa,CoMatTaiTram,MaTram,MaTaiKhoan)
VALUES(N'NV-TEST-HN',N'Kỹ thuật viên Hà Nội',N'0998887771',N'ktv.hanoi@example.invalid',N'Kỹ thuật tổng hợp',N'["PHONE","LAPTOP_TABLET","TV_MONITOR","AUDIO_WEARABLE","HOME_APPLIANCE","SMALL_ELECTRONICS"]',N'ACTIVE',10,1,N'HN',@hnAccount);
DECLARE @hnTicket nvarchar(30)=(SELECT TOP 1 MaPhieuTN FROM PhieuTiepNhan WHERE TrangThaiXuLy='RECEIVED' ORDER BY NgayTiepNhan);
UPDATE PhieuTiepNhan SET MaTram=N'HN' WHERE MaPhieuTN=@hnTicket;
INSERT @cases VALUES(N'STATION_HN',@hnTicket,N'dieuphoi',N'Lọc trạm HN và phân công ktv.hanoi',N'Lọc ra phiếu của trạm HN; có tài khoản ktv.hanoi để thử phân công');
UPDATE e SET SoPhieuToiDa=CASE WHEN n.ActiveCount>0 THEN n.ActiveCount ELSE 1 END
FROM NhanVien e CROSS APPLY(SELECT COUNT(*) ActiveCount FROM PhanCong pc JOIN PhieuTiepNhan p ON p.MaPhieuTN=pc.MaPhieuTN WHERE pc.MaKTV=e.MaNV AND p.ConMo=1 AND p.TrangThaiXuLy NOT IN('COMPLETED','AWAITING_RETURN')) n WHERE e.MaNV=N'NV-002';
INSERT @cases VALUES(N'TECH_CAPACITY',N'NV-002',N'dieuphoi',N'Xem ứng viên Nguyễn Văn A đã đủ số phiếu tối đa',N'Giới hạn công việc hiện rõ trong hộp phân công');
UPDATE NhanVien SET CoMatTaiTram=0 WHERE MaNV=N'NV-007';
INSERT @cases VALUES(N'TECH_ABSENT',N'NV-007',N'dieuphoi',N'Xem ứng viên Phạm Thị Ngọc Hân',N'Hiện không có mặt tại trạm');

IF (SELECT COUNT(*) FROM @cases) <> 46 THROW 50000,N'Incomplete workflow scenario matrix.',1;
IF EXISTS(SELECT 1 FROM LinhKien l WHERE l.SoLuongTon<>(SELECT COALESCE(SUM(k.SoLuong),0) FROM TonKhoTheoKe k WHERE k.MaLK=l.MaLK)) THROW 50000,N'Stock/bin totals differ.',1;
IF EXISTS(SELECT 1 FROM LinhKien l WHERE l.SoLuongDaGiu<>(SELECT COALESCE(SUM(c.SoLuongXuat),0) FROM ChiTietXuatKho c JOIN PhieuXuatKho x ON x.MaPhieuXuat=c.MaPhieuXuat WHERE c.MaLK=l.MaLK AND x.TrangThai='PENDING')) THROW 50000,N'Reservations differ from pending stock issues.',1;
SELECT N'CASE|'+CaseCode+N'|'+Code+N'|'+Account+N'|'+Action+N'|'+Expected FROM @cases ORDER BY CaseCode;
