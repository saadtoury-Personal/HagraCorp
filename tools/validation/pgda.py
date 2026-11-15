"""Sample the LOLA/PGDA average-visibility maps (Sun + Earth) at each site and compare with ours.
Also recomputes skylines from the LDEM in numpy (independent of the C# code) at 0 m, to match PGDA's surface observer.
Usage: python3 -I pgda.py <dir with AVGVISIB_*.IMG>   (needs ours.py in the same folder; writes pgda.json)"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import ours

R = 1737400.0
PG = sys.argv[1]
MAPS = {"85S_060M": (5058, 60.0, 2528.5), "75S_120M": (7624, 120.0, 3811.5)}  # lines, m/px, offset (from the .LBL files)

def xy(lat, lon):
    rho = 2 * R * np.tan(np.pi / 4 + np.radians(lat) / 2)
    return rho * np.sin(np.radians(lon)), rho * np.cos(np.radians(lon))

def load(name, earth):
    n, _, _ = MAPS[name]
    f = f"{PG}/AVGVISIB_{name}_201608{'_EARTH' if earth else ''}.IMG"
    return np.memmap(f, dtype="<i2", mode="r", shape=(n, n))

def sample(img, name, lat, lon):
    """(nearest, min3x3, max3x3) in percent, or None if the 3x3 window leaves the map."""
    n, scale, off = MAPS[name]
    x, y = xy(lat, lon)
    l, s = int(round(off - y / scale)), int(round(off + x / scale))
    if not (1 <= l < n - 1 and 1 <= s < n - 1):
        return None
    w = img[l - 1:l + 2, s - 1:s + 2].astype(float) * 0.00004 * 100
    return round(float(w[1, 1]), 2), round(float(w.min()), 2), round(float(w.max()), 2)

# --- independent skyline from the LDEM (same geometry as Terrain.cs HorizonMask.Compute) ---
DEM = np.memmap(ours.REPO + "/data/LDEM_80S_80M.IMG", dtype="<i2", mode="r", shape=(7600, 7600))

def height(lat, lon):
    x, y = xy(lat, lon)
    line, samp = 3799.5 - y / 80, 3799.5 + x / 80
    l0, s0 = np.floor(line).astype(int), np.floor(samp).astype(int)
    ok = (l0 >= 0) & (s0 >= 0) & (l0 + 1 < 7600) & (s0 + 1 < 7600)
    l0, s0 = np.where(ok, l0, 0), np.where(ok, s0, 0)
    fl, fs = line - l0, samp - s0
    h = (DEM[l0, s0] * (1 - fs) + DEM[l0, s0 + 1] * fs) * (1 - fl) + (DEM[l0 + 1, s0] * (1 - fs) + DEM[l0 + 1, s0 + 1] * fs) * fl
    return np.where(ok, h * 0.5, np.nan)

def skyline(lat, lon, mast, max_km=250.0):
    az = np.radians(np.arange(720) * 0.5)[:, None]
    delta = (np.arange(1, int(max_km / 0.08) + 1) * 0.08 / 1737.4)[None, :]
    la = np.radians(lat)
    lat2 = np.arcsin(np.sin(la) * np.cos(delta) + np.cos(la) * np.sin(delta) * np.cos(az))
    lon2 = np.radians(lon) + np.arctan2(np.sin(az) * np.sin(delta) * np.cos(la), np.cos(delta) - np.sin(la) * np.sin(lat2))
    h = height(np.degrees(lat2), np.degrees(lon2))
    u = ours.unit(lat, lon)
    o = (1737.4 + float(height(np.array(lat), np.array(lon))) / 1000 + mast / 1000) * u
    v = (1737.4 + h / 1000)[..., None] * ours.unit(np.degrees(lat2), np.degrees(lon2)) - o
    ang = np.degrees(np.arcsin((v @ u) / np.linalg.norm(v, axis=-1)))
    return np.nanmax(ang, axis=1)   # shortcut: C# stops a ray at the map edge; nanmax over the whole ray is the same unless a ray re-enters the map (cannot happen, map is convex)

if __name__ == "__main__":
    imgs = {(n, e): load(n, e) for n in MAPS for e in (False, True)}
    eph, years = ours.load_ephem()
    sites = [s for s in json.load(open(ours.DATA + "/sites.json")) if s.get("terrain")]
    out = []
    for s in sites:
        lat, lon = s["latDeg"], s["lonDeg"]
        r = dict(siteId=s["id"], lat=lat, lon=lon)
        for name in MAPS:
            r[name] = dict(sun=sample(imgs[(name, False)], name, lat, lon), earth=sample(imgs[(name, True)], name, lat, lon))
        # our method with a 0 m observer (PGDA is a surface map), plus check against the stored 2 m mask
        m2 = skyline(lat, lon, 2.0)
        stored = np.array(json.load(open(f"{ours.DATA}/masks/{s['id']}_2m.json")), float)
        r["maskRecomputeMaxAbsDiffDeg"] = round(float(np.max(np.abs(m2 - stored))), 4)
        sf, ef, _, _ = ours.series(s, skyline(lat, lon, 0.0), eph)
        r["ours0m"] = ours.stats(sf, ef)
        # position sensitivity: our 0 m edge % at the 8 neighbours 80 m away (one LDEM pixel)
        x0, y0 = xy(lat, lon); sens_s, sens_e = [], []
        for dx in (-80, 0, 80):
            for dy in (-80, 0, 80):
                x, y = x0 + dx, y0 + dy
                la2 = np.degrees(2 * np.arctan(np.hypot(x, y) / (2 * R)) - np.pi / 2); lo2 = np.degrees(np.arctan2(x, y))
                sf, ef, _, _ = ours.series(dict(latDeg=la2, lonDeg=lo2), skyline(la2, lo2, 0.0), eph)
                sens_s.append(100 * np.mean(sf > 0)); sens_e.append(100 * np.mean(ef > 0))
        r["ours0mEdge3x3"] = dict(sun=[round(min(sens_s), 2), round(max(sens_s), 2)], earth=[round(min(sens_e), 2), round(max(sens_e), 2)])
        out.append(r)
        b = r["85S_060M"] if r["85S_060M"]["sun"] else r["75S_120M"]
        print(f"{s['id']:28s} maskdiff {r['maskRecomputeMaxAbsDiffDeg']:.3f} | sun ours0m edge {r['ours0m']['sunEdge']:6.2f} {r['ours0mEdge3x3']['sun']} "
              f"pgda60 {r['85S_060M']['sun']} pgda120 {r['75S_120M']['sun']} | earth ours {r['ours0m']['earthEdge']:6.2f} {r['ours0mEdge3x3']['earth']} pgda60 {r['85S_060M']['earth']} pgda120 {r['75S_120M']['earth']}", flush=True)
    json.dump(out, open(HERE + "/pgda.json", "w"), indent=1)
