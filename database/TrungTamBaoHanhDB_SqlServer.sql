-- ============================================================================
-- Soopi — TrungTamBaoHanhDB cho SQL Server (bản đầy đủ, mới nhất)
-- Gồm: schema (47 bảng, không procedure/trigger/view) + dữ liệu tham chiếu + dữ liệu mẫu (4 ca nghiệp vụ, tài khoản demo).
--
-- FILE GHÉP — không sửa tay. Nguồn: database/01_schema.sql, 02_reference_data.sql, 03_demo_data.sql (lấy từ
-- warranty-system-mysql/db/sqlserver). Sửa các file nguồn rồi ghép lại theo thứ tự sau phần đầu này.
--
-- Cách chạy (cần quyền tạo database trên SQL Server):
--   * Nhanh nhất: run.bat initdb [server]  — tạo database bằng đăng nhập Windows và đặt luôn ConnectionStrings:Default.
--   * SSMS: mở file, Execute (F5).
--   * sqlcmd -S localhost -E -C -I -b -f 65001 -i database\TrungTamBaoHanhDB_SqlServer.sql   (-E: đăng nhập Windows;
--     dùng -U <user> -P <mật khẩu> thay -E nếu đăng nhập SQL Server)
-- Script tạo database TrungTamBaoHanhDB (collation Latin1_General_100_CI_AI) nếu chưa có. Database đã có bảng hoặc sai
-- collation thì script báo lỗi và bỏ qua mọi lô phía sau (SET NOEXEC ON) — kể cả trong SSMS — không xóa hay ghi gì.
-- Chỉ dùng cho dev/demo. Production: chỉ 01_schema.sql + 04_app_user.sql.
-- Tài khoản demo: admin / admin123, các tài khoản khác mật khẩu 1234 (docs/TAI_KHOAN_DEMO.md).
-- ============================================================================
SET NOEXEC OFF;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
IF DB_ID(N'TrungTamBaoHanhDB') IS NULL
    CREATE DATABASE TrungTamBaoHanhDB COLLATE Latin1_General_100_CI_AI;
GO
USE TrungTamBaoHanhDB;
GO

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
-- Sinh bởi tools/MySqlToSqlServer.java — không sửa tay.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
BEGIN TRANSACTION;
GO
ALTER TABLE ChuyenTrangThaiHopLe NOCHECK CONSTRAINT ALL;
ALTER TABLE DanhMucNhan NOCHECK CONSTRAINT ALL;
ALTER TABLE QuyenHan NOCHECK CONSTRAINT ALL;
ALTER TABLE TramDichVu NOCHECK CONSTRAINT ALL;
ALTER TABLE VaiTro NOCHECK CONSTRAINT ALL;
ALTER TABLE VaiTro_QuyenHan NOCHECK CONSTRAINT ALL;
GO
INSERT INTO ChuyenTrangThaiHopLe (TuTrangThai, DenTrangThai, MoTa) VALUES
  (N'AWAITING_CUSTOMER_CONFIRMATION', N'AWAITING_PARTS', N'T7a Khách đồng ý'),
  (N'AWAITING_CUSTOMER_CONFIRMATION', N'CANCELLED', N'T7b Khách từ chối'),
  (N'AWAITING_PARTS', N'REPAIRING', N'T9 Duyệt xuất kho / T9c Đủ LK ngoài kho'),
  (N'AWAITING_QUOTE_APPROVAL', N'AWAITING_CUSTOMER_CONFIRMATION', N'T6a Quản lý duyệt báo giá'),
  (N'AWAITING_QUOTE_APPROVAL', N'DIAGNOSED', N'T6b Quản lý yêu cầu sửa lại báo giá'),
  (N'CANCELLED', N'RETURNED_UNREPAIRED', N'T12 Trả máy không sửa'),
  (N'COMPLETED', N'DELIVERED', N'T12 Bàn giao'),
  (N'DIAGNOSED', N'AWAITING_PARTS', N'T8 Yêu cầu xuất LK ca miễn phí'),
  (N'DIAGNOSED', N'AWAITING_QUOTE_APPROVAL', N'T5 Lập báo giá'),
  (N'DIAGNOSED', N'REPAIRING', N'T4 Bắt đầu sửa ca miễn phí không cần LK'),
  (N'INSPECTING', N'DIAGNOSED', N'T3 Lưu kết quả kiểm tra'),
  (N'RECEIVED', N'INSPECTING', N'T2 Phân công KTV'),
  (N'REPAIRING', N'COMPLETED', N'T10 QC đạt');
GO
INSERT INTO DanhMucNhan (Nhom, Ma, NhanNghiepVu, NhanGiaoDien, Tone, ThuTu) VALUES
  (N'ACCESSORIES', N'COMPLETE', N'Đủ', N'Đủ', NULL, 1),
  (N'ACCESSORIES', N'MISSING', N'Thiếu', N'Thiếu', NULL, 2),
  (N'ACCOUNT_STATUS', N'ACTIVE', N'Đang hoạt động', N'Đang hoạt động', N'success', 1),
  (N'ACCOUNT_STATUS', N'LOCKED', N'Đã khóa', N'Đã khóa', N'danger', 2),
  (N'CHANNEL', N'COUNTER', N'Tại quầy', N'Tại quầy', NULL, 1),
  (N'CHANNEL', N'MOBILE_APP', N'Qua App Mobile', N'Qua App Mobile', NULL, 2),
  (N'CHANNEL', N'ONLINE_REQUEST', N'Đăng ký trực tuyến', N'Đăng ký trực tuyến', NULL, 3),
  (N'CHANNEL', N'PHONE', N'Qua điện thoại', N'Qua điện thoại', NULL, 4),
  (N'COSMETIC_MOISTURE', N'NONE', N'Không', N'Không', NULL, 1),
  (N'COSMETIC_MOISTURE', N'SUSPECTED', N'Nghi ngờ', N'Nghi ngờ', NULL, 2),
  (N'COSMETIC_MOISTURE', N'YES', N'Có', N'Có', NULL, 3),
  (N'COSMETIC_SCRATCH', N'HEAVY', N'Nặng', N'Nặng', NULL, 3),
  (N'COSMETIC_SCRATCH', N'LIGHT', N'Nhẹ', N'Nhẹ', NULL, 2),
  (N'COSMETIC_SCRATCH', N'NONE', N'Không', N'Không', NULL, 1),
  (N'CUSTOMER_STATUS', N'ACTIVE', N'Đang hoạt động', N'Đang hoạt động', N'success', 1),
  (N'CUSTOMER_STATUS', N'ARCHIVED', N'Đã lưu trữ', N'Đã lưu trữ', N'neutral', 2),
  (N'CUSTOMER_STATUS', N'MERGED', N'Đã gộp', N'Đã gộp', N'neutral', 3),
  (N'PAYMENT_METHOD', N'BANK_TRANSFER', N'Chuyển khoản', N'Chuyển khoản', NULL, 2),
  (N'PAYMENT_METHOD', N'CARD', N'Thẻ', N'Thẻ', NULL, 4),
  (N'PAYMENT_METHOD', N'CASH', N'Tiền mặt', N'Tiền mặt', NULL, 1),
  (N'PAYMENT_METHOD', N'E_WALLET', N'Ví điện tử', N'Ví điện tử', NULL, 3),
  (N'PAYMENT_METHOD', N'NONE', N'Không áp dụng', N'Không áp dụng', NULL, 5),
  (N'PAYMENT_TYPE', N'CHARGED', N'Thu tiền sửa chữa', N'Đã thanh toán', N'success', 1),
  (N'PAYMENT_TYPE', N'FREE_WARRANTY', N'Miễn phí bảo hành', N'Miễn phí bảo hành', N'success', 2),
  (N'PRIORITY', N'LOW', N'Thấp', N'Thấp', N'neutral', 3),
  (N'PRIORITY', N'NORMAL', N'Bình thường', N'Bình thường', N'neutral', 2),
  (N'PRIORITY', N'URGENT', N'Gấp', N'Gấp', N'danger', 1),
  (N'QC_RESULT', N'FAIL', N'Chưa đạt', N'Không đạt QC', N'danger', 2),
  (N'QC_RESULT', N'PASS', N'Đạt', N'QC đạt', N'success', 1),
  (N'QC_STEP', N'DATA', N'Xác nhận dữ liệu', N'05 Xác nhận dữ liệu', NULL, 5),
  (N'QC_STEP', N'FINAL', N'Kết quả QC', N'06 Kết quả QC', NULL, 6),
  (N'QC_STEP', N'MAIN_FUNCTION', N'Kiểm tra chức năng chính', N'02 Kiểm tra chức năng chính', NULL, 2),
  (N'QC_STEP', N'POWER_CHARGING', N'Kiểm tra nguồn/sạc', N'04 Kiểm tra nguồn/sạc', NULL, 4),
  (N'QC_STEP', N'SECONDARY', N'Kiểm tra phụ', N'03 Kiểm tra phụ', NULL, 3),
  (N'QC_STEP', N'VISUAL', N'Kiểm tra ngoại quan', N'01 Kiểm tra ngoại quan', NULL, 1),
  (N'QUOTE_APPROVAL', N'APPROVED', N'Quản lý đã duyệt', N'Đã phê duyệt', N'success', 2),
  (N'QUOTE_APPROVAL', N'PENDING', N'Chờ duyệt', N'Chờ phê duyệt', N'warning', 1),
  (N'QUOTE_APPROVAL', N'REJECTED', N'Từ chối duyệt', N'Bị từ chối', N'danger', 3),
  (N'QUOTE_CUSTOMER', N'ACCEPTED', N'Đồng ý', N'Đã xác nhận', N'success', 2),
  (N'QUOTE_CUSTOMER', N'DECLINED', N'Từ chối', N'Khách từ chối', N'danger', 3),
  (N'QUOTE_CUSTOMER', N'PENDING', N'Chờ phản hồi', N'Chờ khách xác nhận', N'warning', 1),
  (N'REPAIR_ORDER', N'CANCELLED', N'DaHuy', N'Đã hủy', N'neutral', 4),
  (N'REPAIR_ORDER', N'DONE', N'HoanThanh', N'Hoàn thành', N'success', 3),
  (N'REPAIR_ORDER', N'IN_PROGRESS', N'DangSua', N'Đang sửa', N'processing', 2),
  (N'REPAIR_ORDER', N'PENDING', N'ChoSua', N'Chờ sửa', N'neutral', 1),
  (N'REQUEST_TYPE', N'PAID_REPAIR', N'Sửa chữa dịch vụ', N'Sửa chữa dịch vụ', NULL, 2),
  (N'REQUEST_TYPE', N'WARRANTY', N'Bảo hành', N'Bảo hành', NULL, 1),
  (N'SLA_LEVEL', N'EXPRESS_12H', N'Nhanh (12h)', N'Nhanh (12h)', NULL, 1),
  (N'SLA_LEVEL', N'PRIORITY_24H', N'Ưu tiên (24h)', N'Ưu tiên (24h)', NULL, 2),
  (N'SLA_LEVEL', N'STANDARD_48H', N'Tiêu chuẩn (48h)', N'Tiêu chuẩn (48h)', NULL, 3),
  (N'STEP_RESULT', N'FAIL', N'Không đạt', N'Không đạt', N'danger', 3),
  (N'STEP_RESULT', N'NA', N'Không áp dụng', N'Không áp dụng', N'neutral', 4),
  (N'STEP_RESULT', N'PASS', N'Đạt', N'Đạt', N'success', 2),
  (N'STEP_RESULT', N'PENDING', N'Chưa kiểm tra', N'Chưa kiểm tra', N'neutral', 1),
  (N'STOCK_ISSUE', N'ISSUED', N'DaXuat', N'Đã xuất kho', N'success', 2),
  (N'STOCK_ISSUE', N'PENDING', N'ChoXuat', N'Chờ duyệt', N'warning', 1),
  (N'STOCK_ISSUE', N'REJECTED', N'DaHuy', N'Đã từ chối', N'danger', 3),
  (N'STOCK_RECEIPT', N'APPROVED', N'Đã nhập kho', N'Đã nhập kho', N'success', 2),
  (N'STOCK_RECEIPT', N'PENDING', N'Chờ duyệt', N'Chờ duyệt', N'warning', 1),
  (N'STOCK_RECEIPT', N'REJECTED', N'Đã từ chối', N'Đã từ chối', N'danger', 3),
  (N'STOCK_TRANSFER', N'COMPLETED', N'Đã điều chuyển', N'Đã điều chuyển', N'success', 2),
  (N'STOCK_TRANSFER', N'PENDING', N'Chờ duyệt', N'Chờ duyệt', N'warning', 1),
  (N'STOCK_TRANSFER', N'REJECTED', N'Đã từ chối', N'Đã từ chối', N'danger', 3),
  (N'TICKET_STATUS', N'AWAITING_CUSTOMER_CONFIRMATION', N'Chờ khách xác nhận', N'Chờ khách xác nhận', N'warning', 5),
  (N'TICKET_STATUS', N'AWAITING_PARTS', N'Chờ linh kiện', N'Chờ linh kiện', N'warning', 6),
  (N'TICKET_STATUS', N'AWAITING_QUOTE_APPROVAL', N'Chờ duyệt giá', N'Chờ phê duyệt báo giá', N'warning', 4),
  (N'TICKET_STATUS', N'CANCELLED', N'Đã hủy', N'Ngừng sửa theo yêu cầu khách', N'neutral', 10),
  (N'TICKET_STATUS', N'COMPLETED', N'Hoàn thành', N'Sẵn sàng bàn giao', N'success', 8),
  (N'TICKET_STATUS', N'DELIVERED', N'Đã bàn giao', N'Đã hoàn thành', N'success', 9),
  (N'TICKET_STATUS', N'DIAGNOSED', N'Đã chẩn đoán', N'Đã chẩn đoán', N'processing', 3),
  (N'TICKET_STATUS', N'INSPECTING', N'Đang kiểm tra', N'Đang chẩn đoán', N'processing', 2),
  (N'TICKET_STATUS', N'RECEIVED', N'Đã tiếp nhận', N'Chưa phân công', N'neutral', 1),
  (N'TICKET_STATUS', N'REPAIRING', N'Đang sửa chữa', N'Đang sửa chữa', N'processing', 7),
  (N'TICKET_STATUS', N'RETURNED_UNREPAIRED', N'Đã trả máy (hủy)', N'Đã trả máy (không sửa)', N'neutral', 11),
  (N'WARRANTY_AT_INTAKE', N'IN_WARRANTY', N'Còn bảo hành', N'Còn bảo hành', N'success', 1),
  (N'WARRANTY_AT_INTAKE', N'NOT_ACTIVATED', N'Chưa kích hoạt', N'Chưa kích hoạt', N'neutral', 3),
  (N'WARRANTY_AT_INTAKE', N'OUT_OF_WARRANTY', N'Hết bảo hành', N'Hết bảo hành', N'danger', 2),
  (N'WARRANTY_CLASS', N'FREE_WARRANTY', N'Hợp lệ (Miễn phí)', N'Trong bảo hành', N'success', 1),
  (N'WARRANTY_CLASS', N'OUT_OF_WARRANTY', N'Ngoài bảo hành (Tính phí)', N'Ngoài bảo hành', N'warning', 2),
  (N'WARRANTY_CLASS', N'PARTIAL_WARRANTY', N'Bảo hành một phần', N'Bảo hành một phần', N'warning', 3),
  (N'WARRANTY_REQUEST_STATUS', N'CANCELLED', N'Đã hủy', N'Đã hủy', N'neutral', 3),
  (N'WARRANTY_REQUEST_STATUS', N'CONVERTED', N'Đã tiếp nhận', N'Đã tiếp nhận', N'success', 2),
  (N'WARRANTY_REQUEST_STATUS', N'PENDING_INTAKE', N'Chờ tiếp nhận', N'Chờ tiếp nhận', N'warning', 1);
GO
INSERT INTO QuyenHan (MaQuyen, MoTa) VALUES
  (N'ACCOUNT_MANAGE', N'Quản lý tài khoản & phân quyền'),
  (N'AUDIT_READ', N'Xem nhật ký thao tác'),
  (N'CATALOG_MANAGE', N'Quản lý danh mục'),
  (N'CATALOG_READ', N'Xem danh mục'),
  (N'CUSTOMER_ARCHIVE', N'Lưu trữ / xóa hồ sơ khách'),
  (N'CUSTOMER_ACCOUNT_MANAGE', N'Quản lý tài khoản khách (khóa / mở khóa)'),
  (N'CUSTOMER_CREATE', N'Tạo hồ sơ khách'),
  (N'CUSTOMER_MERGE', N'Hợp nhất hồ sơ khách'),
  (N'CUSTOMER_READ_CONTACT', N'Xem liên hệ khách'),
  (N'CUSTOMER_PASSWORD_RESET', N'Đặt lại mật khẩu tài khoản khách'),
  (N'CUSTOMER_READ_PAYMENTS', N'Xem lịch sử thanh toán của khách'),
  (N'CUSTOMER_UPDATE_CONTACT', N'Sửa liên hệ khách'),
  (N'DEVICE_LOOKUP', N'Tra cứu Serial/IMEI, bảo hành'),
  (N'DEVICE_REGISTER', N'Đăng ký thiết bị'),
  (N'HANDOVER_COMPLETE', N'Hoàn tất bàn giao'),
  (N'INVENTORY_READ', N'Xem tồn kho'),
  (N'INVENTORY_READ_COST', N'Xem giá vốn'),
  (N'PAYMENT_COLLECT', N'Thu tiền / xác nhận miễn phí'),
  (N'PAYMENT_READ', N'Xem thanh toán'),
  (N'PORTAL_SELF', N'Xem phiếu của chính mình'),
  (N'QUOTE_CREATE', N'Lập / sửa báo giá'),
  (N'QUOTE_DECIDE_ON_BEHALF', N'Xác nhận báo giá thay khách tại quầy'),
  (N'QUOTE_DECIDE_OWN', N'Khách tự xác nhận báo giá'),
  (N'QUOTE_REVIEW', N'Duyệt báo giá'),
  (N'REPORT_OPERATIONS', N'Báo cáo vận hành'),
  (N'REPORT_SYSTEM', N'Báo cáo toàn hệ thống (doanh thu...)'),
  (N'STOCK_ISSUE_PROCESS', N'Duyệt / từ chối xuất kho'),
  (N'STOCK_ISSUE_REQUEST', N'Gửi yêu cầu linh kiện'),
  (N'STOCK_RECEIPT_MANAGE', N'Lập / duyệt / từ chối nhập kho'),
  (N'STOCK_TRANSFER_MANAGE', N'Điều chuyển kệ'),
  (N'TICKET_ASSIGN', N'Phân công KTV'),
  (N'TICKET_CREATE', N'Lập phiếu tiếp nhận'),
  (N'TICKET_DIAGNOSE', N'Chẩn đoán, phân loại bảo hành'),
  (N'TICKET_NOTE_CUSTOMER', N'Ghi chú cho khách'),
  (N'TICKET_NOTE_INTERNAL', N'Ghi chú nội bộ'),
  (N'TICKET_READ_ALL', N'Xem mọi phiếu'),
  (N'TICKET_READ_ASSIGNED', N'Xem phiếu được giao'),
  (N'TICKET_READ_WAREHOUSE_VIEW', N'Xem phiếu dạng kho (không thông tin khách)'),
  (N'TICKET_REASSIGN', N'Đổi KTV phụ trách'),
  (N'TICKET_REPAIR', N'Sửa chữa, ghi kết quả QC'),
  (N'WARRANTY_REQUEST_HANDLE', N'Xử lý yêu cầu bảo hành online');
GO
INSERT INTO TramDichVu (MaTram, TenTram, DiaChi, HoatDong) VALUES
  (N'HCM', N'Trạm HCM', N'TP. Hồ Chí Minh', 1);
GO
INSERT INTO VaiTro (MaVaiTro, TenHienThi, TenCuV1, TrangDich, MoTa) VALUES
  (N'ADMIN', N'Quản trị viên', N'Admin', N'pages/admin.html', N'Tài khoản & phân quyền, tài khoản khách, danh mục, báo cáo, nhật ký'),
  (N'CASHIER', N'Thu ngân & Bàn giao', N'ThuNgan', N'pages/cashier.html', N'Thu tiền, xác nhận miễn phí, bàn giao'),
  (N'CUSTOMER', N'Khách hàng', N'KhachHang', N'pages/customer-portal.html', N'Tài khoản tra cứu của khách'),
  (N'DISPATCHER', N'Điều phối viên', N'QuanLy', N'index.html', N'Phân công, duyệt báo giá, quản lý hồ sơ khách'),
  (N'RECEPTIONIST', N'Tiếp nhận & Lễ tân', N'TiepNhan', N'pages/receptionist.html', N'Lập phiếu tiếp nhận, hồ sơ khách, xác nhận thay khách'),
  (N'TECHNICIAN', N'Kỹ thuật viên', N'KyThuatVien', N'pages/technician.html', N'Chẩn đoán, báo giá, yêu cầu linh kiện, sửa chữa, QC'),
  (N'WAREHOUSE_KEEPER', N'Quản lý kho vật tư', N'ThuKho', N'pages/warehouse.html', N'Nhập / xuất / điều chuyển linh kiện');
GO
INSERT INTO VaiTro_QuyenHan (MaVaiTro, MaQuyen) VALUES
  (N'ADMIN', N'ACCOUNT_MANAGE'),
  (N'ADMIN', N'AUDIT_READ'),
  (N'DISPATCHER', N'AUDIT_READ'),
  (N'ADMIN', N'CATALOG_MANAGE'),
  (N'ADMIN', N'CATALOG_READ'),
  (N'CASHIER', N'CATALOG_READ'),
  (N'DISPATCHER', N'CATALOG_READ'),
  (N'RECEPTIONIST', N'CATALOG_READ'),
  (N'TECHNICIAN', N'CATALOG_READ'),
  (N'WAREHOUSE_KEEPER', N'CATALOG_READ'),
  (N'DISPATCHER', N'CUSTOMER_ARCHIVE'),
  (N'ADMIN', N'CUSTOMER_ACCOUNT_MANAGE'),
  (N'ADMIN', N'CUSTOMER_ARCHIVE'),
  (N'DISPATCHER', N'CUSTOMER_CREATE'),
  (N'RECEPTIONIST', N'CUSTOMER_CREATE'),
  (N'DISPATCHER', N'CUSTOMER_MERGE'),
  (N'ADMIN', N'CUSTOMER_MERGE'),
  (N'CASHIER', N'CUSTOMER_READ_CONTACT'),
  (N'ADMIN', N'CUSTOMER_PASSWORD_RESET'),
  (N'RECEPTIONIST', N'CUSTOMER_PASSWORD_RESET'),
  (N'ADMIN', N'CUSTOMER_READ_CONTACT'),
  (N'DISPATCHER', N'CUSTOMER_READ_CONTACT'),
  (N'RECEPTIONIST', N'CUSTOMER_READ_CONTACT'),
  (N'CASHIER', N'CUSTOMER_READ_PAYMENTS'),
  (N'DISPATCHER', N'CUSTOMER_READ_PAYMENTS'),
  (N'DISPATCHER', N'CUSTOMER_UPDATE_CONTACT'),
  (N'ADMIN', N'CUSTOMER_UPDATE_CONTACT'),
  (N'RECEPTIONIST', N'CUSTOMER_UPDATE_CONTACT'),
  (N'DISPATCHER', N'DEVICE_LOOKUP'),
  (N'RECEPTIONIST', N'DEVICE_LOOKUP'),
  (N'DISPATCHER', N'DEVICE_REGISTER'),
  (N'RECEPTIONIST', N'DEVICE_REGISTER'),
  (N'CASHIER', N'HANDOVER_COMPLETE'),
  (N'DISPATCHER', N'HANDOVER_COMPLETE'),
  (N'RECEPTIONIST', N'HANDOVER_COMPLETE'),
  (N'DISPATCHER', N'INVENTORY_READ'),
  (N'TECHNICIAN', N'INVENTORY_READ'),
  (N'WAREHOUSE_KEEPER', N'INVENTORY_READ'),
  (N'DISPATCHER', N'INVENTORY_READ_COST'),
  (N'WAREHOUSE_KEEPER', N'INVENTORY_READ_COST'),
  (N'CASHIER', N'PAYMENT_COLLECT'),
  (N'CASHIER', N'PAYMENT_READ'),
  (N'DISPATCHER', N'PAYMENT_READ'),
  (N'CUSTOMER', N'PORTAL_SELF'),
  (N'TECHNICIAN', N'QUOTE_CREATE'),
  (N'DISPATCHER', N'QUOTE_DECIDE_ON_BEHALF'),
  (N'RECEPTIONIST', N'QUOTE_DECIDE_ON_BEHALF'),
  (N'CUSTOMER', N'QUOTE_DECIDE_OWN'),
  (N'DISPATCHER', N'QUOTE_REVIEW'),
  (N'ADMIN', N'REPORT_OPERATIONS'),
  (N'DISPATCHER', N'REPORT_OPERATIONS'),
  (N'ADMIN', N'REPORT_SYSTEM'),
  (N'WAREHOUSE_KEEPER', N'STOCK_ISSUE_PROCESS'),
  (N'TECHNICIAN', N'STOCK_ISSUE_REQUEST'),
  (N'WAREHOUSE_KEEPER', N'STOCK_ISSUE_REQUEST'),
  (N'WAREHOUSE_KEEPER', N'STOCK_RECEIPT_MANAGE'),
  (N'WAREHOUSE_KEEPER', N'STOCK_TRANSFER_MANAGE'),
  (N'DISPATCHER', N'TICKET_ASSIGN'),
  (N'RECEPTIONIST', N'TICKET_CREATE'),
  (N'TECHNICIAN', N'TICKET_DIAGNOSE'),
  (N'DISPATCHER', N'TICKET_NOTE_CUSTOMER'),
  (N'TECHNICIAN', N'TICKET_NOTE_CUSTOMER'),
  (N'DISPATCHER', N'TICKET_NOTE_INTERNAL'),
  (N'RECEPTIONIST', N'TICKET_NOTE_INTERNAL'),
  (N'TECHNICIAN', N'TICKET_NOTE_INTERNAL'),
  (N'CASHIER', N'TICKET_READ_ALL'),
  (N'DISPATCHER', N'TICKET_READ_ALL'),
  (N'RECEPTIONIST', N'TICKET_READ_ALL'),
  (N'TECHNICIAN', N'TICKET_READ_ASSIGNED'),
  (N'WAREHOUSE_KEEPER', N'TICKET_READ_WAREHOUSE_VIEW'),
  (N'DISPATCHER', N'TICKET_REASSIGN'),
  (N'TECHNICIAN', N'TICKET_REPAIR'),
  (N'DISPATCHER', N'WARRANTY_REQUEST_HANDLE'),
  (N'RECEPTIONIST', N'WARRANTY_REQUEST_HANDLE');
GO
ALTER TABLE ChuyenTrangThaiHopLe WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE DanhMucNhan WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE QuyenHan WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE TramDichVu WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE VaiTro WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE VaiTro_QuyenHan WITH CHECK CHECK CONSTRAINT ALL;
GO
COMMIT;
GO
-- Sinh bởi tools/MySqlToSqlServer.java — không sửa tay.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
BEGIN TRANSACTION;
GO
ALTER TABLE BangGiaDichVu NOCHECK CONSTRAINT ALL;
ALTER TABLE BoDemMa NOCHECK CONSTRAINT ALL;
ALTER TABLE ChinhSachBaoHanh NOCHECK CONSTRAINT ALL;
ALTER TABLE ChiTietBaoGia NOCHECK CONSTRAINT ALL;
ALTER TABLE ChiTietNhapKho NOCHECK CONSTRAINT ALL;
ALTER TABLE ChiTietXuatKho NOCHECK CONSTRAINT ALL;
ALTER TABLE GhiChuPhieu NOCHECK CONSTRAINT ALL;
ALTER TABLE HangSanXuat NOCHECK CONSTRAINT ALL;
ALTER TABLE HangSanXuat_NhomThietBi NOCHECK CONSTRAINT ALL;
ALTER TABLE HoaDon_PhieuThu NOCHECK CONSTRAINT ALL;
ALTER TABLE KetQuaSuaChua NOCHECK CONSTRAINT ALL;
ALTER TABLE KhachHang NOCHECK CONSTRAINT ALL;
ALTER TABLE LichSuPhanCong NOCHECK CONSTRAINT ALL;
ALTER TABLE LichSuTrangThai_ThietBi NOCHECK CONSTRAINT ALL;
ALTER TABLE LinhKien NOCHECK CONSTRAINT ALL;
ALTER TABLE LoaiThietBi NOCHECK CONSTRAINT ALL;
ALTER TABLE MaXacThucOTP NOCHECK CONSTRAINT ALL;
ALTER TABLE NhaCungCap NOCHECK CONSTRAINT ALL;
ALTER TABLE NhanVien NOCHECK CONSTRAINT ALL;
ALTER TABLE NhatKyThaoTac NOCHECK CONSTRAINT ALL;
ALTER TABLE NhomThietBi NOCHECK CONSTRAINT ALL;
ALTER TABLE PhanCong NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuBanGiao NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuBaoGia NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuDieuChuyen NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuKiemTra NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuNhapKho NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuSuaChua NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuTiepNhan NOCHECK CONSTRAINT ALL;
ALTER TABLE PhieuXuatKho NOCHECK CONSTRAINT ALL;
ALTER TABLE RefreshToken NOCHECK CONSTRAINT ALL;
ALTER TABLE SanPham NOCHECK CONSTRAINT ALL;
ALTER TABLE TaiKhoan NOCHECK CONSTRAINT ALL;
ALTER TABLE TaiKhoan_VaiTro NOCHECK CONSTRAINT ALL;
ALTER TABLE TepDinhKem NOCHECK CONSTRAINT ALL;
ALTER TABLE ThietBi NOCHECK CONSTRAINT ALL;
ALTER TABLE ThietBiNhanThongBao NOCHECK CONSTRAINT ALL;
ALTER TABLE ThongBao NOCHECK CONSTRAINT ALL;
ALTER TABLE ThongBao_DaDoc NOCHECK CONSTRAINT ALL;
ALTER TABLE TonKhoTheoKe NOCHECK CONSTRAINT ALL;
ALTER TABLE YeuCauBaoHanh NOCHECK CONSTRAINT ALL;
GO
INSERT INTO BangGiaDichVu (MaDichVu, TenDichVu, MaNhom, DonGia, HoatDong) VALUES
  (N'DV-AUDIO', N'Công sửa chữa — Audio/Wearables', N'AUDIO_WEARABLE', 120000.00, 1),
  (N'DV-GIADUNG', N'Công sửa chữa — Thiết bị gia dụng', N'HOME_APPLIANCE', 350000.00, 1),
  (N'DV-LAPTOP', N'Công sửa chữa — Laptop/Tablet', N'LAPTOP_TABLET', 250000.00, 1),
  (N'DV-NHO', N'Công sửa chữa — Điện tử nhỏ', N'SMALL_ELECTRONICS', 150000.00, 1),
  (N'DV-SMARTPHONE', N'Công sửa chữa — Điện thoại', N'PHONE', 150000.00, 1),
  (N'DV-TV', N'Công sửa chữa — TV/Monitor', N'TV_MONITOR', 300000.00, 1);
GO
INSERT INTO BoDemMa (Khoa, GiaTri) VALUES
  (N'BG-2026-0907', 1),
  (N'BG-2026-0912', 1),
  (N'BG-2026-0914', 1),
  (N'CS', 14),
  (N'DC-2026', 1),
  (N'KH', 4),
  (N'KQ-2026', 2),
  (N'NCC', 6),
  (N'NV', 107),
  (N'PBG-2026', 3),
  (N'PC-2026', 4),
  (N'PKT-2026', 4),
  (N'PN-2026', 3),
  (N'PSC-2026', 4),
  (N'PT-2026', 2),
  (N'PX-2026', 2),
  (N'SP', 5),
  (N'TB', 5),
  (N'TN-2026-0907', 1),
  (N'TN-2026-0908', 1),
  (N'TN-2026-0912', 1),
  (N'TN-2026-0914', 1),
  (N'YC-2026-0917', 1);
GO
INSERT INTO ChinhSachBaoHanh (MaChinhSach, PhamVi, MaSP, MaHang, TenChinhSach, SoThangBaoHanh, DieuKienBaoHanh, TruongHopTuChoi, NhaPhanPhoi, HoatDong) VALUES
  (N'CS-0001', N'PRODUCT', N'SP-0001', N'APPLE', N'Bảo hành chính hãng Apple 12 tháng', 12, N'Lỗi phần cứng do nhà sản xuất, còn hạn bảo hành, tem nguyên vẹn.', N'Vào nước, rơi vỡ, tự ý sửa chữa bên ngoài, mất tem bảo hành.', N'Apple Việt Nam (qua FPT Trading)', 1),
  (N'CS-0002', N'PRODUCT', N'SP-0002', N'APPLE', N'Bảo hành chính hãng Apple 12 tháng', 12, N'Lỗi phần cứng do nhà sản xuất, còn hạn bảo hành.', N'Vào nước, cháy nổ do nguồn điện ngoài, màn hình vỡ do va đập.', N'Apple Việt Nam (qua FPT Trading)', 1),
  (N'CS-0003', N'PRODUCT', N'SP-0003', N'SAMSUNG', N'Bảo hành chính hãng Samsung 12 tháng', 12, N'Lỗi phần cứng do nhà sản xuất, còn hạn bảo hành.', N'Vào nước không thuộc dòng kháng nước, rơi vỡ.', N'Samsung Việt Nam', 1),
  (N'CS-0004', N'PRODUCT', N'SP-0004', N'DELL', N'Bảo hành Dell 24 tháng', 24, N'Lỗi bo mạch, bàn phím, pin theo tiêu chuẩn Dell.', N'Cháy nổ do nguồn điện ngoài, hư hỏng do tác động vật lý.', N'Dell Việt Nam', 1),
  (N'CS-0005', N'BRAND', NULL, N'SAMSUNG', N'Chính sách bảo hành Samsung', 24, N'Bảo hành chính hãng', N'Không bảo hành lỗi rơi vỡ/vào nước ngoài dòng chống nước', N'Samsung Việt Nam', 1),
  (N'CS-0006', N'BRAND', NULL, N'APPLE', N'Chính sách bảo hành Apple', 12, N'Bảo hành qua nhà phân phối ủy quyền', N'Không gồm rơi vỡ/vào nước', N'Apple Việt Nam (qua FPT Trading)', 1),
  (N'CS-0007', N'BRAND', NULL, N'LG', N'Chính sách bảo hành LG', 24, N'Bảo hành chính hãng toàn quốc', NULL, N'LG Electronics Việt Nam', 1),
  (N'CS-0008', N'BRAND', NULL, N'ASUS', N'Chính sách bảo hành ASUS', 12, N'Riêng pin bảo hành 6 tháng', N'Không gồm rơi vỡ/vào nước', N'ASUS Việt Nam', 1),
  (N'CS-0009', N'BRAND', NULL, N'ELECTROLUX', N'Chính sách bảo hành Electrolux', 24, N'Bảo hành chính hãng, riêng block máy nén 60 tháng', NULL, N'Electrolux Việt Nam', 1),
  (N'CS-0010', N'BRAND', NULL, N'DAIKIN', N'Chính sách bảo hành Daikin', 24, N'Riêng gas lạnh bảo hành 12 tháng', NULL, N'Daikin Việt Nam', 1),
  (N'CS-0011', N'BRAND', NULL, N'TPLINK', N'Chính sách bảo hành TP-Link', 24, N'Đổi mới trong 12 tháng đầu nếu lỗi nhà sản xuất', NULL, N'TP-Link Việt Nam', 1),
  (N'CS-0012', N'BRAND', NULL, N'CANON', N'Chính sách bảo hành Canon', 12, N'Bảo hành chính hãng', N'Không gồm hao mòn mực/đầu phun do sử dụng', N'Canon Marketing Việt Nam', 1),
  (N'CS-0013', N'BRAND', NULL, N'SONY', N'Chính sách bảo hành Sony', 12, N'Bảo hành chính hãng qua Sony Việt Nam', NULL, N'Sony Việt Nam', 1),
  (N'CS-0014', N'BRAND', NULL, N'DELL', N'Chính sách bảo hành Dell', 36, N'Bảo hành tại chỗ 36 tháng cho dòng UltraSharp', NULL, N'Dell Việt Nam', 1);
GO
SET IDENTITY_INSERT ChiTietBaoGia ON;
INSERT INTO ChiTietBaoGia (MaChiTietBG, MaBaoGia, SoThuTu, MaLK, NoiDungMuc, SoLuong, DonGia, TienCongSuaChua, ThanhTien) VALUES
  (1, N'BG-2026-0907-00001', 1, N'LK002', N'Thay pin MacBook Air M2 chính hãng', 1, 1800000.00, 200000.00, 2000000.00),
  (2, N'BG-2026-0914-00001', 1, N'LK004', N'Thay bàn phím Laptop Dell Inspiron 15', 1, 600000.00, 150000.00, 750000.00),
  (3, N'BG-2026-0912-00001', 1, NULL, N'Củ tai nghe AirPods Pro bên phải (đặt hàng riêng theo hãng)', 1, 1600000.00, 100000.00, 1700000.00);
SET IDENTITY_INSERT ChiTietBaoGia OFF;
GO
SET IDENTITY_INSERT ChiTietNhapKho ON;
INSERT INTO ChiTietNhapKho (MaChiTietNhap, MaPhieuNhap, MaLK, SoLuongNhap, DonGiaNhap, SerialLo, MaKe) VALUES
  (1, N'PN-2026-00001', N'LK001', 4, 2800000.00, N'BATCH-LK001-0901', N'KHO-A-01-01'),
  (2, N'PN-2026-00001', N'LK002', 2, 1200000.00, N'BATCH-LK002-0901', N'KHO-A-02-01'),
  (4, N'PN-2026-00002', N'LK006', 2, 150000.00, NULL, N'KHO-A-03-01'),
  (5, N'PN-2026-00003', N'LK-CHG-MOD01', 30, 217000.00, N'BATCH-CHG-0917A', NULL),
  (6, N'PN-2026-00003', N'LK-PWR-IC01', 50, 67000.00, N'BATCH-IC-0917B', NULL);
SET IDENTITY_INSERT ChiTietNhapKho OFF;
GO
SET IDENTITY_INSERT ChiTietXuatKho ON;
INSERT INTO ChiTietXuatKho (MaChiTietXuat, MaPhieuXuat, MaLK, SoLuongXuat, DonGiaXuat, MaKe, NgayHetHanBaoHanhLK) VALUES
  (1, N'PX-2026-00001', N'LK002', 1, 1200000.00, N'KHO-A-02-01', '2027-03-08'),
  (2, N'PX-2026-00002', N'LK004', 1, 350000.00, NULL, NULL);
SET IDENTITY_INSERT ChiTietXuatKho OFF;
GO
SET IDENTITY_INSERT GhiChuPhieu ON;
INSERT INTO GhiChuPhieu (MaGhiChu, MaPhieuTN, Loai, NoiDung, NguoiViet, VaiTroNguoiViet, ThoiGian) VALUES
  (1, N'TN-2026-0908-00001', N'CUSTOMER', N'Đã hoàn tất kiểm tra nguồn và cập nhật firmware.', N'NV-103', N'TECHNICIAN', '2026-09-08T14:05:00');
SET IDENTITY_INSERT GhiChuPhieu OFF;
GO
INSERT INTO HangSanXuat (MaHang, TenHang, HoatDong) VALUES
  (N'APPLE', N'Apple', 1),
  (N'ASUS', N'ASUS', 1),
  (N'CANON', N'Canon', 1),
  (N'DAIKIN', N'Daikin', 1),
  (N'DELL', N'Dell', 1),
  (N'ELECTROLUX', N'Electrolux', 1),
  (N'LG', N'LG', 1),
  (N'MICROSOFT', N'Microsoft', 1),
  (N'SAMSUNG', N'Samsung', 1),
  (N'SONY', N'Sony', 1),
  (N'TPLINK', N'TP-Link', 1);
GO
INSERT INTO HangSanXuat_NhomThietBi (MaHang, MaNhom) VALUES
  (N'APPLE', N'AUDIO_WEARABLE'),
  (N'SAMSUNG', N'AUDIO_WEARABLE'),
  (N'SONY', N'AUDIO_WEARABLE'),
  (N'DAIKIN', N'HOME_APPLIANCE'),
  (N'ELECTROLUX', N'HOME_APPLIANCE'),
  (N'LG', N'HOME_APPLIANCE'),
  (N'SAMSUNG', N'HOME_APPLIANCE'),
  (N'APPLE', N'LAPTOP_TABLET'),
  (N'ASUS', N'LAPTOP_TABLET'),
  (N'DELL', N'LAPTOP_TABLET'),
  (N'APPLE', N'PHONE'),
  (N'SAMSUNG', N'PHONE'),
  (N'CANON', N'SMALL_ELECTRONICS'),
  (N'MICROSOFT', N'SMALL_ELECTRONICS'),
  (N'SONY', N'SMALL_ELECTRONICS'),
  (N'TPLINK', N'SMALL_ELECTRONICS'),
  (N'DELL', N'TV_MONITOR'),
  (N'LG', N'TV_MONITOR');
GO
INSERT INTO HoaDon_PhieuThu (MaPhieuThu, MaPhieuTN, MaBaoGia, LoaiThu, NgayThu, NguoiNopTien, SoTienThu, HinhThucThanhToan, MaThuNgan, GhiChu) VALUES
  (N'PT-2026-00001', N'TN-2026-0908-00001', NULL, N'FREE_WARRANTY', '2026-09-09T09:00:00', N'Nguyễn Minh Tuấn', 0.00, N'NONE', N'NV-107', N'Bảo hành chính hãng — không thu phí'),
  (N'PT-2026-00002', N'TN-2026-0907-00001', N'BG-2026-0907-00001', N'CHARGED', '2026-09-08T11:30:00', N'Trần Thu Mai', 2160000.00, N'BANK_TRANSFER', N'NV-107', N'Đã đối chiếu đủ theo báo giá');
GO
INSERT INTO KetQuaSuaChua (MaKetQua, MaPhieuSC, MaKTV, NoiDungSuaChua, KetQuaQCTungBuoc, KetQuaKCS, ChiTietTestKCS, NgayGhiNhan) VALUES
  (N'KQ-2026-00001', N'PSC-2026-00001', N'NV-103', N'Cập nhật lại firmware, test ổn định nguồn trong 2 giờ.', N'[{"Buoc": "VISUAL", "KetQua": "PASS"}, {"Buoc": "MAIN_FUNCTION", "KetQua": "PASS"}, {"Buoc": "SECONDARY", "KetQua": "PASS"}, {"Buoc": "POWER_CHARGING", "KetQua": "PASS"}, {"Buoc": "DATA", "KetQua": "PASS"}, {"Buoc": "FINAL", "KetQua": "PASS"}]', N'PASS', N'Test sạc, test camera, test khởi động 20 lần — không tái diễn lỗi.', '2026-09-08T14:00:00'),
  (N'KQ-2026-00002', N'PSC-2026-00002', N'NV-103', N'Thay pin mới, hiệu chỉnh lại chỉ số pin trên hệ thống.', N'[{"Buoc": "VISUAL", "KetQua": "PASS"}, {"Buoc": "MAIN_FUNCTION", "KetQua": "PASS"}, {"Buoc": "SECONDARY", "KetQua": "PASS"}, {"Buoc": "POWER_CHARGING", "KetQua": "PASS"}, {"Buoc": "DATA", "KetQua": "PASS"}, {"Buoc": "FINAL", "KetQua": "PASS"}]', N'PASS', N'Test sạc 3 chu kỳ, đo dung lượng pin đạt 100% thiết kế.', '2026-09-08T11:00:00');
GO
INSERT INTO KhachHang (MaKH, HoTen, SDT, Email, DiaChi, MaTaiKhoan, TrangThai, GopVaoMaKH, NgayTao) VALUES
  (N'KH-000001', N'Nguyễn Minh Tuấn', N'0912223001', N'tuan.nm@gmail.com', N'12 Lê Lợi, Q.1, TP.HCM', 18, N'ACTIVE', NULL, '2026-08-30T08:00:00'),
  (N'KH-000002', N'Trần Thu Mai', N'0912223002', N'mai.tt@gmail.com', N'45 Nguyễn Trãi, Thanh Xuân, Hà Nội', 19, N'ACTIVE', NULL, '2026-08-30T08:05:00'),
  (N'KH-000003', N'Lý Gia Bảo', N'0912223003', NULL, N'88 Trần Phú, Nha Trang', NULL, N'ACTIVE', NULL, '2026-08-30T08:10:00'),
  (N'KH-000004', N'Phan Thị Ngọc', N'0912223004', N'ngoc.pt@gmail.com', N'23 Hai Bà Trưng, Huế', NULL, N'ACTIVE', NULL, '2026-08-30T08:15:00');
GO
SET IDENTITY_INSERT LichSuTrangThai_ThietBi ON;
INSERT INTO LichSuTrangThai_ThietBi (MaLichSu, MaPhieuTN, TrangThai, ThoiGianCapNhat, MoTaChiTiet, NguoiCapNhat, TenNguoiCapNhat, VaiTroNguoiCapNhat) VALUES
  (1, N'TN-2026-0908-00001', N'RECEIVED', '2026-09-08T08:30:00', N'Khách hàng bàn giao thiết bị, lập phiếu tiếp nhận.', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST'),
  (2, N'TN-2026-0908-00001', N'INSPECTING', '2026-09-08T09:00:00', N'Trạng thái đổi từ "Đã tiếp nhận" sang "Đang kiểm tra"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (3, N'TN-2026-0908-00001', N'DIAGNOSED', '2026-09-08T10:00:00', N'Trạng thái đổi từ "Đang kiểm tra" sang "Đã chẩn đoán"', N'NV-103', N'Lê Quốc Bình', N'TECHNICIAN'),
  (4, N'TN-2026-0908-00001', N'REPAIRING', '2026-09-08T10:30:00', N'Trạng thái đổi từ "Đã chẩn đoán" sang "Đang sửa chữa"', N'NV-103', N'Lê Quốc Bình', N'TECHNICIAN'),
  (5, N'TN-2026-0908-00001', N'COMPLETED', '2026-09-08T14:00:00', N'Trạng thái đổi từ "Đang sửa chữa" sang "Hoàn thành" (QC đạt)', N'NV-103', N'Lê Quốc Bình', N'TECHNICIAN'),
  (6, N'TN-2026-0908-00001', N'DELIVERED', '2026-09-09T09:15:00', N'Trạng thái đổi từ "Hoàn thành" sang "Đã bàn giao"', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST'),
  (7, N'TN-2026-0907-00001', N'RECEIVED', '2026-09-07T13:45:00', N'Khách hàng bàn giao thiết bị, lập phiếu tiếp nhận.', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST'),
  (8, N'TN-2026-0907-00001', N'INSPECTING', '2026-09-07T14:00:00', N'Trạng thái đổi từ "Đã tiếp nhận" sang "Đang kiểm tra"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (9, N'TN-2026-0907-00001', N'DIAGNOSED', '2026-09-07T15:00:00', N'Trạng thái đổi từ "Đang kiểm tra" sang "Đã chẩn đoán"', N'NV-103', N'Lê Quốc Bình', N'TECHNICIAN'),
  (10, N'TN-2026-0907-00001', N'AWAITING_QUOTE_APPROVAL', '2026-09-07T15:30:00', N'Trạng thái đổi từ "Đã chẩn đoán" sang "Chờ duyệt giá"', N'NV-103', N'Lê Quốc Bình', N'TECHNICIAN'),
  (11, N'TN-2026-0907-00001', N'AWAITING_CUSTOMER_CONFIRMATION', '2026-09-07T16:00:00', N'Trạng thái đổi từ "Chờ duyệt giá" sang "Chờ khách xác nhận"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (12, N'TN-2026-0907-00001', N'AWAITING_PARTS', '2026-09-07T18:00:00', N'Trạng thái đổi từ "Chờ khách xác nhận" sang "Chờ linh kiện" (khách xác nhận trên Cổng khách hàng)', N'KH:KH-000002', N'Trần Thu Mai', N'CUSTOMER'),
  (13, N'TN-2026-0907-00001', N'REPAIRING', '2026-09-08T08:30:00', N'Trạng thái đổi từ "Chờ linh kiện" sang "Đang sửa chữa"', N'NV-106', N'Vũ Thị Em', N'WAREHOUSE_KEEPER'),
  (14, N'TN-2026-0907-00001', N'COMPLETED', '2026-09-08T11:00:00', N'Trạng thái đổi từ "Đang sửa chữa" sang "Hoàn thành" (QC đạt)', N'NV-103', N'Lê Quốc Bình', N'TECHNICIAN'),
  (15, N'TN-2026-0907-00001', N'DELIVERED', '2026-09-08T16:00:00', N'Trạng thái đổi từ "Hoàn thành" sang "Đã bàn giao"', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST'),
  (16, N'TN-2026-0914-00001', N'RECEIVED', '2026-09-14T09:20:00', N'Khách hàng bàn giao thiết bị, lập phiếu tiếp nhận.', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST'),
  (17, N'TN-2026-0914-00001', N'INSPECTING', '2026-09-14T09:40:00', N'Trạng thái đổi từ "Đã tiếp nhận" sang "Đang kiểm tra"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (18, N'TN-2026-0914-00001', N'DIAGNOSED', '2026-09-14T10:15:00', N'Trạng thái đổi từ "Đang kiểm tra" sang "Đã chẩn đoán"', N'NV-104', N'Phạm Minh Chinh', N'TECHNICIAN'),
  (19, N'TN-2026-0914-00001', N'AWAITING_QUOTE_APPROVAL', '2026-09-14T10:30:00', N'Trạng thái đổi từ "Đã chẩn đoán" sang "Chờ duyệt giá"', N'NV-104', N'Phạm Minh Chinh', N'TECHNICIAN'),
  (20, N'TN-2026-0914-00001', N'AWAITING_CUSTOMER_CONFIRMATION', '2026-09-14T11:00:00', N'Trạng thái đổi từ "Chờ duyệt giá" sang "Chờ khách xác nhận"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (21, N'TN-2026-0914-00001', N'AWAITING_PARTS', '2026-09-14T13:00:00', N'Trạng thái đổi từ "Chờ khách xác nhận" sang "Chờ linh kiện" (khách xác nhận trên Cổng khách hàng)', N'KH:KH-000004', N'Phan Thị Ngọc', N'CUSTOMER'),
  (22, N'TN-2026-0912-00001', N'RECEIVED', '2026-09-12T11:00:00', N'Khách hàng bàn giao thiết bị, lập phiếu tiếp nhận.', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST'),
  (23, N'TN-2026-0912-00001', N'INSPECTING', '2026-09-12T11:20:00', N'Trạng thái đổi từ "Đã tiếp nhận" sang "Đang kiểm tra"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (24, N'TN-2026-0912-00001', N'DIAGNOSED', '2026-09-12T13:00:00', N'Trạng thái đổi từ "Đang kiểm tra" sang "Đã chẩn đoán"', N'NV-105', N'Hoàng Anh Dũng', N'TECHNICIAN'),
  (25, N'TN-2026-0912-00001', N'AWAITING_QUOTE_APPROVAL', '2026-09-12T13:30:00', N'Trạng thái đổi từ "Đã chẩn đoán" sang "Chờ duyệt giá"', N'NV-105', N'Hoàng Anh Dũng', N'TECHNICIAN'),
  (26, N'TN-2026-0912-00001', N'AWAITING_CUSTOMER_CONFIRMATION', '2026-09-12T14:00:00', N'Trạng thái đổi từ "Chờ duyệt giá" sang "Chờ khách xác nhận"', N'NV-101', N'Trần Thị Hoa', N'DISPATCHER'),
  (27, N'TN-2026-0912-00001', N'CANCELLED', '2026-09-12T16:00:00', N'Trạng thái đổi từ "Chờ khách xác nhận" sang "Đã hủy" (khách xác nhận trên Cổng khách hàng)', N'KH:KH-000003', N'Lý Gia Bảo', N'CUSTOMER'),
  (28, N'TN-2026-0912-00001', N'RETURNED_UNREPAIRED', '2026-09-13T10:00:00', N'Trạng thái đổi từ "Đã hủy" sang "Đã trả máy (hủy)"', N'NV-102', N'Nguyễn Văn An', N'RECEPTIONIST');
SET IDENTITY_INSERT LichSuTrangThai_ThietBi OFF;
GO
INSERT INTO LinhKien (MaLK, TenLK, DonViTinh, MaNhom, TenHang, DonGiaVon, DonGiaDichVu, SoLuongTon, SoLuongDaGiu, DinhMucTonToiThieu, KeChinh, ThoiHanBaoHanhThang, MaNCC, HoatDong, PhienBan) VALUES
  (N'LK-BAT-LI01', N'Pin Li-ion laptop', N'Cái', N'LAPTOP_TABLET', N'ASUS', 686000.00, 980000.00, 15, 0, 6, N'KHO-B-02-03', 6, N'NCC-005', 1, 0),
  (N'LK-BOARD-RT01', N'Mainboard router', N'Cái', N'SMALL_ELECTRONICS', N'TP-Link', 294000.00, 420000.00, 2, 0, 4, N'KHO-C-03-02', 6, N'NCC-004', 1, 0),
  (N'LK-CART-PR01', N'Cartridge assembly máy in', N'Cái', N'SMALL_ELECTRONICS', N'Canon', 476000.00, 680000.00, 7, 0, 4, N'KHO-C-03-08', 3, N'NCC-006', 1, 0),
  (N'LK-CHG-MOD01', N'Module sạc smartphone', N'Cái', N'PHONE', N'Samsung', 217000.00, 310000.00, 22, 0, 8, N'KHO-C-01-09', 6, N'NCC-005', 1, 0),
  (N'LK-COMP-RF01', N'Block máy nén tủ lạnh inverter', N'Cái', N'HOME_APPLIANCE', N'Samsung', 1995000.00, 2850000.00, 12, 0, 5, N'KHO-A-03-02', 12, N'NCC-004', 1, 0),
  (N'LK-CTRL-GC01', N'Controller board gaming console', N'Cái', N'SMALL_ELECTRONICS', N'Sony', 623000.00, 890000.00, 4, 0, 4, N'KHO-C-04-01', 6, N'NCC-006', 1, 0),
  (N'LK-CTRL-WM02', N'Bo mạch điều khiển máy giặt', N'Cái', N'HOME_APPLIANCE', N'Electrolux', 1015000.00, 1450000.00, 6, 0, 5, N'KHO-A-04-05', 6, N'NCC-004', 1, 0),
  (N'LK-DISP-OLED', N'Màn hình OLED thay thế', N'Cái', N'TV_MONITOR', N'LG', 2240000.00, 3200000.00, 8, 0, 5, N'KHO-B-01-07', 6, N'NCC-005', 1, 0),
  (N'LK-FAN-COOL02', N'Motor quạt dàn lạnh', N'Cái', N'HOME_APPLIANCE', N'Daikin', 427000.00, 610000.00, 5, 0, 6, N'KHO-A-03-06', 6, N'NCC-006', 1, 0),
  (N'LK-MOT-DRN01', N'Motor xả máy giặt', N'Cái', N'HOME_APPLIANCE', N'Electrolux', 364000.00, 520000.00, 9, 0, 4, N'KHO-A-04-08', 6, N'NCC-004', 1, 0),
  (N'LK-PWR-IC01', N'IC nguồn', N'Cái', N'SMALL_ELECTRONICS', N'Generic', 67000.00, 95000.00, 40, 0, 10, N'KHO-C-02-11', 3, N'NCC-005', 1, 0),
  (N'LK001', N'Màn hình iPhone 14 chính hãng', N'Cái', N'PHONE', N'Apple', 2800000.00, 3500000.00, 12, 0, 3, N'KHO-A-01-01', 6, N'NCC-001', 1, 1),
  (N'LK002', N'Pin MacBook Air M2', N'Cái', N'LAPTOP_TABLET', N'Apple', 1200000.00, 1800000.00, 5, 0, 3, N'KHO-A-02-01', 6, N'NCC-001', 1, 3),
  (N'LK003', N'Pin Galaxy S23', N'Cái', N'PHONE', N'Samsung', 450000.00, 750000.00, 12, 0, 5, N'KHO-B-01-01', 6, N'NCC-002', 1, 0),
  (N'LK004', N'Bàn phím Laptop Dell Inspiron 15', N'Cái', N'LAPTOP_TABLET', N'Dell', 350000.00, 600000.00, 6, 1, 4, N'KHO-B-02-01', 3, N'NCC-002', 1, 1),
  (N'LK005', N'Cáp sạc Type-C chính hãng', N'Cái', N'PHONE', N'Generic', 90000.00, 180000.00, 25, 0, 10, N'KHO-C-01-01', 3, N'NCC-003', 1, 0),
  (N'LK006', N'IC nguồn iPhone (đa dụng)', N'Cái', N'PHONE', N'Apple', 150000.00, 400000.00, 4, 0, 5, N'KHO-A-03-01', 3, N'NCC-003', 1, 1);
GO
INSERT INTO LoaiThietBi (MaLoai, MaNhom, TenLoai, LoaiDinhDanh, ChecklistChanDoan, HoatDong) VALUES
  (N'AIR_CONDITIONER', N'HOME_APPLIANCE', N'Máy lạnh', N'SERIAL', N'["Block lạnh", "Gas lạnh", "Bo mạch điều khiển", "Quạt dàn lạnh"]', 1),
  (N'FRIDGE_INVERTER', N'HOME_APPLIANCE', N'Tủ lạnh inverter', N'SERIAL', N'["Block máy nén", "Bo mạch inverter", "Cảm biến nhiệt độ", "Motor quạt"]', 1),
  (N'GAME_CONSOLE', N'SMALL_ELECTRONICS', N'Máy chơi game', N'SERIAL', N'["Bo nguồn", "Ổ đĩa quang học", "Hệ thống tản nhiệt", "Cổng kết nối tay cầm"]', 1),
  (N'LAPTOP', N'LAPTOP_TABLET', N'Laptop', N'SERIAL', N'["Pin", "Bo mạch chủ", "Màn hình", "Hệ thống tản nhiệt"]', 1),
  (N'MONITOR', N'TV_MONITOR', N'Monitor', N'SERIAL', N'["Tấm nền (panel)", "Bo nguồn", "Cổng tín hiệu", "Bo điều khiển"]', 1),
  (N'PRINTER', N'SMALL_ELECTRONICS', N'Máy in', N'SERIAL', N'["Đầu phun / trống mực", "Bo mạch điều khiển", "Motor kéo giấy", "Cảm biến giấy"]', 1),
  (N'ROUTER', N'SMALL_ELECTRONICS', N'Router', N'SERIAL', N'["Bo mạch chính", "Nguồn adapter", "Ăng-ten", "Firmware"]', 1),
  (N'SMARTPHONE', N'PHONE', N'Điện thoại', N'IMEI', N'["Pin", "Màn hình cảm ứng", "Camera", "Loa & micro"]', 1),
  (N'SMARTWATCH', N'AUDIO_WEARABLE', N'Smartwatch', N'SERIAL', N'["Pin", "Màn hình cảm ứng", "Cảm biến", "Kết nối Bluetooth"]', 1),
  (N'TABLET', N'LAPTOP_TABLET', N'Tablet', N'SERIAL', N'["Pin", "Màn hình cảm ứng", "Bo mạch chính", "Cổng sạc"]', 1),
  (N'TV', N'TV_MONITOR', N'TV', N'SERIAL', N'["Bo nguồn", "Bo mạch chính", "Tấm nền (panel)", "Đèn nền (backlight)"]', 1),
  (N'TWS_EARBUDS', N'AUDIO_WEARABLE', N'Tai nghe TWS', N'SERIAL', N'["Pin", "Driver âm thanh", "Kết nối Bluetooth", "Hộp sạc"]', 1),
  (N'WASHER_FRONT', N'HOME_APPLIANCE', N'Máy giặt lồng ngang', N'SERIAL', N'["Motor xả", "Bo mạch điều khiển", "Khóa cửa", "Hệ thống cấp nước"]', 1);
GO
INSERT INTO NhaCungCap (MaNCC, TenNCC, SDT, DiaChi, Email, HoatDong) VALUES
  (N'NCC-001', N'Công ty TNHH Linh kiện Việt Phát', N'0281234001', N'Q.10, TP.HCM', N'sales@vietphat.vn', 1),
  (N'NCC-002', N'Công ty CP Phụ kiện Kim Long', N'0281234002', N'Q.Tân Bình, TP.HCM', N'contact@kimlong.vn', 1),
  (N'NCC-003', N'Global Parts Supply Co.', N'0281234003', N'Q.Bình Thạnh, TP.HCM', N'order@globalparts.com', 1),
  (N'NCC-004', N'Sao Nam Electronics', N'0281234004', N'TP. Thủ Đức, TP.HCM', N'sales@saonam.vn', 1),
  (N'NCC-005', N'Digiworld Distribution', N'0281234005', N'Q.3, TP.HCM', N'order@digiworld.vn', 1),
  (N'NCC-006', N'Digilife Supply Co.', N'0281234006', N'Q.7, TP.HCM', N'supply@digilife.vn', 1);
GO
INSERT INTO NhanVien (MaNV, HoTen, SDT, Email, ChuyenMon, KyNang, TrangThaiLamViec, SoPhieuToiDa, CoMatTaiTram, MaTram, MaTaiKhoan) VALUES
  (N'NV-001', N'Lê Minh Tâm', N'0901000001', N'tam.lm@longmanloc.vn', N'Điều phối vận hành', N'[]', N'ACTIVE', 10, 1, N'HCM', 1),
  (N'NV-002', N'Nguyễn Văn A', N'0901000002', N'a.nv@longmanloc.vn', N'Điện lạnh', N'["Điện lạnh", "Điện tử gia dụng"]', N'ACTIVE', 10, 1, N'HCM', 2),
  (N'NV-003', N'Đặng Văn Kiên', N'0901000003', N'kien.dv@longmanloc.vn', N'Kho vật tư', N'[]', N'ACTIVE', 10, 1, N'HCM', 3),
  (N'NV-004', N'Trần Bảo Trâm', N'0901000004', N'tram.tb@longmanloc.vn', N'Lễ tân, thu ngân', N'[]', N'ACTIVE', 10, 1, N'HCM', 4),
  (N'NV-005', N'Lê Hoàng Phúc', N'0901000005', N'phuc.lh@longmanloc.vn', N'TV, màn hình', N'["TV", "Màn hình", "Audio"]', N'ACTIVE', 8, 1, N'HCM', 5),
  (N'NV-006', N'Ngô Bảo Châu', N'0901000006', N'chau.nb@longmanloc.vn', N'Quản trị hệ thống', N'[]', N'ACTIVE', 10, 1, N'HCM', 6),
  (N'NV-007', N'Phạm Thị Ngọc Hân', N'0901000007', N'han.ptn@longmanloc.vn', N'Smartphone', N'["Smartphone", "Thiết bị đeo"]', N'ACTIVE', 9, 0, N'HCM', 7),
  (N'NV-008', N'Trần Minh Khoa', N'0901000008', N'khoa.tm@longmanloc.vn', N'Laptop', N'["Laptop", "PC Gaming"]', N'ACTIVE', 10, 1, N'HCM', 8),
  (N'NV-009', N'Đỗ Anh Tuấn', N'0901000009', N'tuan.da@longmanloc.vn', N'Điện lạnh', N'["Điện lạnh", "Máy giặt", "Điều hòa"]', N'ACTIVE', 8, 1, N'HCM', 9),
  (N'NV-010', N'Hồ Quỳnh Như', N'0901000010', N'nhu.hq@longmanloc.vn', N'Thu ngân', N'[]', N'ACTIVE', 10, 1, N'HCM', 10),
  (N'NV-101', N'Trần Thị Hoa', N'0901111001', N'hoa.tt@baohanh.vn', N'Quản lý vận hành', N'[]', N'ACTIVE', 10, 1, N'HCM', 11),
  (N'NV-102', N'Nguyễn Văn An', N'0901111002', N'an.nv@baohanh.vn', N'Tiếp nhận khách hàng', N'[]', N'ACTIVE', 10, 1, N'HCM', 12),
  (N'NV-103', N'Lê Quốc Bình', N'0901111003', N'binh.lq@baohanh.vn', N'Phần cứng Apple', N'["Smartphone", "Laptop"]', N'ACTIVE', 10, 1, N'HCM', 13),
  (N'NV-104', N'Phạm Minh Chinh', N'0901111004', N'chinh.pm@baohanh.vn', N'Laptop, nguồn', N'["Laptop"]', N'ACTIVE', 10, 1, N'HCM', 14),
  (N'NV-105', N'Hoàng Anh Dũng', N'0901111005', N'dung.ha@baohanh.vn', N'Android, phụ kiện', N'["Smartphone", "Audio"]', N'ACTIVE', 10, 1, N'HCM', 15),
  (N'NV-106', N'Vũ Thị Em', N'0901111006', N'em.vt@baohanh.vn', N'Thủ kho', N'[]', N'ACTIVE', 10, 1, N'HCM', 16),
  (N'NV-107', N'Đỗ Văn Phúc', N'0901111007', N'phuc.dv@baohanh.vn', N'Thu ngân', N'[]', N'ACTIVE', 10, 1, N'HCM', 17);
GO
SET IDENTITY_INSERT NhatKyThaoTac ON;
INSERT INTO NhatKyThaoTac (MaNhatKy, ThoiGian, MaNguoiThaoTac, TenNguoiThaoTac, VaiTro, HanhDong, NhanHanhDong, LoaiDoiTuong, MaDoiTuong, GiaTriTruoc, GiaTriSau) VALUES
  (1, '2026-08-30T08:00:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'CUSTOMER_CREATED', N'Tạo hồ sơ khách hàng', N'CUSTOMER', N'KH-000001', N'—', N'KH-000001 — Nguyễn Minh Tuấn — 0912223001'),
  (2, '2026-08-30T08:05:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'CUSTOMER_CREATED', N'Tạo hồ sơ khách hàng', N'CUSTOMER', N'KH-000002', N'—', N'KH-000002 — Trần Thu Mai — 0912223002'),
  (3, '2026-08-30T08:10:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'CUSTOMER_CREATED', N'Tạo hồ sơ khách hàng', N'CUSTOMER', N'KH-000003', N'—', N'KH-000003 — Lý Gia Bảo — 0912223003'),
  (4, '2026-08-30T08:15:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'CUSTOMER_CREATED', N'Tạo hồ sơ khách hàng', N'CUSTOMER', N'KH-000004', N'—', N'KH-000004 — Phan Thị Ngọc — 0912223004'),
  (5, '2026-08-30T09:00:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'DEVICE_REGISTERED', N'Đăng ký thiết bị', N'DEVICE', N'TB-000001', N'—', N'TB-000001 — 354812109876540 — KH-000001'),
  (6, '2026-08-30T09:01:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'DEVICE_REGISTERED', N'Đăng ký thiết bị', N'DEVICE', N'TB-000002', N'—', N'TB-000002 — C02FH3ABCDEF — KH-000002'),
  (7, '2026-08-30T09:02:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'DEVICE_REGISTERED', N'Đăng ký thiết bị', N'DEVICE', N'TB-000003', N'—', N'TB-000003 — 356789102345673 — KH-000003'),
  (8, '2026-08-30T09:03:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'DEVICE_REGISTERED', N'Đăng ký thiết bị', N'DEVICE', N'TB-000004', N'—', N'TB-000004 — DL2024LAPTOP0099 — KH-000004'),
  (9, '2026-08-30T09:04:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'DEVICE_REGISTERED', N'Đăng ký thiết bị', N'DEVICE', N'TB-000005', N'—', N'TB-000005 — APAIRPRO2025XZ — KH-000003'),
  (10, '2026-09-01T09:00:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_RECEIPT_CREATED', N'Tạo phiếu nhập kho', N'STOCK_RECEIPT', N'PN-2026-00001', N'—', N'PN-2026-00001 — Chờ duyệt'),
  (11, '2026-09-01T09:10:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_RECEIPT_APPROVED', N'Duyệt phiếu nhập kho', N'STOCK_RECEIPT', N'PN-2026-00001', N'PN-2026-00001 — Chờ duyệt', N'PN-2026-00001 — Đã nhập kho'),
  (12, '2026-09-05T10:30:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_RECEIPT_CREATED', N'Tạo phiếu nhập kho', N'STOCK_RECEIPT', N'PN-2026-00002', N'—', N'PN-2026-00002 — Chờ duyệt'),
  (13, '2026-09-05T10:40:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_RECEIPT_APPROVED', N'Duyệt phiếu nhập kho', N'STOCK_RECEIPT', N'PN-2026-00002', N'PN-2026-00002 — Chờ duyệt', N'PN-2026-00002 — Đã nhập kho'),
  (14, '2026-09-08T08:30:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'TICKET_CREATED', N'Tạo phiếu tiếp nhận', N'TICKET', N'TN-2026-0908-00001', N'—', N'TN-2026-0908-00001 — Chưa phân công'),
  (15, '2026-09-08T09:00:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'TICKET_ASSIGNED', N'Phân công kỹ thuật viên', N'TICKET', N'TN-2026-0908-00001', N'TN-2026-0908-00001 — Chưa phân công', N'TN-2026-0908-00001 — Lê Quốc Bình'),
  (16, '2026-09-08T10:00:00', N'NV-103', N'Lê Quốc Bình', N'Kỹ thuật viên', N'INSPECTION_RECORDED', N'Lưu kết quả kiểm tra', N'TICKET', N'TN-2026-0908-00001', N'Đang chẩn đoán', N'Đã chẩn đoán — Trong bảo hành'),
  (17, '2026-09-08T14:00:00', N'NV-103', N'Lê Quốc Bình', N'Kỹ thuật viên', N'REPAIR_COMPLETED', N'Xác nhận hoàn tất sửa chữa', N'TICKET', N'TN-2026-0908-00001', N'TN-2026-0908-00001 — Đang sửa chữa', N'TN-2026-0908-00001 — Sẵn sàng bàn giao'),
  (18, '2026-09-09T09:00:00', N'NV-107', N'Đỗ Văn Phúc', N'Thu ngân & Bàn giao', N'PAYMENT_FREE_WARRANTY', N'Xác nhận miễn phí bảo hành', N'TICKET', N'TN-2026-0908-00001', N'TN-2026-0908-00001 — Chưa thanh toán', N'TN-2026-0908-00001 — Miễn phí bảo hành'),
  (19, '2026-09-09T09:15:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'HANDOVER_COMPLETED', N'Hoàn tất bàn giao', N'TICKET', N'TN-2026-0908-00001', N'TN-2026-0908-00001 — Sẵn sàng bàn giao', N'TN-2026-0908-00001 — Đã hoàn thành'),
  (20, '2026-09-07T13:45:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'TICKET_CREATED', N'Tạo phiếu tiếp nhận', N'TICKET', N'TN-2026-0907-00001', N'—', N'TN-2026-0907-00001 — Chưa phân công'),
  (21, '2026-09-07T14:00:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'TICKET_ASSIGNED', N'Phân công kỹ thuật viên', N'TICKET', N'TN-2026-0907-00001', N'TN-2026-0907-00001 — Chưa phân công', N'TN-2026-0907-00001 — Lê Quốc Bình'),
  (22, '2026-09-07T15:00:00', N'NV-103', N'Lê Quốc Bình', N'Kỹ thuật viên', N'INSPECTION_RECORDED', N'Lưu kết quả kiểm tra', N'TICKET', N'TN-2026-0907-00001', N'Đang chẩn đoán', N'Đã chẩn đoán — Ngoài bảo hành'),
  (23, '2026-09-07T15:30:00', N'NV-103', N'Lê Quốc Bình', N'Kỹ thuật viên', N'QUOTATION_CREATED', N'Gửi phiếu báo giá', N'QUOTATION', N'BG-2026-0907-00001', N'—', N'BG-2026-0907-00001 — Chờ phê duyệt — 2.160.000 đ'),
  (24, '2026-09-07T16:00:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'QUOTATION_APPROVED', N'Phê duyệt báo giá', N'QUOTATION', N'BG-2026-0907-00001', N'Chờ phê duyệt', N'Đã phê duyệt — chờ khách xác nhận'),
  (25, '2026-09-07T18:00:00', N'KH:KH-000002', N'Trần Thu Mai', N'Khách hàng', N'QUOTATION_ACCEPTED', N'Xác nhận báo giá', N'QUOTATION', N'BG-2026-0907-00001', N'Chờ khách xác nhận', N'Đã xác nhận (khách xác nhận trên Cổng khách hàng)'),
  (26, '2026-09-08T08:00:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_ISSUE_REQUESTED', N'Gửi yêu cầu linh kiện', N'STOCK_ISSUE', N'PX-2026-00001', N'—', N'PX-2026-00001 — TN-2026-0907-00001 — LK002 × 1'),
  (27, '2026-09-08T08:30:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_DEDUCTED', N'Tự động trừ tồn kho', N'PART', N'LK002', N'Tồn 6', N'Đã trừ 1 Pin MacBook Air M2 khỏi tồn kho — còn 5'),
  (28, '2026-09-08T08:30:00', N'NV-106', N'Vũ Thị Em', N'Quản lý kho vật tư', N'STOCK_ISSUE_APPROVED', N'Duyệt phiếu xuất kho', N'STOCK_ISSUE', N'PX-2026-00001', N'PX-2026-00001 — Chờ duyệt', N'PX-2026-00001 — Đã xuất kho'),
  (29, '2026-09-08T11:00:00', N'NV-103', N'Lê Quốc Bình', N'Kỹ thuật viên', N'REPAIR_COMPLETED', N'Xác nhận hoàn tất sửa chữa', N'TICKET', N'TN-2026-0907-00001', N'TN-2026-0907-00001 — Đang sửa chữa', N'TN-2026-0907-00001 — Sẵn sàng bàn giao'),
  (30, '2026-09-08T11:30:00', N'NV-107', N'Đỗ Văn Phúc', N'Thu ngân & Bàn giao', N'PAYMENT_COLLECTED', N'Xác nhận đã thanh toán', N'TICKET', N'TN-2026-0907-00001', N'TN-2026-0907-00001 — Chưa thanh toán', N'TN-2026-0907-00001 — Đã thanh toán 2.160.000 đ'),
  (31, '2026-09-08T16:00:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'HANDOVER_COMPLETED', N'Hoàn tất bàn giao', N'TICKET', N'TN-2026-0907-00001', N'TN-2026-0907-00001 — Sẵn sàng bàn giao', N'TN-2026-0907-00001 — Đã hoàn thành'),
  (32, '2026-09-14T09:20:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'TICKET_CREATED', N'Tạo phiếu tiếp nhận', N'TICKET', N'TN-2026-0914-00001', N'—', N'TN-2026-0914-00001 — Chưa phân công'),
  (33, '2026-09-14T09:40:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'TICKET_ASSIGNED', N'Phân công kỹ thuật viên', N'TICKET', N'TN-2026-0914-00001', N'TN-2026-0914-00001 — Chưa phân công', N'TN-2026-0914-00001 — Phạm Minh Chinh'),
  (34, '2026-09-14T10:15:00', N'NV-104', N'Phạm Minh Chinh', N'Kỹ thuật viên', N'INSPECTION_RECORDED', N'Lưu kết quả kiểm tra', N'TICKET', N'TN-2026-0914-00001', N'Đang chẩn đoán', N'Đã chẩn đoán — Ngoài bảo hành'),
  (35, '2026-09-14T10:30:00', N'NV-104', N'Phạm Minh Chinh', N'Kỹ thuật viên', N'QUOTATION_CREATED', N'Gửi phiếu báo giá', N'QUOTATION', N'BG-2026-0914-00001', N'—', N'BG-2026-0914-00001 — Chờ phê duyệt — 810.000 đ'),
  (36, '2026-09-14T11:00:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'QUOTATION_APPROVED', N'Phê duyệt báo giá', N'QUOTATION', N'BG-2026-0914-00001', N'Chờ phê duyệt', N'Đã phê duyệt — chờ khách xác nhận'),
  (37, '2026-09-14T13:00:00', N'KH:KH-000004', N'Phan Thị Ngọc', N'Khách hàng', N'QUOTATION_ACCEPTED', N'Xác nhận báo giá', N'QUOTATION', N'BG-2026-0914-00001', N'Chờ khách xác nhận', N'Đã xác nhận (khách xác nhận trên Cổng khách hàng)'),
  (38, '2026-09-14T14:00:00', N'NV-104', N'Phạm Minh Chinh', N'Kỹ thuật viên', N'STOCK_ISSUE_REQUESTED', N'Gửi yêu cầu linh kiện', N'STOCK_ISSUE', N'PX-2026-00002', N'—', N'PX-2026-00002 — TN-2026-0914-00001 — LK004 × 1'),
  (39, '2026-09-12T11:00:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'TICKET_CREATED', N'Tạo phiếu tiếp nhận', N'TICKET', N'TN-2026-0912-00001', N'—', N'TN-2026-0912-00001 — Chưa phân công'),
  (40, '2026-09-12T11:20:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'TICKET_ASSIGNED', N'Phân công kỹ thuật viên', N'TICKET', N'TN-2026-0912-00001', N'TN-2026-0912-00001 — Chưa phân công', N'TN-2026-0912-00001 — Hoàng Anh Dũng'),
  (41, '2026-09-12T13:00:00', N'NV-105', N'Hoàng Anh Dũng', N'Kỹ thuật viên', N'INSPECTION_RECORDED', N'Lưu kết quả kiểm tra', N'TICKET', N'TN-2026-0912-00001', N'Đang chẩn đoán', N'Đã chẩn đoán — Ngoài bảo hành'),
  (42, '2026-09-12T13:30:00', N'NV-105', N'Hoàng Anh Dũng', N'Kỹ thuật viên', N'QUOTATION_CREATED', N'Gửi phiếu báo giá', N'QUOTATION', N'BG-2026-0912-00001', N'—', N'BG-2026-0912-00001 — Chờ phê duyệt — 1.836.000 đ'),
  (43, '2026-09-12T14:00:00', N'NV-101', N'Trần Thị Hoa', N'Điều phối viên', N'QUOTATION_APPROVED', N'Phê duyệt báo giá', N'QUOTATION', N'BG-2026-0912-00001', N'Chờ phê duyệt', N'Đã phê duyệt — chờ khách xác nhận'),
  (44, '2026-09-12T16:00:00', N'KH:KH-000003', N'Lý Gia Bảo', N'Khách hàng', N'QUOTATION_DECLINED', N'Từ chối báo giá', N'QUOTATION', N'BG-2026-0912-00001', N'Chờ khách xác nhận', N'Khách từ chối — Chi phí thay 1 bên tai cao hơn giá mua tai nghe mới, khách xin nhận lại máy.'),
  (45, '2026-09-13T10:00:00', N'NV-102', N'Nguyễn Văn An', N'Tiếp nhận & Lễ tân', N'HANDOVER_COMPLETED', N'Hoàn tất bàn giao', N'TICKET', N'TN-2026-0912-00001', N'TN-2026-0912-00001 — Ngừng sửa theo yêu cầu khách', N'TN-2026-0912-00001 — Đã trả máy (không sửa)'),
  (46, '2026-09-17T21:02:00', N'PORTAL', NULL, NULL, N'WARRANTY_REQUEST_CREATED', N'Đăng ký yêu cầu bảo hành trực tuyến', N'WARRANTY_REQUEST', N'YC-2026-0917-00001', N'—', N'YC-2026-0917-00001 — Chờ tiếp nhận'),
  (47, '2026-09-16T15:00:00', N'NV-003', N'Đặng Văn Kiên', N'Quản lý kho vật tư', N'STOCK_RECEIPT_CREATED', N'Tạo phiếu nhập kho', N'STOCK_RECEIPT', N'PN-2026-00003', N'—', N'PN-2026-00003 — Chờ duyệt'),
  (48, '2026-09-17T09:00:00', N'NV-003', N'Đặng Văn Kiên', N'Quản lý kho vật tư', N'STOCK_TRANSFER_CREATED', N'Tạo phiếu điều chuyển', N'STOCK_TRANSFER', N'DC-2026-00001', N'—', N'LK-PWR-IC01 × 15: KHO-C-02-11 → KHO-C-01-04');
SET IDENTITY_INSERT NhatKyThaoTac OFF;
GO
INSERT INTO NhomThietBi (MaNhom, TenNhom, ThuTu, HoatDong) VALUES
  (N'AUDIO_WEARABLE', N'Audio/Wearables', 4, 1),
  (N'HOME_APPLIANCE', N'Thiết bị gia dụng', 5, 1),
  (N'LAPTOP_TABLET', N'Laptop/Tablet', 2, 1),
  (N'PHONE', N'Điện thoại', 1, 1),
  (N'SMALL_ELECTRONICS', N'Điện tử nhỏ', 6, 1),
  (N'TV_MONITOR', N'TV/Monitor', 3, 1);
GO
INSERT INTO PhanCong (MaPhanCong, MaPhieuTN, MaNVQuanLy, MaKTV, NgayPhanCong, MucDoUuTien, GhiChu) VALUES
  (N'PC-2026-00001', N'TN-2026-0908-00001', N'NV-101', N'NV-103', '2026-09-08T09:00:00', N'NORMAL', N'Đúng chuyên môn Apple'),
  (N'PC-2026-00002', N'TN-2026-0907-00001', N'NV-101', N'NV-103', '2026-09-07T14:00:00', N'NORMAL', N'MacBook — vẫn thuộc chuyên môn Apple'),
  (N'PC-2026-00003', N'TN-2026-0914-00001', N'NV-101', N'NV-104', '2026-09-14T09:40:00', N'NORMAL', N'Đúng chuyên môn Laptop'),
  (N'PC-2026-00004', N'TN-2026-0912-00001', N'NV-101', N'NV-105', '2026-09-12T11:20:00', N'LOW', N'Phụ kiện — KTV Android xử lý');
GO
INSERT INTO PhieuBanGiao (MaBanGiao, MaPhieuTN, LoaiBanGiao, NgayBanGiao, MaNVBanGiao, NguoiNhanMay, HienTrangKhiTra, TraLaiLinhKienCu, ThoiHanBaoHanhMoi, DanhGiaHaiLong, KT_NgoaiQuanDungBienBan, KT_KhoiDongBinhThuong, KT_ChucNangChinhOK, KT_PhuKienDayDu, KT_KhongLoiPhatSinh, MaTepChuKy, KhachXacNhanNhanMay) VALUES
  (N'PBG-2026-00001', N'TN-2026-0908-00001', N'DELIVERED', '2026-09-09T09:15:00', N'NV-102', N'Nguyễn Minh Tuấn', N'Máy hoạt động ổn định, đã test 20 lần khởi động không lỗi.', 1, NULL, 5, 1, 1, 1, 1, 1, 1, 1),
  (N'PBG-2026-00002', N'TN-2026-0907-00001', N'DELIVERED', '2026-09-08T16:00:00', N'NV-102', N'Trần Thu Mai', N'Máy sạc bình thường, pin đầy 100%.', 1, N'Bảo hành pin mới thay 6 tháng', 4, 1, 1, 1, 1, 1, 2, 1),
  (N'PBG-2026-00003', N'TN-2026-0912-00001', N'RETURNED_UNREPAIRED', '2026-09-13T10:00:00', N'NV-102', N'Lý Gia Bảo', N'Trả nguyên trạng như lúc nhận, không can thiệp sửa chữa.', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1);
GO
INSERT INTO PhieuBaoGia (MaBaoGia, MaPhieuTN, MaPhieuKT, MaKTVLap, NgayLapBaoGia, HanHieuLuc, MaDichVu, TongTienLinhKien, TongTienCong, ThueVAT, TongTienThanhToan, TrangThaiDuyetNoiBo, MaNVQuanLyDuyet, NgayDuyetNoiBo, GhiChuDuyet, KhachXacNhan, NgayKhachXacNhan, LyDoKhachTuChoi, KenhXacNhan, NguoiGhiNhanXacNhan) VALUES
  (N'BG-2026-0907-00001', N'TN-2026-0907-00001', N'PKT-2026-00002', N'NV-103', '2026-09-07T15:30:00', '2026-09-10', N'DV-LAPTOP', 1800000.00, 200000.00, 8.00, 2160000.00, N'APPROVED', N'NV-101', '2026-09-07T16:00:00', N'Đã kiểm tra hợp lý, phê duyệt.', N'ACCEPTED', '2026-09-07T18:00:00', NULL, N'PORTAL', N'KH:KH-000002'),
  (N'BG-2026-0912-00001', N'TN-2026-0912-00001', N'PKT-2026-00004', N'NV-105', '2026-09-12T13:30:00', '2026-09-15', N'DV-AUDIO', 1600000.00, 100000.00, 8.00, 1836000.00, N'APPROVED', N'NV-101', '2026-09-12T14:00:00', NULL, N'DECLINED', '2026-09-12T16:00:00', N'Chi phí thay 1 bên tai cao hơn giá mua tai nghe mới, khách xin nhận lại máy.', N'PORTAL', N'KH:KH-000003'),
  (N'BG-2026-0914-00001', N'TN-2026-0914-00001', N'PKT-2026-00003', N'NV-104', '2026-09-14T10:30:00', '2026-09-17', N'DV-LAPTOP', 600000.00, 150000.00, 8.00, 810000.00, N'APPROVED', N'NV-101', '2026-09-14T11:00:00', NULL, N'ACCEPTED', '2026-09-14T13:00:00', NULL, N'PORTAL', N'KH:KH-000004');
GO
INSERT INTO PhieuDieuChuyen (MaPhieuDC, MaLK, SoLuong, TuKe, DenKe, LyDo, TrangThai, MaNguoiLap, NgayLap, MaNguoiDuyet, NgayDuyet, LyDoTuChoi) VALUES
  (N'DC-2026-00001', N'LK-PWR-IC01', 15, N'KHO-C-02-11', N'KHO-C-01-04', N'Gộp hàng để giải phóng kệ C-02 cho lô nhập mới', N'PENDING', N'NV-003', '2026-09-17T09:00:00', NULL, NULL, NULL);
GO
INSERT INTO PhieuKiemTra (MaPhieuKT, MaPhieuTN, MaKTV, NgayKiemTra, KetQuaKiemTraChiTiet, ChecklistKetQua, TinhTrangVaoNuoc, PhanLoaiBaoHanh, LyDoNgoaiBaoHanh, HuongKhacPhucDeXuat, GhiChuPhanLoaiLai, SoLanSuaPhanLoai, NgayCapNhat) VALUES
  (N'PKT-2026-00001', N'TN-2026-0908-00001', N'NV-103', '2026-09-08T10:00:00', N'Lỗi phần mềm/phần cứng nguồn, không phát hiện dấu hiệu vào nước hay va đập.', N'[{"KetQua": "PASS", "HangMuc": "Pin"}, {"KetQua": "PASS", "HangMuc": "Màn hình cảm ứng"}, {"KetQua": "PASS", "HangMuc": "Camera"}, {"KetQua": "PASS", "HangMuc": "Loa & micro"}]', 0, N'FREE_WARRANTY', NULL, N'Cập nhật firmware, kiểm tra lại nguồn.', NULL, 0, NULL),
  (N'PKT-2026-00002', N'TN-2026-0907-00001', N'NV-103', '2026-09-07T15:00:00', N'Pin chai, sụt áp khi cắm sạc gây chập chờn.', NULL, 0, N'OUT_OF_WARRANTY', N'Thiết bị đã hết hạn bảo hành từ 2025-06-15.', N'Thay pin MacBook Air M2 chính hãng.', NULL, 0, NULL),
  (N'PKT-2026-00003', N'TN-2026-0914-00001', N'NV-104', '2026-09-14T10:15:00', N'Bàn phím liệt 4 phím khu vực WASD, nghi do bụi/đổ nước nhẹ trước đó.', NULL, 0, N'OUT_OF_WARRANTY', N'Khách xác nhận từng làm đổ nước ngọt lên bàn phím tháng trước.', N'Thay cụm bàn phím mới.', NULL, 0, NULL),
  (N'PKT-2026-00004', N'TN-2026-0912-00001', N'NV-105', '2026-09-12T13:00:00', N'Màng loa bên phải bị hỏng, không thể sửa chữa — chỉ thay nguyên củ tai.', NULL, 0, N'OUT_OF_WARRANTY', N'Đã hết hạn bảo hành, lỗi phần cứng không thuộc diện đổi trả.', N'Thay tai nghe bên phải (hàng chính hãng đặt riêng).', NULL, 0, NULL);
GO
INSERT INTO PhieuNhapKho (MaPhieuNhap, MaNCC, SoLo, NgayNhap, MaNguoiLap, NgayLap, TrangThai, MaNguoiDuyet, NgayDuyet, LyDoTuChoi, TongTienNhap, GhiChu) VALUES
  (N'PN-2026-00001', N'NCC-001', N'LOT-0901', '2026-09-01', N'NV-106', '2026-09-01T09:00:00', N'APPROVED', N'NV-106', '2026-09-01T09:10:00', NULL, 13600000.00, N'Nhập bổ sung màn hình iPhone 14 + pin MacBook'),
  (N'PN-2026-00002', N'NCC-003', N'LOT-0905', '2026-09-05', N'NV-106', '2026-09-05T10:30:00', N'APPROVED', N'NV-106', '2026-09-05T10:40:00', NULL, 300000.00, N'Nhập bổ sung IC nguồn — tồn chạm định mức tối thiểu'),
  (N'PN-2026-00003', N'NCC-005', N'LOT-24091', '2026-09-16', N'NV-003', '2026-09-16T15:00:00', N'PENDING', NULL, NULL, NULL, 9860000.00, N'Nhập module sạc + IC nguồn');
GO
INSERT INTO PhieuSuaChua (MaPhieuSC, MaPhieuTN, MaPhanCong, MaKTV, NgayTao, NgayBatDau, TrangThaiSuaChua) VALUES
  (N'PSC-2026-00001', N'TN-2026-0908-00001', N'PC-2026-00001', N'NV-103', '2026-09-08T09:00:00', '2026-09-08T10:30:00', N'DONE'),
  (N'PSC-2026-00002', N'TN-2026-0907-00001', N'PC-2026-00002', N'NV-103', '2026-09-07T14:00:00', '2026-09-08T08:30:00', N'DONE'),
  (N'PSC-2026-00003', N'TN-2026-0914-00001', N'PC-2026-00003', N'NV-104', '2026-09-14T09:40:00', NULL, N'PENDING'),
  (N'PSC-2026-00004', N'TN-2026-0912-00001', N'PC-2026-00004', N'NV-105', '2026-09-12T11:20:00', NULL, N'CANCELLED');
GO
INSERT INTO PhieuTiepNhan (MaPhieuTN, MaTram, NgayTiepNhan, KenhTiepNhan, LoaiYeuCau, MaYeuCau, MaKH, MaThietBi, MaNVTiepNhan, BH_TrangThaiLucNhan, BH_NgayKichHoat, BH_NgayHetHan, BH_MaChinhSach, TinhTrangTem, NQ_VetTray, NQ_CanMop, NQ_NutVo, NQ_DauHieuAmNuoc, NQ_PhuKien, PhuKienKemTheo, TinhTrangNgoaiQuan, KhachXacNhanNgoaiQuan, MoTaLoiKhachBao, NgayHenTra, ChiPhiDuKien, MucSLA, HanSLA, TrangThaiXuLy, NgayCapNhatTrangThai, NguoiCapNhatTrangThai, VaiTroCapNhatTrangThai, GhiChuTrangThai, PhienBan, ConMo) VALUES
  (N'TN-2026-0907-00001', N'HCM', '2026-09-07T13:45:00', N'COUNTER', N'PAID_REPAIR', NULL, N'KH-000002', N'TB-000002', N'NV-102', N'OUT_OF_WARRANTY', '2024-06-15', '2025-06-15', N'CS-0002', N'Không còn tem', N'LIGHT', 0, 0, N'NONE', N'COMPLETE', N'Sạc, cáp', N'Trầy nhẹ góc trái', 1, N'Máy sạc chập chờn, đôi khi không nhận sạc', '2026-09-09T17:00:00', 1800000.00, N'STANDARD_48H', '2026-09-09T13:45:00', N'DELIVERED', '2026-09-08T16:00:00', N'NV-102', N'RECEPTIONIST', NULL, 8, 0),
  (N'TN-2026-0908-00001', N'HCM', '2026-09-08T08:30:00', N'COUNTER', N'WARRANTY', NULL, N'KH-000001', N'TB-000001', N'NV-102', N'IN_WARRANTY', '2025-11-01', '2026-11-01', N'CS-0001', N'Tem nguyên vẹn', N'NONE', 0, 0, N'NONE', N'COMPLETE', N'Không có', N'Không trầy xước', 1, N'Máy tự khởi động lại liên tục', '2026-09-10T17:00:00', 0.00, N'STANDARD_48H', '2026-09-10T08:30:00', N'DELIVERED', '2026-09-09T09:15:00', N'NV-102', N'RECEPTIONIST', NULL, 5, 0),
  (N'TN-2026-0912-00001', N'HCM', '2026-09-12T11:00:00', N'COUNTER', N'PAID_REPAIR', NULL, N'KH-000003', N'TB-000005', N'NV-102', N'OUT_OF_WARRANTY', '2025-08-05', '2026-08-05', N'CS-0006', N'Không còn tem', N'LIGHT', 0, 0, N'NONE', N'COMPLETE', N'Hộp sạc, 2 tai nghe', N'Trầy nhẹ hộp sạc', 1, N'Một bên tai nghe không có âm thanh', '2026-09-14T17:00:00', 900000.00, N'STANDARD_48H', '2026-09-14T11:00:00', N'RETURNED_UNREPAIRED', '2026-09-13T10:00:00', N'NV-102', N'RECEPTIONIST', NULL, 6, 0),
  (N'TN-2026-0914-00001', N'HCM', '2026-09-14T09:20:00', N'MOBILE_APP', N'PAID_REPAIR', NULL, N'KH-000004', N'TB-000004', N'NV-102', N'OUT_OF_WARRANTY', '2024-01-20', '2026-01-20', N'CS-0004', N'Không còn tem', N'NONE', 1, 0, N'SUSPECTED', N'COMPLETE', N'Sạc, túi đựng', N'Móp góc phải, còn hoạt động', 1, N'Một số phím bị liệt, gõ không ăn', '2026-09-17T17:00:00', 600000.00, N'STANDARD_48H', '2026-09-16T09:20:00', N'AWAITING_PARTS', '2026-09-14T13:00:00', N'KH:KH-000004', N'CUSTOMER', N'(khách xác nhận trên Cổng khách hàng)', 5, 1);
GO
INSERT INTO PhieuXuatKho (MaPhieuXuat, MaPhieuTN, NguonXuat, MaBaoGia, LyDoXuat, MaKTVNhan, MaNguoiYeuCau, NgayYeuCau, TrangThai, MaThuKhoXuLy, NgayXuLy, LyDoTuChoi, TongTienXuat) VALUES
  (N'PX-2026-00001', N'TN-2026-0907-00001', N'QUOTATION', N'BG-2026-0907-00001', N'Xuất thay thế sửa chữa', N'NV-103', N'NV-106', '2026-09-08T08:00:00', N'ISSUED', N'NV-106', '2026-09-08T08:30:00', NULL, 1200000.00),
  (N'PX-2026-00002', N'TN-2026-0914-00001', N'QUOTATION', N'BG-2026-0914-00001', N'Xuất thay thế sửa chữa', N'NV-104', N'NV-104', '2026-09-14T14:00:00', N'PENDING', NULL, NULL, NULL, 350000.00);
GO
INSERT INTO SanPham (MaSP, TenSP, MaHang, MaLoai, DongSanPham, ThoiHanBaoHanhMacDinhThang, HoatDong) VALUES
  (N'SP-0001', N'iPhone 14', N'APPLE', N'SMARTPHONE', N'iPhone', 12, 1),
  (N'SP-0002', N'MacBook Air M2', N'APPLE', N'LAPTOP', N'MacBook', 12, 1),
  (N'SP-0003', N'Galaxy S23', N'SAMSUNG', N'SMARTPHONE', N'Galaxy S', 12, 1),
  (N'SP-0004', N'Laptop Inspiron 15', N'DELL', N'LAPTOP', N'Inspiron', 24, 1),
  (N'SP-0005', N'Tai nghe Bluetooth AirPods Pro', N'APPLE', N'TWS_EARBUDS', N'AirPods', 12, 1);
GO
SET IDENTITY_INSERT TaiKhoan ON;
INSERT INTO TaiKhoan (MaTaiKhoan, TenDangNhap, MatKhauHash, LoaiChuThe, TrangThai, SoLanSaiLienTiep, KhoaTamDen, BatBuocDoiMatKhau, PhienBanBaoMat, LanDangNhapCuoi, NgayDoiMatKhau, NgayTao) VALUES
  (1, N'dieuphoi', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (2, N'kythuat', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (3, N'khovattu', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (4, N'letan', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (5, N'ktv.phuc', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (6, N'admin', N'{bcrypt}$2a$12$cxK.HYz3LwntHDeYsQout.xTzVnA8B1QsZH55vYWrp4T5/.G7lqby', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (7, N'ktv.han', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (8, N'kythuat_khoa', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'LOCKED', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (9, N'ktv.tuan', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (10, N'thungan.nhu', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (11, N'quanly.hoa', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (12, N'tiepnhan.an', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (13, N'ktv.binh', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (14, N'ktv.chinh', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (15, N'ktv.dung', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (16, N'thukho.em', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (17, N'thungan.phuc', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'EMPLOYEE', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (18, N'kh.tuan', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'CUSTOMER', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00'),
  (19, N'kh.mai', N'{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm', N'CUSTOMER', N'ACTIVE', 0, NULL, 0, 1, NULL, NULL, '2026-08-01T08:00:00');
SET IDENTITY_INSERT TaiKhoan OFF;
GO
INSERT INTO TaiKhoan_VaiTro (MaTaiKhoan, MaVaiTro) VALUES
  (6, N'ADMIN'),
  (4, N'CASHIER'),
  (10, N'CASHIER'),
  (17, N'CASHIER'),
  (18, N'CUSTOMER'),
  (19, N'CUSTOMER'),
  (1, N'DISPATCHER'),
  (11, N'DISPATCHER'),
  (4, N'RECEPTIONIST'),
  (12, N'RECEPTIONIST'),
  (2, N'TECHNICIAN'),
  (5, N'TECHNICIAN'),
  (7, N'TECHNICIAN'),
  (8, N'TECHNICIAN'),
  (9, N'TECHNICIAN'),
  (13, N'TECHNICIAN'),
  (14, N'TECHNICIAN'),
  (15, N'TECHNICIAN'),
  (3, N'WAREHOUSE_KEEPER'),
  (16, N'WAREHOUSE_KEEPER');
GO
SET IDENTITY_INSERT TepDinhKem ON;
INSERT INTO TepDinhKem (MaTep, LoaiChuSoHuu, MaChuSoHuu, TenTep, LoaiNoiDung, KichThuoc, DuongDanLuuTru, NguoiTaiLen, NgayTaiLen) VALUES
  (1, N'HANDOVER_SIGNATURE', N'TN-2026-0908-00001', N'chu-ky-khach.png', N'image/png', 2048, N'seed/signatures/blank.png', N'NV-102', '2026-09-09T09:14:00'),
  (2, N'HANDOVER_SIGNATURE', N'TN-2026-0907-00001', N'chu-ky-khach.png', N'image/png', 2048, N'seed/signatures/blank.png', N'NV-102', '2026-09-08T15:59:00');
SET IDENTITY_INSERT TepDinhKem OFF;
GO
INSERT INTO ThietBi (MaThietBi, MaSP, LoaiDinhDanh, SoSerial_IMEI, MaKH, NgayKichHoatBaoHanh, NgayHetHanBaoHanh, NhaPhanPhoi, NgayTao) VALUES
  (N'TB-000001', N'SP-0001', N'IMEI', N'354812109876540', N'KH-000001', '2025-11-01', '2026-11-01', N'Apple Việt Nam (qua FPT Trading)', '2026-08-30T09:00:00'),
  (N'TB-000002', N'SP-0002', N'SERIAL', N'C02FH3ABCDEF', N'KH-000002', '2024-06-15', '2025-06-15', N'Apple Việt Nam (qua FPT Trading)', '2026-08-30T09:01:00'),
  (N'TB-000003', N'SP-0003', N'IMEI', N'356789102345673', N'KH-000003', '2026-03-10', '2027-03-10', N'Samsung Việt Nam', '2026-08-30T09:02:00'),
  (N'TB-000004', N'SP-0004', N'SERIAL', N'DL2024LAPTOP0099', N'KH-000004', '2024-01-20', '2026-01-20', N'Dell Việt Nam', '2026-08-30T09:03:00'),
  (N'TB-000005', N'SP-0005', N'SERIAL', N'APAIRPRO2025XZ', N'KH-000003', '2025-08-05', '2026-08-05', N'Apple Việt Nam (qua FPT Trading)', '2026-08-30T09:04:00');
GO
SET IDENTITY_INSERT ThongBao ON;
INSERT INTO ThongBao (MaThongBao, MaVaiTroNhan, MaTaiKhoanNhan, Loai, NoiDung, DuongDan, MaDoiTuong, NgayTao) VALUES
  (1, N'DISPATCHER', NULL, N'TICKET_RECEIVED', N'Phiếu TN-2026-0908-00001 mới tiếp nhận, chờ phân công.', N'index.html', N'TN-2026-0908-00001', '2026-09-08T08:30:00'),
  (2, NULL, 13, N'TICKET_ASSIGNED', N'Bạn được giao phiếu TN-2026-0908-00001.', N'pages/technician.html', N'TN-2026-0908-00001', '2026-09-08T09:00:00'),
  (3, N'CASHIER', NULL, N'TICKET_READY_FOR_HANDOVER', N'Phiếu TN-2026-0908-00001 đã QC đạt — sẵn sàng thu tiền và bàn giao.', N'pages/cashier.html', N'TN-2026-0908-00001', '2026-09-08T14:00:00'),
  (4, N'DISPATCHER', NULL, N'TICKET_RECEIVED', N'Phiếu TN-2026-0907-00001 mới tiếp nhận, chờ phân công.', N'index.html', N'TN-2026-0907-00001', '2026-09-07T13:45:00'),
  (5, NULL, 13, N'TICKET_ASSIGNED', N'Bạn được giao phiếu TN-2026-0907-00001.', N'pages/technician.html', N'TN-2026-0907-00001', '2026-09-07T14:00:00'),
  (6, N'DISPATCHER', NULL, N'QUOTATION_PENDING', N'Báo giá BG-2026-0907-00001 đang chờ phê duyệt.', N'index.html#quotes', N'BG-2026-0907-00001', '2026-09-07T15:30:00'),
  (7, N'RECEPTIONIST', NULL, N'QUOTATION_APPROVED', N'Báo giá BG-2026-0907-00001 đã duyệt — chờ khách xác nhận.', N'pages/receptionist.html', N'BG-2026-0907-00001', '2026-09-07T16:00:00'),
  (8, N'WAREHOUSE_KEEPER', NULL, N'STOCK_ISSUE_PENDING', N'Yêu cầu xuất kho PX-2026-00001 cho phiếu TN-2026-0907-00001 đang chờ duyệt.', N'pages/warehouse.html#stockout', N'PX-2026-00001', '2026-09-08T08:00:00'),
  (9, NULL, 13, N'STOCK_ISSUE_APPROVED', N'Phiếu xuất PX-2026-00001 đã xuất kho — nhận linh kiện cho phiếu TN-2026-0907-00001.', N'pages/technician.html', N'PX-2026-00001', '2026-09-08T08:30:00'),
  (10, N'CASHIER', NULL, N'TICKET_READY_FOR_HANDOVER', N'Phiếu TN-2026-0907-00001 đã QC đạt — sẵn sàng thu tiền và bàn giao.', N'pages/cashier.html', N'TN-2026-0907-00001', '2026-09-08T11:00:00'),
  (11, N'DISPATCHER', NULL, N'TICKET_RECEIVED', N'Phiếu TN-2026-0914-00001 mới tiếp nhận, chờ phân công.', N'index.html', N'TN-2026-0914-00001', '2026-09-14T09:20:00'),
  (12, NULL, 14, N'TICKET_ASSIGNED', N'Bạn được giao phiếu TN-2026-0914-00001.', N'pages/technician.html', N'TN-2026-0914-00001', '2026-09-14T09:40:00'),
  (13, N'DISPATCHER', NULL, N'QUOTATION_PENDING', N'Báo giá BG-2026-0914-00001 đang chờ phê duyệt.', N'index.html#quotes', N'BG-2026-0914-00001', '2026-09-14T10:30:00'),
  (14, N'RECEPTIONIST', NULL, N'QUOTATION_APPROVED', N'Báo giá BG-2026-0914-00001 đã duyệt — chờ khách xác nhận.', N'pages/receptionist.html', N'BG-2026-0914-00001', '2026-09-14T11:00:00'),
  (15, N'WAREHOUSE_KEEPER', NULL, N'STOCK_ISSUE_PENDING', N'Yêu cầu xuất kho PX-2026-00002 cho phiếu TN-2026-0914-00001 đang chờ duyệt.', N'pages/warehouse.html#stockout', N'PX-2026-00002', '2026-09-14T14:00:00'),
  (16, N'DISPATCHER', NULL, N'TICKET_RECEIVED', N'Phiếu TN-2026-0912-00001 mới tiếp nhận, chờ phân công.', N'index.html', N'TN-2026-0912-00001', '2026-09-12T11:00:00'),
  (17, NULL, 15, N'TICKET_ASSIGNED', N'Bạn được giao phiếu TN-2026-0912-00001.', N'pages/technician.html', N'TN-2026-0912-00001', '2026-09-12T11:20:00'),
  (18, N'DISPATCHER', NULL, N'QUOTATION_PENDING', N'Báo giá BG-2026-0912-00001 đang chờ phê duyệt.', N'index.html#quotes', N'BG-2026-0912-00001', '2026-09-12T13:30:00'),
  (19, N'RECEPTIONIST', NULL, N'QUOTATION_APPROVED', N'Báo giá BG-2026-0912-00001 đã duyệt — chờ khách xác nhận.', N'pages/receptionist.html', N'BG-2026-0912-00001', '2026-09-12T14:00:00'),
  (20, N'RECEPTIONIST', NULL, N'WARRANTY_REQUEST_NEW', N'Yêu cầu bảo hành online mới YC-2026-0917-00001.', N'pages/receptionist.html', N'YC-2026-0917-00001', '2026-09-17T21:02:00');
SET IDENTITY_INSERT ThongBao OFF;
GO
INSERT INTO TonKhoTheoKe (MaLK, MaKe, SoLuong) VALUES
  (N'LK-BAT-LI01', N'KHO-B-02-03', 15),
  (N'LK-BOARD-RT01', N'KHO-C-03-02', 2),
  (N'LK-CART-PR01', N'KHO-C-03-08', 7),
  (N'LK-CHG-MOD01', N'KHO-C-01-09', 22),
  (N'LK-COMP-RF01', N'KHO-A-03-02', 12),
  (N'LK-CTRL-GC01', N'KHO-C-04-01', 4),
  (N'LK-CTRL-WM02', N'KHO-A-04-05', 6),
  (N'LK-DISP-OLED', N'KHO-B-01-07', 8),
  (N'LK-FAN-COOL02', N'KHO-A-03-06', 5),
  (N'LK-MOT-DRN01', N'KHO-A-04-08', 9),
  (N'LK-PWR-IC01', N'KHO-C-02-11', 40),
  (N'LK001', N'KHO-A-01-01', 12),
  (N'LK002', N'KHO-A-02-01', 5),
  (N'LK003', N'KHO-B-01-01', 12),
  (N'LK004', N'KHO-B-02-01', 6),
  (N'LK005', N'KHO-C-01-01', 25),
  (N'LK006', N'KHO-A-03-01', 4);
GO
INSERT INTO YeuCauBaoHanh (MaYeuCau, HoTenKhach, SDTKhach, EmailKhach, DiaChiKhach, MaNhom, MaLoai, HangModel, LoaiDinhDanh, SoSerial_IMEI, MoTaLoi, MaTramMongMuon, ThoiGianMongMuonTu, ThoiGianMongMuonDen, TrangThai, MaPhieuTN, MaNVXuLy, NgayXuLy, LyDoHuy, NgayTao) VALUES
  (N'YC-2026-0917-00001', N'Võ Thị Kim Ngân', N'0901556210', NULL, NULL, N'SMALL_ELECTRONICS', N'GAME_CONSOLE', N'Microsoft Xbox Series X', N'SERIAL', N'SN-XBSX-90021', N'Máy tự tắt nguồn khi chơi lâu, quạt tản nhiệt kêu to.', N'HCM', '2026-09-19T14:00:00', '2026-09-19T16:00:00', N'PENDING_INTAKE', NULL, NULL, NULL, NULL, '2026-09-17T21:02:00');
GO
ALTER TABLE BangGiaDichVu WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE BoDemMa WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ChinhSachBaoHanh WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ChiTietBaoGia WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ChiTietNhapKho WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ChiTietXuatKho WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE GhiChuPhieu WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE HangSanXuat WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE HangSanXuat_NhomThietBi WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE HoaDon_PhieuThu WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE KetQuaSuaChua WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE KhachHang WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE LichSuPhanCong WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE LichSuTrangThai_ThietBi WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE LinhKien WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE LoaiThietBi WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE MaXacThucOTP WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE NhaCungCap WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE NhanVien WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE NhatKyThaoTac WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE NhomThietBi WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhanCong WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuBanGiao WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuBaoGia WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuDieuChuyen WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuKiemTra WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuNhapKho WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuSuaChua WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuTiepNhan WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE PhieuXuatKho WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE RefreshToken WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE SanPham WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE TaiKhoan WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE TaiKhoan_VaiTro WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE TepDinhKem WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ThietBi WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ThietBiNhanThongBao WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ThongBao WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE ThongBao_DaDoc WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE TonKhoTheoKe WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE YeuCauBaoHanh WITH CHECK CHECK CONSTRAINT ALL;
GO
COMMIT;
GO

-- Trả phiên về bình thường (nếu chốt kiểm tra ở đầu schema đã bật NOEXEC).
SET NOEXEC OFF;
GO
