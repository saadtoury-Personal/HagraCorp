using LunarNav.Core;

namespace LunarNav.Api;

/// <summary>
/// STEP 6 FOR THE CODER. One-off data jobs (file and network access lives here, never in LunarNav.Core).
/// Run by hand, never during the demo:
///   dotnet run --project LunarNav.Api -- fetch-ephemeris
///   dotnet run --project LunarNav.Api -- precompute
/// </summary>
public static class Tools
{
    /// <summary>JPL Horizons request for one year: where the Sun and the Earth are above the Moon, hourly.</summary>
    public static string BuildHorizonsUrl(int year)
    {
        // TODO: return (single line, values keep their quotes):
        // https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='301'&CENTER='500@399'&MAKE_EPHEM='YES'
        //   &EPHEM_TYPE='OBSERVER'&START_TIME='{year}-01-01'&STOP_TIME='{year + 1}-01-01'&STEP_SIZE='1h'
        //   &QUANTITIES='14,15,20'&ANG_FORMAT='DEG'&CSV_FORMAT='YES'
        // Quantity 14 = sub-Earth point, 15 = sub-solar point, 20 = Earth-Moon distance.
        throw new NotImplementedException();
    }

    /// <summary>Parses the text found in the "result" field of the Horizons JSON answer.</summary>
    public static IEnumerable<EphemSample> ParseHorizonsResult(string resultText)
    {
        // BEFORE WRITING THIS: open one real answer in a browser and read the header printed just above $$SOE.
        // Confirm and write here as a comment:                                MATH-REVIEW
        //   - the column order (expected: date, sub-Earth lon, lat, sub-solar lon, lat, range, range rate)
        //   - that longitudes are east-positive 0..360 (the header states the convention)
        //   - that the times are UTC
        //   - the unit of the range (AU or km; 1 AU = 149597870.7 km)
        // TODO: keep only the lines between $$SOE and $$EOE, split on ',', trim, parse with InvariantCulture.
        //       Date format looks like "2026-Jan-01 00:00".
        throw new NotImplementedException();
    }

    /// <summary>Downloads fromYear..toYear and writes ONE csv:
    /// utc,subSunLat,subSunLon,subEarthLat,subEarthLon,earthRangeKm</summary>
    public static Task FetchEphemeris(string outCsvPath, int fromYear = 2026, int toYear = 2030)
    {
        // TODO:
        // 1. for each year: HttpClient.GetStringAsync(BuildHorizonsUrl(year)); read the JSON property "result"
        // 2. ParseHorizonsResult; each year ends on Jan 1 00:00 of the next one, so skip that duplicated row
        // 3. write the header + rows (utc as "yyyy-MM-ddTHH:mm:ssZ", numbers with InvariantCulture)
        // Expect about 43,825 rows.
        throw new NotImplementedException();
    }

    /// <summary>Loads data/LDEM_80S_80M.IMG (110 MB of 16-bit little-endian integers) into memory.</summary>
    public static Dem LoadDem(string imgPath)
    {
        // TODO:
        // 1. bytes = File.ReadAllBytes(imgPath); throw InvalidDataException if bytes.Length != 7600 * 7600 * 2
        // 2. dn = System.Runtime.InteropServices.MemoryMarshal.Cast<byte, short>(bytes).ToArray()
        // 3. return new Dem(dn)
        throw new NotImplementedException();
    }

    /// <summary>Computes everything the app serves and writes it under dataDir (LunarNav.Web/wwwroot/data).</summary>
    public static void Precompute(string demPath, string dataDir)
    {
        // TODO (System.Text.Json, JsonSerializerDefaults.Web so names are camelCase):
        // 1. sites = read dataDir/sites.json; eph = Ephemeris.ParseCsv(dataDir/ephem.csv); dem = LoadDem(demPath)
        // 2. for mast in { 2, 10 }:
        //      for each site: mask = site.Terrain ? HorizonMask.Compute(dem, lat, lon, mast) : HorizonMask.Flat()
        //                     write dataDir/masks/{site.Id}_{mast}m.json
        //      heat = Analysis.Heatmap(eph, sites, masks, 2026-01-01, 2030-10-31)
        //      write dataDir/heatmap_{mast}m.json
        // 3. print one line per file written
        throw new NotImplementedException();
    }
}
