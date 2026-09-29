import sys, os
sys.path.insert(0, '.')
from start8 import *
from PIL import Image
dev = sys.argv[1] if len(sys.argv) > 1 else "desk"
d = DEVICES[dev]
Z = [50, 750, 1150, 1850, 2550, 3250, 4500, 6000, 7500, 9000, 10500, 12000, 13500, 15100]
steps = [("js", ERRS), ("js", WAIT_ASSETS), ("js", "document.getElementById('enterstart').click();1"), ("wait", 1.5),
  ("js", "document.querySelector('.mode-card[data-mode=endless]').click();1"), ("wait", 0.5),
  ("js", "(document.getElementById('startselected')||{click(){}}).click();1"), ("wait", 3.0)]
for i, a in enumerate(Z):
    steps += [("js", "window.__sisyphusQa.setAltitude(%d);window.__sisyphusQa.drive(2.5,3);1" % a), ("wait", 4.0), ("canvas", "a/jn-%s-%d.png" % (dev, i))]
steps += [("js", "JSON.stringify([window.__errs, window.__v8err||null, window.__sisyphusDebug().state, performance.getEntriesByType('resource').length])")]
r = run(BASE + "hills", d[0], d[1], steps, quiet=True, port=10380 + {"desk": 0, "port": 1, "land": 2}[dev], dpr=1, mobile=(dev != "desk"))
print(r[-1])
ims = [Image.open("a/jn-%s-%d.png" % (dev, i)).convert("RGB") for i in range(len(Z))]
tw, th = ims[0].size; cols = 4; rows = (len(ims) + cols - 1) // cols
sc = 0.55 if dev == "desk" else 0.8
tiles = [im.resize((int(tw * sc), int(th * sc)), Image.LANCZOS) for im in ims]
W, H = tiles[0].size
s = Image.new("RGB", (W * cols + 6 * (cols - 1), H * rows + 6 * (rows - 1)), (14, 14, 14))
for i, t in enumerate(tiles): s.paste(t, ((i % cols) * (W + 6), (i // cols) * (H + 6)))
s.save("a/journey-%s.png" % dev); print(s.size)
