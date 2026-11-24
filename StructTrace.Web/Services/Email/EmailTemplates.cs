using System.Net;
using System.Text;

namespace StructTrace.Web.Services.Email;

/// <summary>
/// HTML + plain-text emails in the StructTrace look (navy header, white card,
/// blue button). Styles are inline because most mail apps ignore &lt;style&gt;.
/// </summary>
public static class EmailTemplates
{
    public static EmailMessage Welcome(string toAddress, string displayName, string siteUrl)
    {
        var name = string.IsNullOrWhiteSpace(displayName) ? "there" : displayName.Trim();
        var home = siteUrl.TrimEnd('/');

        var html = Layout(
            preheader: "Your StructTrace account is ready.",
            heading: $"Welcome to StructTrace, {Encode(name)}!",
            body:
                Paragraph("Your account is ready. Here is what you can do with it:") +
                Feature("DSAVisual", "Step through data structures and algorithms, from Big-O to graphs and shortest paths.") +
                Feature("AIVisual", "Trace search, game trees, genetic algorithms, perceptrons, logic and CSPs step by step.") +
                Feature("Code Sandbox", "Run traces in C++, Java, Python or C# and save them to your workspace.") +
                Button("Open StructTrace", home + "/") +
                Paragraph("Tip: your profile page shows your AIVisual progress and every trace you save.") +
                Small($"You are receiving this email because an account was created for {Encode(toAddress)} on StructTrace."));

        var text = new StringBuilder()
            .AppendLine($"Welcome to StructTrace, {name}!")
            .AppendLine()
            .AppendLine("Your account is ready. You can now use:")
            .AppendLine("- DSAVisual: data structures and algorithms, step by step")
            .AppendLine("- AIVisual: search, game trees, GAs, perceptrons, logic and CSPs")
            .AppendLine("- Code Sandbox: run and save traces in C++, Java, Python or C#")
            .AppendLine()
            .AppendLine($"Open StructTrace: {home}/")
            .AppendLine()
            .AppendLine($"You are receiving this email because an account was created for {toAddress} on StructTrace.")
            .ToString();

        return new EmailMessage(toAddress, displayName, "Welcome to StructTrace", html, text);
    }

    public static EmailMessage PasswordReset(string toAddress, string displayName, string resetUrl, TimeSpan validFor)
    {
        var name = string.IsNullOrWhiteSpace(displayName) ? "there" : displayName.Trim();
        var hours = validFor.TotalHours >= 1
            ? $"{validFor.TotalHours:0} hour{(validFor.TotalHours >= 2 ? "s" : "")}"
            : $"{validFor.TotalMinutes:0} minutes";

        var html = Layout(
            preheader: "Reset your StructTrace password.",
            heading: "Reset your password",
            body:
                Paragraph($"Hi {Encode(name)}, we received a request to reset the password for your StructTrace account.") +
                Button("Choose a new password", resetUrl) +
                Paragraph($"This link works once and expires in {hours}.") +
                Paragraph("If you did not ask for this, you can ignore this email. Your password will not change.") +
                Small("If the button does not work, copy this link into your browser:<br>" +
                      $"<a href=\"{Encode(resetUrl)}\" style=\"color:#2563eb;word-break:break-all;\">{Encode(resetUrl)}</a>"));

        var text = new StringBuilder()
            .AppendLine($"Hi {name},")
            .AppendLine()
            .AppendLine("We received a request to reset the password for your StructTrace account.")
            .AppendLine("Choose a new password here:")
            .AppendLine(resetUrl)
            .AppendLine()
            .AppendLine($"This link works once and expires in {hours}.")
            .AppendLine("If you did not ask for this, ignore this email. Your password will not change.")
            .ToString();

        return new EmailMessage(toAddress, displayName, "Reset your StructTrace password", html, text);
    }

    public static EmailMessage PasswordChanged(string toAddress, string displayName, string siteUrl)
    {
        var name = string.IsNullOrWhiteSpace(displayName) ? "there" : displayName.Trim();
        var forgot = siteUrl.TrimEnd('/') + "/Identity/Account/ForgotPassword";

        var html = Layout(
            preheader: "Your StructTrace password was changed.",
            heading: "Your password was changed",
            body:
                Paragraph($"Hi {Encode(name)}, the password for your StructTrace account was just reset.") +
                Paragraph("If this was you, there is nothing else to do.") +
                Paragraph("If it was not you, reset your password straight away and tell your administrator.") +
                Button("Reset my password", forgot));

        var text =
            $"Hi {name},\n\nThe password for your StructTrace account was just reset.\n" +
            "If this was you, there is nothing else to do.\n" +
            $"If it was not you, reset it straight away: {forgot}\n";

        return new EmailMessage(toAddress, displayName, "Your StructTrace password was changed", html, text);
    }

    /// <summary>Wraps any HTML from Identity's own pages in the same layout.</summary>
    public static EmailMessage Generic(string toAddress, string subject, string htmlMessage)
    {
        var html = Layout(subject, Encode(subject), $"<div style=\"font-size:15px;line-height:1.6;color:#334155;\">{htmlMessage}</div>");
        var text = System.Text.RegularExpressions.Regex.Replace(htmlMessage, "<[^>]+>", " ");
        return new EmailMessage(toAddress, null, subject, html, WebUtility.HtmlDecode(text));
    }


    // ---------------------------------------------------------------- building blocks

    private static string Encode(string value) => WebUtility.HtmlEncode(value);

    private static string Paragraph(string html) =>
        $"<p style=\"margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;\">{html}</p>";

    private static string Small(string html) =>
        $"<p style=\"margin:24px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;\">{html}</p>";

    private static string Feature(string title, string description) =>
        "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 10px;\"><tr>" +
        "<td style=\"padding:12px 14px;background:#f5f8fc;border:1px solid #dce4ef;border-radius:10px;\">" +
        $"<strong style=\"display:block;font-size:14px;color:#0f172a;\">{Encode(title)}</strong>" +
        $"<span style=\"font-size:13px;line-height:1.5;color:#475569;\">{Encode(description)}</span>" +
        "</td></tr></table>";

    private static string Button(string label, string url) =>
        "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:22px 0;\"><tr>" +
        $"<td style=\"border-radius:10px;background:#2563eb;\"><a href=\"{Encode(url)}\" " +
        "style=\"display:inline-block;padding:13px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;\">" +
        $"{Encode(label)}</a></td></tr></table>";

    private static string Layout(string preheader, string heading, string body) =>
        "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>StructTrace</title></head>" +
        "<body style=\"margin:0;padding:0;background:#f5f8fc;font-family:'Segoe UI',Arial,Helvetica,sans-serif;\">" +
        $"<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">{Encode(preheader)}</div>" +
        "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f5f8fc;padding:28px 12px;\"><tr><td align=\"center\">" +
        "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:560px;\">" +
        "<tr><td style=\"padding:22px 28px;background:#0f172a;border-radius:14px 14px 0 0;\">" +
        "<span style=\"font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;\">Struct<span style=\"color:#38bdf8;\">Trace</span></span>" +
        "</td></tr>" +
        "<tr><td style=\"padding:30px 28px;background:#ffffff;border:1px solid #dce4ef;border-top:0;border-radius:0 0 14px 14px;\">" +
        $"<h1 style=\"margin:0 0 18px;font-size:22px;line-height:1.3;color:#0f172a;\">{heading}</h1>" +
        body +
        "</td></tr>" +
        "<tr><td style=\"padding:16px 8px;text-align:center;font-size:12px;color:#94a3b8;\">StructTrace · Interactive data structures, AI and code tracing</td></tr>" +
        "</table></td></tr></table></body></html>";
}
