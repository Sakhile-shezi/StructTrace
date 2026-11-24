namespace StructTrace.Web.Services.Progress;

/// <summary>One topic of a visualizer, as shown on the Profile page.</summary>
public sealed record ProgressTopic(string Id, string Title, string Url);

/// <summary>A visualizer's topics with the ones the student has completed.</summary>
public sealed class ProgressSummary
{
    public ProgressSummary(string name, IReadOnlyList<ProgressTopic> topics, IReadOnlyCollection<string> completedIds)
    {
        Name = name;
        Topics = topics;
        Completed = topics.Where(t => completedIds.Contains(t.Id)).ToList();
    }

    public string Name { get; }
    public IReadOnlyList<ProgressTopic> Topics { get; }
    public IReadOnlyList<ProgressTopic> Completed { get; }

    public int Percent => Topics.Count == 0 ? 0 : (int)Math.Round(100.0 * Completed.Count / Topics.Count);

    /// <summary>The first topic not yet completed (null when all are done).</summary>
    public ProgressTopic? Next => Topics.FirstOrDefault(t => !Completed.Contains(t));
}

/// <summary>The topics of AIVisual and DSAVisual and the progress key that marks each one complete.</summary>
public static class ProgressCatalog
{
    /// <summary>AIVisual stores {"topic-01-introduction": true, ...} in aivisual_progress_v1.</summary>
    public const string AiCompletedKey = "aivisual_progress_v1";

    /// <summary>DSAVisual stores {"mod1": true, ...} in dsa_visual_progress_v2.</summary>
    public const string DsaCompletedKey = "dsa_visual_progress_v2";

    public static readonly IReadOnlyList<ProgressTopic> AiTopics = new[]
    {
        Ai("topic-01-introduction", "Introduction to AI"),
        Ai("topic-02-problem-formulation", "Problem Formulation"),
        Ai("topic-03-uninformed-search", "Uninformed Search"),
        Ai("topic-04-heuristic-search", "Heuristic Search"),
        Ai("topic-05-game-trees", "Game Trees"),
        Ai("topic-06-genetic-algorithms", "Genetic Algorithms"),
        Ai("topic-07-machine-learning", "Machine Learning"),
        Ai("topic-08-perceptron", "Perceptron"),
        Ai("topic-09-logic", "Logic"),
        Ai("topic-10-csp", "Constraint Satisfaction")
    };

    public static readonly IReadOnlyList<ProgressTopic> DsaTopics = new[]
    {
        Dsa("mod1", "topic-01-foundations", "Foundations & Big-O"),
        Dsa("mod2", "topic-02-linked-lists", "Linked Lists"),
        Dsa("mod3", "topic-03-stacks-queues", "Stacks & Queues"),
        Dsa("mod4", "topic-04-heaps", "Heaps"),
        Dsa("mod5", "topic-05-bst", "Binary Search Trees"),
        Dsa("mod6", "topic-06-balanced-trees", "Balanced Trees"),
        Dsa("mod7", "topic-07-hashing", "Hashing"),
        Dsa("mod8", "topic-08-graphs-algorithms", "Graphs"),
        Dsa("mod9", "topic-09-dijkstra-algorithm", "Dijkstra & Algorithms")
    };

    private static ProgressTopic Ai(string id, string title) =>
        new(id, title, $"/ai-visualizer/modules/{id}/index.html");

    private static ProgressTopic Dsa(string id, string folder, string title) =>
        new(id, title, $"/dsa-visualizer/{folder}/index.html");

    public static ProgressSummary Ai(IReadOnlyDictionary<string, ProgressItem>? items) =>
        new("AIVisual", AiTopics, Flags(items, AiCompletedKey));

    public static ProgressSummary Dsa(IReadOnlyDictionary<string, ProgressItem>? items) =>
        new("DSAVisual", DsaTopics, Flags(items, DsaCompletedKey));

    private static HashSet<string> Flags(IReadOnlyDictionary<string, ProgressItem>? items, string key) =>
        items == null
            ? new HashSet<string>(StringComparer.Ordinal)
            : ProgressMerge.TrueFlags(items, key).ToHashSet(StringComparer.Ordinal);
}
