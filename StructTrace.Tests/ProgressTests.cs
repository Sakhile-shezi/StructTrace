using StructTrace.Web.Services.Progress;

namespace StructTrace.Tests;

/// <summary>Merge rules behind /api/progress (newest change of each key wins).</summary>
public class ProgressMergeTests
{
    private const long Now = 1_800_000_000_000;

    private static Dictionary<string, ProgressItem> Items(params (string Key, string? Value, long T)[] items) =>
        items.ToDictionary(i => i.Key, i => new ProgressItem { Value = i.Value, T = i.T }, StringComparer.Ordinal);

    [Fact]
    public void Newer_change_replaces_the_stored_one()
    {
        var stored = Items(("aivisual_progress_v1", "{\"topic-01-introduction\":true}", Now - 1000));
        var changed = ProgressMerge.Merge(stored, Items(("aivisual_progress_v1", "{}", Now - 10)), Now);

        Assert.True(changed);
        Assert.Equal("{}", stored["aivisual_progress_v1"].Value);
        Assert.Equal(Now - 10, stored["aivisual_progress_v1"].T);
    }

    [Fact]
    public void Older_change_is_ignored()
    {
        var stored = Items(("aivisual_progress_v1", "{\"topic-01-introduction\":true}", Now - 10));
        var changed = ProgressMerge.Merge(stored, Items(("aivisual_progress_v1", "{}", Now - 1000)), Now);

        Assert.False(changed);
        Assert.Equal("{\"topic-01-introduction\":true}", stored["aivisual_progress_v1"].Value);
    }

    [Fact]
    public void Keys_are_merged_separately()
    {
        var stored = Items(("aiv_checklist_state", "{\"a\":true}", Now - 50));
        ProgressMerge.Merge(stored, Items(("aivisual_progress_v1", "{\"x\":true}", Now - 100)), Now);

        Assert.Equal(2, stored.Count);
        Assert.Equal("{\"a\":true}", stored["aiv_checklist_state"].Value);
    }

    [Fact]
    public void Stamps_from_the_future_are_limited_to_a_few_minutes_ahead()
    {
        var stored = Items();
        ProgressMerge.Merge(stored, Items(("dsa_visual_progress_v2", "{}", Now + (long)TimeSpan.FromDays(3).TotalMilliseconds)), Now);

        Assert.True(stored["dsa_visual_progress_v2"].T <= Now + (long)ProgressMerge.MaxClockSkew.TotalMilliseconds);
    }

    [Fact]
    public void Missing_stamp_means_now()
    {
        var stored = Items();
        ProgressMerge.Merge(stored, Items(("dsa_visual_progress_v2", "{}", 0)), Now);

        Assert.Equal(Now, stored["dsa_visual_progress_v2"].T);
    }

    [Fact]
    public void A_removed_key_is_stored_as_null_so_other_devices_remove_it_too()
    {
        var stored = Items(("dsa_visual_progress_v2", "{\"mod1\":true}", Now - 100));
        ProgressMerge.Merge(stored, Items(("dsa_visual_progress_v2", null, Now - 1)), Now);

        Assert.Null(stored["dsa_visual_progress_v2"].Value);
    }

    [Theory]
    [InlineData("ai", "aivisual_progress_v1", null)]
    [InlineData("dsa", "dsav_checklist_state", null)]
    [InlineData("ai", "dsa_visual_progress_v2", "not a progress key")]
    [InlineData("ai", "aivisual_display_v1", "not a progress key")]
    [InlineData("zzz", "aivisual_progress_v1", "Unknown progress area")]
    public void Only_known_areas_and_progress_keys_are_accepted(string area, string key, string? error)
    {
        var result = ProgressMerge.Validate(area, Items((key, "{}", Now)));

        if (error == null) Assert.Null(result);
        else Assert.Contains(error, result);
    }

    [Fact]
    public void Values_over_the_size_limit_are_rejected()
    {
        var big = new string('x', ProgressMerge.MaxValueLength + 1);
        Assert.NotNull(ProgressMerge.Validate("ai", Items(("aivisual_progress_v1", big, Now))));
    }

    [Fact]
    public void An_empty_upload_is_rejected()
    {
        Assert.NotNull(ProgressMerge.Validate("ai", Items()));
        Assert.NotNull(ProgressMerge.Validate("ai", null));
    }

    [Fact]
    public void Parse_and_serialize_round_trip()
    {
        var items = Items(("aivisual_progress_v1", "{\"topic-02-problem-formulation\":true}", Now));
        var parsed = ProgressMerge.Parse(ProgressMerge.Serialize(items));

        Assert.Equal(items["aivisual_progress_v1"].Value, parsed["aivisual_progress_v1"].Value);
        Assert.Equal(Now, parsed["aivisual_progress_v1"].T);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("[1,2,3]")]
    public void Damaged_stored_data_reads_as_empty(string? json)
    {
        Assert.Empty(ProgressMerge.Parse(json));
    }

    [Fact]
    public void TrueFlags_lists_only_the_ticked_ids()
    {
        var items = Items(("dsa_visual_progress_v2", "{\"mod1\":true,\"mod2\":false,\"mod3\":true,\"x\":1}", Now));
        Assert.Equal(new[] { "mod1", "mod3" }, ProgressMerge.TrueFlags(items, "dsa_visual_progress_v2"));
        Assert.Empty(ProgressMerge.TrueFlags(items, "aivisual_progress_v1"));
    }
}

/// <summary>The Profile page's view of the progress.</summary>
public class ProgressCatalogTests
{
    private static Dictionary<string, ProgressItem> With(string key, string json) =>
        new(StringComparer.Ordinal) { [key] = new ProgressItem { Value = json, T = 1 } };

    [Fact]
    public void AIVisual_summary_counts_completed_topics_and_suggests_the_next_one()
    {
        var summary = ProgressCatalog.Ai(With(ProgressCatalog.AiCompletedKey,
            "{\"topic-01-introduction\":true,\"topic-02-problem-formulation\":true}"));

        Assert.Equal(10, summary.Topics.Count);
        Assert.Equal(2, summary.Completed.Count);
        Assert.Equal(20, summary.Percent);
        Assert.Equal("topic-03-uninformed-search", summary.Next?.Id);
    }

    [Fact]
    public void DSAVisual_summary_uses_the_new_topic_addresses()
    {
        var summary = ProgressCatalog.Dsa(With(ProgressCatalog.DsaCompletedKey, "{\"mod1\":true}"));

        Assert.Equal(9, summary.Topics.Count);
        Assert.Equal("/dsa-visualizer/topic-02-linked-lists/index.html", summary.Next?.Url);
        Assert.All(summary.Topics, t => Assert.DoesNotContain("/module-", t.Url));
    }

    [Fact]
    public void Everything_done_means_no_next_topic()
    {
        var all = "{" + string.Join(",", ProgressCatalog.DsaTopics.Select(t => $"\"{t.Id}\":true")) + "}";
        var summary = ProgressCatalog.Dsa(With(ProgressCatalog.DsaCompletedKey, all));

        Assert.Null(summary.Next);
        Assert.Equal(100, summary.Percent);
    }

    [Fact]
    public void No_progress_at_all()
    {
        var summary = ProgressCatalog.Ai(null);
        Assert.Empty(summary.Completed);
        Assert.Equal(0, summary.Percent);
        Assert.Equal("topic-01-introduction", summary.Next?.Id);
    }
}
