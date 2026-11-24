using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Pgvector;
using Pgvector.EntityFrameworkCore;
using StructTrace.Web.Data;

namespace StructTrace.Web.Services.Search;

public sealed record SearchHit(
    string Title,
    string Page,
    string Source,
    string Url,
    string Snippet,
    double Score);

public sealed record SearchResponse(
    string Query,
    IReadOnlyList<string> Terms,
    IReadOnlyList<SearchHit> Results,
    string Engine);

/// <summary>
/// Answers /api/search. The nearest sections are found with pgvector
/// (cosine distance on the HNSW index), then re-ranked so that sections whose
/// heading contains the searched words come first.
/// </summary>
public sealed class SiteSearchService
{
    public const int MaxQueryLength = 120;
    private const int Candidates = 40;
    private const int MaxPerPage = 3;

    private static readonly Regex Word = new("[\\p{L}\\p{N}*+#]+", RegexOptions.Compiled);

    private readonly ApplicationDbContext _db;
    private readonly SearchCatalog _catalog;
    private readonly ILogger<SiteSearchService> _logger;

    public SiteSearchService(ApplicationDbContext db, SearchCatalog catalog, ILogger<SiteSearchService> logger)
    {
        _db = db;
        _catalog = catalog;
        _logger = logger;
    }

    /// <summary>The values accepted by the optional "source" filter.</summary>
    public static readonly IReadOnlyList<string> Sources = new[]
    {
        SearchIndexer.AiSource, SearchIndexer.DsaSource, SearchIndexer.SandboxSource
    };

    public async Task<SearchResponse> SearchAsync(string? query, int limit, CancellationToken ct) =>
        await SearchAsync(query, limit, null, ct);

    /// <param name="source">AIVisual, DSAVisual or Sandbox to search only there; null or empty for everything.</param>
    public async Task<SearchResponse> SearchAsync(string? query, int limit, string? source, CancellationToken ct)
    {
        query = (query ?? "").Trim();
        if (query.Length > MaxQueryLength) query = query[..MaxQueryLength];
        limit = Math.Clamp(limit, 1, 20);
        source = Sources.FirstOrDefault(s => string.Equals(s, source?.Trim(), StringComparison.OrdinalIgnoreCase));

        var displayTerms = DisplayTerms(query);
        if (query.Length < 2) return new SearchResponse(query, displayTerms, Array.Empty<SearchHit>(), "none");

        // The index is built a moment after start-up; wait for it (briefly) on the first search.
        await Task.WhenAny(_catalog.Ready, Task.Delay(TimeSpan.FromSeconds(8), ct));

        var snapshot = _catalog.Current;
        var queryVector = snapshot.Vectorizer.Embed(query);
        if (TextVectorizer.IsZero(queryVector) || snapshot.Entries.Count == 0)
        {
            return new SearchResponse(query, displayTerms, Array.Empty<SearchHit>(), "none");
        }

        var engine = "memory";
        List<(CatalogEntry Entry, double Similarity)>? candidates = null;

        if (_catalog.DatabaseReady)
        {
            try
            {
                candidates = await FromPgvectorAsync(snapshot, queryVector, source, ct);
                engine = "pgvector";
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "pgvector search failed; searching from memory instead.");
            }
        }

        candidates ??= FromMemory(snapshot, queryVector, source);

        // Also consider every section that uses the searched words (or a near spelling),
        // so a typo or a rare word is found even when its vector is not among the nearest.
        var seen = candidates.Select(c => c.Entry.Key).ToHashSet(StringComparer.Ordinal);
        candidates.AddRange(WordMatches(snapshot, query, source)
            .Where(e => seen.Add(e.Key))
            .Select(e => (e, TextVectorizer.Cosine(e.Vector, queryVector))));

        var results = Rank(query, candidates, limit, snapshot.Vectorizer);
        return new SearchResponse(query, displayTerms, results, engine);
    }

    /// <summary>Sections that contain at least one searched word (exactly or one typo away).</summary>
    private static IEnumerable<CatalogEntry> WordMatches(CatalogSnapshot snapshot, string query, string? source)
    {
        var typed = TextVectorizer.Terms(query, expand: false).Distinct(StringComparer.Ordinal).ToList();
        if (typed.Count == 0) return Enumerable.Empty<CatalogEntry>();

        var fuzzy = FuzzyTerms(typed, snapshot.Vectorizer);

        return snapshot.Entries
            .Where(e => source == null || e.Section.Source == source)
            .Where(e => typed.Any(t => Has(e.HeadingTerms, t, fuzzy) || Has(e.PageTerms, t, fuzzy) || Has(e.TextTerms, t, fuzzy)))
            .Take(80);
    }

    private async Task<List<(CatalogEntry, double)>> FromPgvectorAsync(
        CatalogSnapshot snapshot, float[] queryVector, string? source, CancellationToken ct)
    {
        var vector = new Vector(queryVector);
        var found = new List<(CatalogEntry, double)>();

        // Nearest page sections (SearchDocuments) and nearest Code Sandbox lessons (Lessons.Embedding),
        // both ordered by cosine distance on their HNSW indexes.
        var sections = source == SearchIndexer.SandboxSource
            ? new()
            : await _db.SearchDocuments.AsNoTracking()
                .Where(d => d.Embedding != null && (source == null || d.Source == source))
                .OrderBy(d => d.Embedding!.CosineDistance(vector))
                .Select(d => new { d.Key, Distance = d.Embedding!.CosineDistance(vector) })
                .Take(Candidates)
                .ToListAsync(ct);

        var lessons = source != null && source != SearchIndexer.SandboxSource
            ? new()
            : await _db.Lessons.AsNoTracking()
                .Where(l => l.Embedding != null)
                .OrderBy(l => l.Embedding!.CosineDistance(vector))
                .Select(l => new { l.Slug, Distance = l.Embedding!.CosineDistance(vector) })
                .Take(6)
                .ToListAsync(ct);

        foreach (var hit in sections)
        {
            if (snapshot.ByKey.TryGetValue(hit.Key, out var entry)) found.Add((entry, 1.0 - hit.Distance));
        }

        foreach (var hit in lessons)
        {
            if (snapshot.ByKey.TryGetValue(SearchIndexer.LessonKey(hit.Slug), out var entry)) found.Add((entry, 1.0 - hit.Distance));
        }

        return found;
    }

    private static List<(CatalogEntry, double)> FromMemory(CatalogSnapshot snapshot, float[] queryVector, string? source) =>
        snapshot.Entries
            .Where(e => source == null || e.Section.Source == source)
            .Select(e => (e, TextVectorizer.Cosine(e.Vector, queryVector)))
            .OrderByDescending(p => p.Item2)
            .Take(Candidates + 6)
            .ToList();

    /// <summary>
    /// Re-ranks the candidate sections and builds their snippets (unit-tested).
    /// A section is kept only when it contains most of the searched words, weighted by
    /// how rare each word is (so "linear probing" needs "probing", not just "linear").
    /// Words that appear nowhere on the site are ignored; if all are, nothing is returned.
    /// </summary>
    public static List<SearchHit> Rank(
        string query,
        IEnumerable<(CatalogEntry Entry, double Similarity)> candidates,
        int limit,
        TextVectorizer? vectorizer = null)
    {
        vectorizer ??= TextVectorizer.Untrained;

        var queryTerms = TextVectorizer.Terms(query).Distinct(StringComparer.Ordinal).ToList();
        if (queryTerms.Count == 0) return new List<SearchHit>();

        // The words as typed (without abbreviation expansions) that exist somewhere on the site.
        var typedTerms = TextVectorizer.Terms(query, expand: false)
            .Distinct(StringComparer.Ordinal)
            .Where(t => vectorizer.VocabularySize == 0 || vectorizer.IsKnown(t))
            .ToList();
        if (typedTerms.Count == 0) return new List<SearchHit>();

        var weights = typedTerms.ToDictionary(t => t, vectorizer.Idf, StringComparer.Ordinal);
        var fuzzy = FuzzyTerms(queryTerms, vectorizer);
        var totalWeight = weights.Values.Sum();
        var needed = typedTerms.Count == 1 ? 0.999 : 0.6;

        var scored = new List<(CatalogEntry Entry, double Score)>();

        foreach (var (entry, similarity) in candidates)
        {
            double Coverage(HashSet<string> terms) => queryTerms.Count(t => Has(terms, t, fuzzy)) / (double)queryTerms.Count;

            var inHeading = Coverage(entry.HeadingTerms);
            var inPage = Coverage(entry.PageTerms);
            var inText = Coverage(entry.TextTerms);

            var matched = typedTerms
                .Where(t => Has(entry.HeadingTerms, t, fuzzy) || Has(entry.PageTerms, t, fuzzy) || Has(entry.TextTerms, t, fuzzy))
                .Sum(t => weights[t]);

            var relevant = matched / totalWeight >= needed ||
                           (similarity >= 0.5 && Math.Max(inHeading, inText) >= 0.5);
            if (!relevant) continue;

            // A heading made mostly of the searched words ("Alpha-Beta Pruning" for "alpha beta")
            // beats a longer one that merely mentions them.
            var headingPrecision = entry.HeadingTerms.Count == 0
                ? 0
                : entry.HeadingTerms.Count(h => queryTerms.Contains(h)) / (double)entry.HeadingTerms.Count;

            var score = similarity + 0.45 * inHeading + 0.15 * inPage + 0.30 * inText + 0.25 * inHeading * headingPrecision;
            var isWholePage = !entry.Key.Contains('#') && !entry.Key.StartsWith("lesson:", StringComparison.Ordinal);
            if (isWholePage)
            {
                // Whole-page entries win only when the page title itself matches.
                score += inPage >= 0.99 ? 0.1 : -0.1;
            }

            scored.Add((entry, score));
        }

        var perPage = new Dictionary<string, int>(StringComparer.Ordinal);
        var results = new List<SearchHit>();

        foreach (var (entry, score) in scored.OrderByDescending(s => s.Score))
        {
            // At most MaxPerPage sections of one page (its overview entry does not count).
            var isOverview = !entry.Key.Contains('#') && !entry.Key.StartsWith("lesson:", StringComparison.Ordinal);
            if (!isOverview)
            {
                var page = entry.Section.Source + "|" + entry.Section.PageTitle;
                perPage[page] = perPage.TryGetValue(page, out var n) ? n + 1 : 1;
                if (perPage[page] > MaxPerPage) continue;
            }

            results.Add(new SearchHit(
                Title: entry.Section.Heading,
                Page: entry.Section.PageTitle,
                Source: entry.Section.Source,
                Url: entry.Section.Url,
                Snippet: Snippet(entry.Section.Text, query, queryTerms, entry.Section.Heading, fuzzy),
                Score: Math.Round(score, 3)));

            if (results.Count >= limit) break;
        }

        return results;
    }

    /// <summary>
    /// The searched words that do not appear anywhere on the site: probably typing mistakes,
    /// so they also match words one letter away ("dijsktra" → "dijkstra"). Real words
    /// ("genetic") only match themselves, never a neighbour ("generic").
    /// </summary>
    private static HashSet<string> FuzzyTerms(IEnumerable<string> terms, TextVectorizer vectorizer) =>
        terms.Where(t => t.Length >= 5 && (vectorizer.VocabularySize == 0 || !vectorizer.HasWord(t)))
             .ToHashSet(StringComparer.Ordinal);

    /// <summary>True when the set has the word, or (for a probable typo) a word one mistake away.</summary>
    private static bool Has(HashSet<string> terms, string term, IReadOnlySet<string>? fuzzy) =>
        terms.Contains(term) ||
        (fuzzy != null && fuzzy.Contains(term) && terms.Any(t => TextVectorizer.NearlySame(t, term)));

    /// <summary>The line of the section that contains most of the searched words, shortened.</summary>
    public static string Snippet(
        string text, string query, IReadOnlyCollection<string> queryTerms,
        string? heading = null, IReadOnlySet<string>? fuzzy = null, int maxLength = 180)
    {
        var lines = text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        // The heading is already shown as the result's title: prefer the lines under it.
        if (!string.IsNullOrEmpty(heading))
        {
            var body = lines.Where(l => !string.Equals(l, heading, StringComparison.OrdinalIgnoreCase) &&
                                        !heading.Contains(l, StringComparison.OrdinalIgnoreCase)).ToArray();
            if (body.Length > 0) lines = body;
        }

        if (lines.Length == 0) return "";

        var bestIndex = Math.Max(0, Array.FindIndex(lines, l => l.Length >= 40));
        var bestHits = 0;

        for (var i = 0; i < lines.Length; i++)
        {
            if (lines[i].Length < 12) continue;
            var terms = TextVectorizer.Terms(lines[i]).ToHashSet(StringComparer.Ordinal);
            var hits = queryTerms.Count(t => Has(terms, t, fuzzy));
            if (hits > bestHits)
            {
                bestIndex = i;
                bestHits = hits;
            }
        }

        // Pages often break one sentence over several lines: continue a short line with the next ones.
        var best = lines[bestIndex];
        for (var next = bestIndex + 1; best.Length < 110 && next < lines.Length; next++)
        {
            best += " " + lines[next];
        }

        if (best.Length <= maxLength) return best;

        // Centre the excerpt on the first searched word that appears in the line.
        var start = 0;
        foreach (var word in DisplayTerms(query))
        {
            var at = best.IndexOf(word, StringComparison.OrdinalIgnoreCase);
            if (at >= 0)
            {
                start = Math.Max(0, at - maxLength / 3);
                break;
            }
        }

        if (start + maxLength > best.Length) start = Math.Max(0, best.Length - maxLength);
        var excerpt = best.Substring(start, Math.Min(maxLength, best.Length - start)).Trim();
        return (start > 0 ? "…" : "") + excerpt + (start + maxLength < best.Length ? "…" : "");
    }

    /// <summary>The words of the query as typed (for highlighting in the browser).</summary>
    public static IReadOnlyList<string> DisplayTerms(string query) =>
        Word.Matches(query)
            .Select(m => m.Value)
            .Where(w => w.Length >= 2 || w == "*")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(8)
            .ToList();
}
