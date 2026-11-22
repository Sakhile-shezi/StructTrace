
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.EntityFrameworkCore;
using Pgvector.EntityFrameworkCore;
using StructTrace.Web.Data;
using StructTrace.Web.Models;

var builder = WebApplication.CreateBuilder(args);

// ==========================================
// 1. DATABASE CONFIGURATION - NEON POSTGRESQL
// ==========================================

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "Connection string 'DefaultConnection' not found.");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString, o => o.UseVector()));

builder.Services.AddDatabaseDeveloperPageExceptionFilter();

// ==========================================
// 2. ASP.NET CORE IDENTITY
// ==========================================

builder.Services.AddDefaultIdentity<ApplicationUser>(options =>
{
    options.SignIn.RequireConfirmedAccount = false;
})
.AddEntityFrameworkStores<ApplicationDbContext>();

builder.Services.AddSingleton<IEmailSender, NoOpEmailSender>();

// ==========================================
// 3. MVC AND RAZOR PAGES
// ==========================================

builder.Services.AddControllersWithViews();
builder.Services.AddRazorPages();

// ==========================================
// 4. BUILD APPLICATION
// ==========================================

var app = builder.Build();

// ==========================================
// 5. ERROR HANDLING
// ==========================================

if (app.Environment.IsDevelopment())
{
    app.UseMigrationsEndPoint();
}
else
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

// ==========================================
// 6. MIDDLEWARE CONFIGURATION
// ==========================================

app.UseHttpsRedirection();

app.UseRouting();

app.UseAuthentication();

// ==========================================
// 7. PROTECT DSAVISUAL
// Require users to sign in before accessing
// files inside wwwroot/dsa-visualizer
// ==========================================

app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/dsa-visualizer"))
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            // Preserve the requested DSAVisual URL
            var returnUrl =
                $"{context.Request.PathBase}" +
                $"{context.Request.Path}" +
                $"{context.Request.QueryString}";

            // Redirect visitors to the login page
            var loginUrl =
                $"/Identity/Account/Login?ReturnUrl={Uri.EscapeDataString(returnUrl)}";

            context.Response.Redirect(loginUrl);
            return;
        }
    }

    await next();
});

// Serve static files after the DSAVisual authentication check
app.UseStaticFiles();

app.UseAuthorization();

// ==========================================
// 8. INSTANT LOGOUT FOR DSAVISUAL
// ==========================================

app.MapGet("/account/instant-logout",
    async (SignInManager<ApplicationUser> signInManager) =>
    {
        await signInManager.SignOutAsync();

        return Results.Redirect("/");
    });


// 9. APPLICATION ROUTES


app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.MapRazorPages();

// ==========================================
// 10. START APPLICATION
// ==========================================

app.Run();

// ==========================================
// EMAIL SENDER
// ==========================================

public sealed class NoOpEmailSender : IEmailSender
{
    public Task SendEmailAsync(
        string email,
        string subject,
        string htmlMessage)
        => Task.CompletedTask;
}
