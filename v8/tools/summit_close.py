import sys, os, json, base64, io
sys.path.insert(0, '.')
from cdp import run
from start8 import WAIT_ASSETS
from PIL import Image
CAP = """(function(n,ms){window.__sf=[];var c=document.getElementById('game'),i=0;var t=setInterval(function(){var d=window.__sisyphusDebug();window.__sf.push([c.toDataURL('image/png'),d.phase,d.heroX,d.heroY]);if(++i>=n)clearInterval(t)},ms);return 1})"""
url = "http://127.0.0.1:8811/v8/?qa=1&qaStart=1&mode=summit&qaSummitApproach=985"
steps = [("js", WAIT_ASSETS), ("wait", 1.0), ("js", "(window.__sisyphusQa.setAltitude(996),window.__sisyphusQa.drive(6,14),1)"), ("wait", 0.2),
         ("js", CAP + "(120,110)"), ("wait", 14.5), ("js", "JSON.stringify(window.__sf.map(function(f){return [f[1],f[2],f[3]]}))"), ("js", "JSON.stringify(window.__errs)"),
         ("js", "JSON.stringify(window.__sf.map(function(f){return f[0]}))")]
out = run(url, 1440, 900, steps, quiet=True, port=10610)
meta = json.loads(out[-3]); print("errs:", out[-2])
frames = json.loads(out[-1])
ims = [Image.open(io.BytesIO(base64.b64decode(f.split(',',1)[1]))).convert('RGB') for f in frames]
rest = [i for i, m in enumerate(meta) if m[0] == 'summitRest']
print("rest frames", rest[:1], rest[-1:] , len(rest))
pick = [rest[int(len(rest) * k)] for k in (0.02, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9)] if rest else []
tiles = []
for i in pick:
    hx, hy = meta[i][1], meta[i][2]
    tiles.append(ims[i].crop((int(hx) - 70, int(hy) - 90, int(hx) + 50, int(hy) + 20)).resize((120 * 4, 110 * 4), Image.NEAREST))
if tiles:
    s = Image.new('RGB', (480 * 4 + 18, 440 * 2 + 6), (14, 14, 14))
    for k, t in enumerate(tiles): s.paste(t, ((k % 4) * 486, (k // 4) * 446))
    s.save('a/summit-close.png'); print(s.size, [meta[i][0] for i in pick])
