import sys, os
sys.path.insert(0, '.')
from start8 import *
mode = sys.argv[1]; port = int(sys.argv[2]); dev = sys.argv[3] if len(sys.argv) > 3 else "port"
d = DEVICES[dev]
steps = [("js", ERRS), ("js", WAIT_ASSETS), ("js", "document.getElementById('enterstart').click();1"), ("wait", 1.5),
  ("js", "(function(){var b=document.querySelector('.mode-card[data-mode=%s]');if(!b)return 'nocard';b.click();return 'ok'})()" % mode), ("wait", 0.5),
  ("js", "(function(){var b=document.getElementById('startselected');if(!b)return 'nobtn';var t=b.textContent;b.click();return t})()"), ("wait", 3.0),
  ("js", "window.__sisyphusQa.drive(3,5);1"), ("wait", 3.5),
  ("js", "JSON.stringify([window.__errs, window.__v8err||null, window.__sisyphusDebug().mode, window.__sisyphusDebug().state, window.__sisyphusDebug().score])")]
r = run(BASE + "hills", d[0], d[1], steps, quiet=True, port=port, dpr=(2 if dev != "desk" else 1), mobile=(dev != "desk"))
print(mode, dev, r[-3], r[-2], r[-1])
