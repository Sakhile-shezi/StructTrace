using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using StructTrace.Web.Models;

namespace StructTrace.Web.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<DataStructureLesson> Lessons => Set<DataStructureLesson>();
    public DbSet<CodeSubmission> CodeSubmissions => Set<CodeSubmission>();
    public DbSet<SavedTrace> SavedTraces => Set<SavedTrace>();

    // Added for account-synced progress and site search (see INSTALL.md, step 2).
    public DbSet<StudyProgress> StudyProgress => Set<StudyProgress>();
    public DbSet<SearchDocument> SearchDocuments => Set<SearchDocument>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasPostgresExtension("vector");

        modelBuilder.Entity<DataStructureLesson>(entity =>
        {
            entity.HasIndex(l => l.Slug).IsUnique();
            entity.Property(l => l.Embedding).HasColumnType("vector(384)");
            entity.HasIndex(l => l.Embedding)
                  .HasMethod("hnsw")
                  .HasOperators("vector_cosine_ops");
        });

        modelBuilder.Entity<SavedTrace>(entity =>
        {
            entity.Property(t => t.TraceFramesJson).HasColumnType("jsonb");
        });

        modelBuilder.Entity<StudyProgress>(entity =>
        {
            entity.ToTable("StudyProgress");
            entity.HasKey(p => new { p.UserId, p.Area });
            entity.Property(p => p.DataJson).HasColumnType("jsonb");
            entity.HasOne(p => p.User)
                  .WithMany()
                  .HasForeignKey(p => p.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SearchDocument>(entity =>
        {
            entity.ToTable("SearchDocuments");
            entity.HasIndex(d => d.Key).IsUnique();
            entity.Property(d => d.Embedding).HasColumnType("vector(384)");
            entity.HasIndex(d => d.Embedding)
                  .HasMethod("hnsw")
                  .HasOperators("vector_cosine_ops");
        });
    }
}
