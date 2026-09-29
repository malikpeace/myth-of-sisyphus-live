import sys, os
sys.path.insert(0, "/Users/malikpeace/myth-of-sisyphus-live/v8/tools")
from cdp import run
from start8 import BASE, WAIT_ASSETS, ERRS
OUT = "/Users/malikpeace/myth-of-sisyphus-live/v8/tools/out/"
realm = sys.argv[1]; dev = sys.argv[2]
W, H = {"desk": (1440, 900), "port": (430, 932), "land": (932, 430)}[dev]
steps = [("js", ERRS), ("js", WAIT_ASSETS), ("js", "document.getElementById('enterstart').click();1"), ("wait", 2.0),
         ("shot", OUT + "title_%s_%s.png" % (realm, dev)),
         ("js", "JSON.stringify({errs:window.__errs, st:(window.__sisyphusDebug&&window.__sisyphusDebug().gameState)})")]
print(run(BASE + realm, W, H, steps, quiet=True, port=int(sys.argv[3]) if len(sys.argv) > 3 else 9802))
