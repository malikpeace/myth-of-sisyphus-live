import sys, json
from PIL import Image, ImageDraw
# usage: grid.py TAG DEV REALM FRAME BOX SCALE COLS OUT
tag, dev, realm, fr = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]); box = tuple(int(v) for v in sys.argv[5].split(",")); sc = int(sys.argv[6]); cols = int(sys.argv[7]); out = sys.argv[8]
meta = json.load(open("out/%s_%s_%s.json" % (tag, dev, realm))); tiles = []
for a, rows in meta.items():
    m = rows[fr]; im = Image.open(m["file"]).convert("RGB"); ax, ay = m["heroX"], m["heroY"]
    c = im.crop((ax + box[0], ay + box[1], ax + box[2], ay + box[3])).resize(((box[2]-box[0])*sc, (box[3]-box[1])*sc), Image.NEAREST)
    ImageDraw.Draw(c).text((3, 2), "%s alt~%.0f z=%.2f" % (realm, m["alt"], m["z"]), fill=(255, 255, 0)); tiles.append(c)
cw, ch = tiles[0].size; rows_n = (len(tiles) + cols - 1) // cols
S = Image.new("RGB", (cols * (cw + 4), rows_n * (ch + 4)), (20, 20, 20))
for k, t in enumerate(tiles): S.paste(t, ((k % cols) * (cw + 4), (k // cols) * (ch + 4)))
S.save(out); print(out, S.size)
