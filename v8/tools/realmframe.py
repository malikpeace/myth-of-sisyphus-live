import sys, json, time, base64, subprocess, urllib.request, io, os
sys.path.insert(0, "/Users/malikpeace/myth-of-sisyphus-live/v8/tools")
from cdp import WS, CHROME
from PIL import Image
# usage: realmframe.py OUT.png PORT "query1" "query2" ...   -> side-by-side native frames
out, port = sys.argv[1], int(sys.argv[2]); qs = sys.argv[3:]
prof = "/tmp/cdp-prof-rf-%d" % port
p = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=%d" % port, "--user-data-dir=" + prof, "--window-size=1000,1000", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
imgs = []
try:
    ws = None
    for _ in range(120):
        try:
            j = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/json" % port, timeout=1).read()); pg = [t for t in j if t.get("type") == "page"]
            if pg: ws = WS(pg[0]["webSocketDebuggerUrl"]); break
        except Exception: pass
        time.sleep(0.25)
    ws.cmd("Page.enable"); ws.cmd("Runtime.enable")
    for q in qs:
        ws.cmd("Page.navigate", {"url": "http://127.0.0.1:8811/v8/tools/realm-test.html?%s&_=%s" % (q, time.time())})
        t0 = time.time()
        while time.time() - t0 < 25:
            r = ws.cmd("Runtime.evaluate", {"expression": "document.title", "returnByValue": True}); tt = r["result"]["result"]["value"]
            if tt.startswith("ready") or tt.startswith("error"): break
            time.sleep(0.2)
        r = ws.cmd("Runtime.evaluate", {"expression": "document.getElementById('game').toDataURL('image/png')", "returnByValue": True})
        imgs.append(Image.open(io.BytesIO(base64.b64decode(r["result"]["result"]["value"].split(",", 1)[1]))).convert("RGB"))
finally:
    p.terminate()
    try: p.wait(timeout=4)
    except Exception: p.kill()
    os.system("rm -rf " + prof)
W = sum(i.width for i in imgs) + 6 * (len(imgs) - 1); H = max(i.height for i in imgs)
s = Image.new("RGB", (W, H), (14, 14, 14)); x = 0
for i in imgs: s.paste(i, (x, 0)); x += i.width + 6
s.save(out); print(s.size)
