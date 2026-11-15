using LunarNav.Api;
using LunarNav.Core;

namespace LunarNav.Tests;

public class ValidationTests
{
    // 30 days, hourly: the Sun circles the equator once (sub-solar longitude 0 -> 360), the Earth stays overhead of (0, 0).
    private static Ephemeris EquatorDay()
    {
        var t0 = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        int n = 30 * 24;
        return new Ephemeris(Enumerable.Range(0, n + 1)
            .Select(k => new EphemSample(t0.AddHours(k), 0, 360.0 * k / n % 360, 0, 0, 384400)).ToList());
    }

    private static readonly Site Equator = new("eq", "Equator", 0, 0, "test", "");

    [Fact]
    public void SkyPercent_FlatHorizonAtEquator_SunUpAboutHalfTheTime_EarthAlways()
    {
        var (sunEdge, sunCentre, earth) = Validation.SkyPercent(EquatorDay(), Equator, HorizonMask.Flat());
        // Edge rule: up a little more than half (the Sun's radius, ~0.27 deg of 180, is about +0.15 point).
        Assert.InRange(sunEdge, 49.5, 51.5);
        Assert.InRange(sunCentre, 49.0, 51.0);
        Assert.True(sunEdge >= sunCentre);
        Assert.Equal(100.0, earth);
    }

    [Fact]
    public void Verdict_FollowsComparePy()
    {
        Assert.Equal("OK", Validation.Verdict(53, [50, 60], 50, [45, 55], 5));
        Assert.Equal("explained", Validation.Verdict(70, [60, 80], 50, [30, 66], 5));   // ours inside PGDA 3x3 + 5
        Assert.Equal("explained", Validation.Verdict(80, [44, 90], 50, [49, 51], 5));   // PGDA inside our +-80 m range
        Assert.Equal("problem", Validation.Verdict(80, [78, 82], 50, [49, 51], 5));
    }

    [Fact]
    public void Mirror_SwapsEastAndWest_KeepsNorth()
    {
        var mask = new float[HorizonMask.Bins];
        mask[0] = 1;     // north
        mask[180] = 2;   // east (90 deg)
        var m = Validation.Mirror(mask);
        Assert.Equal(1, m[0]);
        Assert.Equal(2, m[540]);   // west (270 deg)
        Assert.Equal(0, m[180]);
    }

    [Fact]
    public void Controls_ChangeTheSunButKeepTheHourlyGrid()
    {
        var eph = EquatorDay();
        var rot = Validation.SunRotated(eph);
        Assert.Equal(180.0, rot.Samples[0].SubSunLonDeg, 9);
        Assert.Equal(eph.Samples.Count, rot.Samples.Count);

        var shifted = Validation.Shifted(eph, 14.77);
        Assert.Equal(eph.Start, shifted.Start);
        Assert.Equal(eph.At(eph.Start.AddDays(14.77)).SubSunLonDeg, shifted.Samples[0].SubSunLonDeg, 6);
        Assert.True(shifted.End <= eph.End.AddDays(-14.77));
    }

    [Fact]
    public void Neighbours_AreEightPointsOnePixelAway()
    {
        var dem = new Dem(new short[7600 * 7600]);
        var n = Validation.Neighbours(dem, -86.3354, -23.3339).ToList();
        Assert.Equal(8, n.Count);
        var (l0, s0) = dem.LatLonToPixel(-86.3354, -23.3339);
        Assert.All(n, p =>
        {
            var (l, s) = dem.LatLonToPixel(p.Lat, p.Lon);
            Assert.InRange(Math.Max(Math.Abs(l - l0), Math.Abs(s - s0)), 0.999, 1.001);
        });
    }

    [Fact]
    public void Compare_GivesBiasCountAndCorrelation()
    {
        var st = Validation.Compare([("a", 12, 10), ("b", 22, 20), ("c", 38, 30)], 5);
        Assert.Equal(3, st.N);
        Assert.Equal(2, st.Within);
        Assert.Equal(4.0, st.Bias);
        Assert.Equal(8.0, st.MaxAbs);
        Assert.Equal("c", st.MaxAbsSite);
        Assert.True(st.R > 0.99);
    }
}
