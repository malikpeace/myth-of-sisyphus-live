import sys, json
sys.path.insert(0, '.')
from start8 import *
WRAP = """(function(){window.__il=[];Object.keys(V8.realms).forEach(function(id){var R=V8.realms[id];if(!R.init||R.__w)return;var f=R.init;R.__w=1;R.init=function(){var t=performance.now();var r=f.apply(this,arguments);window.__il.push([id,+(performance.now()-t).toFixed(1)]);return r}});return Object.keys(V8.realms).length})()"""
seq = [300, 2000, 300, 2000, 1500, 2000, 300, 900, 300]
steps = [("js", ERRS), ("js", WAIT_ASSETS), ("js", WRAP), ("js", "document.getElementById('enterstart').click();1"), ("wait", 1.5),
  ("js", "document.querySelector('.mode-card[data-mode=endless]').click();1"), ("wait", 0.5),
  ("js", "(document.getElementById('startselected')||{click(){}}).click();1"), ("wait", 3.0)]
for a in seq: steps += [("js", "window.__sisyphusQa.setAltitude(%d);window.__sisyphusQa.drive(1.5,3);1" % a), ("wait", 4.0)]
steps += [("js", "JSON.stringify(window.__il)"), ("js", "JSON.stringify(window.__errs)")]
r = run("http://127.0.0.1:8811/v8/?qa=1&qaRealmArt=1", 1440, 900, steps, quiet=True, port=10921)
print(r[-2]); print(r[-1])
