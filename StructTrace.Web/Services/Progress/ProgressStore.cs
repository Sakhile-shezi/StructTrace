using Microsoft.EntityFrameworkCore;
using StructTrace.Web.Data;
using StructTrace.Web.Models;

namespace StructTrace.Web.Services.Progress;

public interface IProgressStore
{
    /// <summary>All areas for one user: area → (key → item).</summary>
    Task<Dictionary<string, Dictionary<string, ProgressItem>>> GetAllAsync(string userId, CancellationToken ct = default);

    /// <summary>Merges an upload into one area and returns the area as now stored.</summary>
    Task<Dictionary<string, ProgressItem>> MergeAsync(
        string userId, string area, IReadOnlyDictionary<string, ProgressItem> incoming, CancellationToken ct = default);
}

/// <summary>Stores progress in the StudyProgress table (Neon PostgreSQL).</summary>
public sealed class EfProgressStore : IProgressStore
{
    private readonly ApplicationDbContext _db;

    public EfProgressStore(ApplicationDbContext db) => _db = db;

    public async Task<Dictionary<string, Dictionary<string, ProgressItem>>> GetAllAsync(string userId, CancellationToken ct = default)
    {
        var rows = await _db.StudyProgress
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => new { p.Area, p.DataJson })
            .ToListAsync(ct);

        var result = new Dictionary<string, Dictionary<string, ProgressItem>>(StringComparer.Ordinal);

        foreach (var area in ProgressAreas.Keys.Keys)
        {
            var row = rows.FirstOrDefault(r => r.Area == area);
            result[area] = ProgressMerge.Parse(row?.DataJson);
        }

        return result;
    }

    public async Task<Dictionary<string, ProgressItem>> MergeAsync(
        string userId, string area, IReadOnlyDictionary<string, ProgressItem> incoming, CancellationToken ct = default)
    {
        // Two tabs can save at the same moment: the row is locked while it is merged,
        // and a clash when the row is first created is retried once.
        for (var attempt = 0; ; attempt++)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(ct);

            var row = (await _db.StudyProgress
                    .FromSqlInterpolated($@"SELECT * FROM ""StudyProgress"" WHERE ""UserId"" = {userId} AND ""Area"" = {area} FOR UPDATE")
                    .ToListAsync(ct))
                .FirstOrDefault();

            var items = ProgressMerge.Parse(row?.DataJson);
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            if (!ProgressMerge.Merge(items, incoming, now))
            {
                await transaction.CommitAsync(ct);
                return items;
            }

            var json = ProgressMerge.Serialize(items);
            if (json.Length > ProgressMerge.MaxDocumentLength)
            {
                throw new InvalidOperationException("Progress for this area is too large to store.");
            }

            if (row == null)
            {
                _db.StudyProgress.Add(new StudyProgress
                {
                    UserId = userId,
                    Area = area,
                    DataJson = json,
                    UpdatedAtUtc = DateTime.UtcNow
                });
            }
            else
            {
                row.DataJson = json;
                row.UpdatedAtUtc = DateTime.UtcNow;
            }

            try
            {
                await _db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
                return items;
            }
            catch (DbUpdateException) when (row == null && attempt == 0)
            {
                // Another request created the row first: start again and merge into it.
                await transaction.RollbackAsync(ct);
                _db.ChangeTracker.Clear();
            }
        }
    }
}
