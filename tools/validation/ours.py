"""Recompute LunarNav visibility stats from the precomputed skylines + ephem.csv (same math as Geometry.cs/Analysis.cs).
Usage: python3 ours.py  -> writes ours.json next to this script."""
import json, os, sys
import numpy as np
np.seterr(all="ignore")  # macOS Accelerate raises spurious matmul warnings; results are asserted finite below

# Default: the LunarNav folder of this repository (tools/validation/ -> ../../LunarNav). Override with LUNARNAV.
REPO = os.environ.get("LUNARNAV", os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "LunarNav")))
DATA = REPO + "/LunarNav.Web/wwwroot/data"
R_MOON, R_EARTH, SUN_RAD = 1737.4, 6371.0, 0.2666

def unit(lat, lon):
    lat, lon = np.radians(lat), np.radians(lon)
    return np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], -1)

def azel(d, lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    u = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    e = np.array([-np.sin(lo), np.cos(lo), 0.0])
    n = np.array([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)])
    up, ea, no = d @ u, d @ e, d @ n
    return np.degrees(np.arctan2(ea, no)) % 360, np.degrees(np.arctan2(up, np.hypot(ea, no)))

def horizon(mask, az):
    x = (az % 360) / 0.5
    i = np.floor(x).astype(int); f = x - i
    return mask[i % 720] * (1 - f) + mask[(i + 1) % 720] * f

def disk_fraction(margin, radius):
    k = np.clip(margin / radius, -1, 1)
    return 1 - (np.arccos(k) - k * np.sqrt(1 - k * k)) / np.pi

def load_ephem():
    a = np.genfromtxt(DATA + "/ephem.csv", delimiter=",", skip_header=1, usecols=(1, 2, 3, 4, 5))
    years = np.genfromtxt(DATA + "/ephem.csv", delimiter=",", skip_header=1, usecols=0, dtype=str)
    return a, np.array([int(y[:4]) for y in years])

def series(site, mask, eph):
    """Hourly (sunFrac, earthFrac, sunEl, earthEl) for one site."""
    lat, lon = site["latDeg"], site["lonDeg"]
    saz, sel = azel(unit(eph[:, 0], eph[:, 1]), lat, lon)
    d = eph[:, 4:5] * unit(eph[:, 2], eph[:, 3]) - R_MOON * unit(lat, lon)
    eaz, eel = azel(d, lat, lon)
    sf = disk_fraction(sel - horizon(mask, saz), SUN_RAD)
    ef = disk_fraction(eel - horizon(mask, eaz), np.degrees(np.arctan(R_EARTH / eph[:, 4])))
    return sf, ef, sel, eel

def stats(sf, ef):
    p = lambda b: round(100 * float(np.mean(b)), 2)
    return dict(sunCentre=p(sf >= 0.5), sunEdge=p(sf > 0), sunFull=p(sf >= 1), sunMeanFrac=p(sf),
                earthEdge=p(ef > 0), earthCentre=p(ef >= 0.5), earthFull=p(ef >= 1), earthMeanFrac=p(ef))

if __name__ == "__main__":
    assert abs(disk_fraction(np.array([0.0]), 1.0)[0] - 0.5) < 1e-12  # self-check: margin 0 = half disk
    assert disk_fraction(np.array([5.0]), 1.0)[0] == 1 and disk_fraction(np.array([-5.0]), 1.0)[0] == 0
    eph, years = load_ephem()
    out = []
    for s in json.load(open(DATA + "/sites.json")):
        if not s.get("terrain"):
            continue
        for mast in (2, 10):
            mask = np.array(json.load(open(f"{DATA}/masks/{s['id']}_{mast}m.json")), float)
            sf, ef, _, _ = series(s, mask, eph)
            assert np.isfinite(sf).all() and np.isfinite(ef).all()
            r = dict(siteId=s["id"], lat=s["latDeg"], lon=s["lonDeg"], mastM=mast, **stats(sf, ef))
            r["perYear"] = {int(y): stats(sf[years == y], ef[years == y]) for y in np.unique(years) if (years == y).sum() > 8000}  # 2030 has a single sample
            out.append(r)
    json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "ours.json"), "w"), indent=1)
    for r in out:
        ys = [v["sunCentre"] for v in r["perYear"].values()]
        print(f"{r['siteId']:28s} {r['mastM']:2d}m sunC {r['sunCentre']:6.2f} edge {r['sunEdge']:6.2f} mean {r['sunMeanFrac']:6.2f} "
              f"yr[{min(ys):.1f}-{max(ys):.1f}] earthEdge {r['earthEdge']:6.2f} earthC {r['earthCentre']:6.2f} mean {r['earthMeanFrac']:6.2f}")
