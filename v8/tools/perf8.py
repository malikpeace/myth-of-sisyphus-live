import sys, os, json
sys.path.insert(0, '.')
from start8 import *
dev = sys.argv[1] if len(sys.argv) > 1 else "desk"
realm = sys.argv[2] if len(sys.argv) > 2 else "hills"
d = DEVICES[dev]
steps = list(START)
for a in (0, 350, 1600):
    steps += [("js", "window.__sisyphusQa.setAltitude(%g);window.__sisyphusQa.drive(4,3);1" % a), ("wait", 5.2),
              ("js", "(function(){var s=0,n=0,mx=0;return new Promise(function(res){var t0=performance.now();(function f(){var ms=V8.stats.ms;s+=ms;n++;if(ms>mx)mx=ms;if(performance.now()-t0<2500)requestAnimationFrame(f);else res(JSON.stringify({avgV8ms:+(s/n).toFixed(2),maxV8ms:+mx.toFixed(2),frames:n,qa:window.__sisyphusQa.frameStats()}))})()})})()")]
steps += [("js", "JSON.stringify([window.__errs, window.__v8err||null])")]
r = run(BASE + realm, d[0], d[1], steps, quiet=True, port=9840 + {"desk": 0, "port": 1, "land": 2}[dev], dpr=(2 if dev != "desk" else 1), mobile=(dev != "desk"))
for x in r[-4:]: print(x)
