using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Soopi.Api.Data;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Infrastructure.Errors;

/// <summary>Tương đương ApiErrorHandler (Java): mọi ngoại lệ thành Problem Details có mã nghiệp vụ.</summary>
public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        switch (SqlErrors.Translate(exception))
        {
            case DomainException domain:
                await ProblemWriter.WriteAsync(context, domain.Code, domain.Arguments);
                return true;
            case Validation.RequestValidationException invalid:
                await ProblemWriter.WriteAsync(context, ErrorCode.VALIDATION_FAILED, fieldErrors: invalid.FieldErrors);
                return true;
            case DbUpdateConcurrencyException:
                await ProblemWriter.WriteAsync(context, ErrorCode.CONCURRENT_MODIFICATION);
                return true;
            case UnauthorizedAccessException:
                await ProblemWriter.WriteAsync(context, ErrorCode.ACCESS_DENIED);
                return true;
            // Body JSON hỏng / sai kiểu, form/multipart lỗi, body quá lớn → 400 thay vì lỗi hệ thống.
            case JsonException or BadHttpRequestException or InvalidDataException:
                await ProblemWriter.WriteAsync(context, ErrorCode.VALIDATION_FAILED);
                return true;
            default:
                if (exception is DbUpdateException)
                    logger.LogWarning(exception, "Vi phạm ràng buộc dữ liệu chưa được ánh xạ");
                else
                    logger.LogError(exception, "Lỗi hệ thống chưa được xử lý");
                await ProblemWriter.WriteAsync(
                    context, exception is DbUpdateException ? ErrorCode.VALIDATION_FAILED : ErrorCode.SYSTEM_ERROR);
                return true;
        }
    }
}
