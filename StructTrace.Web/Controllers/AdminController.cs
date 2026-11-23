using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StructTrace.Web.Data;
using StructTrace.Web.Models;

namespace StructTrace.Web.Controllers;

[Authorize(Roles = AppRoles.Admin)]
public class AdminController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _db;

    public AdminController(UserManager<ApplicationUser> userManager, ApplicationDbContext db)
    {
        _userManager = userManager;
        _db = db;
    }

    // GET /Admin
    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var users = await LoadUserRowsAsync();

        var traceRows = await _db.SavedTraces
            .OrderByDescending(t => t.Id)
            .Take(10)
            .Select(t => new { t.Id, t.Title, t.LessonId, t.InputSequence, t.UserId })
            .ToListAsync();

        var lessons = await _db.Lessons
            .OrderBy(l => l.Id)
            .Select(l => new { l.Id, l.Slug, l.Title, l.Category })
            .ToListAsync();

        var tracesPerLesson = await _db.SavedTraces
            .GroupBy(t => t.LessonId)
            .Select(g => new { LessonId = g.Key, Count = g.Count() })
            .ToListAsync();

        var model = new AdminDashboardViewModel
        {
            UserCount = users.Count,
            AdminCount = users.Count(u => u.IsAdmin),
            StudentCount = users.Count(u => u.IsStudent),
            LockedCount = users.Count(u => u.IsLocked),
            MissingNameCount = users.Count(u => string.IsNullOrWhiteSpace(u.DisplayName)),
            TraceCount = await _db.SavedTraces.CountAsync(),
            SubmissionCount = await _db.CodeSubmissions.CountAsync(),
            LessonCount = lessons.Count,
            Users = users,
            Lessons = lessons.Select(l => new AdminLessonRow
            {
                Id = l.Id,
                Slug = l.Slug ?? "",
                Title = l.Title ?? "",
                Category = l.Category ?? "",
                TraceCount = tracesPerLesson.FirstOrDefault(x => x.LessonId == l.Id)?.Count ?? 0
            }).ToList(),
            RecentTraces = traceRows.Select(t => new TraceRow
            {
                Id = t.Id,
                Title = t.Title ?? "",
                Input = t.InputSequence ?? "",
                Lesson = lessons.FirstOrDefault(l => l.Id == t.LessonId)?.Title ?? "—",
                OwnerId = t.UserId ?? "",
                OwnerEmail = users.FirstOrDefault(u => u.Id == t.UserId)?.Email ?? "(deleted user)"
            }).ToList()
        };

        return View(model);
    }

    // GET /Admin/User/{id}
    [HttpGet("Admin/User/{id}")]
    public async Task<IActionResult> UserDetails(string id)
    {
        var users = await LoadUserRowsAsync();
        var row = users.FirstOrDefault(u => u.Id == id);
        if (row == null) return NotFound();

        var traces = await _db.SavedTraces
            .Where(t => t.UserId == id)
            .OrderByDescending(t => t.Id)
            .Select(t => new { t.Id, t.Title, t.LessonId, t.InputSequence })
            .ToListAsync();

        var lessons = await _db.Lessons.Select(l => new { l.Id, l.Title }).ToListAsync();

        return View("UserDetails", new AdminUserDetailViewModel
        {
            User = row,
            Traces = traces.Select(t => new TraceRow
            {
                Id = t.Id,
                Title = t.Title ?? "",
                Input = t.InputSequence ?? "",
                Lesson = lessons.FirstOrDefault(l => l.Id == t.LessonId)?.Title ?? "—",
                OwnerId = id,
                OwnerEmail = row.Email
            }).ToList()
        });
    }

    // POST /Admin/SetRole  (add or remove Admin / Student)
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SetRole(string userId, string role, bool add, string? returnTo)
    {
        if (!AppRoles.All.Contains(role))
        {
            return Flash("Unknown role.", isError: true, returnTo);
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return Flash("User not found.", isError: true, returnTo);

        var me = _userManager.GetUserId(User);

        if (!add && role == AppRoles.Admin && user.Id == me)
        {
            return Flash("You cannot remove your own Admin role. Ask another administrator to do it.", isError: true, returnTo);
        }

        var hasRole = await _userManager.IsInRoleAsync(user, role);
        IdentityResult result = IdentityResult.Success;

        if (add && !hasRole) result = await _userManager.AddToRoleAsync(user, role);
        if (!add && hasRole) result = await _userManager.RemoveFromRoleAsync(user, role);

        // The user's login refreshes within a minute (see SecurityStampValidatorOptions in Program.cs).
        return result.Succeeded
            ? Flash($"{user.Email}: {(add ? "added to" : "removed from")} {role}. It applies within a minute.", false, returnTo)
            : Flash(string.Join(" ", result.Errors.Select(e => e.Description)), true, returnTo);
    }

    // POST /Admin/SetLock  (block or unblock sign-in)
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SetLock(string userId, bool locked, string? returnTo)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return Flash("User not found.", isError: true, returnTo);

        if (locked && user.Id == _userManager.GetUserId(User))
        {
            return Flash("You cannot lock your own account.", isError: true, returnTo);
        }

        if (locked)
        {
            await _userManager.SetLockoutEnabledAsync(user, true);
            await _userManager.SetLockoutEndDateAsync(user, DateTimeOffset.MaxValue);
            // Changing the security stamp signs the user out everywhere.
            if (_userManager.SupportsUserSecurityStamp)
            {
                await _userManager.UpdateSecurityStampAsync(user);
            }
        }
        else
        {
            await _userManager.SetLockoutEndDateAsync(user, null);
            await _userManager.ResetAccessFailedCountAsync(user);
        }

        return Flash($"{user.Email} has been {(locked ? "locked" : "unlocked")}.", false, returnTo);
    }

    // POST /Admin/DeleteTrace
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteTrace(int id, string? returnTo)
    {
        var trace = await _db.SavedTraces.FindAsync(id);
        if (trace == null) return Flash("That saved trace no longer exists.", isError: true, returnTo);

        _db.SavedTraces.Remove(trace);
        await _db.SaveChangesAsync();

        return Flash($"Saved trace #{id} deleted.", false, returnTo);
    }

    // POST /Admin/DeleteUser
    // Deletes the account, its roles/logins (Identity) and its saved traces.
    // The admin must type the user's e-mail address to confirm.
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteUser(string userId, string? confirmEmail)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return Flash("That account no longer exists.", isError: true, null);

        var detailsUrl = $"/Admin/User/{user.Id}";

        if (user.Id == _userManager.GetUserId(User))
        {
            return Flash("You cannot delete your own account from the admin area.", isError: true, detailsUrl);
        }

        if (!string.Equals((confirmEmail ?? "").Trim(), user.Email, StringComparison.OrdinalIgnoreCase))
        {
            return Flash("The e-mail you typed does not match, so the account was NOT deleted.", isError: true, detailsUrl);
        }

        var email = user.Email;
        var traceCount = 0;

        try
        {
            // One transaction: either everything is deleted or nothing is.
            await using var transaction = await _db.Database.BeginTransactionAsync();

            var traces = await _db.SavedTraces.Where(t => t.UserId == user.Id).ToListAsync();
            traceCount = traces.Count;
            _db.SavedTraces.RemoveRange(traces);
            await _db.SaveChangesAsync();

            var result = await _userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                return Flash(string.Join(" ", result.Errors.Select(e => e.Description)), isError: true, detailsUrl);
            }

            await transaction.CommitAsync();
        }
        catch (DbUpdateException ex)
        {
            return Flash(
                "The account could not be deleted because other records still refer to it " +
                $"(for example code submissions). Nothing was changed. Details: {ex.GetBaseException().Message}",
                isError: true, detailsUrl);
        }

        return Flash($"Deleted {email} and {traceCount} saved trace(s). If they were signed in, they are signed out within a minute.", false, null);
    }

    // ---------- helpers ----------

    private async Task<List<AdminUserRow>> LoadUserRowsAsync()
    {
        var users = await _userManager.Users
            .OrderBy(u => u.JoinedAtUtc)
            .ToListAsync();

        var adminIds = (await _userManager.GetUsersInRoleAsync(AppRoles.Admin)).Select(u => u.Id).ToHashSet();
        var studentIds = (await _userManager.GetUsersInRoleAsync(AppRoles.Student)).Select(u => u.Id).ToHashSet();

        var traceCounts = await _db.SavedTraces
            .GroupBy(t => t.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToListAsync();

        var me = _userManager.GetUserId(User);
        var now = DateTimeOffset.UtcNow;

        return users.Select(u => new AdminUserRow
        {
            Id = u.Id,
            DisplayName = u.DisplayName ?? "",
            Email = u.Email ?? u.UserName ?? "",
            Joined = string.Format("{0:dd MMM yyyy}", u.JoinedAtUtc),
            IsAdmin = adminIds.Contains(u.Id),
            IsStudent = studentIds.Contains(u.Id),
            IsLocked = u.LockoutEnd.HasValue && u.LockoutEnd.Value > now,
            IsCurrentUser = u.Id == me,
            TraceCount = traceCounts.FirstOrDefault(c => c.UserId == u.Id)?.Count ?? 0
        }).ToList();
    }

    private IActionResult Flash(string message, bool isError, string? returnTo)
    {
        TempData[isError ? "AdminError" : "AdminMessage"] = message;

        return !string.IsNullOrEmpty(returnTo) && Url.IsLocalUrl(returnTo)
            ? LocalRedirect(returnTo)
            : RedirectToAction(nameof(Index));
    }
}
