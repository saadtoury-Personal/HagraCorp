namespace LunarNav.Core;

/// <summary>
/// Turns sky positions into answers: timelines, countdowns, mission windows, the slip heatmap and the fallback ranking.
/// Two definitions used everywhere in this file:
///   "Sun up"        = sunFrac   >  0     (upper edge of the Sun above the terrain, as in the design document)
///   "Earth in view" = earthFrac >  0     (any part of the Earth above the terrain)
/// </summary>
public static class Analysis
{
    public const double ViperMaxDarkHours = 50;
    public const double SolarConstantWm2 = 1361;

    /// <summary>Dark gaps this short are bridged (batteries) when measuring continuous windows.
    /// Without it, near-pole windows flip between hours and weeks for a 0.05 deg horizon change.</summary>
    public const int MaxGapHours = 6;

    /// <summary>"Sun up" = any part of the Sun's disk above the terrain (its upper edge is visible).
    /// No atmosphere, so no refraction: the edge test is purely geometric.</summary>
    public static bool SunUp(double sunFrac) => sunFrac > 0;

    /// <summary>S5: Sun up under a chosen rule. Edge = any part (default), Center = half the disk, Full = the whole disk.</summary>
    public static bool SunUp(double sunFrac, SunRule rule) => rule switch
    {
        SunRule.Center => sunFrac >= 0.5,
        SunRule.Full => sunFrac >= 1 - 1e-9,
        _ => sunFrac > 0,
    };

    /// <summary>S5: Earth in view under a chosen rule. Any = any part (default), Center = half the disk.</summary>
    public static bool EarthUp(double earthFrac, EarthRule rule = EarthRule.Any) =>
        rule == EarthRule.Center ? earthFrac >= 0.5 : earthFrac > 0;

    /// <summary>S8: horizon error used for the margin: the whole skyline is raised and lowered by this much.</summary>
    public const double HorizonMarginDeg = 0.2;

    /// <summary>Copy of the skyline moved up (positive) or down (negative) by deg.</summary>
    public static float[] Shift(float[] mask, double deg) => mask.Select(x => (float)(x + deg)).ToArray();

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
        // S3 + S4: each disk is compared with the skyline across its own width, the Sun's size follows the Earth-Sun distance.
        double sunFrac = Geometry.DiskFractionOverMask(mask, sun.AzDeg, sun.ElDeg, Geometry.SunAngularRadiusAt(t));
        double earthR = Geometry.EarthAngularRadiusDeg(e.EarthRangeKm);
        double earthFrac = Geometry.DiskFractionOverMask(mask, earth.AzDeg, earth.ElDeg, earthR);
        // S4 eclipses: the Earth in front of the Sun (a lunar eclipse seen from the Moon). Small error: the covered part
        // might already be behind the terrain; only matters a few hours a year.
        sunFrac *= 1 - Geometry.EclipsedFraction(Geometry.SeparationDeg(sun, earth), Geometry.SunAngularRadiusAt(t), earthR);
        return new TimelinePoint(t, sun.AzDeg, sun.ElDeg, sunFrac, earth.AzDeg, earth.ElDeg, earthFrac,
            PowerIndex(sunFrac, sun.ElDeg, trackingPanel: true));
    }

    /// <summary>Hourly Sun-up / Earth-in-view flags from start, at most 'hours' values, cut at the end of the ephemeris.</summary>
    internal static (bool[] SunUp, bool[] EarthUp) UpSeries(Ephemeris eph, Site site, float[] mask, DateTime start, int hours,
        SunRule sunRule = SunRule.Edge, EarthRule earthRule = EarthRule.Any, int stepMinutes = 60)
    {
        // 'hours' is really a number of steps; with the default 60-minute step it is hours.
        int n = Math.Max(0, Math.Min(hours, (int)Math.Floor((eph.End - start).TotalMinutes / stepMinutes) + 1));
        var sunUp = new bool[n];
        var earthUp = new bool[n];
        for (int k = 0; k < n; k++)
        {
            var p = Point(eph, site, mask, start.AddMinutes(k * stepMinutes));
            sunUp[k] = SunUp(p.SunFrac, sunRule);
            earthUp[k] = EarthUp(p.EarthFrac, earthRule);
        }
        return (sunUp, earthUp);
    }

    /// <summary>Illuminated fraction of the Moon's disk seen from Earth, in percent (0 = new, 100 = full).
    /// Same value as NASA Dial-A-Moon's "phase": (1 + cos of the angle between sub-solar and sub-Earth points) / 2.</summary>
    public static double MoonPhasePercent(EphemSample e)
    {
        var s = Geometry.UnitVector(e.SubSunLatDeg, e.SubSunLonDeg);
        var t = Geometry.UnitVector(e.SubEarthLatDeg, e.SubEarthLonDeg);
        return 50 * (1 + s.X * t.X + s.Y * t.Y + s.Z * t.Z);
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
    public static DateTime? NextCrossing(Ephemeris eph, Site site, float[] mask, DateTime from, bool sun, bool rising, int maxDays = 60,
        SunRule sunRule = SunRule.Edge, EarthRule earthRule = EarthRule.Any)
    {
        bool Up(DateTime t)
        {
            var p = Point(eph, site, mask, t);
            return sun ? SunUp(p.SunFrac, sunRule) : EarthUp(p.EarthFrac, earthRule);
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

    /// <summary>Longest continuous Sun-down period (hours) during a stay starting at 'at'. Used to break ties between fallback sites.</summary>
    public static int LongestDarkHours(Ephemeris eph, Site site, float[] mask, DateTime at, double stayDays)
    {
        var (sunUp, _) = UpSeries(eph, site, mask, at, Math.Max(1, (int)Math.Round(stayDays * 24)));
        return LongestRun(sunUp.Select(x => !x).ToArray());
    }

    /// <summary>Everything the detail view shows for "arrive at 'at', stay stayDays".
    /// S8: with marginDeg > 0 the metrics are also computed with the skyline raised and lowered by marginDeg,
    /// and the result carries SunPctRange, HoursToSunsetRange and CloseCall.</summary>
    public static SiteMetrics Metrics(Ephemeris eph, Site site, float[] mask, DateTime at, double stayDays,
        SunRule sunRule = SunRule.Edge, EarthRule earthRule = EarthRule.Any, double marginDeg = 0)
    {
        var m = MetricsCore(eph, site, mask, at, stayDays, sunRule, earthRule);
        if (marginDeg <= 0)
            return m;
        var all = new[] { m, MetricsCore(eph, site, Shift(mask, marginDeg), at, stayDays, sunRule, earthRule),
            MetricsCore(eph, site, Shift(mask, -marginDeg), at, stayDays, sunRule, earthRule) };
        var sunsets = all.Select(x => x.HoursToSunset).ToArray();
        return m with
        {
            SunPctRange = [all.Min(x => x.SunPct), all.Max(x => x.SunPct)],
            HoursToSunsetRange = sunsets.Any(x => x is null) ? [sunsets.Min(), null] : [sunsets.Min(), sunsets.Max()],
            CloseCall = all.Any(x => x.Viable != m.Viable),
        };
    }

    private static SiteMetrics MetricsCore(Ephemeris eph, Site site, float[] mask, DateTime at, double stayDays,
        SunRule sunRule, EarthRule earthRule)
    {
        double? Hours(DateTime? x) => x is null ? null : (x.Value - at).TotalHours;

        // S6: stay statistics every 10 minutes (the ephemeris is interpolated); windows below stay hourly.
        const int step = 10;
        var (sunUp, earthUp) = UpSeries(eph, site, mask, at, Math.Max(1, (int)Math.Round(stayDays * 24 * 60 / step)), sunRule, earthRule, step);
        int n = sunUp.Length;
        if (n == 0)
            throw new ArgumentOutOfRangeException(nameof(at), "date is outside the ephemeris");

        var sunDown = sunUp.Select(x => !x).ToArray();
        var bothDown = sunUp.Zip(earthUp, (s, e) => !s && !e).ToArray();
        double longestDarkNoEarth = LongestRun(bothDown) * step / 60.0;
        int dsn = 0;
        for (int k = 0; k < n; k++)
            if (earthUp[k] && DsnSeesMoon(at.AddMinutes(k * step)))
                dsn++;

        // Windows look up to 60 days ahead, not only over the stay.
        var (s60, e60) = UpSeries(eph, site, mask, at, 60 * 24, sunRule, earthRule);
        int windowSun = RunLengths(BridgeGaps(s60, MaxGapHours)).FirstOrDefault();
        int windowBoth = RunLengths(BridgeGaps(s60.Zip(e60, (s, e) => s && e).ToArray(), MaxGapHours)).FirstOrDefault();

        return new SiteMetrics(at,
            Hours(NextCrossing(eph, site, mask, at, sun: true, rising: false, sunRule: sunRule, earthRule: earthRule)),
            Hours(NextCrossing(eph, site, mask, at, sun: true, rising: true, sunRule: sunRule, earthRule: earthRule)),
            Hours(NextCrossing(eph, site, mask, at, sun: false, rising: false, sunRule: sunRule, earthRule: earthRule)),
            Hours(NextCrossing(eph, site, mask, at, sun: false, rising: true, sunRule: sunRule, earthRule: earthRule)),
            100.0 * sunUp.Count(x => x) / n,
            100.0 * earthUp.Count(x => x) / n,
            100.0 * bothDown.Count(x => x) / n,
            LongestRun(sunDown) * step / 60.0,
            longestDarkNoEarth,
            longestDarkNoEarth > ViperMaxDarkHours,
            windowSun,
            windowBoth,
            windowSun >= stayDays * 24,
            WindowLowerBound: windowSun >= s60.Length || windowBoth >= s60.Length,
            DsnPct: 100.0 * dsn / n);
    }

    /// <summary>S7: NASA Deep Space Network complexes (geodetic lat, east lon).</summary>
    public static readonly (string Name, double LatDeg, double LonDeg)[] DsnStations =
        [("Goldstone", 35.4267, -116.8900), ("Madrid", 40.4314, -4.2481), ("Canberra", -35.4014, 148.9817)];

    public const double DsnMinElevationDeg = 10;

    /// <summary>True when at least one DSN complex sees the Moon above 10 deg.</summary>
    public static bool DsnSeesMoon(DateTime utc) =>
        DsnStations.Any(s => Geometry.MoonElevationFromEarth(utc, s.LatDeg, s.LonDeg) > DsnMinElevationDeg);

    /// <summary>True when landing at 'landing' gives stayDays of continuous Sun (and Earth when requireEarth), gaps &lt;= 6 h bridged.</summary>
    public static bool ViableAt(Ephemeris eph, Site site, float[] mask, DateTime landing, double stayDays, bool requireEarth)
    {
        int need = (int)Math.Ceiling(stayDays * 24);
        var (sunUp, earthUp) = UpSeries(eph, site, mask, landing, need + MaxGapHours + 1);   // + gap so a dark gap at the end can be bridged
        var ok = requireEarth ? sunUp.Zip(earthUp, (a, b) => a && b).ToArray() : sunUp;
        return RunLengths(BridgeGaps(ok, MaxGapHours)).FirstOrDefault() >= need;
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
    /// The slip heatmap: for every site and every day from 'from' to 'to', the longest continuous Sun
    /// (and Sun + Earth) window you get by landing at the best hour of that day (UTC). The best hour is returned too.
    /// masks[i] is the skyline of sites[i].
    /// </summary>
    public static HeatmapDto Heatmap(Ephemeris eph, IReadOnlyList<Site> sites, IReadOnlyList<float[]> masks, DateTime from, DateTime to,
        BatteryParams? battery = null)
    {
        if (sites.Count != masks.Count)
            throw new ArgumentException("one mask per site", nameof(masks));
        var start = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc);
        int nDays = (int)(to.Date - from.Date).TotalDays + 1;
        var days = Enumerable.Range(0, nDays).Select(d => start.AddDays(d)).ToArray();
        int hours = (nDays + 60) * 24;   // 60 extra days to finish runs still going

        var sunH = new float[sites.Count][];
        var bothH = new float[sites.Count][];
        var sunHour = new int[sites.Count][];
        var bothHour = new int[sites.Count][];
        var battH = battery is null ? null : new float[sites.Count][];
        var battHour = battery is null ? null : new int[sites.Count][];
        Parallel.For(0, sites.Count, s =>
        {
            var (sunUp, earthUp) = UpSeries(eph, sites[s], masks[s], start, hours);
            var runSun = RunLengths(BridgeGaps(sunUp, MaxGapHours));
            var runBoth = RunLengths(BridgeGaps(sunUp.Zip(earthUp, (a, b) => a && b).ToArray(), MaxGapHours));
            (sunH[s], sunHour[s]) = PerDay(runSun, nDays);
            (bothH[s], bothHour[s]) = PerDay(runBoth, nDays);
            if (battery is not null)
            {
                var power = new double[sunUp.Length];
                for (int k = 0; k < power.Length; k++)
                    power[k] = Point(eph, sites[s], masks[s], start.AddHours(k)).Power;
                (battH![s], battHour![s]) = PerDay(BatterySurvival(power, battery, 60 * 24), nDays);
            }
        });
        return new HeatmapDto(sites.Select(x => x.Id).ToArray(), days, sunH, bothH, sunHour, bothHour, battH, battHour);
    }

    private static (float[] Hours, int[] StartHour) PerDay(int[] run, int nDays)
    {
        var hours = new float[nDays];
        var startHour = new int[nDays];
        for (int d = 0; d < nDays; d++)
            (hours[d], startHour[d]) = BestStart(run, d);
        return (hours, startHour);
    }

    /// <summary>Longest run starting during day 'day' (24 hourly starts) and the hour (0..23 UTC) it starts at.
    /// Ties keep the earliest hour.</summary>
    public static (int Hours, int Hour) BestStart(int[] run, int day)
    {
        int best = 0, bestHour = 0;
        for (int h = 0; h < 24 && day * 24 + h < run.Length; h++)
        {
            if (run[day * 24 + h] > best)
            {
                best = run[day * 24 + h];
                bestHour = h;
            }
        }
        return (best, bestHour);
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
    /// Ranked by window length, then by the shortest longest-dark period (when 'longestDark' is given), then by robustness.
    /// longestDark(siteIndex, landingTime) is computed on demand by the caller (it needs the ephemeris and masks).
    /// Each entry also carries its window and verdict on the original date, so the UI can mark sites whose verdict changed.
    /// S9: each entry also says how many days around the slipped date stay viable, the smallest shift that makes it viable,
    /// and whether its window is only a lower bound (reaches the end of the data).
    /// S10: terrain(siteIndex) = false (no relief map, flat skyline) puts the site after every real one.
    /// S8: closeCall(siteIndex, landingTime) = verdict flips inside the horizon margin, computed on demand by the caller.</summary>
    public static FallbackDto BestFallback(HeatmapDto heatmap, DateTime date, int slipWeeks, double stayDays, bool requireEarth,
        int robustnessWeeks = 2, Func<int, DateTime, double>? longestDark = null,
        Func<int, bool>? terrain = null, Func<int, DateTime, bool?>? closeCall = null)
    {
        var slipped = date.AddDays(7 * slipWeeks);
        int d = Array.FindIndex(heatmap.Days, x => x.Date == slipped.Date);
        int d0 = Array.FindIndex(heatmap.Days, x => x.Date == date.Date);
        if (d < 0 || d0 < 0)
            throw new ArgumentOutOfRangeException(nameof(date), "date or slipped date is outside the heatmap");

        var rows = requireEarth ? heatmap.BothH : heatmap.SunH;
        var startHours = requireEarth ? heatmap.BothStartHour : heatmap.SunStartHour;
        double need = stayDays * 24;
        var dataEnd = heatmap.Days[0].AddDays(heatmap.Days.Length + 60);   // the heatmap looks 60 days past its last day
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
            var landing = heatmap.Days[d].AddHours(startHours?[s][d] ?? 0);
            int lo = d, hi = d;
            if (row[d] >= need)
            {
                while (lo > 0 && row[lo - 1] >= need) lo--;
                while (hi < row.Length - 1 && row[hi + 1] >= need) hi++;
            }
            entries[s] = new FallbackEntry(heatmap.Sites[s], row[d], row[d] >= need, nearest,
                Robustness(row, d, robustnessWeeks, stayDays),
                longestDark?.Invoke(s, landing) ?? 0, row[d0], row[d0] >= need,
                SlipToleranceDays: row[d] >= need ? hi - lo + 1 : 0,
                MinShiftToViableDays: nearest is null ? null : (int)Math.Round((nearest.Value.Date - heatmap.Days[d].Date).TotalDays),
                LowerBound: landing.AddHours(row[d]) >= dataEnd.AddHours(-1),
                Terrain: terrain?.Invoke(s) ?? true,
                CloseCall: closeCall?.Invoke(s, landing));
        }
        var ranked = entries.OrderByDescending(e => e.Terrain).ThenByDescending(e => e.WindowHours).ThenBy(e => e.LongestDarkHours)
            .ThenByDescending(e => e.Robustness).ToArray();
        return new FallbackDto(date, slipped, ranked);
    }

    // ---------------------------------------------------------------- S2: battery

    /// <summary>Hour-by-hour battery from a power index series (one value per hour, see PowerIndex). Starts full.
    /// Energy in = index * 1361 W/m2 * panel * efficiency, energy out = constant load; the charge stays within [0, capacity].</summary>
    public static BatteryDto SimulateBattery(DateTime start, double[] powerIndex, BatteryParams p)
    {
        double soc = p.CapacityWh, minSoc = 100, deficit = 0, maxDeficit = 0;
        int below = 0;
        var series = new BatteryPoint[powerIndex.Length];
        for (int k = 0; k < powerIndex.Length; k++)
        {
            double genW = powerIndex[k] * SolarConstantWm2 * p.PanelM2 * p.Efficiency;
            soc = Math.Clamp(soc + genW - p.LoadW, 0, p.CapacityWh);          // 1 h step: W * 1 h = Wh
            deficit = Math.Max(0, deficit + p.LoadW - genW);                    // energy missing since the battery was last full
            maxDeficit = Math.Max(maxDeficit, deficit);
            double pct = 100 * soc / p.CapacityWh;
            minSoc = Math.Min(minSoc, pct);
            if (pct < p.MinSocPct)
                below++;
            series[k] = new BatteryPoint(start.AddHours(k), Math.Round(pct, 2), Math.Round(genW, 1));
        }
        // A battery C starting full never drops under minSoc * C iff C - maxDeficit >= minSoc * C.
        double minBattery = maxDeficit / (1 - p.MinSocPct / 100);
        return new BatteryDto(below == 0, Math.Round(minSoc, 2), below, series.Length == 0 ? 100 : series[^1].SocPct,
            Math.Round(minBattery), p, series);
    }

    /// <summary>For each start hour: hours the battery (starting full) stays at or above its floor, capped at maxHours
    /// and at the end of the series.</summary>
    public static int[] BatterySurvival(double[] powerIndex, BatteryParams p, int maxHours)
    {
        var r = new int[powerIndex.Length];
        double floor = p.CapacityWh * p.MinSocPct / 100;
        for (int i = 0; i < powerIndex.Length; i++)
        {
            double soc = p.CapacityWh;
            int k = i;
            for (; k < powerIndex.Length && k - i < maxHours; k++)
            {
                soc = Math.Min(p.CapacityWh, soc + powerIndex[k] * SolarConstantWm2 * p.PanelM2 * p.Efficiency - p.LoadW);
                if (soc < floor)
                    break;
            }
            r[i] = k - i;
        }
        return r;
    }

    /// <summary>Battery over a stay starting at 'at' (vertical Sun-tracking panel).</summary>
    public static BatteryDto Battery(Ephemeris eph, Site site, float[] mask, DateTime at, double stayDays, BatteryParams p)
    {
        int n = Math.Min((int)Math.Round(stayDays * 24), (int)Math.Floor((eph.End - at).TotalHours) + 1);
        if (n <= 0 || at < eph.Start)
            throw new ArgumentOutOfRangeException(nameof(at), "date is outside the ephemeris");
        var power = new double[n];
        for (int k = 0; k < n; k++)
            power[k] = Point(eph, site, mask, at.AddHours(k)).Power;
        return SimulateBattery(at, power, p);
    }

    // ---------------------------------------------------------------- S1: position uncertainty

    /// <summary>Sun %, Earth %, Sun-and-Earth % (hourly) and the percent of days with a 14-day Sun + Earth window, over [from, to).</summary>
    public static (double Sun, double Earth, double Both, double Viable14) SkyStats(Ephemeris eph, Site site, float[] mask, DateTime from, DateTime to)
    {
        var (sunUp, earthUp) = UpSeries(eph, site, mask, from, (int)(to - from).TotalHours);
        int n = sunUp.Length;
        if (n == 0)
            throw new ArgumentOutOfRangeException(nameof(from), "period is outside the ephemeris");
        var both = sunUp.Zip(earthUp, (a, b) => a && b).ToArray();
        var run = RunLengths(BridgeGaps(both, MaxGapHours));
        int days = Math.Max(1, (n - 14 * 24) / 24), ok = 0;
        for (int d = 0; d < days; d++)
            if (BestStart(run, d).Hours >= 14 * 24)
                ok++;
        return (100.0 * sunUp.Count(x => x) / n, 100.0 * earthUp.Count(x => x) / n, 100.0 * both.Count(x => x) / n, 100.0 * ok / days);
    }

    /// <summary>Default rings around a site: 8 points at 100 m, 16 at 250 m, 16 at 500 m.</summary>
    public static readonly (int RadiusM, int Count)[] UncertaintyRings = [(100, 8), (250, 16), (500, 16)];

    /// <summary>
    /// S1: the same statistics at the official point and on rings around it (each ring point gets its own skyline from the DEM).
    /// Ring points outside the map are skipped. Best = point with the most Sun.
    /// </summary>
    public static UncertaintyDto Uncertainty(Ephemeris eph, Dem dem, Site site, float[] officialMask, int mastM, DateTime from, DateTime to,
        (int RadiusM, int Count)[]? rings = null)
    {
        rings ??= UncertaintyRings;
        var places = new List<(double Lat, double Lon, double DistM, double Bearing)> { (site.LatDeg, site.LonDeg, 0, 0) };
        foreach (var (radius, count) in rings)
            for (int k = 0; k < count; k++)
            {
                double bearing = 360.0 * k / count;
                var (lat, lon) = HorizonMask.Destination(site.LatDeg, site.LonDeg, bearing, radius / 1000.0);
                places.Add((lat, (lon % 360 + 360) % 360, radius, bearing));
            }

        var points = new UncertaintyPoint?[places.Count];
        Parallel.For(0, places.Count, new ParallelOptions { MaxDegreeOfParallelism = 4 }, i =>
        {
            var (lat, lon, dist, bearing) = places[i];
            float[] mask;
            try { mask = i == 0 ? officialMask : HorizonMask.Compute(dem, lat, lon, mastM); }
            catch (ArgumentException) { return; }   // outside the map
            var st = SkyStats(eph, site with { LatDeg = lat, LonDeg = lon }, mask, from, to);
            points[i] = new UncertaintyPoint(Math.Round(lat, 5), Math.Round(lon, 5), dist, bearing,
                Math.Round(st.Sun, 2), Math.Round(st.Earth, 2), Math.Round(st.Both, 2), Math.Round(st.Viable14, 2));
        });
        var all = points.Where(x => x is not null).Select(x => x!).ToArray();
        var o = all[0];
        PctRange R(Func<UncertaintyPoint, double> f) => new(f(o), all.Min(f), all.Max(f));
        return new UncertaintyDto(site.Id, mastM, rings.Select(r => r.RadiusM).ToArray(),
            R(x => x.SunPct), R(x => x.EarthPct), R(x => x.BothPct), R(x => x.Viable14Pct),
            all.MaxBy(x => x.SunPct)!, all);
    }

    // ---------------------------------------------------------------- S11: what the relief costs

    /// <summary>
    /// S11: hourly over [from, to): Sun hours with a flat skyline vs the real one (mask2 or mask10, chosen by mastM),
    /// the 10-deg azimuth sectors where the Sun is hidden most, and the Sun hours a 10 m mast wins back over 2 m.
    /// </summary>
    public static BlockersDto Blockers(Ephemeris eph, Site site, float[] mask2, float[] mask10, int mastM, DateTime from, DateTime to, int top = 3)
    {
        var mask = mastM == 10 ? mask10 : mask2;
        var flat = HorizonMask.Flat();
        int n = Math.Min((int)(to - from).TotalHours, (int)Math.Floor((eph.End - from).TotalHours) + 1);
        if (n <= 0 || from < eph.Start)
            throw new ArgumentOutOfRangeException(nameof(from), "period is outside the ephemeris");
        int upFlat = 0, up = 0, up2 = 0, up10 = 0;
        var lostBySector = new int[36];
        for (int k = 0; k < n; k++)
        {
            var t = from.AddHours(k);
            var sun = Geometry.SunAzEl(eph.At(t), site.LatDeg, site.LonDeg);
            double r = Geometry.SunAngularRadiusAt(t);
            bool f = SunUp(Geometry.DiskFractionOverMask(flat, sun.AzDeg, sun.ElDeg, r));
            bool a = SunUp(Geometry.DiskFractionOverMask(mask2, sun.AzDeg, sun.ElDeg, r));
            bool b = SunUp(Geometry.DiskFractionOverMask(mask10, sun.AzDeg, sun.ElDeg, r));
            bool real = mastM == 10 ? b : a;
            if (f) upFlat++;
            if (real) up++;
            if (a) up2++;
            if (b) up10++;
            if (f && !real)
                lostBySector[(int)(sun.AzDeg / 10) % 36]++;
        }
        var blockers = Enumerable.Range(0, 36).Where(i => lostBySector[i] > 0).OrderByDescending(i => lostBySector[i]).Take(top)
            .Select(i => new Blocker(i * 10, i * 10 + 10, lostBySector[i], Math.Round(mask.Skip(i * 20).Take(20).Max(), 2))).ToArray();
        return new BlockersDto(site.Id, mastM, from, from.AddHours(n), upFlat, up, upFlat - up,
            upFlat == 0 ? 0 : Math.Round(100.0 * (upFlat - up) / upFlat, 2), blockers, up10 - up2);
    }

    // ---------------------------------------------------------------- S12: robust ranking

    /// <summary>
    /// S12: which sites stay on top whatever weight you give to Sun, Earth and the longest night.
    /// Criteria are rescaled to 0..1 across sites; weights are drawn uniformly on the simplex (fixed seed, so the answer is stable).
    /// Ranked by FirstPct, then MeanRank.
    /// </summary>
    public static RankEntry[] RobustRanking(string[] ids, double[] sunPct, double[] earthPct, double[] longestDark, int samples = 2000, int seed = 42)
    {
        int n = ids.Length;
        double[] Norm(double[] v, bool lowerIsBetter)
        {
            double min = v.Min(), max = v.Max();
            return v.Select(x => max == min ? 1 : lowerIsBetter ? (max - x) / (max - min) : (x - min) / (max - min)).ToArray();
        }
        var c = new[] { Norm(sunPct, false), Norm(earthPct, false), Norm(longestDark, true) };
        var rng = new Random(seed);
        var first = new int[n];
        var rankSum = new double[n];
        var score = new double[n];
        var order = new int[n];
        for (int k = 0; k < samples; k++)
        {
            double w0 = -Math.Log(1 - rng.NextDouble()), w1 = -Math.Log(1 - rng.NextDouble()), w2 = -Math.Log(1 - rng.NextDouble());
            for (int i = 0; i < n; i++)
            {
                score[i] = (w0 * c[0][i] + w1 * c[1][i] + w2 * c[2][i]) / (w0 + w1 + w2);
                order[i] = i;
            }
            Array.Sort(order, (a, b) => score[b] != score[a] ? score[b].CompareTo(score[a]) : a.CompareTo(b));
            first[order[0]]++;
            for (int r = 0; r < n; r++)
                rankSum[order[r]] += r + 1;
        }
        bool Dominated(int i) => Enumerable.Range(0, n).Any(j => j != i
            && sunPct[j] >= sunPct[i] && earthPct[j] >= earthPct[i] && longestDark[j] <= longestDark[i]
            && (sunPct[j] > sunPct[i] || earthPct[j] > earthPct[i] || longestDark[j] < longestDark[i]));
        return Enumerable.Range(0, n)
            .Select(i => new RankEntry(ids[i], Math.Round(sunPct[i], 2), Math.Round(earthPct[i], 2), longestDark[i], !Dominated(i),
                Math.Round(100.0 * first[i] / samples, 1), Math.Round(rankSum[i] / samples, 2)))
            .OrderByDescending(e => e.FirstPct).ThenBy(e => e.MeanRank).ToArray();
    }

    /// <summary>S12 over real sites: Sun %, Earth % and longest night of a stay starting at 'at' for every site, then RobustRanking.</summary>
    public static RankingDto Ranking(Ephemeris eph, IReadOnlyList<Site> sites, IReadOnlyList<float[]> masks, DateTime at, double stayDays)
    {
        if (at < eph.Start || at > eph.End)
            throw new ArgumentOutOfRangeException(nameof(at), "date is outside the ephemeris");   // here, not inside Parallel.For
        int hours = Math.Max(1, (int)Math.Round(stayDays * 24));
        var sun = new double[sites.Count];
        var earth = new double[sites.Count];
        var dark = new double[sites.Count];
        Parallel.For(0, sites.Count, i =>
        {
            var (s, e) = UpSeries(eph, sites[i], masks[i], at, hours);
            sun[i] = 100.0 * s.Count(x => x) / s.Length;
            earth[i] = 100.0 * e.Count(x => x) / e.Length;
            dark[i] = LongestRun(s.Select(x => !x).ToArray());
        });
        const int samples = 2000;
        return new RankingDto(at, stayDays, samples, RobustRanking(sites.Select(x => x.Id).ToArray(), sun, earth, dark, samples));
    }
}
