using System;
using System.Linq;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StructTrace.Web.Data;
using StructTrace.Web.Models;

namespace StructTrace.Web.Controllers
{
    /// <summary>
    /// Personal notes for the AIVisual exam problems.
    /// GET  /api/ai-notes/token       -> { token } antiforgery request token for the static notes page
    /// GET  /api/ai-notes             -> every note of the signed-in user (id, updatedAt)
    /// GET  /api/ai-notes/{problemId} -> { problemId, content, updatedAt }
    /// PUT  /api/ai-notes/{problemId} -> body { content }; creates or replaces the note
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/ai-notes")]
    public class AiNotesController : ControllerBase
    {
        private static readonly Regex ValidId = new("^[A-Za-z0-9-]{1,64}$", RegexOptions.Compiled);
        private const int MaxLength = 20000;
        private readonly ApplicationDbContext _db;

        public AiNotesController(ApplicationDbContext db) => _db = db;

        private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        public record NoteDto(string ProblemId, string Content, DateTime? UpdatedAt);
        public record SaveNoteRequest(string Content);

        // wwwroot/ai-visualizer/notes.html is a static page, so it asks for the token here
        // (this also sets the antiforgery cookie that the PUT is checked against).
        [HttpGet("token")]
        [IgnoreAntiforgeryToken]
        public IActionResult Token([FromServices] IAntiforgery antiforgery)
        {
            var tokens = antiforgery.GetAndStoreTokens(HttpContext);
            return Ok(new { token = tokens.RequestToken });
        }

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var notes = await _db.AiNotes.AsNoTracking()
                .Where(n => n.UserId == CurrentUserId && n.Content != "")
                .OrderByDescending(n => n.UpdatedAt)
                .Select(n => new { n.ProblemId, n.UpdatedAt })
                .ToListAsync();
            return Ok(notes);
        }

        [HttpGet("{problemId}")]
        public async Task<IActionResult> Get(string problemId)
        {
            if (!ValidId.IsMatch(problemId)) return BadRequest("Unknown problem id.");
            var note = await _db.AiNotes.AsNoTracking()
                .FirstOrDefaultAsync(n => n.UserId == CurrentUserId && n.ProblemId == problemId);
            return Ok(new NoteDto(problemId, note?.Content ?? string.Empty, note?.UpdatedAt));
        }

        [HttpPut("{problemId}")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Save(string problemId, [FromBody] SaveNoteRequest body)
        {
            if (!ValidId.IsMatch(problemId)) return BadRequest("Unknown problem id.");
            var content = body?.Content ?? string.Empty;
            if (content.Length > MaxLength) return BadRequest($"Notes are limited to {MaxLength} characters.");

            var note = await _db.AiNotes
                .FirstOrDefaultAsync(n => n.UserId == CurrentUserId && n.ProblemId == problemId);
            if (note == null)
            {
                note = new AiNote { UserId = CurrentUserId, ProblemId = problemId };
                _db.AiNotes.Add(note);
            }
            note.Content = content;
            note.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new NoteDto(problemId, note.Content, note.UpdatedAt));
        }
    }
}
