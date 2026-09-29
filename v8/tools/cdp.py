#!/usr/bin/env python3
"""Dependency-free headless-Chrome driver (raw DevTools protocol over a hand-rolled websocket).

run(url, w, h, steps, dpr=1, mobile=None) executes steps in order:
  ("js", expr)        evaluate, print + collect the result
  ("wait", seconds)
  ("shot", path)      full-page PNG screenshot (DOM + canvas, at dpr)
  ("canvas", path)    the game canvas' NATIVE pixels (VW x VH) as PNG - no upscaling, no DOM
"""
import base64, hashlib, json, os, socket, struct, subprocess, sys, time, urllib.request

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


class WS:
    def __init__(self, url):
        hostport, path = url[5:].split("/", 1)
        host, port = hostport.split(":")
        self.s = socket.create_connection((host, int(port)), timeout=60)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall(("GET /%s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                        "Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n" % (path, hostport, key)).encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.s.recv(4096)
        self.buf = buf.split(b"\r\n\r\n", 1)[1]
        self.id = 0

    def _exact(self, n):
        while len(self.buf) < n:
            chunk = self.s.recv(1 << 20)
            if not chunk:
                raise EOFError("socket closed")
            self.buf += chunk
        d, self.buf = self.buf[:n], self.buf[n:]
        return d

    def send(self, text):
        data = text.encode()
        n = len(data)
        hdr = bytearray([0x81])
        if n < 126:
            hdr.append(0x80 | n)
        elif n < 65536:
            hdr.append(0x80 | 126); hdr += struct.pack(">H", n)
        else:
            hdr.append(0x80 | 127); hdr += struct.pack(">Q", n)
        mask = os.urandom(4)
        hdr += mask
        self.s.sendall(bytes(hdr) + bytes(b ^ mask[i & 3] for i, b in enumerate(data)))

    def recv(self):
        msg = b""
        while True:
            b1, b2 = self._exact(2)
            fin, op, ln = b1 & 0x80, b1 & 0x0F, b2 & 0x7F
            if ln == 126:
                ln = struct.unpack(">H", self._exact(2))[0]
            elif ln == 127:
                ln = struct.unpack(">Q", self._exact(8))[0]
            payload = self._exact(ln)
            if op == 8:
                raise EOFError("closed")
            if op in (0, 1, 2):
                msg += payload
                if fin:
                    return msg.decode("utf-8", "replace")

    def cmd(self, method, params=None):
        self.id += 1
        i = self.id
        self.send(json.dumps({"id": i, "method": method, "params": params or {}}))
        while True:
            m = json.loads(self.recv())
            if m.get("id") == i:
                return m


def run(url, w, h, steps, dpr=1, mobile=None, port=9377, quiet=False):
    prof = "/tmp/cdp-prof-%d-%d" % (os.getpid(), port)
    p = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                          "--autoplay-policy=no-user-gesture-required", "--remote-debugging-port=%d" % port,
                          "--user-data-dir=" + prof, "--window-size=%d,%d" % (w, h), "about:blank"],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    out = []
    ws = None
    try:
        for _ in range(120):
            try:
                j = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/json" % port, timeout=1).read())
                pg = [t for t in j if t.get("type") == "page"]
                if pg:
                    ws = WS(pg[0]["webSocketDebuggerUrl"])
                    break
            except Exception:
                pass
            time.sleep(0.25)
        ws.cmd("Page.enable"); ws.cmd("Runtime.enable")
        if mobile is None:
            mobile = w < 700
        ws.cmd("Emulation.setDeviceMetricsOverride", {"width": w, "height": h, "deviceScaleFactor": dpr, "mobile": mobile})
        if mobile:
            ws.cmd("Emulation.setTouchEmulationEnabled", {"enabled": True, "maxTouchPoints": 5})
        ws.cmd("Page.addScriptToEvaluateOnNewDocument", {"source": "window.__errs=[];window.addEventListener('error',function(e){__errs.push(String(e.message)+' @'+((e.filename||'').split('/').pop())+':'+e.lineno)});window.addEventListener('unhandledrejection',function(e){__errs.push('rejection: '+String(e.reason&&e.reason.stack||e.reason))});"})
        ws.cmd("Page.navigate", {"url": url})
        time.sleep(3.0)
        for st in steps:
            if st[0] == "wait":
                time.sleep(st[1])
            elif st[0] == "js":
                r = ws.cmd("Runtime.evaluate", {"expression": st[1], "returnByValue": True, "awaitPromise": True})
                res = r.get("result", {})
                val = res.get("result", {}).get("value")
                if "exceptionDetails" in res:
                    val = "EXC: " + str(res["exceptionDetails"].get("exception", {}).get("description", ""))[:400]
                out.append(val)
                if not quiet:
                    print("JS>", json.dumps(val)[:700])
            elif st[0] == "shot":
                s = ws.cmd("Page.captureScreenshot", {"format": "png"})
                open(st[1], "wb").write(base64.b64decode(s["result"]["data"]))
                if not quiet:
                    print("SHOT>", st[1])
            elif st[0] == "canvas":
                r = ws.cmd("Runtime.evaluate", {"expression": "document.getElementById('game').toDataURL('image/png')", "returnByValue": True})
                data = r["result"]["result"]["value"].split(",", 1)[1]
                open(st[1], "wb").write(base64.b64decode(data))
                if not quiet:
                    print("CANVAS>", st[1])
        return out
    finally:
        p.terminate()
        try:
            p.wait(timeout=4)
        except Exception:
            p.kill()
        os.system("rm -rf " + prof)
