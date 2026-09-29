#!/usr/bin/env python3
"""Build the V8 pixel-UI assets. Dependency-free (stdlib only; PIL is used for the optional preview).

  python3 v8/ui/build.py

1. Reads v8/ui/glyphs.txt (ASCII-art glyphs) and compiles a real TrueType font, "SisyphusPx":
   every run of lit pixels becomes a rectangular contour (rows are merged into maximal
   rectangles, so the outline is exactly the pixel grid - no curves, no hinting needed).
   Tables: head hhea maxp OS/2 name cmap(fmt 4) post(v3) glyf loca hmtx gasp.
   Metrics: 16 units per font pixel, unitsPerEm 128 (= 8 font pixels), so
   font-size: calc(var(--px) * 8px) draws exactly one font pixel per game pixel.
2. Generates the tiny PNG textures the UI uses (ordered-dither tiles, dithered ramps, ornaments).
3. Rewrites the generated blocks in v8/ui.css (@font-face + texture variables) and v8/ui.js
   (the glyph table, so canvas code can draw the same bitmap font: PixelUI.drawText).
   Also writes v8/ui/sisyphus-px.ttf and v8/ui/font-preview.png (if PIL is available).
To add a character: add a block to glyphs.txt, run this script, reload.
"""
import base64, os, re, struct, sys, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
V8 = os.path.dirname(HERE)
PX = 16                 # font units per font pixel
UPM = 8 * PX            # em = 8 font pixels
CAP, XH, ASC, DESC = 7, 5, 9, 2
FAMILY = "SisyphusPx"
# 1904-01-01 epoch; fixed so rebuilds are byte-identical
STAMP = 3_842_150_400

# ------------------------------------------------------------------ glyph source

def parse(path):
    glyphs, cur = {}, None

    def close():
        if cur is None:
            return
        rows = cur["rows"]
        if rows:
            w = len(rows[0])
            bad = [r for r in rows if len(r) != w or set(r) - set("#.")]
            if bad or len(rows) not in (7, 9):
                sys.exit("glyph %r: need 7 or 9 rows of equal width using '#' and '.', got %r" % (cur["ch"], rows))
        else:
            w = 0
        cur["w"] = w
        cur["adv"] = cur["adv"] if cur["adv"] is not None else w + 1
        glyphs[ord(cur["ch"])] = cur

    for raw in open(path, encoding="utf-8"):
        line = raw.rstrip("\n").rstrip()
        if line.startswith(";"):
            continue
        if line.startswith("@"):
            close()
            body = line[1:]
            if body.startswith("U+") and len(body) > 2 and re.match(r"U\+[0-9A-Fa-f]{4,6}", body):
                head = body.split()
                ch, attrs = chr(int(head[0][2:], 16)), head[1:]
            else:
                ch, attrs = body[0], body[1:].split()
            adv = None
            for a in attrs:
                if a.startswith("adv="):
                    adv = int(a[4:])
            cur = {"ch": ch, "rows": [], "adv": adv}
            continue
        if not line:
            close(); cur = None
            continue
        if cur is None:
            sys.exit("row outside a glyph: %r" % line)
        cur["rows"].append(line)
    close()
    return glyphs


def rects(rows):
    """Merge lit pixels into maximal horizontal runs, then stack identical runs vertically."""
    out, active = [], {}
    rows = list(rows) + [""]
    for r, row in enumerate(rows):
        runs, x = [], 0
        while x < len(row):
            if row[x] == "#":
                x0 = x
                while x < len(row) and row[x] == "#":
                    x += 1
                runs.append((x0, x))
            else:
                x += 1
        cur = set(runs)
        for key in list(active):
            if key not in cur:
                out.append((key[0], key[1], active.pop(key), r - 1))
        for key in runs:
            active.setdefault(key, r)
    return out

# ------------------------------------------------------------------ TrueType writer

def glyph_contours(g):
    cs = []
    for x0, x1, r0, r1 in rects(g["rows"]):
        xa, xb = x0 * PX, x1 * PX
        ya, yb = (CAP - 1 - r1) * PX, (CAP - r0) * PX
        cs.append([(xa, ya), (xa, yb), (xb, yb), (xb, ya)])     # clockwise (y up) = filled
    return cs


def encode_glyph(contours):
    if not contours:
        return b"", None, 0
    pts = [p for c in contours for p in c]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    bbox = (min(xs), min(ys), max(xs), max(ys))
    ends, n = [], 0
    for c in contours:
        n += len(c); ends.append(n - 1)
    flags, xb, yb = bytearray(), bytearray(), bytearray()
    lx = ly = 0
    for x, y in pts:
        dx, dy = x - lx, y - ly
        lx, ly = x, y
        f = 0x01
        if dx == 0:
            f |= 0x10
        elif -255 <= dx <= 255:
            f |= 0x02 | (0x10 if dx > 0 else 0); xb.append(abs(dx))
        else:
            xb += struct.pack(">h", dx)
        if dy == 0:
            f |= 0x20
        elif -255 <= dy <= 255:
            f |= 0x04 | (0x20 if dy > 0 else 0); yb.append(abs(dy))
        else:
            yb += struct.pack(">h", dy)
        flags.append(f)
    data = struct.pack(">hhhhh", len(contours), *bbox) + struct.pack(">%dH" % len(ends), *ends)
    data += struct.pack(">H", 0) + bytes(flags) + bytes(xb) + bytes(yb)
    return data, bbox, len(pts)


def checksum(b):
    b = b + b"\0" * ((4 - len(b) % 4) % 4)
    return sum(struct.unpack(">%dI" % (len(b) // 4), b)) & 0xFFFFFFFF


def build_ttf(glyphs):
    notdef = {"ch": None, "rows": ["#####", "#...#", "#...#", "#...#", "#...#", "#...#", "#####"], "w": 5, "adv": 6}
    order = [notdef] + [glyphs[c] for c in sorted(glyphs)]
    cmap = {c: i + 1 for i, c in enumerate(sorted(glyphs))}
    glyf, loca, hm = b"", [], []
    bb = [0, 0, 0, 0]
    maxpts = maxcs = 0
    lsbs, rsbs, extents = [], [], []
    for g in order:
        cs = glyph_contours(g)
        data, bbox, npts = encode_glyph(cs)
        loca.append(len(glyf))
        glyf += data + b"\0" * ((4 - len(data) % 4) % 4)
        adv = g["adv"] * PX
        lsb = bbox[0] if bbox else 0
        hm.append((adv, lsb))
        if bbox:
            bb = [min(bb[0], bbox[0]), min(bb[1], bbox[1]), max(bb[2], bbox[2]), max(bb[3], bbox[3])]
            maxpts, maxcs = max(maxpts, npts), max(maxcs, len(cs))
            lsbs.append(lsb); rsbs.append(adv - bbox[2]); extents.append(bbox[2])
    loca.append(len(glyf))
    n = len(order)
    t = {}
    t["glyf"] = glyf
    t["loca"] = struct.pack(">%dI" % len(loca), *loca)
    t["hmtx"] = b"".join(struct.pack(">Hh", a, l) for a, l in hm)
    t["head"] = struct.pack(">IIIIHHqqhhhhHHhhh", 0x00010000, 0x00010000, 0, 0x5F0F3CF5, 0x000B, UPM,
                            STAMP, STAMP, bb[0], bb[1], bb[2], bb[3], 0, 8, 2, 1, 0)
    t["hhea"] = struct.pack(">IhhhHhhhhhhhhhhhH", 0x00010000, ASC * PX, -DESC * PX, 0, max(a for a, _ in hm),
                            min(lsbs), min(rsbs), max(extents), 1, 0, 0, 0, 0, 0, 0, 0, n)
    t["maxp"] = struct.pack(">IHHHHHHHHHHHHHH", 0x00010000, n, maxpts, maxcs, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0)
    advs = [a for a, _ in hm if a]
    codes = sorted(glyphs)
    os2 = struct.pack(">HhHHH", 4, round(sum(advs) / len(advs)), 400, 5, 0)
    os2 += struct.pack(">hhhhhhhh", 5 * PX, 5 * PX, 0, PX, 5 * PX, 5 * PX, 0, 4 * PX)   # sub/superscript
    os2 += struct.pack(">hh", PX, 3 * PX)                                                 # strikeout
    os2 += struct.pack(">h", 0) + bytes([2, 0, 5, 9, 0, 0, 0, 0, 0, 0])                    # family, panose
    os2 += struct.pack(">IIII", 0x80000003, (1 << 5) | (1 << 6) | (1 << 13) | (1 << 28), 0, 0)
    os2 += b"PXUI" + struct.pack(">HHH", 0x40 | 0x80, codes[0], min(codes[-1], 0xFFFF))
    os2 += struct.pack(">hhhHH", ASC * PX, -DESC * PX, 0, ASC * PX, DESC * PX)
    os2 += struct.pack(">II", 1, 0) + struct.pack(">hhHHH", XH * PX, CAP * PX, 0, 32, 1)
    t["OS/2"] = os2
    t["post"] = struct.pack(">IIhhIIIII", 0x00030000, 0, -2 * PX, PX, 0, 0, 0, 0, 0)
    t["gasp"] = struct.pack(">HHHH", 1, 1, 0xFFFF, 0x0000)      # never antialias / gridfit
    # cmap: format 4, one segment per run of consecutive codepoints (gids are assigned in code order)
    segs = []
    for c in sorted(cmap):
        if c > 0xFFFF:
            continue
        if segs and c == segs[-1][1] + 1 and cmap[c] - c == segs[-1][2]:
            segs[-1][1] = c
        else:
            segs.append([c, c, cmap[c] - c])
    segs.append([0xFFFF, 0xFFFF, 1])
    sc = len(segs)
    es = 0
    while (1 << (es + 1)) <= sc:
        es += 1
    sr = 2 * (1 << es)
    body = struct.pack(">%dH" % sc, *[s[1] for s in segs]) + b"\0\0"
    body += struct.pack(">%dH" % sc, *[s[0] for s in segs])
    body += struct.pack(">%dH" % sc, *[s[2] & 0xFFFF for s in segs])
    body += struct.pack(">%dH" % sc, *([0] * sc))
    sub = struct.pack(">HHHHHHH", 4, 14 + len(body), 0, 2 * sc, sr, es, 2 * sc - sr) + body
    t["cmap"] = struct.pack(">HH", 0, 2) + struct.pack(">HHI", 0, 3, 20) + struct.pack(">HHI", 3, 1, 20) + sub
    names = {0: "Pixel font for Myth of Sisyphus V8", 1: FAMILY, 2: "Regular", 3: FAMILY + "-Regular-1.0",
             4: FAMILY + " Regular", 5: "Version 1.000", 6: FAMILY + "-Regular"}
    recs, store = [], b""
    for plat, enc, lang, codec in ((1, 0, 0, "mac_roman"), (3, 1, 0x409, "utf-16-be")):
        for nid in sorted(names):
            s = names[nid].encode(codec)
            recs.append(struct.pack(">HHHHHH", plat, enc, lang, nid, len(s), len(store)))
            store += s
    t["name"] = struct.pack(">HHH", 0, len(recs), 6 + 12 * len(recs)) + b"".join(recs) + store
    # sfnt container
    tags = sorted(t)
    nt = len(tags)
    es = 0
    while (1 << (es + 1)) <= nt:
        es += 1
    sr = (1 << es) * 16
    font = struct.pack(">IHHHH", 0x00010000, nt, sr, es, nt * 16 - sr)
    off, body, head_off = 12 + 16 * nt, b"", 0
    for tag in tags:
        d = t[tag]
        if tag == "head":
            head_off = off + len(body)
        font += struct.pack(">4sIII", tag.encode(), checksum(d), off + len(body), len(d))
        body += d + b"\0" * ((4 - len(d) % 4) % 4)
    font += body
    adj = (0xB1B0AFBA - checksum(font)) & 0xFFFFFFFF
    font = font[:head_off + 8] + struct.pack(">I", adj) + font[head_off + 12:]
    return font, order

# ------------------------------------------------------------------ PNG textures

def png(rows):
    """rows: list of lists of (r,g,b,a)"""
    h, w = len(rows), len(rows[0])
    raw = b"".join(b"\0" + bytes(c for p in row for c in p) for row in rows)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def rgb(hexs, a=255):
    hexs = hexs.lstrip("#")
    return (int(hexs[0:2], 16), int(hexs[2:4], 16), int(hexs[4:6], 16), a)


CLEAR = (0, 0, 0, 0)
INK, INK2, PLUM, SLATE = rgb("0a0610"), rgb("14101c"), rgb("241a30"), rgb("3a3348")
CREAM, GOLD, GOLD_D, GOLD_L, ROSE, MOON = rgb("f4ecd8"), rgb("f7b36c"), rgb("b8733f"), rgb("ffd9a0"), rgb("e0788a"), rgb("a9b8dc")
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def dither_tile(level, on, off=CLEAR):
    """4x4 ordered-dither tile with `level`/16 pixels set to `on`."""
    return [[on if BAYER[y][x] < level else off for x in range(4)] for y in range(4)]


def ramp(height, top_level, bottom_level, on, off=CLEAR):
    """4 x height tile: dither density goes from top_level/16 to bottom_level/16."""
    rows = []
    for y in range(height):
        t = y / max(1, height - 1)
        lv = round(top_level + (bottom_level - top_level) * t)
        rows.append([on if BAYER[y % 4][x] < lv else off for x in range(4)])
    return rows


def sprite(art, pal):
    return [[pal[c] for c in line] for line in art.strip("\n").split("\n")]


def textures():
    """The textures ui.css references as var(--img-NAME). Add one here, rebuild, then use it in CSS."""
    tex = {}
    for lv, name in ((4, "d25"), (8, "d50"), (12, "d75")):          # ordered-dither scrims (ink over the world)
        tex[name] = dither_tile(lv, INK)
    # window / card fill: plum at the top dithering into ink2 (drawn over an ink2 background colour)
    tex["panel-ramp"] = ramp(28, 12, 0, PLUM)
    # dotted pixel rule (1 lit of every 2) for table separators
    tex["dots-slate"] = [[SLATE, CLEAR]]
    pal = {".": CLEAR, "k": INK, "g": GOLD, "d": GOLD_D, "l": GOLD_L, "c": CREAM, "p": PLUM, "s": SLATE, "m": MOON, "r": ROSE}
    # gold rivet inside each window corner
    tex["rivet"] = sprite("""
.l.
ldd
.d.
""", pal)
    # the diamond that flanks the postcard title
    tex["gem"] = sprite("""
..l..
.lgg.
lgkgd
.gdd.
..d..
""", pal)
    return tex

# ------------------------------------------------------------------ outputs

def replace_block(path, tag, content, comment=("/*", "*/")):
    a, b = comment
    start, end = "%s<GEN:%s>%s" % (a, tag, b), "%s</GEN:%s>%s" % (a, tag, b)
    src = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
    block = start + "\n" + content + "\n" + end
    if start in src and end in src:
        src = src[:src.index(start)] + block + src[src.index(end) + len(end):]
    else:
        src = block + "\n" + src
    open(path, "w", encoding="utf-8").write(src)


def preview(order, path):
    try:
        from PIL import Image
    except ImportError:
        return None
    lines = ["MYTH OF SISYPHUS  0123456789  THE CLIMB IS RECORDED",
             "the quick brown fox jumps over the lazy dog. today's mountain",
             "sisyphus was punished by the gods to push a boulder up a mountain",
             "! ? . , : ; ' \" - + / % ( ) & = < > _ * # @ $ [ ] { } | ^ ~ ` · ← → — … × ▶ ▲ ★",
             "START THE HILLS AT 0M   best 0062m · +34m to 100m   RECORDS, ACHIEVEMENTS & SETTINGS",
             "".join(chr(c) for c in range(0xE000, 0xE014))]
    by = {ord(g["ch"]): g for g in order[1:]}
    S, LH = 4, 13
    W = max(sum(by.get(ord(c), order[0])["adv"] for c in l) for l in lines) + 4
    im = Image.new("RGB", (W * S, (LH * len(lines) + 4) * S), (20, 16, 28))
    px = im.load()
    for li, line in enumerate(lines):
        x = 2
        for ch in line:
            g = by.get(ord(ch), order[0])
            for r, row in enumerate(g["rows"]):
                for cx, v in enumerate(row):
                    if v == "#":
                        for dy in range(S):
                            for dx in range(S):
                                px[(x + cx) * S + dx, (2 + li * LH + 2 + r) * S + dy] = (244, 236, 216) if li != 0 else (247, 179, 108)
            x += g["adv"]
    im.save(path)
    return path


def main():
    glyphs = parse(os.path.join(HERE, "glyphs.txt"))
    font, order = build_ttf(glyphs)
    open(os.path.join(HERE, "sisyphus-px.ttf"), "wb").write(font)
    b64 = base64.b64encode(font).decode()
    css_font = ('@font-face { font-family: "%s"; src: url(data:font/ttf;base64,%s) format("truetype"); '
                'font-weight: 400; font-style: normal; font-display: block; }' % (FAMILY, b64))
    tex = textures()
    vars_ = [":root {"]
    for name, rows in tex.items():
        vars_.append("  --img-%s: url(data:image/png;base64,%s);" % (name, base64.b64encode(png(rows)).decode()))
    vars_.append("}")
    ui_css = os.path.join(V8, "ui.css")
    replace_block(ui_css, "font", css_font)
    replace_block(ui_css, "textures", "\n".join(vars_))
    # glyph table for canvas text: code -> [advance, width, row bitmasks... (msb = left pixel)]
    table = {}
    for g in order[1:]:
        masks = [int(r.replace("#", "1").replace(".", "0"), 2) if r else 0 for r in g["rows"]]
        table[str(ord(g["ch"]))] = [g["adv"], g["w"]] + masks
    js = "var PIXEL_GLYPHS = " + str(table).replace(" ", "").replace("'", '"') + ";"
    replace_block(os.path.join(V8, "ui.js"), "glyphs", js, comment=("/*", "*/"))
    pv = preview(order, os.path.join(HERE, "font-preview.png"))
    print("glyphs:", len(glyphs), " ttf bytes:", len(font), " base64:", len(b64), " textures:", len(tex), " preview:", pv)


if __name__ == "__main__":
    main()
