namespace LunarNav.Core;

/// <summary>
/// Turns sky positions into answers: timelines, countdowns, mission windows, the slip heatmap and the fallback ranking.
/// Two definitions used everywhere in this file:
///   "Sun up"        = sunFrac   >= 0.5   (at least half of the Sun's disk above the terrain)
///   "Earth in view" = earthFrac >  0     (any part of the Earth above the terrain)
/// </summary>
public static class Analysis
{
    public const double ViperMaxDarkHours = 50;
    public const double SolarConstantWm2 = 1361;

    /// <summary>Dark gaps this short are bridged (batteries) when measuring continuous windows.
    /// Without it, near-pole windows flip between hours and weeks for a 0.05 deg horizon change.</summary>
    public const int MaxGapHours = 6;

    /// <summary>Sky state at every step from start to end (both included).</summary>
    public static TimelinePoint[] Timeline(Ephemeris eph, Site site, float[] mask, DateTime start, DateTime end, TimeSpan step)
    {
        if (step <= TimeSpan.Zero)
            throw new ArgumentOutOfRangeException(nameof(step), "step must be positive");
        var points = new List<TimelinePoint>();
        for (var t = start; t <= end; t += step)
            points.Add(Point(eph, site, mask, t));
        return points.ToArray();
    }

    private static TimelinePoint Point(Ephemeris eph, Site site, float[] mask, DateTime t)
    {
        var e = eph.At(t);
        var sun = Geometry.SunAzEl(e, site.LatDeg, site.LonDeg);
        var earth = Geometry.EarthAzEl(e, site.LatDeg, site.LonDeg);
        double sunFrac = Geometry.DiskFraction(sun.ElDeg - HorizonMask.At(mask, sun.AzDeg), Geometry.SunAngularRadiusDeg);
        double earthFrac = Geometry.DiskFraction(earth.ElDeg - HorizonMask.At(mask, earth.AzDeg), Geometry.EarthAngularRadiusDeg(e.EarthRangeKm));
        return new TimelinePoint(t, sun.AzDeg, sun.ElDeg, sunFrac, earth.AzDeg, earth.ElDeg, earthFrac,
            PowerIndex(sunFrac, sun.ElDeg, trackingPanel: true));
    }

    /// <summary>Hourly Sun-up / Earth-in-view flags from start, at most 'hours' values, cut at the end of the ephemeris.</summary>
    internal static (bool[] SunUp, bool[] EarthUp) UpSeries(Ephemeris eph, Site site, float[] mask, DateTime start, int hours)
    {
        int n = Math.Max(0, Math.Min(hours, (int)Math.Floor((eph.End - start).TotalHours) + 1));
        var sunUp = new bool[n];
        var earthUp = new bool[n];
        for (int k = 0; k < n; k++)
        {
            var p = Point(eph, site, mask, start.AddHours(k));
            sunUp[k] = p.SunFrac >= 0.5;
            earthUp[k] = p.EarthFrac > 0;
        }
        return (sunUp, earthUp);
    }

    /// <summary>Unitless solar power index, 0..1. Watts = index * SolarConstantWm2 * panel area * efficiency.</summary>
    public static double PowerIndex(double sunFrac, double sunElDeg, bool trackingPanel)
    {
        double el = sunElDeg * Math.PI / 180;
        return trackingPanel ? sunFrac * Math.Cos(el) : sunFrac * Math.Max(0, Math.Sin(el));
    }

    /// <summary>
    /// Time of the next rise or set after 'from'. sun = true: the Sun, false: the Earth.
    /// rising = true: next change from down to up; false: from up to down. Null if none within maxDays.
    /// </summary>
    public static DateTime? NextCrossing(Ephemeris eph, Site site, float[] mask, DateTime from, bool sun, bool rising, int maxDays = 60)
    {
        bool Up(DateTime t)
        {
            var p = Point(eph, site, mask, t);
            return sun ? p.SunFrac >= 0.5 : p.EarthFrac > 0;
        }

        var stop = from.AddDays(maxDays) < eph.End ? from.AddDays(maxDays) : eph.End;
        bool prev = Up(from);
        for (var t = from.AddHours(1); t <= stop; t = t.AddHours(1))
        {
            bool cur = Up(t);
            if (cur != prev && cur == rising)
            {
                for (var r = t.AddMinutes(-50); r < t; r = r.AddMinutes(10))
                    if (Up(r) == rising)
                        return r;
                return t;
            }
            prev = cur;
        }
        return null;
    }

    /// <summary>Everything the detail view shows for "arrive at 'at', stay stayDays".</summary>
    public static SiteMetrics Metrics(Ephemeris eph, Site site, float[] mask, DateTime at, double stayDays)
    {
        double? Hours(DateTime? x) => x is null ? null : (x.Value - at).TotalHours;

        var (sunUp, earthUp) = UpSeries(eph, site, mask, at, Math.Max(1, (int)Math.Round(stayDays * 24)));
        int n = sunUp.Length;
        if (n == 0)
            throw new ArgumentOutOfRangeException(nameof(at), "date is outside the ephemeris");

        var sunDown = sunUp.Select(x => !x).ToArray();
        var bothDown = sunUp.Zip(earthUp, (s, e) => !s && !e).ToArray();
        int longestDarkNoEarth = LongestRun(bothDown);

        // Windows look up to 60 days ahead, not only over the stay.
        var (s60, e60) = UpSeries(eph, site, mask, at, 60 * 24);
        int windowSun = RunLengths(BridgeGaps(s60, MaxGapHours)).FirstOrDefault();
        int windowBoth = RunLengths(BridgeGaps(s60.Zip(e60, (s, e) => s && e).ToArray(), MaxGapHours)).FirstOrDefault();

        return new SiteMetrics(at,
            Hours(NextCrossing(eph, site, mask, at, sun: true, rising: false)),
            Hours(NextCrossing(eph, site, mask, at, sun: true, rising: true)),
            Hours(NextCrossing(eph, site, mask, at, sun: false, rising: false)),
            Hours(NextCrossing(eph, site, mask, at, sun: false, rising: true)),
            100.0 * sunUp.Count(x => x) / n,
            100.0 * earthUp.Count(x => x) / n,
            100.0 * bothDown.Count(x => x) / n,
            LongestRun(sunDown),
            longestDarkNoEarth,
            longestDarkNoEarth > ViperMaxDarkHours,
            windowSun,
            windowBoth,
            windowSun >= stayDays * 24);
    }

    /// <summary>For each index i: how many consecutive true values start at i (0 if ok[i] is false).
    /// Example: [T, T, F, T] gives [2, 1, 0, 1].</summary>
    public static int[] RunLengths(bool[] ok)
    {
        var r = new int[ok.Length];
        for (int i = ok.Length - 1; i >= 0; i--)
            r[i] = ok[i] ? (i + 1 < ok.Length ? r[i + 1] : 0) + 1 : 0;
        return r;
    }

    /// <summary>Length of the longest run of consecutive true values. Example: [T, F, T, T] gives 2.</summary>
    public static int LongestRun(bool[] flags)
    {
        int max = 0, cur = 0;
        foreach (bool f in flags)
        {
            cur = f ? cur + 1 : 0;
            max = Math.Max(max, cur);
        }
        return max;
    }

    /// <summary>Copy of 'up' where every run of false of length &lt;= maxGap with true on both sides becomes true.
    /// Example with maxGap 2: [T, F, F, T] gives [T, T, T, T]; leading and trailing false runs never change.</summary>
    public static bool[] BridgeGaps(bool[] up, int maxGap)
    {
        var r = (bool[])up.Clone();
        int i = 0;
        while (i < r.Length)
        {
            if (up[i]) { i++; continue; }
            int j = i;
            while (j < up.Length && !up[j])
                j++;
            if (i > 0 && j < up.Length && j - i <= maxGap)
                Array.Fill(r, true, i, j - i);
            i = j;
        }
        return r;
    }

    /// <summary>
    /// The slip heatmap: for every site and every day from 'from' to 'to', how long the Sun
    /// (and Sun + Earth) stays continuously available if you arrive that day at 06:00 UTC.
    /// masks[i] is the skyline of sites[i].
    /// </summary>
    public static HeatmapDto Heatmap(Ephemeris eph, IReadOnlyList<Site> sites, IReadOnlyList<float[]> masks, DateTime from, DateTime to)
    {
        if (sites.Count != masks.Count)
            throw new ArgumentException("one mask per site", nameof(masks));
        var start = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc).AddHours(6);
        int nDays = (int)(to.Date - from.Date).TotalDays + 1;
        var days = Enumerable.Range(0, nDays).Select(d => start.AddDays(d)).ToArray();
        int hours = (int)(start.AddDays(nDays - 1 + 60) - start).TotalHours;   // 60 extra days to finish runs still going

        var sunH = new float[sites.Count][];
        var bothH = new float[sites.Count][];
        Parallel.For(0, sites.Count, s =>
        {
            var (sunUp, earthUp) = UpSeries(eph, sites[s], masks[s], start, hours);
            var runSun = RunLengths(BridgeGaps(sunUp, MaxGapHours));
            var runBoth = RunLengths(BridgeGaps(sunUp.Zip(earthUp, (a, b) => a && b).ToArray(), MaxGapHours));
            sunH[s] = days.Select((_, d) => d * 24 < runSun.Length ? (float)runSun[d * 24] : 0f).ToArray();
            bothH[s] = days.Select((_, d) => d * 24 < runBoth.Length ? (float)runBoth[d * 24] : 0f).ToArray();
        });
        return new HeatmapDto(sites.Select(x => x.Id).ToArray(), days, sunH, bothH);
    }

    /// <summary>NASA prefers sites "less sensitive to timing": fraction (0..1) of the days within
    /// +- bandWeeks of dayIndex whose window is at least stayDays long.</summary>
    public static double Robustness(float[] windowHoursRow, int dayIndex, int bandWeeks, double stayDays)
    {
        int lo = Math.Max(0, dayIndex - 7 * bandWeeks);
        int hi = Math.Min(windowHoursRow.Length - 1, dayIndex + 7 * bandWeeks);
        int ok = 0;
        for (int i = lo; i <= hi; i++)
            if (windowHoursRow[i] >= stayDays * 24)
                ok++;
        return ok / (double)(hi - lo + 1);
    }

    /// <summary>
    /// THE feature of the product: "the launch slipped by slipWeeks, which site is best now?"
    /// </summary>
    public static FallbackDto BestFallback(HeatmapDto heatmap, DateTime date, int slipWeeks, double stayDays, bool requireEarth, int robustnessWeeks = 2)
    {
        var slipped = date.AddDays(7 * slipWeeks);
        int d = Array.FindIndex(heatmap.Days, x => x.Date == slipped.Date);
        if (d < 0)
            throw new ArgumentOutOfRangeException(nameof(date), "slipped date is outside the heatmap");

        var rows = requireEarth ? heatmap.BothH : heatmap.SunH;
        double need = stayDays * 24;
        var entries = new FallbackEntry[heatmap.Sites.Length];
        for (int s = 0; s < entries.Length; s++)
        {
            var row = rows[s];
            DateTime? nearest = null;
            for (int k = 0; nearest is null && (d - k >= 0 || d + k < row.Length); k++)
            {
                if (d - k >= 0 && row[d - k] >= need)
                    nearest = heatmap.Days[d - k];
                else if (d + k < row.Length && row[d + k] >= need)
                    nearest = heatmap.Days[d + k];
            }
            entries[s] = new FallbackEntry(heatmap.Sites[s], row[d], row[d] >= need, nearest,
                Robustness(row, d, robustnessWeeks, stayDays));
        }
        var ranked = entries.OrderByDescending(e => e.WindowHours).ThenByDescending(e => e.Robustness).ToArray();
        return new FallbackDto(date, slipped, ranked);
    }
}
