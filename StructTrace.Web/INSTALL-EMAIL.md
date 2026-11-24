# StructTrace: new sign-in pages, password reset and welcome email

## 1. Copy the files into your project

| From the zip | What it is |
|---|---|
| `Program.cs` | Replaces yours. Adds email sending, 2-hour reset links, account lockout (5 wrong passwords → 5 minutes) and a limit on reset requests. |
| `Services/Email/` (new folder) | Email settings, queue, SMTP sender and the email designs. |
| `Areas/Identity/Pages/Account/` | Replaces your `Login` and `Register` pages and adds `ForgotPassword`, `ForgotPasswordConfirmation`, `ResetPassword`, `ResetPasswordConfirmation`, `_AuthAside` and `_PasswordRules`. `_ViewImports` and `_ViewStart` are your own, unchanged. |
| `wwwroot/css/structtrace-auth.css`, `wwwroot/js/structtrace-auth.js` | Styles and small scripts for those pages (the old inline `<style>` blocks are gone). |

No database migration is needed. No NuGet package is needed (it uses .NET's built-in SMTP client).

## 2. Add the Email settings

Add this section to `appsettings.json`. **Do not put the password here.**

```json
"Email": {
  "Host": "smtp.gmail.com",
  "Port": 587,
  "EnableSsl": true,
  "UserName": "",
  "Password": "",
  "FromAddress": "",
  "FromName": "StructTrace"
}
```

## 3. Gmail: create an App Password

Gmail does not accept your normal password from apps.

1. Open your Google Account → **Security** → turn on **2-Step Verification**.
2. Search the account settings for **App passwords**, create one called `StructTrace`, and copy the 16-letter code.
3. In Visual Studio, right-click the project → **Manage User Secrets**, and add:

```json
{
  "Email:UserName": "shezi9835@gmail.com",
  "Email:Password": "the 16-letter app password",
  "Email:FromAddress": "shezi9835@gmail.com"
}
```

(Command-line alternative: `dotnet user-secrets set "Email:Password" "xxxx xxxx xxxx xxxx"`.)

User secrets stay on your computer and are never committed to Git. When you deploy, set the same values as environment variables: `Email__UserName`, `Email__Password`, `Email__FromAddress`.

Port **587** is required. The .NET mail client cannot use port 465.

## 4. Testing without a mail account

If `UserName`/`Password` are empty and you run in **Development**, emails are not sent. They are saved as `.eml` files in `App_Data/outbox` instead. Double-click one to open it in Outlook or Mail, and click the link inside. Add `App_Data/` to `.gitignore`.

To always save instead of sending, set `"PickupDirectory": "C:\\temp\\mail"` in the Email section.

## 5. What users get

- **Register:** asks for full name, email and password (with a live checklist of the password rules), signs the user in, and sends a **Welcome to StructTrace** email.
- **Sign in:** "Forgot password?" link, Show/Hide password, Caps Lock warning. After 5 wrong passwords the account is locked for 5 minutes. Accounts locked from the Admin dashboard get their own message.
- **Forgot password:** emails a reset link to any registered address. The page says the same thing whether or not the address has an account, so it cannot be used to find out who is registered. Limited to 10 requests per 15 minutes from one network address.
- **Reset password:** the link works once and expires after 2 hours. After the reset, the user is told to sign in, the email is filled in for them, any lockout is cleared, and a **Your password was changed** email is sent.

Emails are queued and sent in the background, so a slow mail server never slows the pages down. A failed send is retried twice and then written to the log.

## 6. If emails do not arrive

- Look at the Visual Studio **Output** window (or the console). Each email logs either "sent", "saved in …" or an error.
- `5.7.0 Authentication Required` / `Username and Password not accepted`: the App Password or username is wrong, or 2-Step Verification is off.
- Check the recipient's Spam folder. Messages sent from a personal Gmail account to many people can be marked as spam. A service such as Brevo or SendGrid also works: put its SMTP host, port 587, username and key in the same settings.
