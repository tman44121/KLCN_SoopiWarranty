namespace Soopi.Api.Domain.Shared;

public sealed class DomainException(ErrorCode code, params object?[] arguments) : Exception(code.ToString())
{
    public ErrorCode Code { get; } = code;

    public object?[] Arguments { get; } = arguments;
}
