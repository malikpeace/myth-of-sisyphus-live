import sys, os, json, time, subprocess, urllib.request
sys.path.insert(0, "/Users/malikpeace/myth-of-sisyphus-live/v8/tools")
from cdp import WS, CHROME
from start8 import BASE, WAIT_ASSETS, ERRS
scene, alt, port = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); rate = float(sys.argv[4]) if len(sys.argv) > 4 else 4
prof = "/tmp/cdp-prof-th-%d" % port
p = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=%d" % port, "--user-data-dir=" + prof, "--window-size=430,932", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    ws = None
    for _ in range(120):
        try:
            j = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/json" % port, timeout=1).read()); pg = [t for t in j if t.get("type") == "page"]
            if pg: ws = WS(pg[0]["webSocketDebuggerUrl"]); break
        except Exception: pass
        time.sleep(0.25)
    ws.cmd("Page.enable"); ws.cmd("Runtime.enable")
    ws.cmd("Emulation.setDeviceMetricsOverride", {"width": 430, "height": 932, "deviceScaleFactor": 2, "mobile": True})
    ws.cmd("Emulation.setTouchEmulationEnabled", {"enabled": True, "maxTouchPoints": 5})
    ws.cmd("Page.addScriptToEvaluateOnNewDocument", {"source": "window.__errs=[];window.addEventListener('error',function(e){__errs.push(String(e.message))});"})
    ws.cmd("Page.navigate", {"url": BASE + scene + "&_=%s" % time.time()}); time.sleep(3)
    def ev(expr, wait=0):
        r = ws.cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}); time.sleep(wait)
        return r.get("result", {}).get("result", {}).get("value")
    ev(WAIT_ASSETS); ev("document.getElementById('enterstart').click();1", 1.5)
    ev("(function(){var b=[...document.querySelectorAll('button')].find(b=>/^start /.test(b.textContent.trim())&&b.offsetParent);if(b)b.click();return 1})()", 3)
    ev("window.__sisyphusQa.setAltitude(%d);window.__sisyphusQa.drive(6,4);1" % alt, 0.5)
    ws.cmd("Emulation.setCPUThrottlingRate", {"rate": rate})
    time.sleep(3.5)
    print(scene, alt, "x%g" % rate, ev("JSON.stringify(window.__sisyphusQa.frameStats())"), "v8ms", ev("V8.stats.ms.toFixed(1)"), "errs", ev("JSON.stringify(window.__errs)"))
finally:
    p.terminate()
    try: p.wait(timeout=4)
    except Exception: p.kill()
    os.system("rm -rf " + prof)
