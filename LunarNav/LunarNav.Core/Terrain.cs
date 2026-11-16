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
    private const double MoonRadiusM = 1737400;

    private readonly short[] _dn;
    private readonly int _lines;
    private readonly int _samples;
    private readonly double _mapScaleM;
    private readonly double _lineOffset;
    private readonly double _sampleOffset;
    private readonly double _scaling;

    /// <param name="dn">Raw pixel values, row by row: dn[line * samples + sample]. Loaded by LunarNav.Api/Tools.cs.</param>
    public Dem(short[] dn, int lines = 7600, int samples = 7600, double mapScaleM = 80,
        double lineOffset = 3799.5, double sampleOffset = 3799.5, double scaling = 0.5)
    {
        if (dn.Length != lines * samples)
            throw new ArgumentException("dn.Length must equal lines * samples", nameof(dn));
        _dn = dn;
        _lines = lines;
        _samples = samples;
        _mapScaleM = mapScaleM;
        _lineOffset = lineOffset;
        _sampleOffset = sampleOffset;
        _scaling = scaling;
    }

    /// <summary>Map position (fractional, 0-based) of a point on the Moon.</summary>
    public (double Line, double Sample) LatLonToPixel(double latDeg, double lonDeg)
    {
        // The minus sign on y (line) is verified on the real map: Shackleton crater shows its deep floor only with it.
        double lat = latDeg * Math.PI / 180;
        double lon = lonDeg * Math.PI / 180;
        double rho = 2 * MoonRadiusM * Math.Tan(Math.PI / 4 + lat / 2);
        double x = rho * Math.Sin(lon);
        double y = rho * Math.Cos(lon);
        return (_lineOffset - y / _mapScaleM, _sampleOffset + x / _mapScaleM);
    }

    /// <summary>Inverse of LatLonToPixel. PixelToLatLon(LatLonToPixel(p)) must give p back.</summary>
    public (double LatDeg, double LonDeg) PixelToLatLon(double line, double sample)
    {
        double x = (sample - _sampleOffset) * _mapScaleM;
        double y = (_lineOffset - line) * _mapScaleM;
        double rho = Math.Sqrt(x * x + y * y);
        double lat = 2 * Math.Atan(rho / (2 * MoonRadiusM)) - Math.PI / 2;
        double lon = Math.Atan2(x, y);
        if (lon < 0)
            lon += 2 * Math.PI;
        return (lat * 180 / Math.PI, lon * 180 / Math.PI);
    }

    /// <summary>Terrain height in meters at a point. Returns false when the point is outside the map.</summary>
    public bool TryHeightM(double latDeg, double lonDeg, out double heightM)
    {
        if (Math.Abs(latDeg) > 90)
        {
            heightM = 0;
            return false;
        }

        var (line, sample) = LatLonToPixel(latDeg, lonDeg);
        // Check while still a double: near the north pole the pixel position is huge, and casting it to int
        // overflows into a value that passes the bounds test below and then indexes outside the array.
        if (!(line >= 0 && line < _lines - 1 && sample >= 0 && sample < _samples - 1))
        {
            heightM = 0;
            return false;
        }
        int l0 = (int)Math.Floor(line);
        int s0 = (int)Math.Floor(sample);

        double fl = line - l0;
        double fs = sample - s0;
        double d00 = _dn[l0 * _samples + s0];
        double d01 = _dn[l0 * _samples + s0 + 1];
        double d10 = _dn[(l0 + 1) * _samples + s0];
        double d11 = _dn[(l0 + 1) * _samples + s0 + 1];
        double top = d00 * (1 - fs) + d01 * fs;
        double bottom = d10 * (1 - fs) + d11 * fs;
        heightM = (top * (1 - fl) + bottom * fl) * _scaling;
        return true;
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
    public static float[] Compute(Dem dem, double latDeg, double lonDeg, double mastM, double maxDistKm = 250)
    {
        // 250 km, not 150: from a peak the skyline sits 2-5 deg below level, so lower terrain far away still shows.
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
    public static float[] Flat() => new float[Bins];

    /// <summary>Skyline elevation at any azimuth, interpolating between the two nearest bins.</summary>
    public static double At(float[] mask, double azDeg)
    {
        double x = (azDeg % 360 + 360) % 360 / 0.5;
        int i = (int)Math.Floor(x);
        double f = x - i;
        return mask[i % Bins] * (1 - f) + mask[(i + 1) % Bins] * f;
    }

    /// <summary>Point reached when walking distKm from (lat, lon) in the compass direction bearingDeg (great circle).</summary>
    public static (double LatDeg, double LonDeg) Destination(double latDeg, double lonDeg, double bearingDeg, double distKm)
    {
        const double rad = Math.PI / 180;
        double lat = latDeg * rad, theta = bearingDeg * rad, delta = distKm / Geometry.MoonRadiusKm;
        double lat2 = Math.Asin(Math.Sin(lat) * Math.Cos(delta) + Math.Cos(lat) * Math.Sin(delta) * Math.Cos(theta));
        double lon2 = lonDeg * rad + Math.Atan2(Math.Sin(theta) * Math.Sin(delta) * Math.Cos(lat), Math.Cos(delta) - Math.Sin(lat) * Math.Sin(lat2));
        return (lat2 / rad, lon2 / rad);
    }
}
