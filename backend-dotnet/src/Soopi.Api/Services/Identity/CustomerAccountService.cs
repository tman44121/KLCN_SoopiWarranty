using Soopi.Api.Data;
using Soopi.Api.Data.Entities;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Identity;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Notifications;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Identity;

public sealed record RegisterCommand(string Phone, string Email, string Otp, string? FullName, string Password);

/// <summary>
/// Tài khoản khách tự phục vụ: đăng ký và quên mật khẩu bằng OTP gửi qua email. Tên đăng nhập vẫn là SĐT; email đã xác minh
/// lưu vào hồ sơ khách và là nơi nhận mã quên mật khẩu, nên mỗi email chỉ gắn với một tài khoản. Hồ sơ khách có sẵn cùng SĐT
/// (khách từng mang máy tới) được gắn vào tài khoản để thấy phiếu cũ.
/// </summary>
public sealed class CustomerAccountService(
    CustomerProfileStore profiles,
    AccountStore accounts,
    OtpService otp,
    PasswordPolicy passwordPolicy,
    CodeGenerator codes,
    TransactionRunner transactions,
    AuthService auth,
    AuditService audit,
    PushDeviceService pushDevices,
    RateLimiter limiter,
    TimeProvider clock)
{
    /// <summary>
    /// Báo rõ SĐT/email đã/chưa có tài khoản để app dẫn khách sang đúng luồng (D-070) — đánh đổi quyền riêng tư nhỏ, được hạn
    /// chế bằng rate limit theo IP trước khi tra cứu. Đăng ký gửi kèm SĐT (không bắt buộc) để báo trùng ngay từ bước lấy mã.
    /// </summary>
    public async Task<OtpIssued> RequestOtpAsync(string rawEmail, string? rawPhone, OtpPurpose? purpose, string? clientIp)
    {
        if (purpose is null) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        limiter.Acquire("otp-ip:" + clientIp, 20, TimeSpan.FromHours(1));
        var email = EmailAddress.Require(rawEmail);
        if (purpose == OtpPurpose.REGISTER)
        {
            if (!JavaText.IsBlank(rawPhone) && await RegisteredAsync(PhoneNumber.Require(rawPhone)))
                throw new DomainException(ErrorCode.CUSTOMER_ACCOUNT_EXISTS);
            if (await profiles.FindActiveWithAccountByEmailAsync(email) is not null)
                throw new DomainException(ErrorCode.CUSTOMER_EMAIL_DUPLICATE);
        }
        else if (await profiles.FindActiveWithAccountByEmailAsync(email) is null)
        {
            throw new DomainException(ErrorCode.CUSTOMER_EMAIL_NOT_FOUND);
        }
        return await otp.IssueAsync(email, purpose.Value, clientIp);
    }

    /// <summary>Kiểm tra mọi thứ rẻ (mật khẩu, họ tên) trước khi tiêu OTP để khách không phải xin mã lại vì gõ sai mật khẩu.</summary>
    public async Task<AuthResult> RegisterAsync(RegisterCommand command, string? clientIp, string? userAgent)
    {
        var phone = PhoneNumber.Require(command.Phone);
        var email = EmailAddress.Require(command.Email);
        passwordPolicy.Validate(phone, command.Password);
        var profile = await profiles.FindActiveByPhoneAsync(phone);
        if (await RegisteredAsync(phone)) throw new DomainException(ErrorCode.CUSTOMER_ACCOUNT_EXISTS);
        profile?.RequireMatchingEmail(email);
        if (await profiles.FindActiveWithAccountByEmailAsync(email) is not null) throw new DomainException(ErrorCode.CUSTOMER_EMAIL_DUPLICATE);
        if (profile is null && string.IsNullOrWhiteSpace(command.FullName)) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        await otp.ConsumeAsync(email, OtpPurpose.REGISTER, command.Otp);
        long accountId;
        try
        {
            accountId = await transactions.InTransactionAsync(() => CreateAccountAsync(phone, email, command));
        }
        catch (DomainException exception)
            when (exception.Code is ErrorCode.ACCOUNT_USERNAME_DUPLICATE or ErrorCode.CUSTOMER_PHONE_DUPLICATE)
        {
            throw new DomainException(ErrorCode.CUSTOMER_ACCOUNT_EXISTS);
        }
        return await auth.SignInAsync(accountId, clientIp, userAgent);
    }

    /// <summary>Bước 1 của quên mật khẩu trên web: xác nhận mã đúng trước khi khách nhập mật khẩu mới (mã chưa bị tiêu).</summary>
    public async Task VerifyResetOtpAsync(string rawEmail, string code)
    {
        var email = EmailAddress.Require(rawEmail);
        if (await profiles.FindActiveWithAccountByEmailAsync(email) is null) throw new DomainException(ErrorCode.CUSTOMER_EMAIL_NOT_FOUND);
        await otp.VerifyAsync(email, OtpPurpose.RESET_PASSWORD, code);
    }

    /// <summary>Thu hồi mọi phiên và mọi thiết bị nhận push: máy bị mất không còn đăng nhập hay nhận thông báo được nữa.</summary>
    public async Task ResetPasswordAsync(string rawEmail, string code, string newPassword)
    {
        var email = EmailAddress.Require(rawEmail);
        var profile = await profiles.FindActiveWithAccountByEmailAsync(email);
        var account = profile?.AccountId is { } id ? await accounts.FindByIdAsync(id) : null;
        if (account is null) throw new DomainException(ErrorCode.CUSTOMER_EMAIL_NOT_FOUND);
        AccountPolicy.RequireCustomerAccount(account);
        passwordPolicy.Validate(account.Username, newPassword);
        await otp.ConsumeAsync(email, OtpPurpose.RESET_PASSWORD, code);
        await auth.RecoverPasswordAsync(account.Id, newPassword);
        await pushDevices.ForgetAllAsync(account.Id);
    }

    private async Task<long> CreateAccountAsync(string phone, string email, RegisterCommand command)
    {
        var now = clock.GetUtcNow();
        var existing = await profiles.FindActiveByPhoneAsync(phone);
        if (existing?.AccountId is not null) throw new DomainException(ErrorCode.CUSTOMER_ACCOUNT_EXISTS);
        existing?.RequireMatchingEmail(email);
        var customerCode = existing?.Code;
        var fullName = existing?.FullName;
        if (customerCode is null)
        {
            customerCode = await codes.NextAsync(BusinessCodeType.Customer);
            fullName = command.FullName!.Trim();
            await profiles.CreateAsync(customerCode, fullName, phone, email, now);
        }
        var account = await accounts.AddAsync(Account.Customer(phone, PasswordHasher.Encode(command.Password), customerCode, false));
        await profiles.LinkAccountAsync(customerCode, account.Id, email);
        await audit.RecordAsync(
            "KH:" + customerCode, fullName, ["CUSTOMER"], "CUSTOMER_ACCOUNT_REGISTERED",
            "Đăng ký tài khoản qua ứng dụng di động", "ACCOUNT", account.Id.ToString());
        return account.Id;
    }

    /// <summary>Có tài khoản nếu hồ sơ khách đang dùng SĐT đã gắn tài khoản, hoặc SĐT đã là tên đăng nhập của ai đó.</summary>
    private async Task<bool> RegisteredAsync(string phone) =>
        (await profiles.FindActiveByPhoneAsync(phone))?.AccountId is not null || await accounts.FindByLoginAsync(phone) is not null;
}
