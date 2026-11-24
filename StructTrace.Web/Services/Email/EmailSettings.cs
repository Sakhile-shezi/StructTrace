namespace StructTrace.Web.Services.Email;

/// <summary>
/// The "Email" section of appsettings.json / user secrets.
///
/// Gmail example (needs 2-Step Verification and an App Password):
///   Host = smtp.gmail.com, Port = 587, EnableSsl = true,
///   UserName = your Gmail address, Password = the 16-letter App Password,
///   FromAddress = the same Gmail address.
///
/// Port 587 (STARTTLS) is required: the .NET SMTP client cannot use port 465.
/// Keep the password out of appsettings.json - store it with:
///   dotnet user-secrets set "Email:Password" "your-app-password"
/// </summary>
public sealed class EmailSettings
{
    public string Host { get; set; } = "";

    public int Port { get; set; } = 587;

    public bool EnableSsl { get; set; } = true;

    public string UserName { get; set; } = "";

    public string Password { get; set; } = "";

    public string FromAddress { get; set; } = "";

    public string FromName { get; set; } = "StructTrace";

    /// <summary>
    /// Optional. When set, emails are written to this folder as .eml files
    /// instead of being sent. Handy for testing without a mail account.
    /// </summary>
    public string? PickupDirectory { get; set; }

    public bool CanSend =>
        !string.IsNullOrWhiteSpace(Host) &&
        !string.IsNullOrWhiteSpace(UserName) &&
        !string.IsNullOrWhiteSpace(Password);

    public string SenderAddress =>
        string.IsNullOrWhiteSpace(FromAddress) ? UserName : FromAddress;
}
