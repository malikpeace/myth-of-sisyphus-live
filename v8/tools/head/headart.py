"""Head bitmap authoring preview. Bitmaps face RIGHT. python3 headart.py -> out.png (12x, on light/dark/mid backgrounds)"""
from PIL import Image, ImageDraw
PAL = {  # approximate game colour-look slots (hills daylight)
 'H': (160, 108, 70), 'h': (86, 56, 42), 'l': (50, 32, 34),
 'S': (222, 164, 108), 's': (168, 106, 70), 'd': (112, 64, 58), 'D': (62, 36, 50),
 'b': (94, 68, 58), 'e': (16, 12, 14), 'k': (58, 34, 44), 'm': (100, 56, 54), 'O': (32, 20, 28),
}
def parse(rows): return [list(r) for r in rows]
def render(rows, sc, bg, outline=True):
    h, w = len(rows), max(len(r) for r in rows)
    pad = 2
    im = Image.new("RGB", ((w + 2 * pad) * sc, (h + 2 * pad) * sc), bg)
    px = im.load()
    grid = [[None] * (w + 2 * pad) for _ in range(h + 2 * pad)]
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != '.': grid[y + pad][x + pad] = PAL[c]
    if outline:
        oset = set()
        for y in range(len(grid)):
            for x in range(len(grid[0])):
                if grid[y][x] is None:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < len(grid) and 0 <= xx < len(grid[0]) and grid[yy][xx] is not None:
                            oset.add((y, x)); break
        for (y, x) in oset: grid[y][x] = PAL['O']
    d = ImageDraw.Draw(im)
    for y in range(len(grid)):
        for x in range(len(grid[0])):
            v = grid[y][x]
            if v is None: continue
            col = v
            d.rectangle([x * sc, y * sc, (x + 1) * sc - 1, (y + 1) * sc - 1], fill=col)
    return im
def sheet(designs, out, sc=12):
    bgs = [(226, 236, 248), (24, 30, 58), (150, 110, 110)]
    tiles = []
    for name, rows in designs:
        for bg in bgs:
            tiles.append(render(rows, sc, bg))
        # also 1x-ish small preview upscaled x3 (what the player sees)
    W = sum(t.size[0] for t in tiles[:3]) + 20
    H = sum(max(t.size[1] for t in tiles[i:i + 3]) for i in range(0, len(tiles), 3)) + 10 * len(designs)
    S = Image.new("RGB", (W, H), (40, 40, 40)); y = 0
    for i in range(0, len(tiles), 3):
        x = 0
        for t in tiles[i:i + 3]:
            S.paste(t, (x, y)); x += t.size[0] + 10
        y += max(t.size[1] for t in tiles[i:i + 3]) + 10
    S.save(out); print(out, S.size)
