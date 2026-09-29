import sys, os
sys.path.insert(0, '.')
from start8 import *
from PIL import Image
dev = sys.argv[1] if len(sys.argv) > 1 else "desk"
d = DEVICES[dev]
steps = [("js", ERRS), ("js", WAIT_ASSETS), ("wait", 1.0), ("shot", "a/gate-%s-0.png" % dev),
  ("js", "document.getElementById('enterstart').click();1"), ("wait", 0.5), ("shot", "a/gate-%s-1.png" % dev), ("wait", 1.6), ("shot", "a/gate-%s-2.png" % dev),
  ("js", "(()=>{var b=[...document.querySelectorAll('button')].find(b=>/^start /.test(b.textContent.trim())&&b.offsetParent);if(b){b.click();return b.textContent}return 'nobtn'})()"),
  ("wait", 0.5), ("shot", "a/gate-%s-3.png" % dev), ("wait", 0.9), ("shot", "a/gate-%s-4.png" % dev), ("wait", 2.0), ("shot", "a/gate-%s-5.png" % dev),
  ("js", "JSON.stringify([window.__errs, window.__v8err||null, window.__sisyphusDebug().state])")]
r = run(BASE + "hills", d[0], d[1], steps, quiet=True, port=10570 + {"desk": 0, "port": 1, "land": 2}[dev], dpr=1, mobile=(dev != "desk"))
print(r[-1])
ims = [Image.open("a/gate-%s-%d.png" % (dev, i)).convert("RGB") for i in range(6)]
tw, th = ims[0].size; sc = 0.5 if dev == "desk" else (0.42 if dev == "port" else 0.6)
tiles = [im.resize((int(tw * sc), int(th * sc)), Image.LANCZOS) for im in ims]
W, H = tiles[0].size; cols = 3 if dev != "port" else 6; rows = 6 // cols
s = Image.new("RGB", (W * cols + 6 * (cols - 1), H * rows + 6 * (rows - 1)), (14, 14, 14))
for i, t in enumerate(tiles): s.paste(t, ((i % cols) * (W + 6), (i // cols) * (H + 6)))
s.save("a/gate-%s.png" % dev); print(s.size)
