import sys, os, base64
sys.path.insert(0, '.')
from start8 import *
dev = sys.argv[1] if len(sys.argv) > 1 else "desk"
fmt = sys.argv[2] if len(sys.argv) > 2 else "square"
alt = sys.argv[3] if len(sys.argv) > 3 else "640"
realm = sys.argv[4] if len(sys.argv) > 4 else "hills"
out = sys.argv[5] if len(sys.argv) > 5 else "a/post-%s-%s.png" % (dev, fmt)
d = DEVICES[dev]
steps = list(START) + [("js", "window.__sisyphusQa.setAltitude(%s);window.__sisyphusQa.drive(3,2.6);1" % alt), ("wait", 4.5),
   ("js", "window.__sisyphusQa.postcardData('%s')" % fmt),
   ("js", "JSON.stringify([window.__errs, window.__v8err||null])")]
r = run(BASE + realm, d[0], d[1], steps, quiet=True, port=9795, dpr=1, mobile=(dev != "desk"))
data = r[-2]
open(out, "wb").write(base64.b64decode(data.split(",", 1)[1]))
print(r[-1][:300], out)
