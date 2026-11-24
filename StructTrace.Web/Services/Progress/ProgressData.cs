using System.Text.Json;
using System.Text.Json.Serialization;

namespace StructTrace.Web.Services.Progress;

/// <summary>
/// The browser keys that hold study progress. Only these are accepted by
/// /api/progress, so the API can never be used as general-purpose storage.
/// Display settings (zoom, playback speed, hidden menu bar) stay per device.
/// </summary>
public static class ProgressAreas
{
    public const string Ai = "ai";
    public const string Dsa = "dsa";

    public static readonly IReadOnlyDictionary<string, string[]> Keys =
        new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            [Ai] = new[]
            {
                "aivisual_progress_v1",        // topics marked complete
                "aiv_checklist_state",         // ticked checklist items
                "aiv_uninformed_completed_v1", // topic 3 search runs
                "aiv_heuristic_completed_v3",  // topic 4 search runs
                "aiv_game_trees_v2"            // topic 5 traces
            },
            [Dsa] = new[]
            {
                "dsa_visual_progress_v2",      // topics marked complete
                "dsav_checklist_state"         // ticked checklist items
            }
        };

    public static bool IsArea(string? area) => area != null && Keys.ContainsKey(area);

    public static bool IsKey(string area, string key) =>
        Keys.TryGetValue(area, out var keys) && Array.IndexOf(keys, key) >= 0;
}

/// <summary>One browser key: its raw value (null = removed) and when it changed (Unix ms).</summary>
public sealed class ProgressItem
{
    [JsonPropertyName("value")]
    public string? Value { get; set; }

    [JsonPropertyName("t")]
    public long T { get; set; }
}

public sealed class ProgressPutRequest
{
    [JsonPropertyName("items")]
    public Dictionary<string, ProgressItem>? Items { get; set; }
}

/// <summary>
/// Pure merge rules for progress documents (unit-tested in StructTrace.Tests).
/// Each key is merged on its own and the most recent change wins, so two devices
/// that change different things never overwrite each other.
/// </summary>
public static class ProgressMerge
{
    public const int MaxValueLength = 32 * 1024;
    public const int MaxDocumentLength = 128 * 1024;

    /// <summary>Changes stamped further ahead than this are treated as "now" (clock skew).</summary>
    public static readonly TimeSpan MaxClockSkew = TimeSpan.FromMinutes(5);

    private static readonly JsonSerializerOptions Json = new() { WriteIndented = false };

    public static Dictionary<string, ProgressItem> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new(StringComparer.Ordinal);

        try
        {
            var parsed = JsonSerializer.Deserialize<Dictionary<string, ProgressItem>>(json, Json);
            return parsed == null
                ? new(StringComparer.Ordinal)
                : new(parsed.Where(p => p.Value != null), StringComparer.Ordinal);
        }
        catch (JsonException)
        {
            return new(StringComparer.Ordinal);
        }
    }

    public static string Serialize(IReadOnlyDictionary<string, ProgressItem> items) =>
        JsonSerializer.Serialize(items, Json);

    /// <summary>Checks an upload. Returns an error message, or null when it is acceptable.</summary>
    public static string? Validate(string area, IReadOnlyDictionary<string, ProgressItem>? incoming)
    {
        if (!ProgressAreas.IsArea(area)) return $"Unknown progress area '{area}'.";
        if (incoming == null || incoming.Count == 0) return "No progress items were sent.";

        foreach (var (key, item) in incoming)
        {
            if (!ProgressAreas.IsKey(area, key)) return $"'{key}' is not a progress key of the '{area}' area.";
            if (item == null) return $"'{key}' has no value.";
            if (item.Value is { Length: > MaxValueLength }) return $"'{key}' is larger than {MaxValueLength / 1024} KB.";
        }

        return null;
    }

    /// <summary>
    /// Merges an upload into the stored items. A key is replaced when the upload's
    /// change is at least as recent as the stored one. Returns true when anything changed.
    /// </summary>
    public static bool Merge(
        IDictionary<string, ProgressItem> stored,
        IReadOnlyDictionary<string, ProgressItem> incoming,
        long nowUnixMs)
    {
        var latestAllowed = nowUnixMs + (long)MaxClockSkew.TotalMilliseconds;
        var changed = false;

        foreach (var (key, item) in incoming)
        {
            var t = item.T <= 0 ? nowUnixMs : Math.Min(item.T, latestAllowed);

            if (stored.TryGetValue(key, out var current) && current.T > t) continue;
            if (current != null && current.T == t && current.Value == item.Value) continue;

            stored[key] = new ProgressItem { Value = item.Value, T = t };
            changed = true;
        }

        return changed;
    }

    /// <summary>The ids whose value is true in a stored JSON object such as {"topic-01": true}.</summary>
    public static IReadOnlyList<string> TrueFlags(IReadOnlyDictionary<string, ProgressItem> items, string key)
    {
        if (!items.TryGetValue(key, out var item) || string.IsNullOrWhiteSpace(item.Value)) return Array.Empty<string>();

        try
        {
            using var doc = JsonDocument.Parse(item.Value);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return Array.Empty<string>();

            return doc.RootElement.EnumerateObject()
                .Where(p => p.Value.ValueKind == JsonValueKind.True)
                .Select(p => p.Name)
                .ToList();
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }
}
