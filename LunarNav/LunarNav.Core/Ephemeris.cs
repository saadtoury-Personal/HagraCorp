using System.Globalization;

namespace LunarNav.Core;

/// <summary>
/// STEP 2 FOR THE CODER. Hourly Sun/Earth table (2026-2030) loaded from a CSV, with interpolation
/// so we can ask for any time (e.g. every 10 minutes for the countdowns).
/// The CSV is produced by LunarNav.Api/Tools.cs (FetchEphemeris).
/// </summary>
public sealed class Ephemeris
{
    /// <summary>Rows sorted by time, exactly one hour apart.</summary>
    public IReadOnlyList<EphemSample> Samples { get; }
    public DateTime Start => Samples[0].Utc;
    public DateTime End => Samples[^1].Utc;

    public Ephemeris(IReadOnlyList<EphemSample> samples)
    {
        if (samples.Count == 0)
            throw new ArgumentException("samples must not be empty", nameof(samples));
        Samples = samples;
    }

    /// <summary>Reads the CSV: one header line, then
    /// utc,subSunLat,subSunLon,subEarthLat,subEarthLon,earthRangeKm</summary>
    public static Ephemeris ParseCsv(TextReader reader)
    {
        // TODO:
        // 1. skip the header line
        // 2. for each non-empty line: split on ',', parse with CultureInfo.InvariantCulture
        //    (utc: DateTime.Parse(..., InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal))
        // 3. return new Ephemeris(list)
        throw new NotImplementedException();
    }

    /// <summary>Values at any time between Start and End (linear interpolation between the two hourly rows).</summary>
    public EphemSample At(DateTime utc)
    {
        // TODO:
        // 1. throw ArgumentOutOfRangeException if utc is outside [Start, End]
        // 2. hours = (utc - Start).TotalHours; i = (int)floor(hours); f = hours - i
        //    (if i is the last index, return Samples[i])
        // 3. a = Samples[i], b = Samples[i + 1]
        // 4. NEVER interpolate longitudes directly (359 -> 1 would pass through 180).   MATH-REVIEW
        //    Instead, for the Sun and then for the Earth:
        //      va = Geometry.UnitVector(a lat, a lon); vb = Geometry.UnitVector(b lat, b lon)
        //      v  = va + f * (vb - va)      (component by component)
        //      (lat, lon) = Geometry.ToLatLon(v)
        // 5. range = a.EarthRangeKm + f * (b.EarthRangeKm - a.EarthRangeKm)
        // 6. return new EphemSample(utc, sunLat, sunLon, earthLat, earthLon, range)
        throw new NotImplementedException();
    }
}
