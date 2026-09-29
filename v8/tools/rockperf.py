import sys, os, json, time, subprocess, urllib.request
sys.path.insert(0, "/Users/malikpeace/myth-of-sisyphus-live/v8/tools")
from cdp import WS, CHROME
port = 10690; prof = "/tmp/cdp-prof-rp-%d" % port
p = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=%d" % port, "--user-data-dir=" + prof, "--window-size=800,600", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    ws = None
    for _ in range(120):
        try:
            j = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/json" % port, timeout=1).read()); pg = [t for t in j if t.get("type") == "page"]
            if pg: ws = WS(pg[0]["webSocketDebuggerUrl"]); break
        except Exception: pass
        time.sleep(0.25)
    ws.cmd("Page.enable"); ws.cmd("Runtime.enable")
    ws.cmd("Page.navigate", {"url": "http://127.0.0.1:8811/v8/tools/realm-test.html?realm=hills&alt=0&w=200&h=120&_=%s" % time.time()}); time.sleep(3)
    js = """(function(){var out={};[[12,12],[24,24],[48,48],[80,80],[110,110]].forEach(function(s,i){Rock.clear();var t0=performance.now(),n=8;for(var k=0;k<n;k++)Rock.get({rx:s[0],ry:s[1],angle:k*0.07+i,lightDx:-0.4,lightDy:-0.8,style:'granite'});out[s[0]]=+((performance.now()-t0)/n).toFixed(2)});return JSON.stringify(out)})()"""
    r = ws.cmd("Runtime.evaluate", {"expression": js, "returnByValue": True}); print(r["result"]["result"]["value"])
finally:
    p.terminate()
    try: p.wait(timeout=4)
    except Exception: p.kill()
    os.system("rm -rf " + prof)
