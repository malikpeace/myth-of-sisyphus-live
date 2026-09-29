import sys, os
sys.path.insert(0, '.')
from start8 import *
from PIL import Image
d = DEVICES["desk"]
steps = list(START) + [("js", "window.__sisyphusQa.setAltitude(150);window.__sisyphusQa.drive(2,3);1"), ("wait", 4.0),
  ("js", "window.__sisyphusQa.oldBest();1"), ("wait", 1.1), ("canvas", "a/ob-0.png"), ("wait", 1.4), ("canvas", "a/ob-1.png"),
  ("js", "JSON.stringify([window.__errs, window.__v8err||null])")]
r = run(BASE + "hills", d[0], d[1], steps, quiet=True, port=9890, dpr=1, mobile=False)
print(r[-1])
ims = [Image.open("a/ob-%d.png" % i).convert("RGB") for i in range(2)]
s = Image.new("RGB", (ims[0].width * 2 + 6, ims[0].height), (14, 14, 14)); s.paste(ims[0], (0, 0)); s.paste(ims[1], (ims[0].width + 6, 0)); s.save("a/ob-sheet.png")
