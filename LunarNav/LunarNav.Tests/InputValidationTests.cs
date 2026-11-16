using System.Net;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace LunarNav.Tests;

/// <summary>Bad numbers must give 400, never a 500 or a silently wrong answer. "x &lt; a or x &gt; b" is false for NaN,
/// and the JSON reader accepts "NaN" and "Infinity" in quotes, so every range check is tested with them.</summary>
public class InputValidationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public InputValidationTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(b => b.UseSetting("DataDir", ApiTests.FindDataDir()).UseSetting("DemPath", "no-such-file.img")).CreateClient();
    }

    [Theory]
    [InlineData("/api/sites/haworth/metrics?at=2027-01-01T00:00:00Z&stayDays=NaN")]
    [InlineData("/api/sites/haworth/metrics?at=2027-01-01T00:00:00Z&stayDays=Infinity")]
    [InlineData("/api/ranking?date=2027-01-01&stayDays=NaN")]
    [InlineData("/api/fallback?date=2027-01-01&stayDays=NaN")]
    [InlineData("/api/fallback?date=2027-01-01&stayDays=100000")]
    [InlineData("/api/sites/haworth/battery?at=2027-01-01T00:00:00Z&stayDays=NaN")]
    [InlineData("/api/sites/haworth/battery?at=2027-01-01T00:00:00Z&capacityWh=NaN")]
    [InlineData("/api/sites/haworth/battery?at=2027-01-01T00:00:00Z&capacityWh=Infinity")]
    [InlineData("/api/sites/haworth/battery?at=2027-01-01T00:00:00Z&loadW=NaN")]
    [InlineData("/api/sites/haworth/battery?at=2027-01-01T00:00:00Z&panelM2=Infinity")]
    [InlineData("/api/sites/haworth/battery?at=2027-01-01T00:00:00Z&panelM2=1e308")]
    [InlineData("/api/sites/haworth/battery?at=2027-01-01T00:00:00Z&capacityWh=1e308")]
    [InlineData("/api/sites/haworth/battery?at=2027-01-01T00:00:00Z&loadW=2e9")]
    [InlineData("/api/sites/haworth/timeline?from=2027-01-01T00:00:00Z&days=366&stepMinutes=10")]
    [InlineData("/api/sites/haworth/battery?at=2027-01-01T00:00:00Z&efficiency=NaN")]
    [InlineData("/api/sites/haworth/battery?at=2027-01-01T00:00:00Z&minSocPct=NaN")]
    [InlineData("/api/sites/haworth/metrics?at=2027-01-01T00:00:00Z&sunRule=99")]
    [InlineData("/api/sites/haworth/metrics?at=2027-01-01T00:00:00Z&earthRule=7")]
    public async Task Get_BadNumber_Returns400(string url)
    {
        var res = await _client.GetAsync(url);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Timeline_YearHourly_StillAllowed()
    {
        var res = await _client.GetAsync("/api/sites/haworth/timeline?from=2027-01-01T00:00:00Z&days=366&stepMinutes=60");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Theory]
    [InlineData("{\"lat\":\"NaN\",\"lon\":0,\"mast\":2}")]
    [InlineData("{\"lat\":-85,\"lon\":\"NaN\",\"mast\":2}")]
    [InlineData("{\"lat\":-85,\"lon\":\"Infinity\",\"mast\":2}")]
    [InlineData("{\"lat\":-85,\"lon\":10,\"mast\":\"NaN\"}")]
    [InlineData("{\"lat\":-70,\"lon\":10,\"mast\":2}")]
    public async Task Custom_BadNumber_Returns400(string body)
    {
        var res = await _client.PostAsync("/api/custom", new StringContent(body, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Battery_DefaultsStillWork()
    {
        var res = await _client.GetAsync("/api/sites/haworth/battery?at=2027-01-01T00:00:00Z&stayDays=2");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }
}
