using System.Net;
using System.Net.Http.Json;
using Xunit;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Hosting;
using LunarNav.Core;

namespace LunarNav.Tests;

public class ApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(b => b.UseSetting("DataDir", FindDataDir()).UseSetting("DemPath", "no-such-file.img")).CreateClient();
    }

    internal static string FindDataDir()
    {
        // Tests run from bin/ so the data folder is found by walking up through parent directories
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "LunarNav.Web", "wwwroot", "data", "sites.json")))
        {
            dir = dir.Parent;
        }
        return dir is null
            ? throw new DirectoryNotFoundException("LunarNav.Web/wwwroot/data not found")
            : Path.Combine(dir.FullName, "LunarNav.Web", "wwwroot", "data");
    }

    [Fact]
    public async Task Health_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Sites_ContainsApollo11WithoutTerrain()
    {
        var sites = await _client.GetFromJsonAsync<List<Site>>("/api/sites");
        Assert.NotNull(sites);
        var apollo = Assert.Single(sites, s => s.Id == "apollo11");
        Assert.False(apollo.Terrain);
    }

    [Fact]
    public async Task Mask_InvalidMast_Returns400()
    {
        var response = await _client.GetAsync("/api/sites/haworth/mask?mast=5");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Mask_UnknownSite_Returns404()
    {
        var response = await _client.GetAsync("/api/sites/nope/mask?mast=2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task About_ListsPrecision()
    {
        var res = await _client.GetAsync("/api/about");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Contains("80 m terrain pixel", await res.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task About_RulesMatchTheCodeAndAreLabelled()
    {
        using var doc = System.Text.Json.JsonDocument.Parse(await _client.GetStringAsync("/api/about"));
        var rules = doc.RootElement.GetProperty("rules").GetProperty("rules").EnumerateArray().ToList();

        Assert.All(rules, r => Assert.Contains(r.GetProperty("status").GetString(), new[] { "assumed", "validated" }));
        Assert.All(rules, r => Assert.False(string.IsNullOrWhiteSpace(r.GetProperty("source").GetString())));
        // rules.json is what the app shows; it must not drift from the constants the analysis really uses.
        double Value(string id) => rules.Single(r => r.GetProperty("id").GetString() == id).GetProperty("value").GetDouble();
        Assert.Equal(Analysis.ViperMaxDarkHours, Value("viperMaxDarkHours"));
        Assert.Equal(Analysis.MaxGapHours, Value("maxGapHours"));
    }

    [Fact]
    public async Task Metrics_Apollo11_ReturnsSiteMetrics()
    {
        var m = await _client.GetFromJsonAsync<SiteMetrics>("/api/sites/apollo11/metrics?at=2027-01-01T06:00:00Z&stayDays=14");
        Assert.NotNull(m);
        Assert.InRange(m.SunPct, 0, 100);
        Assert.Equal(100, m.EarthPct);   // near side, flat horizon: Earth always in view
    }

    [Fact]
    public async Task Metrics_DateOutsideData_Returns400()
    {
        var res = await _client.GetAsync("/api/sites/apollo11/metrics?at=2040-01-01T00:00:00Z");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task ExportCsv_Haworth_HasHeaderAndOneRowPerHour()
    {
        var res = await _client.GetAsync("/api/sites/haworth/export.csv?from=2027-01-01T00:00:00Z&days=2&mast=2");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("text/csv", res.Content.Headers.ContentType?.MediaType);

        var lines = (await res.Content.ReadAsStringAsync()).Split('\n', StringSplitOptions.RemoveEmptyEntries);
        Assert.Contains(lines, l => l.StartsWith("# ephemeris: JPL Horizons"));
        var header = Array.IndexOf(lines, lines.First(l => l.StartsWith("utc,")));
        var rows = lines[(header + 1)..];
        Assert.InRange(rows.Length, 48, 49);   // 2 days hourly, end included or not
        Assert.StartsWith("2027-01-01T00:00:00Z,", rows[0]);
        Assert.All(rows, r => Assert.Equal(8, r.Split(',').Length));
    }

    [Theory]
    [InlineData("/api/sites/haworth/timeline?from=2030-12-25T00:00:00Z&days=30")]
    [InlineData("/api/sites/haworth/export.csv?from=2030-12-25T00:00:00Z&days=30")]
    public async Task TimelineAndExport_PastEndOfData_ReturnWhatExists(string url)
    {
        var res = await _client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Contains("2031-01-01T00:00:00Z", await res.Content.ReadAsStringAsync());   // last row of the data
    }

    [Fact]
    public async Task ExportCsv_UnknownSite_Returns404()
    {
        var res = await _client.GetAsync("/api/sites/nope/export.csv");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Validation_ServesTheCSharpRunAgainstPgda()
    {
        using var doc = System.Text.Json.JsonDocument.Parse(await _client.GetStringAsync("/api/validation"));
        var root = doc.RootElement;
        Assert.Equal(31, root.GetProperty("sites").GetArrayLength());
        Assert.Equal(31, root.GetProperty("summary").GetProperty("sun").GetProperty("n").GetInt32());
        Assert.True(root.GetProperty("pass").TryGetProperty("sun", out _));
        Assert.Equal(3, root.GetProperty("summary").GetProperty("negativeControls").GetArrayLength());
    }

    [Fact]
    public async Task Custom_WithoutTerrainMap_Returns503()
    {
        var res = await _client.PostAsJsonAsync("/api/custom", new CustomRequest(-86.3, -23.3, 2, null));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, res.StatusCode);
    }
}
