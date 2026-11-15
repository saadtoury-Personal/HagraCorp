using LunarNav.Core;
using Xunit;

namespace LunarNav.Core.Tests;

public class GapTests
{
    [Fact]
    public void SunUp_IsTheUpperEdge()
    {
        Assert.True(Analysis.SunUp(Geometry.DiskFraction(-0.26, Geometry.SunAngularRadiusDeg)));    // centre below, edge visible
        Assert.False(Analysis.SunUp(Geometry.DiskFraction(-0.27, Geometry.SunAngularRadiusDeg)));   // whole disk below
    }

    [Fact]
    public void BestStart_PicksTheBestHourOfTheDay()
    {
        var run = new int[48];
        run[9] = 100;   // landing at 09:00 of day 0 gives the longest window
        run[3] = 40;
        run[30] = 7;    // day 1, 06:00
        Assert.Equal((100, 9), Analysis.BestStart(run, 0));
        Assert.Equal((7, 6), Analysis.BestStart(run, 1));
    }

    [Fact]
    public void BestFallback_TieBrokenByShortestDarkAndVerdictBeforeKept()
    {
        var days = Enumerable.Range(0, 8).Select(d => new DateTime(2027, 1, 1 + d, 0, 0, 0, DateTimeKind.Utc)).ToArray();
        var full = Enumerable.Repeat(400f, 8).ToArray();
        var lost = Enumerable.Range(0, 8).Select(d => d < 7 ? 400f : 0f).ToArray();   // viable today, not after 1 week
        var heat = new HeatmapDto(new[] { "dark", "bright", "slips" }, days,
            new[] { full, full, lost }, new[] { full, full, lost });

        var r = Analysis.BestFallback(heat, days[0], slipWeeks: 1, stayDays: 14, requireEarth: true, robustnessWeeks: 0,
            longestDark: (s, _) => s == 0 ? 30 : 5);

        Assert.Equal("bright", r.Ranked[0].SiteId);   // same window as "dark", shorter night
        Assert.Equal(5, r.Ranked[0].LongestDarkHours);
        var slips = r.Ranked.Single(e => e.SiteId == "slips");
        Assert.True(slips.ViableBefore);
        Assert.False(slips.Viable);
        Assert.Equal(400, slips.WindowHoursBefore);
    }
}
