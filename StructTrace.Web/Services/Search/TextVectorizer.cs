using System.Text;
using System.Text.RegularExpressions;

namespace StructTrace.Web.Services.Search;

/// <summary>
/// Turns text into a 384-number vector for pgvector (the same size as the
/// vector(384) columns). It needs no AI model or API key: words, word pairs and
/// letter triples are hashed into the vector and weighted by how rare they are
/// across the site (TF-IDF). Course abbreviations are expanded, so "BFS" also
/// finds "breadth-first search" and "A*" finds "A-star".
///
/// This is keyword search, not meaning search: it finds sections that use the
/// same words, tolerates small spelling mistakes, but will not match synonyms it
/// has not been told about. To switch to a real embedding model later, keep the
/// same Dimensions and replace Embed().
/// </summary>
public sealed class TextVectorizer
{
    public const int Dimensions = 384;

    /// <summary>Change this whenever the vectors change, so stored vectors are rebuilt.</summary>
    public const string Version = "kv2";

    private const double BigramWeight = 0.55;
    private const double TrigramWeight = 0.18;

    private static readonly Regex TokenPattern = new("[a-z0-9]+", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly (Regex Pattern, string Replacement)[] Replacements =
    {
        (Rx(@"(?<![a-z0-9])a\*"), " astar "),
        (Rx(@"\ba[- ]star\b"), " astar "),
        (Rx(@"(?<![a-z0-9])c\+\+"), " cpp "),
        (Rx(@"(?<![a-z0-9])c#"), " csharp "),
        (Rx("α"), " alpha "),
        (Rx("β"), " beta "),
        (Rx(@"\bbig[- ]o\b"), " bigo "),
        (Rx(@"\bac-3\b"), " ac3 "),
        (Rx(@"\bk-means\b"), " kmeans "),
        (Rx(@"\bmin[- ]heap"), " minheap "),
        (Rx(@"\bmax[- ]heap"), " maxheap "),
        (Rx(@"\bred[- ]black\b"), " redblack "),
        (Rx(@"\balpha[- ]beta\b"), " alphabeta "),
        (Rx(@"\buniform[- ]cost\b"), " uniform cost lcfs "),
        (Rx(@"\blowest[- ]cost[- ]first\b"), " lowest cost first ucs ")
    };

    private static Regex Rx(string pattern) =>
        new(pattern, RegexOptions.Compiled | RegexOptions.CultureInvariant);

    /// <summary>Abbreviations used in COMP304 and the DSA course, expanded both in pages and in queries.</summary>
    private static readonly Dictionary<string, string[]> Expansions = new(StringComparer.Ordinal)
    {
        ["bfs"] = new[] { "breadth", "first", "search" },
        ["dfs"] = new[] { "depth", "first", "search" },
        ["lcfs"] = new[] { "lowest", "cost", "first", "search" },
        ["ucs"] = new[] { "uniform", "cost", "search", "lcfs" },
        ["ids"] = new[] { "iterative", "deepening", "search" },
        ["astar"] = new[] { "heuristic", "search" },
        ["bst"] = new[] { "binary", "search", "tree" },
        ["avl"] = new[] { "balanced", "tree", "rotation" },
        ["redblack"] = new[] { "balanced", "tree" },
        ["csp"] = new[] { "constraint", "satisfaction", "problem" },
        ["mrv"] = new[] { "minimum", "remaining", "values" },
        ["ac3"] = new[] { "arc", "consistency" },
        ["ga"] = new[] { "genetic", "algorithm" },
        ["ml"] = new[] { "machine", "learning" },
        ["ai"] = new[] { "artificial", "intelligence" },
        ["cnf"] = new[] { "conjunctive", "normal", "form" },
        ["fol"] = new[] { "first", "order", "logic" },
        ["kb"] = new[] { "knowledge", "base" },
        ["mst"] = new[] { "minimum", "spanning", "tree" },
        ["dp"] = new[] { "dynamic", "programming" },
        ["lifo"] = new[] { "stack" },
        ["fifo"] = new[] { "queue" },
        ["bigo"] = new[] { "complexity" },
        ["minheap"] = new[] { "heap" },
        ["maxheap"] = new[] { "heap" },
        ["alphabeta"] = new[] { "alpha", "beta", "pruning", "minimax" },
        ["djikstra"] = new[] { "dijkstra" },
        ["dijkstras"] = new[] { "dijkstra" }
    };

    private static readonly HashSet<string> StopWords = new(StringComparer.Ordinal)
    {
        "a","about","above","after","again","all","also","am","an","and","any","are","as","at",
        "be","because","been","before","being","below","between","both","but","by","can","could",
        "did","do","does","doing","down","during","each","few","for","from","further","had","has",
        "have","having","he","her","here","hers","him","his","how","i","if","in","into","is","it",
        "its","itself","just","me","more","most","my","no","nor","not","now","of","off","on","once",
        "only","or","other","our","ours","out","over","own","same","she","should","so","some","such",
        "than","that","the","their","them","then","there","these","they","this","those","through",
        "to","too","under","until","up","very","was","we","were","what","when","where","which",
        "while","who","whom","why","will","with","would","you","your","yours","let","use","used",
        "using","get","gets","one","two","may","must","every","s","t","e","g","eg","ie","etc",
        "show","shows","see","step","steps","example","examples","click","press","way"
    };

    private readonly IReadOnlyDictionary<string, double> _idf;
    private readonly double _unknownIdf;

    private TextVectorizer(IReadOnlyDictionary<string, double> idf, double unknownIdf)
    {
        _idf = idf;
        _unknownIdf = unknownIdf;
    }

    /// <summary>A vectorizer with no word statistics (every word weighs the same).</summary>
    public static TextVectorizer Untrained { get; } = new(new Dictionary<string, double>(), 1.0);

    public int VocabularySize => _idf.Count;

    /// <summary>Learns how rare each word is across all the documents.</summary>
    public static TextVectorizer Train(IEnumerable<string> documents)
    {
        var documentFrequency = new Dictionary<string, int>(StringComparer.Ordinal);
        var count = 0;

        foreach (var document in documents)
        {
            count++;
            foreach (var term in Terms(document).Distinct())
            {
                documentFrequency[term] = documentFrequency.TryGetValue(term, out var n) ? n + 1 : 1;
            }
        }

        var idf = documentFrequency.ToDictionary(
            p => p.Key,
            p => Math.Log((count + 1.0) / (p.Value + 1.0)) + 1.0,
            StringComparer.Ordinal);

        return new TextVectorizer(idf, Math.Log(count + 1.0) + 1.0);
    }

    public double Idf(string term) => _idf.TryGetValue(term, out var value) ? value : _unknownIdf;

    /// <summary>True when exactly this word appears somewhere in the trained text.</summary>
    public bool HasWord(string term) => _idf.ContainsKey(term);

    /// <summary>True when the word (or a word one typing mistake away) appears somewhere in the trained text.</summary>
    public bool IsKnown(string term) =>
        _idf.ContainsKey(term) || (term.Length >= 5 && _idf.Keys.Any(k => NearlySame(k, term)));

    /// <summary>Vector for a query or a single block of text.</summary>
    public float[] Embed(string text) => Embed(new[] { (text, 1.0) });

    /// <summary>Vector for several fields, e.g. a heading (weight 3) and its body (weight 1).</summary>
    public float[] Embed(IEnumerable<(string Text, double Weight)> fields)
    {
        var features = new Dictionary<string, double>(StringComparer.Ordinal);

        foreach (var (text, weight) in fields)
        {
            if (string.IsNullOrWhiteSpace(text) || weight <= 0) continue;

            var terms = Terms(text);

            foreach (var group in terms.GroupBy(t => t, StringComparer.Ordinal))
            {
                var idf = Idf(group.Key);
                var tf = 1.0 + Math.Log(group.Count());
                Add(features, "u:" + group.Key, weight * tf * idf);

                if (group.Key.Length >= 5)
                {
                    var padded = "^" + group.Key + "$";
                    var trigrams = padded.Length - 2;
                    for (var i = 0; i < trigrams; i++)
                    {
                        Add(features, "c:" + padded.Substring(i, 3), weight * TrigramWeight * tf * idf / Math.Sqrt(trigrams));
                    }
                }
            }

            for (var i = 0; i + 1 < terms.Count; i++)
            {
                if (terms[i] == terms[i + 1]) continue;
                var pairIdf = (Idf(terms[i]) + Idf(terms[i + 1])) / 2.0;
                Add(features, "b:" + terms[i] + " " + terms[i + 1], weight * BigramWeight * pairIdf);
            }
        }

        return Project(features);
    }

    /// <summary>
    /// Lower-cased, stemmed words with stop words removed and abbreviations expanded,
    /// in reading order.
    /// </summary>
    public static List<string> Terms(string text) => Terms(text, expand: true);

    /// <param name="expand">False to leave out the extra words added for abbreviations (the words as typed).</param>
    public static List<string> Terms(string text, bool expand)
    {
        var result = new List<string>();
        if (string.IsNullOrWhiteSpace(text)) return result;

        var lower = text.ToLowerInvariant();
        foreach (var (pattern, replacement) in Replacements)
        {
            lower = pattern.Replace(lower, replacement);
        }

        foreach (Match match in TokenPattern.Matches(lower))
        {
            var word = match.Value;
            if (word.Length < 2 && !char.IsDigit(word[0])) continue;
            if (StopWords.Contains(word)) continue;

            var stem = Stem(word);
            result.Add(stem);

            if (expand && (Expansions.TryGetValue(word, out var expansion) || Expansions.TryGetValue(stem, out expansion)))
            {
                foreach (var extra in expansion) result.Add(Stem(extra));
            }
        }

        return result;
    }

    /// <summary>A small, predictable English stemmer ("queues" → "queue", "sorting" → "sort").</summary>
    public static string Stem(string word)
    {
        if (word.Length <= 3 || word.Any(char.IsDigit)) return word;

        if (word.EndsWith("ies", StringComparison.Ordinal) && word.Length > 4) return word[..^3] + "y";
        if (word.EndsWith("sses", StringComparison.Ordinal)) return word[..^2];
        if (word.EndsWith("ches", StringComparison.Ordinal) || word.EndsWith("shes", StringComparison.Ordinal) ||
            word.EndsWith("xes", StringComparison.Ordinal)) return word[..^2];
        if (word.EndsWith("ing", StringComparison.Ordinal) && word.Length > 5) return TrimDouble(word[..^3]);
        if (word.EndsWith("ed", StringComparison.Ordinal) && word.Length > 4 && !word.EndsWith("eed", StringComparison.Ordinal)) return TrimDouble(word[..^2]);
        if (word.EndsWith("s", StringComparison.Ordinal) && !word.EndsWith("ss", StringComparison.Ordinal) &&
            !word.EndsWith("us", StringComparison.Ordinal) && !word.EndsWith("is", StringComparison.Ordinal)) return word[..^1];

        return word;
    }

    private static string TrimDouble(string stem)
    {
        // "mapped" → "mapp" → "map", but keep "fall", "pass", "add".
        if (stem.Length > 3 && stem[^1] == stem[^2] && "bdgmnprt".Contains(stem[^1])) return stem[..^1];
        return stem;
    }

    private static void Add(Dictionary<string, double> features, string key, double value)
    {
        features[key] = features.TryGetValue(key, out var current) ? current + value : value;
    }

    private static float[] Project(Dictionary<string, double> features)
    {
        var vector = new double[Dimensions];

        foreach (var (feature, value) in features)
        {
            var hash = Fnv1a64(feature);
            var index = (int)(hash % Dimensions);
            var sign = ((hash >> 40) & 1) == 0 ? 1.0 : -1.0;
            vector[index] += sign * value;
        }

        var norm = Math.Sqrt(vector.Sum(v => v * v));
        var result = new float[Dimensions];
        if (norm <= 0) return result;

        for (var i = 0; i < Dimensions; i++)
        {
            result[i] = (float)(vector[i] / norm);
        }

        return result;
    }

    /// <summary>Stable across machines and restarts (string.GetHashCode is not).</summary>
    private static ulong Fnv1a64(string text)
    {
        const ulong offset = 14695981039346656037UL;
        const ulong prime = 1099511628211UL;

        var hash = offset;
        foreach (var b in Encoding.UTF8.GetBytes(text))
        {
            hash ^= b;
            hash *= prime;
        }

        return hash;
    }

    /// <summary>
    /// True when two words differ by at most one letter added, removed, changed or
    /// swapped with its neighbour ("dijsktra" ≈ "dijkstra"). Only for words of 5+ letters.
    /// </summary>
    public static bool NearlySame(string a, string b)
    {
        if (a == b) return true;
        if (a.Length < 5 || b.Length < 5 || Math.Abs(a.Length - b.Length) > 1) return false;

        var i = 0;
        while (i < a.Length && i < b.Length && a[i] == b[i]) i++;

        if (a.Length == b.Length)
        {
            if (a.AsSpan(i + 1).SequenceEqual(b.AsSpan(i + 1))) return true;                       // one letter changed
            return i + 1 < a.Length && a[i] == b[i + 1] && a[i + 1] == b[i] &&
                   a.AsSpan(i + 2).SequenceEqual(b.AsSpan(i + 2));                                  // two letters swapped
        }

        return a.Length > b.Length
            ? a.AsSpan(i + 1).SequenceEqual(b.AsSpan(i))                                            // one letter extra
            : a.AsSpan(i).SequenceEqual(b.AsSpan(i + 1));                                           // one letter missing
    }

    public static double Cosine(float[] a, float[] b)
    {
        double dot = 0;
        for (var i = 0; i < a.Length && i < b.Length; i++) dot += a[i] * b[i];
        return dot;
    }

    public static bool IsZero(float[] vector) => vector.All(v => v == 0f);
}
