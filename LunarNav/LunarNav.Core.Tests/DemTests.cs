using LunarNav.Core;
using Xunit;

namespace LunarNav.Core.Tests;

public class DemTests
{
    // Small synthetic map: the pole sits at the centre of the grid (offsets = (n - 1) / 2).
    private static Dem SmallDem(short[] dn, int n = 4)
        => new(dn, n, n, mapScaleM: 80, lineOffset: (n - 1) / 2.0, sampleOffset: (n - 1) / 2.0, scaling: 0.5);

    [Fact]
    public void Constructor_WrongLength_Throws()
    {
        Assert.Throws<ArgumentException>(() => new Dem(new short[10], 4, 4));
    }

    [Fact]
    public void LatLonToPixel_Pole_IsAtMapCentre()
    {
        var dem = new Dem(new short[7600 * 7600]);
        var (line, sample) = dem.LatLonToPixel(-90, 0);
        Assert.Equal(3799.5, line, 6);
        Assert.Equal(3799.5, sample, 6);
    }

    [Fact]
    public void LatLonToPixel_Lon0_IsAboveCentre_Lon90_IsRightOfCentre()
    {
        var dem = new Dem(new short[7600 * 7600]);
        var north = dem.LatLonToPixel(-89, 0);   // y > 0 -> smaller line number
        var east = dem.LatLonToPixel(-89, 90);   // x > 0 -> larger sample number
        Assert.True(north.Line < 3799.5);
        Assert.Equal(3799.5, north.Sample, 6);
        Assert.True(east.Sample > 3799.5);
        Assert.Equal(3799.5, east.Line, 6);
    }

    [Theory]
    [InlineData(-89.67, 129.8)]
    [InlineData(-85.0, 0.0)]
    [InlineData(-80.5, 270.0)]
    [InlineData(-89.9, 359.0)]
    public void PixelToLatLon_RoundTrip_GivesPointBack(double lat, double lon)
    {
        var dem = new Dem(new short[7600 * 7600]);
        var (line, sample) = dem.LatLonToPixel(lat, lon);
        var back = dem.PixelToLatLon(line, sample);
        Assert.Equal(lat, back.LatDeg, 8);
        Assert.Equal(lon, back.LonDeg, 8);
    }

    [Fact]
    public void TryHeightM_AtPixelCentre_ReturnsScaledValue()
    {
        // 3x3 map, pole at pixel (1, 1) where DN = 100 -> 50 m.
        var dn = new short[9];
        dn[1 * 3 + 1] = 100;
        var dem = new Dem(dn, 3, 3, 80, 1.0, 1.0, 0.5);
        Assert.True(dem.TryHeightM(-90, 0, out var h));
        Assert.Equal(50.0, h, 6);
    }

    [Fact]
    public void TryHeightM_InterpolatesBilinearly()
    {
        // 2x2 map, DN 0,100 / 200,300; pole at the middle (0.5, 0.5) -> mean of the four = 150 -> 75 m.
        var dem = new Dem(new short[] { 0, 100, 200, 300 }, 2, 2, 80, 0.5, 0.5, 0.5);
        Assert.True(dem.TryHeightM(-90, 0, out var h));
        Assert.Equal(75.0, h, 6);
    }

    [Fact]
    public void TryHeightM_OutsideMap_ReturnsFalse()
    {
        var dem = SmallDem(new short[16]);
        Assert.False(dem.TryHeightM(-80, 0, out var h));
        Assert.Equal(0.0, h);
    }

    [Theory]
    [InlineData(89.9999, 180.0)]
    [InlineData(89.9999, 90.0)]
    [InlineData(double.NaN, 0.0)]
    [InlineData(-85.0, double.NaN)]
    public void TryHeightM_NearNorthPoleOrNaN_ReturnsFalseWithoutThrowing(double lat, double lon)
    {
        // Near the north pole the pixel position is so large that the int cast overflowed and indexed outside the map.
        var dem = new Dem(new short[7600 * 7600]);
        Assert.False(dem.TryHeightM(lat, lon, out var h));
        Assert.Equal(0.0, h);
    }

    [Theory]
    [InlineData(-95)]
    [InlineData(95)]
    public void TryHeightM_LatitudeBeyond90_ReturnsFalse(double lat)
    {
        var dem = SmallDem(new short[16]);
        Assert.False(dem.TryHeightM(lat, 0, out var h));
        Assert.Equal(0.0, h);
    }
}
