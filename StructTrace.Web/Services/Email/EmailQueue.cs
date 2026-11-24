using System.Threading.Channels;

namespace StructTrace.Web.Services.Email;

/// <summary>One email waiting to be delivered.</summary>
public sealed record EmailMessage(
    string ToAddress,
    string? ToName,
    string Subject,
    string HtmlBody,
    string TextBody);


/// <summary>
/// In-memory queue between the pages that ask for an email and the
/// background service that delivers it. Pages never wait for the mail
/// server, so a slow or failing SMTP server cannot slow down Register or
/// reveal (through timing) whether an email address has an account.
/// </summary>
public sealed class EmailQueue
{
    private readonly Channel<EmailMessage> _channel =
        Channel.CreateBounded<EmailMessage>(new BoundedChannelOptions(500)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true
        });

    public ValueTask EnqueueAsync(EmailMessage message, CancellationToken cancellationToken = default) =>
        _channel.Writer.WriteAsync(message, cancellationToken);

    public IAsyncEnumerable<EmailMessage> ReadAllAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}
