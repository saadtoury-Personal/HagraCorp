using System.Collections.Concurrent;
using System.Text.Json;
using LunarNav.Core;

namespace LunarNav.Api;

public sealed class AppData
{
    public IReadOnlyList<Site> Sites { get; }

    private readonly ConcurrentDictionary<string, float[]> _masks = new();
    private string _dataDir;

    public AppData(string dataDir)
    {
        _dataDir = dataDir;

        var sitesPath = Path.Combine(_dataDir, "sites.json");
        if (!File.Exists(sitesPath)) throw new FileNotFoundException("sites.json not found in data directory");

        var json = File.ReadAllText(sitesPath);
        Sites = JsonSerializer.Deserialize<List<Site>>(json, JsonSerializerOptions.Web)
            ?? throw new InvalidDataException("sites.json is empty or invalid");

        if (Sites.Count == 0) throw new InvalidDataException("sites.json contains no sites");
    }

    public Site? FindSite(string id)
    {
        return Sites.FirstOrDefault(s => string.Equals(s.Id, id, StringComparison.OrdinalIgnoreCase));
    }

    public float[]? Mask(string siteId, int mast)
    {
        var key = $"{siteId}_{mast}m";

        if (_masks.TryGetValue(key, out var cached)) return cached;

        var path = Path.Combine(_dataDir, "masks", key + ".json");
        if (!File.Exists(path)) return null;

        var mask = JsonSerializer.Deserialize<float[]>(File.ReadAllText(path));
        if (mask == null || mask.Length != 720) throw new InvalidDataException($"{path}: expected 720 values");

        return _masks.GetOrAdd(key, mask);
    }
}
