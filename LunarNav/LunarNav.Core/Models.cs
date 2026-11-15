namespace LunarNav.Core;

// Shared data types (also deserialized by the Blazor app). Nothing to implement in this file.
// Conventions everywhere: angles in DEGREES, longitude east-positive, latitude north-positive (south pole = -90),
// distances in km unless the name ends with M (meters), times in UTC, frame = Moon Mean Earth (ME, DE421).

/// <summary>A landing site. Category: artemis | clps | apollo | international | failure.
/// Terrain = false means the site is outside the south-pole DEM (e.g. Apollo 11): use HorizonMask.Flat().</summary>
public record Site(string Id, string Name, double LatDeg, double LonDeg, string Category, string Notes, bool Terrain = true);

/// <summary>One hourly ephemeris row: where on the Moon the Sun and the Earth are straight overhead
/// (sub-solar point, sub-Earth point), and the Earth-Moon center distance.</summary>
public record EphemSample(DateTime Utc, double SubSunLatDeg, double SubSunLonDeg,
    double SubEarthLatDeg, double SubEarthLonDeg, double EarthRangeKm);

/// <summary>Direction in the local sky. Azimuth clockwise from north, [0, 360). Elevation above the
/// ideal (sphere) horizon, negative when below.</summary>
public readonly record struct AzEl(double AzDeg, double ElDeg);

/// <summary>Sky state at one time. SunFrac / EarthFrac = visible fraction of the disk above the terrain, 0..1.
/// Power = unitless index 0..1 for a vertical Sun-tracking panel (multiply by 1361 W/m2 * area * efficiency).</summary>
public record TimelinePoint(DateTime T, double SunAz, double SunEl, double SunFrac,
    double EarthAz, double EarthEl, double EarthFrac, double Power);

/// <summary>Answers for "site + arrival time + stay length".
/// HoursTo* = countdown from At to the next event, null if none within the search horizon.
/// Sun up = any part of the Sun's disk visible (upper edge above the terrain). Earth in view = any part of the Earth visible.
/// SunPct / EarthPct / BothDownPct = percent (0..100) of the stay with Sun up / Earth in view / both down.
/// LongestDarkHours = longest continuous Sun-down period in the stay.
/// LongestDarkNoEarthHours = longest period with Sun down AND Earth down; ViperRuleViolated when it exceeds 50 h.
/// WindowSunHours = continuous hours of Sun starting at At; WindowBothHours = same, also requiring Earth in view.
/// Viable = WindowSunHours >= stayDays * 24.</summary>
public record SiteMetrics(DateTime At, double? HoursToSunset, double? HoursToSunrise,
    double? HoursToEarthset, double? HoursToEarthrise,
    double SunPct, double EarthPct, double BothDownPct,
    double LongestDarkHours, double LongestDarkNoEarthHours, bool ViperRuleViolated,
    double WindowSunHours, double WindowBothHours, bool Viable);

/// <summary>Slip heatmap. SunH[site][day] = longest continuous hours of Sun when landing at the best hour of Days[day] (UTC);
/// SunStartHour[site][day] = that hour (0..23). BothH / BothStartHour = same, also requiring Earth in view (the design's cell).
/// Dark gaps of 6 h or less are bridged. A cell is viable when hours >= stayDays * 24
/// (computed by the caller, so one file serves every stay length).</summary>
public record HeatmapDto(string[] Sites, DateTime[] Days, float[][] SunH, float[][] BothH,
    int[][]? SunStartHour = null, int[][]? BothStartHour = null);

/// <summary>One site in the fallback ranking. NearestViableDate = closest viable day at this site
/// (before or after the slipped date), null if none. Robustness = fraction (0..1) of days within
/// +-N weeks of the slipped date that are viable. LongestDarkHours = longest Sun-down period of the stay (tie-breaker).
/// WindowHoursBefore / ViableBefore = the same site on the original (unslipped) date, to mark verdicts that changed.</summary>
public record FallbackEntry(string SiteId, double WindowHours, bool Viable, DateTime? NearestViableDate, double Robustness,
    double LongestDarkHours = 0, double WindowHoursBefore = 0, bool ViableBefore = false);

/// <summary>Sites ranked best first (longest window, then shortest dark period, then robustness) for SlippedDate = OriginalDate + slip.</summary>
public record FallbackDto(DateTime OriginalDate, DateTime SlippedDate, FallbackEntry[] Ranked);

/// <summary>POST /api/custom body. Mast = observer height above ground in meters. At defaults to now.</summary>
public record CustomRequest(double Lat, double Lon, double Mast, DateTime? At);

/// <summary>Mask = 720 horizon elevations in degrees (bin i = azimuth i * 0.5 deg).</summary>
public record CustomResponse(float[] Mask, SiteMetrics Metrics);
