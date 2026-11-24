using System.IO.Compression;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Pgvector.EntityFrameworkCore;
using StructTrace.Web.Data;
using StructTrace.Web.Endpoints;
using StructTrace.Web.Models;
using StructTrace.Web.Services.Email;
using StructTrace.Web.Services.Progress;
using StructTrace.Web.Services.Search;

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

    // The JSON API answers 401/403 instead of sending the caller to the login page.
    options.Events.OnRedirectToLogin = context =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        }
        else
        {
            context.Response.Redirect(context.RedirectUri);
        }
        return Task.CompletedTask;
    };

    options.Events.OnRedirectToAccessDenied = context =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
        }
        else
        {
            context.Response.Redirect(context.RedirectUri);
        }
        return Task.CompletedTask;
    };

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

    // The JSON API: 120 requests a minute for each signed-in user.
    options.AddPolicy(StructTraceApi.RateLimitPolicy, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? context.Connection.RemoteIpAddress?.ToString()
                ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.OnRejected = (context, cancellationToken) =>
    {
        var response = context.HttpContext.Response;

        if (context.HttpContext.Request.Path.StartsWithSegments("/api"))
        {
            return new ValueTask(response.WriteAsJsonAsync(
                new { message = "Too many requests. Please wait a minute and try again." },
                cancellationToken));
        }

        response.ContentType = "text/plain; charset=utf-8";
        return new ValueTask(response.WriteAsync(
            "Too many password-reset requests. Please wait 15 minutes and try again.",
            cancellationToken));
    };
});

// ==========================================
// 2c. ACCOUNT-SYNCED PROGRESS + SITE SEARCH (pgvector)
// Progress: /api/progress keeps AIVisual and DSAVisual progress in the
// StudyProgress table, so it follows the student to every device.
// Search: SearchIndexer reads every topic page at start-up and stores
// one 384-number vector per section in SearchDocuments (and fills
// Lessons.Embedding); /api/search finds the nearest ones with pgvector.
// ==========================================

builder.Services.AddScoped<IProgressStore, EfProgressStore>();
builder.Services.AddSingleton<SearchCatalog>();
builder.Services.AddHostedService<SearchIndexer>();
builder.Services.AddScoped<SiteSearchService>();

// ==========================================
// 2d. COMPRESSION FOR STATIC FILES
// The visualizer pages, scripts and styles are sent compressed (Brotli or
// gzip), which makes them roughly 4-6 times smaller. Pages that contain
// security tokens (forms, account pages) are deliberately NOT compressed
// (see section 7), which protects them from BREACH-style attacks.
// ==========================================

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[] { "image/svg+xml" });
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

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

// Compress static content only (see 2d).
string[] compressedFolders = { "/dsa-visualizer", "/ai-visualizer", "/css", "/js", "/lib" };

app.UseWhen(
    context => compressedFolders.Any(folder =>
        context.Request.Path.StartsWithSegments(folder, StringComparison.OrdinalIgnoreCase)),
    branch => branch.UseResponseCompression());

// Old DSAVisual addresses (/dsa-visualizer/module-01-...) go to the new
// ones (/dsa-visualizer/topic-01-...). See Endpoints/LegacyUrls.cs.
app.UseLegacyUrlRedirects();

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
// browser has nothing to cache them with. Shared styles and scripts that are
// requested with a version (?v=...) may be kept for a day: change the version
// number in the page whenever you change the file.
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = file =>
    {
        var headers = file.Context.Response.Headers;

        if (IsPrivate(file.Context.Request.Path))
        {
            headers.CacheControl = "no-store, no-cache, must-revalidate, max-age=0";
            headers.Pragma = "no-cache";
            headers.Expires = "0";
            headers.Remove("Last-Modified");
            headers.Remove("ETag");
        }
        else if (file.Context.Request.Query.ContainsKey("v"))
        {
            headers.CacheControl = "public, max-age=86400";
        }
    }
});

app.UseRouting();

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

// After authentication, so the API limit can count requests per user.
app.UseRateLimiter();

// ==========================================
// 9. SESSION CHECK + INSTANT LOGOUT
// /account/session is called by every DSAVisual and AIVisual page
// (wwwroot/js/visualizer-guard.js). If the user is not signed in the
// page sends them to the login page, even if it was opened from the
// browser cache or with the Back button. When they are signed in, it
// also returns the name, initials and Admin flag that the shared
// StructTrace top bar shows on those pages.
// ==========================================

app.MapGet("/account/session",
    async (HttpContext context, UserManager<ApplicationUser> userManager) =>
    {
        context.Response.Headers.CacheControl = "no-store";

        var user = context.User.Identity?.IsAuthenticated == true
            ? await userManager.GetUserAsync(context.User)
            : null;

        if (user == null)
        {
            return Results.Json(new { signedIn = false }, statusCode: StatusCodes.Status401Unauthorized);
        }

        return Results.Json(new
        {
            signedIn = true,
            name = UserDisplay.Name(user.DisplayName, user.Email),
            initials = UserDisplay.Initials(user.DisplayName, user.Email),
            nameMissing = string.IsNullOrWhiteSpace(user.DisplayName),
            isAdmin = context.User.IsInRole(AppRoles.Admin),
            uid = StructTraceApi.UserHash(user.Id)
        });
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

app.MapStructTraceApi();

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
