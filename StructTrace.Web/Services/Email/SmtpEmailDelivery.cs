using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.Extensions.Options;

namespace StructTrace.Web.Services.Email;

/// <summary>
/// Delivers one email.
///   1. Email:PickupDirectory set      -> writes an .eml file there.
///   2. Host, UserName and Password set -> sends through SMTP.
///   3. Nothing configured              -> in Development, writes an .eml file to
///                                         App_Data/outbox; otherwise logs a warning.
/// </summary>
public sealed class SmtpEmailDelivery
{
    private readonly IOptionsMonitor<EmailSettings> _settings;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<SmtpEmailDelivery> _logger;

    public SmtpEmailDelivery(
        IOptionsMonitor<EmailSettings> settings,
        IWebHostEnvironment environment,
        ILogger<SmtpEmailDelivery> logger)
    {
        _settings = settings;
        _environment = environment;
        _logger = logger;
    }

    public async Task DeliverAsync(EmailMessage email, CancellationToken cancellationToken)
    {
        var settings = _settings.CurrentValue;

        var pickup = settings.PickupDirectory;
        if (string.IsNullOrWhiteSpace(pickup) && !settings.CanSend && _environment.IsDevelopment())
        {
            pickup = Path.Combine(_environment.ContentRootPath, "App_Data", "outbox");
        }

        if (string.IsNullOrWhiteSpace(pickup) && !settings.CanSend)
        {
            _logger.LogWarning(
                "Email is not configured, so \"{Subject}\" to {Recipient} was not sent. " +
                "Fill in the Email section (see INSTALL-EMAIL.md).",
                email.Subject, email.ToAddress);
            return;
        }

        var fromAddress = string.IsNullOrWhiteSpace(settings.SenderAddress)
            ? "no-reply@structtrace.local"
            : settings.SenderAddress;

        using var message = new MailMessage
        {
            From = new MailAddress(fromAddress, settings.FromName, Encoding.UTF8),
            Subject = email.Subject,
            SubjectEncoding = Encoding.UTF8,
            BodyEncoding = Encoding.UTF8
        };

        message.To.Add(string.IsNullOrWhiteSpace(email.ToName)
            ? new MailAddress(email.ToAddress)
            : new MailAddress(email.ToAddress, email.ToName, Encoding.UTF8));

        // Plain text first, HTML last: mail apps show the last version they understand.
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(email.TextBody, Encoding.UTF8, "text/plain"));
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(email.HtmlBody, Encoding.UTF8, "text/html"));

        using var client = new SmtpClient();

        if (!string.IsNullOrWhiteSpace(pickup))
        {
            Directory.CreateDirectory(pickup);
            client.DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory;
            client.PickupDirectoryLocation = pickup;
        }
        else
        {
            client.Host = settings.Host;
            client.Port = settings.Port;
            client.EnableSsl = settings.EnableSsl;
            client.DeliveryMethod = SmtpDeliveryMethod.Network;
            client.UseDefaultCredentials = false;
            client.Credentials = new NetworkCredential(settings.UserName, settings.Password);
            client.Timeout = 30_000;
        }

        await client.SendMailAsync(message, cancellationToken);

        if (!string.IsNullOrWhiteSpace(pickup))
        {
            _logger.LogInformation("Email \"{Subject}\" to {Recipient} saved in {Folder}.",
                email.Subject, email.ToAddress, pickup);
        }
        else
        {
            _logger.LogInformation("Email \"{Subject}\" sent to {Recipient}.", email.Subject, email.ToAddress);
        }
    }
}
