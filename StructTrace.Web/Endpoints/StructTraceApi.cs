using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using StructTrace.Web.Services.Progress;
using StructTrace.Web.Services.Search;

namespace StructTrace.Web.Endpoints;

/// <summary>
/// The StructTrace JSON API (see API.md). Every endpoint needs a signed-in user;
/// a signed-out caller gets 401, never the login page.
///
///   GET  /api/progress          your saved AIVisual and DSAVisual progress
///   PUT  /api/progress/{area}   save progress for "ai" or "dsa"
///   GET  /api/search?q=...      search every AIVisual, DSAVisual and Sandbox topic
///                               (optional: &source=AIVisual|DSAVisual|Sandbox, &limit=1..20)
/// </summary>
public static class StructTraceApi
{
    public const string RateLimitPolicy = "api";

    /// <summary>
    /// Writes must send this header. Browsers only allow it on same-site requests,
    /// so another website cannot make a signed-in student's browser change their progress.
    /// </summary>
    public const string RequestHeader = "X-Requested-With";
    public const string RequestHeaderValue = "XMLHttpRequest";

    public static IEndpointRouteBuilder MapStructTraceApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api")
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitPolicy);

        api.MapGet("/progress", GetProgressAsync)
           .WithName("GetProgress")
           .WithSummary("Your saved AIVisual and DSAVisual progress.");

        api.MapPut("/progress/{area}", PutProgressAsync)
           .WithName("SaveProgress")
           .WithSummary("Save AIVisual (ai) or DSAVisual (dsa) progress; the newest change of each item wins.");

        api.MapGet("/search", SearchAsync)
           .WithName("SearchSite")
           .WithSummary("Search every AIVisual, DSAVisual and Code Sandbox topic (pgvector).");

        return app;
    }

    /// <summary>A short, stable id for the signed-in user (lets the browser tell accounts apart).</summary>
    public static string UserHash(string userId)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes("structtrace:" + userId));
        return Convert.ToHexString(hash, 0, 8).ToLowerInvariant();
    }

    private static async Task<IResult> GetProgressAsync(
        ClaimsPrincipal user, HttpContext context, IProgressStore store, ILoggerFactory logs, CancellationToken ct)
    {
        context.Response.Headers.CacheControl = "no-store";
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

        try
        {
            var areas = await store.GetAllAsync(userId, ct);
            // "now" lets the browser correct for a wrong clock when it stamps changes.
            return Results.Ok(new { uid = UserHash(userId), now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), areas });
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // The browser left the page before the answer came: nothing to send.
            return ClientClosedRequest();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logs.CreateLogger("StructTrace.Api").LogError(ex, "Could not read progress. Has Update-Database been run?");
            return Unavailable();
        }
    }

    private static async Task<IResult> PutProgressAsync(
        string area,
        [FromBody] ProgressPutRequest? body,
        ClaimsPrincipal user,
        HttpContext context,
        IProgressStore store,
        ILoggerFactory logs)
    {
        context.Response.Headers.CacheControl = "no-store";

        if (!string.Equals(context.Request.Headers[RequestHeader], RequestHeaderValue, StringComparison.Ordinal))
        {
            return Results.BadRequest(new { message = $"Send the {RequestHeader}: {RequestHeaderValue} header." });
        }

        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

        area = (area ?? "").ToLowerInvariant();
        var error = ProgressMerge.Validate(area, body?.Items);
        if (error != null) return Results.BadRequest(new { message = error });

        try
        {
            // Not cancelled when the browser leaves the page: a save that has
            // started always finishes, so no progress is lost and the
            // transaction is never cut off half way.
            var items = await store.MergeAsync(userId, area, body!.Items!, CancellationToken.None);
            return Results.Ok(new { uid = UserHash(userId), area, items });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("too large", StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new { message = ex.Message });
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logs.CreateLogger("StructTrace.Api").LogError(ex, "Could not save progress. Has Update-Database been run?");
            return Unavailable();
        }
    }

    private static async Task<IResult> SearchAsync(
        string? q, int? limit, string? source, HttpContext context, SiteSearchService search, CancellationToken ct)
    {
        context.Response.Headers.CacheControl = "no-store";

        try
        {
            var response = await search.SearchAsync(q, limit ?? 8, source, ct);
            return Results.Ok(response);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // The search box sent a newer search (or the page closed): nothing to send.
            return ClientClosedRequest();
        }
    }

    // 499 "client closed request": the browser stopped waiting for this answer.
    // Catching the cancellation here keeps it out of the logs and stops the
    // Visual Studio debugger from breaking on it.
    private static IResult ClientClosedRequest() => Results.StatusCode(499);

    private static IResult Unavailable() =>
        Results.Json(
            new { message = "Saving progress to your account is not available right now. It is still saved in this browser." },
            statusCode: StatusCodes.Status503ServiceUnavailable);
}