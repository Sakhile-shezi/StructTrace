using System.Security.Claims;
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

    [HttpGet]
    public async Task<IActionResult> Index(string slug = "binary-search-tree")
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var allLessons = await _db.Lessons.OrderBy(l => l.Id).ToListAsync();
        var lesson = allLessons.FirstOrDefault(l => l.Slug == slug) ?? allLessons.First();

        ViewBag.AllLessons = allLessons;

        ViewBag.Submissions = await _db.CodeSubmissions
            .Where(s => s.UserId == userId && s.LessonId == lesson.Id)
            .OrderByDescending(s => s.SubmittedAtUtc)
            .Take(10)
            .ToListAsync();

        ViewBag.SavedTraces = await _db.SavedTraces
            .Where(t => t.UserId == userId && t.LessonId == lesson.Id)
            .OrderByDescending(t => t.CreatedAtUtc)
            .Take(10)
            .ToListAsync();

        return View(lesson);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SaveSubmission(int lessonId, string slug, string language, string sourceCode, string executionNotes, double executionTimeMs)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        _db.CodeSubmissions.Add(new CodeSubmission
        {
            UserId = userId,
            LessonId = lessonId,
            Language = language,
            SourceCode = sourceCode,
            ExecutionNotes = string.IsNullOrWhiteSpace(executionNotes) ? "Logged trace run" : executionNotes,
            ExecutionTimeMs = executionTimeMs
        });

        await _db.SaveChangesAsync();
        TempData["StatusMessage"] = "Code run saved to Neon Postgres.";
        return RedirectToAction(nameof(Index), new { slug });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SaveTrace(int lessonId, string slug, string title, string inputSequence, string traceFramesJson)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        _db.SavedTraces.Add(new SavedTrace
        {
            UserId = userId,
            LessonId = lessonId,
            Title = string.IsNullOrWhiteSpace(title) ? "Custom Trace" : title,
            InputSequence = inputSequence,
            TraceFramesJson = string.IsNullOrWhiteSpace(traceFramesJson) ? "[]" : traceFramesJson
        });

        await _db.SaveChangesAsync();
        TempData["StatusMessage"] = "Visual trace frames saved to Neon JSONB.";
        return RedirectToAction(nameof(Index), new { slug });
    }
}