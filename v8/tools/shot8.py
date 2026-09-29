import sys, os
sys.path.insert(0, '.')
from start8 import *
from PIL import Image
# usage: shot8.py DEV REALM ALT OUT [extra query]
dev, realm, alt, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
extra = sys.argv[5] if len(sys.argv) > 5 else ""
w, h = DEVICES[dev]
steps = list(START) + [("js", "window.__sisyphusQa.setAltitude(%g);window.__sisyphusQa.drive(3,2.6);1" % alt), ("wait", 1.5), ("shot", out), ("js", "JSON.stringify([window.__errs, window.__v8err||null])")]
port = 9790 + {"desk": 0, "port": 1, "land": 2}[dev]
r = run(BASE + realm + extra, w, h, steps, quiet=True, port=port, dpr=(2 if dev != "desk" else 1), mobile=(dev != "desk"))
print(r[-1][:300])
