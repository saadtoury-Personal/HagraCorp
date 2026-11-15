using LunarNav.Core;
using Xunit;

namespace LunarNav.Core.Tests;

public class AnalysisTests
{
    private static bool[] B(string s) => s.Select(c => c == 'T').ToArray();

    [Fact]
    public void RunLengths_CountsForward() => Assert.Equal(new[] { 2, 1, 0, 1 }, Analysis.RunLengths(B("TTFT")));

    [Fact]
    public void LongestRun_FindsLongest()
    {
        Assert.Equal(2, Analysis.LongestRun(B("TFTT")));
        Assert.Equal(0, Analysis.LongestRun(Array.Empty<bool>()));
    }

    [Theory]
    [InlineData("TFFT", 2, "TTTT")]
    [InlineData("TFFT", 1, "TFFT")]
    [InlineData("FTFT", 6, "FTTT")]   // leading gap stays
    [InlineData("TFTF", 6, "TTTF")]   // trailing gap stays
    public void BridgeGaps_FillsOnlyShortInnerGaps(string input, int maxGap, string expected) =>
        Assert.Equal(B(expected), Analysis.BridgeGaps(B(input), maxGap));

    [Fact]
    public void Robustness_CountsViableDaysInBand()
    {
        var row = new float[30];
        for (int i = 10; i < 20; i++) row[i] = 24 * 14;
        Assert.Equal(1.0, Analysis.Robustness(row, 15, 0, 14));
        Assert.Equal(10.0 / 15, Analysis.Robustness(row, 14, 1, 14), 9);   // days 7..21: 10 viable of 15
    }

    [Fact]
    public void BestFallback_RanksLongestFirstAndFindsNearestViableDay()
    {
        var days = Enumerable.Range(0, 5).Select(d => new DateTime(2027, 1, 1 + d, 6, 0, 0, DateTimeKind.Utc)).ToArray();
        var heat = new HeatmapDto(new[] { "a", "b" }, days,
            new[] { new float[] { 0, 0, 0, 0, 400 }, new float[] { 400, 400, 400, 0, 0 } },
            new[] { new float[5], new float[5] });
        var r = Analysis.BestFallback(heat, days[0], slipWeeks: 0, stayDays: 14, requireEarth: false, robustnessWeeks: 0);

        Assert.Equal("b", r.Ranked[0].SiteId);
        Assert.True(r.Ranked[0].Viable);
        Assert.Equal(days[4], r.Ranked[1].NearestViableDate);
        Assert.Throws<ArgumentOutOfRangeException>(() => Analysis.BestFallback(heat, days[0], 1, 14, false));
    }

    [Fact]
    public void HorizonMaskAt_InterpolatesAndWraps()
    {
        var m = HorizonMask.Flat();
        Assert.Equal(720, m.Length);
        m[0] = 1; m[1] = 3; m[719] = 4;
        Assert.Equal(2, HorizonMask.At(m, 0.25), 9);
        Assert.Equal(2.5, HorizonMask.At(m, 359.75), 9);
        Assert.Equal(2, HorizonMask.At(m, -359.75), 9);
    }

    [Fact]
    public void Destination_OneDegreeNorthAndZeroDistance()
    {
        var (lat, lon) = HorizonMask.Destination(-89, 0, 0, Geometry.MoonRadiusKm * Math.PI / 180);
        Assert.Equal(-88, lat, 9);
        Assert.Equal(0, lon, 9);
        var (lat0, lon0) = HorizonMask.Destination(-86.3, 10, 123, 0);
        Assert.Equal(-86.3, lat0, 9);
        Assert.Equal(10, lon0, 9);
    }

    [Fact]
    public void Timeline_FlatHorizonApollo11_SunUpAboutHalfTheTime()
    {
        var csv = File.ReadAllText(FindData("ephem.csv"));
        var eph = Ephemeris.ParseCsv(new StringReader(csv));
        var site = new Site("apollo11", "Apollo 11", 0.674, 23.473, "apollo", "", Terrain: false);
        var start = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var pts = Analysis.Timeline(eph, site, HorizonMask.Flat(), start, start.AddDays(59), TimeSpan.FromHours(1));

        double sunPct = 100.0 * pts.Count(p => p.SunFrac >= 0.5) / pts.Length;
        Assert.InRange(sunPct, 45, 55);                       // equator: day and night about equal over 2 lunations
        Assert.All(pts, p => Assert.True(p.EarthFrac == 1));  // near-side site: Earth always overhead-ish
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
