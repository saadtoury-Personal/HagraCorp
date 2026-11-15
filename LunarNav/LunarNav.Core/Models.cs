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
/// Viable = WindowSunHours >= stayDays * 24. WindowLowerBound = a window reached the end of the 60-day look-ahead or of the data:
/// the real window is at least that long.
/// Horizon margin (whole skyline raised and lowered by 0.2 deg): SunPctRange = [min, max] of SunPct,
/// HoursToSunsetRange = [min, max] of HoursToSunset, CloseCall = the Viable verdict changes inside that margin.
/// Stay percentages and dark periods use 10-minute steps; windows use 1-hour steps.
/// DsnPct = percent of the stay with the Earth in view AND the Moon above 10 deg at Goldstone, Madrid or Canberra.</summary>
public record SiteMetrics(DateTime At, double? HoursToSunset, double? HoursToSunrise,
    double? HoursToEarthset, double? HoursToEarthrise,
    double SunPct, double EarthPct, double BothDownPct,
    double LongestDarkHours, double LongestDarkNoEarthHours, bool ViperRuleViolated,
    double WindowSunHours, double WindowBothHours, bool Viable,
    bool WindowLowerBound = false, double[]? SunPctRange = null, double?[]? HoursToSunsetRange = null, bool CloseCall = false,
    double? DsnPct = null);

/// <summary>Slip heatmap. SunH[site][day] = longest continuous hours of Sun when landing at the best hour of Days[day] (UTC);
/// SunStartHour[site][day] = that hour (0..23). BothH / BothStartHour = same, also requiring Earth in view (the design's cell).
/// Dark gaps of 6 h or less are bridged. BattH / BattStartHour = hours the default battery (BatteryParams) stays above its floor
/// when landing at the best hour, capped at 60 days. A cell is viable when hours >= stayDays * 24
/// (computed by the caller, so one file serves every stay length).</summary>
public record HeatmapDto(string[] Sites, DateTime[] Days, float[][] SunH, float[][] BothH,
    int[][]? SunStartHour = null, int[][]? BothStartHour = null, float[][]? BattH = null, int[][]? BattStartHour = null);

/// <summary>One site in the fallback ranking. NearestViableDate = closest viable day at this site
/// (before or after the slipped date), null if none. Robustness = fraction (0..1) of days within
/// +-N weeks of the slipped date that are viable. LongestDarkHours = longest Sun-down period of the stay (tie-breaker).
/// WindowHoursBefore / ViableBefore = the same site on the original (unslipped) date, to mark verdicts that changed.
/// SlipToleranceDays = consecutive viable days around the slipped date (0 if not viable); MinShiftToViableDays = signed days
/// to NearestViableDate (0 when viable, null if none). LowerBound = the window reaches the end of the data, so it is at least that long.
/// Terrain = false: site outside the relief map (flat skyline), ranked after every real site.
/// CloseCall = the verdict flips when the skyline is raised or lowered by 0.2 deg (null when not computed).</summary>
public record FallbackEntry(string SiteId, double WindowHours, bool Viable, DateTime? NearestViableDate, double Robustness,
    double LongestDarkHours = 0, double WindowHoursBefore = 0, bool ViableBefore = false,
    int SlipToleranceDays = 0, int? MinShiftToViableDays = null, bool LowerBound = false, bool Terrain = true, bool? CloseCall = null);

/// <summary>Sites ranked best first (sites with relief first, then longest window, shortest dark period, robustness) for SlippedDate = OriginalDate + slip.</summary>
public record FallbackDto(DateTime OriginalDate, DateTime SlippedDate, FallbackEntry[] Ranked);

/// <summary>POST /api/custom body. Mast = observer height above ground in meters. At defaults to now.</summary>
public record CustomRequest(double Lat, double Lon, double Mast, DateTime? At);

/// <summary>Mask = 720 horizon elevations in degrees (bin i = azimuth i * 0.5 deg).</summary>
public record CustomResponse(float[] Mask, SiteMetrics Metrics);

/// <summary>Which part of a disk must be above the terrain. Sun: Edge = upper edge (default), Center = half the disk, Full = whole disk.
/// Earth: Any = any part (default), Center = half the disk.</summary>
public enum SunRule { Edge, Center, Full }
public enum EarthRule { Any, Center }

/// <summary>S2 battery inputs. Defaults are assumptions (to be checked by the science team), always shown to the user.</summary>
public record BatteryParams(double CapacityWh = 5000, double LoadW = 150, double PanelM2 = 2, double Efficiency = 0.28, double MinSocPct = 20);

public record BatteryPoint(DateTime T, double SocPct, double PowerW);

/// <summary>Viable = state of charge never below MinSocPct. MinBatteryWhToSurvive = smallest battery that keeps the
/// state of charge above MinSocPct for the whole stay with this load and panel (starting full).</summary>
public record BatteryDto(bool Viable, double MinSocPct, int HoursBelowMin, double EndSocPct, double MinBatteryWhToSurvive,
    BatteryParams Params, BatteryPoint[] Series);

/// <summary>Official = value at the published coordinates; Min / Max over the official point and every point around it.</summary>
public record PctRange(double Official, double Min, double Max);

/// <summary>One point around a site. Percentages are over 2026-2030, hourly. Viable14Pct = percent of days where landing at the
/// best hour gives 14 days of Sun + Earth.</summary>
public record UncertaintyPoint(double LatDeg, double LonDeg, double DistanceM, double BearingDeg,
    double SunPct, double EarthPct, double BothPct, double Viable14Pct);

/// <summary>How much the answer changes if the lander comes down a few hundred metres off target.</summary>
public record UncertaintyDto(string SiteId, int MastM, int[] RadiiM, PctRange SunPct, PctRange EarthPct, PctRange BothPct,
    PctRange Viable14Pct, UncertaintyPoint Best, UncertaintyPoint[] Points);

/// <summary>An azimuth sector that hides the Sun: Hours of Sun lost there, HorizonElDeg = highest skyline in the sector.</summary>
public record Blocker(double AzFromDeg, double AzToDeg, int Hours, double HorizonElDeg);

/// <summary>What the relief costs at a site over [From, To): Sun hours with a flat skyline vs the real one, the worst sectors,
/// and the hours a 10 m mast wins back compared with 2 m.</summary>
public record BlockersDto(string SiteId, int MastM, DateTime From, DateTime To, int SunHoursFlat, int SunHours, int LostHours,
    double LostPct, Blocker[] Top, int Mast10GainHours);

/// <summary>ParetoOptimal = no other site has more Sun, more Earth and a shorter longest night at once.
/// FirstPct = percent of 2000 random weightings where the site ranks first; MeanRank = average rank (1 = best).</summary>
public record RankEntry(string SiteId, double SunPct, double EarthPct, double LongestDarkHours, bool ParetoOptimal,
    double FirstPct, double MeanRank);

public record RankingDto(DateTime Date, double StayDays, int Weightings, RankEntry[] Ranked);
