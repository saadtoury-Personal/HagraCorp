namespace LunarNav.Core;

/// <summary>
/// STEP 3 FOR THE CODER. The NASA LOLA elevation map of the south pole (file data/LDEM_80S_80M.IMG).
/// Facts already read from the label (LDEM_80S_80M.LBL), do not re-derive them:
///   7600 x 7600 pixels, 80 m per pixel, covers latitude -80 to -90,
///   height in meters = DN * 0.5, measured from a sphere of radius 1737.4 km,
///   south polar stereographic projection centered on the pole, longitude 0 reference, east-positive.
/// If the projection below is wrong, EVERYTHING after it is wrong. Verify with Shackleton (see LatLonToPixel).
/// </summary>
public sealed class Dem
{
    /// <param name="dn">Raw pixel values, row by row: dn[line * samples + sample]. Loaded by LunarNav.Api/Tools.cs.</param>
    public Dem(short[] dn, int lines = 7600, int samples = 7600, double mapScaleM = 80,
        double lineOffset = 3799.5, double sampleOffset = 3799.5, double scaling = 0.5)
    {
        // TODO: throw ArgumentException if dn.Length != lines * samples; store everything in private readonly fields.
        throw new NotImplementedException();
    }

    /// <summary>Map position (fractional, 0-based) of a point on the Moon.</summary>
    public (double Line, double Sample) LatLonToPixel(double latDeg, double lonDeg)
    {
        // TODO (lat, lon in radians; R = 1737400 m):                          MATH-REVIEW
        //   rho = 2 * R * tan(PI/4 + lat/2)        (0 at the pole, grows going north)
        //   x = rho * sin(lon)
        //   y = rho * cos(lon)
        //   sample = sampleOffset + x / mapScaleM
        //   line   = lineOffset   - y / mapScaleM   <-- the minus sign is the usual convention but NOT yet verified
        //
        // HOW TO VERIFY: Shackleton crater is at about 89.67 S, 129.8 E. Print heights on a 21 x 21 grid
        // (1 km spacing) around the pixel you get. You must see a deep floor in the middle with a rim
        // about 3 to 4 km higher around it. If you see nothing like a crater, flip the sign of y and retry.
        throw new NotImplementedException();
    }

    /// <summary>Inverse of LatLonToPixel. PixelToLatLon(LatLonToPixel(p)) must give p back.</summary>
    public (double LatDeg, double LonDeg) PixelToLatLon(double line, double sample)
    {
        // TODO:
        //   x = (sample - sampleOffset) * mapScaleM;  y = (lineOffset - line) * mapScaleM   (same sign as above)
        //   rho = sqrt(x*x + y*y)
        //   lat = 2 * atan(rho / (2 * R)) - PI/2
        //   lon = atan2(x, y), add 2*PI if negative
        throw new NotImplementedException();
    }

    /// <summary>Terrain height in meters at a point. Returns false when the point is outside the map.</summary>
    public bool TryHeightM(double latDeg, double lonDeg, out double heightM)
    {
        // TODO:
        // 1. (line, sample) = LatLonToPixel(...)
        // 2. l0 = floor(line), s0 = floor(sample); if l0 < 0, s0 < 0, l0 + 1 >= lines or s0 + 1 >= samples:
        //    heightM = 0, return false
        // 3. bilinear interpolation of the 4 surrounding pixels (weights from the fractional parts)
        // 4. heightM = interpolated DN * scaling; return true
        throw new NotImplementedException();
    }
}

/// <summary>
/// STEP 4 FOR THE CODER. The terrain skyline seen from a site: for each compass direction, how many
/// degrees above the ideal horizon the highest ridge appears. The Moon has no air, so this skyline
/// (plus the Moon's curvature) is exactly what hides the Sun and the Earth.
/// </summary>
public static class HorizonMask
{
    /// <summary>One value every 0.5 deg of azimuth: bin i = azimuth i * 0.5 deg.</summary>
    public const int Bins = 720;

    /// <summary>Computes the skyline. Takes up to about 1 s. mastM = observer height above the ground (2 or 10).</summary>
    public static float[] Compute(Dem dem, double latDeg, double lonDeg, double mastM, double maxDistKm = 150)
    {
        if (!dem.TryHeightM(latDeg, lonDeg, out double hSite)) throw new ArgumentException("site is outside the terrain map");
        var u = Geometry.UnitVector(latDeg, lonDeg);
        double rEye = Geometry.MoonRadiusKm + hSite / 1000.0 + mastM / 1000.0;
        var O = (X: rEye * u.X, Y: rEye * u.Y, Z: rEye * u.Z);
        var mask = new float[Bins];
        // MATH-REVIEW: P and O are true 3D points, so the Moon's curvature needs no special handling.
        Parallel.For(0, Bins, i => {
            double az = i * 0.5;
            double best = -90;
            for (double d = 0.08; d <= maxDistKm; d += 0.08) {
                var (lat2, lon2) = Destination(latDeg, lonDeg, az, d);
                if (!dem.TryHeightM(lat2, lon2, out double h)) break;
                double r = Geometry.MoonRadiusKm + h / 1000.0;
                var p = Geometry.UnitVector(lat2, lon2);
                double vx = r * p.X - O.X;
                double vy = r * p.Y - O.Y;
                double vz = r * p.Z - O.Z;
                double len = Math.Sqrt(vx * vx + vy * vy + vz * vz);
                double angle = Math.Asin((vx * u.X + vy * u.Y + vz * u.Z) / len) * 180.0 / Math.PI;
                if (angle > best) best = angle;
            }
            mask[i] = (float)best;
        });
        return mask;
    }

    /// <summary>Skyline for a site outside the map (Apollo 11): all zeros.</summary>
    public static float[] Flat()
    {
        // TODO: return new float[Bins];
        throw new NotImplementedException();
    }

    /// <summary>Skyline elevation at any azimuth, interpolating between the two nearest bins.</summary>
    public static double At(float[] mask, double azDeg)
    {
        // TODO: x = (azDeg mod 360) / 0.5; i = floor(x); f = x - i;
        //       return mask[i % Bins] * (1 - f) + mask[(i + 1) % Bins] * f      (wraps from 359.5 back to 0)
        throw new NotImplementedException();
    }

    /// <summary>Point reached when walking distKm from (lat, lon) in the compass direction bearingDeg (great circle).</summary>
    public static (double LatDeg, double LonDeg) Destination(double latDeg, double lonDeg, double bearingDeg, double distKm)
    {
        // TODO (radians; delta = distKm / Geometry.MoonRadiusKm; theta = bearing):   MATH-REVIEW
        //   lat2 = asin(sin lat * cos delta + cos lat * sin delta * cos theta)
        //   lon2 = lon + atan2(sin theta * sin delta * cos lat, cos delta - sin lat * sin lat2)
        throw new NotImplementedException();
    }
}
