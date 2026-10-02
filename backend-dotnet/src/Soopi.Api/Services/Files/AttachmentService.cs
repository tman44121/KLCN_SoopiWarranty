using System.Text.RegularExpressions;
using Soopi.Api.Data;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;

namespace Soopi.Api.Services.Files;

public sealed record Upload(string? FileName, byte[] Content)
{
    public string SafeFileName()
    {
        if (string.IsNullOrWhiteSpace(FileName)) return "tep-dinh-kem";
        var name = FileName.Replace('\\', '/');
        name = Regex.Replace(name[(name.LastIndexOf('/') + 1)..], "[\\p{Cc}\"]", "");
        return name.Length > 120 ? name[^120..] : name;
    }
}

public sealed record Attachment(string FileId, string FileName, string ContentType, long Size);

public sealed record FileOwner(string Type, string Id, string? CustomerId, string? UploadedBy);

public sealed record StoredFile(string Id, string FileName, string ContentType, byte[] Content, FileOwner Owner);

/// <summary>
/// Nội dung tệp nằm trên đĩa (<c>Storage:Directory</c>); bảng TepDinhKem giữ tên, loại, kích thước, chủ sở hữu và khóa lưu
/// trữ (đường dẫn tương đối). Mã tệp trả cho API là MaTep.
/// </summary>
public sealed class FileStorage(Sql sql, TimeProvider clock, IConfiguration configuration)
{
    private readonly string root = Path.GetFullPath(configuration["Storage:Directory"] ?? "./data/files");

    public async Task<string> StoreAsync(string fileName, string contentType, byte[] content, FileOwner owner)
    {
        var now = clock.GetUtcNow();
        var key = now.ToOffset(DbTime.Offset).ToString("yyyy/MM") + "/" + Guid.NewGuid();
        var target = Resolve(key);
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        await File.WriteAllBytesAsync(target, content);
        try
        {
            var id = await sql.ScalarAsync(
                "INSERT INTO TepDinhKem (LoaiChuSoHuu, MaChuSoHuu, TenTep, LoaiNoiDung, KichThuoc, DuongDanLuuTru, NguoiTaiLen, NgayTaiLen) "
                + "OUTPUT inserted.MaTep VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                owner.Type, owner.Id, Limit(fileName, 255), contentType, content.Length, key, Limit(owner.UploadedBy, 30), now);
            return Convert.ToInt64(id).ToString();
        }
        catch
        {
            File.Delete(target);
            throw;
        }
    }

    public async Task<StoredFile?> FindAsync(string? fileId)
    {
        if (!long.TryParse(fileId, out var id)) return null;
        var row = await sql.FirstOrDefaultAsync(
            // Chủ phiếu (chữ ký bàn giao) hoặc hồ sơ khách đang dùng SĐT người gửi yêu cầu bảo hành.
            "SELECT t.LoaiChuSoHuu, t.MaChuSoHuu, t.TenTep, t.LoaiNoiDung, t.DuongDanLuuTru, t.NguoiTaiLen, "
            + "COALESCE(ptn.MaKH, kh.MaKH) AS MaKH FROM TepDinhKem t LEFT JOIN PhieuTiepNhan ptn "
            + "ON t.LoaiChuSoHuu = 'HANDOVER_SIGNATURE' AND ptn.MaPhieuTN = t.MaChuSoHuu "
            + "LEFT JOIN YeuCauBaoHanh yc ON t.LoaiChuSoHuu = 'WARRANTY_REQUEST' AND yc.MaYeuCau = t.MaChuSoHuu "
            + "LEFT JOIN KhachHang kh ON kh.SDT = yc.SDTKhach AND kh.TrangThai = 'ACTIVE' WHERE t.MaTep = ?",
            row => (Name: row.Str("TenTep")!, Type: row.Str("LoaiNoiDung")!, Key: row.Str("DuongDanLuuTru")!,
                Owner: new FileOwner(row.Str("LoaiChuSoHuu")!, row.Str("MaChuSoHuu")!, row.Str("MaKH"), row.Str("NguoiTaiLen"))),
            id);
        if (row.Owner is null) return null;
        var path = Resolve(row.Key);
        return File.Exists(path) ? new StoredFile(fileId!, row.Name, row.Type, await File.ReadAllBytesAsync(path), row.Owner) : null;
    }

    public async Task DeleteAsync(string fileId)
    {
        if (!long.TryParse(fileId, out var id)) return;
        foreach (var key in await sql.QueryAsync("SELECT DuongDanLuuTru FROM TepDinhKem WHERE MaTep = ?", row => row.Str("DuongDanLuuTru")!, id))
            File.Delete(Resolve(key));
        await sql.ExecuteAsync("DELETE FROM TepDinhKem WHERE MaTep = ?", id);
    }

    private string Resolve(string key)
    {
        var path = Path.GetFullPath(Path.Combine(root, key));
        return path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal)
            ? path
            : throw new ArgumentException("Khóa lưu trữ không hợp lệ");
    }

    private static string? Limit(string? value, int max) => value is null || value.Length <= max ? value : value[..max];
}

public sealed class AttachmentService(FileStorage storage, CurrentActor actors)
{
    public const string WarrantyRequest = "WARRANTY_REQUEST";
    public const string HandoverSignature = "HANDOVER_SIGNATURE";
    private const int MaxFiles = 5;

    /// <summary>Ảnh/video lỗi của yêu cầu bảo hành online: tối đa 5 file, kiểm tra hết trước khi lưu file nào.</summary>
    public async Task<List<Attachment>> StoreWarrantyRequestFilesAsync(string requestCode, IReadOnlyList<Upload> uploads)
    {
        if (uploads.Count > MaxFiles) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var types = uploads.Select(upload => RequireAllowed(upload.Content)).ToList();
        var stored = new List<Attachment>();
        try
        {
            for (var index = 0; index < uploads.Count; index++)
            {
                var name = uploads[index].SafeFileName();
                var id = await storage.StoreAsync(name, types[index], uploads[index].Content, new FileOwner(WarrantyRequest, requestCode, null, "PORTAL"));
                stored.Add(new Attachment(id, name, types[index], uploads[index].Content.Length));
            }
            return stored;
        }
        catch
        {
            await DiscardAsync(stored);
            throw;
        }
    }

    public async Task DiscardAsync(IEnumerable<Attachment> attachments)
    {
        foreach (var attachment in attachments) await storage.DeleteAsync(attachment.FileId);
    }

    /// <summary>POL-13; ngoài phạm vi được xem trả 404 để không lộ sự tồn tại của file.</summary>
    public async Task<StoredFile> DownloadAsync(string fileId)
    {
        var file = await storage.FindAsync(fileId);
        return file is not null && CanRead(file.Owner) ? file : throw new DomainException(ErrorCode.NOT_FOUND);
    }

    private bool CanRead(FileOwner owner)
    {
        var grant = actors.PortalGrant;
        var actor = actors.Actor;
        var ownsAsCustomer = actor is not null && actor.Roles.Contains(Role.CUSTOMER) && actor.CustomerId is not null && actor.CustomerId == owner.CustomerId;
        return owner.Type switch
        {
            HandoverSignature => grant?.AllowsTicket(owner.Id) == true || actor?.Permissions.Contains(Permission.TICKET_READ_ALL) == true || ownsAsCustomer,
            WarrantyRequest => grant?.AllowsRequest(owner.Id) == true || actor?.Permissions.Contains(Permission.WARRANTY_REQUEST_HANDLE) == true || ownsAsCustomer,
            _ => false,
        };
    }

    /// <summary>Chỉ nhận ảnh JPEG/PNG/WebP ≤ 5 MB và video MP4 ≤ 30 MB, nhận diện bằng magic bytes; trả MIME thật.</summary>
    public static string RequireAllowed(byte[] content)
    {
        var type = Sniff(content) ?? throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var limit = type.StartsWith("video/", StringComparison.Ordinal) ? 30L * 1024 * 1024 : 5L * 1024 * 1024;
        return content.Length > limit ? throw new DomainException(ErrorCode.VALIDATION_FAILED) : type;
    }

    public static string? Sniff(byte[] content)
    {
        if (content.Length < 12) return null;
        var bytes = content.AsSpan();
        if (bytes.StartsWith(new byte[] { 0x89, (byte)'P', (byte)'N', (byte)'G', 0x0D, 0x0A, 0x1A, 0x0A })) return "image/png";
        if (bytes.StartsWith(new byte[] { 0xFF, 0xD8, 0xFF })) return "image/jpeg";
        if (bytes.StartsWith("RIFF"u8) && bytes[8..].StartsWith("WEBP"u8)) return "image/webp";
        if (bytes[4..].StartsWith("ftyp"u8)) return "video/mp4";
        return null;
    }
}
