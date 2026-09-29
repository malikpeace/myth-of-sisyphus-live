import sys, os
sys.path.insert(0, '.')
from start8 import *
from PIL import Image
dev = sys.argv[1] if len(sys.argv) > 1 else "desk"
realm = sys.argv[2] if len(sys.argv) > 2 else "hills"
alts = [float(a) for a in (sys.argv[3].split(",") if len(sys.argv) > 3 else "0,120,350,800".split(","))]
w, h = DEVICES[dev]
steps = list(START)
for i, a in enumerate(alts):
    steps += [("js", "window.__sisyphusQa.setAltitude(%g);window.__sisyphusQa.drive(3,2.4);1" % a), ("wait", 1.6), ("canvas", "a/tour-%s-%s-%d.png" % (realm, dev, i))]
steps += [("js", "JSON.stringify([window.__errs, window.__v8err||null])")]
port = int(os.environ.get("TPORT", 9750 + {"desk": 0, "port": 1, "land": 2}[dev]))
r = run(BASE + realm, w, h, steps, quiet=True, port=port, dpr=(2 if dev != "desk" else 1), mobile=(dev != "desk"))
print(r[-1][:300])
ims = [Image.open("a/tour-%s-%s-%d.png" % (realm, dev, i)).convert("RGB") for i in range(len(alts))]
tw = ims[0].width; th = ims[0].height
cols = 2 if dev != "port" else 4
rows = (len(ims) + cols - 1) // cols
sc = min(1.0, 1900.0 / (tw * cols))
s = Image.new("RGB", (int((tw * cols + 6 * (cols - 1)) * sc), int((th * rows + 6 * (rows - 1)) * sc)), (14, 14, 14))
for i, im in enumerate(ims):
    im2 = im.resize((int(tw * sc), int(th * sc)), Image.NEAREST if sc >= 1 else Image.LANCZOS)
    s.paste(im2, ((i % cols) * (int(tw * sc) + 6), (i // cols) * (int(th * sc) + 6)))
s.save("a/tour-%s-%s.png" % (realm, dev)); print(s.size)
