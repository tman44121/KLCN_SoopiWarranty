using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Soopi.Api.Data.Entities;

namespace Soopi.Api.Data;

/// <summary>
/// Map vào schema có sẵn db/sqlserver/01_schema.sql (không migration, không tạo/sửa bảng). Chỉ các bảng mà bản Java
/// dùng JPA được khai báo entity; các bảng còn lại truy cập bằng <see cref="Sql"/>.
/// </summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Account> Accounts => Set<Account>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<Customer> Customers => Set<Customer>();

    public DbSet<EmployeeAccountLink> EmployeeLinks => Set<EmployeeAccountLink>();

    public DbSet<Device> Devices => Set<Device>();

    public DbSet<Payment> Payments => Set<Payment>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configuration)
    {
        // Thời điểm trong code là UTC; cột DATETIME2(0) lưu giờ Việt Nam (DbTime).
        configuration.Properties<DateTimeOffset>().HaveConversion<VietnamTimeConverter>().HaveColumnType("datetime2(0)");
        configuration.Properties<string>().AreUnicode();
    }

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<Account>(entity =>
        {
            entity.ToTable("TaiKhoan");
            entity.HasKey(a => a.Id);
            entity.Property(a => a.Id).HasColumnName("MaTaiKhoan");
            entity.Property(a => a.Username).HasColumnName("TenDangNhap");
            entity.Property(a => a.PasswordHash).HasColumnName("MatKhauHash");
            entity.Property(a => a.PrincipalType).HasColumnName("LoaiChuThe").HasConversion<string>();
            entity.Property(a => a.Status).HasColumnName("TrangThai").HasConversion<string>();
            entity.Property(a => a.FailedLoginAttempts).HasColumnName("SoLanSaiLienTiep");
            entity.Property(a => a.TemporaryLockUntil).HasColumnName("KhoaTamDen");
            entity.Property(a => a.MustChangePassword).HasColumnName("BatBuocDoiMatKhau");
            entity.Property(a => a.SecurityVersion).HasColumnName("PhienBanBaoMat");
            entity.Property(a => a.LastLoginAt).HasColumnName("LanDangNhapCuoi");
            entity.Property(a => a.PasswordChangedAt).HasColumnName("NgayDoiMatKhau");
            entity.HasMany(a => a.RoleRows).WithOne().HasForeignKey(r => r.AccountId);
        });
        model.Entity<AccountRole>(entity =>
        {
            entity.ToTable("TaiKhoan_VaiTro");
            entity.HasKey(r => new { r.AccountId, r.Role });
            entity.Property(r => r.AccountId).HasColumnName("MaTaiKhoan");
            entity.Property(r => r.Role).HasColumnName("MaVaiTro").HasConversion<string>();
        });
        model.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("RefreshToken");
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Id).HasColumnName("MaToken");
            entity.Property(t => t.TokenHash).HasColumnName("TokenHash").IsFixedLength();
            entity.Property(t => t.AccountId).HasColumnName("MaTaiKhoan");
            entity.Property(t => t.FamilyId).HasColumnName("HoToken").IsFixedLength();
            entity.Property(t => t.IssuedAt).HasColumnName("NgayCap");
            entity.Property(t => t.ExpiresAt).HasColumnName("HetHan");
            entity.Property(t => t.RevokedAt).HasColumnName("ThuHoiLuc");
            entity.Property(t => t.ReplacedByHash).HasColumnName("ThayBangHash").IsFixedLength();
            entity.Property(t => t.Remember).HasColumnName("GhiNho");
            entity.Property(t => t.Ip).HasColumnName("DiaChiIP");
            entity.Property(t => t.UserAgent).HasColumnName("UserAgent");
        });
        model.Entity<Customer>(entity =>
        {
            entity.ToTable("KhachHang");
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Id).HasColumnName("MaKH");
            entity.Property(c => c.FullName).HasColumnName("HoTen");
            entity.Property(c => c.Phone).HasColumnName("SDT");
            entity.Property(c => c.Email).HasColumnName("Email");
            entity.Property(c => c.Address).HasColumnName("DiaChi");
            entity.Property(c => c.AccountId).HasColumnName("MaTaiKhoan");
            entity.Property(c => c.Status).HasColumnName("TrangThai").HasConversion<string>();
            entity.Property(c => c.MergedInto).HasColumnName("GopVaoMaKH");
            entity.Property(c => c.CreatedAt).HasColumnName("NgayTao");
        });
        model.Entity<Device>(entity =>
        {
            entity.ToTable("ThietBi");
            entity.HasKey(d => d.Id);
            entity.Property(d => d.Id).HasColumnName("MaThietBi");
            entity.Property(d => d.ProductId).HasColumnName("MaSP");
            entity.Property(d => d.IdentifierType).HasColumnName("LoaiDinhDanh").HasConversion<string>();
            entity.Property(d => d.SerialNormalized).HasColumnName("SoSerial_IMEI");
            entity.Property(d => d.CustomerId).HasColumnName("MaKH");
            entity.Property(d => d.WarrantyActivatedOn).HasColumnName("NgayKichHoatBaoHanh");
            entity.Property(d => d.WarrantyExpiresOn).HasColumnName("NgayHetHanBaoHanh");
            entity.Property(d => d.Distributor).HasColumnName("NhaPhanPhoi");
            entity.Property(d => d.CreatedAt).HasColumnName("NgayTao");
        });
        model.Entity<Payment>(entity =>
        {
            entity.ToTable("HoaDon_PhieuThu");
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Id).HasColumnName("MaPhieuThu");
            entity.Property(p => p.TicketId).HasColumnName("MaPhieuTN");
            entity.Property(p => p.QuotationId).HasColumnName("MaBaoGia");
            entity.Property(p => p.Type).HasColumnName("LoaiThu");
            entity.Property(p => p.PaidAt).HasColumnName("NgayThu");
            entity.Property(p => p.PayerName).HasColumnName("NguoiNopTien");
            // Payment.@PostLoad chỉ bỏ scale khi số tiền nguyên; giữ phần lẻ như dữ liệu Java.
            entity.Property(p => p.Amount).HasColumnName("SoTienThu")
                .HasConversion(value => value, value => decimal.Truncate(value) == value ? decimal.Round(value, 0) : value)
                .HasPrecision(18, 2);
            entity.Property(p => p.Method).HasColumnName("HinhThucThanhToan");
            entity.Property(p => p.CashierId).HasColumnName("MaThuNgan");
            entity.Property(p => p.Note).HasColumnName("GhiChu");
        });
        model.Entity<EmployeeAccountLink>(entity =>
        {
            entity.ToTable("NhanVien");
            entity.HasKey(e => e.Code);
            entity.Property(e => e.Code).HasColumnName("MaNV");
            entity.Property(e => e.AccountId).HasColumnName("MaTaiKhoan");
        });
    }
}

public sealed class VietnamTimeConverter() : ValueConverter<DateTimeOffset, DateTime>(
    value => DbTime.Local(value),
    value => DbTime.Instant(value));
