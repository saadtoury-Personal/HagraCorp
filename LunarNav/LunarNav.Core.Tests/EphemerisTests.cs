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
    public void ParseCsv_ReadsHeaderAndRows()
    {
        var csv = "utc,subSunLat,subSunLon,subEarthLat,subEarthLon,earthRangeKm\n" +
                  "2026-01-01T00:00:00Z,1.5,10.25,-2.5,3.75,384400.5\n" +
                  "\n" +
                  "2026-01-01T01:00:00Z,1.6,10.5,-2.4,3.8,384401.5\n";
        var eph = Ephemeris.ParseCsv(new StringReader(csv));

        Assert.Equal(2, eph.Samples.Count);
        var s = eph.Samples[0];
        Assert.Equal(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), s.Utc);
        Assert.Equal(DateTimeKind.Utc, s.Utc.Kind);
        Assert.Equal(1.5, s.SubSunLatDeg);
        Assert.Equal(10.25, s.SubSunLonDeg);
        Assert.Equal(-2.5, s.SubEarthLatDeg);
        Assert.Equal(3.75, s.SubEarthLonDeg);
        Assert.Equal(384400.5, s.EarthRangeKm);
    }

    [Fact]
    public void ParseCsv_HeaderOnly_Throws()
    {
        var csv = "utc,subSunLat,subSunLon,subEarthLat,subEarthLon,earthRangeKm\n";
        Assert.Throws<ArgumentException>(() => Ephemeris.ParseCsv(new StringReader(csv)));
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
