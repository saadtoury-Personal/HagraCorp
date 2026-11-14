using LunarNav.Core;
using Xunit;

namespace LunarNav.Core.Tests;

public class EphemerisTests
{
    private static EphemSample Row(int hour, double sunLat = 0, double sunLon = 0,
        double earthLat = 0, double earthLon = 0, double range = 384400)
        => new(new DateTime(2026, 1, 1, hour, 0, 0, DateTimeKind.Utc), sunLat, sunLon, earthLat, earthLon, range);

    [Fact]
    public void Constructor_EmptyList_Throws()
    {
        Assert.Throws<ArgumentException>(() => new Ephemeris(new List<EphemSample>()));
    }

    [Fact]
    public void Constructor_StoresSamplesAndExposesStartEnd()
    {
        var eph = new Ephemeris(new[] { Row(0), Row(1), Row(2) });
        Assert.Equal(3, eph.Samples.Count);
        Assert.Equal(Row(0).Utc, eph.Start);
        Assert.Equal(Row(2).Utc, eph.End);
    }
}
