using System.Collections.Concurrent;
using System.Text.Json;
using LunarNav.Core;

namespace LunarNav.Api;

/// <summary>What the Moon looks like from Earth at one hour. Source "nasa" = NASA Dial-A-Moon (with image),
/// "local" = computed from our ephemeris (no image, AgeDays null). Longitudes 0..360 east, like everywhere in this API.</summary>
public sealed record MoonDto(DateTime Time, double PhasePct, double? AgeDays, double DistanceKm,
    double SubsolarLat, double SubsolarLon, double SubearthLat, double SubearthLon,
    string? ImageUrl, string Source, string? Credit);

/// <summary>Proxy for NASA SVS Dial-A-Moon (the browser cannot call it: CORS), with an hourly cache and a local fallback
/// so the demo keeps working when NASA is slow, down, or the date is after 2026 (NASA silently clamps those).</summary>
public sealed class MoonService(HttpClient http, AppData data)
{
    private static readonly DateTime NasaFirst = new(2011, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime NasaLast = new(2026, 12, 31, 23, 0, 0, DateTimeKind.Utc);
    private readonly ConcurrentDictionary<DateTime, MoonDto> _cache = new();

    public async Task<MoonDto> GetAsync(DateTime utc, CancellationToken ct)
    {
        var t = new DateTime((utc.Ticks + TimeSpan.TicksPerHour / 2) / TimeSpan.TicksPerHour * TimeSpan.TicksPerHour, DateTimeKind.Utc);
        if (_cache.TryGetValue(t, out var hit))
            return hit;

        if (t >= NasaFirst && t <= NasaLast)
        {
            try
            {
                return _cache[t] = await FetchNasaAsync(t, ct);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException or InvalidOperationException)
            {
                Console.Error.WriteLine($"Dial-A-Moon failed for {t:yyyy-MM-ddTHH:mm}, using local phase: {ex.GetType().Name}: {ex.GetBaseException().Message}");
                return Local(t);   // not cached: NASA is retried on the next call
            }
        }
        return _cache[t] = Local(t);
    }

    private async Task<MoonDto> FetchNasaAsync(DateTime t, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(await http.GetStringAsync($"https://svs.gsfc.nasa.gov/api/dialamoon/{t:yyyy-MM-ddTHH:mm}", ct));
        var r = doc.RootElement;
        double D(string name) => r.GetProperty(name).GetDouble();
        var image = r.GetProperty("image").GetProperty("url").GetString()?.Replace("http://", "https://");
        return new MoonDto(t, D("phase"), D("age"), D("distance"),
            D("subsolar_lat"), Lon360(D("subsolar_lon")), D("subearth_lat"), Lon360(D("subearth_lon")),
            image, "nasa", "NASA's Scientific Visualization Studio");
    }

    /// <summary>Throws ArgumentOutOfRangeException outside the 2026-2030 ephemeris.</summary>
    private MoonDto Local(DateTime t)
    {
        var e = data.Ephemeris.At(t);
        var image = t.Year == 2026 ? Frame2026(t) : null;
        return new MoonDto(t, Math.Round(Analysis.MoonPhasePercent(e), 2), null, Math.Round(e.EarthRangeKm, 1),
            e.SubSunLatDeg, e.SubSunLonDeg, e.SubEarthLatDeg, e.SubEarthLonDeg,
            image, "local", image is null ? null : "NASA's Scientific Visualization Studio");
    }

    /// <summary>NASA's 2026 Dial-A-Moon frames are one per hour: frame = hours since 2026-01-01 00:00 UTC + 1
    /// (2026-11-15T00:00 is moon.7633.jpg). Lets the browser show the image even when this server cannot reach the NASA API.</summary>
    private static string Frame2026(DateTime t) =>
        $"https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005587/frames/730x730_1x1_30p/moon.{(int)(t - new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalHours + 1:D4}.jpg";

    private static double Lon360(double lon) => (lon % 360 + 360) % 360;
}
