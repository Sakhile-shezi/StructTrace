using StructTrace.Web.Services.Search;

namespace StructTrace.Tests;

/// <summary>
/// Search over the real AIVisual and DSAVisual pages in StructTrace.Web/wwwroot.
/// These catch a page that stops being indexed, or a change that makes search worse.
/// </summary>
public class SiteContentTests
{
    private static readonly Lazy<(List<ContentSection> Sections, CatalogSnapshot Snapshot)> Site = new(() =>
    {
        var sections = SearchIndexer.ReadSitePages(FindWebRoot());
        return (sections, SearchIndexer.Build(sections));
    });

    private static string FindWebRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir != null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "StructTrace.Web", "wwwroot");
            if (Directory.Exists(Path.Combine(candidate, "ai-visualizer"))) return candidate;
        }

        throw new DirectoryNotFoundException("StructTrace.Web/wwwroot was not found next to StructTrace.Tests.");
    }

    private static List<SearchHit> Search(string query)
    {
        var snapshot = Site.Value.Snapshot;
        var vector = snapshot.Vectorizer.Embed(query);
        var candidates = snapshot.Entries
            .Select(e => (e, TextVectorizer.Cosine(e.Vector, vector)))
            .OrderByDescending(c => c.Item2)
            .ToList();
        return SiteSearchService.Rank(query, candidates, 5, snapshot.Vectorizer);
    }

    [Fact]
    public void Every_topic_page_is_indexed()
    {
        var pages = Site.Value.Sections.Where(s => !s.Key.Contains('#')).Select(s => s.Url).ToList();

        Assert.Equal(10, pages.Count(u => u.StartsWith("/ai-visualizer/modules/topic-", StringComparison.Ordinal)));
        Assert.Equal(9, pages.Count(u => u.StartsWith("/dsa-visualizer/topic-", StringComparison.Ordinal)));
        Assert.True(Site.Value.Sections.Count > 150, $"only {Site.Value.Sections.Count} sections were found");
    }

    [Fact]
    public void Topics_are_called_topics_not_modules()
    {
        var headings = Site.Value.Sections.Select(s => s.Heading + " " + s.PageTitle);
        Assert.DoesNotContain(headings, h => h.Contains("Module", StringComparison.Ordinal));
        Assert.DoesNotContain(Site.Value.Sections, s => s.Url.Contains("/dsa-visualizer/module-", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("alpha-beta pruning", "Game Trees")]
    [InlineData("A* search", "Heuristic Search")]
    [InlineData("admissible heuristic", "Heuristic Search")]
    [InlineData("crossover mutation", "Genetic Algorithms")]
    [InlineData("perceptron", "Perceptron")]
    [InlineData("resolution proof", "Logic")]
    [InlineData("forward checking", "Constraint Satisfaction")]
    [InlineData("dijkstra", "Dijkstra")]
    [InlineData("AVL rotation", "AVL")]
    [InlineData("hash collision", "Hash")]
    [InlineData("big o", "Big-O")]
    [InlineData("dijsktra", "Dijkstra")]          // typo
    [InlineData("uniform cost", "Uninformed Search")]
    public void Golden_queries_find_the_right_topic(string query, string expectedPage)
    {
        var hits = Search(query);
        Assert.NotEmpty(hits);
        Assert.Contains(expectedPage, hits[0].Page, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Nonsense_finds_nothing()
    {
        Assert.Empty(Search("qwzx florp"));
    }

    [Fact]
    public void Every_result_links_to_a_section_that_exists()
    {
        var root = FindWebRoot();
        foreach (var hit in Search("search").Concat(Search("tree")).Concat(Search("queue")))
        {
            var path = hit.Url.Split('#')[0].TrimStart('/');
            Assert.True(File.Exists(Path.Combine(root, path)), hit.Url);

            if (hit.Url.Contains('#'))
            {
                var id = Uri.UnescapeDataString(hit.Url.Split('#')[1]);
                Assert.Contains($"id=\"{id}\"", File.ReadAllText(Path.Combine(root, path)));
            }
        }
    }
}
