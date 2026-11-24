using StructTrace.Web.Endpoints;
using StructTrace.Web.Models;
using StructTrace.Web.Services.Search;

namespace StructTrace.Tests;

/// <summary>The keyword vectors stored in pgvector.</summary>
public class TextVectorizerTests
{
    [Theory]
    [InlineData("queues", "queue")]
    [InlineData("sorting", "sort")]
    [InlineData("mapped", "map")]
    [InlineData("heuristics", "heuristic")]
    [InlineData("searches", "search")]
    [InlineData("queries", "query")]
    [InlineData("class", "class")]
    [InlineData("bfs", "bfs")]
    public void Stem(string word, string expected) => Assert.Equal(expected, TextVectorizer.Stem(word));

    [Fact]
    public void Abbreviations_are_expanded()
    {
        var terms = TextVectorizer.Terms("BFS and A* search");
        Assert.Contains("bfs", terms);
        Assert.Contains("breadth", terms);
        Assert.Contains("astar", terms);
        Assert.DoesNotContain("and", terms);   // stop word
    }

    [Fact]
    public void Expansion_can_be_switched_off()
    {
        Assert.Equal(new[] { "bfs" }, TextVectorizer.Terms("BFS", expand: false));
    }

    [Theory]
    [InlineData("dijkstra", "dijsktra", true)]    // two letters swapped
    [InlineData("perceptron", "perceptorn", true)]
    [InlineData("rotation", "rotaton", true)]      // one letter missing
    [InlineData("pruning", "prunning", true)]      // one letter extra
    [InlineData("genetic", "genetik", true)]       // one letter changed
    [InlineData("genetic", "generic", true)]
    [InlineData("stack", "queue", false)]
    [InlineData("tree", "trie", false)]           // too short to guess
    [InlineData("heuristic", "heuristics", true)]
    [InlineData("heuristic", "heuristical", false)]
    public void NearlySame(string a, string b, bool expected)
    {
        Assert.Equal(expected, TextVectorizer.NearlySame(a, b));
        Assert.Equal(expected, TextVectorizer.NearlySame(b, a));
    }

    [Fact]
    public void Vectors_have_384_numbers_and_unit_length()
    {
        var vector = TextVectorizer.Untrained.Embed("Binary search tree insertion");
        Assert.Equal(TextVectorizer.Dimensions, vector.Length);
        Assert.InRange(Math.Sqrt(vector.Sum(v => (double)v * v)), 0.999, 1.001);
    }

    [Fact]
    public void Vectors_are_the_same_every_time()
    {
        // pgvector stores them, so they must not depend on the process (string.GetHashCode would).
        var a = TextVectorizer.Untrained.Embed("alpha-beta pruning");
        var b = TextVectorizer.Train(new[] { "unrelated text" }).Embed("x");
        var c = TextVectorizer.Untrained.Embed("alpha-beta pruning");
        Assert.Equal(a, c);
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void Similar_text_is_closer_than_unrelated_text()
    {
        var v = TextVectorizer.Train(new[] { "minimax alpha beta pruning game tree", "hash table collision buckets", "stack push pop" });
        var query = v.Embed("alpha-beta pruning");

        Assert.True(TextVectorizer.Cosine(query, v.Embed("Game trees: minimax with alpha-beta pruning")) >
                    TextVectorizer.Cosine(query, v.Embed("Hash table collisions and buckets")));
    }

    [Fact]
    public void Empty_text_gives_a_zero_vector()
    {
        Assert.True(TextVectorizer.IsZero(TextVectorizer.Untrained.Embed("the and of")));
    }
}

/// <summary>Splitting AIVisual / DSAVisual pages into searchable sections.</summary>
public class SiteContentExtractorTests
{
    private const string Page = """
        <html><head><title>Game Trees | AIVisual</title><script>var secret = "do not index";</script></head>
        <body>
          <section class="topic-hero"><h1>Game Trees</h1><p>Minimax and alpha-beta pruning for two-player games.</p></section>
          <section id="minimax"><h2>Minimax</h2><p>MAX picks the largest value and MIN the smallest, level by level.</p>
            <svg><text>drawing labels are not indexed</text></svg><button>Run to the end</button></section>
          <section id="tiny"><h2>Tiny</h2></section>
          <section><h2>No id</h2><p>Sections without an id cannot be linked to, so they are skipped.</p></section>
        </body></html>
        """;

    [Fact]
    public void Each_linkable_section_becomes_a_result_plus_one_for_the_page()
    {
        var sections = SiteContentExtractor.ExtractPage(Page, "AIVisual", "/ai-visualizer/modules/topic-05-game-trees/index.html");

        Assert.Equal(2, sections.Count);
        Assert.Equal("Game Trees", sections[0].Heading);
        Assert.Equal("/ai-visualizer/modules/topic-05-game-trees/index.html", sections[0].Url);
        Assert.Contains("Minimax and alpha-beta pruning", sections[0].Text);
        Assert.Contains("In this topic: Minimax", sections[0].Text);

        Assert.Equal("Minimax", sections[1].Heading);
        Assert.Equal("/ai-visualizer/modules/topic-05-game-trees/index.html#minimax", sections[1].Url);
    }

    [Fact]
    public void Scripts_drawings_and_buttons_are_not_indexed()
    {
        var text = string.Join("\n", SiteContentExtractor.ExtractPage(Page, "AIVisual", "/p").Select(s => s.Text));
        Assert.DoesNotContain("do not index", text);
        Assert.DoesNotContain("drawing labels", text);
        Assert.DoesNotContain("Run to the end", text);
    }

    [Fact]
    public void PlainText_decodes_entities_and_keeps_one_line_per_block()
    {
        Assert.Equal("A &amp; B\nC < D", SiteContentExtractor.PlainText("<p>A &amp;amp; B</p><p>C &lt; D</p>"));
    }

    [Theory]
    [InlineData("short", 10, "short")]
    [InlineData("a longer sentence", 8, "a longe…")]
    public void Truncate(string text, int max, string expected) =>
        Assert.Equal(expected, SiteContentExtractor.Truncate(text, max));
}

/// <summary>Ranking of /api/search results (the same code runs after the pgvector query).</summary>
public class SearchRankingTests
{
    private static readonly ContentSection[] Sections =
    {
        new("p1#ab", "AIVisual", "Game Trees", "Alpha-Beta Pruning", "/ai/5#ab", "Alpha-beta pruning skips branches that cannot change the minimax decision."),
        new("p1#mm", "AIVisual", "Game Trees", "Minimax", "/ai/5#mm", "MAX chooses the largest value and MIN the smallest."),
        new("p2#lp", "DSAVisual", "Hashing", "Open Addressing", "/dsa/7#lp", "Linear probing tries the next bucket until an empty one is found."),
        new("p3#csp", "AIVisual", "Constraint Satisfaction", "Linear Constraints", "/ai/10#lin", "A linear constraint links variables with a sum."),
        new("p4#dj", "DSAVisual", "Shortest Paths", "Dijkstra's Algorithm", "/dsa/9#dj", "Dijkstra settles the closest vertex first using a priority queue."),
        new("lesson:stack-lifo", "Sandbox", "Code Sandbox", "Stack (LIFO)", "/Sandbox?topic=Stack", "Push and pop work on the top only.")
    };

    private static List<SearchHit> Search(string query, string? source = null)
    {
        var snapshot = SearchIndexer.Build(Sections);
        var vector = snapshot.Vectorizer.Embed(query);
        var candidates = snapshot.Entries
            .Where(e => source == null || e.Section.Source == source)
            .Select(e => (e, TextVectorizer.Cosine(e.Vector, vector)));
        return SiteSearchService.Rank(query, candidates, 5, snapshot.Vectorizer);
    }

    [Fact]
    public void Best_match_comes_first()
    {
        Assert.Equal("Alpha-Beta Pruning", Search("alpha-beta pruning")[0].Title);
        Assert.Equal("Dijkstra's Algorithm", Search("dijkstra")[0].Title);
    }

    [Fact]
    public void A_typo_still_finds_the_topic()
    {
        Assert.Equal("Dijkstra's Algorithm", Search("dijsktra")[0].Title);
        Assert.Equal("Alpha-Beta Pruning", Search("alpha beta prunning")[0].Title);
    }

    [Fact]
    public void Common_words_alone_do_not_match()
    {
        // "linear" is in two sections, but only one is about linear probing.
        var hits = Search("linear probing");
        Assert.Single(hits);
        Assert.Equal("Open Addressing", hits[0].Title);
    }

    [Fact]
    public void Words_that_are_nowhere_on_the_site_give_no_results()
    {
        Assert.Empty(Search("k-means clustering"));
        Assert.Empty(Search("zzzz"));
    }

    [Fact]
    public void The_snippet_shows_the_matching_text_not_the_title_again()
    {
        var hit = Search("priority queue")[0];
        Assert.Contains("priority queue", hit.Snippet);
        Assert.NotEqual(hit.Title, hit.Snippet);
    }

    [Fact]
    public void Display_terms_are_the_words_as_typed()
    {
        Assert.Equal(new[] { "A*", "search" }, SiteSearchService.DisplayTerms("A* search"));
    }

    [Theory]
    [InlineData("graph-bfs", "Graph Breadth-First Search (BFS)", "BFS")]
    [InlineData("stack-lifo", "Stack (LIFO)", "Stack")]
    [InlineData("binary-search-tree", "Binary Search Tree (BST)", "BST")]
    [InlineData("priority-queue", "Priority Queue (Min-Heap)", "MinHeap")]
    [InlineData("doubly-linked-list", "Doubly Linked List", "DoublyLinkedList")]
    [InlineData("something-else", "Tries", null)]
    public void Lessons_open_the_matching_Sandbox_tab(string slug, string title, string? expected) =>
        Assert.Equal(expected, SearchIndexer.SandboxTopicFor(slug, title));

    [Fact]
    public void Lesson_results_link_to_the_Sandbox_tab()
    {
        var lesson = new DataStructureLesson { Slug = "graph-bfs", Title = "Graph BFS", Category = "Graphs" };
        Assert.Equal("/Sandbox?slug=graph-bfs&topic=BFS", SearchIndexer.LessonSection(lesson).Url);
    }
}

/// <summary>Old DSAVisual addresses (module-NN) redirect to the new ones (topic-NN).</summary>
public class LegacyUrlTests
{
    [Theory]
    [InlineData("/dsa-visualizer/module-05-bst/index.html", "/dsa-visualizer/topic-05-bst/index.html")]
    [InlineData("/dsa-visualizer/module-05-bst/", "/dsa-visualizer/topic-05-bst/")]
    [InlineData("/dsa-visualizer/module-05-bst", "/dsa-visualizer/topic-05-bst")]
    [InlineData("/DSA-Visualizer/Module-09-Dijkstra-Algorithm/module9.js", "/dsa-visualizer/topic-09-dijkstra-algorithm/topic9.js")]
    public void Old_paths_map_to_new_ones(string oldPath, string newPath) =>
        Assert.Equal(newPath, LegacyUrls.NewDsaPath(oldPath));

    [Theory]
    [InlineData("/dsa-visualizer/topic-05-bst/index.html")]
    [InlineData("/dsa-visualizer/index.html")]
    [InlineData("/ai-visualizer/modules/topic-05-game-trees/index.html")]
    [InlineData("")]
    [InlineData(null)]
    public void Other_paths_are_left_alone(string? path) => Assert.Null(LegacyUrls.NewDsaPath(path));
}
