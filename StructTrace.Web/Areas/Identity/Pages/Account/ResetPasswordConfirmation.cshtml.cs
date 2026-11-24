using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace StructTrace.Web.Areas.Identity.Pages.Account;

/// <summary>
/// Kept for old links: a finished reset now goes straight to the sign-in
/// page with a "password changed" message.
/// </summary>
[AllowAnonymous]
public class ResetPasswordConfirmationModel : PageModel
{
    public IActionResult OnGet()
    {
        TempData["StatusMessage"] = "Your password has been changed. Sign in with your new password.";
        return RedirectToPage("./Login");
    }
}
