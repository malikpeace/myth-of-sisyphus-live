import sys, os, json, time, subprocess, urllib.request, collections
sys.path.insert(0, "/Users/malikpeace/myth-of-sisyphus-live/v8/tools")
from cdp import WS, CHROME
realm, port = sys.argv[1], int(sys.argv[2])
prof = "/tmp/cdp-prof-ip-%d" % port
p = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--remote-debugging-port=%d" % port, "--user-data-dir=" + prof, "--window-size=900,700", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    ws = None
    for _ in range(120):
        try:
            j = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/json" % port, timeout=1).read()); pg = [t for t in j if t.get("type") == "page"]
            if pg: ws = WS(pg[0]["webSocketDebuggerUrl"]); break
        except Exception: pass
        time.sleep(0.25)
    ws.cmd("Page.enable"); ws.cmd("Runtime.enable"); ws.cmd("Profiler.enable"); ws.cmd("Profiler.setSamplingInterval", {"interval": 200})
    # load a cheap page first so scripts are cached, then profile only the realm load
    ws.cmd("Page.navigate", {"url": "http://127.0.0.1:8811/v8/tools/realm-test.html?realm=hills&w=480&h=300&_=%s" % time.time()}); time.sleep(3)
    ws.cmd("Profiler.start")
    ws.cmd("Page.navigate", {"url": "http://127.0.0.1:8811/v8/tools/realm-test.html?realm=%s&w=480&h=300&_=%s" % (realm, time.time())})
    t0 = time.time()
    while time.time() - t0 < 25:
        r = ws.cmd("Runtime.evaluate", {"expression": "document.title", "returnByValue": True}); t = r.get("result", {}).get("result", {}).get("value", "") or ""
        if t.startswith("ready") or t.startswith("error"): break
        time.sleep(0.1)
    r = ws.cmd("Profiler.stop")
    pr = r["result"]["profile"]; nodes = {n["id"]: n for n in pr["nodes"]}
    dt = pr["timeDeltas"]; samples = pr["samples"]; selfT = collections.Counter()
    for sid, d in zip(samples, dt): selfT[sid] += d
    agg = collections.Counter()
    for nid, t in selfT.items():
        cf = nodes[nid]["callFrame"]; agg[(cf["functionName"] or "(anon)", cf["url"].split("/")[-1], cf["lineNumber"] + 1)] += t
    tot = sum(agg.values())
    print(realm, "total sampled ms: %.0f" % (tot / 1000))
    for (fn, url, ln), t in agg.most_common(14): print("  %6.1f ms  %s  %s:%d" % (t / 1000, fn, url, ln))
finally:
    p.terminate()
    try: p.wait(timeout=4)
    except Exception: p.kill()
    os.system("rm -rf " + prof)
