namespace LunarNav.Core;

/// <summary>
/// STEP 1 FOR THE CODER: start here. Pure math, no files, no network.
/// Where are the Sun and the Earth in the sky of a lunar site?
/// Done when: results match JPL Horizons (quantity 4, CENTER='coord@301') within 0.01 deg.
/// Lines tagged MATH-REVIEW must be checked by our math expert before we push.
/// </summary>
public static class Geometry
{
    public const double MoonRadiusKm = 1737.4;
    public const double EarthRadiusKm = 6371.0;
    public const double SunAngularRadiusDeg = 0.2666;

    /// <summary>Unit vector from the Moon's center through the point (lat, lon). Also the local "up" there.</summary>
    public static (double X, double Y, double Z) UnitVector(double latDeg, double lonDeg)
    {
        double latRad = latDeg * Math.PI / 180;
        double lonRad = lonDeg * Math.PI / 180;
        return (Math.Cos(latRad) * Math.Cos(lonRad), Math.Cos(latRad) * Math.Sin(lonRad), Math.Sin(latRad));
    }

    /// <summary>Inverse of UnitVector. v does not need to be normalized. Longitude returned in [0, 360).</summary>
    public static (double LatDeg, double LonDeg) ToLatLon((double X, double Y, double Z) v)
    {
        double lat = Math.Atan2(v.Z, Math.Sqrt(v.X * v.X + v.Y * v.Y));
        double lon = Math.Atan2(v.Y, v.X);
        if (lon < 0)
        {
            lon += 2 * Math.PI;
        }
        return (lat * 180 / Math.PI, lon * 180 / Math.PI);
    }

    /// <summary>Azimuth / elevation of the Sun's center seen from the site.</summary>
    public static AzEl SunAzEl(EphemSample e, double latDeg, double lonDeg)
    {
        // The Sun is so far away that its direction is the same from anywhere on the Moon.
        var dir = UnitVector(e.SubSunLatDeg, e.SubSunLonDeg);
        return ToAzEl(dir, latDeg, lonDeg);
    }

    // MATH-REVIEW
    // dir does not need to be normalized: Atan2 works for a vector of any length.
    //   u = ( cos lat cos lon,  cos lat sin lon, sin lat)   local up
    //   E = (-sin lon,          cos lon,         0      )   local east
    //   N = (-sin lat cos lon, -sin lat sin lon, cos lat)   local north
    private static AzEl ToAzEl((double X, double Y, double Z) dir, double latDeg, double lonDeg)
    {
        double latRad = latDeg * Math.PI / 180;
        double lonRad = lonDeg * Math.PI / 180;
        // Local up vector
        var u = (X: Math.Cos(latRad) * Math.Cos(lonRad), Y: Math.Cos(latRad) * Math.Sin(lonRad), Z: Math.Sin(latRad));
        // Local east vector
        var E = (X: -Math.Sin(lonRad), Y: Math.Cos(lonRad), Z: 0.0);
        // Local north vector
        var N = (X: -Math.Sin(latRad) * Math.Cos(lonRad), Y: -Math.Sin(latRad) * Math.Sin(lonRad), Z: Math.Cos(latRad));

        double up = dir.X * u.X + dir.Y * u.Y + dir.Z * u.Z;
        double east = dir.X * E.X + dir.Y * E.Y + dir.Z * E.Z;
        double north = dir.X * N.X + dir.Y * N.Y + dir.Z * N.Z;

        double elevation = Math.Atan2(up, Math.Sqrt(east * east + north * north));
        double azimuth = Math.Atan2(east, north);
        if (azimuth < 0)
            azimuth += 2 * Math.PI;
        return new AzEl(azimuth * 180 / Math.PI, elevation * 180 / Math.PI);
    }

    /// <summary>Azimuth / elevation of the Earth's center seen from the site.</summary>
    public static AzEl EarthAzEl(EphemSample e, double latDeg, double lonDeg)
    {
        // The Earth is close: its direction changes by up to ~0.26 deg depending on where you stand
        // (parallax), so subtract the site position.                         MATH-REVIEW
        var ue = UnitVector(e.SubEarthLatDeg, e.SubEarthLonDeg);
        var us = UnitVector(latDeg, lonDeg);
        var earthPos = (X: e.EarthRangeKm * ue.X, Y: e.EarthRangeKm * ue.Y, Z: e.EarthRangeKm * ue.Z);
        var sitePos = (X: MoonRadiusKm * us.X, Y: MoonRadiusKm * us.Y, Z: MoonRadiusKm * us.Z);
        var dir = (X: earthPos.X - sitePos.X, Y: earthPos.Y - sitePos.Y, Z: earthPos.Z - sitePos.Z);
        return ToAzEl(dir, latDeg, lonDeg);
    }

    /// <summary>Apparent radius of the Earth's disk, about 0.95 deg.</summary>
    public static double EarthAngularRadiusDeg(double earthRangeKm)
    {
        return Math.Atan(EarthRadiusKm / earthRangeKm) * 180 / Math.PI;
    }

    /// <summary>Apparent radius of the Sun at 'utc', 0.262..0.272 deg over the year (Earth's orbit, eccentricity 0.0167).
    /// The Moon's own +-384,000 km around the Earth changes it by less than 0.001 deg and is ignored.</summary>
    public static double SunAngularRadiusAt(DateTime utc)
    {
        // MATH-REVIEW: r = a (1 - e cos M), M = mean anomaly (Meeus, low precision, ~0.01% on r).
        const double au = 149_597_870.7, sunRadiusKm = 696_000, e = 0.0167;
        double days = (utc - new DateTime(2000, 1, 1, 12, 0, 0, DateTimeKind.Utc)).TotalDays;
        double m = (357.529 + 0.98560028 * days) * Math.PI / 180;
        double r = au * (1 - e * Math.Cos(m));
        return Math.Asin(sunRadiusKm / r) * 180 / Math.PI;
    }

    /// <summary>
    /// Fraction (0..1) of a disk centred at (azDeg, elDeg) that is above the real skyline 'mask'.
    /// The disk is cut into 'strips' vertical bands; each band is compared with the skyline at its own azimuth
    /// (exact circular-segment area per band). On a flat skyline this equals DiskFraction exactly.
    /// </summary>
    public static double DiskFractionOverMask(float[] mask, double azDeg, double elDeg, double radiusDeg, int strips = 16)
    {
        // MATH-REVIEW: x = horizontal offset on the sky (deg); the azimuth offset is x / cos(el).
        double cosEl = Math.Max(0.05, Math.Cos(elDeg * Math.PI / 180));
        double w = 2 * radiusDeg / strips;
        Span<double> c = stackalloc double[strips];
        bool allAbove = true, allBelow = true;
        for (int i = 0; i < strips; i++)
        {
            c[i] = HorizonMask.At(mask, azDeg + (-radiusDeg + (i + 0.5) * w) / cosEl) - elDeg;   // skyline height relative to the centre
            allAbove &= c[i] <= -radiusDeg;
            allBelow &= c[i] >= radiusDeg;
        }
        if (allAbove)
            return 1;   // exact, not 0.99999...
        if (allBelow)
            return 0;
        double above = 0;
        for (int i = 0; i < strips; i++)
            above += AreaAbove(-radiusDeg + i * w, -radiusDeg + (i + 1) * w, c[i], radiusDeg);
        return Math.Clamp(above / (Math.PI * radiusDeg * radiusDeg), 0, 1);
    }

    /// <summary>Area of the disk x^2 + y^2 &lt;= r^2 inside x0 &lt;= x &lt;= x1 and above the line y = c.</summary>
    private static double AreaAbove(double x0, double x1, double c, double r)
    {
        if (c >= r)
            return 0;
        // G = antiderivative of the half-chord h(t) = sqrt(r^2 - t^2)
        double G(double t) => (t * Math.Sqrt(Math.Max(0, r * r - t * t)) + r * r * Math.Asin(Math.Clamp(t / r, -1, 1))) / 2;
        double full = 2 * (G(x1) - G(x0));
        if (c <= -r)
            return full;
        double a = Math.Sqrt(r * r - c * c);                 // where the line cuts the circle
        double lo = Math.Max(x0, -a), hi = Math.Min(x1, a);
        double mid = hi > lo ? G(hi) - G(lo) : 0;             // integral of h over the cut part
        double len = hi > lo ? hi - lo : 0;
        return c >= 0
            ? mid - c * len                                    // only h - c above the line, only where |t| < a
            : full - (mid + c * len);                          // whole chord, minus the part below the line where |t| < a
    }

    /// <summary>S4 eclipses: fraction (0..1) of the Sun's disk covered by the Earth's disk, both seen from the site.
    /// sepDeg = angle between the two centres. Standard area of the overlap of two circles.</summary>
    public static double EclipsedFraction(double sepDeg, double sunRadiusDeg, double earthRadiusDeg)
    {
        double d = sepDeg, r1 = sunRadiusDeg, r2 = earthRadiusDeg;
        if (d >= r1 + r2)
            return 0;
        if (d <= Math.Abs(r2 - r1))
            return Math.Min(1, r2 * r2 / (r1 * r1));
        double a = r1 * r1 * Math.Acos(Math.Clamp((d * d + r1 * r1 - r2 * r2) / (2 * d * r1), -1, 1))
                 + r2 * r2 * Math.Acos(Math.Clamp((d * d + r2 * r2 - r1 * r1) / (2 * d * r2), -1, 1))
                 - 0.5 * Math.Sqrt(Math.Max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
        return Math.Clamp(a / (Math.PI * r1 * r1), 0, 1);
    }

    /// <summary>Angle in degrees between two sky directions.</summary>
    public static double SeparationDeg(AzEl a, AzEl b)
    {
        const double rad = Math.PI / 180;
        double c = Math.Sin(a.ElDeg * rad) * Math.Sin(b.ElDeg * rad)
                 + Math.Cos(a.ElDeg * rad) * Math.Cos(b.ElDeg * rad) * Math.Cos((a.AzDeg - b.AzDeg) * rad);
        return Math.Acos(Math.Clamp(c, -1, 1)) / rad;
    }

    /// <summary>
    /// S7: elevation (deg) of the Moon's centre seen from a place on Earth (geodetic lat, east lon), airless.
    /// Low-precision lunar theory (Astronomical Almanac, about 0.3 deg) with topocentric parallax; good enough for a 10 deg limit.
    /// </summary>
    public static double MoonElevationFromEarth(DateTime utc, double latDeg, double lonDeg)
    {
        // MATH-REVIEW: Astronomical Almanac "low-precision formulae for the Moon", mean obliquity 23.44 deg, GMST (Meeus 12.4).
        const double rad = Math.PI / 180;
        double days = (utc - new DateTime(2000, 1, 1, 12, 0, 0, DateTimeKind.Utc)).TotalDays, t = days / 36525;
        double S(double deg) => Math.Sin(deg * rad);
        double C(double deg) => Math.Cos(deg * rad);
        double lam = 218.32 + 481267.881 * t + 6.29 * S(135.0 + 477198.87 * t) - 1.27 * S(259.3 - 413335.36 * t)
                   + 0.66 * S(235.7 + 890534.22 * t) + 0.21 * S(269.9 + 954397.74 * t) - 0.19 * S(357.5 + 35999.05 * t)
                   - 0.11 * S(186.5 + 966404.03 * t);
        double bet = 5.13 * S(93.3 + 483202.02 * t) + 0.28 * S(228.2 + 960400.89 * t) - 0.28 * S(318.3 + 6003.15 * t)
                   - 0.17 * S(217.6 - 407332.21 * t);
        double par = 0.9508 + 0.0518 * C(135.0 + 477198.87 * t) + 0.0095 * C(259.3 - 413335.36 * t)
                   + 0.0078 * C(235.7 + 890534.22 * t) + 0.0028 * C(269.9 + 954397.74 * t);
        double r = EarthRadiusKm / S(par);
        // ecliptic -> equatorial (km, geocentric)
        double l = C(bet) * C(lam), m = 0.9175 * C(bet) * S(lam) - 0.3978 * S(bet), n = 0.3978 * C(bet) * S(lam) + 0.9175 * S(bet);
        double theta = 280.46061837 + 360.98564736629 * days + lonDeg;   // local sidereal angle
        var up = (X: C(latDeg) * C(theta), Y: C(latDeg) * S(theta), Z: S(latDeg));
        var v = (X: r * l - EarthRadiusKm * up.X, Y: r * m - EarthRadiusKm * up.Y, Z: r * n - EarthRadiusKm * up.Z);
        double len = Math.Sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z);
        return Math.Asin((v.X * up.X + v.Y * up.Y + v.Z * up.Z) / len) / rad;
    }

    /// <summary>Earth-Moon distance (km) from the same low-precision theory; used to check it against JPL data.</summary>
    public static double MoonDistanceKm(DateTime utc)
    {
        const double rad = Math.PI / 180;
        double t = (utc - new DateTime(2000, 1, 1, 12, 0, 0, DateTimeKind.Utc)).TotalDays / 36525;
        double C(double deg) => Math.Cos(deg * rad);
        double par = 0.9508 + 0.0518 * C(135.0 + 477198.87 * t) + 0.0095 * C(259.3 - 413335.36 * t)
                   + 0.0078 * C(235.7 + 890534.22 * t) + 0.0028 * C(269.9 + 954397.74 * t);
        return EarthRadiusKm / Math.Sin(par * rad);
    }

    /// <summary>
    /// Fraction (0..1) of a round disk that is above a straight skyline.
    /// marginDeg = (elevation of the disk center) - (terrain horizon elevation at that azimuth).
    /// </summary>
    public static double DiskFraction(double marginDeg, double radiusDeg)
    {
        // MATH-REVIEW. Check: margin = 0 gives exactly 0.5.
        if (marginDeg >= radiusDeg)
            return 1.0;
        if (marginDeg <= -radiusDeg)
            return 0.0;

        double k = marginDeg / radiusDeg;
        return 1.0 - (Math.Acos(k) - k * Math.Sqrt(1.0 - k * k)) / Math.PI;
    }
}
