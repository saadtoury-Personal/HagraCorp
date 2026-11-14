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
    public void Constructor_RightLength_DoesNotThrow()
    {
        var dem = SmallDem(new short[16]);
        Assert.NotNull(dem);
    }
}
