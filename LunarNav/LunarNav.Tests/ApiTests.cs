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
        _client = factory.WithWebHostBuilder(b => b.UseSetting("DataDir", FindDataDir())).CreateClient();
    }

    private static string FindDataDir()
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
}
