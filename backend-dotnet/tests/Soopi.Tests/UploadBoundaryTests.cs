using System.Data;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Soopi.Api.Controllers;
using Soopi.Api.Data;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Portal;

namespace Soopi.Tests;

public class UploadBoundaryTests
{
    private static readonly byte[] Png = [0x89, (byte)'P', (byte)'N', (byte)'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
    private static HttpRequest Request(params ProbeFile[] files)
    {
        var request = new DefaultHttpContext().Request;
        request.ContentType = "multipart/form-data; boundary=test";
        var collection = new FormFileCollection(); foreach (var file in files) collection.Add(file);
        request.Form = new FormCollection(new Dictionary<string, Microsoft.Extensions.Primitives.StringValues>(), collection);
        return request;
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ExhaustedQuota_IsRejectedBeforeReadingMultipart(bool signedIn)
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var limiter = new RateLimiter(cache, TimeProvider.System);
        var key = signedIn ? "portal-warranty-request-customer:KH-1" : "portal-warranty-request-ip:";
        var limit = signedIn ? 5 : 3;
        for (var i = 0; i < limit; i++) limiter.Acquire(key, limit, TimeSpan.FromHours(1));
        using var connection = new RecordingConnection(_ =>
        {
            var table = new DataTable();
            foreach (var (name, type) in new[] { ("MaKH", typeof(string)), ("MaTaiKhoan", typeof(long)), ("DiaChi", typeof(string)), ("NgayTao", typeof(DateTime)),
                ("Email", typeof(string)), ("HoTen", typeof(string)), ("GopVaoMaKH", typeof(string)), ("SDT", typeof(string)), ("TrangThai", typeof(string)) }) table.Columns.Add(name, type);
            table.Rows.Add("KH-1", 1L, DBNull.Value, DateTime.Now, DBNull.Value, "Khách", DBNull.Value, "0901234567", "ACTIVE");
            return table;
        });
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var context = new DefaultHttpContext();
        if (signedIn) context.Items["soopi.actor"] = new AuthenticatedActor(1, "customer", new HashSet<Role> { Role.CUSTOMER },
            RolePermissions.ForRole(Role.CUSTOMER), null, "KH-1", "Khách");
        var actors = new CurrentActor(new HttpContextAccessor { HttpContext = context });
        using var body = new ProbeStream(Encoding.UTF8.GetBytes("--test\r\nContent-Disposition: form-data; name=\"data\"\r\n\r\n{}\r\n--test--\r\n"));
        context.Request.ContentType = "multipart/form-data; boundary=test";
        context.Request.ContentLength = body.Length; context.Request.Body = body;
        var service = new PortalWarrantyRequestService(new PortalPolicy(db, actors), null!, null!, limiter, actors);
        var controller = new PortalController(null!, service, null!, null!, actors) { ControllerContext = new() { HttpContext = context } };

        var error = await Record.ExceptionAsync(() => signedIn ? controller.SubmitMine() : controller.Submit());

        Assert.Equal(0, body.BytesRead);
        Assert.Equal(ErrorCode.RATE_LIMITED, Assert.IsType<DomainException>(error).Code);
    }

    [Theory]
    [InlineData("count")]
    [InlineData("length")]
    [InlineData("image")]
    [InlineData("type")]
    [InlineData("lying-length")]
    public async Task InvalidUpload_IsRejectedBeforeFullCopy(string reason)
    {
        var first = new ProbeFile("files", Png);
        var invalid = new ProbeFile("files", reason == "type" ? new byte[12] : reason == "lying-length" ? [.. Png, 0] : Png)
        {
            DeclaredLength = reason switch { "length" => 30L * 1024 * 1024 + 1, "image" => 5L * 1024 * 1024 + 1, _ => 12 },
        };
        var files = reason == "count" ? Enumerable.Range(0, 6).Select(_ => new ProbeFile("files", Png)).ToArray() : new[] { first, invalid };
        var error = await Record.ExceptionAsync(() => MultipartJson.FilesAsync(Request(files), "files"));
        Assert.IsType<DomainException>(error);
        Assert.All(files, file => Assert.Equal(0, file.FullCopies));
        if (reason is "count" or "length") Assert.All(files, file => Assert.Equal(0, file.Opens));
    }

    [Fact]
    public async Task OversizedJsonPart_IsRejectedBeforeOpeningIt()
    {
        var data = new ProbeFile("data", Encoding.UTF8.GetBytes("{\"value\":1}")) { DeclaredLength = 64 * 1024 + 1 };
        var error = await Record.ExceptionAsync(() => MultipartJson.ReadAsync<Dictionary<string, int>>(Request(data)));
        Assert.IsType<DomainException>(error);
        Assert.Equal(0, data.Opens);
    }

    [Fact]
    public async Task ValidImageAndVideo_PreserveTheirBytes()
    {
        var video = Encoding.ASCII.GetBytes("\0\0\0 ftypisom");
        var uploads = await MultipartJson.FilesAsync(Request(new ProbeFile("files", Png), new ProbeFile("files", video)), "files");
        Assert.Equal(Png, uploads[0].Content); Assert.Equal(video, uploads[1].Content);
    }

    private sealed class ProbeFile(string name, byte[] content) : IFormFile
    {
        public long? DeclaredLength { get; init; }
        public int Opens { get; private set; }
        public int FullCopies { get; private set; }
        public string ContentType => "application/octet-stream";
        public string ContentDisposition => "";
        public IHeaderDictionary Headers { get; } = new HeaderDictionary();
        public long Length => DeclaredLength ?? content.Length;
        public string Name => name;
        public string FileName => "upload";
        public Stream OpenReadStream() { Opens++; return new MemoryStream(content); }
        public void CopyTo(Stream target) { FullCopies++; target.Write(content); }
        public Task CopyToAsync(Stream target, CancellationToken cancellationToken = default) { FullCopies++; return target.WriteAsync(content, cancellationToken).AsTask(); }
    }

    private sealed class ProbeStream(byte[] content) : MemoryStream(content)
    {
        public int BytesRead { get; private set; }
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            var count = base.Read(buffer.Span); BytesRead += count; return ValueTask.FromResult(count);
        }
    }
}
