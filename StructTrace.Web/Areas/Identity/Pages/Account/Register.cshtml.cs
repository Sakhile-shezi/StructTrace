using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using StructTrace.Web.Models;
using StructTrace.Web.Services.Email;

namespace StructTrace.Web.Areas.Identity.Pages.Account;

[AllowAnonymous]
public class RegisterModel : PageModel
{
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppEmails _emails;
    private readonly ILogger<RegisterModel> _logger;

    public RegisterModel(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        AppEmails emails,
        ILogger<RegisterModel> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _emails = emails;
        _logger = logger;
    }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public string ReturnUrl { get; set; } = "/";

    public class InputModel
    {
        [Required(ErrorMessage = "Enter your full name.")]
        [StringLength(80, MinimumLength = 2, ErrorMessage = "Your name must be 2 to 80 characters long.")]
        [Display(Name = "Full name")]
        public string FullName { get; set; } = "";

        [Required(ErrorMessage = "Enter your email address.")]
        [EmailAddress(ErrorMessage = "Enter a valid email address.")]
        [Display(Name = "Email address")]
        public string Email { get; set; } = "";

        [Required(ErrorMessage = "Choose a password.")]
        [StringLength(100, MinimumLength = 6, ErrorMessage = "Your password must be at least {2} characters long.")]
        [DataType(DataType.Password)]
        [Display(Name = "Password")]
        public string Password { get; set; } = "";

        [Required(ErrorMessage = "Type your password again.")]
        [DataType(DataType.Password)]
        [Display(Name = "Confirm password")]
        [Compare(nameof(Password), ErrorMessage = "The two passwords do not match.")]
        public string ConfirmPassword { get; set; } = "";
    }

    public void OnGet(string? returnUrl = null)
    {
        ReturnUrl = SafeReturnUrl(returnUrl);
    }

    public async Task<IActionResult> OnPostAsync(string? returnUrl = null)
    {
        ReturnUrl = SafeReturnUrl(returnUrl);

        if (!ModelState.IsValid)
        {
            return Page();
        }

        var email = Input.Email.Trim();

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            DisplayName = Input.FullName.Trim(),
            JoinedAtUtc = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, Input.Password);

        if (!result.Succeeded)
        {
            var duplicateShown = false;

            foreach (var error in result.Errors)
            {
                if (error.Code is "DuplicateUserName" or "DuplicateEmail")
                {
                    // Identity reports both codes for the same email: show one message.
                    if (!duplicateShown)
                    {
                        ModelState.AddModelError($"{nameof(Input)}.{nameof(InputModel.Email)}",
                            "An account with this email already exists. Sign in, or use “Forgot password?” on the sign-in page.");
                        duplicateShown = true;
                    }
                }
                else if (error.Code.StartsWith("Password", StringComparison.Ordinal))
                {
                    ModelState.AddModelError($"{nameof(Input)}.{nameof(InputModel.Password)}", error.Description);
                }
                else
                {
                    ModelState.AddModelError(string.Empty, error.Description);
                }
            }

            return Page();
        }

        _logger.LogInformation("New account created for {Email}.", email);

        // New accounts are students. (Program.cs also does this on first sign-in.)
        if (await _userManager.IsInRoleAsync(user, AppRoles.Student) is false)
        {
            await _userManager.AddToRoleAsync(user, AppRoles.Student);
        }

        // The welcome email is queued and sent in the background,
        // so registration never waits for (or fails because of) the mail server.
        await _emails.SendWelcomeAsync(user, SiteUrl());

        await _signInManager.SignInAsync(user, isPersistent: false);
        return LocalRedirect(ReturnUrl);
    }

    private string SiteUrl() => $"{Request.Scheme}://{Request.Host}{Request.PathBase}";

    private string SafeReturnUrl(string? returnUrl) =>
        !string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl) ? returnUrl : Url.Content("~/");
}
