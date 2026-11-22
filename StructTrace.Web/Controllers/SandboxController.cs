
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StructTrace.Web.Data;
using StructTrace.Web.Models;

namespace StructTrace.Web.Controllers;

[Authorize]
public class SandboxController : Controller
{
    private readonly ApplicationDbContext _db;

    public SandboxController(ApplicationDbContext db)
    {
        _db = db;
    }

    // =====================================================
    // 1. OPEN CODE SANDBOX
    // =====================================================

    [HttpGet]
    public async Task<IActionResult> Index(string slug = "binary-search-tree")
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        // Retrieve all available lessons.
        var allLessons = await _db.Lessons
            .OrderBy(l => l.Id)
            .ToListAsync();

        if (allLessons.Count == 0)
            return NotFound("No lessons are currently available.");

        // Find the selected lesson.
        var lesson = allLessons.FirstOrDefault(l => l.Slug == slug)
                     ?? allLessons.First();

        ViewBag.AllLessons = allLessons;

        // Retrieve the user's code submissions.
        ViewBag.Submissions = await _db.CodeSubmissions
            .Where(s => s.UserId == userId && s.LessonId == lesson.Id)
            .OrderByDescending(s => s.SubmittedAtUtc)
            .Take(10)
            .ToListAsync();

        // Retrieve the user's saved execution traces.
        ViewBag.SavedTraces = await _db.SavedTraces
            .Where(t => t.UserId == userId && t.LessonId == lesson.Id)
            .OrderByDescending(t => t.CreatedAtUtc)
            .Take(10)
            .ToListAsync();

        // The selected lesson remains the view model.
        return View(lesson);
    }


    // =====================================================
    // 2. SAVE CODE SUBMISSION
    // =====================================================

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SaveSubmission(
        int lessonId,
        string slug,
        string language,
        string sourceCode,
        string executionNotes,
        double executionTimeMs)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var lessonExists = await _db.Lessons
            .AnyAsync(l => l.Id == lessonId);

        if (!lessonExists)
            return NotFound("Lesson not found.");

        var submission = new CodeSubmission
        {
            UserId = userId,
            LessonId = lessonId,
            Language = language,
            SourceCode = sourceCode,
            ExecutionNotes = string.IsNullOrWhiteSpace(executionNotes)
                ? "Logged trace run"
                : executionNotes,
            ExecutionTimeMs = executionTimeMs
        };

        _db.CodeSubmissions.Add(submission);

        await _db.SaveChangesAsync();

        TempData["StatusMessage"] =
            "Code run saved to Neon PostgreSQL.";

        return RedirectToAction(nameof(Index), new { slug });
    }


    // =====================================================
    // 3. SAVE VISUAL TRACE (EXISTING FORM ENDPOINT)
    // =====================================================

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SaveTrace(
        int lessonId,
        string slug,
        string title,
        string inputSequence,
        string traceFramesJson)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var lessonExists = await _db.Lessons
            .AnyAsync(l => l.Id == lessonId);

        if (!lessonExists)
            return NotFound("Lesson not found.");

        var savedTrace = new SavedTrace
        {
            UserId = userId,
            LessonId = lessonId,
            Title = string.IsNullOrWhiteSpace(title)
                ? "Custom Trace"
                : title,
            InputSequence = inputSequence ?? "",
            TraceFramesJson = string.IsNullOrWhiteSpace(traceFramesJson)
                ? "[]"
                : traceFramesJson
        };

        _db.SavedTraces.Add(savedTrace);

        await _db.SaveChangesAsync();

        TempData["StatusMessage"] =
            "Visual trace frames saved to Neon PostgreSQL.";

        return RedirectToAction(nameof(Index), new { slug });
    }


    // =====================================================
    // 4. SAVE TRACE FROM JAVASCRIPT / CODE SANDBOX
    // POST: /Sandbox/Save
    // =====================================================

    [HttpPost("/Sandbox/Save")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Save(
        [FromBody] SandboxSaveRequest? request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        // Validate incoming request.
        if (request == null || request.LessonId <= 0)
        {
            return BadRequest(new
            {
                message = "Invalid trace save request."
            });
        }

        var lessonExists = await _db.Lessons
            .AnyAsync(l => l.Id == request.LessonId);

        if (!lessonExists)
        {
            return BadRequest(new
            {
                message = "The selected lesson does not exist."
            });
        }

        // Prepare trace information for the JSONB column.
        var traceData = JsonSerializer.Serialize(new
        {
            language = request.Language,
            executionSummary = request.Output,
            sourceCode = request.Code,
            frames = request.TraceFrames ?? new List<JsonElement>()
        });

        var title = string.IsNullOrWhiteSpace(request.Topic)
            ? "Custom Trace"
            : request.Topic.Trim();

        // SavedTraces database record.
        var savedTrace = new SavedTrace
        {
            UserId = userId,
            LessonId = request.LessonId,
            Title = title.Length > 120
                ? title[..120]
                : title,
            InputSequence = request.Input ?? "",
            TraceFramesJson = traceData
        };

        // Insert into Neon PostgreSQL.
        _db.SavedTraces.Add(savedTrace);

        await _db.SaveChangesAsync();

        // Return the new record information to JavaScript.
        return Ok(new
        {
            success = true,
            id = savedTrace.Id,
            createdAt = DateTime.UtcNow,
            message = "Execution trace saved successfully."
        });
    }


    // =====================================================
    // 5. DELETE SAVED TRACE
    // POST: /Sandbox/Delete/{id}
    // =====================================================

    [HttpPost("/Sandbox/Delete/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteTrace(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        // Only allow users to delete their own records.
        var savedTrace = await _db.SavedTraces
            .FirstOrDefaultAsync(t =>
                t.Id == id &&
                t.UserId == userId);

        if (savedTrace == null)
        {
            return NotFound(new
            {
                message = "Saved execution trace not found."
            });
        }

        _db.SavedTraces.Remove(savedTrace);

        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Execution trace deleted successfully."
        });
    }
}


// =========================================================
// 6. JAVASCRIPT SAVE REQUEST MODEL
// =========================================================

public class SandboxSaveRequest
{
    public int LessonId { get; set; }

    public string Topic { get; set; } = "";

    public string Language { get; set; } = "";

    public string Input { get; set; } = "";

    public string Output { get; set; } = "";

    public string Code { get; set; } = "";

    public List<JsonElement>? TraceFrames { get; set; }
}
