using System.ComponentModel.DataAnnotations;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.WebUtilities;
using StructTrace.Web.Models;
using StructTrace.Web.Services.Email;

namespace StructTrace.Web.Areas.Identity.Pages.Account;

[AllowAnonymous]
public class ResetPasswordModel : PageModel
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppEmails _emails;
    private readonly ILogger<ResetPasswordModel> _logger;

    public ResetPasswordModel(
        UserManager<ApplicationUser> userManager,
        AppEmails emails,
        ILogger<ResetPasswordModel> logger)
    {
        _userManager = userManager;
        _emails = emails;
        _logger = logger;
    }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    /// <summary>True when the link is missing its code or the code is unreadable.</summary>
    public bool LinkIsBroken { get; set; }

    /// <summary>True when the code was rejected (expired, already used or for another account).</summary>
    public bool LinkExpired { get; set; }

    public class InputModel
    {
        [Required(ErrorMessage = "Enter the email address of your account.")]
        [EmailAddress(ErrorMessage = "Enter a valid email address.")]
        [Display(Name = "Email address")]
        public string Email { get; set; } = "";

        [Required(ErrorMessage = "Choose a new password.")]
        [StringLength(100, MinimumLength = 6, ErrorMessage = "Your password must be at least {2} characters long.")]
        [DataType(DataType.Password)]
        [Display(Name = "New password")]
        public string Password { get; set; } = "";

        [Required(ErrorMessage = "Type the new password again.")]
        [DataType(DataType.Password)]
        [Display(Name = "Confirm new password")]
        [Compare(nameof(Password), ErrorMessage = "The two passwords do not match.")]
        public string ConfirmPassword { get; set; } = "";

        [Required]
        public string Code { get; set; } = "";
    }

    public IActionResult OnGet(string? code = null)
    {
        var token = Decode(code);

        if (token == null)
        {
            LinkIsBroken = true;
            return Page();
        }

        Input.Code = token;
        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (string.IsNullOrEmpty(Input.Code))
        {
            LinkIsBroken = true;
            return Page();
        }

        if (!ModelState.IsValid)
        {
            return Page();
        }

        var user = await _userManager.FindByEmailAsync(Input.Email.Trim());

        if (user == null)
        {
            // Do not reveal that the email has no account.
            LinkExpired = true;
            return Page();
        }

        var result = await _userManager.ResetPasswordAsync(user, Input.Code, Input.Password);

        if (result.Succeeded)
        {
            // A successful reset also clears the "too many wrong passwords" lock.
            await _userManager.ResetAccessFailedCountAsync(user);
            if (user.LockoutEnd.HasValue && user.LockoutEnd.Value < DateTimeOffset.UtcNow.AddYears(1))
            {
                await _userManager.SetLockoutEndDateAsync(user, null);
            }

            await _emails.SendPasswordChangedAsync(user, $"{Request.Scheme}://{Request.Host}{Request.PathBase}");
            _logger.LogInformation("Password reset for {Email}.", user.Email);

            TempData["StatusMessage"] = "Your password has been changed. Sign in with your new password.";
            return RedirectToPage("./Login", new { email = user.Email });
        }

        foreach (var error in result.Errors)
        {
            if (error.Code == "InvalidToken")
            {
                LinkExpired = true;
            }
            else
            {
                ModelState.AddModelError($"{nameof(Input)}.{nameof(InputModel.Password)}", error.Description);
            }
        }

        return Page();
    }

    private static string? Decode(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        try
        {
            return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(code));
        }
        catch (FormatException)
        {
            return null;
        }
    }
}
