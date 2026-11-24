namespace StructTrace.Web.Services.Email;

/// <summary>
/// Sends queued emails one at a time. A failed send is retried twice
/// (after 5 and 20 seconds) and then logged, so one bad email never
/// stops the others.
/// </summary>
public sealed class EmailBackgroundService : BackgroundService
{
    private static readonly TimeSpan[] RetryDelays = { TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(20) };

    private readonly EmailQueue _queue;
    private readonly SmtpEmailDelivery _delivery;
    private readonly ILogger<EmailBackgroundService> _logger;

    public EmailBackgroundService(
        EmailQueue queue,
        SmtpEmailDelivery delivery,
        ILogger<EmailBackgroundService> logger)
    {
        _queue = queue;
        _delivery = delivery;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var email in _queue.ReadAllAsync(stoppingToken))
        {
            for (var attempt = 0; ; attempt++)
            {
                try
                {
                    await _delivery.DeliverAsync(email, stoppingToken);
                    break;
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex) when (attempt < RetryDelays.Length)
                {
                    _logger.LogWarning(ex, "Sending \"{Subject}\" to {Recipient} failed (attempt {Attempt}); retrying.",
                        email.Subject, email.ToAddress, attempt + 1);
                    await Task.Delay(RetryDelays[attempt], stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Giving up on \"{Subject}\" to {Recipient}. Check the Email settings.",
                        email.Subject, email.ToAddress);
                    break;
                }
            }
        }
    }
}
