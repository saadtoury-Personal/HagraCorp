using LunarNav.Api;

var builder = WebApplication.CreateBuilder(args);

var dataDir = builder.Configuration["DataDir"] ?? Path.Combine(builder.Environment.ContentRootPath, "..", "LunarNav.Web", "wwwroot", "data");

builder.Services.AddOpenApi();

builder.Services.AddSingleton(new AppData(dataDir));

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();

var api = app.MapGroup("/api");

api.MapGet("/health", (AppData data) => Results.Ok(new { status = "ok", sites = data.Sites.Count })).WithName("Health");

api.MapGet("/sites", (AppData data) => Results.Ok(data.Sites)).WithName("GetSites");

api.MapGet("/sites/{id}/mask", (string id, AppData data, int mast = 2) =>
{
    if (mast is not (2 or 10))
        return Results.BadRequest("mast must be 2 or 10");

    var site = data.FindSite(id);
    if (site is null)
        return Results.NotFound($"unknown site '{id}'");

    var mask = data.Mask(site.Id, mast);  // Changed to use site.Id for case-sensitive lookup
    if (mask is null)
        return Results.NotFound($"no horizon mask computed yet for '{id}' at {mast} m");

    return Results.Ok(mask);
}).WithName("GetSiteMask");

app.Run();
