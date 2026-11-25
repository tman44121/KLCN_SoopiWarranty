-- ============================================================================
-- Script.sql: thiết kế cơ sở dữ liệu TrungTamBaoHanhDB (SQL Server) gộp trong một file.
-- Thứ tự chạy:
--   Phần 1. Tạo database TrungTamBaoHanhDB, collation Latin1_General_100_CI_AI (nếu chưa có).
--   Phần 2. Lược đồ: 56 bảng theo 8 nhóm nghiệp vụ, khóa chính, khóa ngoại, ràng buộc CHECK và chỉ mục.
--   Phần 3. Dữ liệu tham chiếu: nhãn hiển thị, chuyển trạng thái hợp lệ, vai trò, quyền, trạm dịch vụ.
-- File ghép từ 01_schema.sql + 02_reference_data.sql: sửa ở file nguồn rồi ghép lại, không sửa tay file này.
-- Không chứa dữ liệu chạy thử hay tài khoản mẫu. Database đã có bảng hoặc sai collation thì script dừng,
-- không xóa hay ghi đè dữ liệu.
-- Chạy: sqlcmd -S <server> -E -C -I -b -f 65001 -i Script.sql   (hoặc mở bằng SSMS và Execute)
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
-- Phần 2. Lược đồ: 56 bảng, không stored procedure, trigger hay view. Nghiệp vụ (máy trạng thái, tổng tiền
-- báo giá, sinh mã, đối soát thu tiền) do backend .NET thực hiện; database giữ ràng buộc toàn vẹn.
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

-- Dữ liệu tham chiếu trạng thái; Ticket (C#) kiểm tra chuyển trạng thái theo ChuyenTrangThaiHopLe và ghi lịch sử cùng transaction.
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
                                      OR (LEN(SoSerial_IMEI) BETWEEN 4 AND 50 AND SoSerial_IMEI COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^A-Za-z0-9-]%')),
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
-- Ticket (C#) kiểm tra chuyển trạng thái; TicketStore cập nhật phiếu và ghi LichSuTrangThai_ThietBi trong cùng transaction.
-- ConMo = máy còn ở trung tâm; backend ghi cùng TrangThaiXuLy, CHECK bảo đảm hai cột không lệch nhau.
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
        'AWAITING_PARTS', 'AWAITING_RETURN', 'REPAIRING', 'COMPLETED', 'DELIVERED', 'RETURNED_UNREPAIRED')),
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
-- Quotation (C#) tính tổng từ ChiTietBaoGia, áp dụng VAT và ghi header/detail trong cùng transaction.
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

-- Bất biến (backend bảo đảm, truy vấn đối soát kiểm tra): LinhKien.SoLuongTon = SUM(TonKhoTheoKe.SoLuong)
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
    DonGiaDichVuXuat     DECIMAL(18,2) NULL,
    CONSTRAINT UX_CTXK_LinhKien UNIQUE (MaPhieuXuat, MaLK),
    FOREIGN KEY (MaPhieuXuat) REFERENCES PhieuXuatKho(MaPhieuXuat),
    FOREIGN KEY (MaLK) REFERENCES LinhKien(MaLK),
    CONSTRAINT CK_CTXK_SoLuong CHECK (SoLuongXuat > 0),
    CONSTRAINT CK_CTXK_DonGia CHECK (DonGiaXuat >= 0),
    CONSTRAINT CK_CTXK_DonGiaDichVu CHECK (DonGiaDichVuXuat IS NULL OR DonGiaDichVuXuat >= 0)
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

-- Kiểm kê: tồn hệ thống chụp lúc lập phiếu, số đếm thực tế; duyệt thì điều chỉnh tồn theo chênh lệch.
CREATE TABLE PhieuKiemKe (
    MaPhieuKK     NVARCHAR(30)  PRIMARY KEY,
    PhamVi        NVARCHAR(100) NOT NULL,
    GhiChu        NVARCHAR(255) NULL,
    TrangThai     NVARCHAR(10)  NOT NULL DEFAULT 'PENDING',
    MaNguoiLap    NVARCHAR(20)  NOT NULL,
    NgayLap       DATETIME2(0)  NOT NULL,
    MaNguoiDuyet  NVARCHAR(20)  NULL,
    NgayDuyet     DATETIME2(0)  NULL,
    LyDoTuChoi    NVARCHAR(255) NULL,
    INDEX IX_KiemKe_TrangThai (TrangThai, NgayLap),
    FOREIGN KEY (MaNguoiLap) REFERENCES NhanVien(MaNV),
    FOREIGN KEY (MaNguoiDuyet) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_KK_TrangThai CHECK (TrangThai IN ('PENDING', 'COMPLETED', 'REJECTED')),
    CONSTRAINT CK_KK_XuLy CHECK (TrangThai = 'PENDING' OR (MaNguoiDuyet IS NOT NULL AND NgayDuyet IS NOT NULL)),
    CONSTRAINT CK_KK_TuChoi CHECK (TrangThai <> 'REJECTED' OR (LyDoTuChoi IS NOT NULL AND TRIM(LyDoTuChoi) <> ''))
);

CREATE TABLE ChiTietKiemKe (
    MaChiTietKK     BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaPhieuKK       NVARCHAR(30)  NOT NULL,
    MaLK            NVARCHAR(30)  NOT NULL,
    MaKe            NVARCHAR(20)  NOT NULL,
    SoLuongHeThong  INT           NOT NULL,
    SoLuongThucTe   INT           NOT NULL,
    GhiChu          NVARCHAR(255) NULL,
    CONSTRAINT UX_CTKK_LinhKienKe UNIQUE (MaPhieuKK, MaLK, MaKe),
    FOREIGN KEY (MaPhieuKK) REFERENCES PhieuKiemKe(MaPhieuKK),
    FOREIGN KEY (MaLK) REFERENCES LinhKien(MaLK),
    CONSTRAINT CK_CTKK_SoLuong CHECK (SoLuongHeThong >= 0 AND SoLuongThucTe >= 0),
    CONSTRAINT CK_CTKK_Ke CHECK (MaKe LIKE 'KHO-[A-Z]-[0-9][0-9]-[0-9][0-9]')
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
    NhanXetDanhGia          NVARCHAR(1000) NULL,
    NgayDanhGia             DATETIME2(0)  NULL,
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
    CONSTRAINT CK_PBGi_DanhGiaKhach CHECK (NgayDanhGia IS NULL OR DanhGiaHaiLong IS NOT NULL),
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

-- Tài khoản khách (web + app di động). OTP gửi qua email, chỉ lưu SHA-256 của mã, dùng một lần.
CREATE TABLE MaXacThucOTP (
    MaOTP         BIGINT IDENTITY(1,1) PRIMARY KEY,
    Email         NVARCHAR(100) NOT NULL,
    MucDich       NVARCHAR(20)  NOT NULL,
    MaHash        NCHAR(64)     NOT NULL,
    NgayTao       DATETIME2(0)  NOT NULL,
    HetHan        DATETIME2(0)  NOT NULL,
    SoLanNhapSai  INT           NOT NULL DEFAULT 0,
    DaDungLuc     DATETIME2(0)  NULL,
    DiaChiIP      NVARCHAR(45)  NULL,
    INDEX IX_MaXacThucOTP_Email (Email, MucDich, NgayTao),
    CONSTRAINT CK_MaXacThucOTP_MucDich CHECK (MucDich IN ('REGISTER', 'RESET_PASSWORD')),
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

-- Chat khách hàng theo phiếu
IF OBJECT_ID(N'dbo.HoiThoai', N'U') IS NULL
BEGIN
    CREATE TABLE HoiThoai (
        MaHoiThoai       BIGINT IDENTITY(1,1) PRIMARY KEY,
        MaPhieuTN        NVARCHAR(30) NOT NULL,
        MaTaiKhoanKhach  BIGINT NOT NULL,
        MaTaiKhoanNV     BIGINT NOT NULL,
        KhachDaDocDen    BIGINT NOT NULL DEFAULT 0,
        NVDaDocDen       BIGINT NOT NULL DEFAULT 0,
        NgayCapNhat      DATETIME2(0) NOT NULL,
        CONSTRAINT UX_HoiThoai_Participants UNIQUE (MaPhieuTN, MaTaiKhoanKhach, MaTaiKhoanNV),
        FOREIGN KEY (MaPhieuTN) REFERENCES PhieuTiepNhan(MaPhieuTN),
        FOREIGN KEY (MaTaiKhoanKhach) REFERENCES TaiKhoan(MaTaiKhoan),
        FOREIGN KEY (MaTaiKhoanNV) REFERENCES TaiKhoan(MaTaiKhoan),
        CONSTRAINT CK_HoiThoai_Participants CHECK (MaTaiKhoanKhach <> MaTaiKhoanNV),
        CONSTRAINT CK_HoiThoai_Read CHECK (KhachDaDocDen >= 0 AND NVDaDocDen >= 0),
        INDEX IX_HoiThoai_Khach (MaTaiKhoanKhach, NgayCapNhat),
        INDEX IX_HoiThoai_NV (MaTaiKhoanNV, NgayCapNhat)
    );
END;
GO
IF OBJECT_ID(N'dbo.TinNhan', N'U') IS NULL
BEGIN
    CREATE TABLE TinNhan (
        MaTinNhan    BIGINT IDENTITY(1,1) PRIMARY KEY,
        MaHoiThoai   BIGINT NOT NULL,
        MaNguoiGui   BIGINT NOT NULL,
        MaYeuCau     UNIQUEIDENTIFIER NOT NULL,
        NoiDung      NVARCHAR(2000) NOT NULL,
        NgayTao      DATETIME2(0) NOT NULL,
        CONSTRAINT UX_TinNhan_Retry UNIQUE (MaHoiThoai, MaYeuCau),
        FOREIGN KEY (MaHoiThoai) REFERENCES HoiThoai(MaHoiThoai),
        FOREIGN KEY (MaNguoiGui) REFERENCES TaiKhoan(MaTaiKhoan),
        CONSTRAINT CK_TinNhan_Text CHECK (LEN(LTRIM(RTRIM(NoiDung))) > 0),
        INDEX IX_TinNhan_HoiThoai (MaHoiThoai, MaTinNhan) INCLUDE (MaNguoiGui)
    );
END;
GO

-- Thống kê truy cập được lưu lâu dài
IF OBJECT_ID(N'dbo.MocThongKeTruyCap', N'U') IS NULL
BEGIN
    CREATE TABLE MocThongKeTruyCap (
        Id INT PRIMARY KEY CHECK (Id=1),
        NgayBatDau DATE NOT NULL
    );
END;
IF NOT EXISTS (SELECT 1 FROM MocThongKeTruyCap WHERE Id=1)
    INSERT MocThongKeTruyCap (Id,NgayBatDau) VALUES (1,CONVERT(DATE,'20261031',112));
GO
IF OBJECT_ID(N'dbo.LuotTruyCap', N'U') IS NULL
BEGIN
    CREATE TABLE LuotTruyCap (
        MaLuot BIGINT IDENTITY(1,1) PRIMARY KEY,
        MaTaiKhoan BIGINT NOT NULL REFERENCES TaiKhoan(MaTaiKhoan),
        MaPhien NCHAR(36) NOT NULL,
        BatDau DATETIME2(0) NOT NULL,
        HoatDongCuoi DATETIME2(0) NOT NULL,
        KetThuc DATETIME2(0) NULL,
        CONSTRAINT CK_LuotTruyCap_Time CHECK (HoatDongCuoi>=BatDau AND (KetThuc IS NULL OR KetThuc>=HoatDongCuoi)),
        INDEX IX_LuotTruyCap_Ngay (BatDau) INCLUDE (MaTaiKhoan),
        INDEX IX_LuotTruyCap_TaiKhoan (MaTaiKhoan,MaPhien),
        INDEX IX_LuotTruyCap_Online (HoatDongCuoi) INCLUDE (MaTaiKhoan,MaPhien,KetThuc)
    );
    CREATE UNIQUE INDEX UX_LuotTruyCap_PhienMo ON LuotTruyCap(MaPhien) WHERE KetThuc IS NULL;
END;
GO
IF OBJECT_ID(N'dbo.TruyCapTheoNgay', N'U') IS NULL
BEGIN
    CREATE TABLE TruyCapTheoNgay (
        Ngay DATE NOT NULL,
        MaTaiKhoan BIGINT NOT NULL REFERENCES TaiKhoan(MaTaiKhoan),
        PRIMARY KEY (Ngay,MaTaiKhoan)
    );
END;
GO

-- Duyệt đánh giá công khai trên trang chủ
IF OBJECT_ID(N'dbo.DanhGiaCongKhai', N'U') IS NULL
BEGIN
    CREATE TABLE DanhGiaCongKhai (
        MaPhieuTN NVARCHAR(30) PRIMARY KEY REFERENCES PhieuBanGiao(MaPhieuTN),
        MaCongKhai UNIQUEIDENTIFIER NOT NULL UNIQUE,
        SoSao INT NOT NULL CHECK (SoSao BETWEEN 1 AND 5),
        NoiDung NVARCHAR(1000) NULL,
        NgayDanhGia DATETIME2(0) NULL,
        MaNguoiDuyet BIGINT NOT NULL REFERENCES TaiKhoan(MaTaiKhoan),
        NgayDuyet DATETIME2(0) NOT NULL
    );
END;
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
        CauHinhBaoVe     NVARCHAR(MAX) NULL CONSTRAINT CK_CHTG_BaoVe CHECK (CauHinhBaoVe IS NULL OR ISJSON(CauHinhBaoVe) = 1),
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

-- ============================================================================
-- Phần 3. Dữ liệu tham chiếu (danh mục nhãn, chuyển trạng thái hợp lệ, vai trò, quyền, trạm dịch vụ).
-- ============================================================================
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
  (N'AWAITING_CUSTOMER_CONFIRMATION', N'AWAITING_PARTS', N'T7a Khách đồng ý, cần chờ linh kiện'),
  (N'AWAITING_CUSTOMER_CONFIRMATION', N'REPAIRING', N'T7a Khách đồng ý, không cần chờ linh kiện'),
  (N'AWAITING_CUSTOMER_CONFIRMATION', N'AWAITING_RETURN', N'T7b Khách từ chối, chờ trả máy'),
  (N'AWAITING_PARTS', N'REPAIRING', N'T9 Duyệt xuất kho / T9c Đủ linh kiện ngoài kho'),
  (N'AWAITING_RETURN', N'RETURNED_UNREPAIRED', N'T12 Trung tâm xác nhận đã trả máy'),
  (N'AWAITING_QUOTE_APPROVAL', N'AWAITING_CUSTOMER_CONFIRMATION', N'T6a Quản lý duyệt báo giá'),
  (N'AWAITING_QUOTE_APPROVAL', N'DIAGNOSED', N'T6b Quản lý yêu cầu sửa lại báo giá'),
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
  (N'NOTIFICATION_TYPE', N'CUSTOM_ANNOUNCEMENT', N'Thông báo từ trung tâm', N'📢 Thông báo', N'processing', 99),
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
  (N'TICKET_STATUS', N'AWAITING_RETURN', N'Chờ trả máy', N'Chờ trả máy', N'warning', 9),
  (N'TICKET_STATUS', N'AWAITING_PARTS', N'Chờ linh kiện', N'Chờ linh kiện', N'warning', 6),
  (N'TICKET_STATUS', N'AWAITING_QUOTE_APPROVAL', N'Chờ duyệt giá', N'Chờ phê duyệt báo giá', N'warning', 4),
  (N'TICKET_STATUS', N'COMPLETED', N'Hoàn thành', N'Hoàn thành – Chờ bàn giao', N'success', 8),
  (N'TICKET_STATUS', N'DELIVERED', N'Đã bàn giao', N'Đã bàn giao', N'success', 11),
  (N'TICKET_STATUS', N'DIAGNOSED', N'Đã chẩn đoán', N'Đã chẩn đoán', N'processing', 3),
  (N'TICKET_STATUS', N'INSPECTING', N'Đang kiểm tra', N'Đang chẩn đoán', N'processing', 2),
  (N'TICKET_STATUS', N'RECEIVED', N'Đã tiếp nhận', N'Chưa phân công', N'neutral', 1),
  (N'TICKET_STATUS', N'REPAIRING', N'Đang sửa chữa', N'Đang sửa chữa', N'processing', 7),
  (N'TICKET_STATUS', N'RETURNED_UNREPAIRED', N'Đã trả máy (không sửa)', N'Đã trả máy (không sửa)', N'neutral', 12),
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
  (N'CUSTOMER_ACCOUNT_MANAGE', N'Quản lý tài khoản khách (khóa / mở khóa)'),
  (N'CUSTOMER_ARCHIVE', N'Lưu trữ / xóa hồ sơ khách'),
  (N'CUSTOMER_CREATE', N'Tạo hồ sơ khách'),
  (N'CUSTOMER_MERGE', N'Hợp nhất hồ sơ khách'),
  (N'CUSTOMER_PASSWORD_RESET', N'Đặt lại mật khẩu tài khoản khách'),
  (N'CUSTOMER_READ_CONTACT', N'Xem liên hệ khách'),
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
  (N'STOCKTAKE_MANAGE', N'Kiểm kê kho'),
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
  (N'ADMIN', N'CUSTOMER_ACCOUNT_MANAGE'),
  (N'ADMIN', N'CUSTOMER_ARCHIVE'),
  (N'DISPATCHER', N'CUSTOMER_ARCHIVE'),
  (N'DISPATCHER', N'CUSTOMER_CREATE'),
  (N'RECEPTIONIST', N'CUSTOMER_CREATE'),
  (N'ADMIN', N'CUSTOMER_MERGE'),
  (N'DISPATCHER', N'CUSTOMER_MERGE'),
  (N'ADMIN', N'CUSTOMER_PASSWORD_RESET'),
  (N'RECEPTIONIST', N'CUSTOMER_PASSWORD_RESET'),
  (N'ADMIN', N'CUSTOMER_READ_CONTACT'),
  (N'CASHIER', N'CUSTOMER_READ_CONTACT'),
  (N'DISPATCHER', N'CUSTOMER_READ_CONTACT'),
  (N'RECEPTIONIST', N'CUSTOMER_READ_CONTACT'),
  (N'CASHIER', N'CUSTOMER_READ_PAYMENTS'),
  (N'DISPATCHER', N'CUSTOMER_READ_PAYMENTS'),
  (N'ADMIN', N'CUSTOMER_UPDATE_CONTACT'),
  (N'DISPATCHER', N'CUSTOMER_UPDATE_CONTACT'),
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
  (N'WAREHOUSE_KEEPER', N'STOCKTAKE_MANAGE'),
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

