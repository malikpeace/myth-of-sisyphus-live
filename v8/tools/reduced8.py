import sys, os, json, time, base64, subprocess, urllib.request
sys.path.insert(0, "/Users/malikpeace/myth-of-sisyphus-live/v8/tools")
from cdp import WS, CHROME
from start8 import BASE, START, WAIT_ASSETS, ERRS
port = 10670; prof = "/tmp/cdp-prof-red-%d" % port
p = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=%d" % port, "--user-data-dir=" + prof, "--window-size=1440,900", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    ws = None
    for _ in range(120):
        try:
            j = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/json" % port, timeout=1).read()); pg = [t for t in j if t.get("type") == "page"]
            if pg: ws = WS(pg[0]["webSocketDebuggerUrl"]); break
        except Exception: pass
        time.sleep(0.25)
    ws.cmd("Page.enable"); ws.cmd("Runtime.enable")
    ws.cmd("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False})
    ws.cmd("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": "reduce"}]})
    ws.cmd("Page.addScriptToEvaluateOnNewDocument", {"source": "window.__errs=[];window.addEventListener('error',function(e){__errs.push(String(e.message)+' @'+((e.filename||'').split('/').pop())+':'+e.lineno)});"})
    ws.cmd("Page.navigate", {"url": BASE + "hills&_=%s" % time.time()})
    time.sleep(3)
    def ev(expr, wait=0):
        r = ws.cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}); time.sleep(wait)
        return r.get("result", {}).get("result", {}).get("value")
    print("reduced:", ev("window.matchMedia('(prefers-reduced-motion: reduce)').matches"))
    ev(WAIT_ASSETS); ev("document.getElementById('enterstart').click();1", 1.5)
    ev("document.querySelector('.mode-card[data-mode=endless]').click();1", 0.5)
    ev("(document.getElementById('startselected')||{click(){}}).click();1", 3)
    for a in (0, 350, 1100, 2000, 2800, 3600, 4700, 6000, 7600, 9000, 10600, 12000, 13600, 15200):
        ev("window.__sisyphusQa.setAltitude(%d);window.__sisyphusQa.drive(1.2,4);1" % a, 2.4)
    print(ev("JSON.stringify([window.__errs, window.__v8err||null, window.__sisyphusDebug().state])"))
finally:
    p.terminate()
    try: p.wait(timeout=4)
    except Exception: p.kill()
    os.system("rm -rf " + prof)
