using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Billing;
using Soopi.Api.Services.Catalog;
using Soopi.Api.Services.Identity;
using Soopi.Api.Services.Inventory;
using Soopi.Api.Services.Reporting;
using Soopi.Api.Services.Shared;
using Soopi.Api.Services.Tickets;

namespace Soopi.SqlServer.Tests;

// Each test owns committed fixtures so separate SQL connections can contend on the same records.
public sealed class SqlFixture : IAsyncLifetime
{
    public string Id { get; } = "IT" + Guid.NewGuid().ToString("N")[..12];
    public string PartA => Id + "A";
    public string PartB => Id + "B";
    public const string Bin = "KHO-Z-99-99";
    public long AccountId { get; private set; }
    private ServiceProvider services = null!;
    private bool canDeleteAudit;

    public async Task InitializeAsync()
    {
        var connection = Connection();
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings { EnvironmentName = Environments.Development });
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddMemoryCache();
        builder.Services.AddScoped<IHttpContextAccessor, TestHttpContextAccessor>();
        builder.Services.Configure<SecurityOptions>(_ => { });
        builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connection)
            .AddInterceptors(new LockTimeoutInterceptor()));
        foreach (var type in new[] { typeof(Sql), typeof(TransactionRunner), typeof(CodeGenerator), typeof(CurrentActor),
            typeof(AccountStore), typeof(PrincipalDirectory), typeof(AuthService), typeof(AccessTrackingService),
            typeof(AuditService), typeof(NotificationService), typeof(PushDispatcher), typeof(PushDeviceStore),
            typeof(StaffDirectory), typeof(CatalogStore), typeof(CatalogService), typeof(InventoryStore), typeof(InventoryDocumentStore),
            typeof(QuotationStore), typeof(TicketStore), typeof(TicketProgressNotifier), typeof(BillingCalculator), typeof(IssuedParts),
            typeof(WarrantyRequestStore), typeof(TicketQueryService), typeof(LowStockNotifier), typeof(StockIssueService), typeof(PaymentService) })
            builder.Services.AddScoped(type);
        builder.Services.AddSingleton<JwtKeys>();
        builder.Services.AddSingleton<JwtService>();
        builder.Services.AddSingleton<SecurityVersionCache>();
        builder.Services.AddSingleton<PasswordPolicy>();
        builder.Services.AddSingleton<RateLimiter>();
        builder.Services.AddSingleton<IPushGateway, LoggingPushGateway>();
        services = builder.Services.BuildServiceProvider();
        try
        {
            using var scope = Scope();
            var sql = scope.ServiceProvider.GetRequiredService<Sql>();
            canDeleteAudit = Convert.ToInt32(await sql.ScalarAsync("SELECT HAS_PERMS_BY_NAME('NhatKyThaoTac','OBJECT','DELETE')")) == 1;
            await scope.ServiceProvider.GetRequiredService<TransactionRunner>().InTransactionAsync(async () =>
            {
                AccountId = Convert.ToInt64(await sql.ScalarAsync("INSERT TaiKhoan (TenDangNhap,MatKhauHash,LoaiChuThe) OUTPUT inserted.MaTaiKhoan VALUES (?,'{bcrypt}integration','EMPLOYEE')", Id));
                await sql.ExecuteAsync("INSERT TaiKhoan_VaiTro VALUES (?,'ADMIN'),(?,'WAREHOUSE_KEEPER'),(?,'CASHIER'),(?,'TECHNICIAN')", AccountId, AccountId, AccountId, AccountId);
                await sql.ExecuteAsync("INSERT TramDichVu (MaTram,TenTram) VALUES (?,?)", Id, Id);
                await sql.ExecuteAsync("INSERT NhanVien (MaNV,HoTen,SDT,MaTram,MaTaiKhoan) VALUES (?,?,?,?,?)", Id, Id, Phone(), Id, AccountId);
                await sql.ExecuteAsync("INSERT KhachHang (MaKH,HoTen,SDT) VALUES (?,?,?)", Id, Id, Phone());
                await sql.ExecuteAsync("INSERT NhomThietBi (MaNhom,TenNhom) VALUES (?,?)", Id, Id);
                await sql.ExecuteAsync("INSERT LoaiThietBi (MaLoai,MaNhom,TenLoai,LoaiDinhDanh,ChecklistChanDoan) VALUES (?,?,?,'SERIAL','[]')", Id, Id, Id);
                await sql.ExecuteAsync("INSERT HangSanXuat (MaHang,TenHang) VALUES (?,?)", Id, Id);
                await sql.ExecuteAsync("INSERT SanPham (MaSP,TenSP,MaHang,MaLoai) VALUES (?,?,?,?)", Id, Id, Id, Id);
                await sql.ExecuteAsync("INSERT ThietBi (MaThietBi,MaSP,LoaiDinhDanh,SoSerial_IMEI,MaKH) VALUES (?,?,'SERIAL',?,?)", Id, Id, Id, Id);
                var now = TimeProvider.System.GetUtcNow();
                await sql.ExecuteAsync("INSERT PhieuTiepNhan (MaPhieuTN,MaTram,NgayTiepNhan,MaKH,MaThietBi,MaNVTiepNhan,BH_TrangThaiLucNhan,KhachXacNhanNgoaiQuan,MoTaLoiKhachBao,HanSLA,TrangThaiXuLy) VALUES (?,?,?,?,?,?,'IN_WARRANTY',1,'integration',?,'AWAITING_PARTS')", Id, Id, now, Id, Id, Id, now.AddDays(2));
                await sql.ExecuteAsync("INSERT PhanCong (MaPhanCong,MaPhieuTN,MaNVQuanLy,MaKTV,NgayPhanCong) VALUES (?,?,?,?,?)", Id, Id, Id, Id, now);
                await sql.ExecuteAsync("INSERT PhieuSuaChua (MaPhieuSC,MaPhieuTN,MaPhanCong,MaKTV,NgayTao) VALUES (?,?,?,?,?)", Id, Id, Id, Id, now);
                foreach (var sku in new[] { PartA, PartB })
                {
                    await sql.ExecuteAsync("INSERT LinhKien (MaLK,TenLK,DonGiaVon,DonGiaDichVu,SoLuongTon,SoLuongDaGiu,DinhMucTonToiThieu,KeChinh) VALUES (?,?,10,20,10,2,0,?)", sku, sku, Bin);
                    await sql.ExecuteAsync("INSERT TonKhoTheoKe VALUES (?,?,10)", sku, Bin);
                }
                await sql.ExecuteAsync("INSERT PhieuXuatKho (MaPhieuXuat,MaPhieuTN,NguonXuat,LyDoXuat,MaKTVNhan,MaNguoiYeuCau,NgayYeuCau) VALUES (?,?,'FREE_WARRANTY','integration',?,?,?)", Id, Id, Id, Id, now);
                foreach (var sku in new[] { PartA, PartB })
                    await sql.ExecuteAsync("INSERT ChiTietXuatKho (MaPhieuXuat,MaLK,SoLuongXuat,DonGiaXuat) VALUES (?,?,2,10)", Id, sku);
            });
        }
        catch
        {
            // All fixture inserts share one transaction; a failed initialization already rolled them back.
            await services.DisposeAsync();
            services = null!;
            throw;
        }
    }

    public IServiceScope Scope()
    {
        var scope = services.CreateScope();
        var roles = new HashSet<Role> { Role.ADMIN, Role.WAREHOUSE_KEEPER, Role.CASHIER, Role.TECHNICIAN };
        var context = new DefaultHttpContext();
        context.Items["soopi.actor"] = new AuthenticatedActor(AccountId, Id, roles,
            roles.SelectMany(RolePermissions.ForRole).ToHashSet(), Id, null, Id);
        scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>().HttpContext = context;
        return scope;
    }

    public async Task DisposeAsync()
    {
        if (services is null) return;
        try
        {
            using var scope = Scope();
            var sql = scope.ServiceProvider.GetRequiredService<Sql>();
            await scope.ServiceProvider.GetRequiredService<TransactionRunner>().InTransactionAsync(async () =>
            {
                await sql.ExecuteAsync("DELETE d FROM ThongBao_DaDoc d JOIN ThongBao t ON t.MaThongBao=d.MaThongBao WHERE t.MaDoiTuong IN (?,?,?)", Id, PartA, PartB);
                await sql.ExecuteAsync("DELETE ThongBao WHERE MaDoiTuong IN (?,?,?)", Id, PartA, PartB);
                // Application credentials intentionally cannot erase audit history, even for test fixtures.
                if (canDeleteAudit) await sql.ExecuteAsync("DELETE NhatKyThaoTac WHERE MaNguoiThaoTac IN (?,?)", Id, AccountId.ToString());
                foreach (var table in new[] { "HoaDon_PhieuThu", "LichSuTrangThai_ThietBi", "PhieuSuaChua", "PhanCong" })
                    await sql.ExecuteAsync($"DELETE {table} WHERE MaPhieuTN=?", Id);
                await sql.ExecuteAsync("DELETE ChiTietXuatKho WHERE MaPhieuXuat=?", Id);
                await sql.ExecuteAsync("DELETE PhieuXuatKho WHERE MaPhieuXuat=?", Id);
                await sql.ExecuteAsync("DELETE ChiTietBaoGia WHERE MaBaoGia=?; DELETE PhieuBaoGia WHERE MaBaoGia=?; DELETE PhieuKiemTra WHERE MaPhieuTN=?", Id, Id, Id);
                await sql.ExecuteAsync("DELETE PhieuTiepNhan WHERE MaPhieuTN=?", Id);
                await sql.ExecuteAsync("DELETE TonKhoTheoKe WHERE MaLK IN (?,?)", PartA, PartB);
                await sql.ExecuteAsync("DELETE LinhKien WHERE MaLK IN (?,?)", PartA, PartB);
                foreach (var (table, key) in new[] { ("ThietBi", "MaThietBi"), ("SanPham", "MaSP"), ("LoaiThietBi", "MaLoai"),
                    ("HangSanXuat", "MaHang"), ("NhomThietBi", "MaNhom"), ("KhachHang", "MaKH"), ("NhanVien", "MaNV"), ("TramDichVu", "MaTram") })
                    await sql.ExecuteAsync($"DELETE {table} WHERE {key}=?", Id);
                await sql.ExecuteAsync("DELETE LuotTruyCap WHERE MaTaiKhoan=?; DELETE TruyCapTheoNgay WHERE MaTaiKhoan=?; DELETE TaiKhoan WHERE MaTaiKhoan=?", AccountId, AccountId, AccountId);
            });
        }
        finally { await services.DisposeAsync(); services = null!; }
    }

    private static string Phone() => "09" + Random.Shared.NextInt64(10_000_000, 100_000_000);

    private static string Connection()
    {
        var text = Environment.GetEnvironmentVariable("SOOPI_SQL_TEST_CONNECTION");
        if (string.IsNullOrWhiteSpace(text))
        {
            var config = new ConfigurationBuilder().AddUserSecrets(typeof(AppDbContext).Assembly).Build();
            text = config.GetConnectionString("Default");
            if (string.IsNullOrWhiteSpace(text) && Environment.GetEnvironmentVariable("MSSQL_TEST_URL") is { } url)
            {
                var server = new Uri(url.Replace("jdbc:", "").Split(';')[0]);
                text = new SqlConnectionStringBuilder
                {
                    DataSource = $"{server.Host},{(server.Port > 0 ? server.Port : 1433)}", InitialCatalog = "TrungTamBaoHanhDB_Dev",
                    UserID = Environment.GetEnvironmentVariable("MSSQL_TEST_USER"), Password = Environment.GetEnvironmentVariable("MSSQL_TEST_PASSWORD"),
                    Encrypt = false, TrustServerCertificate = true
                }.ConnectionString;
            }
        }
        if (string.IsNullOrWhiteSpace(text)) throw new InvalidOperationException("Set SOOPI_SQL_TEST_CONNECTION to a dedicated SQL Server test database.");
        var connection = new SqlConnectionStringBuilder(text);
        if (connection.InitialCatalog is not ("TrungTamBaoHanhDB_Dev" or "SoopiIntegrationTests"))
            throw new InvalidOperationException("SQL tests only permit TrungTamBaoHanhDB_Dev or SoopiIntegrationTests; no schema changes or resets are performed.");
        connection.ApplicationName = "Soopi.SqlServer.Tests";
        return connection.ConnectionString;
    }
}

internal sealed class TestHttpContextAccessor : IHttpContextAccessor
{
    public HttpContext? HttpContext { get; set; }
}
