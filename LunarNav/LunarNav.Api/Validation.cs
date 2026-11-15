using System.Text.Json;
using System.Text.Json.Nodes;
using LunarNav.Core;

namespace LunarNav.Api;

/// <summary>
/// N1 + N8: runs the product's own C# code (HorizonMask.Compute + Analysis.Timeline) at every terrain site and compares it
/// with NASA PGDA (tools/validation/pgda.json) and with the Python reimplementation (ours.json), against thresholds fixed
/// in advance (thresholds.json). Negative controls (mirrored skyline, Sun turned 180 deg, date +14.77 d) must fail.
///   dotnet run -c Release --project LunarNav.Api -- validate data/LDEM_80S_80M.IMG LunarNav.Web/wwwroot/data ../tools/validation out.json [ephem.csv]
/// </summary>
public static class Validation
{
    public const double DateShiftDays = 14.77;

    /// <summary>Percent of hourly samples over the whole ephemeris with the Sun up (any part, and centre) and the Earth in view.</summary>
    public static (double SunEdge, double SunCentre, double EarthEdge) SkyPercent(Ephemeris eph, Site site, float[] mask)
    {
        var pts = Analysis.Timeline(eph, site, mask, eph.Start, eph.End, TimeSpan.FromHours(1));
        double P(Func<TimelinePoint, bool> f) => Math.Round(100.0 * pts.Count(f) / pts.Length, 2);
        return (P(p => Analysis.SunUp(p.SunFrac)), P(p => p.SunFrac >= 0.5), P(p => Analysis.EarthUp(p.EarthFrac)));
    }

    /// <summary>The 8 points one map pixel (80 m) away from the site, as compare.py's "ours +-80 m" range.</summary>
    public static IEnumerable<(double Lat, double Lon)> Neighbours(Dem dem, double latDeg, double lonDeg)
    {
        var (line, sample) = dem.LatLonToPixel(latDeg, lonDeg);
        for (int dl = -1; dl <= 1; dl++)
            for (int ds = -1; ds <= 1; ds++)
                if (dl != 0 || ds != 0)
                    yield return dem.PixelToLatLon(line + dl, sample + ds);
    }

    /// <summary>Same rule as compare.py: OK within tol, "explained" when one value sits in the other's 3x3 range (+-tol), else "problem".</summary>
    public static string Verdict(double ours, double[] oursRange, double pgda, double[] pgdaRange, double tol)
    {
        if (Math.Abs(ours - pgda) <= tol)
            return "OK";
        bool inPgda = pgdaRange[0] - tol <= ours && ours <= pgdaRange[1] + tol;
        bool inOurs = oursRange[0] - tol <= pgda && pgda <= oursRange[1] + tol;
        return inPgda || inOurs ? "explained" : "problem";
    }

    /// <summary>Skyline mirrored east-west (negative control).</summary>
    public static float[] Mirror(float[] mask) => Enumerable.Range(0, mask.Length).Select(i => mask[(mask.Length - i) % mask.Length]).ToArray();

    /// <summary>Same hourly grid, sub-solar longitude turned by 180 deg (negative control).</summary>
    public static Ephemeris SunRotated(Ephemeris eph) => new(eph.Samples
        .Select(s => s with { SubSunLonDeg = (s.SubSunLonDeg + 180) % 360 }).ToList());

    /// <summary>Same hourly grid starting at eph.Start, but every value read 'days' later (negative control).</summary>
    public static Ephemeris Shifted(Ephemeris eph, double days)
    {
        var shift = TimeSpan.FromDays(days);
        var list = new List<EphemSample>();
        for (var t = eph.Start; t + shift <= eph.End; t = t.AddHours(1))
            list.Add(eph.At(t + shift) with { Utc = t });
        return new Ephemeris(list);
    }

    public record Stat(int N, int Within, double Bias, double MedianAbs, double MeanAbs, double Rmse, double R, double Slope, double MaxAbs, string MaxAbsSite);

    /// <summary>Bias, spread and agreement of ours vs reference (both in percent).</summary>
    public static Stat Compare(IReadOnlyList<(string Site, double Ours, double Ref)> rows, double tol)
    {
        var d = rows.Select(r => r.Ours - r.Ref).ToArray();
        var abs = d.Select(Math.Abs).Order().ToArray();
        double mx = rows.Average(r => r.Ref), my = rows.Average(r => r.Ours);
        double sxy = rows.Sum(r => (r.Ref - mx) * (r.Ours - my)), sxx = rows.Sum(r => (r.Ref - mx) * (r.Ref - mx)), syy = rows.Sum(r => (r.Ours - my) * (r.Ours - my));
        int imax = Array.IndexOf(d.Select(Math.Abs).ToArray(), abs[^1]);
        double median = abs.Length % 2 == 1 ? abs[abs.Length / 2] : (abs[abs.Length / 2 - 1] + abs[abs.Length / 2]) / 2;
        return new Stat(d.Length, d.Count(x => Math.Abs(x) <= tol), R2(d.Average()), R2(median), R2(abs.Average()),
            R2(Math.Sqrt(d.Average(x => x * x))), sxx == 0 || syy == 0 ? double.NaN : Math.Round(sxy / Math.Sqrt(sxx * syy), 4),
            sxx == 0 ? double.NaN : Math.Round(sxy / sxx, 4), R2(abs[^1]), rows[imax].Site);
    }

    private static double R2(double x) => Math.Round(x, 2);

    private static double[] Arr(JsonNode? n) => n!.AsArray().Select(x => x!.GetValue<double>()).ToArray();

    public static void Run(string demPath, string dataDir, string validationDir, string outJson, string? ephemCsv = null)
    {
        var web = new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true };
        var sites = JsonSerializer.Deserialize<List<Site>>(File.ReadAllText(Path.Combine(dataDir, "sites.json")), web)!
            .Where(s => s.Terrain).ToList();
        var ephPath = ephemCsv ?? Path.Combine(dataDir, "ephem.csv");
        Ephemeris eph;
        using (var reader = new StreamReader(ephPath))
            eph = Ephemeris.ParseCsv(reader);
        var dem = Tools.LoadDem(demPath);
        var thresholds = JsonNode.Parse(File.ReadAllText(Path.Combine(validationDir, "thresholds.json")))!;
        double tol = thresholds["perSite"]!["okWithinPoints"]!.GetValue<double>();
        var pgda = JsonNode.Parse(File.ReadAllText(Path.Combine(validationDir, "pgda.json")))!.AsArray()
            .ToDictionary(n => n!["siteId"]!.GetValue<string>(), n => n!);
        var python = JsonNode.Parse(File.ReadAllText(Path.Combine(validationDir, "ours.json")))!.AsArray()
            .ToDictionary(n => (n!["siteId"]!.GetValue<string>(), n!["mastM"]!.GetValue<int>()), n => n!);
        // added after the first run: the Python with the C#'s strips, Sun size and eclipses ported (ours_ported.py)
        var ported = JsonNode.Parse(File.ReadAllText(Path.Combine(validationDir, "ours_ported.json")))!.AsArray()
            .ToDictionary(n => (n!["siteId"]!.GetValue<string>(), n!["mastM"]!.GetValue<int>()), n => n!);
        var sunRot = SunRotated(eph);
        var shifted = Shifted(eph, DateShiftDays);
        Console.WriteLine($"validate: {sites.Count} sites, ephemeris {eph.Start:u} .. {eph.End:u} ({eph.Samples.Count} h)");

        var results = new JsonObject[sites.Count];
        var zero = new (double Sun, double Earth, double PgdaSun, double PgdaEarth, string SunV, string EarthV, double MirSun, double RotSun, double ShiftSun)[sites.Count];
        int done = 0;
        Parallel.For(0, sites.Count, new ParallelOptions { MaxDegreeOfParallelism = 2 }, i =>
        {
            var s = sites[i];
            var g = pgda[s.Id];
            string map = g["85S_060M"]!["sun"] is not null ? "85S_060M" : "75S_120M";
            double[] ps = Arr(g[map]!["sun"]), pe = Arr(g[map]!["earth"]);

            var rows = new JsonArray();
            (double SunEdge, double SunCentre, double EarthEdge) at0 = default;
            float[] mask0 = [];
            foreach (int mast in new[] { 0, 2, 10 })
            {
                var mask = HorizonMask.Compute(dem, s.LatDeg, s.LonDeg, mast);
                var (sunEdge, sunCentre, earth) = SkyPercent(eph, s, mask);
                var py = mast == 0 ? g["ours0m"]! : python[(s.Id, mast)];
                double pySun = py["sunEdge"]!.GetValue<double>(), pyEarth = py["earthEdge"]!.GetValue<double>();
                var pp = ported[(s.Id, mast)];
                double ppSun = pp["sunEdge"]!.GetValue<double>(), ppEarth = pp["earthEdge"]!.GetValue<double>();
                rows.Add(new JsonObject
                {
                    ["mastM"] = mast, ["sunPct"] = sunEdge, ["sunPctCentre"] = sunCentre, ["earthPct"] = earth,
                    ["pythonSunPct"] = pySun, ["pythonEarthPct"] = pyEarth,
                    ["diffPythonSun"] = R2(sunEdge - pySun), ["diffPythonEarth"] = R2(earth - pyEarth),
                    ["portedSunPct"] = ppSun, ["portedEarthPct"] = ppEarth,
                    ["diffPortedSun"] = R2(sunEdge - ppSun), ["diffPortedEarth"] = R2(earth - ppEarth),
                });
                if (mast == 0)
                {
                    at0 = (sunEdge, sunCentre, earth);
                    mask0 = mask;
                }
            }

            var near = Neighbours(dem, s.LatDeg, s.LonDeg)
                .Select(p => SkyPercent(eph, s with { LatDeg = p.Lat, LonDeg = p.Lon }, HorizonMask.Compute(dem, p.Lat, p.Lon, 0)))
                .Append(at0).ToArray();
            double[] nearSun = [near.Min(x => x.SunEdge), near.Max(x => x.SunEdge)];
            double[] nearEarth = [near.Min(x => x.EarthEdge), near.Max(x => x.EarthEdge)];
            string vs = Verdict(at0.Item1, nearSun, ps[0], ps[1..], tol);
            string ve = Verdict(at0.Item3, nearEarth, pe[0], pe[1..], tol);

            double mir = SkyPercent(eph, s, Mirror(mask0)).SunEdge;
            double rot = SkyPercent(sunRot, s, mask0).SunEdge;
            double shf = SkyPercent(shifted, s, mask0).SunEdge;
            zero[i] = (at0.Item1, at0.Item3, ps[0], pe[0], vs, ve, mir, rot, shf);

            results[i] = new JsonObject
            {
                ["siteId"] = s.Id, ["latDeg"] = s.LatDeg, ["lonDeg"] = s.LonDeg, ["pgdaMap"] = map,
                ["sun"] = new JsonObject
                {
                    ["ours0m"] = at0.Item1, ["ours0mNeighbours80m"] = new JsonArray(nearSun[0], nearSun[1]),
                    ["pgda"] = ps[0], ["pgda3x3"] = new JsonArray(ps[1], ps[2]), ["diff"] = R2(at0.Item1 - ps[0]), ["verdict"] = vs,
                },
                ["earth"] = new JsonObject
                {
                    ["ours0m"] = at0.Item3, ["ours0mNeighbours80m"] = new JsonArray(nearEarth[0], nearEarth[1]),
                    ["pgda"] = pe[0], ["pgda3x3"] = new JsonArray(pe[1], pe[2]), ["diff"] = R2(at0.Item3 - pe[0]), ["verdict"] = ve,
                },
                ["controlsSun0m"] = new JsonObject { ["mirroredAzimuth"] = mir, ["sunRotated180"] = rot, ["dateShifted"] = shf },
                ["masts"] = rows,
            };
            Console.WriteLine($"  {Interlocked.Increment(ref done),2}/{sites.Count} {s.Id,-28} sun 0m {at0.Item1,6:F2} vs PGDA {ps[0],6:F2} {vs,-9} earth {at0.Item3,6:F2} vs {pe[0],6:F2} {ve}");
        });

        var sunStat = Compare(sites.Select((s, i) => (s.Id, zero[i].Sun, zero[i].PgdaSun)).ToList(), tol);
        var earthStat = Compare(sites.Select((s, i) => (s.Id, zero[i].Earth, zero[i].PgdaEarth)).ToList(), tol);
        var pass = thresholds["pass"]!;
        int needSun = pass["sunSitesWithin5"]!.GetValue<int>(), needEarth = pass["earthSitesWithin5"]!.GetValue<int>();
        int problems = zero.Count(z => z.SunV == "problem") + zero.Count(z => z.EarthV == "problem");

        var pyDiffs = results.SelectMany(r => r["masts"]!.AsArray()).Select(m => new
        {
            Mast = m!["mastM"]!.GetValue<int>(),
            Sun = Math.Abs(m["diffPythonSun"]!.GetValue<double>()),
            Earth = Math.Abs(m["diffPythonEarth"]!.GetValue<double>()),
        }).ToList();
        double maxPy = thresholds["csharpVsPython"]!["maxAbsDiffPoints"]!.GetValue<double>();
        var portedDiffs = results.SelectMany(r => r["masts"]!.AsArray()).Select(m => (
            Sun: Math.Abs(m!["diffPortedSun"]!.GetValue<double>()), Earth: Math.Abs(m["diffPortedEarth"]!.GetValue<double>()))).ToList();
        double maxPorted = thresholds["csharpVsPortedPython"]!["maxAbsDiffPoints"]!.GetValue<double>();

        JsonObject Control(string id, Func<int, double> sun)
        {
            var st = Compare(sites.Select((s, i) => (s.Id, sun(i), zero[i].PgdaSun)).ToList(), tol);
            return new JsonObject
            {
                ["id"] = id, ["sunSitesWithin5"] = st.Within, ["sunMedianAbsDiff"] = st.MedianAbs, ["sunR"] = st.R,
                ["failsAsExpected"] = st.Within < needSun,
            };
        }

        var bins = Arr(thresholds["illuminationBins"]);
        var binRows = new JsonArray();
        for (int b = 0; b + 1 < bins.Length; b++)
        {
            var inBin = Enumerable.Range(0, sites.Count).Where(i => zero[i].PgdaSun >= bins[b] && (zero[i].PgdaSun < bins[b + 1] || b + 2 == bins.Length)).ToList();
            binRows.Add(new JsonObject
            {
                ["pgdaSunPct"] = $"{bins[b]}-{bins[b + 1]}", ["sites"] = inBin.Count,
                ["within5"] = inBin.Count(i => Math.Abs(zero[i].Sun - zero[i].PgdaSun) <= tol),
                ["meanAbsDiff"] = inBin.Count == 0 ? null : R2(inBin.Average(i => Math.Abs(zero[i].Sun - zero[i].PgdaSun))),
            });
        }

        var outDoc = new JsonObject
        {
            ["generated"] = DateTime.UtcNow.ToString("u"),
            ["command"] = "dotnet run -c Release --project LunarNav.Api -- validate <LDEM_80S_80M.IMG> <dataDir> <tools/validation> <out.json>" + (ephemCsv is null ? "" : " <ephem.csv>"),
            ["code"] = "C# product code: HorizonMask.Compute (720 azimuths, 80 m steps, 250 km) + Analysis.Timeline (16-strip disk vs skyline, Sun size from distance, eclipses), hourly",
            ["ephemeris"] = new JsonObject { ["file"] = Path.GetFileName(ephPath), ["start"] = eph.Start.ToString("u"), ["end"] = eph.End.ToString("u"), ["hours"] = eph.Samples.Count },
            ["reference"] = thresholds["reference"]!.DeepClone(),
            ["thresholds"] = thresholds.DeepClone(),
            ["summary"] = new JsonObject
            {
                ["sun"] = JsonSerializer.SerializeToNode(sunStat, web),
                ["earth"] = JsonSerializer.SerializeToNode(earthStat, web),
                ["sunVerdicts"] = Verdicts(zero.Select(z => z.SunV)),
                ["earthVerdicts"] = Verdicts(zero.Select(z => z.EarthV)),
                ["sunByIllumination"] = binRows,
                ["csharpVsPython"] = new JsonObject
                {
                    ["maxAbsDiffSun"] = R2(pyDiffs.Max(x => x.Sun)), ["maxAbsDiffEarth"] = R2(pyDiffs.Max(x => x.Earth)),
                    ["byMast"] = new JsonArray(pyDiffs.GroupBy(x => x.Mast).Select(gr => (JsonNode)new JsonObject
                    {
                        ["mastM"] = gr.Key, ["maxAbsDiffSun"] = R2(gr.Max(x => x.Sun)), ["medianAbsDiffSun"] = R2(Median(gr.Select(x => x.Sun))),
                        ["maxAbsDiffEarth"] = R2(gr.Max(x => x.Earth)),
                    }).ToArray()),
                    ["rowsWithinThreshold"] = pyDiffs.Count(x => x.Sun <= maxPy && x.Earth <= maxPy), ["rows"] = pyDiffs.Count,
                },
                ["csharpVsPortedPython"] = new JsonObject
                {
                    ["maxAbsDiffSun"] = R2(portedDiffs.Max(x => x.Sun)), ["maxAbsDiffEarth"] = R2(portedDiffs.Max(x => x.Earth)),
                    ["rowsWithinThreshold"] = portedDiffs.Count(x => x.Sun <= maxPorted && x.Earth <= maxPorted), ["rows"] = portedDiffs.Count,
                },
                ["negativeControls"] = new JsonArray(
                    Control("mirroredAzimuth", i => zero[i].MirSun), Control("sunRotated180", i => zero[i].RotSun), Control("dateShifted", i => zero[i].ShiftSun)),
            },
            ["pass"] = new JsonObject
            {
                ["sun"] = sunStat.Within >= needSun,
                ["earth"] = earthStat.Within >= needEarth,
                ["noProblemSites"] = problems <= pass["maxProblemSites"]!.GetValue<int>(),
                ["csharpVsPython"] = pyDiffs.All(x => x.Sun <= maxPy && x.Earth <= maxPy),
                ["csharpVsPortedPython"] = portedDiffs.All(x => x.Sun <= maxPorted && x.Earth <= maxPorted),
            },
            ["sites"] = new JsonArray(results.Select(r => (JsonNode)r).ToArray()),
        };
        File.WriteAllText(outJson, outDoc.ToJsonString(new JsonSerializerOptions
        {
            WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        }));
        Console.WriteLine($"sun {sunStat.Within}/{sunStat.N} within {tol} (median |d| {sunStat.MedianAbs}), earth {earthStat.Within}/{earthStat.N} (median |d| {earthStat.MedianAbs})");
        Console.WriteLine($"wrote {outJson}");
    }

    private static JsonObject Verdicts(IEnumerable<string> v)
    {
        var list = v.ToList();
        return new JsonObject { ["OK"] = list.Count(x => x == "OK"), ["explained"] = list.Count(x => x == "explained"), ["problem"] = list.Count(x => x == "problem") };
    }

    private static double Median(IEnumerable<double> xs)
    {
        var a = xs.Order().ToArray();
        return a.Length % 2 == 1 ? a[a.Length / 2] : (a[a.Length / 2 - 1] + a[a.Length / 2]) / 2;
    }
}
