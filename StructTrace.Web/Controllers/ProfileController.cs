using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StructTrace.Web.Data;
using StructTrace.Web.Models;
using StructTrace.Web.Services.Progress;

namespace StructTrace.Web.Controllers;

[Authorize]
public class ProfileController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly ApplicationDbContext _db;
    private readonly IProgressStore _progress;
    private readonly ILogger<ProfileController> _logger;

    public ProfileController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        ApplicationDbContext db,
        IProgressStore progress,
        ILogger<ProfileController> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _db = db;
        _progress = progress;
        _logger = logger;
    }

    // GET /Profile
    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return Challenge();

        return View(await BuildModelAsync(user, null));
    }

    // POST /Profile/Update
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Update([Bind(Prefix = "Edit")] ProfileEditModel input)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return Challenge();

        input.DisplayName = (input.DisplayName ?? "").Trim();

        if (!ModelState.IsValid)
        {
            return View("Index", await BuildModelAsync(user, input));
        }

        user.DisplayName = input.DisplayName;

        var result = await _userManager.UpdateAsync(user);

        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError("Edit.DisplayName", error.Description);
            }

            return View("Index", await BuildModelAsync(user, input));
        }

        // Refresh the login cookie so the new name is used straight away.
        await _signInManager.RefreshSignInAsync(user);

        TempData["ProfileMessage"] = "Your profile has been updated.";
        return RedirectToAction(nameof(Index));
    }

    private async Task<ProfileViewModel> BuildModelAsync(ApplicationUser user, ProfileEditModel? edit)
    {
        var roles = await _userManager.GetRolesAsync(user);

        var traces = await _db.SavedTraces
            .Where(t => t.UserId == user.Id)
            .OrderByDescending(t => t.Id)
            .Select(t => new { t.Id, t.Title, t.LessonId, t.InputSequence })
            .ToListAsync();

        var lessons = await _db.Lessons
            .Select(l => new { l.Id, l.Title })
            .ToListAsync();

        var displayName = user.DisplayName ?? "";

        // Progress saved from AIVisual and DSAVisual on any device.
        Dictionary<string, Dictionary<string, ProgressItem>>? progress = null;
        try
        {
            progress = await _progress.GetAllAsync(user.Id, HttpContext.RequestAborted);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Could not read study progress. Has Update-Database been run?");
        }

        return new ProfileViewModel
        {
            AiProgress = ProgressCatalog.Ai(progress?.GetValueOrDefault(ProgressAreas.Ai)),
            DsaProgress = ProgressCatalog.Dsa(progress?.GetValueOrDefault(ProgressAreas.Dsa)),
            ProgressLoaded = progress != null,
            DisplayName = displayName,
            Email = user.Email ?? user.UserName ?? "",
            Joined = string.Format("{0:dd MMMM yyyy}", user.JoinedAtUtc),
            Initials = UserDisplay.Initials(displayName, user.Email),
            Roles = roles,
            Traces = traces.Select(t => new TraceRow
            {
                Id = t.Id,
                Title = t.Title ?? "",
                Input = t.InputSequence ?? "",
                Lesson = lessons.FirstOrDefault(l => l.Id == t.LessonId)?.Title ?? "—"
            }).ToList(),
            Edit = edit ?? new ProfileEditModel { DisplayName = displayName }
        };
    }
}
