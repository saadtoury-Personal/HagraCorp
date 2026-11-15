using LunarNav.Api;
using LunarNav.Core;

if (args is ["precompute", var demArg, var dataArg])
{
    Tools.Precompute(demArg, dataArg);
    return 0;
}
if (args is ["precompute", ..])
{
    Console.Error.WriteLine("usage: precompute <demPath> <dataDir>");
    return 1;
}
if (args is ["manifest", var manifestDir])
{
    Tools.WriteManifest(manifestDir);
    return 0;
}

var builder = WebApplication.CreateBuilder(args);

var dataDir = builder.Configuration["DataDir"] ?? Path.Combine(builder.Environment.ContentRootPath, "..", "LunarNav.Web", "wwwroot", "data");
var demPath = builder.Configuration["DemPath"] ?? Path.Combine(builder.Environment.ContentRootPath, "..", "data", "LDEM_80S_80M.IMG");

builder.Services.AddOpenApi();

var appData = new AppData(dataDir, demPath);
builder.Services.AddSingleton(appData);

builder.Services.AddSingleton(new MoonService(new HttpClient { Timeout = TimeSpan.FromSeconds(3) }, appData));

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();

app.MapOpenApi();   // the OpenAPI document is public: the demo API has no secrets

app.UseSwaggerUI(o => o.SwaggerEndpoint("/openapi/v1.json", "LunarNav API"));

app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();

app.UseCors();

var api = app.MapGroup("/api");

api.MapGet("/health", (AppData data) => Results.Ok(new { status = "ok", sites = data.Sites.Count })).WithName("Health");

api.MapGet("/about", () => Results.Ok(new
{
    precision = new[]
    {
        "Sun up = the Sun's upper edge is above the terrain (no atmosphere, so no refraction). Earth in view = any part of the Earth is visible.",
        "Sun and Earth directions match JPL Horizons within 0.006 deg.",
        "Results are for an observer 2 m (or 10 m) above one 80 m terrain pixel, not a whole region: moving a few hundred metres can change Sun % by tens of points.",
        "Percentages are good to about +-5 points; rise and set times to about +-2 h (up to +-4 h when the Sun grazes the horizon).",
        "Continuous windows bridge dark gaps of 6 h or less (batteries). Near the pole a window can still change by days for a 0.05 deg horizon change.",
    },
    sources = new[]
    {
        "NASA LOLA LDEM_80S_80M (PDS)", "JPL Horizons", "NASA Lunar Surface Data Book ACD-50044 Table A2-2", "NASA Artemis III candidate regions",
    },
})).WithName("About");

api.MapGet("/sites", (AppData data) => Results.Ok(data.Sites)).WithName("GetSites");

api.MapGet("/sites/{id}/mask", (string id, AppData data, int mast = 2) =>
{
    if (BadMast(mast) is { } bad)
        return bad;

    var site = data.FindSite(id);
    if (site is null)
        return Results.NotFound($"unknown site '{id}'");

    var mask = data.Mask(site.Id, mast);
    if (mask is null)
        return Results.NotFound($"no horizon mask computed yet for '{id}' at {mast} m");

    return Results.Ok(mask);
}).WithName("GetSiteMask");

api.MapGet("/sites/{id}/metrics", (string id, AppData data, DateTime? at, double stayDays = 14, int mast = 2) =>
{
    if (BadMast(mast) is { } bad)
        return bad;
    if (stayDays is <= 0 or > 60)
        return Results.BadRequest("stayDays must be in (0, 60]");
    var site = data.FindSite(id);
    if (site is null)
        return Results.NotFound($"unknown site '{id}'");

    return Guard(() => Results.Ok(Analysis.Metrics(data.Ephemeris, site, data.MaskOrFlat(site, mast), Utc(at), stayDays)));
}).WithName("GetSiteMetrics");

api.MapGet("/sites/{id}/timeline", (string id, AppData data, DateTime? from, int days = 30, int stepMinutes = 60, int mast = 2) =>
{
    if (BadMast(mast) is { } bad)
        return bad;
    if (days is <= 0 or > 366 || stepMinutes < 10)
        return Results.BadRequest("days must be in 1..366 and stepMinutes >= 10");
    var site = data.FindSite(id);
    if (site is null)
        return Results.NotFound($"unknown site '{id}'");

    var start = Utc(from);
    return Guard(() => Results.Ok(Analysis.Timeline(data.Ephemeris, site, data.MaskOrFlat(site, mast),
        start, start.AddDays(days), TimeSpan.FromMinutes(stepMinutes))));
}).WithName("GetSiteTimeline");

api.MapGet("/sites/{id}/export.csv", (string id, AppData data, DateTime? from, int days = 30, int mast = 2) =>
{
    if (BadMast(mast) is { } bad)
        return bad;
    if (days is <= 0 or > 366)
        return Results.BadRequest("days must be in 1..366");
    var site = data.FindSite(id);
    if (site is null)
        return Results.NotFound($"unknown site '{id}'");

    var start = Utc(from);
    return Guard(() =>
    {
        var points = Analysis.Timeline(data.Ephemeris, site, data.MaskOrFlat(site, mast), start, start.AddDays(days), TimeSpan.FromHours(1));
        var inv = System.Globalization.CultureInfo.InvariantCulture;
        var csv = new System.Text.StringBuilder()
            .AppendLine($"# LunarNav hourly series, site {site.Id} ({site.LatDeg.ToString(inv)}, {site.LonDeg.ToString(inv)}), mast {mast} m, terrain {(site.Terrain ? "NASA LOLA LDEM_80S_80M" : "none (flat horizon)")}")
            .AppendLine("# ephemeris: JPL Horizons (DE441) via ephem.csv; frame: Moon Mean Earth (ME); angles in degrees, azimuth clockwise from north; times UTC")
            .AppendLine("# rules: Sun up = upper edge above the terrain; Earth in view = any part visible; frac = visible fraction of the disk 0..1; power = index 0..1 for a vertical Sun-tracking panel")
            .AppendLine("utc,sunAzDeg,sunElDeg,sunFrac,earthAzDeg,earthElDeg,earthFrac,power");
        foreach (var p in points)
            csv.AppendLine(string.Join(',', p.T.ToString("yyyy-MM-ddTHH:mm:ssZ", inv),
                F(p.SunAz), F(p.SunEl), F(p.SunFrac), F(p.EarthAz), F(p.EarthEl), F(p.EarthFrac), F(p.Power)));
        return Results.File(System.Text.Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", $"{site.Id}_{mast}m.csv");

        string F(double v) => v.ToString("0.####", inv);
    });
}).WithName("ExportSiteCsv");

api.MapGet("/validation", (AppData data) =>
{
    var path = Path.Combine(data.DataDir, "validation.json");
    return File.Exists(path) ? Results.File(path, "application/json") : Results.NotFound("validation.json not produced yet");
}).WithName("GetValidation");

api.MapGet("/heatmap",(AppData data, int mast = 2) =>
{
    if (BadMast(mast) is { } bad)
        return bad;
    return data.Heatmap(mast) is { } heat ? Results.Ok(heat) : Results.NotFound("heatmap not computed yet");
}).WithName("GetHeatmap");

api.MapGet("/fallback", (AppData data, DateTime date, int slipWeeks = 0, double stayDays = 14, bool requireEarth = true, int mast = 2) =>
{
    if (BadMast(mast) is { } bad)
        return bad;
    if (slipWeeks is < 0 or > 52 || stayDays <= 0)
        return Results.BadRequest("slipWeeks must be in 0..52 and stayDays > 0");
    if (data.Heatmap(mast) is not { } heat)
        return Results.NotFound("heatmap not computed yet");

    var sites = heat.Sites.Select(id => data.FindSite(id)!).ToArray();
    return Guard(() => Results.Ok(Analysis.BestFallback(heat, Utc(date), slipWeeks, stayDays, requireEarth,
        longestDark: (s, at) => Analysis.LongestDarkHours(data.Ephemeris, sites[s], data.MaskOrFlat(sites[s], mast), at, stayDays))));
}).WithName("GetFallback");

api.MapPost("/custom", (CustomRequest req, AppData data) =>
{
    if (data.Dem is null)
        return Results.Problem("terrain map not loaded", statusCode: 503);
    if (req.Lat is < -89.9 or > -80.5 || req.Mast is < 1 or > 20)
        return Results.BadRequest("lat must be in [-89.9, -80.5] (south-pole map) and mast in [1, 20] m");

    var site = new Site("custom", "Custom point", req.Lat, req.Lon, "custom", "");
    return Guard(() =>
    {
        var mask = HorizonMask.Compute(data.Dem, req.Lat, req.Lon, req.Mast);
        return Results.Ok(new CustomResponse(mask, Analysis.Metrics(data.Ephemeris, site, mask, Utc(req.At), 14)));
    });
}).WithName("PostCustom");

api.MapGet("/moon", async (MoonService moon, DateTime? at, CancellationToken ct) =>
{
    try
    {
        return Results.Ok(await moon.GetAsync(Utc(at), ct));
    }
    catch (ArgumentOutOfRangeException ex)
    {
        return Results.BadRequest(ex.Message);
    }
}).WithName("GetMoon");

app.Run();
return 0;

static IResult? BadMast(int mast) => mast is 2 or 10 ? null : Results.BadRequest("mast must be 2 or 10");

// Query strings without 'Z' arrive as Unspecified: treat them as UTC, like every time in this API.
static DateTime Utc(DateTime? t) => t is null ? DateTime.UtcNow
    : t.Value.Kind == DateTimeKind.Local ? t.Value.ToUniversalTime() : DateTime.SpecifyKind(t.Value, DateTimeKind.Utc);

// Dates outside the 2026-2030 data, or a site outside the terrain map, are the caller's mistake.
static IResult Guard(Func<IResult> f)
{
    try { return f(); }
    catch (Exception ex) when (ex is ArgumentException or InvalidOperationException) { return Results.BadRequest(ex.Message); }
}

public partial class Program;   // lets the test project's WebApplicationFactory<Program> see the top-level Program class
