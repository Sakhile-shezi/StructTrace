using System.ComponentModel.DataAnnotations;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.WebUtilities;
using StructTrace.Web.Models;
using StructTrace.Web.Services.Email;

namespace StructTrace.Web.Areas.Identity.Pages.Account;

[AllowAnonymous]
[EnableRateLimiting("auth-email")]
public class ForgotPasswordModel : PageModel
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppEmails _emails;
    private readonly ILogger<ForgotPasswordModel> _logger;

    public ForgotPasswordModel(
        UserManager<ApplicationUser> userManager,
        AppEmails emails,
        ILogger<ForgotPasswordModel> logger)
    {
        _userManager = userManager;
        _emails = emails;
        _logger = logger;
    }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public class InputModel
    {
        [Required(ErrorMessage = "Enter the email address you signed up with.")]
        [EmailAddress(ErrorMessage = "Enter a valid email address.")]
        [Display(Name = "Email address")]
        public string Email { get; set; } = "";
    }

    public void OnGet(string? email = null)
    {
        if (!string.IsNullOrWhiteSpace(email))
        {
            Input.Email = email;
        }
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            return Page();
        }

        var email = Input.Email.Trim();
        var user = await _userManager.FindByEmailAsync(email);

        // The default Identity page only emails accounts whose address is marked
        // "confirmed". StructTrace never asked users to confirm (RequireConfirmedAccount
        // is false), so that check is left out here - otherwise nobody gets the email.
        if (user != null)
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var code = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

            var resetUrl = Url.Page(
                "/Account/ResetPassword",
                pageHandler: null,
                values: new { area = "Identity", code },
                protocol: Request.Scheme)!;

            await _emails.SendPasswordResetAsync(user, resetUrl);
            _logger.LogInformation("Password reset email queued for {Email}.", email);
        }
        else
        {
            _logger.LogInformation("Password reset requested for unknown email {Email}.", email);
        }

        // Same answer either way, so the form cannot be used to find out who has an account.
        return RedirectToPage("./ForgotPasswordConfirmation", new { email });
    }
}
