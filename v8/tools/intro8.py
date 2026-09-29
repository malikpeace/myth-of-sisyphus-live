import sys, os
sys.path.insert(0, '.')
from start8 import *
from PIL import Image
dev = sys.argv[1] if len(sys.argv) > 1 else "desk"
d = DEVICES[dev]
steps = [("js", ERRS), ("js", WAIT_ASSETS), ("js", "document.getElementById('enterstart').click();1"), ("wait", 1.5), ("canvas", "a/intro-%s-0.png" % dev),
  ("js", "(()=>{var b=[...document.querySelectorAll('button')].find(b=>/^start /.test(b.textContent.trim())&&b.offsetParent);if(b){b.click();return b.textContent}return 'nobtn'})()")]
for i in range(1, 7):
    steps += [("wait", 0.35), ("canvas", "a/intro-%s-%d.png" % (dev, i))]
steps += [("js", "JSON.stringify([window.__errs, window.__v8err||null, window.__sisyphusDebug().state])")]
r = run(BASE + "hills", d[0], d[1], steps, quiet=True, port=9860 + {"desk": 0, "port": 1, "land": 2}[dev], dpr=1, mobile=(dev != "desk"))
print(r[-1])
ims = [Image.open("a/intro-%s-%d.png" % (dev, i)).convert("RGB") for i in range(7)]
tw, th = ims[0].size; cols = 4 if dev != "port" else 7; rows = (7 + cols - 1) // cols
sc = min(1.0, 1900.0 / (tw * cols))
s = Image.new("RGB", (int((tw * cols + 6 * (cols - 1)) * sc), int((th * rows + 6 * (rows - 1)) * sc)), (14, 14, 14))
for i, im in enumerate(ims):
    im2 = im.resize((int(tw * sc), int(th * sc)), Image.LANCZOS if sc < 1 else Image.NEAREST)
    s.paste(im2, ((i % cols) * (int(tw * sc) + 6), (i // cols) * (int(th * sc) + 6)))
s.save("a/intro-%s.png" % dev); print(s.size)
