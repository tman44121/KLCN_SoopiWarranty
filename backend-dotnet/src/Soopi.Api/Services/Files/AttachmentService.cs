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

public sealed record FileMetadata(string Id, string FileName, string ContentType, string StorageKey, FileOwner Owner);

/// <summary>
/// Nội dung tệp nằm trên đĩa (<c>Storage:Directory</c>); bảng TepDinhKem giữ tên, loại, kích thước, chủ sở hữu và khóa lưu
/// trữ (đường dẫn tương đối). Mã tệp trả cho API là MaTep.
/// </summary>
public sealed class FileStorage(Sql sql, TimeProvider clock, IConfiguration configuration, TransactionRunner transactions)
{
    private readonly string root = Path.GetFullPath(configuration["Storage:Directory"] ?? "./data/files");

    public Task<string> StoreAsync(string fileName, string contentType, byte[] content, FileOwner owner) => transactions.InTransactionAsync(async () =>
    {
        var now = clock.GetUtcNow();
        var key = now.ToOffset(DbTime.Offset).ToString("yyyy/MM") + "/" + Guid.NewGuid();
        var target = Resolve(key);
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        transactions.AfterRollback(() => File.Delete(target));
        try
        {
            await File.WriteAllBytesAsync(target, content);
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
    });

    public async Task<FileMetadata?> FindMetadataAsync(string? fileId)
    {
        if (!long.TryParse(fileId, out var id)) return null;
        var row = await sql.FirstOrDefaultAsync(
            // Chủ phiếu/yêu cầu đã gắn mã khách; SĐT chỉ dùng cho yêu cầu vãng lai.
            "SELECT t.LoaiChuSoHuu, t.MaChuSoHuu, t.TenTep, t.LoaiNoiDung, t.DuongDanLuuTru, t.NguoiTaiLen, "
            + "COALESCE(ptn.MaKH, yc.MaKH, kh.MaKH) AS MaKH FROM TepDinhKem t LEFT JOIN PhieuTiepNhan ptn "
            + "ON t.LoaiChuSoHuu = 'HANDOVER_SIGNATURE' AND ptn.MaPhieuTN = t.MaChuSoHuu "
            + "LEFT JOIN YeuCauBaoHanh yc ON t.LoaiChuSoHuu = 'WARRANTY_REQUEST' AND yc.MaYeuCau = t.MaChuSoHuu "
            + "LEFT JOIN KhachHang kh ON yc.MaKH IS NULL AND kh.SDT = yc.SDTKhach AND kh.TrangThai = 'ACTIVE' WHERE t.MaTep = ?",
            row => (Name: row.Str("TenTep")!, Type: row.Str("LoaiNoiDung")!, Key: row.Str("DuongDanLuuTru")!,
                Owner: new FileOwner(row.Str("LoaiChuSoHuu")!, row.Str("MaChuSoHuu")!, row.Str("MaKH"), row.Str("NguoiTaiLen"))),
            id);
        return row.Owner is null ? null : new FileMetadata(fileId!, row.Name, row.Type, row.Key, row.Owner);
    }

    public async Task<StoredFile?> ReadAsync(FileMetadata file)
    {
        try
        {
            var content = await File.ReadAllBytesAsync(Resolve(file.StorageKey));
            return new StoredFile(file.Id, file.FileName, file.ContentType, content, file.Owner);
        }
        catch (FileNotFoundException) { return null; }
        catch (DirectoryNotFoundException) { return null; }
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

public sealed class AttachmentService(FileStorage storage, Sql sql, CurrentActor actors, TransactionRunner transactions)
{
    public const string WarrantyRequest = "WARRANTY_REQUEST";
    public const string HandoverSignature = "HANDOVER_SIGNATURE";
    public const int MaxFiles = 5;
    public const int MaxImageBytes = 5 * 1024 * 1024;
    public const int MaxVideoBytes = 30 * 1024 * 1024;

    /// <summary>Ảnh/video lỗi của yêu cầu bảo hành online: tối đa 5 file, kiểm tra hết trước khi lưu file nào.</summary>
    public Task<List<Attachment>> StoreWarrantyRequestFilesAsync(string requestCode, IReadOnlyList<Upload> uploads) => transactions.InTransactionAsync(async () =>
    {
        if (uploads.Count > MaxFiles) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var types = uploads.Select(upload => RequireAllowed(upload.Content)).ToList();
        var stored = new List<Attachment>();
        for (var index = 0; index < uploads.Count; index++)
        {
            var name = uploads[index].SafeFileName();
            var id = await storage.StoreAsync(name, types[index], uploads[index].Content, new FileOwner(WarrantyRequest, requestCode, null, "PORTAL"));
            stored.Add(new Attachment(id, name, types[index], uploads[index].Content.Length));
        }
        return stored;
    });

    /// <summary>POL-13; ngoài phạm vi được xem trả 404 để không lộ sự tồn tại của file.</summary>
    public async Task<StoredFile> DownloadAsync(string fileId)
    {
        var file = await storage.FindMetadataAsync(fileId);
        if (file is null || !(CanRead(file.Owner) || await CanReadThroughTicketAsync(file.Owner)))
            throw new DomainException(ErrorCode.NOT_FOUND);
        return await storage.ReadAsync(file) ?? throw new DomainException(ErrorCode.NOT_FOUND);
    }

    /// <summary>
    /// Ảnh/video của yêu cầu đã thành phiếu: ai xem được phiếu (đọc mọi phiếu, hoặc KTV đang được phân công) thì xem được ảnh
    /// khách gửi để đối chiếu khi chẩn đoán.
    /// </summary>
    private async Task<bool> CanReadThroughTicketAsync(FileOwner owner)
    {
        var actor = actors.Actor;
        if (owner.Type != WarrantyRequest || actor is null) return false;
        if (actor.Permissions.Contains(Permission.TICKET_READ_ALL))
            return await sql.ScalarAsync("SELECT 1 FROM PhieuTiepNhan WHERE MaYeuCau = ?", owner.Id) is not null;
        return actor.Permissions.Contains(Permission.TICKET_READ_ASSIGNED) && actor.EmployeeId is not null
            && await sql.ScalarAsync(
                "SELECT 1 FROM PhieuTiepNhan ptn JOIN PhanCong pc ON pc.MaPhieuTN = ptn.MaPhieuTN WHERE ptn.MaYeuCau = ? AND pc.MaKTV = ?",
                owner.Id, actor.EmployeeId) is not null;
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
        var limit = type.StartsWith("video/", StringComparison.Ordinal) ? MaxVideoBytes : MaxImageBytes;
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
