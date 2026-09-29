#!/usr/bin/env python3
"""Pixel-UI QA harness: drives the real game headlessly through every UI screen and saves
screenshots + one contact sheet per device (so a reviewer can see all screens in one image).

usage:
  python3 v8/tools/ui-shots.py [--tag NAME] [--dev port,land,desk,small,wide] [--flows menu,play,over]
                               [--dpr N] [--sheet-h PX] [--realm hills]
outputs (v8/tools/out/):
  ui-<tag>-<dev>-<shot>.png      every screenshot (DOM + canvas, at --dpr)
  ui-<tag>-sheet-<dev>.png       contact sheet of that device's shots (labelled)
  ui-<tag>-errs.txt              window.__errs + UI checks gathered along the way
Flows:
  menu    splash -> enter -> menu scrolled top..bottom, 'other modes' + settings open, a choice toggled
  play    start a run -> HUD -> pause -> share postcard -> close -> resume -> restart -> the 'again?' panel
  over    timed 10s run -> game-over card
  states  real mouse/keyboard input: hover, Tab focus rings, pixel tooltip, daily card, input + toast, mode HUD
  extras  reduced-motion, live Fine->Chunky toggle, control-hint bubble, realm 'continue', daily card
Every flow ends with an in-page audit: elements past the viewport, text overflowing its box, tap targets
under 44 CSS px, text that does not start on a whole device pixel ("offPixel"), font sizes that are not a
whole multiple of the design pixel ("offSizes"), fonts in use and window.__errs.
  --extra pixels=chunky   runs everything in Chunky mode
Needs the static server on 127.0.0.1:8811 (see REALM-GUIDE.md) and uses CDP ports 9880-9899 only
(ports something else is already listening on are skipped).
"""
import argparse, json, os, sys, threading
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
from cdp import run

HOST = os.environ.get("V8HOST", "http://127.0.0.1:8811/v8/")
OUT = os.path.join(here, "out")
DEVICES = {"port": (430, 932, 2), "land": (932, 430, 2), "desk": (1440, 900, 1),
           "small": (360, 740, 2), "wide": (1920, 1080, 1)}
WAIT_ASSETS = ("new Promise(function(r){var t0=Date.now();(function poll(){var d=window.__sisyphusDebug&&window.__sisyphusDebug();"
               "if((d&&d.assetsReady)||Date.now()-t0>25000)r(d?String(d.assetsReady):'nodebug');else setTimeout(poll,100)})()})")
CLICK_START = ("(()=>{var b=document.getElementById('startselected');if(b&&b.offsetParent){b.click();return b.textContent}"
               "b=[...document.querySelectorAll('button')].find(b=>/^start /.test(b.textContent.trim())&&b.offsetParent);"
               "if(b){b.click();return b.textContent}return 'nobtn'})()")
# UI audit run inside the page: overflowing elements, tiny tap targets, non-pixel fonts on visible text.
AUDIT = r"""(()=>{var W=innerWidth,bad=[],small=[],fonts={};
document.querySelectorAll('body *').forEach(function(e){if(!e.offsetParent&&getComputedStyle(e).position!=='fixed')return;
 var r=e.getBoundingClientRect();if(r.width<1||r.height<1)return;var cs=getComputedStyle(e);
 if(cs.visibility==='hidden'||+cs.opacity===0)return;
 var sc=e.closest('#startscreen,#pausescreen');var inScroll=sc&&sc!==e;
 if((r.right>W+1||r.left<-1)&&!e.closest('canvas')&&e.id!=='startscreen')bad.push((e.id||e.className||e.tagName)+':'+Math.round(r.left)+'..'+Math.round(r.right));
 if(e.scrollWidth>e.clientWidth+1&&cs.overflowX==='visible'&&e.children.length===0&&e.textContent.trim())bad.push('text-overflow:'+(e.id||e.className||e.tagName));
 if((e.tagName==='BUTTON'||e.tagName==='SUMMARY'||e.tagName==='INPUT')&&(r.height<43.5||r.width<43.5))small.push((e.id||e.className||e.textContent.trim().slice(0,14))+':'+Math.round(r.width)+'x'+Math.round(r.height));
 if(e.childNodes.length&&[].some.call(e.childNodes,function(n){return n.nodeType===3&&n.textContent.trim()})){var f=cs.fontFamily.split(',')[0];fonts[f]=(fonts[f]||0)+1}});
var dpr=devicePixelRatio,px=+getComputedStyle(document.documentElement).getPropertyValue('--px'),blur=[],sizes={};
var tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),tn;
while(tn=tw.nextNode()){if(!tn.nodeValue.trim())continue;var pe=tn.parentElement,o=pe,vis=!!(pe&&pe.getClientRects().length);
 while(vis&&o){var c3=getComputedStyle(o);if(c3.display==='none'||c3.visibility==='hidden'||+c3.opacity===0)vis=false;o=o.parentElement}
 if(!vis)continue;var fs=parseFloat(getComputedStyle(pe).fontSize);if((fs/(8*px))%1)sizes[fs]=1;
 var rg=document.createRange();rg.selectNodeContents(tn);var bx=rg.getClientRects()[0];
 if(bx&&(Math.abs(bx.left*dpr-Math.round(bx.left*dpr))>0.02||Math.abs(bx.top*dpr-Math.round(bx.top*dpr))>0.02))blur.push((pe.id||pe.className||pe.tagName)+'@'+bx.left.toFixed(2)+','+bx.top.toFixed(2))}
return JSON.stringify({W:W,px:px,overflow:bad.slice(0,12),smallTargets:small.slice(0,12),offPixel:blur.slice(0,8),offSizes:Object.keys(sizes),fonts:fonts,errs:window.__errs})})()"""


def menu_flow(dev, tag):
    p = lambda s: os.path.join(OUT, "ui-%s-%s-%s.png" % (tag, dev, s))
    scroll = lambda frac: ("js", "(()=>{var s=document.getElementById('startscreen');s.scrollTop=Math.round((s.scrollHeight-s.clientHeight)*%s);return s.scrollTop+'/'+s.scrollHeight})()" % frac)
    return [
        ("js", WAIT_ASSETS), ("wait", 0.6), ("shot", p("01-splash")),
        ("js", "document.getElementById('enterstart').click();1"), ("wait", 2.2), ("shot", p("02-menu")),
        ("js", "(()=>{var o=document.getElementById('othermodes');if(o)o.open=true;var d=document.querySelector('.menu-more');if(d)d.open=true;"
               "var t=document.querySelector('[data-mode=timed]');if(t)t.click();return !!o})()"), ("wait", 0.5),
        scroll(0.25), ("wait", 0.3), ("shot", p("03-menu-25")),
        scroll(0.5), ("wait", 0.3), ("shot", p("04-menu-50")),
        ("js", "(()=>{var c=document.querySelector('.choice[data-custom=hero][data-value=color]');if(c)c.click();"
               "var e=document.getElementById('emailjoininput');if(e){e.focus()}return !!c})()"), ("wait", 0.3),
        scroll(0.75), ("wait", 0.3), ("shot", p("05-menu-75")),
        scroll(1), ("wait", 0.3), ("shot", p("06-menu-100")),
        ("js", "(()=>{var c=document.querySelector('.choice[data-custom=hero][data-value=shadow]');if(c)c.click();"
               "var r=document.querySelector('.realm-choice[data-realm=hills]');if(r)r.click();document.getElementById('startscreen').scrollTop=0;return 1})()"),
        ("wait", 0.4), ("js", AUDIT),
    ]


def play_flow(dev, tag):
    p = lambda s: os.path.join(OUT, "ui-%s-%s-%s.png" % (tag, dev, s))
    return [
        ("js", WAIT_ASSETS), ("js", "document.getElementById('enterstart').click();1"), ("wait", 1.6),
        ("js", CLICK_START), ("wait", 3.0),
        ("js", "window.__sisyphusQa.drive(4,5).then(function(r){return JSON.stringify(r)})"), ("wait", 0.2),
        ("shot", p("07-hud")),
        ("js", "document.getElementById('mpause').click();1"), ("wait", 0.6), ("shot", p("08-pause")), ("js", AUDIT),
        ("js", "document.getElementById('pausecarve').click();1"), ("wait", 0.8), ("shot", p("09-postcard")), ("js", AUDIT),
        ("js", "document.getElementById('postclose').click();1"), ("wait", 0.4),
        ("js", "document.getElementById('pauseresume').click();1"), ("wait", 0.8),
        ("js", "document.getElementById('mpause').click();document.getElementById('pauserestart').click();1"), ("wait", 1.5),
        ("js", "JSON.stringify({state:window.__sisyphusDebug().gameState,errs:__errs})"),
        ("js", "window.__sisyphusQa.forceAgain()&&1"), ("wait", 1.2), ("shot", p("10-again")), ("js", AUDIT),
    ]


def over_flow(dev, tag):
    p = lambda s: os.path.join(OUT, "ui-%s-%s-%s.png" % (tag, dev, s))
    return [
        ("js", WAIT_ASSETS), ("js", "document.getElementById('enterstart').click();1"), ("wait", 1.6),
        ("js", "(()=>{var o=document.getElementById('othermodes');if(o)o.open=true;document.querySelector('[data-mode=timed]').click();"
               "var d=document.querySelector('[data-timed-duration=\"10\"]');if(d)d.click();return 1})()"), ("wait", 0.4),
        ("js", CLICK_START), ("wait", 3.0),
        ("js", "window.__sisyphusQa.drive(6,3).then(function(r){return JSON.stringify(r)})"),
        ("wait", 8.0), ("shot", p("11-gameover")), ("js", AUDIT),
    ]


def states_flow(dev, tag):
    """hover / keyboard focus / tooltip / daily card / mode HUD / control hint / toast (needs run2)."""
    p = lambda s: os.path.join(OUT, "ui-%s-%s-%s.png" % (tag, dev, s))
    return [
        ("js", WAIT_ASSETS), ("js", "document.getElementById('enterstart').click();1"), ("wait", 2.0),
        ("hover", ".realm-choice[data-realm=falls], .realm-choice:nth-child(2)"), ("wait", 0.3),
        ("key", "Tab"), ("key", "Tab"), ("key", "Tab"), ("wait", 0.2), ("shot", p("12-hover-focus")),
        ("js", "(()=>{var o=document.getElementById('othermodes');if(o)o.open=true;document.querySelector('[data-mode=daily]').click();"
               "document.getElementById('startscreen').scrollTop=0;return 1})()"), ("wait", 0.5), ("shot", p("13-daily")),
        ("js", "(()=>{var d=document.querySelector('.menu-more');d.open=true;var a=document.querySelector('.achievement-item');"
               "a.scrollIntoView({block:'center'});return 1})()"), ("wait", 0.4),
        ("hover", ".achievement-item:nth-child(2)"), ("wait", 0.8), ("shot", p("14-tooltip")),
        ("js", "(()=>{var i=document.getElementById('emailjoininput');i.scrollIntoView({block:'center'});i.focus();i.value='sis';"
               "document.getElementById('sharebtn').click();return 1})()"), ("wait", 0.4), ("shot", p("15-input-toast")),
        ("js", "document.querySelector('[data-mode=timed]').click();document.getElementById('startscreen').scrollTop=0;1"), ("wait", 0.3),
        ("js", CLICK_START), ("wait", 2.6), ("shot", p("16-hint")),
        ("js", "window.__sisyphusQa.drive(3,5).then(function(r){return JSON.stringify(r)})"), ("wait", 0.1), ("shot", p("17-modehud")),
        ("js", AUDIT),
    ]


def extras_flow(dev, tag):
    """reduced motion, live Fine->Chunky toggle, control-hint bubble, realm 'continue', daily card (needs run2)."""
    p = lambda s: os.path.join(OUT, "ui-%s-%s-%s.png" % (tag, dev, s))
    blink = "getComputedStyle(document.getElementById('startselected'),'::before').animationName"
    return [
        ("media", "reduce"), ("js", WAIT_ASSETS), ("js", "document.getElementById('enterstart').click();1"), ("wait", 1.8),
        ("js", "'reduced-motion blink: '+" + blink), ("media", "no-preference"), ("wait", 0.2),
        ("js", "'normal blink: '+" + blink),
        ("js", "(()=>{document.querySelector('.menu-more').open=true;document.querySelector('.choice[data-custom=pixels][data-value=chunky]').click();return 1})()"),
        ("wait", 0.8), ("js", "'chunky: px='+getComputedStyle(document.documentElement).getPropertyValue('--px')+' mw='+getComputedStyle(document.documentElement).getPropertyValue('--mw')+' cols='+document.documentElement.dataset.pxCols"),
        ("js", AUDIT), ("shot", p("18-chunky-live")),
        ("js", "(()=>{document.querySelector('.choice[data-custom=pixels][data-value=fine]').click();return 1})()"), ("wait", 0.8),
        ("js", "'fine: px='+getComputedStyle(document.documentElement).getPropertyValue('--px')+' mw='+getComputedStyle(document.documentElement).getPropertyValue('--mw')"),
        ("js", "(()=>{var o=document.getElementById('othermodes');o.open=true;document.querySelector('[data-mode=daily]').click();document.getElementById('startscreen').scrollTop=0;return 1})()"),
        ("wait", 0.5), ("shot", p("19-daily")),
        ("js", "(()=>{document.querySelector('.realm-choice[data-realm=hills]').click();document.getElementById('startscreen').scrollTop=0;return 1})()"), ("wait", 0.3),
        ("js", CLICK_START), ("wait", 3.0),
        ("js", "(()=>{var h=document.getElementById('controlhint');h.style.left=Math.round(innerWidth*0.45)+'px';h.style.top=Math.round(innerHeight*0.5)+'px';h.classList.add('show');return 1})()"),
        ("wait", 0.4), ("shot", p("20-hint")),
        ("js", "document.getElementById('controlhint').classList.remove('show');window.__sisyphusQa.drive(3,5).then(function(r){return JSON.stringify(r)})"),
        ("js", "window.__sisyphusQa.returnToMenu()&&1"), ("wait", 2.5),
        ("js", "(()=>{var r=document.getElementById('realmcontinue');return 'continue: hidden='+r.hidden+' text='+r.textContent})()"),
        ("shot", p("21-continue")), ("js", AUDIT),
    ]


FLOWS = {"menu": menu_flow, "play": play_flow, "over": over_flow, "states": states_flow, "extras": extras_flow}


def run2(url, w, h, steps, dpr=1, port=9890):
    """cdp.run plus ("hover", css) / ("key", name) steps (real input events, so :hover/:focus-visible apply)."""
    import base64, json as _j, subprocess, time, urllib.request
    from cdp import WS, CHROME
    prof = "/tmp/cdp-prof-ui-%d-%d" % (os.getpid(), port)
    pr = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=%d" % port,
                           "--user-data-dir=" + prof, "--window-size=%d,%d" % (w, h), "about:blank"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    out, ws = [], None
    try:
        for _ in range(120):
            try:
                j = _j.loads(urllib.request.urlopen("http://127.0.0.1:%d/json" % port, timeout=1).read())
                pg = [t for t in j if t.get("type") == "page"]
                if pg:
                    ws = WS(pg[0]["webSocketDebuggerUrl"]); break
            except Exception:
                pass
            time.sleep(0.25)
        ws.cmd("Page.enable"); ws.cmd("Runtime.enable")
        ws.cmd("Emulation.setDeviceMetricsOverride", {"width": w, "height": h, "deviceScaleFactor": dpr, "mobile": w < 700})
        ws.cmd("Page.addScriptToEvaluateOnNewDocument", {"source": "window.__errs=[];window.addEventListener('error',function(e){__errs.push(String(e.message))});"})
        ws.cmd("Page.navigate", {"url": url}); time.sleep(3.0)
        ev = lambda e: ws.cmd("Runtime.evaluate", {"expression": e, "returnByValue": True, "awaitPromise": True}).get("result", {}).get("result", {}).get("value")
        for st in steps:
            if st[0] == "wait":
                time.sleep(st[1])
            elif st[0] == "js":
                out.append(ev(st[1]))
            elif st[0] == "shot":
                d = ws.cmd("Page.captureScreenshot", {"format": "png"})
                open(st[1], "wb").write(base64.b64decode(d["result"]["data"]))
            elif st[0] == "hover":
                r = ev("(()=>{var e=document.querySelector(%s);if(!e)return null;var r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()" % _j.dumps(st[1]))
                if r:
                    ws.cmd("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": r[0], "y": r[1], "pointerType": "mouse"})
            elif st[0] == "media":
                ws.cmd("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": st[1]}]})
            elif st[0] == "key":
                for t in ("keyDown", "keyUp"):
                    ws.cmd("Input.dispatchKeyEvent", {"type": t, "key": st[1], "code": st[1], "windowsVirtualKeyCode": 9 if st[1] == "Tab" else 13})
        return out
    finally:
        pr.terminate()
        try:
            pr.wait(timeout=4)
        except Exception:
            pr.kill()
        os.system("rm -rf " + prof)


def sheet(tag, dev, height):
    from PIL import Image, ImageDraw
    files = sorted(f for f in os.listdir(OUT) if f.startswith("ui-%s-%s-" % (tag, dev)) and f.endswith(".png"))
    if not files:
        return None
    ims = []
    for f in files:
        im = Image.open(os.path.join(OUT, f)).convert("RGB")
        s = height / im.height
        im = im.resize((max(1, round(im.width * s)), height), Image.NEAREST if s >= 1 else Image.LANCZOS)
        ims.append((f[len("ui-%s-%s-" % (tag, dev)):-4], im))
    cols = max(1, min(len(ims), int(3000 // (ims[0][1].width + 8))))
    rows = (len(ims) + cols - 1) // cols
    cw = max(i.width for _, i in ims) + 8
    sh = Image.new("RGB", (cols * cw, rows * (height + 22)), (40, 40, 40))
    d = ImageDraw.Draw(sh)
    for k, (name, im) in enumerate(ims):
        x, y = (k % cols) * cw, (k // cols) * (height + 22)
        sh.paste(im, (x + 4, y + 20)); d.text((x + 6, y + 4), name, fill=(255, 220, 120))
    path = os.path.join(OUT, "ui-%s-sheet-%s.png" % (tag, dev))
    sh.save(path)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="now")
    ap.add_argument("--dev", default="port,land,desk")
    ap.add_argument("--flows", default="menu,play,over")
    ap.add_argument("--dpr", type=float, default=0)
    ap.add_argument("--sheet-h", type=int, default=560)
    ap.add_argument("--realm", default="hills")
    ap.add_argument("--extra", default="", help="extra query string, e.g. chunky=1")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.startswith("ui-%s-" % a.tag):
            os.remove(os.path.join(OUT, f))
    url = HOST + "?qa=1&qaRealmArt=1&qaRealm=" + a.realm + (("&" + a.extra) if a.extra else "")
    jobs, results = [], {}
    import socket

    def busy(pt):   # something (a stray browser, another tool) already listens there: never share a port
        with socket.socket() as so:
            so.settimeout(0.2)
            return so.connect_ex(("127.0.0.1", pt)) == 0
    free = [pt for pt in range(9880, 9900) if not busy(pt)]
    if not free:
        sys.exit("no free CDP port in 9880-9899")
    k = 0
    for dev in a.dev.split(","):
        w, h, dpr = DEVICES[dev]
        if a.dpr:
            dpr = a.dpr
        for fl in a.flows.split(","):
            jobs.append((dev, fl, w, h, dpr, free[k % len(free)])); k += 1

    def work(job):
        dev, fl, w, h, dpr, prt = job
        try:
            if fl in ("states", "extras"):
                results[(dev, fl)] = run2(url, w, h, FLOWS[fl](dev, a.tag), dpr=dpr, port=prt)
            else:
                results[(dev, fl)] = run(url, w, h, FLOWS[fl](dev, a.tag), dpr=dpr, port=prt, quiet=True)
        except Exception as e:  # keep the other flows going
            results[(dev, fl)] = ["FAILED: %r" % e]

    # at most 4 browsers at once (the server + page load ~30 MB each); batches reuse ports only after the last one exited
    for i in range(0, len(jobs), min(4, len(free))):
        ts = [threading.Thread(target=work, args=(j,)) for j in jobs[i:i + min(4, len(free))]]
        [t.start() for t in ts]; [t.join() for t in ts]
    lines = []
    for k in sorted(results):
        lines.append("%s %s: %s" % (k[0], k[1], json.dumps(results[k])[:1800]))
    open(os.path.join(OUT, "ui-%s-errs.txt" % a.tag), "w").write("\n".join(lines) + "\n")
    print("\n".join(lines))
    for dev in a.dev.split(","):
        print("SHEET>", sheet(a.tag, dev, a.sheet_h))


if __name__ == "__main__":
    main()
