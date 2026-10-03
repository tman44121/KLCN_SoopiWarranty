-- ============================================================================
-- LongManLoc Service Center — schema SQL Server / Azure SQL Database (D-077).
-- Chuyển từ TrungTamBaoHanhDB_MySQL_v2.sql: cùng 47 bảng, cùng tên bảng/cột/ràng buộc, nhưng CHỈ lưu dữ liệu:
-- không stored procedure, không trigger, không view, không event. Nghiệp vụ (máy trạng thái, lịch sử trạng thái,
-- tổng tiền báo giá, hạn bảo hành linh kiện, đối soát thu tiền, sinh mã) do Spring Boot thực hiện.
--
-- Chạy trên database TRỐNG có collation Latin1_General_100_CI_AI (không phân biệt hoa thường và dấu, như
-- utf8mb4_unicode_ci của MySQL). Script không tạo/xóa database, không nạp dữ liệu.
--   sqlcmd -S <server> -d <database> -U <quản trị> -I -b -i db/sqlserver/01_schema.sql
--
-- Khác MySQL (xem docs/DECISIONS.md D-077 → D-081):
--   * VARCHAR/TEXT → NVARCHAR, JSON → NVARCHAR(MAX) + ISJSON, DATETIME → DATETIME2(0) giờ Việt Nam, TINYINT(1) → BIT.
--   * Cột sinh bỏ; "một phiếu mở mỗi thiết bị", "một báo giá hiệu lực", "một yêu cầu xuất đang chờ", "SĐT khách
--     đang hoạt động" là filtered unique index. ConMo, ThanhTien thành cột thường do Java ghi, có CHECK đối chiếu.
--   * UNIQUE trên cột cho phép NULL (SQL Server chỉ cho một NULL) → filtered unique index WHERE ... IS NOT NULL.
--   * REGEXP trong CHECK → LIKE.
-- ============================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

-- Lỗi chỉ dừng lô hiện tại; SSMS (và sqlcmd không có -b) vẫn chạy các lô sau. SET NOEXEC ON khiến mọi lô phía sau chỉ
-- được biên dịch, không thực thi — không tạo bảng hay ghi dữ liệu vào database sai.
IF CAST(DATABASEPROPERTYEX(DB_NAME(), 'Collation') AS NVARCHAR(128)) <> N'Latin1_General_100_CI_AI'
BEGIN
    RAISERROR(N'Database phải có collation Latin1_General_100_CI_AI (chọn khi tạo database). Script dừng, không ghi gì.', 16, 1);
    SET NOEXEC ON;
END
IF EXISTS (SELECT 1 FROM sys.tables WHERE is_ms_shipped = 0)
BEGIN
    RAISERROR(N'Database đã có bảng — schema chỉ triển khai vào database trống. Script dừng, không ghi gì.', 16, 1);
    SET NOEXEC ON;
END
GO

-- Đọc không chặn ghi (giống READ COMMITTED của InnoDB); Azure SQL Database bật sẵn.
IF (SELECT is_read_committed_snapshot_on FROM sys.databases WHERE name = DB_NAME()) = 0
    ALTER DATABASE CURRENT SET READ_COMMITTED_SNAPSHOT ON;
GO

-- ----------------------------------------------------------------------------
-- 1.0 BẢNG HỆ THỐNG: nhãn hiển thị, máy trạng thái, bộ đếm mã
-- ----------------------------------------------------------------------------
CREATE TABLE DanhMucNhan (
    Nhom          NVARCHAR(40)  NOT NULL,
    Ma            NVARCHAR(40)  NOT NULL,
    NhanNghiepVu  NVARCHAR(100) NOT NULL,
    NhanGiaoDien  NVARCHAR(100) NOT NULL,
    Tone          NVARCHAR(20)  NULL,
    ThuTu         INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (Nhom, Ma),
    CONSTRAINT CK_DanhMucNhan_Tone CHECK (Tone IS NULL OR Tone IN ('success', 'warning', 'danger', 'processing', 'neutral'))
);

-- Dữ liệu tham chiếu (máy trạng thái hiển thị/đối chiếu); luật chuyển trạng thái nằm trong Ticket (Java).
CREATE TABLE ChuyenTrangThaiHopLe (
    TuTrangThai  NVARCHAR(40)  NOT NULL,
    DenTrangThai NVARCHAR(40)  NOT NULL,
    MoTa         NVARCHAR(255) NULL,
    PRIMARY KEY (TuTrangThai, DenTrangThai)
);

CREATE TABLE BoDemMa (
    Khoa    NVARCHAR(30) PRIMARY KEY,
    GiaTri  INT          NOT NULL DEFAULT 0,
    CONSTRAINT CK_BoDemMa_GiaTri CHECK (GiaTri >= 0)
);

-- ----------------------------------------------------------------------------
-- 1.1 NGƯỜI DÙNG, VAI TRÒ, QUYỀN
-- ----------------------------------------------------------------------------
CREATE TABLE VaiTro (
    MaVaiTro    NVARCHAR(30)  PRIMARY KEY,
    TenHienThi  NVARCHAR(60)  NOT NULL UNIQUE,
    TenCuV1     NVARCHAR(50)  NULL,
    TrangDich   NVARCHAR(100) NOT NULL,
    MoTa        NVARCHAR(255) NULL
);

CREATE TABLE QuyenHan (
    MaQuyen NVARCHAR(50)  PRIMARY KEY,
    MoTa    NVARCHAR(255) NOT NULL
);

CREATE TABLE VaiTro_QuyenHan (
    MaVaiTro NVARCHAR(30) NOT NULL,
    MaQuyen  NVARCHAR(50) NOT NULL,
    PRIMARY KEY (MaVaiTro, MaQuyen),
    FOREIGN KEY (MaVaiTro) REFERENCES VaiTro(MaVaiTro),
    FOREIGN KEY (MaQuyen) REFERENCES QuyenHan(MaQuyen)
);

-- Tên đăng nhập duy nhất không phân biệt hoa thường nhờ collation CI (thay cột sinh TenDangNhapChuan).
CREATE TABLE TaiKhoan (
    MaTaiKhoan         BIGINT IDENTITY(1,1) PRIMARY KEY,
    TenDangNhap        NVARCHAR(50)  NOT NULL,
    MatKhauHash        NVARCHAR(255) NOT NULL,
    LoaiChuThe         NVARCHAR(20)  NOT NULL,
    TrangThai          NVARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    SoLanSaiLienTiep   INT           NOT NULL DEFAULT 0,
    KhoaTamDen         DATETIME2(0)  NULL,
    BatBuocDoiMatKhau  BIT           NOT NULL DEFAULT 0,
    PhienBanBaoMat     INT           NOT NULL DEFAULT 1,
    LanDangNhapCuoi    DATETIME2(0)  NULL,
    NgayDoiMatKhau     DATETIME2(0)  NULL,
    NgayTao            DATETIME2(0)  NOT NULL
        DEFAULT CONVERT(DATETIME2(0), SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time'),
    CONSTRAINT UX_TaiKhoan_TenDangNhap UNIQUE (TenDangNhap),
    CONSTRAINT CK_TaiKhoan_LoaiChuThe CHECK (LoaiChuThe IN ('EMPLOYEE', 'CUSTOMER')),
    CONSTRAINT CK_TaiKhoan_TrangThai CHECK (TrangThai IN ('ACTIVE', 'LOCKED')),
    CONSTRAINT CK_TaiKhoan_SoLanSai CHECK (SoLanSaiLienTiep >= 0),
    CONSTRAINT CK_TaiKhoan_PhienBan CHECK (PhienBanBaoMat >= 1),
    CONSTRAINT CK_TaiKhoan_Hash CHECK (MatKhauHash LIKE '{%}%')
);

CREATE TABLE TaiKhoan_VaiTro (
    MaTaiKhoan BIGINT       NOT NULL,
    MaVaiTro   NVARCHAR(30) NOT NULL,
    PRIMARY KEY (MaTaiKhoan, MaVaiTro),
    INDEX IX_TaiKhoanVaiTro_VaiTro (MaVaiTro),
    FOREIGN KEY (MaTaiKhoan) REFERENCES TaiKhoan(MaTaiKhoan) ON DELETE CASCADE,
    FOREIGN KEY (MaVaiTro) REFERENCES VaiTro(MaVaiTro)
);

CREATE TABLE RefreshToken (
    MaToken       BIGINT IDENTITY(1,1) PRIMARY KEY,
    TokenHash     NCHAR(64)     NOT NULL UNIQUE,
    MaTaiKhoan    BIGINT        NOT NULL,
    HoToken       NCHAR(36)     NOT NULL,
    NgayCap       DATETIME2(0)  NOT NULL,
    HetHan        DATETIME2(0)  NOT NULL,
    ThuHoiLuc     DATETIME2(0)  NULL,
    ThayBangHash  NCHAR(64)     NULL,
    GhiNho        BIT           NOT NULL DEFAULT 0,
    DiaChiIP      NVARCHAR(45)  NULL,
    UserAgent     NVARCHAR(255) NULL,
    INDEX IX_RefreshToken_TaiKhoan (MaTaiKhoan, ThuHoiLuc),
    INDEX IX_RefreshToken_Ho (HoToken),
    INDEX IX_RefreshToken_HetHan (HetHan),
    FOREIGN KEY (MaTaiKhoan) REFERENCES TaiKhoan(MaTaiKhoan) ON DELETE CASCADE,
    CONSTRAINT CK_RefreshToken_Han CHECK (HetHan > NgayCap)
);

CREATE TABLE TramDichVu (
    MaTram   NVARCHAR(20)  PRIMARY KEY,
    TenTram  NVARCHAR(100) NOT NULL,
    DiaChi   NVARCHAR(255) NULL,
    HoatDong BIT           NOT NULL DEFAULT 1
);

CREATE TABLE NhanVien (
    MaNV              NVARCHAR(20)  PRIMARY KEY,
    HoTen             NVARCHAR(100) NOT NULL,
    SDT               NVARCHAR(15)  NOT NULL UNIQUE,
    Email             NVARCHAR(100) NULL,
    ChuyenMon         NVARCHAR(100) NULL,
    KyNang            NVARCHAR(MAX) NULL,
    TrangThaiLamViec  NVARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    SoPhieuToiDa      INT           NOT NULL DEFAULT 10,
    CoMatTaiTram      BIT           NOT NULL DEFAULT 1,
    MaTram            NVARCHAR(20)  NOT NULL DEFAULT 'HCM',
    MaTaiKhoan        BIGINT        NULL,
    FOREIGN KEY (MaTaiKhoan) REFERENCES TaiKhoan(MaTaiKhoan),
    FOREIGN KEY (MaTram) REFERENCES TramDichVu(MaTram),
    CONSTRAINT CK_NhanVien_TrangThai CHECK (TrangThaiLamViec IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT CK_NhanVien_SoPhieu CHECK (SoPhieuToiDa > 0),
    CONSTRAINT CK_NhanVien_SDT CHECK (SDT LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                                      OR SDT LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    CONSTRAINT CK_NhanVien_KyNang CHECK (ISJSON(KyNang) = 1)
);
CREATE UNIQUE INDEX UX_NhanVien_Email ON NhanVien(Email) WHERE Email IS NOT NULL;
CREATE UNIQUE INDEX UX_NhanVien_TaiKhoan ON NhanVien(MaTaiKhoan) WHERE MaTaiKhoan IS NOT NULL;

-- SĐT chỉ duy nhất giữa các hồ sơ đang hoạt động (hồ sơ lưu trữ/đã gộp được giải phóng SĐT).
CREATE TABLE KhachHang (
    MaKH           NVARCHAR(20)  PRIMARY KEY,
    HoTen          NVARCHAR(100) NOT NULL,
    SDT            NVARCHAR(15)  NOT NULL,
    Email          NVARCHAR(100) NULL,
    DiaChi         NVARCHAR(255) NULL,
    MaTaiKhoan     BIGINT        NULL,
    TrangThai      NVARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    GopVaoMaKH     NVARCHAR(20)  NULL,
    NgayTao        DATETIME2(0)  NOT NULL
        DEFAULT CONVERT(DATETIME2(0), SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time'),
    INDEX IX_KhachHang_SDT (SDT),
    INDEX IX_KhachHang_HoTen (HoTen),
    FOREIGN KEY (MaTaiKhoan) REFERENCES TaiKhoan(MaTaiKhoan),
    FOREIGN KEY (GopVaoMaKH) REFERENCES KhachHang(MaKH),
    CONSTRAINT CK_KhachHang_TrangThai CHECK (TrangThai IN ('ACTIVE', 'ARCHIVED', 'MERGED')),
    CONSTRAINT CK_KhachHang_Gop CHECK ((TrangThai = 'MERGED' AND GopVaoMaKH IS NOT NULL)
                                       OR (TrangThai <> 'MERGED' AND GopVaoMaKH IS NULL)),
    CONSTRAINT CK_KhachHang_SDT CHECK (SDT LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                                       OR SDT LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
);
CREATE UNIQUE INDEX UX_KhachHang_SDT ON KhachHang(SDT) WHERE TrangThai = 'ACTIVE';
CREATE UNIQUE INDEX UX_KhachHang_TaiKhoan ON KhachHang(MaTaiKhoan) WHERE MaTaiKhoan IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 1.2 DANH MỤC SẢN PHẨM & THIẾT BỊ
-- ----------------------------------------------------------------------------
CREATE TABLE NhomThietBi (
    MaNhom   NVARCHAR(30)  PRIMARY KEY,
    TenNhom  NVARCHAR(100) NOT NULL UNIQUE,
    ThuTu    INT           NOT NULL DEFAULT 0,
    HoatDong BIT           NOT NULL DEFAULT 1
);

CREATE TABLE LoaiThietBi (
    MaLoai             NVARCHAR(30)  PRIMARY KEY,
    MaNhom             NVARCHAR(30)  NOT NULL,
    TenLoai            NVARCHAR(100) NOT NULL,
    LoaiDinhDanh       NVARCHAR(10)  NOT NULL,
    ChecklistChanDoan  NVARCHAR(MAX) NOT NULL,
    HoatDong           BIT           NOT NULL DEFAULT 1,
    FOREIGN KEY (MaNhom) REFERENCES NhomThietBi(MaNhom),
    CONSTRAINT CK_LoaiThietBi_DinhDanh CHECK (LoaiDinhDanh IN ('IMEI', 'SERIAL')),
    CONSTRAINT CK_LoaiThietBi_Checklist CHECK (ISJSON(ChecklistChanDoan) = 1)
);

CREATE TABLE HangSanXuat (
    MaHang   NVARCHAR(30)  PRIMARY KEY,
    TenHang  NVARCHAR(100) NOT NULL UNIQUE,
    HoatDong BIT           NOT NULL DEFAULT 1
);

CREATE TABLE HangSanXuat_NhomThietBi (
    MaHang NVARCHAR(30) NOT NULL,
    MaNhom NVARCHAR(30) NOT NULL,
    PRIMARY KEY (MaHang, MaNhom),
    FOREIGN KEY (MaHang) REFERENCES HangSanXuat(MaHang),
    FOREIGN KEY (MaNhom) REFERENCES NhomThietBi(MaNhom)
);

CREATE TABLE SanPham (
    MaSP                        NVARCHAR(30)  PRIMARY KEY,
    TenSP                       NVARCHAR(150) NOT NULL,
    MaHang                      NVARCHAR(30)  NOT NULL,
    MaLoai                      NVARCHAR(30)  NOT NULL,
    DongSanPham                 NVARCHAR(100) NULL,
    ThoiHanBaoHanhMacDinhThang  INT           NOT NULL DEFAULT 12,
    HoatDong                    BIT           NOT NULL DEFAULT 1,
    CONSTRAINT UX_SanPham_HangTen UNIQUE (MaHang, TenSP),
    FOREIGN KEY (MaHang) REFERENCES HangSanXuat(MaHang),
    FOREIGN KEY (MaLoai) REFERENCES LoaiThietBi(MaLoai),
    CONSTRAINT CK_SanPham_ThoiHanBH CHECK (ThoiHanBaoHanhMacDinhThang >= 0)
);

CREATE TABLE ChinhSachBaoHanh (
    MaChinhSach      NVARCHAR(30)  PRIMARY KEY,
    PhamVi           NVARCHAR(10)  NOT NULL,
    MaSP             NVARCHAR(30)  NULL,
    MaHang           NVARCHAR(30)  NOT NULL,
    TenChinhSach     NVARCHAR(150) NOT NULL,
    SoThangBaoHanh   INT           NOT NULL,
    DieuKienBaoHanh  NVARCHAR(MAX) NULL,
    TruongHopTuChoi  NVARCHAR(MAX) NULL,
    NhaPhanPhoi      NVARCHAR(150) NULL,
    HoatDong         BIT           NOT NULL DEFAULT 1,
    INDEX IX_ChinhSach_SanPham (MaSP, HoatDong),
    INDEX IX_ChinhSach_Hang (MaHang, PhamVi, HoatDong),
    FOREIGN KEY (MaSP) REFERENCES SanPham(MaSP),
    FOREIGN KEY (MaHang) REFERENCES HangSanXuat(MaHang),
    CONSTRAINT CK_ChinhSach_PhamVi CHECK ((PhamVi = 'PRODUCT' AND MaSP IS NOT NULL) OR (PhamVi = 'BRAND' AND MaSP IS NULL)),
    CONSTRAINT CK_ChinhSach_SoThang CHECK (SoThangBaoHanh >= 0)
);

CREATE TABLE BangGiaDichVu (
    MaDichVu  NVARCHAR(30)  PRIMARY KEY,
    TenDichVu NVARCHAR(150) NOT NULL,
    MaNhom    NVARCHAR(30)  NOT NULL,
    DonGia    DECIMAL(18,2) NOT NULL,
    HoatDong  BIT           NOT NULL DEFAULT 1,
    FOREIGN KEY (MaNhom) REFERENCES NhomThietBi(MaNhom),
    CONSTRAINT CK_BangGia_DonGia CHECK (DonGia >= 0)
);

CREATE TABLE ThietBi (
    MaThietBi            NVARCHAR(30)  PRIMARY KEY,
    MaSP                 NVARCHAR(30)  NOT NULL,
    LoaiDinhDanh         NVARCHAR(10)  NOT NULL,
    SoSerial_IMEI        NVARCHAR(50)  NOT NULL,
    MaKH                 NVARCHAR(20)  NULL,
    NgayKichHoatBaoHanh  DATE          NULL,
    NgayHetHanBaoHanh    DATE          NULL,
    NhaPhanPhoi          NVARCHAR(150) NULL,
    NgayTao              DATETIME2(0)  NOT NULL
        DEFAULT CONVERT(DATETIME2(0), SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time'),
    CONSTRAINT UX_ThietBi_SoSerial UNIQUE (SoSerial_IMEI),
    INDEX IX_ThietBi_KhachHang (MaKH),
    FOREIGN KEY (MaSP) REFERENCES SanPham(MaSP),
    FOREIGN KEY (MaKH) REFERENCES KhachHang(MaKH),
    CONSTRAINT CK_ThietBi_DinhDanh CHECK (LoaiDinhDanh IN ('IMEI', 'SERIAL')),
    CONSTRAINT CK_ThietBi_IMEI CHECK (LoaiDinhDanh <> 'IMEI'
                                      OR (LEN(SoSerial_IMEI) = 15 AND SoSerial_IMEI NOT LIKE '%[^0-9]%')),
    CONSTRAINT CK_ThietBi_Serial CHECK (LoaiDinhDanh <> 'SERIAL'
                                        OR (LEN(SoSerial_IMEI) BETWEEN 4 AND 50
                                            AND SoSerial_IMEI COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^A-Za-z0-9-]%')),
    CONSTRAINT CK_ThietBi_HanBH CHECK (NgayHetHanBaoHanh IS NULL OR NgayKichHoatBaoHanh IS NULL
                                       OR NgayHetHanBaoHanh >= NgayKichHoatBaoHanh)
);

-- ----------------------------------------------------------------------------
-- 1.3 YÊU CẦU BẢO HÀNH TRỰC TUYẾN (YC-) & TỆP ĐÍNH KÈM
-- ----------------------------------------------------------------------------
CREATE TABLE YeuCauBaoHanh (
    MaYeuCau              NVARCHAR(30)  PRIMARY KEY,
    MaKH                  NVARCHAR(20)  NULL, -- Gắn hồ sơ khách đăng nhập; NULL cho yêu cầu khách vãng lai.
    HoTenKhach            NVARCHAR(100) NOT NULL,
    SDTKhach              NVARCHAR(15)  NOT NULL,
    EmailKhach            NVARCHAR(100) NULL,
    DiaChiKhach           NVARCHAR(255) NULL,
    MaNhom                NVARCHAR(30)  NOT NULL,
    MaLoai                NVARCHAR(30)  NOT NULL,
    HangModel             NVARCHAR(150) NOT NULL,
    LoaiDinhDanh          NVARCHAR(10)  NOT NULL,
    SoSerial_IMEI         NVARCHAR(50)  NOT NULL,
    MoTaLoi               NVARCHAR(MAX) NOT NULL,
    MaTramMongMuon        NVARCHAR(20)  NOT NULL,
    ThoiGianMongMuonTu    DATETIME2(0)  NULL,
    ThoiGianMongMuonDen   DATETIME2(0)  NULL,
    TrangThai             NVARCHAR(20)  NOT NULL DEFAULT 'PENDING_INTAKE',
    MaPhieuTN             NVARCHAR(30)  NULL,
    MaNVXuLy              NVARCHAR(20)  NULL,
    NgayXuLy              DATETIME2(0)  NULL,
    LyDoHuy               NVARCHAR(255) NULL,
    NgayTao               DATETIME2(0)  NOT NULL,
    INDEX IX_YeuCau_SDT (SDTKhach),
    INDEX IX_YeuCau_KhachHang (MaKH, TrangThai, NgayTao),
    INDEX IX_YeuCau_TrangThai (TrangThai, NgayTao),
    FOREIGN KEY (MaKH) REFERENCES KhachHang(MaKH),
    FOREIGN KEY (MaNhom) REFERENCES NhomThietBi(MaNhom),
    FOREIGN KEY (MaLoai) REFERENCES LoaiThietBi(MaLoai),
    FOREIGN KEY (MaTramMongMuon) REFERENCES TramDichVu(MaTram),
    FOREIGN KEY (MaNVXuLy) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_YeuCau_TrangThai CHECK (TrangThai IN ('PENDING_INTAKE', 'CONVERTED', 'CANCELLED')),
    CONSTRAINT CK_YeuCau_Chuyen CHECK ((TrangThai = 'CONVERTED' AND MaPhieuTN IS NOT NULL)
                                       OR (TrangThai <> 'CONVERTED' AND MaPhieuTN IS NULL)),
    CONSTRAINT CK_YeuCau_Huy CHECK (TrangThai <> 'CANCELLED' OR (LyDoHuy IS NOT NULL AND TRIM(LyDoHuy) <> '')),
    CONSTRAINT CK_YeuCau_ThoiGian CHECK (ThoiGianMongMuonDen IS NULL OR ThoiGianMongMuonTu IS NULL
                                         OR ThoiGianMongMuonDen >= ThoiGianMongMuonTu),
    CONSTRAINT CK_YeuCau_DinhDanh CHECK (LoaiDinhDanh IN ('IMEI', 'SERIAL')),
    CONSTRAINT CK_YeuCau_SDT CHECK (SDTKhach LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                                    OR SDTKhach LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
);
CREATE UNIQUE INDEX UX_YeuCau_PhieuTN ON YeuCauBaoHanh(MaPhieuTN) WHERE MaPhieuTN IS NOT NULL;

CREATE TABLE TepDinhKem (
    MaTep           BIGINT IDENTITY(1,1) PRIMARY KEY,
    LoaiChuSoHuu    NVARCHAR(30)  NOT NULL,
    MaChuSoHuu      NVARCHAR(30)  NOT NULL,
    TenTep          NVARCHAR(255) NOT NULL,
    LoaiNoiDung     NVARCHAR(50)  NOT NULL,
    KichThuoc       INT           NOT NULL,
    DuongDanLuuTru  NVARCHAR(500) NOT NULL,
    NguoiTaiLen     NVARCHAR(30)  NULL,
    NgayTaiLen      DATETIME2(0)  NOT NULL,
    INDEX IX_TepDinhKem_ChuSoHuu (LoaiChuSoHuu, MaChuSoHuu),
    CONSTRAINT CK_Tep_Loai CHECK (LoaiChuSoHuu IN ('WARRANTY_REQUEST', 'HANDOVER_SIGNATURE')),
    CONSTRAINT CK_Tep_Mime CHECK (LoaiNoiDung IN ('image/jpeg', 'image/png', 'image/webp', 'video/mp4')),
    CONSTRAINT CK_Tep_KichThuoc CHECK (KichThuoc > 0 AND KichThuoc <= 31457280),
    CONSTRAINT CK_Tep_ChuKy CHECK (LoaiChuSoHuu <> 'HANDOVER_SIGNATURE' OR (LoaiNoiDung = 'image/png' AND KichThuoc <= 204800))
);

-- ----------------------------------------------------------------------------
-- 1.4 TIẾP NHẬN & ĐIỀU PHỐI
-- Máy trạng thái do Ticket (Java) kiểm soát; lịch sử trạng thái do JpaTicketRepository ghi cùng transaction.
-- ConMo = máy còn ở trung tâm; Java ghi cùng TrangThaiXuLy, CHECK bảo đảm hai cột không lệch nhau.
-- ----------------------------------------------------------------------------
CREATE TABLE PhieuTiepNhan (
    MaPhieuTN               NVARCHAR(30)  PRIMARY KEY,
    MaTram                  NVARCHAR(20)  NOT NULL DEFAULT 'HCM',
    NgayTiepNhan            DATETIME2(0)  NOT NULL,
    KenhTiepNhan            NVARCHAR(20)  NOT NULL DEFAULT 'COUNTER',
    LoaiYeuCau              NVARCHAR(20)  NOT NULL DEFAULT 'WARRANTY',
    MaYeuCau                NVARCHAR(30)  NULL,
    MaKH                    NVARCHAR(20)  NOT NULL,
    MaThietBi               NVARCHAR(30)  NOT NULL,
    MaNVTiepNhan            NVARCHAR(20)  NOT NULL,
    BH_TrangThaiLucNhan     NVARCHAR(20)  NOT NULL,
    BH_NgayKichHoat         DATE          NULL,
    BH_NgayHetHan           DATE          NULL,
    BH_MaChinhSach          NVARCHAR(30)  NULL,
    TinhTrangTem            NVARCHAR(100) NULL,
    NQ_VetTray              NVARCHAR(10)  NOT NULL DEFAULT 'NONE',
    NQ_CanMop               BIT           NOT NULL DEFAULT 0,
    NQ_NutVo                BIT           NOT NULL DEFAULT 0,
    NQ_DauHieuAmNuoc        NVARCHAR(10)  NOT NULL DEFAULT 'NONE',
    NQ_PhuKien              NVARCHAR(10)  NOT NULL DEFAULT 'COMPLETE',
    PhuKienKemTheo          NVARCHAR(255) NULL,
    TinhTrangNgoaiQuan      NVARCHAR(255) NULL,
    KhachXacNhanNgoaiQuan   BIT           NOT NULL,
    MoTaLoiKhachBao         NVARCHAR(MAX) NOT NULL,
    NgayHenTra              DATETIME2(0)  NULL,
    ChiPhiDuKien            DECIMAL(18,2) NOT NULL DEFAULT 0,
    MucSLA                  NVARCHAR(20)  NOT NULL DEFAULT 'STANDARD_48H',
    HanSLA                  DATETIME2(0)  NOT NULL,
    TrangThaiXuLy           NVARCHAR(40)  NOT NULL DEFAULT 'RECEIVED',
    NgayCapNhatTrangThai    DATETIME2(0)  NULL,
    NguoiCapNhatTrangThai   NVARCHAR(30)  NULL,
    VaiTroCapNhatTrangThai  NVARCHAR(30)  NULL,
    GhiChuTrangThai         NVARCHAR(255) NULL,
    PhienBan                INT           NOT NULL DEFAULT 0,
    ConMo                   BIT           NOT NULL DEFAULT 1,
    INDEX IX_PhieuTiepNhan_TrangThai (TrangThaiXuLy, HanSLA),
    INDEX IX_PhieuTiepNhan_KhachHang (MaKH, NgayTiepNhan),
    INDEX IX_PhieuTiepNhan_ThietBi (MaThietBi, TrangThaiXuLy),
    INDEX IX_PhieuTiepNhan_Tram (MaTram, NgayTiepNhan),
    FOREIGN KEY (MaTram) REFERENCES TramDichVu(MaTram),
    FOREIGN KEY (MaYeuCau) REFERENCES YeuCauBaoHanh(MaYeuCau),
    FOREIGN KEY (MaKH) REFERENCES KhachHang(MaKH),
    FOREIGN KEY (MaThietBi) REFERENCES ThietBi(MaThietBi),
    FOREIGN KEY (MaNVTiepNhan) REFERENCES NhanVien(MaNV),
    FOREIGN KEY (BH_MaChinhSach) REFERENCES ChinhSachBaoHanh(MaChinhSach),
    CONSTRAINT CK_PTN_Kenh CHECK (KenhTiepNhan IN ('COUNTER', 'MOBILE_APP', 'ONLINE_REQUEST', 'PHONE')),
    CONSTRAINT CK_PTN_LoaiYeuCau CHECK (LoaiYeuCau IN ('WARRANTY', 'PAID_REPAIR')),
    CONSTRAINT CK_PTN_BH CHECK (BH_TrangThaiLucNhan IN ('IN_WARRANTY', 'OUT_OF_WARRANTY', 'NOT_ACTIVATED')),
    CONSTRAINT CK_PTN_VetTray CHECK (NQ_VetTray IN ('NONE', 'LIGHT', 'HEAVY')),
    CONSTRAINT CK_PTN_AmNuoc CHECK (NQ_DauHieuAmNuoc IN ('NONE', 'SUSPECTED', 'YES')),
    CONSTRAINT CK_PTN_PhuKien CHECK (NQ_PhuKien IN ('COMPLETE', 'MISSING')),
    CONSTRAINT CK_PTN_XacNhanNQ CHECK (KhachXacNhanNgoaiQuan = 1),
    CONSTRAINT CK_PTN_MoTaLoi CHECK (TRIM(MoTaLoiKhachBao) <> ''),
    CONSTRAINT CK_PTN_NgayHenTra CHECK (NgayHenTra IS NULL OR NgayHenTra >= NgayTiepNhan),
    CONSTRAINT CK_PTN_ChiPhi CHECK (ChiPhiDuKien >= 0),
    CONSTRAINT CK_PTN_SLA CHECK (MucSLA IN ('EXPRESS_12H', 'PRIORITY_24H', 'STANDARD_48H') AND HanSLA > NgayTiepNhan),
    CONSTRAINT CK_PTN_TrangThai CHECK (TrangThaiXuLy IN (
        'RECEIVED', 'INSPECTING', 'DIAGNOSED', 'AWAITING_QUOTE_APPROVAL', 'AWAITING_CUSTOMER_CONFIRMATION',
        'AWAITING_PARTS', 'REPAIRING', 'COMPLETED', 'DELIVERED', 'CANCELLED', 'RETURNED_UNREPAIRED')),
    CONSTRAINT CK_PTN_ConMo CHECK (ConMo = CASE WHEN TrangThaiXuLy IN ('DELIVERED', 'RETURNED_UNREPAIRED') THEN 0 ELSE 1 END)
);
CREATE UNIQUE INDEX UX_PhieuTiepNhan_ThietBiDangMo ON PhieuTiepNhan(MaThietBi) WHERE ConMo = 1;
CREATE UNIQUE INDEX UX_PhieuTiepNhan_YeuCau ON PhieuTiepNhan(MaYeuCau) WHERE MaYeuCau IS NOT NULL;

ALTER TABLE YeuCauBaoHanh
    ADD CONSTRAINT FK_YeuCau_PhieuTN FOREIGN KEY (MaPhieuTN) REFERENCES PhieuTiepNhan(MaPhieuTN);

CREATE TABLE LichSuTrangThai_ThietBi (
    MaLichSu            BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaPhieuTN           NVARCHAR(30)  NOT NULL,
    TrangThai           NVARCHAR(40)  NOT NULL,
    ThoiGianCapNhat     DATETIME2(0)  NOT NULL,
    MoTaChiTiet         NVARCHAR(255) NULL,
    NguoiCapNhat        NVARCHAR(100) NULL,
    TenNguoiCapNhat     NVARCHAR(100) NULL,
    VaiTroNguoiCapNhat  NVARCHAR(30)  NULL,
    INDEX IX_LichSu_PhieuTN (MaPhieuTN, ThoiGianCapNhat),
    FOREIGN KEY (MaPhieuTN) REFERENCES PhieuTiepNhan(MaPhieuTN)
);

CREATE TABLE GhiChuPhieu (
    MaGhiChu        BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaPhieuTN       NVARCHAR(30)   NOT NULL,
    Loai            NVARCHAR(10)   NOT NULL,
    NoiDung         NVARCHAR(1000) NOT NULL,
    NguoiViet       NVARCHAR(20)   NOT NULL,
    VaiTroNguoiViet NVARCHAR(30)   NULL,
    ThoiGian        DATETIME2(0)   NOT NULL,
    INDEX IX_GhiChu_Phieu (MaPhieuTN, Loai, ThoiGian),
    FOREIGN KEY (MaPhieuTN) REFERENCES PhieuTiepNhan(MaPhieuTN),
    FOREIGN KEY (NguoiViet) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_GhiChu_Loai CHECK (Loai IN ('CUSTOMER', 'INTERNAL')),
    CONSTRAINT CK_GhiChu_NoiDung CHECK (TRIM(NoiDung) <> '')
);

CREATE TABLE PhanCong (
    MaPhanCong    NVARCHAR(30)  PRIMARY KEY,
    MaPhieuTN     NVARCHAR(30)  NOT NULL UNIQUE,
    MaNVQuanLy    NVARCHAR(20)  NOT NULL,
    MaKTV         NVARCHAR(20)  NOT NULL,
    NgayPhanCong  DATETIME2(0)  NOT NULL,
    MucDoUuTien   NVARCHAR(10)  NOT NULL DEFAULT 'NORMAL',
    GhiChu        NVARCHAR(255) NULL,
    INDEX IX_PhanCong_KTV (MaKTV),
    FOREIGN KEY (MaPhieuTN) REFERENCES PhieuTiepNhan(MaPhieuTN),
    FOREIGN KEY (MaNVQuanLy) REFERENCES NhanVien(MaNV),
    FOREIGN KEY (MaKTV) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_PhanCong_UuTien CHECK (MucDoUuTien IN ('URGENT', 'NORMAL', 'LOW'))
);

CREATE TABLE LichSuPhanCong (
    MaLichSu      BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaPhieuTN     NVARCHAR(30)  NOT NULL,
    MaKTVCu       NVARCHAR(20)  NOT NULL,
    MaKTVMoi      NVARCHAR(20)  NOT NULL,
    MaNVThucHien  NVARCHAR(20)  NOT NULL,
    ThoiGian      DATETIME2(0)  NOT NULL,
    GhiChu        NVARCHAR(255) NULL,
    INDEX IX_LichSuPhanCong_Phieu (MaPhieuTN, ThoiGian),
    FOREIGN KEY (MaPhieuTN) REFERENCES PhieuTiepNhan(MaPhieuTN),
    FOREIGN KEY (MaKTVCu) REFERENCES NhanVien(MaNV),
    FOREIGN KEY (MaKTVMoi) REFERENCES NhanVien(MaNV),
    FOREIGN KEY (MaNVThucHien) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_LichSuPhanCong_Khac CHECK (MaKTVCu <> MaKTVMoi)
);

-- ----------------------------------------------------------------------------
-- 1.5 KIỂM TRA, CHẨN ĐOÁN & BÁO GIÁ
-- ----------------------------------------------------------------------------
CREATE TABLE PhieuKiemTra (
    MaPhieuKT             NVARCHAR(30)  PRIMARY KEY,
    MaPhieuTN             NVARCHAR(30)  NOT NULL UNIQUE,
    MaKTV                 NVARCHAR(20)  NOT NULL,
    NgayKiemTra           DATETIME2(0)  NOT NULL,
    KetQuaKiemTraChiTiet  NVARCHAR(MAX) NOT NULL,
    ChecklistKetQua       NVARCHAR(MAX) NULL,
    TinhTrangVaoNuoc      BIT           NOT NULL DEFAULT 0,
    PhanLoaiBaoHanh       NVARCHAR(20)  NOT NULL,
    LyDoNgoaiBaoHanh      NVARCHAR(255) NULL,
    HuongKhacPhucDeXuat   NVARCHAR(MAX) NULL,
    GhiChuPhanLoaiLai     NVARCHAR(500) NULL,
    SoLanSuaPhanLoai      INT           NOT NULL DEFAULT 0,
    NgayCapNhat           DATETIME2(0)  NULL,
    FOREIGN KEY (MaPhieuTN) REFERENCES PhieuTiepNhan(MaPhieuTN),
    FOREIGN KEY (MaKTV) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_PKT_PhanLoai CHECK (PhanLoaiBaoHanh IN ('FREE_WARRANTY', 'OUT_OF_WARRANTY', 'PARTIAL_WARRANTY')),
    CONSTRAINT CK_PKT_LyDo CHECK (PhanLoaiBaoHanh = 'FREE_WARRANTY'
                                  OR (LyDoNgoaiBaoHanh IS NOT NULL AND TRIM(LyDoNgoaiBaoHanh) <> '')),
    CONSTRAINT CK_PKT_VaoNuoc CHECK (PhanLoaiBaoHanh <> 'FREE_WARRANTY' OR TinhTrangVaoNuoc = 0),
    CONSTRAINT CK_PKT_KetQua CHECK (TRIM(KetQuaKiemTraChiTiet) <> ''),
    CONSTRAINT CK_PKT_Checklist CHECK (ISJSON(ChecklistKetQua) = 1)
);

-- Nhiều báo giá / phiếu nhưng tối đa 1 báo giá còn hiệu lực (UX_PhieuBaoGia_ConHieuLuc).
-- Tổng tiền do Quotation (Java) tính và ghi cùng các dòng chi tiết.
CREATE TABLE PhieuBaoGia (
    MaBaoGia               NVARCHAR(30)  PRIMARY KEY,
    MaPhieuTN              NVARCHAR(30)  NOT NULL,
    MaPhieuKT              NVARCHAR(30)  NOT NULL,
    MaKTVLap               NVARCHAR(20)  NOT NULL,
    NgayLapBaoGia          DATETIME2(0)  NOT NULL,
    HanHieuLuc             DATE          NULL,
    MaDichVu               NVARCHAR(30)  NULL,
    TongTienLinhKien       DECIMAL(18,2) NOT NULL DEFAULT 0,
    TongTienCong           DECIMAL(18,2) NOT NULL DEFAULT 0,
    ThueVAT                DECIMAL(5,2)  NOT NULL DEFAULT 8.00,
    TongTienThanhToan      DECIMAL(18,2) NOT NULL DEFAULT 0,
    TrangThaiDuyetNoiBo    NVARCHAR(10)  NOT NULL DEFAULT 'PENDING',
    MaNVQuanLyDuyet        NVARCHAR(20)  NULL,
    NgayDuyetNoiBo         DATETIME2(0)  NULL,
    GhiChuDuyet            NVARCHAR(500) NULL,
    KhachXacNhan           NVARCHAR(10)  NOT NULL DEFAULT 'PENDING',
    NgayKhachXacNhan       DATETIME2(0)  NULL,
    LyDoKhachTuChoi        NVARCHAR(255) NULL,
    KenhXacNhan            NVARCHAR(10)  NULL,
    NguoiGhiNhanXacNhan    NVARCHAR(30)  NULL,
    INDEX IX_PhieuBaoGia_PhieuTN (MaPhieuTN, NgayLapBaoGia),
    INDEX IX_PhieuBaoGia_Duyet (TrangThaiDuyetNoiBo, NgayLapBaoGia),
    FOREIGN KEY (MaPhieuTN) REFERENCES PhieuTiepNhan(MaPhieuTN),
    FOREIGN KEY (MaPhieuKT) REFERENCES PhieuKiemTra(MaPhieuKT),
    FOREIGN KEY (MaKTVLap) REFERENCES NhanVien(MaNV),
    FOREIGN KEY (MaNVQuanLyDuyet) REFERENCES NhanVien(MaNV),
    FOREIGN KEY (MaDichVu) REFERENCES BangGiaDichVu(MaDichVu),
    CONSTRAINT CK_PBG_Tien CHECK (TongTienLinhKien >= 0 AND TongTienCong >= 0 AND TongTienThanhToan >= 0),
    CONSTRAINT CK_PBG_VAT CHECK (ThueVAT BETWEEN 0 AND 100),
    CONSTRAINT CK_PBG_Duyet CHECK (TrangThaiDuyetNoiBo IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT CK_PBG_Khach CHECK (KhachXacNhan IN ('PENDING', 'ACCEPTED', 'DECLINED')),
    CONSTRAINT CK_PBG_Kenh CHECK (KenhXacNhan IS NULL OR KenhXacNhan IN ('PORTAL', 'COUNTER')),
    CONSTRAINT CK_PBG_TuChoiCoGhiChu CHECK (TrangThaiDuyetNoiBo <> 'REJECTED'
                                            OR (GhiChuDuyet IS NOT NULL AND TRIM(GhiChuDuyet) <> '')),
    CONSTRAINT CK_PBG_KhachSauDuyet CHECK (KhachXacNhan = 'PENDING' OR TrangThaiDuyetNoiBo = 'APPROVED'),
    CONSTRAINT CK_PBG_KhachTuChoiCoLyDo CHECK (KhachXacNhan <> 'DECLINED'
                                               OR (LyDoKhachTuChoi IS NOT NULL AND TRIM(LyDoKhachTuChoi) <> '')),
    CONSTRAINT CK_PBG_TachNhiem CHECK (MaNVQuanLyDuyet IS NULL OR MaNVQuanLyDuyet <> MaKTVLap),
    CONSTRAINT CK_PBG_HanHieuLuc CHECK (HanHieuLuc IS NULL OR HanHieuLuc >= CAST(NgayLapBaoGia AS DATE))
);
CREATE UNIQUE INDEX UX_PhieuBaoGia_ConHieuLuc ON PhieuBaoGia(MaPhieuTN) WHERE TrangThaiDuyetNoiBo <> 'REJECTED';

-- ----------------------------------------------------------------------------
-- 1.6 KHO LINH KIỆN
-- ----------------------------------------------------------------------------
CREATE TABLE NhaCungCap (
    MaNCC    NVARCHAR(30)  PRIMARY KEY,
    TenNCC   NVARCHAR(150) NOT NULL,
    SDT      NVARCHAR(15)  NULL,
    DiaChi   NVARCHAR(255) NULL,
    Email    NVARCHAR(100) NULL,
    HoatDong BIT           NOT NULL DEFAULT 1
);

-- Tồn khả dụng = SoLuongTon - SoLuongDaGiu (tính khi đọc).
CREATE TABLE LinhKien (
    MaLK                 NVARCHAR(30)  PRIMARY KEY,
    TenLK                NVARCHAR(150) NOT NULL,
    DonViTinh            NVARCHAR(20)  NOT NULL DEFAULT N'Cái',
    MaNhom               NVARCHAR(30)  NULL,
    TenHang              NVARCHAR(100) NULL,
    DonGiaVon            DECIMAL(18,2) NOT NULL,
    DonGiaDichVu         DECIMAL(18,2) NOT NULL,
    SoLuongTon           INT           NOT NULL DEFAULT 0,
    SoLuongDaGiu         INT           NOT NULL DEFAULT 0,
    DinhMucTonToiThieu   INT           NOT NULL DEFAULT 5,
    KeChinh              NVARCHAR(20)  NOT NULL,
    ThoiHanBaoHanhThang  INT           NOT NULL DEFAULT 3,
    MaNCC                NVARCHAR(30)  NULL,
    HoatDong             BIT           NOT NULL DEFAULT 1,
    PhienBan             INT           NOT NULL DEFAULT 0,
    INDEX IX_LinhKien_Nhom (MaNhom),
    FOREIGN KEY (MaNCC) REFERENCES NhaCungCap(MaNCC),
    FOREIGN KEY (MaNhom) REFERENCES NhomThietBi(MaNhom),
    CONSTRAINT CK_LinhKien_Gia CHECK (DonGiaVon >= 0 AND DonGiaDichVu >= 0),
    CONSTRAINT CK_LinhKien_Ton CHECK (SoLuongTon >= 0 AND SoLuongDaGiu >= 0 AND SoLuongDaGiu <= SoLuongTon),
    CONSTRAINT CK_LinhKien_DinhMuc CHECK (DinhMucTonToiThieu >= 0),
    CONSTRAINT CK_LinhKien_BH CHECK (ThoiHanBaoHanhThang >= 0),
    CONSTRAINT CK_LinhKien_Ke CHECK (KeChinh LIKE 'KHO-[A-Z]-[0-9][0-9]-[0-9][0-9]')
);

-- Bất biến (Java bảo đảm, truy vấn đối soát kiểm tra): LinhKien.SoLuongTon = SUM(TonKhoTheoKe.SoLuong)
CREATE TABLE TonKhoTheoKe (
    MaLK     NVARCHAR(30) NOT NULL,
    MaKe     NVARCHAR(20) NOT NULL,
    SoLuong  INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (MaLK, MaKe),
    FOREIGN KEY (MaLK) REFERENCES LinhKien(MaLK),
    CONSTRAINT CK_TonKe_SoLuong CHECK (SoLuong >= 0),
    CONSTRAINT CK_TonKe_Ma CHECK (MaKe LIKE 'KHO-[A-Z]-[0-9][0-9]-[0-9][0-9]')
);

CREATE TABLE ChiTietBaoGia (
    MaChiTietBG      BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaBaoGia         NVARCHAR(30)  NOT NULL,
    SoThuTu          INT           NOT NULL,
    MaLK             NVARCHAR(30)  NULL,
    NoiDungMuc       NVARCHAR(255) NOT NULL,
    SoLuong          INT           NOT NULL DEFAULT 1,
    DonGia           DECIMAL(18,2) NOT NULL,
    TienCongSuaChua  DECIMAL(18,2) NOT NULL DEFAULT 0,
    ThanhTien        DECIMAL(18,2) NOT NULL,
    CONSTRAINT UX_ChiTietBaoGia_STT UNIQUE (MaBaoGia, SoThuTu),
    FOREIGN KEY (MaBaoGia) REFERENCES PhieuBaoGia(MaBaoGia),
    FOREIGN KEY (MaLK) REFERENCES LinhKien(MaLK),
    CONSTRAINT CK_CTBG_SoLuong CHECK (SoLuong > 0),
    CONSTRAINT CK_CTBG_Tien CHECK (DonGia >= 0 AND TienCongSuaChua >= 0),
    CONSTRAINT CK_CTBG_NoiDung CHECK (TRIM(NoiDungMuc) <> ''),
    CONSTRAINT CK_CTBG_ThanhTien CHECK (ThanhTien = SoLuong * DonGia + TienCongSuaChua)
);

CREATE TABLE PhieuNhapKho (
    MaPhieuNhap   NVARCHAR(30)  PRIMARY KEY,
    MaNCC         NVARCHAR(30)  NOT NULL,
    SoLo          NVARCHAR(50)  NULL,
    NgayNhap      DATE          NOT NULL,
    MaNguoiLap    NVARCHAR(20)  NOT NULL,
    NgayLap       DATETIME2(0)  NOT NULL,
    TrangThai     NVARCHAR(10)  NOT NULL DEFAULT 'PENDING',
    MaNguoiDuyet  NVARCHAR(20)  NULL,
    NgayDuyet     DATETIME2(0)  NULL,
    LyDoTuChoi    NVARCHAR(255) NULL,
    TongTienNhap  DECIMAL(18,2) NOT NULL DEFAULT 0,
    GhiChu        NVARCHAR(255) NULL,
    INDEX IX_PhieuNhap_TrangThai (TrangThai, NgayNhap),
    FOREIGN KEY (MaNCC) REFERENCES NhaCungCap(MaNCC),
    FOREIGN KEY (MaNguoiLap) REFERENCES NhanVien(MaNV),
    FOREIGN KEY (MaNguoiDuyet) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_PhieuNhap_TrangThai CHECK (TrangThai IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT CK_PhieuNhap_Tien CHECK (TongTienNhap >= 0),
    CONSTRAINT CK_PhieuNhap_XuLy CHECK (TrangThai = 'PENDING' OR (MaNguoiDuyet IS NOT NULL AND NgayDuyet IS NOT NULL)),
    CONSTRAINT CK_PhieuNhap_TuChoi CHECK (TrangThai <> 'REJECTED' OR (LyDoTuChoi IS NOT NULL AND TRIM(LyDoTuChoi) <> ''))
);

CREATE TABLE ChiTietNhapKho (
    MaChiTietNhap  BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaPhieuNhap    NVARCHAR(30)  NOT NULL,
    MaLK           NVARCHAR(30)  NOT NULL,
    SoLuongNhap    INT           NOT NULL,
    DonGiaNhap     DECIMAL(18,2) NOT NULL,
    SerialLo       NVARCHAR(60)  NULL,
    MaKe           NVARCHAR(20)  NULL,
    FOREIGN KEY (MaPhieuNhap) REFERENCES PhieuNhapKho(MaPhieuNhap),
    FOREIGN KEY (MaLK) REFERENCES LinhKien(MaLK),
    CONSTRAINT CK_CTNK_SoLuong CHECK (SoLuongNhap > 0),
    CONSTRAINT CK_CTNK_DonGia CHECK (DonGiaNhap >= 0),
    CONSTRAINT CK_CTNK_Ke CHECK (MaKe IS NULL OR MaKe LIKE 'KHO-[A-Z]-[0-9][0-9]-[0-9][0-9]')
);

-- Mỗi phiếu tối đa một yêu cầu xuất đang chờ (UX_PhieuXuat_DangCho).
CREATE TABLE PhieuXuatKho (
    MaPhieuXuat       NVARCHAR(30)  PRIMARY KEY,
    MaPhieuTN         NVARCHAR(30)  NOT NULL,
    NguonXuat         NVARCHAR(20)  NOT NULL,
    MaBaoGia          NVARCHAR(30)  NULL,
    LyDoXuat          NVARCHAR(255) NOT NULL,
    MaKTVNhan         NVARCHAR(20)  NOT NULL,
    MaNguoiYeuCau     NVARCHAR(20)  NOT NULL,
    NgayYeuCau        DATETIME2(0)  NOT NULL,
    TrangThai         NVARCHAR(10)  NOT NULL DEFAULT 'PENDING',
    MaThuKhoXuLy      NVARCHAR(20)  NULL,
    NgayXuLy          DATETIME2(0)  NULL,
    LyDoTuChoi        NVARCHAR(255) NULL,
    TongTienXuat      DECIMAL(18,2) NOT NULL DEFAULT 0,
    INDEX IX_PhieuXuat_PhieuTN (MaPhieuTN, TrangThai),
    INDEX IX_PhieuXuat_TrangThai (TrangThai, NgayYeuCau),
    FOREIGN KEY (MaPhieuTN) REFERENCES PhieuTiepNhan(MaPhieuTN),
    FOREIGN KEY (MaBaoGia) REFERENCES PhieuBaoGia(MaBaoGia),
    FOREIGN KEY (MaKTVNhan) REFERENCES NhanVien(MaNV),
    FOREIGN KEY (MaNguoiYeuCau) REFERENCES NhanVien(MaNV),
    FOREIGN KEY (MaThuKhoXuLy) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_PhieuXuat_Nguon CHECK ((NguonXuat = 'QUOTATION' AND MaBaoGia IS NOT NULL)
                                         OR (NguonXuat = 'FREE_WARRANTY' AND MaBaoGia IS NULL)),
    CONSTRAINT CK_PhieuXuat_TrangThai CHECK (TrangThai IN ('PENDING', 'ISSUED', 'REJECTED')),
    CONSTRAINT CK_PhieuXuat_XuLy CHECK (TrangThai = 'PENDING' OR (MaThuKhoXuLy IS NOT NULL AND NgayXuLy IS NOT NULL)),
    CONSTRAINT CK_PhieuXuat_TuChoi CHECK (TrangThai <> 'REJECTED' OR (LyDoTuChoi IS NOT NULL AND TRIM(LyDoTuChoi) <> '')),
    CONSTRAINT CK_PhieuXuat_Tien CHECK (TongTienXuat >= 0)
);
CREATE UNIQUE INDEX UX_PhieuXuat_DangCho ON PhieuXuatKho(MaPhieuTN) WHERE TrangThai = 'PENDING';

CREATE TABLE ChiTietXuatKho (
    MaChiTietXuat        BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaPhieuXuat          NVARCHAR(30)  NOT NULL,
    MaLK                 NVARCHAR(30)  NOT NULL,
    SoLuongXuat          INT           NOT NULL,
    DonGiaXuat           DECIMAL(18,2) NOT NULL,
    MaKe                 NVARCHAR(20)  NULL,
    NgayHetHanBaoHanhLK  DATE          NULL,
    CONSTRAINT UX_CTXK_LinhKien UNIQUE (MaPhieuXuat, MaLK),
    FOREIGN KEY (MaPhieuXuat) REFERENCES PhieuXuatKho(MaPhieuXuat),
    FOREIGN KEY (MaLK) REFERENCES LinhKien(MaLK),
    CONSTRAINT CK_CTXK_SoLuong CHECK (SoLuongXuat > 0),
    CONSTRAINT CK_CTXK_DonGia CHECK (DonGiaXuat >= 0)
);

CREATE TABLE PhieuDieuChuyen (
    MaPhieuDC     NVARCHAR(30)  PRIMARY KEY,
    MaLK          NVARCHAR(30)  NOT NULL,
    SoLuong       INT           NOT NULL,
    TuKe          NVARCHAR(20)  NOT NULL,
    DenKe         NVARCHAR(20)  NOT NULL,
    LyDo          NVARCHAR(255) NOT NULL,
    TrangThai     NVARCHAR(10)  NOT NULL DEFAULT 'PENDING',
    MaNguoiLap    NVARCHAR(20)  NOT NULL,
    NgayLap       DATETIME2(0)  NOT NULL,
    MaNguoiDuyet  NVARCHAR(20)  NULL,
    NgayDuyet     DATETIME2(0)  NULL,
    LyDoTuChoi    NVARCHAR(255) NULL,
    INDEX IX_DieuChuyen_TrangThai (TrangThai, NgayLap),
    FOREIGN KEY (MaLK) REFERENCES LinhKien(MaLK),
    FOREIGN KEY (MaNguoiLap) REFERENCES NhanVien(MaNV),
    FOREIGN KEY (MaNguoiDuyet) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_DC_SoLuong CHECK (SoLuong > 0),
    CONSTRAINT CK_DC_Ke CHECK (TuKe <> DenKe AND DenKe LIKE 'KHO-[A-Z]-[0-9][0-9]-[0-9][0-9]'),
    CONSTRAINT CK_DC_TrangThai CHECK (TrangThai IN ('PENDING', 'COMPLETED', 'REJECTED')),
    CONSTRAINT CK_DC_XuLy CHECK (TrangThai = 'PENDING' OR (MaNguoiDuyet IS NOT NULL AND NgayDuyet IS NOT NULL)),
    CONSTRAINT CK_DC_TuChoi CHECK (TrangThai <> 'REJECTED' OR (LyDoTuChoi IS NOT NULL AND TRIM(LyDoTuChoi) <> ''))
);

-- ----------------------------------------------------------------------------
-- 1.7 SỬA CHỮA, QC, THU TIỀN, BÀN GIAO
-- ----------------------------------------------------------------------------
CREATE TABLE PhieuSuaChua (
    MaPhieuSC         NVARCHAR(30) PRIMARY KEY,
    MaPhieuTN         NVARCHAR(30) NOT NULL UNIQUE,
    MaPhanCong        NVARCHAR(30) NOT NULL UNIQUE,
    MaKTV             NVARCHAR(20) NOT NULL,
    NgayTao           DATETIME2(0) NOT NULL,
    NgayBatDau        DATETIME2(0) NULL,
    TrangThaiSuaChua  NVARCHAR(12) NOT NULL DEFAULT 'PENDING',
    INDEX IX_PhieuSuaChua_KTV (MaKTV, TrangThaiSuaChua),
    FOREIGN KEY (MaPhieuTN) REFERENCES PhieuTiepNhan(MaPhieuTN),
    FOREIGN KEY (MaPhanCong) REFERENCES PhanCong(MaPhanCong),
    FOREIGN KEY (MaKTV) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_PSC_TrangThai CHECK (TrangThaiSuaChua IN ('PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
    CONSTRAINT CK_PSC_BatDau CHECK (TrangThaiSuaChua IN ('PENDING', 'CANCELLED') OR NgayBatDau IS NOT NULL)
);

CREATE TABLE KetQuaSuaChua (
    MaKetQua          NVARCHAR(30)  PRIMARY KEY,
    MaPhieuSC         NVARCHAR(30)  NOT NULL,
    MaKTV             NVARCHAR(20)  NOT NULL,
    NoiDungSuaChua    NVARCHAR(MAX) NOT NULL,
    KetQuaQCTungBuoc  NVARCHAR(MAX) NULL,
    KetQuaKCS         NVARCHAR(10)  NOT NULL,
    ChiTietTestKCS    NVARCHAR(MAX) NULL,
    NgayGhiNhan       DATETIME2(0)  NOT NULL,
    INDEX IX_KetQua_PhieuSC (MaPhieuSC, NgayGhiNhan),
    FOREIGN KEY (MaPhieuSC) REFERENCES PhieuSuaChua(MaPhieuSC),
    FOREIGN KEY (MaKTV) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_KQSC_KCS CHECK (KetQuaKCS IN ('PASS', 'FAIL')),
    CONSTRAINT CK_KQSC_NoiDung CHECK (TRIM(NoiDungSuaChua) <> ''),
    CONSTRAINT CK_KQSC_QC CHECK (ISJSON(KetQuaQCTungBuoc) = 1)
);

-- Mỗi phiếu tiếp nhận thu đúng 1 lần (UX_HoaDon_PhieuTN). Số tiền đối soát với báo giá trong PaymentService.
CREATE TABLE HoaDon_PhieuThu (
    MaPhieuThu         NVARCHAR(30)  PRIMARY KEY,
    MaPhieuTN          NVARCHAR(30)  NOT NULL,
    MaBaoGia           NVARCHAR(30)  NULL,
    LoaiThu            NVARCHAR(20)  NOT NULL,
    NgayThu            DATETIME2(0)  NOT NULL,
    NguoiNopTien       NVARCHAR(100) NOT NULL,
    SoTienThu          DECIMAL(18,2) NOT NULL,
    HinhThucThanhToan  NVARCHAR(20)  NOT NULL,
    MaThuNgan          NVARCHAR(20)  NOT NULL,
    GhiChu             NVARCHAR(255) NULL,
    CONSTRAINT UX_HoaDon_PhieuTN UNIQUE (MaPhieuTN),
    INDEX IX_HoaDon_NgayThu_SoTien (NgayThu, SoTienThu),
    INDEX IX_HoaDon_ThuNgan (MaThuNgan, NgayThu),
    FOREIGN KEY (MaPhieuTN) REFERENCES PhieuTiepNhan(MaPhieuTN),
    FOREIGN KEY (MaBaoGia) REFERENCES PhieuBaoGia(MaBaoGia),
    FOREIGN KEY (MaThuNgan) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_HoaDon_Tien CHECK (SoTienThu >= 0),
    CONSTRAINT CK_HoaDon_LoaiThu CHECK (
        (LoaiThu = 'CHARGED' AND MaBaoGia IS NOT NULL
             AND HinhThucThanhToan IN ('CASH', 'BANK_TRANSFER', 'E_WALLET', 'CARD'))
        OR (LoaiThu = 'FREE_WARRANTY' AND MaBaoGia IS NULL AND SoTienThu = 0 AND HinhThucThanhToan = 'NONE'))
);

CREATE TABLE PhieuBanGiao (
    MaBanGiao               NVARCHAR(30)  PRIMARY KEY,
    MaPhieuTN               NVARCHAR(30)  NOT NULL UNIQUE,
    LoaiBanGiao             NVARCHAR(20)  NOT NULL,
    NgayBanGiao             DATETIME2(0)  NOT NULL,
    MaNVBanGiao             NVARCHAR(20)  NOT NULL,
    NguoiNhanMay            NVARCHAR(100) NOT NULL,
    HienTrangKhiTra         NVARCHAR(255) NOT NULL,
    TraLaiLinhKienCu        BIT           NOT NULL DEFAULT 0,
    ThoiHanBaoHanhMoi       NVARCHAR(100) NULL,
    DanhGiaHaiLong          INT           NULL,
    KT_NgoaiQuanDungBienBan BIT           NULL,
    KT_KhoiDongBinhThuong   BIT           NULL,
    KT_ChucNangChinhOK      BIT           NULL,
    KT_PhuKienDayDu         BIT           NULL,
    KT_KhongLoiPhatSinh     BIT           NULL,
    MaTepChuKy              BIGINT        NULL,
    KhachXacNhanNhanMay     BIT           NOT NULL DEFAULT 0,
    FOREIGN KEY (MaPhieuTN) REFERENCES PhieuTiepNhan(MaPhieuTN),
    FOREIGN KEY (MaNVBanGiao) REFERENCES NhanVien(MaNV),
    FOREIGN KEY (MaTepChuKy) REFERENCES TepDinhKem(MaTep),
    CONSTRAINT CK_PBGi_Loai CHECK (LoaiBanGiao IN ('DELIVERED', 'RETURNED_UNREPAIRED')),
    CONSTRAINT CK_PBGi_DanhGia CHECK (DanhGiaHaiLong IS NULL OR DanhGiaHaiLong BETWEEN 1 AND 5),
    CONSTRAINT CK_PBGi_MaySua CHECK (LoaiBanGiao <> 'DELIVERED' OR (
        KT_NgoaiQuanDungBienBan = 1 AND KT_KhoiDongBinhThuong = 1 AND KT_ChucNangChinhOK = 1
        AND KT_PhuKienDayDu = 1 AND KT_KhongLoiPhatSinh = 1
        AND MaTepChuKy IS NOT NULL AND KhachXacNhanNhanMay = 1)),
    CONSTRAINT CK_PBGi_TraMay CHECK (LoaiBanGiao <> 'RETURNED_UNREPAIRED' OR ThoiHanBaoHanhMoi IS NULL)
);

-- ----------------------------------------------------------------------------
-- 1.8 NHẬT KÝ THAO TÁC & THÔNG BÁO
-- Nhật ký chỉ ghi thêm: tài khoản ứng dụng bị DENY UPDATE/DELETE (04_app_user.sql).
-- ----------------------------------------------------------------------------
CREATE TABLE NhatKyThaoTac (
    MaNhatKy         BIGINT IDENTITY(1,1) PRIMARY KEY,
    ThoiGian         DATETIME2(0)  NOT NULL,
    MaNguoiThaoTac   NVARCHAR(30)  NOT NULL,
    TenNguoiThaoTac  NVARCHAR(100) NULL,
    VaiTro           NVARCHAR(200) NULL,
    HanhDong         NVARCHAR(50)  NOT NULL,
    NhanHanhDong     NVARCHAR(100) NOT NULL,
    LoaiDoiTuong     NVARCHAR(30)  NOT NULL,
    MaDoiTuong       NVARCHAR(30)  NOT NULL,
    GiaTriTruoc      NVARCHAR(500) NULL,
    GiaTriSau        NVARCHAR(500) NULL,
    INDEX IX_NhatKy_DoiTuong (LoaiDoiTuong, MaDoiTuong, ThoiGian),
    INDEX IX_NhatKy_ThoiGian (ThoiGian),
    INDEX IX_NhatKy_Nguoi (MaNguoiThaoTac, ThoiGian)
);

CREATE TABLE ThongBao (
    MaThongBao      BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaVaiTroNhan    NVARCHAR(30)  NULL,
    MaTaiKhoanNhan  BIGINT        NULL,
    Loai            NVARCHAR(40)  NOT NULL,
    NoiDung         NVARCHAR(255) NOT NULL,
    DuongDan        NVARCHAR(255) NULL,
    MaDoiTuong      NVARCHAR(30)  NULL,
    NgayTao         DATETIME2(0)  NOT NULL,
    INDEX IX_ThongBao_VaiTro (MaVaiTroNhan, NgayTao),
    INDEX IX_ThongBao_TaiKhoan (MaTaiKhoanNhan, NgayTao),
    FOREIGN KEY (MaVaiTroNhan) REFERENCES VaiTro(MaVaiTro),
    FOREIGN KEY (MaTaiKhoanNhan) REFERENCES TaiKhoan(MaTaiKhoan),
    CONSTRAINT CK_ThongBao_Nhan CHECK (MaVaiTroNhan IS NOT NULL OR MaTaiKhoanNhan IS NOT NULL)
);

CREATE TABLE ThongBao_DaDoc (
    MaThongBao  BIGINT       NOT NULL,
    MaTaiKhoan  BIGINT       NOT NULL,
    DocLuc      DATETIME2(0) NOT NULL,
    PRIMARY KEY (MaThongBao, MaTaiKhoan),
    FOREIGN KEY (MaThongBao) REFERENCES ThongBao(MaThongBao) ON DELETE CASCADE,
    FOREIGN KEY (MaTaiKhoan) REFERENCES TaiKhoan(MaTaiKhoan) ON DELETE CASCADE
);

-- App di động khách hàng (docs/MOBILE_API.md). OTP chỉ lưu SHA-256 của mã, dùng một lần.
CREATE TABLE MaXacThucOTP (
    MaOTP         BIGINT IDENTITY(1,1) PRIMARY KEY,
    SDT           NVARCHAR(15)  NOT NULL,
    MucDich       NVARCHAR(20)  NOT NULL,
    MaHash        NCHAR(64)     NOT NULL,
    NgayTao       DATETIME2(0)  NOT NULL,
    HetHan        DATETIME2(0)  NOT NULL,
    SoLanNhapSai  INT           NOT NULL DEFAULT 0,
    DaDungLuc     DATETIME2(0)  NULL,
    DiaChiIP      NVARCHAR(45)  NULL,
    INDEX IX_MaXacThucOTP_SDT (SDT, MucDich, NgayTao),
    CONSTRAINT CK_MaXacThucOTP_MucDich CHECK (MucDich IN ('REGISTER', 'RESET_PASSWORD')),
    CONSTRAINT CK_MaXacThucOTP_SDT CHECK (SDT LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                                          OR SDT LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    CONSTRAINT CK_MaXacThucOTP_Han CHECK (HetHan > NgayTao),
    CONSTRAINT CK_MaXacThucOTP_SoLan CHECK (SoLanNhapSai >= 0)
);

-- Thiết bị nhận push (FCM): mỗi lượt cài app (MaCaiDat) thuộc một tài khoản, mỗi token gắn một thiết bị.
CREATE TABLE ThietBiNhanThongBao (
    MaCaiDat     NVARCHAR(64)  PRIMARY KEY,
    MaTaiKhoan   BIGINT        NOT NULL,
    NenTang      NVARCHAR(10)  NOT NULL,
    PushToken    NVARCHAR(512) NOT NULL,
    PhienBanApp  NVARCHAR(30)  NULL,
    NgayDangKy   DATETIME2(0)  NOT NULL,
    NgayCapNhat  DATETIME2(0)  NOT NULL,
    CONSTRAINT UX_ThietBiNhanThongBao_Token UNIQUE (PushToken),
    INDEX IX_ThietBiNhanThongBao_TaiKhoan (MaTaiKhoan),
    FOREIGN KEY (MaTaiKhoan) REFERENCES TaiKhoan(MaTaiKhoan) ON DELETE CASCADE,
    CONSTRAINT CK_ThietBiNhanThongBao_NenTang CHECK (NenTang IN ('ANDROID', 'IOS')),
    CONSTRAINT CK_ThietBiNhanThongBao_MaCaiDat CHECK (LEN(MaCaiDat) >= 8
        AND MaCaiDat COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^A-Za-z0-9-]%')
);
GO
