using System;
using System.ComponentModel.DataAnnotations;

namespace StructTrace.Web.Models
{
    /// <summary>
    /// A signed-in user's personal note on one AIVisual exam problem.
    /// One row per (user, problem); the page autosaves into it.
    /// </summary>
    public class AiNote
    {
        public int Id { get; set; }
        public ApplicationUser? User { get; set; }
        /// <summary>Identity user id (AspNetUsers.Id).</summary>
        [Required, MaxLength(450)]
        public string UserId { get; set; } = string.Empty;

        /// <summary>Problem id from ai-notes.js, e.g. "e24-q2".</summary>
        [Required, MaxLength(64)]
        public string ProblemId { get; set; } = string.Empty;

        [MaxLength(20000)]
        public string Content { get; set; } = string.Empty;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
