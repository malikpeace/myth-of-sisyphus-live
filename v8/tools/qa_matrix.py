import sys, os, json, base64, io, subprocess, concurrent.futures as cf
sys.path.insert(0, '.')
from start8 import *
from PIL import Image
REALMS = sys.argv[1].split(",") if len(sys.argv) > 1 else ["hills", "waterfalls", "moon-rome", "sunset-rome", "snow", "blossom", "dusk"]
ALTS = [0, 350, 1100, 3000]
EXTRA = sys.argv[2] if len(sys.argv) > 2 else ""
def one(args):
    realm, dev, port = args
    d = DEVICES[dev]
    steps = list(START)
    for i, a in enumerate(ALTS):
        steps += [("js", "window.__sisyphusQa.setAltitude(%g);window.__sisyphusQa.drive(2,3);1" % a), ("wait", 4.4 if a else 1.2), ("canvas", "a/qm-%s-%s-%d.png" % (realm, dev, i)),
                  ("js", "JSON.stringify([+V8.stats.ms.toFixed(2)])")]
    steps += [("js", "JSON.stringify([window.__errs, window.__v8err||null, window.__sisyphusDebug().state])")]
    try:
        r = run(BASE + realm + EXTRA, d[0], d[1], steps, quiet=True, port=port, dpr=(2 if dev != "desk" else 1), mobile=(dev != "desk"))
    except Exception as e:
        return (realm, dev, "CRASH %s" % e, [])
    rows = []
    for i, a in enumerate(ALTS):
        im = Image.open("a/qm-%s-%s-%d.png" % (realm, dev, i)).convert("RGB")
        px = list(im.getdata()); n = len(px)
        colors = len(set(px)); black = sum(1 for p in px if p[0] + p[1] + p[2] < 30) / n
        rows.append((a, colors, round(black * 100), json.loads(r[4 + i * 2 + 1 - 1 + 0 * 1])[0] if False else None))
    return (realm, dev, r[-1], rows)
jobs = []
port = 10200
for realm in REALMS:
    for dev in ("desk", "port", "land"):
        jobs.append((realm, dev, port)); port += 1
out = []
with cf.ThreadPoolExecutor(max_workers=4) as ex:
    for res in ex.map(one, jobs): out.append(res); print(res[0], res[1], res[2][:70], [(a, c, b) for a, c, b, _ in res[3]], flush=True)
