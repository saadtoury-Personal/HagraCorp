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

    // TODO(math reviewer): add one Sun Az/El value from JPL Horizons (quantity 4, CENTER='coord@301'),
    // asserted within 0.01 deg. The value must come from Horizons itself, not from this code.
}
