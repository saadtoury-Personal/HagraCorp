using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace LunarNav.Tests;

public class ValidationEndpointTests : IClassFixture<WebApplicationFactory<Program>>, IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly string _dir = Directory.CreateTempSubdirectory("lunarnav-validation-").FullName;

    public ValidationEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        File.Copy(Path.Combine(ApiTests.FindDataDir(), "sites.json"), Path.Combine(_dir, "sites.json"));
        File.WriteAllText(Path.Combine(_dir, "validation.json"), """{"ok":true}""");
    }

    public void Dispose() => Directory.Delete(_dir, recursive: true);

    [Fact]
    public async Task Validation_WithRelativeDataDir_ServesTheFile()
    {
        // Deployment sets DataDir=data (relative): the file must still be read from disk, not from wwwroot.
        var relative = Path.GetRelativePath(Environment.CurrentDirectory, _dir);
        Assert.False(Path.IsPathRooted(relative));
        var client = _factory.WithWebHostBuilder(b => b.UseSetting("DataDir", relative).UseSetting("DemPath", "no-such-file.img")).CreateClient();

        var res = await client.GetAsync("/api/validation");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("""{"ok":true}""", await res.Content.ReadAsStringAsync());
    }
}
