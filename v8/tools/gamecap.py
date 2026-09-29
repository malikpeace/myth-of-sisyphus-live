#!/usr/bin/env python3
"""Drive the REAL v8 game in headless Chrome and capture native canvas frames + hero screen position.
  python3 gamecap.py PORT REALM PREFIX SECONDS NFRAMES [ALT] [W H]
Writes tools/out/game/<PREFIX>_<i>.png (native canvas) and prints JSON with heroX/heroY/camZoom per frame.
"""
import sys, os, json, time, base64, subprocess, urllib.request, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import WS, CHROME
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, "out", "game")
os.makedirs(GAME, exist_ok=True)

WAIT_ASSETS = "new Promise(function(r){var t0=Date.now();(function poll(){var d=window.__sisyphusDebug&&window.__sisyphusDebug();if((d&&d.assetsReady)||Date.now()-t0>25000)r(d?String(d.assetsReady):'nodebug');else setTimeout(poll,100)})()})"


def ev(ws, expr, await_=True):
    r = ws.cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": await_})
    res = r.get("result", {})
    if "exceptionDetails" in res:
        return "EXC: " + str(res["exceptionDetails"].get("exception", {}).get("description", ""))[:300]
    return res.get("result", {}).get("value")


class Game:
    def __init__(self, port, w=1440, h=900):
        self.port, self.w, self.h = port, w, h

    def __enter__(self):
        self.prof = "/tmp/cdp-prof-gamecap-%d" % self.port
        self.p = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required",
                                   "--remote-debugging-port=%d" % self.port, "--user-data-dir=" + self.prof, "--window-size=%d,%d" % (self.w, self.h), "about:blank"],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ws = None
        for _ in range(160):
            try:
                j = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/json" % self.port, timeout=1).read())
                pg = [t for t in j if t.get("type") == "page"]
                if pg:
                    ws = WS(pg[0]["webSocketDebuggerUrl"]); break
            except Exception:
                pass
            time.sleep(0.25)
        self.ws = ws
        ws.cmd("Page.enable"); ws.cmd("Runtime.enable")
        mobile = self.w < 700
        ws.cmd("Emulation.setDeviceMetricsOverride", {"width": self.w, "height": self.h, "deviceScaleFactor": 1, "mobile": mobile})
        if mobile:
            ws.cmd("Emulation.setTouchEmulationEnabled", {"enabled": True, "maxTouchPoints": 5})
        return self

    def __exit__(self, *a):
        try:
            self.p.terminate()
            try: self.p.wait(timeout=4)
            except Exception: self.p.kill()
        finally:
            os.system("rm -rf " + self.prof)

    def start(self, realm, extra="", host="http://127.0.0.1:8811"):
        ws = self.ws
        ws.cmd("Network.enable"); ws.cmd("Network.setCacheDisabled", {"cacheDisabled": True})
        ws.cmd("Page.navigate", {"url": "%s/v8/?qa=1&qaRealmArt=1&qaRealm=%s%s&_=%d" % (host, realm, extra, int(time.time()))})
        time.sleep(3.0)
        ev(ws, "window.__errs=[];1")
        for attempt in range(4):
            r = ev(ws, WAIT_ASSETS)
            print("assets", r)
            if r != "nodebug": break
            ws.cmd("Page.navigate", {"url": "%s/v8/?qa=1&qaRealmArt=1&qaRealm=%s%s&_=%d" % (host, realm, extra, int(time.time()))})
            time.sleep(3.0); ev(ws, "window.__errs=[];1")
        ev(ws, "document.getElementById('enterstart').click();1")
        time.sleep(1.5)
        print("start", ev(ws, "(()=>{var b=[...document.querySelectorAll('button')].find(b=>/^start /.test(b.textContent.trim())&&b.offsetParent);if(b){b.click();return b.textContent}return 'nobtn'})()"))
        time.sleep(2.5)

    def canvas(self):
        d = ev(self.ws, "document.getElementById('game').toDataURL('image/png')")
        return Image.open(io.BytesIO(base64.b64decode(d.split(",", 1)[1]))).convert("RGB")

    def dbg(self):
        return ev(self.ws, "(function(){var d=window.__sisyphusDebug();return JSON.stringify({heroX:d.heroX,heroY:d.heroY,z:d.camZoom,realm:d.realm,alt:window.__sisyphusQa.feel().altitude,VW:window.__sisyphusQa.feel().VW,VH:window.__sisyphusQa.feel().VH})})()")


def main():
    port, realm, prefix, secs, n = int(sys.argv[1]), sys.argv[2], sys.argv[3], float(sys.argv[4]), int(sys.argv[5])
    alt = float(sys.argv[6]) if len(sys.argv) > 6 else 0
    w = int(sys.argv[7]) if len(sys.argv) > 7 else 1440
    h = int(sys.argv[8]) if len(sys.argv) > 8 else 900
    meta = []
    with Game(port, w, h) as G:
        G.start(realm)
        ws = G.ws
        if alt:
            print("alt", ev(ws, "JSON.stringify(window.__sisyphusQa.setAltitude(%s))" % alt)[:80])
            time.sleep(1.0)
        ev(ws, "window.__drv=window.__sisyphusQa.drive(%s,6.5);1" % (secs + n * 0.2 + 3), await_=False)
        time.sleep(secs)
        for i in range(n):
            im = G.canvas(); d = G.dbg()
            im.save(os.path.join(GAME, "%s_%02d.png" % (prefix, i)))
            meta.append(json.loads(d))
            time.sleep(0.06)
        print("errs", ev(ws, "JSON.stringify(window.__errs)"))
    json.dump(meta, open(os.path.join(GAME, prefix + ".json"), "w"))
    print(meta[0], meta[-1])


if __name__ == "__main__":
    main()
