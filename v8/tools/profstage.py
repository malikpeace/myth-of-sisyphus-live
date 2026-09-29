import sys, os, json, time, subprocess, urllib.request
sys.path.insert(0, "/Users/malikpeace/myth-of-sisyphus-live/v8/tools")
from cdp import WS, CHROME
q = sys.argv[1]; port = 9850
prof = "/tmp/cdp-prof-pst-%d" % port
p = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=%d" % port, "--user-data-dir=" + prof, "--window-size=1000,800", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    ws = None
    for _ in range(120):
        try:
            j = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/json" % port, timeout=1).read()); pg = [t for t in j if t.get("type") == "page"]
            if pg: ws = WS(pg[0]["webSocketDebuggerUrl"]); break
        except Exception: pass
        time.sleep(0.25)
    ws.cmd("Page.enable"); ws.cmd("Runtime.enable")
    ws.cmd("Emulation.setDeviceMetricsOverride", {"width": 1000, "height": 800, "deviceScaleFactor": 1, "mobile": False})
    ws.cmd("Page.navigate", {"url": "http://127.0.0.1:8811/v8/tools/realm-test.html?prof=1&" + q + "&_=" + str(time.time())})
    t0 = time.time(); t = ""
    while time.time() - t0 < 40:
        r = ws.cmd("Runtime.evaluate", {"expression": "document.title", "returnByValue": True}); t = r["result"]["result"]["value"]
        if t.startswith("ready") or t.startswith("error"): break
        time.sleep(0.3)
    print(q, "->", t)
finally:
    p.terminate()
    try: p.wait(timeout=4)
    except Exception: p.kill()
    os.system("rm -rf " + prof)
