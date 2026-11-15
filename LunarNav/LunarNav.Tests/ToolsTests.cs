using System.Text.Json;
using LunarNav.Api;

namespace LunarNav.Tests;

public class ToolsTests : IDisposable
{
    private readonly string _dir = Directory.CreateTempSubdirectory("lunarnav-tools-").FullName;

    public void Dispose() => Directory.Delete(_dir, recursive: true);

    [Fact]
    public void WriteManifest_ListsEveryFileWithItsSha256AndSource()
    {
        File.WriteAllText(Path.Combine(_dir, "sites.json"), "abc");
        Directory.CreateDirectory(Path.Combine(_dir, "masks"));
        File.WriteAllText(Path.Combine(_dir, "masks", "haworth_2m.json"), "");

        var entries = Tools.WriteManifest(_dir);

        Assert.Equal(["masks/haworth_2m.json", "sites.json"], entries.Select(e => e.Path));
        // Known SHA-256 values of "" and "abc".
        Assert.Equal("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", entries[0].Sha256);
        Assert.Equal("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", entries[1].Sha256);
        Assert.Equal(3, entries[1].Bytes);
        Assert.Contains("ACD-50044", entries[1].Source);
        Assert.Contains("precompute", entries[0].Command);
    }

    [Fact]
    public void WriteManifest_UncertaintyFiles_ComeFromPrecompute()
    {
        File.WriteAllText(Path.Combine(_dir, "uncertainty_2m.json"), "[]");
        var entry = Assert.Single(Tools.WriteManifest(_dir));
        Assert.Contains("LOLA", entry.Source);
        Assert.Contains("precompute", entry.Command);
    }

    [Fact]
    public void WriteManifest_DoesNotListItself_AndIsValidJson()
    {
        File.WriteAllText(Path.Combine(_dir, "ephem.csv"), "x");
        Tools.WriteManifest(_dir);
        var again = Tools.WriteManifest(_dir);

        Assert.DoesNotContain(again, e => e.Path == "manifest.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(_dir, "manifest.json")));
        Assert.Equal(1, doc.RootElement.GetProperty("files").GetArrayLength());
    }

    [Fact]
    public void LoadDem_WrongSize_Throws()
    {
        var path = Path.Combine(_dir, "small.img");
        File.WriteAllBytes(path, new byte[100]);
        Assert.Throws<InvalidDataException>(() => Tools.LoadDem(path));
    }
}
