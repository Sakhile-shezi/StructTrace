using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Pgvector;
using StructTrace.Web.Data;
using StructTrace.Web.Models;

namespace StructTrace.Web.Services.Search;

/// <summary>
/// Builds the site search index when the app starts:
///   1. reads every AIVisual topic page and DSAVisual topic page in wwwroot,
///   2. adds the Code Sandbox lessons from the Lessons table,
///   3. turns each section into a 384-number vector (TextVectorizer),
///   4. stores the vectors in SearchDocuments and Lessons.Embedding for pgvector.
/// Nothing is rewritten when the pages have not changed since the last start.
/// If the database is unavailable, search still works from memory.
/// </summary>
public sealed class SearchIndexer : BackgroundService
{
    public const string AiSource = "AIVisual";
    public const string DsaSource = "DSAVisual";
    public const string SandboxSource = "Sandbox";

    private readonly IServiceScopeFactory _scopes;
    private readonly IWebHostEnvironment _environment;
    private readonly SearchCatalog _catalog;
    private readonly ILogger<SearchIndexer> _logger;

    public SearchIndexer(
        IServiceScopeFactory scopes,
        IWebHostEnvironment environment,
        SearchCatalog catalog,
        ILogger<SearchIndexer> logger)
    {
        _scopes = scopes;
        _environment = environment;
        _catalog = catalog;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let the site finish starting first; the first search waits for this if needed.
        try { await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken); }
        catch (OperationCanceledException) { return; }

        CatalogSnapshot? snapshot = null;

        try
        {
            var sections = ReadSitePages(_environment.WebRootPath);
            var lessons = await LoadLessonsAsync(stoppingToken);
            sections.AddRange(lessons.Select(LessonSection));

            snapshot = Build(sections);
            _catalog.Publish(snapshot);

            _logger.LogInformation(
                "Site search: {Count} sections indexed ({Vocabulary} distinct words).",
                snapshot.Entries.Count, snapshot.Vectorizer.VocabularySize);

            await StoreAsync(snapshot, stoppingToken);
            _catalog.SetDatabaseReady(true);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // shutting down
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Site search could not store its vectors in PostgreSQL, so it is searching from memory. " +
                "If the SearchDocuments table is missing, run Add-Migration AddSearchAndProgress and Update-Database.");
        }
        finally
        {
            if (snapshot == null) _catalog.Publish(CatalogSnapshot.Empty);
        }
    }

    /// <summary>All AIVisual and DSAVisual topic pages, split into sections.</summary>
    public static List<ContentSection> ReadSitePages(string webRoot)
    {
        var sections = new List<ContentSection>();
        if (string.IsNullOrEmpty(webRoot) || !Directory.Exists(webRoot)) return sections;

        void AddPages(string folder, string pattern, string source)
        {
            var directory = Path.Combine(webRoot, folder);
            if (!Directory.Exists(directory)) return;

            foreach (var file in Directory.EnumerateFiles(directory, "index.html", SearchOption.AllDirectories)
                                          .Where(f => Path.GetFileName(Path.GetDirectoryName(f)!)
                                                          .StartsWith(pattern, StringComparison.OrdinalIgnoreCase))
                                          .OrderBy(f => f, StringComparer.Ordinal))
            {
                var relative = Path.GetRelativePath(webRoot, file).Replace('\\', '/');
                sections.AddRange(SiteContentExtractor.ExtractPage(File.ReadAllText(file), source, "/" + relative));
            }
        }

        AddPages("ai-visualizer", "topic-", AiSource);
        AddPages("dsa-visualizer", "topic-", DsaSource);
        return sections;
    }

    public static ContentSection LessonSection(DataStructureLesson lesson)
    {
        var text = $"{lesson.Category}\n{lesson.ConceptNotes}\nTime complexity: {lesson.TimeComplexity}\n" +
                   $"Space complexity: {lesson.SpaceComplexity}\nTemplates in C++, Java, Python and C#; " +
                   "the Python version runs in your browser.";

        var topic = SandboxTopicFor(lesson.Slug, lesson.Title);
        var url = topic == null
            ? "/Sandbox?slug=" + Uri.EscapeDataString(lesson.Slug)
            : "/Sandbox?slug=" + Uri.EscapeDataString(lesson.Slug) + "&topic=" + topic;

        return new ContentSection(
            Key: LessonKey(lesson.Slug),
            Source: SandboxSource,
            PageTitle: "Code Sandbox",
            Heading: lesson.Title,
            Url: url,
            Text: text);
    }

    /// <summary>
    /// The Code Sandbox tab (data-topic) that matches a lesson, e.g. "graph-bfs" → "BFS",
    /// so a search result opens the Sandbox on the right structure.
    /// </summary>
    public static string? SandboxTopicFor(string? slug, string? title)
    {
        var text = ((slug ?? "") + " " + (title ?? "")).ToLowerInvariant();

        if (text.Contains("dijkstra")) return "Dijkstra";
        if (text.Contains("bfs") || text.Contains("breadth")) return "BFS";
        if (text.Contains("dfs") || text.Contains("depth-first") || text.Contains("depth first")) return "DFS";
        if (text.Contains("doubly")) return "DoublyLinkedList";
        if (text.Contains("linked")) return "LinkedList";
        if (text.Contains("heap")) return "MinHeap";
        if (text.Contains("stack")) return "Stack";
        if (text.Contains("queue")) return "Queue";
        if (text.Contains("hash")) return "HashTable";
        if (text.Contains("bst") || text.Contains("binary-search-tree") || text.Contains("binary search tree")) return "BST";
        return null;
    }

    public static string LessonKey(string slug) => "lesson:" + slug;

    /// <summary>Trains the vectorizer on every section and embeds each one.</summary>
    public static CatalogSnapshot Build(IReadOnlyList<ContentSection> sections)
    {
        var vectorizer = TextVectorizer.Train(sections.Select(s => s.PageTitle + "\n" + s.Heading + "\n" + s.Text));

        var entries = sections
            .Select(s => new CatalogEntry(s, vectorizer.Embed(new[]
            {
                (s.Heading, 3.0),
                (s.PageTitle, 1.2),
                (s.Text, 1.0)
            })))
            .ToList();

        return new CatalogSnapshot(vectorizer, entries, VersionOf(sections));
    }

    /// <summary>Changes whenever any page text or the vectorizer changes.</summary>
    public static string VersionOf(IEnumerable<ContentSection> sections)
    {
        using var sha = SHA256.Create();
        var builder = new StringBuilder();
        foreach (var s in sections.OrderBy(s => s.Key, StringComparer.Ordinal))
        {
            builder.Append(s.Key).Append('\u001f').Append(s.Heading).Append('\u001f')
                   .Append(s.PageTitle).Append('\u001f').Append(s.Text).Append('\u001e');
        }

        var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(builder.ToString()));
        return TextVectorizer.Version + "-" + Convert.ToHexString(hash, 0, 8).ToLowerInvariant();
    }

    private async Task<List<DataStructureLesson>> LoadLessonsAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            return await db.Lessons.AsNoTracking().OrderBy(l => l.Id).ToListAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Site search could not read the Lessons table; Code Sandbox lessons are left out.");
            return new List<DataStructureLesson>();
        }
    }

    private async Task StoreAsync(CatalogSnapshot snapshot, CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var pageEntries = snapshot.Entries.Where(e => e.Section.Source != SandboxSource).ToList();
        var stored = await db.SearchDocuments.AsNoTracking()
            .Select(d => new { d.Key, d.IndexVersion })
            .ToListAsync(ct);

        var upToDate = stored.Count == pageEntries.Count &&
                       stored.All(d => d.IndexVersion == snapshot.Version) &&
                       stored.Select(d => d.Key).ToHashSet(StringComparer.Ordinal)
                             .SetEquals(pageEntries.Select(e => e.Key));

        var lessons = await db.Lessons.OrderBy(l => l.Id).ToListAsync(ct);
        var lessonsNeedVectors = !upToDate || lessons.Any(l => l.Embedding == null);

        if (upToDate && !lessonsNeedVectors)
        {
            _logger.LogInformation("Site search: stored vectors are up to date ({Version}).", snapshot.Version);
            return;
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        if (!upToDate)
        {
            await db.SearchDocuments.ExecuteDeleteAsync(ct);

            var now = DateTime.UtcNow;
            db.SearchDocuments.AddRange(pageEntries.Select(e => new SearchDocument
            {
                Key = e.Key,
                Source = e.Section.Source,
                PageTitle = e.Section.PageTitle,
                Heading = e.Section.Heading,
                Url = e.Section.Url,
                Content = e.Section.Text,
                IndexVersion = snapshot.Version,
                Embedding = new Vector(e.Vector),
                IndexedAtUtc = now
            }));
        }

        foreach (var lesson in lessons)
        {
            if (snapshot.ByKey.TryGetValue(LessonKey(lesson.Slug), out var entry))
            {
                lesson.Embedding = new Vector(entry.Vector);
            }
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        _logger.LogInformation(
            "Site search: stored {Pages} page sections and {Lessons} lesson vectors in PostgreSQL ({Version}).",
            pageEntries.Count, lessons.Count, snapshot.Version);
    }
}
