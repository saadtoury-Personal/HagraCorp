using LunarNav.Core;
using Xunit;

namespace LunarNav.Core.Tests;

public class HorizonMaskTests
{
    // Flat map (every height 0, i.e. the bare 1737.4 km sphere), 2001 x 2001 pixels of 80 m:
    // +-80 km around the pole, enough for the 59 km horizon of a 1000 m mast.
    private static readonly Dem SmoothMoon = new(new short[2001 * 2001], 2001, 2001, 80, 1000, 1000, 0.5);

    [Theory]
    [InlineData(2.0)]
    [InlineData(10.0)]
    [InlineData(1000.0)]
    public void Compute_SmoothSphere_HorizonIsTheoreticalDip(double mastM)
    {
        // On a Moon without relief the skyline is the geometric dip below level: -acos(R / (R + h)).
        double r = Geometry.MoonRadiusKm * 1000;
        double expected = -Math.Acos(r / (r + mastM)) * 180 / Math.PI;

        var mask = HorizonMask.Compute(SmoothMoon, -89.5, 0, mastM);

        Assert.Equal(HorizonMask.Bins, mask.Length);
        foreach (var el in mask)
            Assert.Equal(expected, el, 3);
    }
}
