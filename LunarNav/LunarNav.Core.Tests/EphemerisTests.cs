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
    public void At_ExactHour_ReturnsThatRow()
    {
        var eph = new Ephemeris(new[] { Row(0, 10, 20, 30, 40, 380000), Row(1, 11, 21, 31, 41, 381000) });
        var s = eph.At(Row(0).Utc);
        Assert.Equal(10, s.SubSunLatDeg, 9);
        Assert.Equal(20, s.SubSunLonDeg, 9);
        Assert.Equal(30, s.SubEarthLatDeg, 9);
        Assert.Equal(40, s.SubEarthLonDeg, 9);
        Assert.Equal(380000, s.EarthRangeKm, 9);
    }

    [Fact]
    public void At_LastSample_ReturnsLastRow()
    {
        var eph = new Ephemeris(new[] { Row(0), Row(1, 11, 21, 31, 41, 381000) });
        var s = eph.At(Row(1).Utc);
        Assert.Equal(11, s.SubSunLatDeg);
        Assert.Equal(381000, s.EarthRangeKm);
    }

    [Fact]
    public void At_OutsideRange_Throws()
    {
        var eph = new Ephemeris(new[] { Row(1), Row(2) });
        Assert.Throws<ArgumentOutOfRangeException>(() => eph.At(Row(0).Utc));
        Assert.Throws<ArgumentOutOfRangeException>(() => eph.At(Row(3).Utc));
    }

    [Fact]
    public void At_LongitudeWrap_PassesThroughZeroNotOneEighty()
    {
        var eph = new Ephemeris(new[] { Row(0, 0, 359, 0, 359), Row(1, 0, 1, 0, 1) });
        var s = eph.At(Row(0).Utc.AddMinutes(30));
        Assert.True(s.SubSunLonDeg < 0.001 || s.SubSunLonDeg > 359.999, $"sun lon = {s.SubSunLonDeg}");
        Assert.True(s.SubEarthLonDeg < 0.001 || s.SubEarthLonDeg > 359.999, $"earth lon = {s.SubEarthLonDeg}");
    }

    [Fact]
    public void At_RangeInterpolatesLinearly()
    {
        var eph = new Ephemeris(new[] { Row(0, range: 380000), Row(1, range: 382000) });
        Assert.Equal(381000, eph.At(Row(0).Utc.AddMinutes(30)).EarthRangeKm, 6);
    }

    private const string RealCsv =
        "utc,subSunLat,subSunLon,subEarthLat,subEarthLon,earthRangeKm\n" +
        "2026-01-01T00:00:00Z,-1.346422,32.519634,-6.556142,358.716549,361045.116\n" +
        "2026-01-01T01:00:00Z,-1.345746,32.014308,-6.561459,358.793844,360984.955\n";

    [Fact]
    public void At_RealRows_MatchesReferenceValues()
    {
        var eph = Ephemeris.ParseCsv(new StringReader(RealCsv));
        var s = eph.At(new DateTime(2026, 1, 1, 0, 30, 0, DateTimeKind.Utc));
        Assert.Equal(-1.346097, s.SubSunLatDeg, 1e-5);
        Assert.Equal(32.266971, s.SubSunLonDeg, 1e-5);
        Assert.Equal(-6.558802, s.SubEarthLatDeg, 1e-5);
        Assert.Equal(358.755196, s.SubEarthLonDeg, 1e-5);
        Assert.Equal(361015.035, s.EarthRangeKm, 1e-3); // reference is rounded to 3 decimals
    }

    [Fact]
    public void At_LocalTime_IsConvertedToUtc()
    {
        var eph = Ephemeris.ParseCsv(new StringReader(RealCsv));
        var utc = new DateTime(2026, 1, 1, 0, 30, 0, DateTimeKind.Utc);
        var fromUtc = eph.At(utc);
        var fromLocal = eph.At(utc.ToLocalTime());
        Assert.Equal(fromUtc.SubSunLonDeg, fromLocal.SubSunLonDeg, 9);
        Assert.Equal(fromUtc.EarthRangeKm, fromLocal.EarthRangeKm, 9);
    }

    [Fact]
    public void Constructor_MissingHour_Throws()
    {
        Assert.Throws<ArgumentException>(() => new Ephemeris(new[] { Row(0), Row(1), Row(3) }));
    }

    [Fact]
    public void Constructor_DuplicateAndGapWithRightSpan_Throws()
    {
        // 0 h, 2 h, 2 h: the total span (2 h for 3 rows) looks right, but the grid is not hourly.
        Assert.Throws<ArgumentException>(() => new Ephemeris(new[] { Row(0), Row(2), Row(2) }));
    }

    [Fact]
    public void Constructor_RowsOutOfOrder_Throws()
    {
        Assert.Throws<ArgumentException>(() => new Ephemeris(new[] { Row(0), Row(2), Row(1), Row(3) }));
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
