using System.ComponentModel.DataAnnotations.Schema;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Data.Entities;

public enum IdentifierType
{
    IMEI,
    SERIAL,
}

/// <summary>
/// Bảng ThietBi. Serial/IMEI chỉ lưu dạng đã chuẩn hóa; thông tin sản phẩm (tên, hãng, nhóm, loại) đọc từ danh mục qua
/// khóa ngoại MaSP (ProductCatalog).
/// </summary>
public class Device
{
    private Device()
    {
    }

    public Device(
        string id, string productId, IdentifierType identifierType,
        string serialOrImei, string customerId, DateOnly? activatedOn, DateOnly? expiresOn, string? distributor, DateTimeOffset now)
    {
        if (activatedOn is not null && expiresOn is not null && expiresOn < activatedOn) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        Id = id;
        ProductId = productId;
        IdentifierType = identifierType;
        displaySerial = serialOrImei.Trim();
        SerialNormalized = identifierType == IdentifierType.IMEI ? Imei.Require(serialOrImei) : SerialNumber.Require(serialOrImei);
        CustomerId = customerId;
        WarrantyActivatedOn = activatedOn;
        WarrantyExpiresOn = expiresOn;
        Distributor = distributor;
        CreatedAt = now;
    }

    private string? displaySerial;

    public string Id { get; private set; } = "";

    public string ProductId { get; private set; } = "";

    public IdentifierType IdentifierType { get; private set; }

    public string SerialNormalized { get; private set; } = "";

    public string? CustomerId { get; private set; }

    public DateOnly? WarrantyActivatedOn { get; private set; }

    public DateOnly? WarrantyExpiresOn { get; private set; }

    public string? Distributor { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>Như bản Java: ngay sau khi đăng ký là chuỗi khách nhập (đã trim), đọc lại từ DB là dạng chuẩn hóa.</summary>
    [NotMapped] public string SerialOrImei => displaySerial ?? SerialNormalized;
}
