// V8 core: the realm pipeline. One indexed framebuffer (a byte per pixel) + one palette per realm.
// Order of a frame:  palette update -> backdrop -> ground (+ props) -> actor (stone, hero, shadow) -> foreground -> present.
// Because pixels are palette INDICES, shading is index arithmetic along named ramps (shade1/shade2 tables),
// fog and glow are ordered dithers between two palette entries, and day/night or lightning are palette animations.
(function (root) {
  "use strict";
  var PX = root.PX, clamp01 = PX.clamp01, V8 = { realms: {}, fb: null, pal: null, key: "", realm: null, shade1: new Uint8Array(256), shade2: new Uint8Array(256), stats: { ms: 0 } };

  V8.register = function (id, realm) { V8.realms[id] = realm; realm.id = id; };
  // realms can raise game events (e.g. V8.emit("strike", 0.8) for lightning: the game adds the thunder, haptics and shake)
  V8.onEvent = null;
  V8.emit = function (name, arg) { if (V8.onEvent) V8.onEvent(name, arg); };
  V8.has = function (id) { return !!V8.realms[id]; };

  V8.light1 = new Uint8Array(256);
  V8.buildShade = function (pal) {
    var i, n;
    for (i = 0; i < 256; i++) { V8.shade1[i] = i; V8.shade2[i] = i; V8.light1[i] = i; }
    for (var name in pal.ramps) {
      var r = pal.ramps[name];
      for (i = 0; i < r.n; i++) { V8.shade1[r.base + i] = r.base + Math.max(0, i - 1); V8.shade2[r.base + i] = r.base + Math.max(0, i - 2); V8.light1[r.base + i] = r.base + Math.min(r.n - 1, i + 1); }
    }
  };

  // Markers: cairns every 100 m (taller each 500 m) and the flag where your best climb ended. Fixed palette slots 244..252,
  // overridable per realm through realm.markerIdx.
  var MARK = { c0: 244, c1: 245, c2: 246, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };
  V8.markerColors = function (pal) {
    var C = [[52, 50, 50], [98, 94, 90], [148, 142, 132], [56, 42, 34], [112, 90, 66], [214, 196, 130], [168, 148, 88], [150, 158, 170], [108, 116, 130]];
    for (var i = 0; i < C.length; i++) pal.set(244 + i, C[i]);
    pal.set(253, [252, 244, 224]); pal.set(254, [10, 12, 18]);   // label text + its drop shadow
  };
  V8.markers = function (fb, S, pal, R) {
    var z = S.zoom, w = fb.w, lip = S.lip, mk = (R && R.markerIdx) || MARK, sc = Math.max(0.55, z * 1.25), i, y, yy, x;
    for (i = 0; i < S.cairns.length; i++) {
      var c = S.cairns[i], sx = Math.round(S.ztx + c.x * z); if (sx < -12 || sx > w + 12) continue;
      var big = c.m % 500 === 0, rows = big ? [[11, 3], [9, 3], [7, 3], [5, 2], [3, 2]] : [[9, 3], [7, 3], [5, 2], [3, 2]];
      y = lip[Math.max(0, Math.min(w - 1, sx))] + 1;
      for (var r = 0; r < rows.length; r++) {
        var rw = Math.max(2, Math.round(rows[r][0] * sc)), rh = Math.max(1, Math.round(rows[r][1] * sc)), off = (r % 2 ? 1 : 0) - (r === 2 ? 1 : 0);
        y -= rh;
        for (yy = 0; yy < rh; yy++) for (x = 0; x < rw; x++) fb.set(sx - (rw >> 1) + off + x, y + yy, r === 0 ? mk.c0 : (yy === 0 && x < rw - 1 ? mk.c2 : mk.c1));
      }
    }
    if (S.bestM >= 30) {
      var fxw = S.anchorX + (S.bestM * 7.2 - S.scroll), fsx = Math.round(S.ztx + fxw * z);
      if (fsx > -20 && fsx < w + 20) {
        var fy = lip[Math.max(0, Math.min(w - 1, fsx))] + 1, ph = Math.max(10, Math.round(34 * z * 1.3)), cw = Math.max(5, Math.round(9 * sc)), chh = Math.max(3, Math.round(6 * sc));
        for (y = 0; y < ph; y++) fb.set(fsx, fy - y, y & 1 ? mk.p1 : mk.p0);
        var wave = S.reduced ? 0 : Math.round(Math.sin(S.tSec * 3) * 0.6);
        for (yy = 0; yy < chh; yy++) for (x = 0; x < cw - (yy >> 1); x++) fb.set(fsx + 1 + x, fy - ph + yy + (x > cw / 2 ? wave : 0), (yy === chh - 1 || x === 0) ? (S.oldBestPassed ? mk.g1 : mk.f1) : (S.oldBestPassed ? mk.g0 : mk.f0));
      }
    }
  };

  // Particles (dust, grit, motes) drawn INTO the framebuffer: a light particle lifts whatever is under it one step along its ramp,
  // a dark one lowers it; partial alpha is an ordered dither. Colours therefore stay in the palette.
  V8.particles = function (fb, S, list, pal) {
    if (!list || !list.length || S.reduced) return;
    var base = S.scroll, w = fb.w, h = fb.h, d = fb.d, i, x, y, xx, yy;
    for (i = 0; i < list.length; i++) {
      var p = list[i], k = p.life / p.max, a = k < 0.45 ? 0.95 : 0.95 * (1 - (k - 0.45) / 0.55);
      if (p.grow) a *= 0.72;
      var sz = p.grow ? Math.round(p.size + k * p.grow) : (p.size > 1 && k > 0.7 ? 1 : p.size);
      var sx = Math.round(S.ztx + (p.rel ? p.wx : p.wx - base) * S.zoom - sz / 2), sy = Math.round(S.zty + p.y * S.zoom - sz + 1);
      var lightP = (0.2126 * p.col[0] + 0.7152 * p.col[1] + 0.0722 * p.col[2]) > 118;
      for (yy = 0; yy < sz; yy++) for (xx = 0; xx < sz; xx++) {
        x = sx + xx; y = sy + yy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (PX.BAYER4[y & 3][x & 3] + 0.5 > a) continue;
        var o = y * w + x, v = d[o];
        d[o] = lightP ? V8.light1[V8.light1[v]] : V8.shade1[v];
      }
    }
  };

  // screen-space dust dots ({x,y,w,light,a}) from the actor pass: same palette-locked treatment as particles
  V8.dots = function (fb, list) {
    if (!list || !list.length) return;
    var w = fb.w, h = fb.h, d = fb.d;
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      for (var xx = 0; xx < q.w; xx++) {
        var x = q.x + xx, y = q.y; if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (PX.BAYER4[y & 3][x & 3] + 0.5 > q.a) continue;
        var o = y * w + x, v = d[o]; d[o] = q.light ? V8.light1[V8.light1[v]] : V8.shade1[v];
      }
    }
  };


  // ---- tiny 5x7 pixel font for in-canvas labels (uppercase, digits, a little punctuation); glyph = 7 rows of 5 ----
  var GLYPH = {
    "0": ".###.|#...#|#...#|#...#|#...#|#...#|.###.", "1": "..#..|.##..|..#..|..#..|..#..|..#..|.###.", "2": ".###.|#...#|....#|...#.|..#..|.#...|#####",
    "3": "####.|....#|...#.|..##.|....#|#...#|.###.", "4": "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.", "5": "#####|#....|####.|....#|....#|#...#|.###.",
    "6": ".###.|#....|#....|####.|#...#|#...#|.###.", "7": "#####|....#|...#.|..#..|.#...|.#...|.#...", "8": ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
    "9": ".###.|#...#|#...#|.####|....#|....#|.###.", "A": ".###.|#...#|#...#|#####|#...#|#...#|#...#", "B": "####.|#...#|#...#|####.|#...#|#...#|####.",
    "C": ".###.|#...#|#....|#....|#....|#...#|.###.", "D": "####.|#...#|#...#|#...#|#...#|#...#|####.", "E": "#####|#....|#....|####.|#....|#....|#####",
    "F": "#####|#....|#....|####.|#....|#....|#....", "G": ".###.|#...#|#....|#.###|#...#|#...#|.###.", "H": "#...#|#...#|#...#|#####|#...#|#...#|#...#",
    "I": ".###.|..#..|..#..|..#..|..#..|..#..|.###.", "J": "..###|...#.|...#.|...#.|...#.|#..#.|.##..", "K": "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#",
    "L": "#....|#....|#....|#....|#....|#....|#####", "M": "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#", "N": "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#",
    "O": ".###.|#...#|#...#|#...#|#...#|#...#|.###.", "P": "####.|#...#|#...#|####.|#....|#....|#....", "Q": ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#",
    "R": "####.|#...#|#...#|####.|#.#..|#..#.|#...#", "S": ".####|#....|#....|.###.|....#|....#|####.", "T": "#####|..#..|..#..|..#..|..#..|..#..|..#..",
    "U": "#...#|#...#|#...#|#...#|#...#|#...#|.###.", "V": "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..", "W": "#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#",
    "X": "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#", "Y": "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..", "Z": "#####|....#|...#.|..#..|.#...|#....|#####",
    " ": ".....|.....|.....|.....|.....|.....|.....", ".": ".....|.....|.....|.....|.....|.##..|.##..", ":": ".....|.##..|.##..|.....|.##..|.##..|.....",
    "/": "....#|....#|...#.|..#..|.#...|#....|#....", "-": ".....|.....|.....|#####|.....|.....|.....", "+": ".....|..#..|..#..|#####|..#..|..#..|.....",
    "%": "##..#|##..#|...#.|..#..|.#...|#..##|#..##", "'": "..#..|..#..|.#...|.....|.....|.....|.....", "!": "..#..|..#..|..#..|..#..|..#..|.....|..#..",
    ",": ".....|.....|.....|.....|.##..|..#..|.#...", "?": ".###.|#...#|....#|...#.|..#..|.....|..#..", ";": ".....|.##..|.##..|.....|.##..|..#..|.#...",
    "\"": ".#.#.|.#.#.|.....|.....|.....|.....|.....", "(": "...#.|..#..|.#...|.#...|.#...|..#..|...#.", ")": ".#...|..#..|...#.|...#.|...#.|..#..|.#...",
    "\u00b7": ".....|.....|.....|..#..|.....|.....|.....", "_": ".....|.....|.....|.....|.....|.....|#####", "&": ".##..|#..#.|.##..|.#.#.|#..#.|#..#.|.##.#",
    "\u2026": ".....|.....|.....|.....|.....|.....|#.#.#", "=": ".....|.....|#####|.....|#####|.....|.....", "*": ".....|#.#.#|.###.|#####|.###.|#.#.#|.....",
    "\u2019": "..#..|..#..|.#...|.....|.....|.....|.....", "\u2014": ".....|.....|.....|#####|.....|.....|.....", "\u2013": ".....|.....|.....|.###.|.....|.....|.....",
    "#": ".#.#.|#####|.#.#.|.#.#.|#####|.#.#.|.....", "<": "...#.|..#..|.#...|#....|.#...|..#..|...#.", ">": ".#...|..#..|...#.|....#|...#.|..#..|.#..."
  };
  var GROWS = {};
  // the 7 row strings of a glyph ('#' = lit); unknown characters are blanks. Shared with canvas-2D users (postcard).
  V8.glyph = function (ch) { ch = String(ch).toUpperCase(); return GROWS[ch] || (GROWS[ch] = (GLYPH[ch] || GLYPH[" "]).split("|")); };
  V8.textWidth = function (str, scale) { return (str.length * 6 - 1) * (scale || 1); };
  // draws str with its top-left at (x, y); fg = palette index, sh = palette index for a 1-px drop shadow (or 0 for none)
  V8.text = function (fb, x, y, str, fg, sh, scale) {
    scale = scale || 1; str = String(str).toUpperCase();
    for (var i = 0; i < str.length; i++) {
      var rows = GROWS[str.charAt(i)] || (GROWS[str.charAt(i)] = (GLYPH[str.charAt(i)] || GLYPH[" "]).split("|"));
      for (var pass = sh ? 0 : 1; pass < 2; pass++) for (var r = 0; r < 7; r++) for (var q = 0; q < 5; q++) {
        if (rows[r].charAt(q) !== "#") continue;
        var px = x + (i * 6 + q) * scale + (pass === 0 ? scale : 0), py = y + r * scale + (pass === 0 ? scale : 0);
        for (var yy = 0; yy < scale; yy++) for (var xx = 0; xx < scale; xx++) fb.set(px + xx, py + yy, pass === 0 ? sh : fg);
      }
    }
  };

  // ---- the Pull-Back overlay: a gold dotted trail from where the climb began to the hero, its start post, and the labels ----
  V8.pullOverlay = function (fb, S) {
    var pa = S.pull; if (pa <= 0.01) return;
    var z = S.zoom, w = fb.w, mk = MARK, lip = S.lip, startX = S.anchorX - Math.max(0, S.altitude) * 7.2;
    var x0 = Math.max(startX, -S.ztx / z - 4), x1 = S.anchorX - 10, step = Math.max(3, Math.round(6 / z)), flow = (S.tSec * 22) % step, k = 0;
    for (var x = x1 - (step - flow); x >= x0; x -= step, k++) {
      var sx = Math.round(S.ztx + x * z); if (sx < 0 || sx >= w) continue;
      var near = clamp01((x - x0) / 90), a = pa * (0.30 + 0.60 * near);
      var sy = lip[sx] - 3; if (PX.BAYER4[sy & 3][sx & 3] + 0.5 > a) continue;
      fb.set(sx, sy, mk.f0); fb.set(sx + 1, sy, mk.f0);
    }
    if (startX >= x0 - 1) {
      var bx = Math.round(S.ztx + startX * z), by = lip[Math.max(0, Math.min(w - 1, bx))];
      for (var yy = 0; yy < 8; yy++) fb.set(bx, by - yy, mk.f0); for (var xx = 1; xx <= 3; xx++) { fb.set(bx + xx, by - 8, mk.f0); fb.set(bx + xx, by - 7, mk.f0); }
    }
    if (pa > 0.4 && S.pullMark) {
      var fa = (pa - 0.4) / 0.6;
      // numbers on the cairns you have already passed
      for (var ci = 0; ci < S.cairns.length; ci++) {
        var cc = S.cairns[ci]; if (cc.m >= S.pullMark) continue;
        var csx = Math.round(S.ztx + cc.x * z), csy = lip[Math.max(0, Math.min(w - 1, csx))] - Math.round(14 * z * 1.25) - 8;
        if (fa > 0.5) V8.text(fb, csx - Math.round(V8.textWidth(String(cc.m)) / 2), csy, String(cc.m), mk.f0, 254, 1);
      }
      var lx = Math.round(S.ztx + (S.anchorX + (S.stoneX || 40) * 0.5) * z), ly = Math.round(S.zty + (S.anchorY - (S.stoneR || 30) * 2 - 16) * z) - 22;
      var t1 = S.pullMark + "M", tw1 = V8.textWidth(t1, 2);
      V8.text(fb, lx - Math.round(tw1 / 2), ly, t1, 253, 254, 2);
      if (S.pullNext) { var t2 = "NEXT " + S.pullNext + "M"; V8.text(fb, lx - Math.round(V8.textWidth(t2) / 2), ly + 18, t2, mk.f0, 254, 1); }
    }
  };

  // ---- wind: pale streaks racing right-to-left in front of the world, plus tumbling debris; lifts the pixels under it along their ramp ----
  V8.wind = function (fb, S) {
    var wg = PX.clamp01(S.windGust * 1.6) * (S.reduced ? 0.35 : 1); if (wg < 0.04 || S.gameState !== "playing") return;
    var w = fb.w, h = fb.h, d = fb.d, span = w + 180, n = Math.round(8 + wg * 30), i, x, y;
    for (i = 0; i < n; i++) {
      var sp = 170 + PX.h1(i * 3 + 1) * 240, life = span / sp, tt = S.tSec / life + PX.h1(i * 5 + 2), cyc = Math.floor(tt), ph = tt - cyc;
      if (PX.h2(i, cyc * 3 + 7) > 0.3 + wg * 0.65) continue;
      var sx = Math.round(w + 90 - ph * span), sy = Math.round(h * 0.10 + PX.h2(i * 9, cyc * 2 + 1) * h * 0.72 + Math.sin(S.tSec * 3 + i + sx * 0.02) * 2);
      var len = 22 + Math.round(PX.h2(i, cyc) * 60 * wg), a = Math.min(1, wg * 1.3) * (0.34 + PX.h1(i * 4 + 4) * 0.36) * Math.min(1, Math.sin(ph * Math.PI) * 1.8);
      if (sy < 0 || sy >= h) continue;
      for (x = 0; x < len; x++) {
        var px = sx + x; if (px < 0 || px >= w) continue;
        var f = x < len * 0.4 ? 1 : x < len * 0.75 ? 0.5 : 0.2;
        if (PX.BAYER4[sy & 3][px & 3] + 0.5 > a * f * 1.2) continue;
        var o = sy * w + px; d[o] = V8.light1[V8.light1[d[o]]];
      }
    }
  };

  // ---- thumbnails: a realm rendered at game scale into its own framebuffer, then reduced by a WHOLE factor with a block-mode filter
  // (the most common palette index in each block), so the card is a real little pixel painting in the realm's own colours. ----
  V8._thumbs = {};
  V8.thumbnail = function (id, w, h, opts) {
    opts = opts || {};
    var R = V8.realms[id]; if (!R || !R.backdrop || !R.ground) return "";
    var key = id + "|" + w + "x" + h + "|" + (opts.alt || 0) + "|" + (opts.f || 0) + "|" + (opts.t || 0);
    if (V8._thumbs[key] !== undefined) return V8._thumbs[key];
    var th = R.thumb || {}, f = opts.f || th.f || Math.max(2, Math.round(300 / Math.max(h, 1) * 0.72)), W = w * f, H = h * f;
    var alt = opts.alt != null ? opts.alt : (th.alt || 0), zoom = opts.zoom || th.zoom || 0.74, slope = opts.slope != null ? opts.slope : (th.slope == null ? 0.02 : th.slope);
    var ratio = th.ratio || 0.72, ax = Math.round(W * 0.42), ay = Math.round(H * ratio), hz = Math.round(H * (ratio - 0.04));
    var ztx = Math.round(ax * (1 - zoom)), zty = Math.round(ay * (1 - zoom)), lip = new Int16Array(W), x, y;
    for (x = 0; x < W; x++) { var xl = (x - ztx) / zoom; lip[x] = Math.round(zty + (ay - slope * (xl - ax)) * zoom); }
    var S = { w: W, h: H, zoom: zoom, ztx: ztx, zty: zty, altitude: alt, scroll: alt * 7.2, tSec: opts.t == null ? 2.0 : opts.t, reduced: true, anchorX: ax, anchorY: ay, horizonY: hz, lip: lip, slope: slope,
      openingT: 1, realmId: id, windGust: 0, gameState: "title", pull: 0, bestM: 0, oldBestPassed: false, cairns: [], adj: 1, mythic: null, mode: "endless", score: 0, dailyTarget: 0, fx: null, dots: null };
    var fb = new PX.Frame(W, H), pal = new PX.Palette(), out = "";
    try {
      if (R.init) R.init(pal, S);
      V8.markerColors(pal);
      if (R.palette) R.palette(pal, S);
      V8.buildShade(pal);                                  // realms that lean on the shared shade tables get their own palette's (the main renderer re-inits afterwards)
      R.backdrop(fb, S, pal); R.ground(fb, S, pal);
      var sm = new PX.Frame(w, h), cnt = new Uint16Array(256), seen = new Uint8Array(256), list = [], best, bi, n, k, i, j;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        list.length = 0;
        for (j = 0; j < f; j++) for (i = 0; i < f; i++) { k = fb.d[(y * f + j) * W + x * f + i]; if (!seen[k]) { seen[k] = 1; cnt[k] = 0; list.push(k); } cnt[k]++; }
        best = -1; bi = 0;
        for (n = 0; n < list.length; n++) { k = list[n]; if (cnt[k] > best) { best = cnt[k]; bi = k; } seen[k] = 0; }
        sm.d[y * w + x] = bi;
      }
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      sm.present(cv.getContext("2d"), pal);
      out = cv.toDataURL("image/png");
    } catch (e) { out = ""; try { console.error(e); } catch (_) {} }
    V8._thumbs[key] = out;
    V8.key = "";                                            // the realm was initialised for the thumbnail: make the main renderer re-init next frame
    return out;
  };

  // queued, one realm per timer tick (each realm init is tens of ms) so the menu never hitches while cards fill in
  V8._tq = []; V8._tbusy = false;
  V8.thumbnailAsync = function (id, w, h, cb, opts) {
    var pending = { id: id, w: w, h: h, cb: cb, opts: opts };
    V8._tq.push(pending);
    (function pump() {
      if (V8._tbusy || !V8._tq.length) return;
      V8._tbusy = true;
      setTimeout(function () {
        var t = V8._tq.shift();
        try { t.cb(V8.thumbnail(t.id, t.w, t.h, t.opts)); } catch (e) { try { console.error(e); } catch (_) {} }
        V8._tbusy = false; pump();
      }, 40);
    })();
  };

  // ---- Look setting (night / void) for every scene: a per-frame graded COPY of the palette (scene ramps 1..199 only; the actor, markers and
  // text keep their own colours). Emissive ramps (sun, moon, stars, lamps, embers, lava, crystals...) are spared so light still glows. ----
  V8.emissiveRe = /sun|moon|star|lamp|window|glow|ember|lava|fire|flame|spark|crystal|light|aurora|neon|glint|halo|magma|bolt|flash|sparkle|lantern|torch/i;
  V8.emissive = new Uint8Array(256); V8.gradeK = 1; V8.gpal = null;
  V8.analysePalette = function (pal) {
    var sum = 0, cnt = 0, i, name, rr;
    V8.emissive.fill(0); V8.emissive[243] = 1;                       // the hero's rim glint stays bright
    for (name in pal.ramps) {
      rr = pal.ramps[name];
      var em = V8.emissiveRe.test(name) ? (/sun/i.test(name) ? 2 : 1) : 0;       // 2 = the sun: it becomes a moon in the night look
      for (i = 0; i < rr.n; i++) { V8.emissive[rr.base + i] = em; if (!em) { var c = pal.rgb[rr.base + i]; sum += 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; cnt++; } }
    }
    V8.gradeK = PX.clamp01(((cnt ? sum / cnt : 100) - 38) / 80);       // already-dark scenes (night, dusk) are graded less
  };
  V8.gradeInto = function (pal, look) {
    var gp = V8.gpal || (V8.gpal = new PX.Palette()), k = look === "void" ? Math.max(0.65, V8.gradeK) : V8.gradeK, em = V8.emissive;
    for (var i = 0; i < 256; i++) {
      var c = pal.rgb[i], e = gp.rgb[i], r = c[0], g = c[1], b = c[2];
      if (i < 1 || i > 243 || i === 200) { e[0] = r; e[1] = g; e[2] = b; continue; }              // scene ramps + the actor (hero, stone) are graded; markers/text (244..254) are not
      var kg = i > 199 ? k * 0.62 : k;
      var nr, ng, nb;
      if (look === "void") {
        var l = 0.3 * r + 0.59 * g + 0.11 * b;
        if (em[i] === 2) { nr = l * 0.86; ng = l * 0.8; nb = l * 1.0; }
        else if (em[i]) { nr = l * 0.55 + r * 0.35; ng = l * 0.55 + g * 0.3; nb = l * 0.6 + b * 0.4; }
        else { nr = l * 0.46 + 10; ng = l * 0.38 + 7; nb = l * 0.64 + 26; }
      } else if (em[i] === 2) { var ls = 0.3 * r + 0.59 * g + 0.11 * b; nr = ls * 0.84; ng = ls * 0.93; nb = ls * 1.04; }      // the sun -> a pale moon
      else if (em[i]) { nr = r * 0.92; ng = g * 0.94; nb = b; }
      else { nr = r * 0.40 + 8; ng = g * 0.48 + 12; nb = b * 0.70 + 30; }
      e[0] = r + (nr - r) * kg; e[1] = g + (ng - g) * kg; e[2] = b + (nb - b) * kg;
    }
    gp.dirty = true;
    return gp;
  };

  // ---- warm-up: a zone scene costs 30-150 ms to build the first time at a screen size (then it stays cached inside the scene module). The game
  // builds the heavy ones on the gate / menu / pause screen, one per idle tick, so the first crossing into them is smooth. ----
  V8._warm = {};
  V8.warm = function (id) {
    var S = V8.lastS, R = V8.realms[id];
    if (!S || !R || !R.init || R === V8.realm) return false;
    var sig = id + "|" + S.w + "x" + S.h + "@" + (S.adj || 1) + "|" + S.horizonY;
    if (V8._warm[sig]) return false;
    V8._warm[sig] = 1;
    var t0 = performance.now(), S2 = {}, k;
    try { for (k in S) S2[k] = S[k]; S2.realmId = id; S2.fx = null; S2.dots = null; S2.mythic = null; R.init(new PX.Palette(), S2); } catch (e) { try { console.error(e); } catch (_) {} }
    V8.stats.warmMs = performance.now() - t0;
    return true;
  };

  V8.ensure = function (S) {
    var key = S.realmId + "|" + S.w + "x" + S.h;
    if (V8.key === key && V8.fb) return;
    V8.key = key;
    V8.realm = V8.realms[S.realmId];
    if (!V8.fb || V8.fb.w !== S.w || V8.fb.h !== S.h) V8.fb = new PX.Frame(S.w, S.h);
    V8.pal = new PX.Palette();
    if (V8.realm.init) V8.realm.init(V8.pal, S);
    V8.markerColors(V8.pal);
    V8.buildShade(V8.pal);
    V8.analysePalette(V8.pal);
  };

  // A = actor parameters (see actor.js) or null. Returns the light the realm is casting (for HUD tinting etc.)
  V8.render = function (g, S, A) {
    var t0 = performance.now();
    V8.lastS = S;
    V8.ensure(S);
    var R = V8.realm, fb = V8.fb, pal = V8.pal;
    if (R.palette) R.palette(pal, S);
    R.backdrop(fb, S, pal);
    if (V8.birds) { V8.afterglow(fb, S, R); V8.birds(fb, S, R); V8.mythicSky(fb, S, R); }
    R.ground(fb, S, pal);
    if (V8.footprints) V8.footprints(fb, S, R);
    if (R.markers) R.markers(fb, S, pal); else V8.markers(fb, S, pal, R);
    if (V8.signs) { V8.signs(fb, S, R); V8.mythicGround(fb, S, R); }
    var res = null;
    if (A) res = root.V8Actor.frameFb(fb, pal, A, V8.shade1, V8.shade2);
    if (R.front) R.front(fb, S, pal, res);
    if (S.fx) V8.particles(fb, S, S.fx, pal);
    if (S.dots) V8.dots(fb, S.dots);
    V8.wind(fb, S);
    V8.pullOverlay(fb, S);
    if (V8.mythicPost) V8.mythicPost(fb, S, R);
    fb.present(g, (S.look === "noir" || S.look === "void") ? V8.gradeInto(pal, S.look) : pal);
    V8.stats.ms = performance.now() - t0;
    return res;
  };

  root.V8 = V8;
})(typeof window !== "undefined" ? window : this);
