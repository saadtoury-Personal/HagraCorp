"""Literature check (Glaeser et al. 2014: 92.27 % at 2 m, 95.65 % at 10 m at the best Connecting Ridge spots).
Find the best-lit PGDA 60 m pixel within 2 km of our 'connecting-ridge' and 'shackleton-rim' points and run OUR method there.
Usage: python3 -I ridge_best.py <dir with AVGVISIB_*.IMG>"""
import json, sys, os
import numpy as np
sys.argv[1:] or sys.exit(__doc__)
import pgda, ours
eph, years = ours.load_ephem()
img = pgda.load("85S_060M", False)
out = []
def run(b):
    best = cur = 0
    for v in b:
        cur = cur + 1 if v else 0
        best = max(best, cur)
    return best
assert run([1, 0, 1, 1]) == 2
for sid in ("connecting-ridge", "shackleton-rim", "peak-near-shackleton", "de-gerlache-rim-1"):
    s = next(x for x in json.load(open(ours.DATA + "/sites.json")) if x["id"] == sid)
    x, y = pgda.xy(s["latDeg"], s["lonDeg"])
    l, c = int(round(2528.5 - y / 60)), int(round(2528.5 + x / 60))
    w = np.array(img[l - 33:l + 34, c - 33:c + 34])
    dl, dc = np.unravel_index(np.argmax(w), w.shape)
    bl, bc = l - 33 + dl, c - 33 + dc
    bx, by = (bc - 2528.5) * 60, (2528.5 - bl) * 60
    lat = float(np.degrees(2 * np.arctan(np.hypot(bx, by) / (2 * pgda.R)) - np.pi / 2)); lon = float(np.degrees(np.arctan2(bx, by)))
    r = dict(near=sid, bestLat=round(lat, 4), bestLon=round(lon, 4), distM=round(float(np.hypot(bx - x, by - y))), pgdaSunPct=round(float(w.max()) * 0.004, 2))
    for mast in (0, 2, 10):
        sf, ef, _, _ = ours.series(dict(latDeg=lat, lonDeg=lon), pgda.skyline(lat, lon, mast), eph)
        r[f"ours{mast}m"] = ours.stats(sf, ef)
        # longest continuous sunlit (any part of disc) and totally dark runs, in days (hourly steps), for Mazarico 2011's "240 days / 1.5 days"
        r[f"ours{mast}m"].update(longestSunlitDays=round(run(sf > 0) / 24, 1), longestDarkDays=round(run(sf <= 0) / 24, 1))
    out.append(r)
    print(sid, r["bestLat"], r["bestLon"], f"dist {r['distM']} m PGDA {r['pgdaSunPct']} | ours edge/centre 0m {r['ours0m']['sunEdge']}/{r['ours0m']['sunCentre']} 2m {r['ours2m']['sunEdge']}/{r['ours2m']['sunCentre']} 10m {r['ours10m']['sunEdge']}/{r['ours10m']['sunCentre']} | longest lit/dark days 0m {r['ours0m']['longestSunlitDays']}/{r['ours0m']['longestDarkDays']} 2m {r['ours2m']['longestSunlitDays']}/{r['ours2m']['longestDarkDays']} 10m {r['ours10m']['longestSunlitDays']}/{r['ours10m']['longestDarkDays']}")
json.dump(out, open(pgda.HERE + "/ridge_best.json", "w"), indent=1)
