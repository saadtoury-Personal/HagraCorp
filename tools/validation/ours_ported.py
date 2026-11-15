"""ours.py with the three disk changes the C# made in PR 26 ported over (added 2026-11-15, after the first C# validation run):
  1. each disk is cut into 16 vertical strips, each compared with the skyline at its own azimuth (Geometry.DiskFractionOverMask)
  2. the Sun's radius follows the Earth-Sun distance (Geometry.SunAngularRadiusAt)
  3. the Earth covering the Sun removes that part of the Sun (Geometry.EclipsedFraction)
ours.py and ours.json are left untouched: they are the values the registered csharpVsPython rule was fixed against.
Usage: python3 -I ours_ported.py  -> writes ours_ported.json (0 m from the numpy LDEM skyline in pgda.py, 2 m and 10 m from the stored masks)."""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import ours, pgda

def disk_fraction_strips(mask, az, el, r, strips=16):
    """Vectorised Geometry.DiskFractionOverMask: az, el, r are arrays of N samples (deg)."""
    az, el, r = (np.asarray(v, float)[:, None] for v in (az, el, r))
    cos_el = np.maximum(0.05, np.cos(np.radians(el)))
    w = 2 * r / strips
    i = np.arange(strips)[None, :]
    c = ours.horizon(mask, az + (-r + (i + 0.5) * w) / cos_el) - el   # skyline height relative to the centre
    x0, x1 = -r + i * w, -r + (i + 1) * w
    G = lambda t: (t * np.sqrt(np.maximum(0, r * r - t * t)) + r * r * np.arcsin(np.clip(t / r, -1, 1))) / 2
    full = 2 * (G(x1) - G(x0))
    a = np.sqrt(np.maximum(0, r * r - c * c))
    lo, hi = np.maximum(x0, -a), np.minimum(x1, a)
    cut = hi > lo
    mid = np.where(cut, G(np.where(cut, hi, 0)) - G(np.where(cut, lo, 0)), 0)
    ln = np.where(cut, hi - lo, 0)
    area = np.where(c >= 0, mid - c * ln, full - (mid + c * ln))
    area = np.where(c >= r, 0, np.where(c <= -r, full, area))
    f = np.clip(area.sum(1) / (np.pi * r[:, 0] ** 2), 0, 1)
    f = np.where((c <= -r).all(1), 1.0, f)
    return np.where((c >= r).all(1), 0.0, f)

def sun_radius(utc):
    """Geometry.SunAngularRadiusAt, utc as datetime64 array."""
    days = (utc - np.datetime64("2000-01-01T12:00:00")) / np.timedelta64(1, "D")
    m = np.radians(357.529 + 0.98560028 * days)
    return np.degrees(np.arcsin(696_000 / (149_597_870.7 * (1 - 0.0167 * np.cos(m)))))

def eclipsed_fraction(d, r1, r2):
    """Geometry.EclipsedFraction: part of the Sun (radius r1) covered by the Earth (radius r2), centres d apart (deg)."""
    with np.errstate(all="ignore"):
        a = (r1 ** 2 * np.arccos(np.clip((d * d + r1 * r1 - r2 * r2) / (2 * d * r1), -1, 1))
             + r2 ** 2 * np.arccos(np.clip((d * d + r2 * r2 - r1 * r1) / (2 * d * r2), -1, 1))
             - 0.5 * np.sqrt(np.maximum(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2))))
        part = np.clip(a / (np.pi * r1 * r1), 0, 1)
    return np.where(d >= r1 + r2, 0.0, np.where(d <= np.abs(r2 - r1), np.minimum(1, r2 * r2 / (r1 * r1)), part))

def separation(az1, el1, az2, el2):
    r = np.radians
    c = np.sin(r(el1)) * np.sin(r(el2)) + np.cos(r(el1)) * np.cos(r(el2)) * np.cos(r(az1 - az2))
    return np.degrees(np.arccos(np.clip(c, -1, 1)))

def load_utc():
    s = np.genfromtxt(ours.DATA + "/ephem.csv", delimiter=",", skip_header=1, usecols=0, dtype=str)
    return np.array([x.rstrip("Z") for x in s], dtype="datetime64[s]")

def series(site, mask, eph, utc):
    """Hourly (sunFrac, earthFrac) as Analysis.Timeline computes them."""
    lat, lon = site["latDeg"], site["lonDeg"]
    saz, sel = ours.azel(ours.unit(eph[:, 0], eph[:, 1]), lat, lon)
    d = eph[:, 4:5] * ours.unit(eph[:, 2], eph[:, 3]) - ours.R_MOON * ours.unit(lat, lon)
    eaz, eel = ours.azel(d, lat, lon)
    rs, re = sun_radius(utc), np.degrees(np.arctan(ours.R_EARTH / eph[:, 4]))
    sf = disk_fraction_strips(mask, saz, sel, rs)
    ef = disk_fraction_strips(mask, eaz, eel, re)
    sf = sf * (1 - eclipsed_fraction(separation(saz, sel, eaz, eel), rs, re))
    return sf, ef

if __name__ == "__main__":
    # self-checks: on a flat skyline the strips give the old one-check disk fraction exactly; eclipse edge cases
    flat, m = np.zeros(720), np.linspace(-1.5, 1.5, 61)
    assert np.allclose(disk_fraction_strips(flat, np.zeros(61), m, np.ones(61)), ours.disk_fraction(m, 1.0), atol=1e-9)
    assert eclipsed_fraction(np.array([0.0]), 0.27, 0.95)[0] == 1 and eclipsed_fraction(np.array([2.0]), 0.27, 0.95)[0] == 0
    assert 0.26 < sun_radius(np.array(["2026-01-03"], dtype="datetime64[s]"))[0] < 0.273
    eph, _ = ours.load_ephem()
    utc = load_utc()
    assert len(utc) == len(eph)
    out = []
    for s in json.load(open(ours.DATA + "/sites.json")):
        if not s.get("terrain"):
            continue
        for mast in (0, 2, 10):
            mask = pgda.skyline(s["latDeg"], s["lonDeg"], 0.0) if mast == 0 else \
                np.array(json.load(open(f"{ours.DATA}/masks/{s['id']}_{mast}m.json")), float)
            sf, ef = series(s, mask, eph, utc)
            assert np.isfinite(sf).all() and np.isfinite(ef).all()
            out.append(dict(siteId=s["id"], mastM=mast, **ours.stats(sf, ef)))
            print(f"{s['id']:28s} {mast:2d}m sunEdge {out[-1]['sunEdge']:6.2f} earthEdge {out[-1]['earthEdge']:6.2f}", flush=True)
    json.dump(out, open(HERE + "/ours_ported.json", "w"), indent=1)
