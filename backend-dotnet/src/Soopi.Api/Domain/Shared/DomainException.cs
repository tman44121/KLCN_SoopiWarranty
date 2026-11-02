namespace Soopi.Api.Domain.Shared;

public sealed class DomainException(ErrorCode code, params object?[] arguments) : Exception(code.ToString())
{
    public ErrorCode Code { get; } = code;

    public object?[] Arguments { get; } = arguments;

    /// <summary>VALIDATION_FAILED kèm câu lỗi cụ thể (tiếng Việt) để người dùng biết sai ở đâu.</summary>
    public static DomainException Invalid(string reason) => new(ErrorCode.VALIDATION_FAILED, reason);
}
