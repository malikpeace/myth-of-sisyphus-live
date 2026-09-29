#!/usr/bin/env python3
"""Hero lab: render the hero+stone from realm-test.html for many (look, t, extras) and build a cropped, upscaled contact sheet.
usage: herolab.py OUT.png SCALE PORT "label|look=color&t=1.2&realm=hills" ...
"""
import sys, os, json, time, base64, subprocess, urllib.request, io
sys.path.insert(0, "/Users/malikpeace/myth-of-sisyphus-live/v8/tools")
from cdp import WS, CHROME
from PIL import Image, ImageDraw
def main():
    out, scale, port = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    specs = [a.split("|") for a in sys.argv[4:]]
    prof = "/tmp/cdp-prof-herolab-%d" % port
    p = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=%d" % port,
                          "--user-data-dir=" + prof, "--window-size=1000,1000", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    imgs = []
    try:
        ws = None
        for _ in range(120):
            try:
                j = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/json" % port, timeout=1).read())
                pg = [t for t in j if t.get("type") == "page"]
                if pg: ws = WS(pg[0]["webSocketDebuggerUrl"]); break
            except Exception: pass
            time.sleep(0.25)
        ws.cmd("Page.enable"); ws.cmd("Runtime.enable")
        ws.cmd("Emulation.setDeviceMetricsOverride", {"width": 1000, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
        for sp in specs:
            name, q = sp[0], sp[1]
            w, h = 480, 300
            for kv in q.split("&"):
                if kv.startswith("w="): w = int(kv[2:])
                if kv.startswith("h="): h = int(kv[2:])
            if "w=" not in q: q += "&w=%d&h=%d" % (w, h)
            url = "http://127.0.0.1:8811/v8/tools/realm-test.html?" + q + "&_=" + str(time.time())
            ws.cmd("Page.navigate", {"url": url})
            t0 = time.time(); title = ""
            while time.time() - t0 < 20:
                r = ws.cmd("Runtime.evaluate", {"expression": "document.title+'|'+JSON.stringify(window.__errs||[])", "returnByValue": True})
                title = r.get("result", {}).get("result", {}).get("value", "") or ""
                if title.startswith("ready") or title.startswith("error"): break
                time.sleep(0.15)
            r = ws.cmd("Runtime.evaluate", {"expression": "(function(){var c=document.getElementById('game');return c?c.toDataURL('image/png'):''})()", "returnByValue": True})
            data = r["result"]["result"].get("value", "")
            if data:
                im = Image.open(io.BytesIO(base64.b64decode(data.split(",", 1)[1]))).convert("RGB")
                if "[]" not in title: print(name, title)
                imgs.append((name, im, w, h))
            else:
                print(name, "NO CANVAS", title)
    finally:
        p.terminate()
        try: p.wait(timeout=4)
        except Exception: p.kill()
        os.system("rm -rf " + prof)
    if not imgs: return
    crops = []
    for n, im, w, h in imgs:
        cx, cy = int(w * float(os.environ.get('HX', '0.42'))), int(h * float(os.environ.get('HY', '0.68')))
        box = tuple(int(v) for v in os.environ.get("CROP", "-60,-62,60,12").split(",")); c = im.crop((cx + box[0], cy + box[1], cx + box[2], cy + box[3])).resize(((box[2]-box[0]) * scale, (box[3]-box[1]) * scale), Image.NEAREST)
        crops.append((n, c))
    cw, ch = crops[0][1].size; cols = min(int(os.environ.get("COLS", "4")), len(crops)); rows = (len(crops) + cols - 1) // cols
    S = Image.new("RGB", (cols * (cw + 6), rows * (ch + 18)), (30, 30, 30)); dr = ImageDraw.Draw(S)
    for i, (n, c) in enumerate(crops):
        x, y = (i % cols) * (cw + 6), (i // cols) * (ch + 18)
        S.paste(c, (x, y + 14)); dr.text((x + 2, y), n, fill=(255, 255, 0))
    S.save(out); print("sheet", out, S.size)
if __name__ == "__main__": main()
