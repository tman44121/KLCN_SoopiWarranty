using Soopi.Api.Data.Entities;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Services.Customers;
using Soopi.Api.Services.Files;
using Soopi.Api.Services.WarrantyRequests;

namespace Soopi.Tests;

public class CustomerPortalTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 26, 3, 0, 0, TimeSpan.Zero);

    private static AuthenticatedActor Actor(params Role[] roles) =>
        new(1, "u", roles.ToHashSet(), RolePermissions.ForRoles(roles), "NV-001", null, "U");

    [Fact]
    public void CustomerView_ProjectsByRole()
    {
        var customer = new Customer("KH-000001", "Nguyễn Minh Tuấn", "0912345678", "a@b.vn", "Q1", Now);
        Assert.Equal(CustomerProjection.FULL, CustomerView.ProjectionFor(Actor(Role.DISPATCHER)));
        Assert.Equal(CustomerProjection.CONTACT, CustomerView.ProjectionFor(Actor(Role.CASHIER)));
        Assert.Equal(CustomerProjection.NONE, CustomerView.ProjectionFor(Actor(Role.WAREHOUSE_KEEPER)));
        var limited = CustomerView.From(customer, CustomerView.ProjectionFor(Actor(Role.TECHNICIAN)));
        Assert.Equal("0912***678", limited.Phone);
        Assert.Null(limited.Email);
        Assert.Null(CustomerView.From(customer, CustomerProjection.NONE).FullName);
    }

    [Fact]
    public void Uploads_DetectedByMagicBytes()
    {
        var png = new byte[] { 0x89, (byte)'P', (byte)'N', (byte)'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0 };
        Assert.Equal("image/png", AttachmentService.RequireAllowed(png));
        Assert.Equal("video/mp4", AttachmentService.Sniff("\0\0\0 ftypisom"u8.ToArray()));
        Assert.Throws<DomainException>(() => AttachmentService.RequireAllowed("<html>hello</html>"u8.ToArray()));
        var bigImage = new byte[5 * 1024 * 1024 + 1];
        png.CopyTo(bigImage, 0);
        Assert.Throws<DomainException>(() => AttachmentService.RequireAllowed(bigImage));
        Assert.Equal("anh.png", new Upload("C:\\tmp\\a\"nh.png", png).SafeFileName());
        Assert.Equal("tep-dinh-kem", new Upload(" ", png).SafeFileName());
    }

    [Fact]
    public void WarrantyRequest_ValidatedLikeJavaRecord()
    {
        var command = new SubmissionCommand(" Tuấn ", "+84 912 345 678", " ", null, "PHONE", "SMARTPHONE", " iPhone 15 ", "IMEI",
            "354812109876540", " Không lên nguồn ", "HCM", null, null);
        var request = WarrantyRequestSubmissionService.Validated("YC-2026-0926-00001", command, Now);
        Assert.Equal("Tuấn", request.FullName);
        Assert.Equal("0912345678", request.Phone);
        Assert.Null(request.Email);
        Assert.Equal("iPhone 15", request.BrandModel);
        Assert.Throws<DomainException>(() => WarrantyRequestSubmissionService.Validated("YC-1", command with { IdentifierType = "X" }, Now));
        Assert.Throws<DomainException>(() => WarrantyRequestSubmissionService.Validated("YC-1",
            command with { PreferredFrom = Now, PreferredTo = Now.AddHours(-1) }, Now));
    }
}
