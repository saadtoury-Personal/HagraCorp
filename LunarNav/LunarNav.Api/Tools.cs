using System.Runtime.InteropServices;
using System.Text.Json;
using LunarNav.Core;

namespace LunarNav.Api;

/// <summary>
/// One-off data job, run by hand before the demo (never during it):
///   dotnet run --project LunarNav.Api -- precompute ../data/LDEM_80S_80M.IMG LunarNav.Web/wwwroot/data
/// The ephemeris CSV comes from fetch_ephem.py (JPL Horizons), so there is no Horizons code here.
/// </summary>
public static class Tools
{
    /// <summary>Loads data/LDEM_80S_80M.IMG (110 MB of 16-bit little-endian integers) into memory.</summary>
    public static Dem LoadDem(string imgPath)
    {
        using var file = File.OpenRead(imgPath);
        if (file.Length != 7600L * 7600 * 2)
            throw new InvalidDataException($"{imgPath}: expected {7600 * 7600 * 2} bytes, got {file.Length}");
        // Read straight into the final array: one 115 MB copy in memory, not two (Render's free plan has 512 MB).
        var dn = new short[7600 * 7600];
        file.ReadExactly(MemoryMarshal.AsBytes(dn.AsSpan()));
        return new Dem(dn);
    }

    /// <summary>Writes masks/{id}_{mast}m.json, heatmap_{mast}m.json and uncertainty_{mast}m.json for every site, masts 2 and 10.</summary>
    public static void Precompute(string demPath, string dataDir)
    {
        var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var sites = JsonSerializer.Deserialize<List<Site>>(File.ReadAllText(Path.Combine(dataDir, "sites.json")), json)
            ?? throw new InvalidDataException("sites.json is empty");
        Ephemeris eph;
        using (var reader = new StreamReader(Path.Combine(dataDir, "ephem.csv")))
            eph = Ephemeris.ParseCsv(reader);
        var dem = LoadDem(demPath);
        Directory.CreateDirectory(Path.Combine(dataDir, "masks"));

        foreach (int mast in new[] { 2, 10 })
        {
            var masks = new List<float[]>();
            foreach (var site in sites)
            {
                var mask = site.Terrain ? HorizonMask.Compute(dem, site.LatDeg, site.LonDeg, mast) : HorizonMask.Flat();
                Write(Path.Combine(dataDir, "masks", $"{site.Id}_{mast}m.json"), mask);
                masks.Add(mask);
            }
            var from = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var to = new DateTime(2030, 10, 31, 0, 0, 0, DateTimeKind.Utc);
            Write(Path.Combine(dataDir, $"heatmap_{mast}m.json"), Analysis.Heatmap(eph, sites, masks, from, to, new BatteryParams()));

            // S1: 40 extra skylines per site, the slow part (minutes).
            var uncertainty = new List<UncertaintyDto>();
            for (int i = 0; i < sites.Count; i++)
            {
                if (!sites[i].Terrain)
                    continue;
                uncertainty.Add(Analysis.Uncertainty(eph, dem, sites[i], masks[i], mast, from, new DateTime(2031, 1, 1, 0, 0, 0, DateTimeKind.Utc)));
                Console.WriteLine($"uncertainty {mast} m: {sites[i].Id}");
            }
            Write(Path.Combine(dataDir, $"uncertainty_{mast}m.json"), uncertainty);
        }

        void Write<T>(string path, T value)
        {
            File.WriteAllText(path, JsonSerializer.Serialize(value, json));
            Console.WriteLine($"wrote {path}");
        }
    }
}
