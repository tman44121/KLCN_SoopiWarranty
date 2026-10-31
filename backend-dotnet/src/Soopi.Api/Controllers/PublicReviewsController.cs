using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Portal;

namespace Soopi.Api.Controllers;

public sealed record ReviewPublicationRequest([NotNull] bool? Published, [Range(1, 5)] int? Rating = null,
    DateTimeOffset? RatedAt = null, [MaxLength(1000)] string? Comment = null);

[ApiController]
[Route("api/v1/public/reviews")]
public sealed class PublicReviewsController(PublicReviewService reviews) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public Task<PublicReviews> List()
    {
        Response.Headers.CacheControl = "no-store";
        return reviews.ListAsync();
    }
}

[ApiController]
[Authorize(Roles = "ADMIN")]
[Route("api/v1/admin/reviews")]
public sealed class ReviewPublicationController(PublicReviewService reviews) : ControllerBase
{
    [HttpPut("{ticketCode}/publication")]
    public async Task<IActionResult> Publish(string ticketCode, [FromBody] ReviewPublicationRequest body)
    {
        await reviews.SetPublicationAsync(ticketCode, body.Published, body.Rating, body.RatedAt, body.Comment);
        return NoContent();
    }
}
