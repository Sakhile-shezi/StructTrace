using StructTrace.Web.Models;
using StructTrace.Web.Services.Email;

namespace StructTrace.Tests;

/// <summary>The name and initials shown in the top bar.</summary>
public class UserDisplayTests
{
    [Theory]
    [InlineData("Sakhile Shezi", "shezi9835@gmail.com", "Sakhile Shezi")]
    [InlineData("  Thandi Mokoena  ", "t@example.com", "Thandi Mokoena")]
    [InlineData("", "shezi9835@gmail.com", "shezi9835")]
    [InlineData(null, null, "Account")]
    public void Name(string? displayName, string? email, string expected) =>
        Assert.Equal(expected, UserDisplay.Name(displayName, email));

    [Theory]
    [InlineData("Sakhile Shezi", "x@y.z", "SS")]
    [InlineData("thandi mokoena dlamini", null, "TD")]
    [InlineData("Plato", null, "P")]
    [InlineData("", "merlin.lebese@gmail.com", "M")]
    [InlineData(null, null, "?")]
    public void Initials(string? displayName, string? email, string expected) =>
        Assert.Equal(expected, UserDisplay.Initials(displayName, email));
}

/// <summary>Welcome and password emails.</summary>
public class EmailTemplateTests
{
    [Fact]
    public void Welcome_email_greets_by_name_and_links_to_the_site()
    {
        var mail = EmailTemplates.Welcome("thandi@example.com", "Thandi Mokoena", "https://structtrace-web.onrender.com/");

        Assert.Equal("thandi@example.com", mail.ToAddress);
        Assert.Contains("Thandi Mokoena", mail.HtmlBody);
        Assert.Contains("https://structtrace-web.onrender.com/", mail.HtmlBody);
        Assert.Contains("https://structtrace-web.onrender.com/", mail.TextBody);
        Assert.DoesNotContain(".com//", mail.HtmlBody);
    }

    [Fact]
    public void Names_are_html_encoded()
    {
        var mail = EmailTemplates.Welcome("x@example.com", "<script>alert(1)</script>", "https://example.com");
        Assert.DoesNotContain("<script>alert(1)</script>", mail.HtmlBody);
        Assert.Contains("&lt;script&gt;", mail.HtmlBody);
    }

    [Fact]
    public void Welcome_email_does_not_promise_running_every_language()
    {
        var mail = EmailTemplates.Welcome("x@example.com", "X", "https://example.com");
        Assert.DoesNotContain("Run traces in C++, Java, Python or C#", mail.HtmlBody);
        Assert.Contains("Python", mail.TextBody);
    }

    [Fact]
    public void Password_reset_email_contains_the_link_and_how_long_it_works()
    {
        var link = "https://example.com/Identity/Account/ResetPassword?code=abc&email=x%40example.com";
        var mail = EmailTemplates.PasswordReset("x@example.com", "", link, TimeSpan.FromHours(2));

        Assert.Contains("code=abc", mail.TextBody);
        Assert.Contains("2 hours", mail.TextBody);
        Assert.Contains("there", mail.HtmlBody.ToLowerInvariant());
    }
}
