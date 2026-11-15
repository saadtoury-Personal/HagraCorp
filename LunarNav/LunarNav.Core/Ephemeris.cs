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
        if ((samples[^1].Utc - samples[0].Utc).TotalHours != samples.Count - 1)
            throw new ArgumentException("samples must be hourly with no gaps", nameof(samples));
        Samples = samples;
    }

    /// <summary>Reads the CSV: one header line, then
    /// utc,subSunLat,subSunLon,subEarthLat,subEarthLon,earthRangeKm</summary>
    public static Ephemeris ParseCsv(TextReader reader)
    {
        var inv = CultureInfo.InvariantCulture;
        var list = new List<EphemSample>();
        reader.ReadLine(); // header
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            if (string.IsNullOrWhiteSpace(line))
                continue;
            var p = line.Split(',');
            list.Add(new EphemSample(
                DateTime.Parse(p[0], inv, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal),
                double.Parse(p[1], inv),
                double.Parse(p[2], inv),
                double.Parse(p[3], inv),
                double.Parse(p[4], inv),
                double.Parse(p[5], inv)));
        }
        return new Ephemeris(list);
    }

    /// <summary>Values at any time between Start and End (linear interpolation between the two hourly rows).</summary>
    public EphemSample At(DateTime utc)
    {
        if (utc.Kind == DateTimeKind.Local)
            utc = utc.ToUniversalTime();

        if (utc < Start || utc > End)
            throw new ArgumentOutOfRangeException(nameof(utc), utc, "utc is outside the ephemeris range");

        double hours = (utc - Start).TotalHours;
        int i = (int)Math.Floor(hours);
        double f = hours - i;
        if (i >= Samples.Count - 1)
            return Samples[^1];

        var a = Samples[i];
        var b = Samples[i + 1];

        // MATH-REVIEW: never interpolate longitudes directly (359 -> 1 would pass through 180).
        var (sunLat, sunLon) = Lerp(a.SubSunLatDeg, a.SubSunLonDeg, b.SubSunLatDeg, b.SubSunLonDeg, f);
        var (earthLat, earthLon) = Lerp(a.SubEarthLatDeg, a.SubEarthLonDeg, b.SubEarthLatDeg, b.SubEarthLonDeg, f);
        double range = a.EarthRangeKm + f * (b.EarthRangeKm - a.EarthRangeKm);

        return new EphemSample(utc, sunLat, sunLon, earthLat, earthLon, range);
    }

    /// <summary>Interpolates between two (lat, lon) points through their 3D unit vectors.</summary>
    private static (double LatDeg, double LonDeg) Lerp(
        double latA, double lonA, double latB, double lonB, double f)
    {
        var va = Geometry.UnitVector(latA, lonA);
        var vb = Geometry.UnitVector(latB, lonB);
        var v = (X: va.X + f * (vb.X - va.X), Y: va.Y + f * (vb.Y - va.Y), Z: va.Z + f * (vb.Z - va.Z));
        return Geometry.ToLatLon(v);
    }
}
