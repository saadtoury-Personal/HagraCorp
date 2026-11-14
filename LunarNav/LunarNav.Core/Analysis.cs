namespace LunarNav.Core;

/// <summary>
/// STEP 5 FOR THE CODER (needs Geometry, Ephemeris and HorizonMask.At to work first).
/// Turns sky positions into answers: timelines, countdowns, mission windows, the slip heatmap and the fallback ranking.
/// Two definitions used everywhere in this file:
///   "Sun up"        = sunFrac   >= 0.5   (at least half of the Sun's disk above the terrain)
///   "Earth in view" = earthFrac >  0     (any part of the Earth above the terrain)
/// </summary>
public static class Analysis
{
    public const double ViperMaxDarkHours = 50;
    public const double SolarConstantWm2 = 1361;

    /// <summary>Sky state at every step from start to end (both included).</summary>
    public static TimelinePoint[] Timeline(Ephemeris eph, Site site, float[] mask, DateTime start, DateTime end, TimeSpan step)
    {
        // TODO: for each t:
        // 1. e = eph.At(t)
        // 2. sun = Geometry.SunAzEl(e, site.LatDeg, site.LonDeg); earth = Geometry.EarthAzEl(e, ...)
        // 3. sunFrac   = Geometry.DiskFraction(sun.ElDeg   - HorizonMask.At(mask, sun.AzDeg),   Geometry.SunAngularRadiusDeg)
        //    earthFrac = Geometry.DiskFraction(earth.ElDeg - HorizonMask.At(mask, earth.AzDeg), Geometry.EarthAngularRadiusDeg(e.EarthRangeKm))
        // 4. power = PowerIndex(sunFrac, sun.ElDeg, trackingPanel: true)
        // Tip: put steps 1-4 in a private method Point(eph, site, mask, t); the other methods reuse it.
        throw new NotImplementedException();
    }

    /// <summary>Unitless solar power index, 0..1. Watts = index * SolarConstantWm2 * panel area * efficiency.</summary>
    public static double PowerIndex(double sunFrac, double sunElDeg, bool trackingPanel)
    {
        // TODO:
        //   trackingPanel (vertical panel that turns to follow the Sun): sunFrac * cos(sunEl)
        //   otherwise (flat panel on the ground):                        sunFrac * max(0, sin(sunEl))
        // At the pole the flat panel gives almost nothing: that is a point we show in the demo.
        throw new NotImplementedException();
    }

    /// <summary>
    /// Time of the next rise or set after 'from'. sun = true: the Sun, false: the Earth.
    /// rising = true: next change from down to up; false: from up to down. Null if none within maxDays.
    /// </summary>
    public static DateTime? NextCrossing(Ephemeris eph, Site site, float[] mask, DateTime from, bool sun, bool rising, int maxDays = 60)
    {
        // TODO:
        // 1. up(t) = sun ? sunFrac(t) >= 0.5 : earthFrac(t) > 0
        // 2. walk t = from, from + 1 h, ... (stop at from + maxDays or eph.End) until up(t) != up(t - 1 h)
        //    in the wanted direction (rising: false -> true; setting: true -> false)
        // 3. refine: walk the last hour again in 10 minute steps and return the first time after the change
        // 4. nothing found: return null
        throw new NotImplementedException();
    }

    /// <summary>Everything the detail view shows for "arrive at 'at', stay stayDays".</summary>
    public static SiteMetrics Metrics(Ephemeris eph, Site site, float[] mask, DateTime at, double stayDays)
    {
        // TODO:
        // 1. countdowns: (NextCrossing(...) - at).TotalHours for sunset, sunrise, Earthset, Earthrise (null stays null)
        // 2. hourly Timeline over [at, at + stayDays]; build bool arrays sunUp[], earthUp[]
        // 3. SunPct = 100 * count(sunUp) / n; EarthPct likewise; BothDownPct = 100 * count(!sunUp && !earthUp) / n
        // 4. LongestDarkHours        = LongestRun(!sunUp)
        //    LongestDarkNoEarthHours = LongestRun(!sunUp && !earthUp); ViperRuleViolated = that > ViperMaxDarkHours
        // 5. windows: hourly series from 'at' up to 60 days ahead (not only the stay):
        //    WindowSunHours = RunLengths(sunUp)[0]; WindowBothHours = RunLengths(sunUp && earthUp)[0]
        // 6. Viable = WindowSunHours >= stayDays * 24
        throw new NotImplementedException();
    }

    /// <summary>For each index i: how many consecutive true values start at i (0 if ok[i] is false).
    /// Example: [T, T, F, T] gives [2, 1, 0, 1].</summary>
    public static int[] RunLengths(bool[] ok)
    {
        // TODO: one pass from the END: r[i] = ok[i] ? (i + 1 < n ? r[i + 1] : 0) + 1 : 0
        throw new NotImplementedException();
    }

    /// <summary>Length of the longest run of consecutive true values. Example: [T, F, T, T] gives 2.</summary>
    public static int LongestRun(bool[] flags)
    {
        // TODO: single loop with a current counter and a max.
        throw new NotImplementedException();
    }

    /// <summary>
    /// The slip heatmap: for every site and every day from 'from' to 'to', how long the Sun
    /// (and Sun + Earth) stays continuously available if you arrive that day at 06:00 UTC.
    /// masks[i] is the skyline of sites[i].
    /// </summary>
    public static HeatmapDto Heatmap(Ephemeris eph, IReadOnlyList<Site> sites, IReadOnlyList<float[]> masks, DateTime from, DateTime to)
    {
        // TODO, per site (Parallel.For over sites is fine):
        // 1. ONE hourly series from 'from' 06:00 to min('to' + 60 days, eph.End): sunUp[], bothUp[] (= sunUp && earthUp)
        // 2. runSun = RunLengths(sunUp); runBoth = RunLengths(bothUp)       (computed once, not per day)
        // 3. for day d: SunH[site][d] = runSun[d * 24]; BothH[site][d] = runBoth[d * 24]
        // Do NOT recompute a timeline per day: 12 sites x 1800 days would be far too slow.
        throw new NotImplementedException();
    }

    /// <summary>NASA prefers sites "less sensitive to timing": fraction (0..1) of the days within
    /// +- bandWeeks of dayIndex whose window is at least stayDays long.</summary>
    public static double Robustness(float[] windowHoursRow, int dayIndex, int bandWeeks, double stayDays)
    {
        // TODO: lo = max(0, dayIndex - 7 * bandWeeks); hi = min(length - 1, dayIndex + 7 * bandWeeks)
        //       return count(i in lo..hi where row[i] >= stayDays * 24) / (double)(hi - lo + 1)
        throw new NotImplementedException();
    }

    /// <summary>
    /// THE feature of the product: "the launch slipped by slipWeeks, which site is best now?"
    /// </summary>
    public static FallbackDto BestFallback(HeatmapDto heatmap, DateTime date, int slipWeeks, double stayDays, bool requireEarth, int robustnessWeeks = 2)
    {
        // TODO:
        // 1. slipped = date + 7 * slipWeeks days; d = index of slipped in heatmap.Days
        //    (throw ArgumentOutOfRangeException if it is not in the heatmap)
        // 2. rows = requireEarth ? heatmap.BothH : heatmap.SunH
        // 3. for each site s: hours = rows[s][d]; viable = hours >= stayDays * 24
        //    nearest = the day closest to d (search d, d-1, d+1, d-2, d+2, ...) where rows[s][day] is viable, else null
        //    robustness = Robustness(rows[s], d, robustnessWeeks, stayDays)
        // 4. sort by hours, longest first; return new FallbackDto(date, slipped, entries)
        throw new NotImplementedException();
    }
}
