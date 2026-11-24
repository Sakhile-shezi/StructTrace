using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.Extensions.Options;
using StructTrace.Web.Models;

namespace StructTrace.Web.Services.Email;

/// <summary>
/// The emails StructTrace sends. Pages call these methods; the messages are
/// queued and delivered in the background by <see cref="EmailBackgroundService"/>.
/// </summary>
public sealed class AppEmails
{
    private readonly EmailQueue _queue;
    private readonly IOptions<DataProtectionTokenProviderOptions> _tokenOptions;

    public AppEmails(EmailQueue queue, IOptions<DataProtectionTokenProviderOptions> tokenOptions)
    {
        _queue = queue;
        _tokenOptions = tokenOptions;
    }

    public ValueTask SendWelcomeAsync(ApplicationUser user, string siteUrl) =>
        _queue.EnqueueAsync(EmailTemplates.Welcome(user.Email!, user.DisplayName, siteUrl));

    public ValueTask SendPasswordResetAsync(ApplicationUser user, string resetUrl) =>
        _queue.EnqueueAsync(EmailTemplates.PasswordReset(user.Email!, user.DisplayName, resetUrl, _tokenOptions.Value.TokenLifespan));

    public ValueTask SendPasswordChangedAsync(ApplicationUser user, string siteUrl) =>
        _queue.EnqueueAsync(EmailTemplates.PasswordChanged(user.Email!, user.DisplayName, siteUrl));
}


/// <summary>
/// Identity's built-in pages (change email, confirm email, ...) send mail through
/// IEmailSender. This puts those emails in the same queue and layout.
/// </summary>
public sealed class QueuedEmailSender : IEmailSender
{
    private readonly EmailQueue _queue;

    public QueuedEmailSender(EmailQueue queue)
    {
        _queue = queue;
    }

    public Task SendEmailAsync(string email, string subject, string htmlMessage) =>
        _queue.EnqueueAsync(EmailTemplates.Generic(email, subject, htmlMessage)).AsTask();
}
