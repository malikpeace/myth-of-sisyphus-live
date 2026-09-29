import sys, json, os
from PIL import Image, ImageDraw
# usage: sheet.py TAG DEV REALMS(csv) FRAME BOX(l,t,r,b) SCALE OUT
tag, dev, realms, fr = sys.argv[1], sys.argv[2], sys.argv[3].split(","), int(sys.argv[4])
box = tuple(int(v) for v in sys.argv[5].split(",")); sc = int(sys.argv[6]); out = sys.argv[7]
cols = []
for r in realms:
    meta = json.load(open("out/%s_%s_%s.json" % (tag, dev, r)))
    col = []
    for a, rows in meta.items():
        m = rows[fr]; im = Image.open(m["file"]).convert("RGB"); ax, ay = m["heroX"], m["heroY"]
        c = im.crop((ax + box[0], ay + box[1], ax + box[2], ay + box[3])).resize(((box[2]-box[0])*sc, (box[3]-box[1])*sc), Image.NEAREST)
        ImageDraw.Draw(c).text((3, 2), "%s alt~%.0f z=%.2f" % (r, m["alt"], m["z"]), fill=(255, 255, 0))
        col.append(c)
    cols.append(col)
cw, ch = cols[0][0].size; nr = len(cols[0])
S = Image.new("RGB", (len(cols) * (cw + 4), nr * (ch + 4)), (20, 20, 20))
for ci, col in enumerate(cols):
    for ri, t in enumerate(col): S.paste(t, (ci * (cw + 4), ri * (ch + 4)))
S.save(out); print(out, S.size)
