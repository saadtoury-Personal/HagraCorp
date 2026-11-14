using System.Runtime.CompilerServices;
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
        // TODO: convert to radians, then return (cos lat * cos lon, cos lat * sin lon, sin lat)
        return (Math.Cos(latDeg * Math.PI / 180) * Math.Cos(lonDeg * Math.PI / 180), Math.Cos(latDeg * Math.PI / 180)
            * Math.Sin(lonDeg * Math.PI / 180), Math.Sin(latDeg * Math.PI / 180));
    }

    /// <summary>Inverse of UnitVector. v does not need to be normalized. Longitude returned in [0, 360).</summary>
    public static (double LatDeg, double LonDeg) ToLatLon((double X, double Y, double Z) v)
    {
        // TODO: lat = atan2(z, sqrt(x^2 + y^2)); lon = atan2(y, x); add 360 if negative
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
        // TODO:
        var dir = UnitVector(e.SubSunLatDeg, e.SubSunLonDeg);
        return ToAzEl(dir, latDeg, lonDeg);
        //
        // private helper ToAzEl(dir, latDeg, lonDeg):                       MATH-REVIEW
        //   u = ( cos lat cos lon,  cos lat sin lon, sin lat)   local up
        //   E = (-sin lon,          cos lon,         0      )   local east
        //   N = (-sin lat cos lon, -sin lat sin lon, cos lat)   local north
        //   elevation = asin(dot(dir, u))
        //   azimuth   = atan2(dot(dir, E), dot(dir, N)), then add 360 if negative
    }
        private static AzEl ToAzEl((double X, double Y, double Z) dir, double latDeg, double lonDeg)
    {
        double latRad = latDeg * Math.PI / 180;
        double lonRad = lonDeg * Math.PI / 180;
        // Local up vector
        var u = (X: Math.Cos(latRad) * Math.Cos(lonRad), Y: Math.Cos(latRad) * Math.Sin(lonRad), Z: Math.Sin(latRad));
        // Local east vector
        var E = (X: -Math.Sin(lonRad), Y: Math.Cos(lonRad), Z: 0);
        // Local north vector
        var N = (X: -Math.Sin(latRad) * Math.Cos(lonRad), Y: -Math.Sin(latRad) * Math.Sin(lonRad), Z: Math.Cos(latRad));
        // Elevation calculation
        double elevation = Math.Asin(dir.X * u.X + dir.Y * u.Y + dir.Z * u.Z);
        // Azimuth calculation
        double azimuth = Math.Atan2(dir.X * E.X + dir.Y * E.Y + dir.Z * E.Z,
                                    dir.X * N.X + dir.Y * N.Y + dir.Z * N.Z);
        if (azimuth < 0)
            azimuth += 2 * Math.PI;
        return new AzEl(azimuth * 180 / Math.PI, elevation * 180 / Math.PI);
    }

        
    

    /// <summary>Azimuth / elevation of the Earth's center seen from the site.</summary>
    public static AzEl EarthAzEl(EphemSample e, double latDeg, double lonDeg)
    {
        // The Earth is close: its direction changes by up to ~0.26 deg depending on where you stand
        // (parallax), so subtract the site position.                         MATH-REVIEW
        // TODO:
        // 1. earthPos = e.EarthRangeKm * UnitVector(e.SubEarthLatDeg, e.SubEarthLonDeg)
        // 2. sitePos  = MoonRadiusKm * UnitVector(latDeg, lonDeg)   (site height ignored: error < 0.001 deg)
        // 3. dir = normalize(earthPos - sitePos)
        // 4. return ToAzEl(dir, latDeg, lonDeg)
        throw new NotImplementedException();
    }

    /// <summary>Apparent radius of the Earth's disk, about 0.95 deg.</summary>
    public static double EarthAngularRadiusDeg(double earthRangeKm)
    {
        // TODO: atan(EarthRadiusKm / earthRangeKm), in degrees
        throw new NotImplementedException();
    }

    /// <summary>
    /// Fraction (0..1) of a round disk that is above a straight skyline.
    /// marginDeg = (elevation of the disk center) - (terrain horizon elevation at that azimuth).
    /// </summary>
    public static double DiskFraction(double marginDeg, double radiusDeg)
    {
        // TODO:                                                              MATH-REVIEW
        // if margin >=  radius: return 1
        // if margin <= -radius: return 0
        // k = margin / radius
        // return 1 - (acos(k) - k * sqrt(1 - k*k)) / PI
        // Check: margin = 0 gives exactly 0.5.
        throw new NotImplementedException();
    }
}
