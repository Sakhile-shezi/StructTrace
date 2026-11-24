namespace StructTrace.Web.Services.Search;

/// <summary>One searchable item with its vector and pre-split words (for ranking and snippets).</summary>
public sealed class CatalogEntry
{
    public CatalogEntry(ContentSection section, float[] vector)
    {
        Section = section;
        Vector = vector;
        HeadingTerms = TextVectorizer.Terms(section.Heading).ToHashSet(StringComparer.Ordinal);
        PageTerms = TextVectorizer.Terms(section.PageTitle).ToHashSet(StringComparer.Ordinal);
        TextTerms = TextVectorizer.Terms(section.Text).ToHashSet(StringComparer.Ordinal);
    }

    public ContentSection Section { get; }
    public string Key => Section.Key;
    public float[] Vector { get; }
    public HashSet<string> HeadingTerms { get; }
    public HashSet<string> PageTerms { get; }
    public HashSet<string> TextTerms { get; }
}

public sealed class CatalogSnapshot
{
    public static CatalogSnapshot Empty { get; } = new(TextVectorizer.Untrained, Array.Empty<CatalogEntry>(), "empty");

    public CatalogSnapshot(TextVectorizer vectorizer, IReadOnlyList<CatalogEntry> entries, string version)
    {
        Vectorizer = vectorizer;
        Entries = entries;
        Version = version;
        ByKey = entries.GroupBy(e => e.Key, StringComparer.Ordinal)
                       .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
    }

    public TextVectorizer Vectorizer { get; }
    public IReadOnlyList<CatalogEntry> Entries { get; }
    public IReadOnlyDictionary<string, CatalogEntry> ByKey { get; }
    public string Version { get; }
}

/// <summary>
/// Holds the search index in memory (singleton). SearchIndexer fills it when the
/// site starts and copies it to the SearchDocuments table for pgvector.
/// </summary>
public sealed class SearchCatalog
{
    private readonly TaskCompletionSource _ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private volatile CatalogSnapshot _current = CatalogSnapshot.Empty;
    private volatile bool _databaseReady;

    public CatalogSnapshot Current => _current;

    /// <summary>True once the vectors are stored in PostgreSQL and pgvector can be queried.</summary>
    public bool DatabaseReady => _databaseReady;

    public Task Ready => _ready.Task;

    public void Publish(CatalogSnapshot snapshot)
    {
        _current = snapshot;
        _ready.TrySetResult();
    }

    public void SetDatabaseReady(bool ready) => _databaseReady = ready;
}
