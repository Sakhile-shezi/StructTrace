using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pgvector.EntityFrameworkCore;
using StructTrace.Web.Data;
using StructTrace.Web.Models;
using StructTrace.Web.Services.Email;

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
// 2. ASP.NET CORE IDENTITY + ROLES
// ==========================================
// AddRoles<IdentityRole>() is required: without it the Admin/Student rows in
// AspNetRoles are never loaded into the login cookie, so User.IsInRole("Admin")
// is always false and [Authorize(Roles = "Admin")] would block everyone.

builder.Services.AddDefaultIdentity<ApplicationUser>(options =>
{
    options.SignIn.RequireConfirmedAccount = false;
    options.User.RequireUniqueEmail = true;

    // 5 wrong passwords in a row lock the account for 5 minutes.
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
})
.AddRoles<IdentityRole>()
.AddEntityFrameworkStores<ApplicationDbContext>();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Identity/Account/Login";
    options.AccessDeniedPath = "/Identity/Account/AccessDenied";

    // Every account gets the Student role the first time it signs in
    // (this also covers brand-new registrations).
    options.Events.OnSignedIn = async context =>
    {
        var userManager = context.HttpContext.RequestServices
            .GetRequiredService<UserManager<ApplicationUser>>();

        var user = await userManager.GetUserAsync(context.Principal!);

        if (user != null && (await userManager.GetRolesAsync(user)).Count == 0)
        {
            await userManager.AddToRoleAsync(user, AppRoles.Student);
        }
    };
});

// Re-check each signed-in user against the database every minute, so that a
// locked or deleted account is signed out (and role changes apply) quickly.
builder.Services.Configure<SecurityStampValidatorOptions>(options =>
{
    options.ValidationInterval = TimeSpan.FromMinutes(1);
});

// ==========================================
// 2b. EMAIL (welcome email + password reset)
// Settings come from the "Email" section of appsettings.json and user
// secrets (see INSTALL-EMAIL.md). Emails are queued and sent in the
// background so pages never wait for the mail server.
// ==========================================

builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("Email"));
builder.Services.AddSingleton<EmailQueue>();
builder.Services.AddSingleton<SmtpEmailDelivery>();
builder.Services.AddHostedService<EmailBackgroundService>();
builder.Services.AddScoped<AppEmails>();
builder.Services.AddSingleton<IEmailSender, QueuedEmailSender>();

// Password-reset links stop working after 2 hours (default is 1 day).
builder.Services.Configure<DataProtectionTokenProviderOptions>(options =>
{
    options.TokenLifespan = TimeSpan.FromHours(2);
});

// At most 10 "forgot password" requests per 15 minutes from one address,
// so nobody can use the form to flood an inbox.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("auth-email", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));

    options.OnRejected = (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "text/plain; charset=utf-8";
        return new ValueTask(context.HttpContext.Response.WriteAsync(
            "Too many password-reset requests. Please wait 15 minutes and try again.",
            cancellationToken));
    };
});

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
// 5. ROLES AND ADMINISTRATOR ACCOUNTS
// ==========================================
// Admin e-mails come from appsettings.json ("AdminEmails": [ ... ]).
// If that setting is missing, the default list below is used.

var adminEmails = builder.Configuration.GetSection("AdminEmails").Get<string[]>()
    ?? new[] { "shezi9835@gmail.com" };

using (var scope = app.Services.CreateScope())
{
    try
    {
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        foreach (var role in AppRoles.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        foreach (var email in adminEmails)
        {
            var admin = await userManager.FindByEmailAsync(email);

            if (admin != null && !await userManager.IsInRoleAsync(admin, AppRoles.Admin))
            {
                await userManager.AddToRoleAsync(admin, AppRoles.Admin);
            }
        }

        // Existing accounts that have no role yet become Students.
        foreach (var user in await userManager.Users.ToListAsync())
        {
            if ((await userManager.GetRolesAsync(user)).Count == 0)
            {
                await userManager.AddToRoleAsync(user, AppRoles.Student);
            }
        }
    }
    catch (Exception ex)
    {
        // Do not stop the site from starting if the database is briefly unavailable.
        app.Logger.LogError(ex, "Role seeding failed. The site will start without it.");
    }
}

// ==========================================
// 6. ERROR HANDLING
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
// 7. MIDDLEWARE CONFIGURATION
// ==========================================

app.UseHttpsRedirection();

// ==========================================
// 8. PROTECT DSAVISUAL AND AIVISUAL
// Only signed-in users may open anything inside
// wwwroot/dsa-visualizer or wwwroot/ai-visualizer.
//
// This check runs BEFORE the static file server and reads the
// login cookie itself, so it works no matter where
// UseAuthentication() is placed.
// ==========================================

string[] privateFolders = { "/dsa-visualizer", "/ai-visualizer" };

bool IsPrivate(PathString path) =>
    privateFolders.Any(folder => path.StartsWithSegments(folder, StringComparison.OrdinalIgnoreCase));

app.Use(async (context, next) =>
{
    if (!IsPrivate(context.Request.Path))
    {
        await next();
        return;
    }

    // Never let a browser, proxy or back button keep a copy of a private page.
    context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, max-age=0";
    context.Response.Headers.Pragma = "no-cache";
    context.Response.Headers.Expires = "0";

    var login = await context.AuthenticateAsync(IdentityConstants.ApplicationScheme);

    if (!login.Succeeded)
    {
        // Send the visitor to the login page and bring them back afterwards
        var returnUrl =
            $"{context.Request.PathBase}" +
            $"{context.Request.Path}" +
            $"{context.Request.QueryString}";

        context.Response.Redirect(
            $"/Identity/Account/Login?ReturnUrl={Uri.EscapeDataString(returnUrl)}");
        return;
    }

    await next();
});

// Static files. Private files lose their Last-Modified/ETag headers so a
// browser has nothing to cache them with.
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = file =>
    {
        if (IsPrivate(file.Context.Request.Path))
        {
            var headers = file.Context.Response.Headers;
            headers.CacheControl = "no-store, no-cache, must-revalidate, max-age=0";
            headers.Pragma = "no-cache";
            headers.Expires = "0";
            headers.Remove("Last-Modified");
            headers.Remove("ETag");
        }
    }
});

app.UseRouting();

app.UseRateLimiter();

app.UseAuthentication();

// When a signed-out visitor loads any StructTrace page (home, login, logout,
// session check), tell the browser to delete its saved copies of this site.
// This removes DSAVisual/AIVisual pages that were cached while signed in, so
// they cannot be reopened from the cache after logging out.
app.Use(async (context, next) =>
{
    if (HttpMethods.IsGet(context.Request.Method) &&
        context.User.Identity?.IsAuthenticated != true)
    {
        context.Response.Headers["Clear-Site-Data"] = "\"cache\"";
    }

    await next();
});

app.UseAuthorization();

// ==========================================
// 9. SESSION CHECK + INSTANT LOGOUT
// /account/session is called by every DSAVisual and AIVisual page
// (wwwroot/js/visualizer-guard.js). If the user is not signed in the
// page sends them to the login page, even if it was opened from the
// browser cache or with the Back button.
// ==========================================

app.MapGet("/account/session", (HttpContext context) =>
{
    context.Response.Headers.CacheControl = "no-store";

    return context.User.Identity?.IsAuthenticated == true
        ? Results.Json(new { signedIn = true })
        : Results.Json(new { signedIn = false }, statusCode: StatusCodes.Status401Unauthorized);
});

app.MapGet("/account/instant-logout",
    async (HttpContext context, SignInManager<ApplicationUser> signInManager) =>
    {
        await signInManager.SignOutAsync();

        context.Response.Headers.CacheControl = "no-store";
        context.Response.Headers["Clear-Site-Data"] = "\"cache\"";
        return Results.Redirect("/");
    });

// ==========================================
// 10. APPLICATION ROUTES
// ==========================================

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.MapRazorPages();

// ==========================================
// 11. START APPLICATION
// ==========================================

app.Run();

// ==========================================
// ROLE NAMES
// ==========================================

public static class AppRoles
{
    public const string Admin = "Admin";
    public const string Student = "Student";

    public static readonly string[] All = { Admin, Student };
}
