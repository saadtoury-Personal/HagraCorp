using LunarNav.Core;
using Xunit;

namespace LunarNav.Core.Tests;

public class GeometryTests
{
    private static EphemSample Sample(double sunLat, double sunLon, double earthLat, double earthLon, double rangeKm = 384400)
        => new(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), sunLat, sunLon, earthLat, earthLon, rangeKm);

    [Fact]
    public void DiskFraction_ZeroMargin_IsHalf()
    {
        Assert.Equal(0.5, Geometry.DiskFraction(0, 0.95), 12);
    }

    [Theory]
    [InlineData(-5.0, 20.0)]
    [InlineData(0.0, 0.0)]
    [InlineData(89.0, 123.0)]
    [InlineData(-89.9, 300.0)]
    public void EarthAzEl_NeverReturnsNaN(double siteLat, double siteLon)
    {
        var e = Sample(1.5, 10.0, 3.0, 5.0);
        var r = Geometry.EarthAzEl(e, siteLat, siteLon);
        Assert.False(double.IsNaN(r.AzDeg));
        Assert.False(double.IsNaN(r.ElDeg));
    }

    [Fact]
    public void EarthAzEl_SiteAtSubEarthPoint_IsNearZenith()
    {
        var e = Sample(0, 0, 10.0, 20.0);
        var r = Geometry.EarthAzEl(e, 10.0, 20.0);
        Assert.InRange(r.ElDeg, 89.99, 90.0);
    }

    [Fact]
    public void SunAzEl_SiteAtSubSunPoint_IsZenith()
    {
        var e = Sample(-5.0, 100.0, 0, 0);
        var r = Geometry.SunAzEl(e, -5.0, 100.0);
        Assert.Equal(90.0, r.ElDeg, 6);
    }

    [Fact]
    public void SunAzEl_SubSunDueNorthOnEquator_AzimuthIsZeroAndElevationFollowsLatitude()
    {
        // Sun straight over (lat 30, lon 0); observer at (0, 0): Sun due north, 60 deg above the horizon.
        var e = Sample(30.0, 0.0, 0, 0);
        var r = Geometry.SunAzEl(e, 0.0, 0.0);
        Assert.Equal(0.0, r.AzDeg, 6);
        Assert.Equal(60.0, r.ElDeg, 6);
    }

    // Reference from JPL Horizons itself (not from this code), queried 2026-11-15:
    // COMMAND='10', CENTER='coord@301', SITE_COORD='-23.3339,-86.3354,0' (Haworth), QUANTITIES='4', 2026-01-01 00:00 UTC
    // -> Azimuth 55.979209993, Elevation 3.399884409 (apparent, airless).
    // Sub-solar point = first row of wwwroot/data/ephem.csv at the same time.
    private const double HaworthLat = -86.3354, HaworthLon = -23.3339;
    private const double HorizonsAz = 55.979209993, HorizonsEl = 3.399884409;
    private static EphemSample Jan1() => Sample(-1.346422, 32.519634, -6.556142, 358.716549, 361045.116);

    [Fact]
    public void SunAzEl_Haworth_MatchesJplHorizons()
    {
        var r = Geometry.SunAzEl(Jan1(), HaworthLat, HaworthLon);
        Assert.InRange(r.AzDeg - HorizonsAz, -0.01, 0.01);
        Assert.InRange(r.ElDeg - HorizonsEl, -0.01, 0.01);
    }

    [Theory]
    [InlineData(0.1, 0.0)]    // sub-solar longitude off by 0.1 deg (wrong frame for the Sun)
    [InlineData(0.0, 0.1)]    // site longitude off by 0.1 deg (wrong frame for the site)
    public void SunAzEl_WrongFrameBy0_1Deg_IsCaughtByHorizonsCheck(double sunLonShift, double siteLonShift)
    {
        // Negative control: if a 0.1 deg frame error stayed inside the 0.01 deg tolerance, the check above would prove nothing.
        var e = Jan1() with { SubSunLonDeg = Jan1().SubSunLonDeg + sunLonShift };
        var r = Geometry.SunAzEl(e, HaworthLat, HaworthLon + siteLonShift);
        double error = Math.Max(Math.Abs(r.AzDeg - HorizonsAz), Math.Abs(r.ElDeg - HorizonsEl));
        Assert.True(error > 0.01, $"a 0.1 deg frame error gave only {error:F4} deg");
    }
}
