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
    public void Constructor_RightLength_DoesNotThrow()
    {
        var dem = SmallDem(new short[16]);
        Assert.NotNull(dem);
    }
}
