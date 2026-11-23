using System.ComponentModel.DataAnnotations;

namespace StructTrace.Web.Models;

// ==========================================
// PROFILE
// ==========================================

public class ProfileViewModel
{
    public string DisplayName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Joined { get; set; } = "";
    public string Initials { get; set; } = "?";
    public IList<string> Roles { get; set; } = new List<string>();
    public List<TraceRow> Traces { get; set; } = new();

    public bool HasDisplayName => !string.IsNullOrWhiteSpace(DisplayName);

    public ProfileEditModel Edit { get; set; } = new();
}

public class ProfileEditModel
{
    [Required(ErrorMessage = "Please enter your full name.")]
    [StringLength(80, MinimumLength = 2, ErrorMessage = "Your name must be 2–80 characters.")]
    [Display(Name = "Full name")]
    public string DisplayName { get; set; } = "";
}

// ==========================================
// SHARED ROWS
// ==========================================

public class TraceRow
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Lesson { get; set; } = "";
    public string Input { get; set; } = "";
    public string OwnerEmail { get; set; } = "";
    public string OwnerId { get; set; } = "";
}

// ==========================================
// ADMINISTRATOR
// ==========================================

public class AdminUserRow
{
    public string Id { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Joined { get; set; } = "";
    public bool IsAdmin { get; set; }
    public bool IsStudent { get; set; }
    public bool IsLocked { get; set; }
    public bool IsCurrentUser { get; set; }
    public int TraceCount { get; set; }
}

public class AdminLessonRow
{
    public int Id { get; set; }
    public string Slug { get; set; } = "";
    public string Title { get; set; } = "";
    public string Category { get; set; } = "";
    public int TraceCount { get; set; }
}

public class AdminDashboardViewModel
{
    public int UserCount { get; set; }
    public int AdminCount { get; set; }
    public int StudentCount { get; set; }
    public int LockedCount { get; set; }
    public int MissingNameCount { get; set; }
    public int TraceCount { get; set; }
    public int SubmissionCount { get; set; }
    public int LessonCount { get; set; }

    public List<AdminUserRow> Users { get; set; } = new();
    public List<AdminLessonRow> Lessons { get; set; } = new();
    public List<TraceRow> RecentTraces { get; set; } = new();
}

public class AdminUserDetailViewModel
{
    public AdminUserRow User { get; set; } = new();
    public List<TraceRow> Traces { get; set; } = new();
}

// ==========================================
// DISPLAY HELPERS (navbar, profile, admin)
// ==========================================

/// <summary>Small helpers shared by the profile, admin and navbar.</summary>
public static class UserDisplay
{
    public static string Initials(string? displayName, string? email)
    {
        var source = string.IsNullOrWhiteSpace(displayName) ? (email ?? "?") : displayName;
        var parts = source.Split(new[] { ' ', '.', '_', '-', '@' }, StringSplitOptions.RemoveEmptyEntries);

        if (parts.Length == 0) return "?";
        if (!string.IsNullOrWhiteSpace(displayName) && parts.Length > 1)
        {
            return $"{char.ToUpperInvariant(parts[0][0])}{char.ToUpperInvariant(parts[^1][0])}";
        }

        return char.ToUpperInvariant(parts[0][0]).ToString();
    }

    public static string Name(string? displayName, string? email)
    {
        if (!string.IsNullOrWhiteSpace(displayName)) return displayName.Trim();
        var at = (email ?? "").IndexOf('@');
        return at > 0 ? email![..at] : (email ?? "Account");
    }
}
