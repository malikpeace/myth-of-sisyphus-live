import sys, os, json
sys.path.insert(0, '.')
from start8 import *
dev = sys.argv[1] if len(sys.argv) > 1 else "desk"; port = int(sys.argv[2]) if len(sys.argv) > 2 else 10500; N = int(sys.argv[3]) if len(sys.argv) > 3 else 100
d = DEVICES[dev]
FUZZ = """(function(N){
  window.__fz = {log: [], done: false};
  var Q = window.__sisyphusQa, sleep = function(ms){return new Promise(function(r){setTimeout(r, ms)})};
  var seed = (Math.floor(Math.random()*1e9)>>>0)||777; function rnd(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function pick(a){ return a[Math.floor(rnd() * a.length)]; }
  function clickSel(sel){ var els = document.querySelectorAll(sel); if (!els.length) return 'none'; var b = els[Math.floor(rnd() * els.length)]; b.click(); return b.getAttribute('data-value') || b.id || sel; }
  var acts = [
    function(){ var a = Math.floor(rnd() * 16500); Q.setAltitude(a); return 'alt ' + a; },
    function(){ Q.drive(1.2, 5); return 'drive'; },
    function(){ return 'look ' + clickSel('[data-custom=look]'); },
    function(){ return 'hero ' + clickSel('[data-custom=hero]'); },
    function(){ return 'pixels ' + clickSel('[data-custom=pixels]'); },
    function(){ Q.mythic(pick(['eagle','thunder','wind','watcher']), rnd()); return 'mythic'; },
    function(){ Q.setHazard(pick(['wind','gravel','ice',null]), 0.8); return 'hazard'; },
    function(){ Q.pullBack(pick([100,250,500,1000])); return 'pull'; },
    function(){ Q.oldBest(); return 'oldbest'; },
    function(){ var p = document.getElementById('mpause'); if (p) { p.click(); return 'pause'; } return 'nopause'; },
    function(){ var r = [...document.querySelectorAll('button')].find(function(b){ return /^resume/i.test(b.textContent.trim()) && b.offsetParent; }); if (r) { r.click(); return 'resume'; } return 'noresume'; }
  ];
  (async function(){
    for (var i = 0; i < N; i++) {
      var a = pick(acts), res = 'x';
      try { res = a(); } catch (e) { res = 'THROW ' + (e && e.message); window.__errs.push('fuzz-throw: ' + e); }
      window.__fz.log.push(res);
      await sleep(400 + rnd() * 700);
    }
    window.__fz.done = true;
  })();
  return 1;
})"""
steps = list(START) + [("js", FUZZ + "(%d)" % N)]
steps += [("wait", 10)]
waits = int(N * 1.0 / 10) + 6
for i in range(waits):
    steps += [("wait", 10)]
steps += [("js", "JSON.stringify({done: window.__fz.done, n: window.__fz.log.length, errs: window.__errs, v8err: window.__v8err||null, state: window.__sisyphusDebug().state, mode: window.__sisyphusDebug().mode, heap: Math.round(performance.memory.usedJSHeapSize/1048576), last: window.__fz.log.slice(-6)})")]
r = run(BASE + "hills", d[0], d[1], steps, quiet=True, port=port, dpr=(2 if dev != "desk" else 1), mobile=(dev != "desk"))
print(r[-1][:900])
