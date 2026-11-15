using System.Collections.Concurrent;
using System.Text.Json;
using LunarNav.Core;

namespace LunarNav.Api;

public sealed class AppData
{
    public IReadOnlyList<Site> Sites { get; }
    private readonly ConcurrentDictionary<string, float[]> _masks = new();
    private readonly ConcurrentDictionary<int, HeatmapDto?> _heatmaps = new();
    private readonly string _dataDir;
    private readonly Lazy<Ephemeris> _ephemeris;
    private readonly Lazy<Dem?> _dem;

    /// <param name="demPath">LOLA map for custom points; missing file = custom points disabled (503).</param>
    public AppData(string dataDir, string? demPath = null)
    {
        _dataDir = dataDir;
        var sitesPath = Path.Combine(_dataDir, "sites.json");
        if (!File.Exists(sitesPath)) throw new FileNotFoundException("sites.json not found in data directory");
        var json = File.ReadAllText(sitesPath);
        Sites = JsonSerializer.Deserialize<List<Site>>(json, JsonSerializerOptions.Web)
            ?? throw new InvalidDataException("sites.json is empty or invalid");

        if (Sites.Count == 0) throw new InvalidDataException("sites.json contains no sites");

        _ephemeris = new Lazy<Ephemeris>(() =>
        {
            using var reader = new StreamReader(Path.Combine(_dataDir, "ephem.csv"));
            return Ephemeris.ParseCsv(reader);
        });
        _dem = new Lazy<Dem?>(() => demPath is not null && File.Exists(demPath) ? Tools.LoadDem(demPath) : null);
    }

    public Ephemeris Ephemeris => _ephemeris.Value;

    public Dem? Dem => _dem.Value;

    public Site? FindSite(string id) => Sites.FirstOrDefault(s => string.Equals(s.Id, id, StringComparison.OrdinalIgnoreCase));

    public float[]? Mask(string siteId, int mast)
    {
        var key = $"{siteId}_{mast}m";
        if (_masks.TryGetValue(key, out var cached)) return cached;

        var path = Path.Combine(_dataDir, "masks", $"{key}.json");
        if (!File.Exists(path)) return null;

        var mask = JsonSerializer.Deserialize<float[]>(File.ReadAllText(path), JsonSerializerOptions.Web);
        if (mask is null || mask.Length != HorizonMask.Bins) throw new InvalidDataException($"mask {key} must have {HorizonMask.Bins} values");

        _masks[key] = mask;
        return mask;
    }

    /// <summary>Precomputed skyline, or the flat one for sites outside the terrain map (Apollo 11).</summary>
    public float[] MaskOrFlat(Site site, int mast) => site.Terrain
        ? Mask(site.Id, mast) ?? throw new InvalidOperationException($"no horizon mask computed yet for '{site.Id}' at {mast} m")
        : HorizonMask.Flat();

    private readonly ConcurrentDictionary<int, UncertaintyDto[]?> _uncertainty = new();

    /// <summary>uncertainty_{mast}m.json written by precompute (S1), null if not computed yet.</summary>
    public UncertaintyDto? Uncertainty(string siteId, int mast) => _uncertainty.GetOrAdd(mast, m =>
    {
        var path = Path.Combine(_dataDir, $"uncertainty_{m}m.json");
        return File.Exists(path) ? JsonSerializer.Deserialize<UncertaintyDto[]>(File.ReadAllText(path), JsonSerializerOptions.Web) : null;
    })?.FirstOrDefault(u => string.Equals(u.SiteId, siteId, StringComparison.OrdinalIgnoreCase));

    public HeatmapDto? Heatmap(int mast) => _heatmaps.GetOrAdd(mast, m =>
    {
        var path = Path.Combine(_dataDir, $"heatmap_{m}m.json");
        return File.Exists(path) ? JsonSerializer.Deserialize<HeatmapDto>(File.ReadAllText(path), JsonSerializerOptions.Web) : null;
    });
}
