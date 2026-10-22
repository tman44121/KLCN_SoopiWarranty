using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Chat;

namespace Soopi.Api.Controllers;

public sealed record StartChatRequest([NotBlank, MaxLength(30)] string TicketCode, [NotBlank, MaxLength(20)] string StaffAccountId);
public sealed record SendChatRequest([NotBlank, MaxLength(2000)] string Text, [NotBlank, MaxLength(36)] string RequestId);
public sealed record ReadChatRequest([NotBlank, MaxLength(20)] string LastMessageId);

[ApiController]
[Authorize]
[Route("api/v1/chat")]
public sealed class ChatController(ChatService chat) : ControllerBase
{
    [HttpGet("contacts")]
    public Task<ChatDirectory> Contacts([FromQuery] string? q, [FromQuery] int page = 0) => chat.ContactsAsync(q, page);

    [HttpPost("conversations")]
    public async Task<object> Start([FromBody] StartChatRequest body) => new { id = await chat.StartAsync(body.TicketCode, body.StaffAccountId) };

    [HttpGet("conversations/{id}/messages")]
    public Task<ChatHistory> Messages(string id, [FromQuery] string? before, [FromQuery] string? after) => chat.MessagesAsync(id, before, after);

    [HttpPost("conversations/{id}/messages")]
    public Task<ChatMessage> Send(string id, [FromBody] SendChatRequest body) => chat.SendAsync(id, body.Text, body.RequestId);

    [HttpPost("conversations/{id}/read")]
    public async Task<IActionResult> Read(string id, [FromBody] ReadChatRequest body)
    {
        await chat.ReadAsync(id, body.LastMessageId);
        return NoContent();
    }
}
