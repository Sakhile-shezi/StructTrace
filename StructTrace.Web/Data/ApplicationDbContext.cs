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
    }
}