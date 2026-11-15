using LunarNav.Core;
using Xunit;

namespace LunarNav.Core.Tests;

public class MoonPhaseTests
{
    [Fact]
    public void MoonPhasePercent_MatchesNasaDialAMoon()
    {
        var path = FindData("ephem.csv");
        using var reader = new StreamReader(path);
        var e = Ephemeris.ParseCsv(reader).At(new DateTime(2026, 11, 15, 0, 0, 0, DateTimeKind.Utc));
        Assert.Equal(27.23, Analysis.MoonPhasePercent(e), 1);   // NASA SVS Dial-A-Moon, 2026-11-15T00:00: phase 27.23
    }

    [Fact]
    public void MoonPhasePercent_NewAndFull()
    {
        var t = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        Assert.Equal(0, Analysis.MoonPhasePercent(new EphemSample(t, 0, 180, 0, 0, 384400)), 9);
        Assert.Equal(100, Analysis.MoonPhasePercent(new EphemSample(t, 0, 0, 0, 0, 384400)), 9);
    }

    private static string FindData(string name)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var p = Path.Combine(dir.FullName, "LunarNav.Web", "wwwroot", "data", name);
            if (File.Exists(p)) return p;
        }
        throw new FileNotFoundException(name);
    }
}
