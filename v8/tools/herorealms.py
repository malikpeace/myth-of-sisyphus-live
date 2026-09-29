import sys, os, json
sys.path.insert(0, '.')
from start8 import *
from PIL import Image
import concurrent.futures as cf
REALMS = ["hills", "waterfalls", "moon-rome", "sunset-rome", "snow", "blossom", "dusk"]
HERO = sys.argv[1] if len(sys.argv) > 1 else "color"
def one(a):
    realm, port = a
    steps = list(START) + [("js", "window.__sisyphusQa.drive(2,4);1"), ("wait", 2.4), ("canvas", "a/hr-%s-%s.png" % (HERO, realm)), ("js", "JSON.stringify([window.__sisyphusDebug().heroX, window.__sisyphusDebug().heroY, window.__errs, window.__v8err||null])")]
    r = run(BASE + realm + "&hero=" + HERO, 1440, 900, steps, quiet=True, port=port, dpr=1)
    return realm, json.loads(r[-1])
with cf.ThreadPoolExecutor(max_workers=4) as ex:
    res = list(ex.map(one, [(r, 10600 + i) for i, r in enumerate(REALMS)]))
tiles = []
for realm, (hx, hy, errs, v8e) in res:
    im = Image.open("a/hr-%s-%s.png" % (HERO, realm)).convert("RGB")
    c = im.crop((int(hx) - 60, int(hy) - 70, int(hx) + 70, int(hy) + 20)).resize((130 * 3, 90 * 3), Image.NEAREST)
    tiles.append(c); print(realm, errs, v8e)
cols = 4; rows = 2; W, H = tiles[0].size
s = Image.new("RGB", (W * cols + 6 * (cols - 1), H * rows + 6), (14, 14, 14))
for i, t in enumerate(tiles): s.paste(t, ((i % cols) * (W + 6), (i // cols) * (H + 6)))
s.save("a/hero-realms-%s.png" % HERO); print(s.size)
