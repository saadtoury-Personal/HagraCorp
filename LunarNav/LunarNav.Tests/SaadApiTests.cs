using System.Net;
using System.Net.Http.Json;
using LunarNav.Core;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace LunarNav.Tests;

public class SaadApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public SaadApiTests(WebApplicationFactory<Program> factory)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "LunarNav.Web", "wwwroot", "data", "sites.json")))
            dir = dir.Parent;
        var data = Path.Combine(dir!.FullName, "LunarNav.Web", "wwwroot", "data");
        _client = factory.WithWebHostBuilder(b => b.UseSetting("DataDir", data).UseSetting("DemPath", "no-such-file.img")).CreateClient();
    }

    [Fact]
    public async Task Metrics_HasMarginAndAcceptsRules()
    {
        var m = await _client.GetFromJsonAsync<SiteMetrics>("/api/sites/shackleton-rim/metrics?at=2027-03-01T00:00:00Z&stayDays=6&sunRule=center");
        Assert.NotNull(m!.SunPctRange);
        Assert.InRange(m.SunPct, m.SunPctRange![0], m.SunPctRange[1]);
        var bad = await _client.GetAsync("/api/sites/shackleton-rim/metrics?sunRule=middle");
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
    }

    [Fact]
    public async Task Fallback_FlatSitesLastWithTolerance()
    {
        var f = await _client.GetFromJsonAsync<FallbackDto>("/api/fallback?date=2027-03-01&slipWeeks=2&stayDays=6");
        Assert.False(f!.Ranked[^1].Terrain);
        Assert.All(f.Ranked.Where(e => e.Viable), e => Assert.True(e.SlipToleranceDays >= 1));
        Assert.All(f.Ranked.Where(e => e.Viable), e => Assert.Equal(0, e.MinShiftToViableDays));
        Assert.All(f.Ranked, e => Assert.NotNull(e.CloseCall));
    }

    [Fact]
    public async Task Battery_ReturnsSeriesAndRejectsBadParams()
    {
        var b = await _client.GetFromJsonAsync<BatteryDto>("/api/sites/shackleton-rim/battery?at=2027-03-01T00:00:00Z&stayDays=6");
        Assert.Equal(144, b!.Series.Length);
        Assert.Equal(150, b.Params.LoadW);
        var bad = await _client.GetAsync("/api/sites/shackleton-rim/battery?efficiency=2");
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
    }

    [Fact]
    public async Task Ranking_OnlySitesWithRelief()
    {
        var r = await _client.GetFromJsonAsync<RankingDto>("/api/ranking?date=2027-03-01T00:00:00Z&stayDays=6");
        Assert.Equal(2000, r!.Weightings);
        Assert.DoesNotContain(r.Ranked, e => e.SiteId == "apollo11");
        Assert.Equal(100, r.Ranked.Sum(e => e.FirstPct), 0);
    }

    [Fact]
    public async Task Blockers_ForAYear()
    {
        var b = await _client.GetFromJsonAsync<BlockersDto>("/api/sites/shackleton-rim/blockers?from=2027-01-01&to=2028-01-01");
        Assert.Equal(b!.SunHoursFlat - b.SunHours, b.LostHours);
    }

    [Fact]
    public async Task Uncertainty_FlatSiteIs404()
    {
        var r = await _client.GetAsync("/api/sites/apollo11/uncertainty");
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
    }
}
