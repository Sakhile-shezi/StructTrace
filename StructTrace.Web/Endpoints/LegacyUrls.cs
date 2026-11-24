using System.Text.RegularExpressions;

namespace StructTrace.Web.Endpoints;

/// <summary>
/// DSAVisual's topic pages moved from /dsa-visualizer/module-NN-name/ to
/// /dsa-visualizer/topic-NN-name/ (and moduleN.js to topicN.js). Old bookmarks,
/// links and search results are redirected to the new address.
/// </summary>
public static partial class LegacyUrls
{
    [GeneratedRegex(@"^/dsa-visualizer/module-(?<topic>\d\d-[a-z0-9-]+)(?<rest>/.*)?$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex OldDsaTopic();

    [GeneratedRegex(@"/module(?<n>\d)\.js$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex OldDsaScript();

    /// <summary>The new path for an old DSAVisual topic path, or null when the path is not an old one.</summary>
    public static string? NewDsaPath(string? path)
    {
        if (string.IsNullOrEmpty(path)) return null;

        var match = OldDsaTopic().Match(path);
        if (!match.Success) return null;

        var rest = OldDsaScript().Replace(match.Groups["rest"].Value, "/topic${n}.js");
        return "/dsa-visualizer/topic-" + match.Groups["topic"].Value.ToLowerInvariant() + rest;
    }

    /// <summary>Middleware: permanently redirects old DSAVisual addresses, keeping the query string.</summary>
    public static IApplicationBuilder UseLegacyUrlRedirects(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var newPath = NewDsaPath(context.Request.Path.Value);

            if (newPath != null && (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method)))
            {
                context.Response.Redirect(context.Request.PathBase + newPath + context.Request.QueryString, permanent: true);
                return;
            }

            await next();
        });
}
