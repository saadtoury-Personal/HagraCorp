using LunarNav.Core;
using Xunit;

namespace LunarNav.Core.Tests;

/// <summary>Tests for the S tasks of plan-dev-final.md (S1-S5, S8-S12).</summary>
public class SaadTasksTests
{
    // Synthetic ephemeris: the Sun stays on the equator at longitude 0, the Earth on the equator at longitude 90.
    private static Ephemeris Eph(int hours) => new(Enumerable.Range(0, hours)
        .Select(h => new EphemSample(new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddHours(h), 0, 0, 0, 90, 384400)).ToArray());

    private static readonly Site Pole = new("p", "P", -89.5, 0, "test", "");   // Sun ~0.5 deg up, toward lon 0

    // ---- S3
    [Theory]
    [InlineData(0.3)]
    [InlineData(0.1)]
    [InlineData(0)]
    [InlineData(-0.15)]
    [InlineData(-0.3)]
    public void DiskFractionOverMask_FlatSkylineEqualsStraightFormula(double margin)
    {
        var flat = HorizonMask.Flat();
        Assert.Equal(Geometry.DiskFraction(margin, 0.27), Geometry.DiskFractionOverMask(flat, 123, margin, 0.27), 1e-9);
    }

    [Fact]
    public void DiskFractionOverMask_WallOnOneSideHidesAboutHalf()
    {
        var mask = HorizonMask.Flat();
        for (int i = 0; i < 200; i++)
            mask[i] = 5;   // 5 deg wall up to azimuth 99.5, open from 100 (the bins interpolate a ramp in between)
        // 1 deg disk centred at azimuth 99.75, 1 deg up: the centre-only formula sees a 2.5 deg skyline and says "all hidden".
        Assert.Equal(0, Geometry.DiskFraction(1 - HorizonMask.At(mask, 99.75), 1));
        Assert.InRange(Geometry.DiskFractionOverMask(mask, 99.75, 1, 1), 0.25, 0.5);   // left half hidden, most of the right half visible
    }

    // ---- S4
    [Fact]
    public void SunRadius_FollowsTheEarthSunDistance()
    {
        var radii = Enumerable.Range(0, 365).Select(d => Geometry.SunAngularRadiusAt(new DateTime(2027, 1, 1).AddDays(d))).ToArray();
        Assert.InRange(radii.Min(), 0.261, 0.263);   // aphelion, early July
        Assert.InRange(radii.Max(), 0.270, 0.272);   // perihelion, early January
        Assert.True(radii[2] > radii[183]);
    }

    // ---- S5
    [Fact]
    public void SunRules_EdgeCenterFull()
    {
        Assert.True(Analysis.SunUp(0.1, SunRule.Edge));
        Assert.False(Analysis.SunUp(0.1, SunRule.Center));
        Assert.True(Analysis.SunUp(0.6, SunRule.Center));
        Assert.False(Analysis.SunUp(0.99, SunRule.Full));
        Assert.True(Analysis.SunUp(1, SunRule.Full));
        Assert.False(Analysis.EarthUp(0.3, EarthRule.Center));
        Assert.True(Analysis.EarthUp(0.3));
    }

    // ---- S8
    [Fact]
    public void Margin_RangeContainsCentralValue()
    {
        var m = Analysis.Metrics(Eph(24 * 70), Pole, HorizonMask.Flat(), new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc), 2,
            marginDeg: Analysis.HorizonMarginDeg);
        Assert.NotNull(m.SunPctRange);
        Assert.InRange(m.SunPct, m.SunPctRange![0], m.SunPctRange[1]);
        Assert.False(m.CloseCall);   // Sun 0.5 deg up all the time: +-0.2 deg changes nothing
    }

    [Fact]
    public void Margin_VerdictFlipsGivesCloseCall()
    {
        var eph = Eph(24 * 70);
        var at = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        double el = Geometry.SunAzEl(eph.At(at), Pole.LatDeg, Pole.LonDeg).ElDeg;
        // Skyline so that the Sun's upper edge sits 0.1 deg above it: raising it by 0.2 deg hides the Sun.
        var mask = Enumerable.Repeat((float)(el + Geometry.SunAngularRadiusAt(at) - 0.1), HorizonMask.Bins).ToArray();
        var m = Analysis.Metrics(eph, Pole, mask, at, 2, marginDeg: Analysis.HorizonMarginDeg);
        Assert.True(m.Viable);
        Assert.True(m.CloseCall);
        Assert.Equal(0, m.SunPctRange![0]);
    }

    // ---- S9 + S10
    [Fact]
    public void Fallback_ToleranceShiftAndFlatSitesLast()
    {
        var days = Enumerable.Range(0, 10).Select(d => new DateTime(2027, 1, 1 + d, 0, 0, 0, DateTimeKind.Utc)).ToArray();
        float[] Row(string s) => s.Select(c => c == 'V' ? 400f : 0f).ToArray();
        var rows = new[] { Row("..VVVV...."), Row("........V."), Row("VVVVVVVVVV") };
        var heat = new HeatmapDto(new[] { "a", "b", "flat" }, days, rows, rows);

        var r = Analysis.BestFallback(heat, days[3], 0, stayDays: 14, requireEarth: true, robustnessWeeks: 0,
            terrain: s => s != 2, closeCall: (s, _) => s == 0);

        var a = r.Ranked.Single(e => e.SiteId == "a");
        Assert.Equal(4, a.SlipToleranceDays);
        Assert.Equal(0, a.MinShiftToViableDays);
        Assert.True(a.CloseCall);
        var b = r.Ranked.Single(e => e.SiteId == "b");
        Assert.Equal(0, b.SlipToleranceDays);
        Assert.Equal(5, b.MinShiftToViableDays);
        Assert.Equal("flat", r.Ranked[^1].SiteId);   // longest window, but no relief map
        Assert.False(r.Ranked[^1].Terrain);
    }

    [Fact]
    public void Fallback_WindowReachingEndOfDataIsLowerBound()
    {
        var days = Enumerable.Range(0, 3).Select(d => new DateTime(2027, 1, 1 + d, 0, 0, 0, DateTimeKind.Utc)).ToArray();
        var row = new[] { 100f, 100f, (63 - 2) * 24f };   // last day: runs to the end of the 60-day look-ahead
        var heat = new HeatmapDto(new[] { "a" }, days, new[] { row }, new[] { row });
        Assert.False(Analysis.BestFallback(heat, days[0], 0, 1, true).Ranked[0].LowerBound);
        Assert.True(Analysis.BestFallback(heat, days[2], 0, 1, true).Ranked[0].LowerBound);
    }

    // ---- S2
    [Fact]
    public void Battery_AlwaysSunStaysFull()
    {
        var b = Analysis.SimulateBattery(DateTime.UnixEpoch, Enumerable.Repeat(1.0, 24 * 14).ToArray(), new BatteryParams());
        Assert.True(b.Viable);
        Assert.Equal(100, b.MinSocPct);
        Assert.Equal(0, b.MinBatteryWhToSurvive);
    }

    [Fact]
    public void Battery_NightLongerThanAutonomyFails()
    {
        // 30 h of night at 150 W = 4.5 kWh; a 5 kWh battery with a 20 % floor only has 4 kWh to give.
        var power = Enumerable.Repeat(1.0, 10).Concat(Enumerable.Repeat(0.0, 30)).Concat(Enumerable.Repeat(1.0, 10)).ToArray();
        var b = Analysis.SimulateBattery(DateTime.UnixEpoch, power, new BatteryParams());
        Assert.False(b.Viable);
        Assert.True(b.HoursBelowMin > 0);
        Assert.Equal(4500 / 0.8, b.MinBatteryWhToSurvive, 0);
        Assert.True(Analysis.SimulateBattery(DateTime.UnixEpoch, power, new BatteryParams(CapacityWh: 5700)).Viable);
    }

    [Fact]
    public void Battery_FromEphemerisUsesSunAndMask()
    {
        var eph = Eph(24 * 20);
        var at = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        Assert.True(Analysis.Battery(eph, Pole, HorizonMask.Flat(), at, 14, new BatteryParams()).Viable);
        var wall = Enumerable.Repeat(10f, HorizonMask.Bins).ToArray();
        Assert.False(Analysis.Battery(eph, Pole, wall, at, 14, new BatteryParams()).Viable);
    }

    // ---- S1
    [Fact]
    public void Uncertainty_OfficialIsInsideRangeAndFlatTerrainIsUniform()
    {
        var dem = new Dem(new short[7600 * 7600]);   // flat map
        var site = new Site("p", "P", -89.5, 0, "test", "");
        var eph = Eph(24 * 20);
        var from = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var u = Analysis.Uncertainty(eph, dem, site, HorizonMask.Compute(dem, site.LatDeg, site.LonDeg, 2), 2, from, from.AddDays(19),
            rings: [(100, 4)]);
        Assert.Equal(5, u.Points.Length);
        Assert.InRange(u.SunPct.Official, u.SunPct.Min, u.SunPct.Max);
        Assert.InRange(u.BothPct.Official, u.BothPct.Min, u.BothPct.Max);
        Assert.Equal(u.SunPct.Min, u.SunPct.Max, 1);
    }

    // ---- S11
    [Fact]
    public void Blockers_WallHidesTheSunAndIsReported()
    {
        var eph = Eph(24 * 3);
        var from = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var wall = Enumerable.Repeat(10f, HorizonMask.Bins).ToArray();
        var r = Analysis.Blockers(eph, Pole, wall, HorizonMask.Flat(), 2, from, from.AddDays(2));
        Assert.Equal(48, r.SunHoursFlat);
        Assert.Equal(0, r.SunHours);
        Assert.Equal(48, r.LostHours);
        Assert.Equal(100, r.LostPct);
        Assert.Equal(10, r.Top[0].HorizonElDeg);
        Assert.Equal(48, r.Mast10GainHours);   // the 10 m skyline here is flat
    }

    // ---- S12
    [Fact]
    public void RobustRanking_DominatingSiteAlwaysFirst()
    {
        var r = Analysis.RobustRanking(new[] { "best", "mid", "worst" },
            sunPct: new[] { 90.0, 50, 10 }, earthPct: new[] { 90.0, 50, 10 }, longestDark: new[] { 1.0, 20, 40 });
        Assert.Equal("best", r[0].SiteId);
        Assert.Equal(100, r[0].FirstPct);
        Assert.Equal(1, r[0].MeanRank);
        Assert.True(r[0].ParetoOptimal);
        Assert.False(r.Single(e => e.SiteId == "worst").ParetoOptimal);
    }

    [Fact]
    public void RobustRanking_TradeOffSitesShareFirstPlace()
    {
        var r = Analysis.RobustRanking(new[] { "sunny", "earthy" },
            sunPct: new[] { 90.0, 10 }, earthPct: new[] { 10.0, 90 }, longestDark: new[] { 5.0, 5 });
        Assert.All(r, e => Assert.True(e.ParetoOptimal));
        Assert.All(r, e => Assert.InRange(e.FirstPct, 40, 60));
    }

    // ---- S4 eclipses
    [Fact]
    public void EclipsedFraction_NoneOverlapFull()
    {
        Assert.Equal(0, Geometry.EclipsedFraction(2, 0.27, 0.95));
        Assert.Equal(1, Geometry.EclipsedFraction(0.3, 0.27, 0.95));   // Sun disk entirely behind the Earth
        double half = Geometry.EclipsedFraction(0.95, 0.27, 0.95);      // Earth's edge through the Sun's centre: about half
        Assert.InRange(half, 0.4, 0.5);                                  // a bit under half: the Earth's edge curves away
        Assert.True(Geometry.EclipsedFraction(1.0, 0.27, 0.95) < half);
    }

    // ---- S7: our Moon formula checked against the JPL Earth-Moon distance in ephem.csv
    [Fact]
    public void MoonTheory_MatchesJplDistance()
    {
        var eph = Ephemeris.ParseCsv(new StringReader(File.ReadAllText(FindData("ephem.csv"))));
        for (var t = eph.Start; t < eph.End; t = t.AddDays(3.7))
        {
            var e = eph.At(t);
            Assert.InRange(Geometry.MoonDistanceKm(t) / e.EarthRangeKm, 0.99, 1.01);
        }
    }

    [Fact]
    public void Dsn_MoonRisesAndSetsEveryDayAtGoldstone()
    {
        var start = new DateTime(2027, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        var el = Enumerable.Range(0, 48).Select(h => Geometry.MoonElevationFromEarth(start.AddHours(h), 35.4267, -116.89)).ToArray();
        Assert.Contains(el, x => x > 10);
        Assert.Contains(el, x => x < -10);
        Assert.All(el, x => Assert.InRange(x, -90, 90));
        // Three stations about 120 deg apart: the Moon is above 10 deg at one of them most of the time.
        double pct = Enumerable.Range(0, 24 * 30).Count(h => Analysis.DsnSeesMoon(start.AddHours(h))) / (24.0 * 30);
        Assert.InRange(pct, 0.75, 1);
    }

    // ---- S2 battery heatmap
    [Fact]
    public void BatterySurvival_CountsHoursUntilFloor()
    {
        // 150 W load, no Sun: 5 kWh down to 1 kWh floor takes 26.7 h -> 26 full hours above the floor.
        var dark = new double[100];
        Assert.Equal(26, Analysis.BatterySurvival(dark, new BatteryParams(), 1000)[0]);
        var sunny = Enumerable.Repeat(1.0, 100).ToArray();
        Assert.Equal(100, Analysis.BatterySurvival(sunny, new BatteryParams(), 1000)[0]);   // end of series
        Assert.Equal(50, Analysis.BatterySurvival(sunny, new BatteryParams(), 50)[0]);      // cap
    }

    [Fact]
    public void Heatmap_WithBatteryHasBattRows()
    {
        var eph = Eph(24 * 70);
        var h = Analysis.Heatmap(eph, new[] { Pole }, new[] { HorizonMask.Flat() }, eph.Start, eph.Start.AddDays(2), new BatteryParams());
        Assert.NotNull(h.BattH);
        Assert.Equal(3, h.BattH![0].Length);
        Assert.True(h.BattH[0][0] >= 24 * 60);   // Sun always up: survives the whole 60-day cap
    }

    // ---- S6
    [Fact]
    public void Metrics_DarkPeriodsHaveTenMinuteResolution()
    {
        var eph = Eph(24 * 70);
        var wall = Enumerable.Repeat(10f, HorizonMask.Bins).ToArray();
        var m = Analysis.Metrics(eph, Pole, wall, eph.Start.AddMinutes(20), 1);
        Assert.Equal(24, m.LongestDarkHours, 6);   // 144 steps of 10 min
        Assert.NotNull(m.DsnPct);
    }

    private static string FindData(string name)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var p = Path.Combine(dir.FullName, "LunarNav.Web", "wwwroot", "data", name);
            if (File.Exists(p)) return p;
        }
        throw new FileNotFoundException(name);
    }
}
