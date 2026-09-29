import sys, os
sys.path.insert(0, '.')
from start8 import *
from PIL import Image
dev = sys.argv[1] if len(sys.argv) > 1 else "desk"
w, h = DEVICES[dev]
steps = list(START) + [("js", "window.__sisyphusQa.setAltitude(140);window.__sisyphusQa.drive(3,2.4);1"), ("wait", 0.8)]
tests = [("eagle", 0.5), ("watcher", 0.5), ("thunder", 0.08), ("thunder", 0.25), ("wind", 0.5)]
for i, (t, p) in enumerate(tests):
    steps += [("js", "window.__sisyphusQa.mythic('%s',%g)" % (t, p)), ("wait", 0.6), ("canvas", "a/ov-%s-%d.png" % (dev, i))]
# quote sign + footprints
steps += [("js", "window.__sisyphusQa.mythic('eagle',null);window.__sisyphusQa.setAltitude(985);window.__sisyphusQa.drive(2.5,3);1"), ("wait", 0.6), ("canvas", "a/ov-%s-%d.png" % (dev, len(tests)))]
steps += [("js", "JSON.stringify([window.__errs, window.__v8err||null])")]
port = 9760 + {"desk": 0, "port": 1, "land": 2}[dev]
r = run(BASE + "hills", w, h, steps, quiet=True, port=port, dpr=(2 if dev != "desk" else 1), mobile=(dev != "desk"))
print(r[-1][:300])
n = len(tests) + 1
ims = [Image.open("a/ov-%s-%d.png" % (dev, i)).convert("RGB") for i in range(n)]
tw, th = ims[0].size; cols = 3 if dev != "port" else 6; rows = (n + cols - 1) // cols
sc = min(1.0, 1900.0 / (tw * cols))
s = Image.new("RGB", (int((tw * cols + 6 * (cols - 1)) * sc), int((th * rows + 6 * (rows - 1)) * sc)), (14, 14, 14))
for i, im in enumerate(ims):
    im2 = im.resize((int(tw * sc), int(th * sc)), Image.NEAREST if sc >= 1 else Image.LANCZOS)
    s.paste(im2, ((i % cols) * (int(tw * sc) + 6), (i // cols) * (int(th * sc) + 6)))
s.save("a/ov-%s.png" % dev); print(s.size)
