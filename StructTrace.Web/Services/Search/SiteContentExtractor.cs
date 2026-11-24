using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace StructTrace.Web.Services.Search;

/// <summary>A searchable piece of the site: one section of a page, or a whole page.</summary>
public sealed record ContentSection(
    string Key,
    string Source,
    string PageTitle,
    string Heading,
    string Url,
    string Text);

/// <summary>
/// Reads the static AIVisual and DSAVisual pages and splits them into their
/// &lt;section id="..."&gt; blocks, each with its heading and plain text.
/// Scripts, styles, SVG drawings, buttons, menus and comments are ignored.
/// </summary>
public static class SiteContentExtractor
{
    public const int MaxTextLength = 12_000;

    private const RegexOptions Options =
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;

    // Not searchable: code that is not shown, drawings, and controls (button and menu labels).
    private static readonly Regex Ignored = new(
        @"<(script|style|svg|noscript|template|canvas|button|select|textarea)\b[\s\S]*?</\1\s*>|<!--[\s\S]*?-->", Options);

    private static readonly Regex Section = new(
        @"<section\b(?<attrs>[^>]*)>(?<body>[\s\S]*?)</section\s*>", Options);

    private static readonly Regex IdAttribute = new(@"\bid\s*=\s*[""'](?<id>[^""']+)[""']", Options);
    private static readonly Regex ClassAttribute = new(@"\bclass\s*=\s*[""'](?<c>[^""']*)[""']", Options);
    private static readonly Regex Heading2 = new(@"<h2\b[^>]*>(?<h>[\s\S]*?)</h2\s*>", Options);
    private static readonly Regex Heading3 = new(@"<h3\b[^>]*>(?<h>[\s\S]*?)</h3\s*>", Options);
    private static readonly Regex Heading1 = new(@"<h1\b[^>]*>(?<h>[\s\S]*?)</h1\s*>", Options);
    private static readonly Regex Title = new(@"<title\b[^>]*>(?<t>[\s\S]*?)</title\s*>", Options);
    private static readonly Regex BlockEnd = new(
        @"<br\s*/?>|</(p|li|h[1-6]|td|th|tr|div|dt|dd|pre|blockquote|figcaption|summary|label|button)\s*>", Options);
    private static readonly Regex Tag = new(@"<[^>]+>", Options);
    private static readonly Regex Spaces = new(@"[ \t\f\v ]+", Options);
    private static readonly Regex BlankLines = new(@"\s*\n\s*", Options);

    /// <summary>Splits one page into searchable sections plus a page-level entry.</summary>
    public static IReadOnlyList<ContentSection> ExtractPage(string html, string source, string pageUrl)
    {
        var results = new List<ContentSection>();
        if (string.IsNullOrWhiteSpace(html)) return results;

        var clean = Ignored.Replace(html, " ");
        var pageTitle = PageTitle(clean);
        var headings = new List<string>();
        string intro = "";

        foreach (Match match in Section.Matches(clean))
        {
            var attrs = match.Groups["attrs"].Value;
            var body = match.Groups["body"].Value;
            var id = IdAttribute.Match(attrs) is { Success: true } idMatch ? idMatch.Groups["id"].Value.Trim() : "";
            var classes = ClassAttribute.Match(attrs) is { Success: true } classMatch ? classMatch.Groups["c"].Value : "";

            if (id.Length == 0)
            {
                // The hero banner at the top of a page describes the whole page.
                if (intro.Length == 0 && classes.Contains("hero", StringComparison.OrdinalIgnoreCase))
                {
                    intro = PlainText(body);
                }
                continue;
            }

            var heading = InlineText(FirstMatch(body, Heading2) ?? FirstMatch(body, Heading3) ?? "");
            var text = PlainText(body);
            if (heading.Length == 0) heading = FirstLine(text);
            if (text.Length < 40) continue;

            headings.Add(heading);
            results.Add(new ContentSection(
                Key: pageUrl + "#" + id,
                Source: source,
                PageTitle: pageTitle,
                Heading: Truncate(heading, 200),
                Url: pageUrl + "#" + Uri.EscapeDataString(id),
                Text: Truncate(text, MaxTextLength)));
        }

        if (pageTitle.Length > 0)
        {
            var overview = new StringBuilder(intro);
            if (headings.Count > 0)
            {
                overview.Append('\n').Append("In this topic: ").Append(string.Join("; ", headings)).Append('.');
            }

            results.Insert(0, new ContentSection(
                Key: pageUrl,
                Source: source,
                PageTitle: pageTitle,
                Heading: Truncate(pageTitle, 200),
                Url: pageUrl,
                Text: Truncate(overview.ToString().Trim(), MaxTextLength)));
        }

        return results;
    }

    /// <summary>The page's main heading, falling back to the &lt;title&gt; without the site name.</summary>
    public static string PageTitle(string html)
    {
        var h1 = InlineText(FirstMatch(html, Heading1) ?? "");
        if (h1.Length > 0) return Truncate(h1, 200);

        var title = InlineText(FirstMatch(html, Title) ?? "");
        foreach (var separator in new[] { " | ", " - ", " — " })
        {
            var cut = title.LastIndexOf(separator, StringComparison.Ordinal);
            if (cut > 0) title = title[..cut];
        }

        return Truncate(title.Trim(), 200);
    }

    /// <summary>Visible text with one line per paragraph, list item, heading or table cell.</summary>
    public static string PlainText(string html)
    {
        var text = BlockEnd.Replace(html, "\n");
        text = Tag.Replace(text, " ");
        text = WebUtility.HtmlDecode(text);
        text = Spaces.Replace(text, " ");
        text = BlankLines.Replace(text, "\n");
        return text.Trim();
    }

    private static string InlineText(string html)
    {
        var text = WebUtility.HtmlDecode(Tag.Replace(html, " "));
        return Regex.Replace(text, @"\s+", " ").Trim();
    }

    private static string? FirstMatch(string html, Regex pattern)
    {
        // Each pattern has exactly one (named) capture group, which is the last group.
        var match = pattern.Match(html);
        return match.Success ? match.Groups[match.Groups.Count - 1].Value : null;
    }

    private static string FirstLine(string text)
    {
        var newline = text.IndexOf('\n');
        return Truncate(newline < 0 ? text : text[..newline], 120);
    }

    /// <summary>Shortens text to at most <paramref name="max"/> characters, ending with "…" when cut.</summary>
    public static string Truncate(string text, int max) =>
        text.Length <= max ? text : text[..(max - 1)].TrimEnd() + "…";
}
