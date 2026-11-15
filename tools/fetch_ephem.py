"""One-off download of the LunarNav ephemeris from JPL Horizons (run once, never during the demo).

Moon (301) seen from Earth's centre (500@399), hourly, 2026-01-01 to 2031-01-01 UTC:
  Q14 = sub-Earth point, Q15 = sub-solar point, Q20 = Earth-Moon distance.
Header facts checked on a sample: frame MOON_ME, east-positive longitude 0..360, times UTC, range in AU.

Usage:
  python3 fetch_ephem.py <raw_dir> <out_csv>
Writes one raw Horizons text file per request into raw_dir (keep it: it is the citable source)
and the joined CSV: utc,subSunLat,subSunLon,subEarthLat,subEarthLon,earthRangeKm
"""
import datetime as dt
import os
import sys
import time
import urllib.parse
import urllib.request

AU_KM = 149597870.7
API = "https://ssd.jpl.nasa.gov/api/horizons.api?"


def fetch(q, y, m, raw_dir):
    stop = f"{y}-{m + 1:02d}-01" if m < 12 else f"{y + 1}-01-01"
    params = {"format": "text", "COMMAND": "301", "CENTER": "500@399", "MAKE_EPHEM": "YES",
              "EPHEM_TYPE": "OBSERVER", "START_TIME": f"{y}-{m:02d}-01", "STOP_TIME": stop,
              "STEP_SIZE": "1h", "QUANTITIES": q, "ANG_FORMAT": "DEG", "CSV_FORMAT": "YES"}
    for attempt in range(5):
        try:
            text = urllib.request.urlopen(API + urllib.parse.urlencode(params), timeout=120).read().decode()
            # Refuse silently-wrong data: frame, longitude convention and markers must be what the math assumes.
            for must in ("MOON_ME", "{East-longitude positive}", "$$SOE", "$$EOE"):
                if must not in text:
                    raise ValueError(f"response lacks {must!r}")
            with open(os.path.join(raw_dir, f"q{q}_{y}-{m:02d}.txt"), "w") as f:
                f.write(text)
            rows = {}
            for line in text[text.index("$$SOE") + 5: text.index("$$EOE")].strip().splitlines():
                f = [x.strip() for x in line.split(",")]
                rows[dt.datetime.strptime(f[0], "%Y-%b-%d %H:%M")] = (float(f[3]), float(f[4]))
            return rows
        except Exception as e:  # network hiccup: retry with backoff, then give up loudly
            print(f"  retry Q{q} {y}-{m:02d}: {e!r}"[:160], file=sys.stderr)
            time.sleep(3 * (attempt + 1))
    sys.exit(f"FAILED Q{q} {y}-{m:02d}")


def main():
    raw_dir, out_csv = sys.argv[1], sys.argv[2]
    os.makedirs(raw_dir, exist_ok=True)
    data = {"14": {}, "15": {}, "20": {}}
    for y in range(2026, 2031):
        for m in range(1, 13):
            for q in data:
                data[q].update(fetch(q, y, m, raw_dir))
        print(f"{y} done: {len(data['14'])} rows", file=sys.stderr)

    times = sorted(data["14"])
    assert set(times) == set(data["15"]) == set(data["20"]), "quantities cover different times"
    expected = int((dt.datetime(2031, 1, 1) - dt.datetime(2026, 1, 1)).total_seconds() // 3600) + 1
    assert len(times) == expected, f"{len(times)} rows, expected {expected}"
    assert all((b - a) == dt.timedelta(hours=1) for a, b in zip(times, times[1:])), "gap in the hourly grid"

    with open(out_csv, "w") as f:
        f.write("utc,subSunLat,subSunLon,subEarthLat,subEarthLon,earthRangeKm\n")
        for t in times:
            (elon, elat), (slon, slat), (au, _) = data["14"][t], data["15"][t], data["20"][t]
            f.write(f"{t:%Y-%m-%dT%H:%M:%SZ},{slat:.6f},{slon:.6f},{elat:.6f},{elon:.6f},{au * AU_KM:.3f}\n")
    print(f"wrote {len(times)} rows to {out_csv} ({times[0]} .. {times[-1]} UTC)")


if __name__ == "__main__":
    main()
