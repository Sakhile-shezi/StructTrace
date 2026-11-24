using System.ComponentModel.DataAnnotations;
using Pgvector;

namespace StructTrace.Web.Models;

/// <summary>
/// A student's saved progress for one visualizer ("ai" = AIVisual, "dsa" = DSAVisual).
/// DataJson holds the browser's progress keys and when each was last changed, so the
/// same progress appears on every device the student signs in on.
/// </summary>
public class StudyProgress
{
    [Required, MaxLength(450)]
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    [Required, MaxLength(20)]
    public string Area { get; set; } = string.Empty;

    [Required]
    public string DataJson { get; set; } = "{}";

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// One searchable section of an AIVisual or DSAVisual page. Filled automatically by
/// SearchIndexer when the site starts; Embedding is searched with pgvector.
/// </summary>
public class SearchDocument
{
    public int Id { get; set; }

    [Required, MaxLength(300)]
    public string Key { get; set; } = string.Empty;

    [Required, MaxLength(20)]
    public string Source { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string PageTitle { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string Heading { get; set; } = string.Empty;

    [Required, MaxLength(300)]
    public string Url { get; set; } = string.Empty;

    [Required]
    public string Content { get; set; } = string.Empty;

    [Required, MaxLength(80)]
    public string IndexVersion { get; set; } = string.Empty;

    public Vector? Embedding { get; set; }

    public DateTime IndexedAtUtc { get; set; } = DateTime.UtcNow;
}
