using System.Net;
using System.Net.Http.Json;
using LunarNav.Api;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace LunarNav.Tests;

public class MoonApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string NasaSample = """
        { "image": { "url": "http://svs.gsfc.nasa.gov/vis/a000000/a005500/a005587/frames/730x730_1x1_30p/moon.7633.jpg" },
          "time": "2026-11-15T00:00", "phase": 27.23, "age": 5.707, "distance": 404785.0,
          "subsolar_lon": 114.431, "subsolar_lat": -1.557, "subearth_lon": -2.62, "subearth_lat": 3.307 }
        """;

    private static readonly DateTime Nov15 = new(2026, 11, 15, 0, 0, 0, DateTimeKind.Utc);
    private readonly HttpClient _client;

    public MoonApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(b => b.UseSetting("DataDir", DataDir()).UseSetting("DemPath", "no-such-file.img")).CreateClient();
    }

    [Fact]
    public async Task Nasa_ResponseIsParsedAndImageIsHttps()
    {
        var moon = await Service(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(NasaSample) })
            .GetAsync(Nov15.AddMinutes(20), CancellationToken.None);   // rounds to 00:00

        Assert.Equal("nasa", moon.Source);
        Assert.Equal(Nov15, moon.Time);
        Assert.Equal(27.23, moon.PhasePct);
        Assert.Equal(357.38, moon.SubearthLon, 6);   // -2.62 east -> 0..360
        Assert.StartsWith("https://", moon.ImageUrl);
        Assert.NotNull(moon.Credit);
    }

    [Fact]
    public async Task NasaDown_FallsBackToLocalWithTheSamePhase()
    {
        var moon = await Service(_ => throw new HttpRequestException("down")).GetAsync(Nov15, CancellationToken.None);

        Assert.Equal("local", moon.Source);
        Assert.EndsWith("/moon.7633.jpg", moon.ImageUrl);   // same frame NASA returns for this hour
        Assert.Equal(27.23, moon.PhasePct, 1);
    }

    [Fact]
    public async Task After2026_UsesLocalWithoutCallingNasa()
    {
        var moon = await Service(_ => throw new InvalidOperationException("NASA must not be called"))
            .GetAsync(new DateTime(2028, 6, 1, 0, 0, 0, DateTimeKind.Utc), CancellationToken.None);
        Assert.Equal("local", moon.Source);
        Assert.Null(moon.ImageUrl);   // NASA has no frames after 2026
        Assert.InRange(moon.PhasePct, 0, 100);
    }

    [Fact]
    public async Task Endpoint_After2026_ReturnsLocal()
    {
        var moon = await _client.GetFromJsonAsync<MoonDto>("/api/moon?at=2028-06-01T00:00:00Z");
        Assert.Equal("local", moon!.Source);
    }

    [Fact]
    public async Task Endpoint_OutsideAllData_Returns400()
    {
        var res = await _client.GetAsync("/api/moon?at=2040-01-01T00:00:00Z");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    private static MoonService Service(Func<HttpRequestMessage, HttpResponseMessage> respond) =>
        new(new HttpClient(new FakeHandler(respond)), new AppData(DataDir()));

    private sealed class FakeHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(respond(request));
    }

    private static string DataDir()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var p = Path.Combine(dir.FullName, "LunarNav.Web", "wwwroot", "data");
            if (File.Exists(Path.Combine(p, "sites.json"))) return p;
        }
        throw new DirectoryNotFoundException("LunarNav.Web/wwwroot/data not found");
    }
}
