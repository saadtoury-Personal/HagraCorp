"""Join ours.json + pgda.json -> ../validation.json and a markdown table on stdout. Usage: python3 compare.py"""
import json, os
H = os.path.dirname(os.path.abspath(__file__))
ours = {(r["siteId"], r["mastM"]): r for r in json.load(open(H + "/ours.json"))}
rows, md = [], []
TOL = 5.0

def verdict(o, o_rng, p, p_rng):
    d = o - p
    if abs(d) <= TOL: return "OK", d
    if p_rng[0] - TOL <= o <= p_rng[1] + TOL or o_rng[0] - TOL <= p <= o_rng[1] + TOL: return "explained", d
    return "problem", d

for g in json.load(open(H + "/pgda.json")):
    sid = g["siteId"]
    name = "85S_060M" if g["85S_060M"]["sun"] else "75S_120M"
    ps, pe = g[name]["sun"], g[name]["earth"]
    o0, rng = g["ours0m"], g["ours0mEdge3x3"]
    vs, ds = verdict(o0["sunEdge"], rng["sun"], ps[0], ps[1:])
    ve, de = verdict(o0["earthEdge"], rng["earth"], pe[0], pe[1:])
    src = f"LOLA/PGDA AVGVISIB_{name}_201608(+_EARTH).IMG V1.05, nearest pixel, surface observer, 18.6 yr hourly, any part of disc"
    o2 = ours[(sid, 2)]
    spread = [v["sunCentre"] for v in o2["perYear"].values()]
    espread = [v["earthEdge"] for v in o2["perYear"].values()]
    note = (f"Sun {vs} (0 m edge {o0['sunEdge']} vs PGDA {ps[0]}, diff {ds:+.1f}; PGDA 3x3 {ps[1]}-{ps[2]}; ours +-80 m {rng['sun'][0]}-{rng['sun'][1]}). "
            f"Earth {ve} (diff {de:+.1f}; PGDA 3x3 {pe[1]}-{pe[2]}). Year-to-year 2026-2029 at 2 m: Sun {min(spread)}-{max(spread)}, Earth {min(espread)}-{max(espread)}.")
    for mast, o in ((0, o0), (2, o2), (10, ours[(sid, 10)])):
        rows.append(dict(siteId=sid, mastM=mast, ourSunPct=o["sunCentre"], ourSunPctEdge=o["sunEdge"], ourSunMeanDiskPct=o["sunMeanFrac"],
                         ourEarthPct=o["earthEdge"], ourEarthPctCentre=o["earthCentre"],
                         pgdaSunPct=ps[0], pgdaSunPct3x3=[ps[1], ps[2]], pgdaEarthPct=pe[0], pgdaEarthPct3x3=[pe[1], pe[2]],
                         sunVerdict=vs, earthVerdict=ve, source=src,
                         note=note + ("" if mast == 0 else " PGDA is a surface (0 m) map: compare it with the mastM=0 row; this row is the product value.")))
    o10 = ours[(sid, 10)]
    md.append(f"| {sid} | {o2['sunCentre']:.1f} / {o2['sunEdge']:.1f} / {o2['sunMeanFrac']:.1f} | {o10['sunCentre']:.1f} / {o10['sunEdge']:.1f} | {o0['sunEdge']:.1f} | {ps[0]:.1f} ({ps[1]:.0f}-{ps[2]:.0f}) | {ds:+.1f} | {vs} | "
              f"{o2['earthEdge']:.1f} | {o0['earthEdge']:.1f} | {pe[0]:.1f} ({pe[1]:.0f}-{pe[2]:.0f}) | {de:+.1f} | {ve} | {name[4:]} | {max(spread)-min(spread):.1f} |")
json.dump(rows, open(H + "/../validation.json", "w"), indent=1)
print("\n".join(md))
z = [r for r in rows if r["mastM"] == 0]
import statistics as st
for k, a, b in (("sun", "ourSunPctEdge", "pgdaSunPct"), ("earth", "ourEarthPct", "pgdaEarthPct")):
    d = [r[a] - r[b] for r in z]
    print(k, "n", len(d), "mean diff %.2f" % st.mean(d), "median |diff| %.2f" % st.median(map(abs, d)), "mean |diff| %.2f" % st.mean(map(abs, d)),
          "within5", sum(abs(x) <= 5 for x in d), "max |diff| %.1f" % max(map(abs, d)))
    print("  verdicts", {v: sum(r[k + "Verdict"] == v for r in z) for v in ("OK", "explained", "problem")})
    d2 = [ours[(r["siteId"], 2)]["sunEdge" if k == "sun" else "earthEdge"] - r[b] for r in z]
    print("  2 m edge vs PGDA: mean diff %.2f, within5 %d" % (st.mean(d2), sum(abs(x) <= 5 for x in d2)))
    d3 = [ours[(r["siteId"], 2)]["sunCentre" if k == "sun" else "earthCentre"] - r[b] for r in z]
    print("  2 m centre vs PGDA: mean diff %.2f, within5 %d" % (st.mean(d3), sum(abs(x) <= 5 for x in d3)))
sp = [max(v["sunCentre"] for v in ours[(r["siteId"], 2)]["perYear"].values()) - min(v["sunCentre"] for v in ours[(r["siteId"], 2)]["perYear"].values()) for r in z]
print("year spread sun 2m: median %.2f max %.2f" % (st.median(sp), max(sp)))
