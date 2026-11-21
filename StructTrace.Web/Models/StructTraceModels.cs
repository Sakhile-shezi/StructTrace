using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;
using Pgvector;

namespace StructTrace.Web.Models;

public class ApplicationUser : IdentityUser
{
    [Required, MaxLength(80)]
    public string DisplayName { get; set; } = string.Empty;

    public DateTime JoinedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<CodeSubmission> Submissions { get; set; } = [];
    public ICollection<SavedTrace> SavedTraces { get; set; } = [];
}

public class DataStructureLesson
{
    public int Id { get; set; }

    [Required, MaxLength(60)]
    public string Slug { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string Title { get; set; } = string.Empty;

    [Required, MaxLength(60)]
    public string Category { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string TimeComplexity { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string SpaceComplexity { get; set; } = string.Empty;

    [Required]
    public string ConceptNotes { get; set; } = string.Empty;

    [Required]
    public string CppTemplate { get; set; } = string.Empty;

    [Required]
    public string JavaTemplate { get; set; } = string.Empty;

    [Required]
    public string PythonTemplate { get; set; } = string.Empty;

    [Required]
    public string CSharpTemplate { get; set; } = string.Empty;

    public Vector? Embedding { get; set; }
}

public class CodeSubmission
{
    public int Id { get; set; }

    [Required]
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    public int LessonId { get; set; }
    public DataStructureLesson Lesson { get; set; } = null!;

    [Required, MaxLength(25)]
    public string Language { get; set; } = "C++";

    [Required]
    public string SourceCode { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string ExecutionNotes { get; set; } = string.Empty;

    public double ExecutionTimeMs { get; set; }
    public DateTime SubmittedAtUtc { get; set; } = DateTime.UtcNow;
}

public class SavedTrace
{
    public int Id { get; set; }

    [Required]
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    public int LessonId { get; set; }
    public DataStructureLesson Lesson { get; set; } = null!;

    [Required, MaxLength(120)]
    public string Title { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string InputSequence { get; set; } = string.Empty;

    [Required]
    public string TraceFramesJson { get; set; } = "[]";

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}