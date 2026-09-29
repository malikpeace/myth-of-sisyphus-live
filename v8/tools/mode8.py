import sys, os
sys.path.insert(0, '.')
from start8 import *
from PIL import Image
# usage: mode8.py DEV MODE ALT1,ALT2,...
dev, mode, alts = sys.argv[1], sys.argv[2], [float(a) for a in sys.argv[3].split(",")]
d = DEVICES[dev]
steps = [("js", ERRS), ("js", WAIT_ASSETS), ("js", "document.getElementById('enterstart').click();1"), ("wait", 1.5),
  ("js", "(function(){var b=document.querySelector('.mode-card[data-mode=%s]');if(!b)return 'nomode';b.click();return 'ok'})()" % mode), ("wait", 0.5),
  ("js", "(function(){var b=document.getElementById('startselected')||[...document.querySelectorAll('button')].find(b=>/^(start|continue)/.test(b.textContent.trim())&&b.offsetParent);if(b){b.click();return b.textContent}return 'nobtn'})()"), ("wait", 2.5)]
for i, a in enumerate(alts):
    steps += [("js", "window.__sisyphusQa.setAltitude(%g);window.__sisyphusQa.drive(3,2.4);1" % a), ("wait", float(os.environ.get("MWAIT", "4.6")) if a != 705 else 0.55), ("canvas", "a/mode-%s-%s-%d.png" % (mode, dev, i))]
steps += [("js", "JSON.stringify([window.__errs, window.__v8err||null, window.__sisyphusDebug().mode])")]
port = int(os.environ.get("MPORT", 9810 + {"desk": 0, "port": 1, "land": 2}[dev]))
r = run(BASE + "hills" + "&qaMode=1", d[0], d[1], steps, quiet=True, port=port, dpr=1, mobile=(dev != "desk"))
print(r[3], r[5], r[-1][:200])
ims = [Image.open("a/mode-%s-%s-%d.png" % (mode, dev, i)).convert("RGB") for i in range(len(alts))]
tw, th = ims[0].size; cols = min(int(os.environ.get("MCOLS", "3")), len(ims)); rows = (len(ims) + cols - 1) // cols
s = Image.new("RGB", (tw * cols + 6 * (cols - 1), th * rows + 6 * (rows - 1)), (14, 14, 14))
for i, im in enumerate(ims): s.paste(im, ((i % cols) * (tw + 6), (i // cols) * (th + 6)))
s.save("a/mode-%s-%s.png" % (mode, dev)); print(s.size)
