using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using StructTrace.Web.Models;

namespace StructTrace.Web.Areas.Identity.Pages.Account;

[AllowAnonymous]
public class LoginModel : PageModel
{
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<LoginModel> _logger;

    public LoginModel(
        SignInManager<ApplicationUser> signInManager,
        UserManager<ApplicationUser> userManager,
        ILogger<LoginModel> logger)
    {
        _signInManager = signInManager;
        _userManager = userManager;
        _logger = logger;
    }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public string ReturnUrl { get; set; } = "/";

    /// <summary>Error passed from another page (e.g. external login failures).</summary>
    [TempData]
    public string? ErrorMessage { get; set; }

    /// <summary>Success message, e.g. after a password reset.</summary>
    [TempData]
    public string? StatusMessage { get; set; }

    public class InputModel
    {
        [Required(ErrorMessage = "Enter your email address.")]
        [EmailAddress(ErrorMessage = "Enter a valid email address.")]
        [Display(Name = "Email address")]
        public string Email { get; set; } = "";

        [Required(ErrorMessage = "Enter your password.")]
        [DataType(DataType.Password)]
        [Display(Name = "Password")]
        public string Password { get; set; } = "";

        [Display(Name = "Keep me signed in on this device")]
        public bool RememberMe { get; set; }
    }

    public async Task OnGetAsync(string? returnUrl = null, string? email = null)
    {
        if (!string.IsNullOrEmpty(ErrorMessage))
        {
            ModelState.AddModelError(string.Empty, ErrorMessage);
        }

        if (!string.IsNullOrWhiteSpace(email))
        {
            Input.Email = email;
        }

        ReturnUrl = SafeReturnUrl(returnUrl);

        // Clear any half-finished external sign-in.
        await HttpContext.SignOutAsync(IdentityConstants.ExternalScheme);
    }

    public async Task<IActionResult> OnPostAsync(string? returnUrl = null)
    {
        ReturnUrl = SafeReturnUrl(returnUrl);

        if (!ModelState.IsValid)
        {
            return Page();
        }

        // lockoutOnFailure: true -> after 5 wrong passwords the account is locked
        // for 5 minutes (settings in Program.cs).
        var result = await _signInManager.PasswordSignInAsync(
            Input.Email.Trim(),
            Input.Password,
            Input.RememberMe,
            lockoutOnFailure: true);

        if (result.Succeeded)
        {
            _logger.LogInformation("User {Email} signed in.", Input.Email);
            return LocalRedirect(ReturnUrl);
        }

        if (result.RequiresTwoFactor)
        {
            return RedirectToPage("./LoginWith2fa", new { ReturnUrl, Input.RememberMe });
        }

        if (result.IsLockedOut)
        {
            _logger.LogWarning("Locked account {Email} tried to sign in.", Input.Email);
            ModelState.AddModelError(string.Empty, await LockoutMessageAsync());
            return Page();
        }

        ModelState.AddModelError(string.Empty, "That email and password do not match. Check them and try again.");
        return Page();
    }

    private async Task<string> LockoutMessageAsync()
    {
        var user = await _userManager.FindByEmailAsync(Input.Email.Trim());
        var end = user?.LockoutEnd;

        // The admin dashboard locks accounts "forever" (DateTimeOffset.MaxValue).
        if (end.HasValue && end.Value > DateTimeOffset.UtcNow.AddYears(1))
        {
            return "This account has been locked by an administrator. Contact them to have it unlocked.";
        }

        var minutes = end.HasValue
            ? Math.Max(1, (int)Math.Ceiling((end.Value - DateTimeOffset.UtcNow).TotalMinutes))
            : 5;

        return $"Too many wrong passwords. Try again in {minutes} minute{(minutes == 1 ? "" : "s")}, or reset your password.";
    }

    private string SafeReturnUrl(string? returnUrl) =>
        !string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl) ? returnUrl : Url.Content("~/");
}
