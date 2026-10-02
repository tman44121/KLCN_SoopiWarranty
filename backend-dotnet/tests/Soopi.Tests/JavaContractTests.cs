using System.Globalization;
using System.Text.Json;
using Soopi.Api.Data;
using Soopi.Api.Data.Entities;
using Soopi.Api.Infrastructure.Json;
using Soopi.Api.Infrastructure.Validation;
using Microsoft.EntityFrameworkCore;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Errors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Routing;

namespace Soopi.Tests;

public class JavaContractTests
{
    private enum Status { ACTIVE, LOCKED }
    private sealed record Sample(bool Flag, Status? Status, DateTimeOffset? At, string? Name, int Count);
    private sealed record NullableSample(bool? Flag, int? Count, decimal? Amount, DateOnly? Day, DateTimeOffset? At);

    [Fact]
    public void JsonAndValidation_MatchReadOnlyJavaOracle()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !File.Exists(Path.Combine(root.FullName, "verification", "java-domain-snapshots.json"))) root = root.Parent;
        Assert.NotNull(root);
        using var snapshot = JsonDocument.Parse(File.ReadAllText(Path.Combine(root.FullName, "verification", "java-domain-snapshots.json")));
        var options = JsonSetup.Create();
        var mismatches = new List<string>();
        foreach (var row in snapshot.RootElement.EnumerateObject())
        {
            if (row.Name.StartsWith('{') || row.Name.StartsWith("nullable:", StringComparison.Ordinal))
            {
                JsonElement actual;
                try { actual = row.Name.StartsWith('{')
                    ? JsonSerializer.SerializeToElement(JsonSerializer.Deserialize<Sample>(row.Name, options), options)
                    : JsonSerializer.SerializeToElement(JsonSerializer.Deserialize<NullableSample>(row.Name["nullable:".Length..], options), options); }
                catch (JsonException) { actual = JsonSerializer.SerializeToElement("JSON_ERROR"); }
                catch (FormatException) { actual = JsonSerializer.SerializeToElement("FORMAT_ERROR"); }
                if (!JsonElement.DeepEquals(row.Value, actual)) mismatches.Add(row.Name + " => " + actual);
            }
            else if (row.Name.StartsWith("text:", StringComparison.Ordinal))
            {
                var value = row.Name["text:".Length..];
                var actual = JsonSerializer.SerializeToElement(new { blank = JavaText.IsBlank(value), trimmed = JavaText.Trim(value) });
                if (!JsonElement.DeepEquals(row.Value, actual)) mismatches.Add(row.Name + " => " + actual);
                var payment = new Payment("PT", "TN", null, "CHARGED", DateTimeOffset.UnixEpoch, "Payer", 12m, "CASH", "NV", value);
                var expectedNote = row.Value.GetProperty("blank").GetBoolean() ? null : row.Value.GetProperty("trimmed").GetString();
                if (payment.Note != expectedNote) mismatches.Add(row.Name + " payment note differs");
            }
            else if (row.Name.StartsWith("validation:", StringComparison.Ordinal))
            {
                var value = row.Name["validation:".Length..];
                var actual = JsonSerializer.SerializeToElement(new { notBlank = new NotBlankAttribute().IsValid(value),
                    email = new EmailAttribute().IsValid(value), pattern = new PatternAttribute("CASH|CARD").IsValid(value) });
                if (!JsonElement.DeepEquals(row.Value, actual)) mismatches.Add(row.Name + " => " + actual);
            }
        }
        Assert.True(mismatches.Count == 0, string.Join(Environment.NewLine, mismatches));
    }

    [Fact]
    public void NullRequestBody_HasNoFieldErrors_LikeJavaUnreadableBody()
    {
        var state = new ModelStateDictionary();
        state.AddModelError("", "A non-empty request body is required.");
        var context = new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor(), state);
        var response = Assert.IsType<ObjectResult>(ValidationProblems.Create(context));
        var problem = Assert.IsType<ProblemDetails>(response.Value);
        Assert.Equal(400, response.StatusCode);
        Assert.Empty(Assert.IsAssignableFrom<IReadOnlyList<FieldErrorView>>(problem.Extensions["fieldErrors"]));
    }

    [Fact]
    public void Payment_NormalizesNoteAndLoadedScale_WithoutDatabase()
    {
        var payment = new Payment("PT", "TN", null, "CHARGED", DateTimeOffset.UnixEpoch, "Payer", 12.00m, "CASH", "NV", " note ");
        Assert.Equal("note", payment.Note);
        Assert.Equal("12.00", payment.Amount.ToString(CultureInfo.InvariantCulture));
        var fraction = new Payment("PT", "TN", null, "CHARGED", DateTimeOffset.UnixEpoch, "Payer", 12.50m, "CASH", "NV", " ");
        Assert.Null(fraction.Note);
        Assert.Equal("12.50", fraction.Amount.ToString(CultureInfo.InvariantCulture));
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer("Server=unused;Database=unused;Integrated Security=true").Options);
        var property = db.Model.FindEntityType(typeof(Payment))!.FindProperty(nameof(Payment.Amount))!;
        var converter = property.GetTypeMapping().Converter;
        Assert.NotNull(converter);
        Assert.Equal("12", ((decimal)converter.ConvertFromProvider(12.00m)!).ToString(CultureInfo.InvariantCulture));
        Assert.Equal("12.50", ((decimal)converter.ConvertFromProvider(12.50m)!).ToString(CultureInfo.InvariantCulture));
    }
}
