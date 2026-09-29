// The Ash Fields - V8 zone scene (7450-8950 m). A smoke-red sky under layered ash clouds lit orange from below, a black volcano whose
// lava rivers flow by palette cycling (no pixel is redrawn to make them move), a rolling plume that erupts now and then (a lava fountain,
// a surge of glow), lightning flickering inside the ash, jagged basalt ridges and a wall of basalt columns rim-lit by a glowing crust plain
// with lava streams running toward you, heat shimmer at the horizon, falling ash and rising embers. The ground is a cut through the
// volcano's skirts: an ash surface with drifts and dead trees, laminated ash beds, red scoria, jointed basalt columns with glowing joints,
// banded old flows, crust plates breaking apart over a magma sea; relics of a buried city, glowing bombs, lava tubes and (rarely) an old
// stone are sealed in the layers.
(function (root) {
  "use strict";
  var PX = root.PX, Sc = root.Sc, V8 = root.V8, hex = PX.hex, clamp = PX.clamp, clamp01 = PX.clamp01, B4 = PX.BAYER4;
  var R = { rock: { mat: "warm", style: "granite" }, noBirds: true, thumb: { alt: 0, zoom: 0.74, slope: 0.02, ratio: 0.68, f: 3 } };
  var I = {}, ST = {}, CL = [], built = "", SKY0 = null, LAVA0 = null, MAG0 = null, CLD0 = null, PUFF = [];
  // ---------------------------------------------------------------------------------------------------------------
  // shared helpers (this block is duplicated in canyon.js / volcanic.js / obsidian.js so every zone file stands alone)
  // ---------------------------------------------------------------------------------------------------------------
  var TAU = Math.PI * 2, LIT = new Uint8Array(256), DRK = new Uint8Array(256), BF = new Float32Array(16);
  (function () { for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) BF[(y << 2) | x] = PX.BAYER4[y][x]; })();      // flat Bayer table: BF[((y & 3) << 2) | (x & 3)]
  function H(list) { return list.map(hex); }
  function sm(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function vn2(x, y, s) {                                               // cheap smooth 2-D value noise in [0,1)
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, h = PX.ihash; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h(ix, iy, s), b = h(ix + 1, iy, s), c = h(ix, iy + 1, s), d = h(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  // 1-D value noise with linear interpolation: piecewise-straight, irregular boundaries (geological, never sine waves)
  function jag(x, seg, seed) { var k = Math.floor(x / seg), f = x / seg - k, a = PX.h2(k, seed), b = PX.h2(k + 1, seed); return a + (b - a) * f - 0.5; }
  // byte noise tiles (256 x 256, wrap): NZ = white, VN = smooth blobs. Indexed by pixel-space coordinates so the texture slides rigidly with the ground.
  var NZ = new Uint8Array(65536), VN = new Uint8Array(65536);
  (function () {
    var i, x, y;
    for (i = 0; i < 65536; i++) NZ[i] = Math.floor(PX.ihash(i & 255, i >> 8, 7) * 256);
    var g = new Float32Array(32 * 32); for (i = 0; i < 1024; i++) g[i] = PX.ihash(i & 31, i >> 5, 11);
    for (y = 0; y < 256; y++) for (x = 0; x < 256; x++) {
      var fx = x / 8, fy = y / 8, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      var i1 = (ix + 1) & 31, j1 = (iy + 1) & 31, a = g[iy * 32 + ix], b = g[iy * 32 + i1], c = g[j1 * 32 + ix], d = g[j1 * 32 + i1];
      var v = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
      VN[y * 256 + x] = Math.min(255, Math.floor((v * 0.78 + PX.ihash(x >> 1, y >> 1, 3) * 0.22) * 256));
    }
  })();
  function buildTables(pal) {                                          // LIT / DRK: one step lighter / darker along each of this realm's ramps
    var i, n;
    for (i = 0; i < 256; i++) { LIT[i] = i; DRK[i] = i; }
    for (var name in pal.ramps) { var r = pal.ramps[name]; for (i = 0; i < r.n; i++) { LIT[r.base + i] = r.base + Math.min(r.n - 1, i + 1); DRK[r.base + i] = r.base + Math.max(0, i - 1); } }
  }
  // mix a list of [r,g,b] toward a colour (aerial perspective for the far layers); returns rounded colours
  function mixRamp(list, col, t) { return list.map(function (c) { return PX.round3(PX.mix(c, col, t)); }); }
  // layer depths shrink more gently than the camera zoom, so a far view still shows a readable ground instead of a sliver
  function depthZoom(S) { var adj = S.adj || 1, z0 = S.zoom / adj; return adj * (0.2 + 0.73 * z0); }
  // dithered lift along the ramps: pixels inside the ellipse move one (two) steps lighter, ordered by Bayer; lo..hi limits the palette range touched
  function lift(fb, cx, cy, rx, ry, amt, lo, hi) {
    var w = fb.w, h = fb.h, d = fb.d, x0 = Math.max(0, cx - rx), x1 = Math.min(w - 1, cx + rx), y0 = Math.max(0, cy - ry), y1 = Math.min(h - 1, cy + ry), x, y;
    for (y = y0; y <= y1; y++) {
      var dy = (y - cy) / ry, br = B4[y & 3], row = y * w;
      for (x = x0; x <= x1; x++) {
        var dx = (x - cx) / rx, q = 1 - (dx * dx + dy * dy); if (q <= 0) continue;
        var v = d[row + x]; if (v < lo || v > hi) continue;
        var th = br[x & 3] + 0.5, t = q * amt;
        if (th < t) { v = LIT[v]; if (th < t - 1) v = LIT[v]; if (th < t - 2) v = LIT[v]; d[row + x] = v; }
      }
    }
  }
  // a shaded stone: lumpy outline, lit from the upper-left, dark rim on the shaded side. ramp = palette base of a >=6 tone ramp.
  // Rasterised once per (size, ramp, shape) and cached: each call is a cheap blit.
  var STC = {}, STN = 0;
  function stoneSprite(rx, ry, ramp, seed, top) {
    var ph = PX.h1((seed & 7) * 7 + 3) * TAU, W = 2 * Math.ceil(rx) + 3, Hh = 2 * Math.ceil(ry) + 3, d = new Uint8Array(W * Hh), ox = Math.ceil(rx) + 1, oy = Math.ceil(ry) + 1;
    for (var y = -Math.ceil(ry) - 1; y <= Math.ceil(ry) + 1; y++) for (var x = -Math.ceil(rx) - 1; x <= Math.ceil(rx) + 1; x++) {
      var ex = x / rx, ey = y / ry, ang = Math.atan2(ey, ex), lump = 1 + 0.13 * Math.sin(ang * 3 + ph) + 0.07 * Math.sin(ang * 5 + ph * 2);
      var e2 = (ex * ex + ey * ey) / (lump * lump); if (e2 > 1) continue;
      var lit = -(ex * 0.72 + ey * 0.72), t = lit > 0.5 ? top : lit > 0.1 ? top - 1 : lit > -0.35 ? top - 2 : top - 3;
      if (e2 > 0.72 && lit < 0.25) t = Math.max(0, t - 1);
      if (e2 > 0.86 && lit < 0.05) t = 0;
      if (t < 0) t = 0;
      d[(y + oy) * W + x + ox] = t + 1;
    }
    return { w: W, h: Hh, d: d, ox: ox, oy: oy };
  }
  function stone(fb, cx, cy, rx, ry, ramp, seed, hi) {
    var top = hi == null ? 4 : hi, r2 = Math.round(rx * 2), q2 = Math.round(ry * 2), key = (((r2 << 8) | q2) * 256 + ramp) * 64 + (seed & 7) * 8 + top;
    var sp = STC[key]; if (!sp) { if (++STN > 700) { STC = {}; STN = 1; } sp = STC[key] = stoneSprite(r2 / 2, q2 / 2, ramp, seed, top); }
    var w = fb.w, h = fb.h, d = fb.d, x0 = cx - sp.ox, y0 = cy - sp.oy, sw = sp.w, sd = sp.d, x, y;
    if (x0 >= w || y0 >= h || x0 + sw <= 0 || y0 + sp.h <= 0) return;
    for (y = 0; y < sp.h; y++) { var ty = y0 + y; if (ty < 0 || ty >= h) continue; for (x = 0; x < sw; x++) { var v = sd[y * sw + x]; if (!v) continue; var tx = x0 + x; if (tx < 0 || tx >= w) continue; d[ty * w + tx] = ramp + v - 1; } }
  }
  // draw a tiny bitmap ('.' empty; other chars via map[char] -> palette index)
  function bmp(fb, rows, map, x, y, flip) {
    for (var yy = 0; yy < rows.length; yy++) { var r = rows[yy], n = r.length; for (var xx = 0; xx < n; xx++) { var ch = r.charAt(flip ? n - 1 - xx : xx); if (ch === ".") continue; fb.set(x + xx, y + yy, map[ch]); } }
  }
  // a cluster of faceted crystal spires (hexagonal prisms with pyramid tips) growing from (cx, cy): ramp[0..4] = dark edge, shade, mid, lit, highlight.
  // opts: n (spires), len (px of the tallest), hw (its half width), lean (spread radians), glow (palette base of a halo ramp, optional)
  function crystals(fb, cx, cy, ramp, seed, o) {
    var rnd = PX.rng(seed | 0), n = o.n || 3, i, t, s, sh = o.len || 12, k;
    for (i = 0; i < n; i++) {
      var f = n === 1 ? 0 : (i / (n - 1)) * 2 - 1, main = i === Math.floor(n / 2), ang = f * (o.lean || 0.5) + (rnd() - 0.5) * 0.2;
      var len = Math.max(4, Math.round(sh * (main ? 1 : 0.5 + 0.35 * rnd()))), hw = Math.max(1.6, (o.hw || 2.4) * (main ? 1 : 0.7 + 0.2 * rnd())), bx = cx + Math.round(f * (o.spread || 4)), sa = Math.sin(ang), ca = Math.cos(ang), tip = 0.74;
      for (t = 0; t <= len; t++) {
        var u = t / len, half = u < tip ? hw * (1 - 0.14 * u / tip) : hw * 0.86 * (1 - (u - tip) / (1 - tip)) + 0.2, hi = Math.ceil(half);
        for (s = -hi; s <= hi; s++) {
          var px = Math.round(bx + sa * t + ca * s), py = Math.round(cy - ca * t + sa * s), rel = s / (half + 0.01), tone = rel < -0.3 ? 3 : (rel < 0.28 ? 2 : 1);
          if (u > tip) tone = rel < 0 ? 4 : 3;
          if (rel > -0.36 && rel < -0.2 && u < tip) tone = 4;
          if (rel > 0.86 || t < 1 || (u > 0.99 && s === 0)) tone = 0;
          fb.set(px, py, ramp + tone);
        }
      }
    }
  }
  var SINT = new Float32Array(1024); (function () { for (var i = 0; i < 1024; i++) SINT[i] = Math.sin(i / 1024 * TAU); })();
  function sn(x) { return SINT[((x * 162.97466) | 0) & 1023]; }        // sin(x) from a table (x in radians)
  // ---------------------------------------------------------------------------------------------------------------

  R.init = function (pal, S) {
    // ---- palette: every ramp runs dark -> light ----
    SKY0 = H(["#150a10", "#1e0d13", "#2b1116", "#3b1517", "#4e1a17", "#63211a", "#7c2b1b", "#983a1c", "#b54c1d", "#d0621f", "#e77c28", "#f5983a", "#fdb958", "#ffd97e"]);
    I.sky = pal.ramp("sky", SKY0);
    CLD0 = H(["#1a0e12", "#2a1516", "#3d1e1b", "#5a2b1f", "#8a3b1f", "#c95a24", "#f2872f"]);
    I.cloud = pal.ramp("cloud", CLD0);                                                                                 // ash: dark body, lava-lit underside
    LAVA0 = H(["#8a2212", "#c5361a", "#f26a1e", "#ffa62e", "#ffe070", "#ffa62e", "#f26a1e", "#c5361a"]);
    I.lava = pal.ramp("lava", LAVA0);                                                                                    // 8-step cycle: flows without redrawing
    I.hz = pal.ramp("hz", H(["#3b1a1c", "#52231f", "#6d2e22", "#8f3d24"]));                                             // far smoky haze
    I.mid = pal.ramp("mid", H(["#1f0f13", "#2b1417", "#3a1b1b", "#52251d", "#7b3520"]));
    I.near = pal.ramp("near", H(["#100809", "#190d0e", "#251314", "#361b17", "#582a1b", "#8a4520"]));
    I.vol = pal.ramp("vol", H(["#120a10", "#1c0f14", "#2a161a", "#3e2019", "#5c2f1c", "#87421e", "#b85a22"]));
    I.ash = pal.ramp("ash", H(["#1f1516", "#2b1c1c", "#3b2722", "#503530", "#6e4a3f", "#8f6552", "#b8865f"]));
    I.scor = pal.ramp("scor", H(["#1c0e0e", "#2c1412", "#42201a", "#5f2d20", "#84402a"]));
    I.bas = pal.ramp("bas", H(["#100a10", "#181119", "#231a25", "#322735", "#463a4a"]));
    I.mag = pal.ramp("mag", H(["#2a0c10", "#4b1210", "#7d1c10", "#b5300f", "#e5561a", "#ff8f2e"]));
    I.brz = pal.ramp("brz", H(["#4a3520", "#7a5a2e", "#b58a3e", "#e6c060"]));
    I.ember = pal.ramp("ember", H(["#ff8f2e", "#ffc24a", "#fff0a0"]));
    I.ink = pal.ramp("ink", H(["#070405"]));
    MAG0 = H(["#2a0c10", "#4b1210", "#7d1c10", "#b5300f", "#e5561a", "#ff8f2e"]);
    buildTables(pal);
    R.birdIdx = I.near; R.watcherIdx = I.near + 1;
    R.footprint = { col: I.ash + 2, hi: I.ash + 5 };                    // pressed ash with a warm lit rim
    R.markerIdx = { c0: I.bas + 1, c1: I.bas + 3, c2: I.scor + 4, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };   // cairns in basalt lit by lava
    R.pal = pal; RMAP = null;
    built = "";
    build(S);
  };

  // ---------- the volcano: a concave cone with fan gullies, glowing lava rivers, a lava-filled crater ----------
  function volcanoSprite(Hc, seed) {
    var W = Math.round(Hc * 3.9), Hs = Hc + 6, sp = new PX.Sprite(W, Hs), d = sp.d, cx = Math.round(W * 0.5), HW = W * 0.5 - 2, rnd = PX.rng(seed), x, y, i, k;
    var top = new Int16Array(W).fill(Hs), jit = Sc.periodic(W, seed * 3 + 1), craterY = 0, cw = Math.max(4, Math.round(HW * 0.055));
    for (x = 0; x < W; x++) {
      var dx = x - cx, ad = Math.abs(dx) / HW; if (ad >= 1) continue;
      var h = Hc * Math.pow(1 - ad, dx < 0 ? 1.45 : 1.7);
      h += Hc * 0.11 * Math.exp(-Math.pow((dx + HW * 0.40) / (HW * 0.13), 2)) + Hc * 0.06 * Math.exp(-Math.pow((dx - HW * 0.52) / (HW * 0.09), 2));
      if (Math.abs(dx) < cw) h -= (1 - (dx / cw) * (dx / cw)) * Hc * 0.05;
      h += 1.5 * jit(x) * (ad < 0.85 ? 1 : 0.4);
      top[x] = Hs - 1 - Math.round(h);
    }
    craterY = top[cx - cw] + 2;
    var nR1 = 8, nR2 = 15, Rmax = Math.sqrt(HW * HW + Hc * Hc), wobs = [rnd() * TAU, rnd() * TAU];
    for (x = 0; x < W; x++) for (y = top[x]; y < Hs; y++) {
      var ddx = x - cx, ddy = Math.max(1, y - craterY), r = Math.sqrt(ddx * ddx + ddy * ddy), th = Math.atan2(ddx, ddy) / 1.5708;          // -1 .. 1
      var wob = 0.32 * Math.sin(r * 0.075 + wobs[0]) + 0.18 * Math.sin(r * 0.19 + wobs[1]), nR = r < Hc * 0.55 ? nR1 : nR2;
      var u = (th * 0.5 + 0.5) * nR + wob + (r < Hc * 0.55 ? 0 : 0.5); u -= Math.floor(u);
      var crest = 1 - Math.abs(u - 0.5) * 2, side = u < 0.5 ? 0.4 : -0.4;
      var glow = clamp01(1 - r / (Hc * 0.95)), tone = 0.7 + 1.6 * crest + side * crest + glow * 3.0 + B4[y & 3][x & 3] * 0.8;
      tone -= clamp01((y - (Hs - 12)) / 12) * 1.2;                                                     // the base sinks into shadow and smoke
      d[y * W + x] = I.vol + clamp(Math.floor(tone + 0.5), 0, 6);
    }
    for (x = 1; x < W - 1; x++) if (top[x] < Hs) {                       // rim: a hot lip near the crater, a thin warm edge elsewhere
      var near = Math.abs(x - cx) < HW * 0.22, dxl = x - cx;
      d[top[x] * W + x] = near ? I.vol + 6 : (dxl < 0 ? I.vol + 4 : I.vol + 3);
    }
    for (x = cx - cw; x <= cx + cw; x++) for (y = top[x]; y <= craterY + 1; y++) d[y * W + x] = I.lava + ((x + y) & 7);       // the crater: a lake of lava
    var flows = 6;                                                        // lava rivers down the gullies (palette-cycled: index = distance along the river)
    for (k = 0; k < flows; k++) {
      var th0 = -0.75 + (k + 0.5 * rnd()) * (1.5 / (flows - 1)) + (rnd() - 0.5) * 0.18, ph = rnd() * TAU, len = Hc * (0.62 + 0.4 * rnd()), s0 = Math.floor(rnd() * 8), br = rnd() < 0.5;
      var bx = 0, by = 0, bdone = false;
      for (var s = cw * 0.6; s < len + Hc * 0.3; s += 0.7) {
        var tt = th0 + 0.05 * Math.sin(s * 0.07 + ph) + 0.03 * Math.sin(s * 0.19 + ph * 2) + (PX.h2(k, Math.floor(s / 5)) - 0.5) * 0.035 - (s / len) * (th0) * 0.08, ang = tt * 1.5708;
        var px = Math.round(cx + Math.sin(ang) * s * 1.05), py = Math.round(craterY + Math.cos(ang) * s * 0.92);
        if (py < 0 || py >= Hs - 2 || px < 1 || px >= W - 1 || py < top[px]) continue;
        var wd = 1 + (s > len * 0.35 ? 1 : 0) + (s > len * 0.75 ? 1 : 0), ci = I.lava + ((Math.floor(s * 0.9) + s0) & 7);
        for (i = 0; i < wd; i++) if (py < top[px + i] === false || true) d[py * W + px + i] = ci;
        if (br && !bdone && s > len * 0.5) { bdone = true; bx = px; by = py; }
      }
      if (bdone) for (var b2 = 0; b2 < 16; b2++) { var qx = bx + Math.round(b2 * 0.9 * (th0 < 0 ? -1 : 1)), qy = by + b2; if (qy < Hs - 2 && qx > 0 && qx < W - 1 && qy >= top[qx]) d[qy * W + qx] = I.lava + ((b2 + s0 + 3) & 7); }
    }
    for (y = 1; y < Hs - 1; y++) for (x = 1; x < W - 1; x++) {           // lava-lit rock beside the rivers: one warm step, dithered
      var v = d[y * W + x]; if (!v || (v >= I.lava && v < I.lava + 8)) continue;
      var lv = 0, nb = [d[y * W + x - 1], d[y * W + x + 1], d[(y - 1) * W + x], d[(y + 1) * W + x]];
      for (i = 0; i < 4; i++) if (nb[i] >= I.lava && nb[i] < I.lava + 8) lv++;
      if (lv && B4[y & 3][x & 3] + 0.5 < 0.4 + lv * 0.25) d[y * W + x] = LIT[LIT[v]];
    }
    sp.cx = cx; sp.craterY = craterY; sp.top = top; sp.Hc = Hc;
    return sp;
  }

  // ---------- jagged basalt ridges: two-tone facets (lit toward the volcano, dark away), rim light, fissures, a glowing haze at the base ----------
  function ridgeStrip(o) {
    var L = o.L, Hh = o.H, st = Sc.newStrip(L, Hh), d = st.d, rnd = PX.rng(o.seed), x, y, k, P = o.ramp, n = o.n;
    var crest = new Float32Array(L), ci = new Int16Array(L), waves = [], cnt = o.cnt || [4, 9, 19, 41];                                       // whole numbers of periods per strip: it tiles seamlessly
    for (k = 0; k < cnt.length; k++) waves.push({ c: cnt[k], a: Math.pow(0.55, k), ph: rnd() });
    for (x = 0; x < L; x++) {
      var s = 0, ws = 0;
      for (k = 0; k < waves.length; k++) { var f = (x * waves[k].c / L + waves[k].ph) % 1, tri = Math.abs(f * 2 - 1); s += waves[k].a * (o.round ? Math.sin(f * TAU) * 0.5 + 0.5 : tri); ws += waves[k].a; }
      crest[x] = o.base - o.amp * (s / ws - 0.35) * 1.5;
      ci[x] = Math.round(crest[x]);
    }
    for (x = 0; x < L; x++) {
      var sl = (crest[(x + 2) % L] - crest[(x + L - 2) % L]) / 4, lit = sl < -0.02;
      for (y = Math.max(0, ci[x]); y < Hh; y++) {
        var dd = y - ci[x], xs = (((x - Math.round(dd * 0.55 * (lit ? -1 : 1))) % L) + L) % L, sl2 = (crest[(xs + 2) % L] - crest[(xs + L - 2) % L]) / 4, lit2 = sl2 < -0.02;
        var t = (lit2 ? 0.55 * (n - 1) : 0.2 * (n - 1)) - (dd / Hh) * 0.5 * (n - 1) + B4[y & 3][x & 3] * 0.8 + (o.roughTone || 0) * (PX.h2(xs >> 1, y >> 1) - 0.5);
        if (dd === 0) t = lit2 ? n - 1 : 0.5 * (n - 1);
        else if (dd === 1 && lit2) t += 0.8;
        d[y * L + x] = P + clamp(Math.floor(t + 0.5), 0, n - 1);
      }
    }
    if (o.fissures) for (k = 0; k < L / o.fissures; k++) {               // glowing fissures on the lit faces
      var fx = Math.floor(rnd() * L), fy = ci[fx] + 3 + Math.floor(rnd() * 8), len = 6 + Math.floor(rnd() * 12), dir = rnd() < 0.5 ? -1 : 1, s0 = Math.floor(rnd() * 8), xx = fx, yy = fy;
      for (var q = 0; q < len; q++) { xx += (PX.h2(k, q + 3) < 0.4 ? dir : 0); yy += 1; if (yy >= Hh - 4) break; d[yy * L + (((xx % L) + L) % L)] = I.lava + ((q + s0) & 7); if (q % 3 === 0) d[yy * L + (((xx + 1) % L + L) % L)] = I.lava + ((q + s0 + 2) & 7); }
    }
    if (o.fade) for (y = 0; y < o.fadeRows; y++) {
      var ry = Hh - 1 - y, amt = 1 - y / o.fadeRows;
      for (x = 0; x < L; x++) if ((B4[ry & 3][x & 3] + 0.5) < amt) d[ry * L + x] = o.fade;
    }
    st.crest = o.base; st.ci = ci; return st;
  }

  // ---------- a wall of basalt columns: staggered organ-pipe tops, vertical joints, a lava-lit left edge, glowing base ----------
  function columnStrip(o) {
    var L = o.L, Hh = o.H, st = Sc.newStrip(L, Hh), d = st.d, rnd = PX.rng(o.seed), x = 0, y, P = o.ramp, n = o.n, per = Sc.periodic(L, o.seed * 3 + 1), per2 = Sc.periodic(L, o.seed * 7 + 2);
    var col = 0;
    while (x < L) {
      var cw = Math.max(3, Math.round((4 + rnd() * 8) * o.ws)), base = o.base + o.amp * (0.6 * per(x + cw / 2) + 0.4 * per2(x + cw / 2)), top = Math.round(base - Math.max(0, per2(x * 1.7)) * o.amp * 0.4 + (rnd() - 0.5) * o.jit), slant = rnd() < 0.5 ? 0 : 1;
      for (var xx = 0; xx < cw; xx++) {
        var px = (x + xx) % L, tp = top + (slant ? Math.round(xx * 0.3) : Math.round((cw - xx) * 0.3));
        for (y = Math.max(0, tp); y < Hh; y++) {
          var dd = y - tp, t = 0.55 * (n - 1) - (dd / Hh) * 0.55 * (n - 1) + B4[y & 3][px & 3] * 0.7 - (xx > cw * 0.6 ? 1.0 : 0) + (xx === 0 ? 1.2 : 0) + (rnd() < 0.02 ? 0.6 : 0);
          if (dd < 2) t += 1.2;
          var idx = P + clamp(Math.floor(t + 0.5), 0, n - 1);
          if (xx === cw - 1 && cw > 3) idx = P;                              // dark joint
          if (xx === 0 && dd > 1 && dd < Hh * 0.6) idx = P + n - 1 - (dd > Hh * 0.3 ? 1 : 0);                        // lava-lit left edge
          d[y * L + px] = idx;
        }
      }
      x += cw; col++;
    }
    if (o.fade) for (y = 0; y < o.fadeRows; y++) {
      var ry = Hh - 1 - y, amt = 1 - y / o.fadeRows;
      for (var fx = 0; fx < L; fx++) if ((B4[ry & 3][fx & 3] + 0.5) < amt) d[ry * L + fx] = o.fade;
    }
    return st;
  }

  // ---------- the crust plain: black plates split by glowing cracks (palette-cycled), a lava river with dark floes, seen at a low angle ----------
  function plainStrip(o) {
    var L = o.L, Hh = o.H, st = Sc.newStrip(L, Hh), d = st.d, rnd = PX.rng(o.seed), x, y, k, a = o.a;
    var ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU];
    var yc = new Float32Array(L), hw = new Float32Array(L);
    for (x = 0; x < L; x++) { var u = x / L * TAU; yc[x] = o.yr + 4 * a * Math.sin(u * 2 + ph[0]) + 2.2 * a * Math.sin(u * 5 + ph[1]) + a * Math.sin(u * 12 + ph[2]); hw[x] = Math.max(2.4, (3.6 + 1.8 * Math.sin(u * 3 + ph[1]) + 0.8 * Math.sin(u * 9 + ph[0])) * a); }
    for (y = 0; y < Hh; y++) {
      var z = 1 + (y / Math.max(1, Hh)) * 2.6, cwid = 9 * z * a, chh = 3.4 * z * a;             // cell size grows with distance from the horizon (perspective)
      for (x = 0; x < L; x++) {
        var cellx = Math.floor(x / cwid + (Math.floor((y + 3) / chh) & 1) * 0.5), celly = Math.floor((y + 3) / chh);
        var lx = x / cwid + (celly & 1) * 0.5 - cellx, ly = (y + 3) / chh - celly, edge = Math.min(lx, 1 - lx, (ly) * 0.55, (1 - ly) * 0.55);
        var tn = PX.h2(cellx, celly + o.seed), tone = 1.4 + tn * 1.8 + clamp01(y / Hh) * 0.5 + B4[y & 3][x & 3] * 0.7 + (lx < 0.25 && ly < 0.5 ? 0.7 : 0);
        var idx = tn > 0.55 ? I.scor + clamp(Math.floor(tone - 0.5), 0, 4) : I.bas + clamp(Math.floor(tone), 0, 4);
        if (edge < 0.045 + 0.006 * z) idx = I.lava + ((Math.floor(x * 0.5 + y * 1.3) + (celly * 3)) & 7);              // glowing cracks
        d[y * L + x] = idx;
      }
    }
    for (k = 0; k < 5; k++) {                                            // tributaries: glowing streams that leave the river and widen toward the viewer
      var sx0 = Math.round((k + 0.2 + 0.6 * rnd()) * L / 5), y0 = Math.round(yc[sx0 % L] + hw[sx0 % L]), tph = rnd() * TAU, drift = (rnd() - 0.5) * 0.7, wq = 2 + rnd() * 2;
      for (y = y0; y < Hh; y++) {
        var f = y - y0, cxp = sx0 + drift * f + Math.sin(f * 0.06 + tph) * (3 + f * 0.08), wd = wq + f * 0.075 * a;
        for (var xx = Math.floor(cxp - wd - 1); xx <= Math.ceil(cxp + wd + 1); xx++) {
          var ax = Math.abs(xx - cxp), px2 = ((xx % L) + L) % L; if (ax > wd + 1) continue;
          d[y * L + px2] = ax > wd ? I.bas + 1 : (ax > wd - 1 ? I.scor + 1 : I.lava + ((Math.floor(f * 0.7 + ax * 0.6) + k * 3) & 7));
        }
      }
    }
    for (x = 0; x < L; x++) {                                            // the river: bright core, dark crust floes riding it
      var top = Math.round(yc[x] - hw[x]), bot = Math.round(yc[x] + hw[x]);
      for (y = top; y <= bot; y++) {
        var rel = (y - top) / Math.max(1, bot - top), c = I.lava + ((Math.floor(x * 0.35 + rel * 5) + Math.floor(y * 0.7)) & 7);
        if (PX.h2(x >> 2, y + 77) > 0.86 && rel > 0.15 && rel < 0.85) c = I.bas + 1 + (x & 1);
        d[y * L + x] = c;
      }
      d[(top - 1) * L + x] = I.bas; d[(bot + 1) * L + x] = I.bas + 1;
    }
    return st;
  }

  // ---------- ash: a cloud bank with a dark crown and a lava-lit underside; and thin streaks ----------
  function ashBank(seed, w, h) {
    var rnd = PX.rng(seed), sp = new PX.Sprite(w, h), C = I.cloud, arcs = [], x, y, i, base = h - 2, peakX = w * (0.25 + 0.5 * rnd()), ax = 1;
    while (ax < w - 2) {
      var e = ax < peakX ? ax / peakX : (w - ax) / (w - peakX); e = Math.pow(clamp01(e), 0.6);
      var r = Math.max(3, Math.min(h * 0.36, h * (0.14 + 0.26 * e) * (0.6 + 0.8 * rnd())));
      var topY = base - (h * 0.14 + h * 0.66 * Math.pow(e, 1.4) * (0.74 + 0.26 * rnd()));
      arcs.push({ x: clamp(ax + r * 0.8, r + 1, w - r - 1), cy: Math.max(r * 0.9 + 1, topY + r * 0.9), r: r, ry: r * 0.9 });
      ax += r * (0.6 + 0.6 * rnd());
    }
    arcs.sort(function (p, q) { return p.cy - q.cy; });
    function inA(A, px, py) { var dx = (px + 0.5 - A.x) / A.r, dy = (py + 0.5 - A.cy) / A.ry; return dx * dx + dy * dy <= 1; }
    var bot = new Int16Array(w), top = new Float32Array(w).fill(1e9);
    for (x = 0; x < w; x++) bot[x] = base - Math.round(1.2 + 1.3 * Math.sin(x * 0.13 + seed) + 0.8 * Math.sin(x * 0.29 + seed * 2));
    for (i = 0; i < arcs.length; i++) for (x = Math.max(0, Math.ceil(arcs[i].x - arcs[i].r)); x <= Math.min(w - 1, Math.floor(arcs[i].x + arcs[i].r)); x++) { var ty = arcs[i].cy - arcs[i].ry * Math.sqrt(Math.max(0, 1 - Math.pow((x + 0.5 - arcs[i].x) / arcs[i].r, 2))); if (ty < top[x]) top[x] = ty; }
    for (x = 0; x < w; x++) if (top[x] < 1e8) for (y = Math.max(0, Math.round(top[x])); y <= bot[x]; y++) {       // the body: dark crown, tones lifting toward a hot underside
      var fromBot = bot[x] - y, b = B4[y & 3][x & 3] + 0.5, span = Math.max(4, bot[x] - top[x]), v = (y - top[x]) / span, c;
      if (fromBot < 2) c = b < 0.55 ? C + 6 : C + 5;
      else if (fromBot < 4) c = b < 0.5 ? C + 5 : C + 4;
      else if (v > 0.72) c = b < 0.5 ? C + 4 : C + 3;
      else if (v > 0.45) c = b < 0.45 ? C + 3 : C + 2;
      else c = b < 0.4 ? C + 2 : (b < 0.75 ? C + 1 : C);
      sp.d[y * w + x] = c;
    }
    for (i = 0; i < arcs.length; i++) {                                  // every puff keeps its own lit lower-left rim over the ones behind it
      var A = arcs[i];
      for (y = Math.max(0, Math.floor(A.cy - A.ry)); y <= Math.min(h - 1, Math.ceil(A.cy + A.ry)); y++) for (x = Math.max(0, Math.floor(A.x - A.r)); x <= Math.min(w - 1, Math.ceil(A.x + A.r)); x++) {
        if (!inA(A, x, y) || y > bot[x] - 3) continue;
        var rel = (y + 0.5 - (A.cy - A.ry)) / (2 * A.ry), bb = B4[y & 3][x & 3] + 0.5, cc = rel < 0.3 ? C + (bb < 0.5 ? 1 : 0) : rel < 0.55 ? C + 2 : rel < 0.8 ? C + (bb < 0.5 ? 3 : 2) : C + 3;
        if (!inA(A, x, y + 1) || (!inA(A, x - 1, y + 1) && rel > 0.4)) cc = C + 4;                                       // lit lower edge
        else if (!inA(A, x - 1, y) && rel > 0.25) cc = Math.min(C + 6, cc + 1);                                           // lit left edge
        else if (!inA(A, x, y - 1) && rel < 0.3) cc = Math.max(C, cc - 1);
        sp.d[y * w + x] = cc;
      }
    }
    return sp;
  }
  function puffSprite(r, seed) {                                         // a plume billow: lumpy, dark, its underside and left flank lit by the vent; a dithered interior
    var W = r * 2 + 5, sp = new PX.Sprite(W, W), C = I.cloud, x, y, ph = PX.h1(seed) * TAU, ph2 = PX.h1(seed + 9) * TAU;
    for (y = 0; y < W; y++) for (x = 0; x < W; x++) {
      var dx = x - r - 2, dy = y - r - 2, ang = Math.atan2(dy, dx), lump = 1 + 0.15 * Math.sin(ang * 3 + ph) + 0.1 * Math.sin(ang * 5 + ph2) + 0.06 * Math.sin(ang * 8 + ph), e = (dx * dx + dy * dy * 1.08) / (r * r * lump * lump);
      if (e > 1) continue;
      var v = (dy / r) * 0.5 + 0.5, lit = -dx / r * 0.34 + v * 0.85, tone = 0.4 + lit * 3.0 + B4[y & 3][x & 3] * 0.9;
      if (e > 0.82 && (dy > r * 0.15 || dx < -r * 0.3)) tone += 0.9;
      sp.d[y * W + x] = C + clamp(Math.floor(tone + 0.5), 0, 6);
    }
    return sp;
  }
  function blitFade(fb, sp, dx, dy, alpha) {                             // an ordered-dither fade in / out (no blending)
    var w = fb.w, h = fb.h, d = fb.d, sw = sp.w, sh = sp.h, sd = sp.d, x, y;
    for (y = 0; y < sh; y++) { var ty = dy + y; if (ty < 0 || ty >= h) continue; for (x = 0; x < sw; x++) { var v = sd[y * sw + x]; if (!v) continue; var tx = dx + x; if (tx < 0 || tx >= w || B4[ty & 3][tx & 3] + 0.5 > alpha) continue; d[ty * w + tx] = v; } }
  }

  function build(S) {
    var key = S.w + "x" + S.h + "@" + (S.adj || 1); if (built === key) return; built = key; ST.skyKey = "";
    var a = S.adj || 1, hy = S.horizonY, i;
    function A(v) { return Math.max(1, Math.round(v * a)); }
    ST.a = a;
    var Hc = clamp(Math.round(hy * 0.62), 52, 190);
    ST.vol = volcanoSprite(Hc, 5);
    ST.far = ridgeStrip({ L: 1200, H: Math.round(hy * 0.30), seed: 3, base: Math.round(hy * 0.22), amp: hy * 0.13, ramp: I.hz, n: 4, round: true, fade: I.hz + 2, fadeRows: A(8), roughTone: 0.5 });
    ST.mid = ridgeStrip({ L: 1100, H: Math.round(hy * 0.30), seed: 7, base: Math.round(hy * 0.20), amp: hy * 0.13, ramp: I.mid, n: 5, round: true, cnt: [3, 6, 11], fade: I.mid + 3, fadeRows: A(7), fissures: 90 });
    ST.plain = plainStrip({ L: 1024, H: Math.max(S.h - hy, 60) + A(24), seed: 9, yr: A(13), a: a });
    ST.near = columnStrip({ L: 900, H: Math.round(hy * 0.20), seed: 13, base: Math.round(hy * 0.11), amp: hy * 0.06, jit: 6, ws: a, ramp: I.near, n: 6, fade: I.mag + 3, fadeRows: A(5) });
    CL = [];
    var cspec = [[0.55, 0.16, 0.05, 0.9], [0.4, 0.2, 0.17, 1.4], [0.7, 0.14, 0.30, 0.7], [0.32, 0.22, 0.09, 1.1], [0.5, 0.15, 0.40, 1.6]];
    for (i = 0; i < cspec.length; i++) {
      var cw = Math.round(clamp(S.w * cspec[i][0], 60, 360)), ch = Math.round(clamp(cw * cspec[i][1], 12, 66));
      CL.push({ sp: ashBank(900 + i * 31, cw, ch), x: PX.h1(i * 7 + 2) * 1400, y: cspec[i][2], v: 0.5 + cspec[i][3] * 0.8 });
    }
    PUFF = [];
    for (i = 0; i < 9; i++) PUFF.push(puffSprite(2 + i * Math.max(1, Math.round(hy * 0.011 * a + 1)), 40 + i));
  }

  // where the crater sits on screen (the volcano barely parallaxes: it is very far away)
  function volPos(S) {
    var hy = S.horizonY + Math.round((1 - S.openingT) * S.h * 0.12), a = S.adj || 1, v = ST.vol || { w: 200, h: 100, cx: 100, craterY: 6 };
    var vx = Math.round(S.w * 0.27 - v.cx - S.altitude * 0.006), vy = hy + Math.round(6 * a) - v.h;
    return { x: vx, y: vy, cx: vx + v.cx, cy: vy + v.craterY, hy: hy };
  }
  R.light = function (S) {
    var p = volPos(S), t = S.reduced ? 0 : S.tSec, fl = 0.94 + 0.06 * Math.sin(t * 2.3) * Math.sin(t * 0.9);
    return { x: p.cx, y: p.cy, k: 0.74 * fl, col: [255, 138, 62], ambient: [112, 48, 40], bright: 0.62, ground: [104, 48, 30] };
  };

  // palette animation: the lava cycles; the whole sky breathes with the vent; the deep glow throbs; the far air darkens as the fields end
  function strikeAt(t) {                                                 // lightning inside the ash: a double flash roughly every 13 s (not every window)
    var k = Math.floor(t / 13); if (PX.h1(k * 11 + 5) < 0.4) return 0;
    var e = t - (k * 13 + 2 + PX.h1(k * 7 + 3) * 8); if (e < 0 || e > 0.34) return 0;
    return e < 0.07 ? e / 0.07 : e < 0.14 ? 1 - (e - 0.07) / 0.14 * 0.5 : e < 0.2 ? 0.5 + (e - 0.14) / 0.06 * 0.4 : Math.max(0, 0.9 - (e - 0.2) / 0.14 * 0.9);
  }
  function erupt(t) { var ph = (t % 47) / 47; return ph < 0.2 ? Math.pow(Math.sin(ph / 0.2 * Math.PI), 2) : 0; }
  R.palette = function (pal, S) {
    var t = S.reduced ? 0 : S.tSec, i, zp = clamp01((S.altitude - 7450) / 1500), E = erupt(t);
    var ph = Math.floor(t * 3.4) & 7, rot = []; for (i = 0; i < 8; i++) rot.push(LAVA0[(i + ph) & 7]);
    pal.setRamp("lava", rot);
    var breathe = 1 + (S.reduced ? 0 : 0.045 * Math.sin(t * 0.7) + 0.03 * Math.sin(t * 1.9 + 1)) + E * 0.12, dark = 1 - 0.16 * sm((zp - 0.6) / 0.4);
    pal.setRamp("sky", SKY0.map(function (c, k) { var f = k < 5 ? dark : dark * (1 + (breathe - 1) * (k - 4) / 9); return [c[0] * f, c[1] * f * (0.98 + 0.02 * dark), c[2] * f]; }));
    var fl = S.reduced ? 0 : strikeAt(t);
    pal.setRamp("cloud", CLD0.map(function (c, k) { var m = fl * (k < 1 ? 0.15 : 0.6); return [c[0] + (255 - c[0]) * m, c[1] + (204 - c[1]) * m, c[2] + (150 - c[2]) * m]; }));
    var th = 1 + (S.reduced ? 0 : 0.07 * Math.sin(t * 1.1) + 0.04 * Math.sin(t * 2.7));
    pal.setRamp("mag", MAG0.map(function (c, k) { var f = 1 + (th - 1) * (k / 5); return [Math.min(255, c[0] * f), Math.min(255, c[1] * f), c[2] * f]; }));
  };

  function plume(fb, S, vp, t) {                                         // billows rising from the crater, spreading into an ash sheet; drawn back to front, fading in and out
    var a = S.adj || 1, N = 20, i, top = vp.cy - Math.round(S.horizonY * 0.74), span = vp.cy - top, wind = 0.55 + 0.45 * Math.sin(S.altitude * 0.004 + 1), tt = t + erupt(t) * 3;
    for (i = N - 1; i >= 0; i--) {
      var p = ((tt * 0.04 + i / N) % 1), q = Math.pow(p, 0.85), jx = (PX.h1(i * 7 + Math.floor(tt * 0.04 + i / N) * 13) - 0.5) * 6;
      var px = vp.cx + Math.round(Math.sin(q * 2.2 + i) * 3 * (1 + q * 3) + q * q * span * 0.5 * wind + jx * q), py = vp.cy - Math.round(q * span);
      var ri = clamp(Math.round(q * 8 + 0.5 + (i % 3) - 1), 0, PUFF.length - 1), sp = PUFF[ri], al = clamp01(Math.min(p / 0.12, (1 - p) / 0.35));
      if (q > 0.72) { blitFade(fb, sp, px - (sp.w >> 1) - 6, py - (sp.h >> 1) + 1, al); blitFade(fb, sp, px - (sp.w >> 1) + 7, py - (sp.h >> 1) + 2, al * 0.9); }
      blitFade(fb, sp, px - (sp.w >> 1), py - (sp.h >> 1), al);
    }
  }

  R.backdrop = function (fb, S, pal) {
    build(S);
    var w = fb.w, h = fb.h, d = fb.d, a = S.adj || 1, sh = Math.round((1 - S.openingT) * S.h * 0.12), hy = S.horizonY + sh, al = S.altitude, t = S.reduced ? 0 : S.tSec, i;
    function A(v) { return Math.round(v * a); }
    var vp = volPos(S), skey = w + "x" + h + "|" + hy + "|" + vp.cx + "," + vp.cy;
    if (ST.skyKey !== skey || !ST.sky || ST.sky.length !== w * h) {
      var idx = []; for (i = 0; i < 14; i++) idx.push(I.sky + i);
      Sc.bands(fb, 0, hy + A(22), idx, 4);
      if (hy + A(22) < h) fb.fillRect(0, hy + A(22), w, h - hy - A(22), I.sky + 13);
      lift(fb, vp.cx, vp.cy + A(10), Math.round(clamp(w * 0.62, 90, 320)), Math.round(clamp(hy * 0.95, 80, 260)), 3.6, I.sky, I.sky + 13);
      lift(fb, vp.cx, hy, Math.round(w * 0.9), Math.round(hy * 0.32), 1.5, I.sky, I.sky + 13);
      if (!ST.sky || ST.sky.length !== w * h) ST.sky = new Uint8Array(w * h);
      ST.sky.set(fb.d); ST.skyKey = skey;
    } else d.set(ST.sky);
    for (i = 0; i < CL.length; i++) {
      var c = CL[i], span = w + c.sp.w + 60, cx = ((c.x - t * c.v - al * 0.05) % span + span) % span - c.sp.w;
      fb.blit(c.sp, Math.round(cx), Math.round(c.y * hy), 0);
    }
    var flv = S.reduced ? 0 : strikeAt(t);
    if (flv > 0.25) {                                                    // a forked bolt from an ash cloud, drawn in hot white-yellow
      var kk = Math.floor(t / 13), bx = Math.round((0.35 + PX.h1(kk * 13 + 1) * 0.55) * w), by = Math.round(hy * 0.18), yy = by, bxx = bx;
      for (var q = 0; q < Math.round(hy * 0.34); q++) {
        bxx += Math.floor(PX.h2(kk * 31 + q, 9) * 3) - 1; yy++; fb.set(bxx, yy, I.ember + 2); if (q & 1) fb.set(bxx + 1, yy, I.ember + 1);
        if (q === 14 || q === 28) { var ox = bxx, oy = yy, od = q === 14 ? -1 : 1; for (var q2 = 0; q2 < 12; q2++) { ox += od * (PX.h2(kk + q2, 5) < 0.6 ? 1 : 0); oy++; fb.set(ox, oy, I.ember + 1); } }
      }
    }
    Sc.blitStrip(fb, ST.far, al * 0.03 + 300, hy + A(2) - ST.far.h + 1);
    fb.fillRect(0, hy + A(3), w, Math.max(0, h - hy - A(3)), I.hz + 2);
    fb.blit(ST.vol, vp.x, vp.y, 0);
    plume(fb, S, vp, t);
    var Eb = erupt(t);
    if (Eb > 0 && !S.reduced) {                                          // a lava fountain: hot fragments thrown out of the crater on ballistic arcs
      var sc = ST.vol.Hc / 100, tau0 = (t % 47);
      for (i = 0; i < 26; i++) {
        var age = tau0 - PX.h1(i * 7 + 2) * 6.5; if (age < 0 || age > 1.7) continue;
        var vx = (PX.h1(i * 11 + 3) - 0.5) * 90 * sc, vy = (60 + PX.h1(i * 5 + 4) * 70) * sc, gg = 95 * sc;
        var fx = Math.round(vp.cx + vx * age), fy = Math.round(vp.cy - (vy * age - 0.5 * gg * age * age)), ci = age < 0.7 ? 2 : age < 1.2 ? 1 : 0;
        fb.set(fx, fy, I.ember + ci); if (age < 1.3) { fb.set(fx - (vx > 0 ? 1 : -1), fy + 1, I.ember + (ci > 0 ? ci - 1 : 0)); }
      }
    }
    var y1 = hy + A(12);
    Sc.blitStrip(fb, ST.mid, al * 0.1 + 120, y1 - ST.mid.h + 1);
    fb.fillRect(0, y1 + 1, w, Math.max(0, h - y1 - 1), I.mid + 3);
    lift(fb, Math.round(w * 0.5), hy + A(2), Math.round(w * 0.85), Math.round(hy * 0.26), 2.6, I.hz, I.vol + 6);      // the lava plain lights the bases of the volcano and ridges
    var yp = hy + A(11);
    Sc.blitStrip(fb, ST.plain, al * 0.16 + 60, yp);
    if (yp + ST.plain.h < h) fb.fillRect(0, yp + ST.plain.h, w, h - yp - ST.plain.h, I.bas + 1);
    if (!S.reduced) {                                                    // heat shimmer: rows above the lava slide a pixel back and forth
      for (var sy = Math.max(1, hy - A(30)); sy < Math.min(h, hy + A(14)); sy++) {
        var wv = Math.sin(t * 2.6 + sy * 1.1 + al * 0.01); if (wv < 0.5) continue;
        var rw = sy * w; if (wv > 0.85) d.copyWithin(rw + 2, rw, rw + w - 2); else d.copyWithin(rw + 1, rw, rw + w - 1);
      }
    }
    var y3 = hy + A(46);
    Sc.blitStrip(fb, ST.near, al * 0.34 + 500, y3 - ST.near.h + 1);
  };

  // ---------- ground: a cut through the volcano's skirts, layered parallel to the slope ----------
  // ash surface, laminated ash beds, red scoria, jointed basalt columns, banded old flows, crust plates over a magma sea. Thickness in world
  // depth units (depthZoom keeps the strata readable when the camera is far out); everything hot is a palette-cycled lava index.
  var LT = [14, 50, 46, 132, 84, 46], AMP = [0.8, 2.4, 2.4, 3.8, 3.0, 2.2], BND = new Int16Array(8);
  var DH = new Float32Array(4096);
  function bump(p) { return p <= -1 || p >= 1 ? 0 : (p < 0 ? Math.pow(1 - p * p, 0.7) : Math.pow(1 - p, 1.5) * (1 + 0.5 * p)); }
  function driftAt(wx) {                                               // ash dunes: a steep lee face on the left (toward the vent), a long tail to the right
    var s = 0, cell = 130, k0 = Math.floor(wx / cell), k;
    for (k = k0 - 1; k <= k0 + 1; k++) {
      if (PX.h1(k * 7 + 3) < 0.35) continue;
      var c = k * cell + (0.2 + 0.6 * PX.h1(k * 5 + 1)) * cell, hw = 18 + 32 * PX.h1(k * 11 + 2), ht = 4 + 8 * PX.h1(k * 13 + 4), b = bump((wx - c) / hw) * ht; if (b > s) s = b;
    }
    var cell2 = 37, j0 = Math.floor(wx / cell2);
    for (k = j0 - 1; k <= j0 + 1; k++) {
      if (PX.h1(k * 17 + 9) < 0.5) continue;
      var c2 = k * cell2 + PX.h1(k * 19 + 5) * cell2, hw2 = 5 + 8 * PX.h1(k * 23 + 6), ht2 = 1.4 + 2.0 * PX.h1(k * 29 + 7), b2 = bump((wx - c2) / hw2) * ht2; if (b2 > s) s = b2;
    }
    return s;
  }

  R.ground = function (fb, S, pal) {
    build(S);
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, sc = S.scroll, lipA = S.lip, adj = S.adj || 1, t = S.reduced ? 0 : S.tSec;
    var ds = Math.min(depthZoom(S), 0.56 * adj), dsn = ds / (0.42 * adj), qoff = Math.round(sc * zoom - S.ztx), heroX = Math.round(S.ztx + S.anchorX * zoom);
    var AS = I.ash, SCR = I.scor, BS = I.bas, MG = I.mag, LV = I.lava, x, y, k, o;
    for (x = 0; x < w; x++) { var calm = sm((Math.abs(x - heroX) - (20 * zoom + 8)) / (40 * zoom + 12)); DH[x] = driftAt((x - S.ztx) / zoom + sc) * zoom * calm * 1.3; }
    for (x = 0; x < w; x++) {
      var lip = lipA[x]; if (lip >= h) continue;
      var wxF = (x - S.ztx) / zoom + sc, qx = x + qoff, dh = Math.round(DH[x]);
      if (dh > 0) {                                                    // the dune rises above the lip: its lee face catches the vent's glow, the far side is in shadow
        var slp = DH[Math.min(w - 1, x + 1)] - DH[Math.max(0, x - 1)];
        for (k = 1; k <= dh; k++) {
          var yy = lip - k; if (yy < 0) break;
          var b2 = B4[yy & 3][x & 3], cT;
          if (k === dh) cT = slp > 0.3 ? AS + 6 : (slp < -0.5 ? AS + 3 : AS + 5);
          else if (slp > 0.25) cT = k === dh - 1 ? AS + 5 : AS + 4;
          else if (slp < -0.2) cT = k >= dh - 1 ? AS + 3 : (b2 > 0.1 ? AS + 1 : AS + 2);
          else cT = k === dh - 1 ? AS + 4 : AS + 3;
          d[yy * w + x] = cT;
        }
      }
      var acc = 0, prev = 0, e1 = sn(wxF * 0.0113 + 1.3), e2 = sn(wxF * 0.0071 + 4.1), e3 = sn(wxF * 0.019 + 2.2);
      for (k = 0; k < 6; k++) {
        acc += LT[k];
        var wob = AMP[k] * (0.55 * ((k & 1) ? e1 : e2) + 0.45 * e3 * ((k % 3) ? 1 : -1) + 1.3 * jag(wxF, 26 + 9 * k, 21 + k)) * dsn;
        BND[k] = Math.max(prev + 2, Math.round(acc * ds + wob)); prev = BND[k];
      }
      y = Math.max(0, lip); var dd = y - lip, L = 0; while (L < 6 && dd >= BND[L]) L++;
      var bay, lt, tone, idx, nzv, sw1 = 2 * sn(wxF * 0.03 + 1.7);
      for (; L <= 6 && y < h; L++) {
        var yEnd = L < 6 ? Math.min(h, lip + BND[L]) : h, ls0 = L ? BND[L - 1] : 0, th = (L < 6 ? BND[L] : 400) - ls0;
        if (L === 0) {                                                  // ash surface: mid-dark grey-brown, a warm lit rim, ripples, a rare live ember
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = B4[y & 3][x & 3];
            var rip = (((qx * 3 + (dd << 1)) % 11) + 11) % 11 === 0 ? 0.7 : 0;
            tone = (dd === 0 ? 5.7 : dd === 1 ? 4.6 : 3.5 - dd * 0.25) + (NZ[((qx >> 2) & 255) | ((dd & 255) << 8)] / 255 - 0.5) * 1.3 + bay * 0.55 + rip;
            idx = AS + clamp(Math.floor(tone + 0.5), 1, 6);
            if (dd > 0 && NZ[((qx * 5) & 255) | (((dd + 40) & 255) << 8)] > 251) idx = I.ember;
            d[o] = idx;
          }
        } else if (L === 1) {                                           // laminated ash beds: wavy light / dark strata, pale pumice lapilli
          var sA = 2.6 * sn(qx * 0.05 + 0.6), lastBi = -99999, bh = 0;
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            var fw = lt + sA + 1.6 * sn(qx * 0.13 + lt * 0.04), bi = Math.floor(fw * 0.25), fr = fw - bi * 4;
            if (bi !== lastBi) { lastBi = bi; bh = PX.h2(bi, 55); }
            tone = 1.6 + bh * 1.5 - (lt / th) * 0.6 + bay * 0.5; if (fr < 1) tone += 0.8;
            if (lt === 0) tone += 1.4;
            var ii = (tone + 0.5) | 0; idx = AS + (ii < 0 ? 0 : ii > 5 ? 5 : ii);
            if (lt > 2 && NZ[(((qx >> 1) * 7) & 255) | (((dd >> 1) & 255) << 8)] > 250) idx = ((qx & 1) ? AS + 6 : AS + 5);
            d[o] = idx;
          }
        } else if (L === 2) {                                           // scoria: red-black vesicular rock, pitted, with embers in the pores
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            nzv = VN[((qx >> 1) & 255) | (((dd >> 1) & 255) << 8)] / 255;
            tone = 2.2 + (nzv - 0.5) * 2.0 - (lt / th) * 0.6 + bay * 0.5;
            if (lt === 0) tone += 1.4;
            var ii2 = (tone + 0.5) | 0; idx = SCR + (ii2 < 0 ? 0 : ii2 > 4 ? 4 : ii2);
            var pk = NZ[(((qx >> 1) * 3) & 255) | (((dd >> 1) & 255) << 8) ^ 0x3300];
            if (lt > 2 && pk > 226) idx = ((qx & 1) || (dd & 1)) ? SCR : SCR + 1; else if (lt > 2 && pk > 219 && !(qx & 1) && !(dd & 1)) idx = SCR + 4;
            if (lt > 2 && NZ[((qx * 3) & 255) | (((dd + 90) & 255) << 8)] > 253) idx = LV + ((qx + dd) & 7);
            d[o] = idx;
          }
        } else if (L === 3) {                                           // jointed basalt columns: dark, vertical joints, a lit left edge, joints that glow in the deep
          var cwid = Math.max(9, Math.round(15 * dsn)), deepJ = th * 0.55, lastCc = -99999, ct = 0, gj = 0;
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            var sh = (lt > 26 ? ((lt / 26) | 0) : 0) * 5, cc = Math.floor((qx + sh) / cwid), fxx = qx + sh - cc * cwid, seg = lt > 26 ? 1 : 0, ck = cc * 2 + seg;
            if (ck !== lastCc) { lastCc = ck; ct = PX.h2(cc, 61 + seg); gj = ct > 0.8 && PX.h2(cc, 91) > 0.55 ? 1 : 0; }
            tone = 1.2 + ct * 1.7 + (VN[((qx >> 1) & 255) | (((dd >> 1) & 255) << 8)] / 255 - 0.5) * 0.8 - (lt / th) * 0.3 + bay * 0.5;
            if (fxx === 1) tone += 1.4; else if (fxx >= cwid - 2) tone -= 0.7;
            if (lt === 0) tone += 1.6;
            var ii3 = (tone + 0.5) | 0; idx = BS + (ii3 < 0 ? 0 : ii3 > 4 ? 4 : ii3);
            if (fxx === 0) idx = (gj && lt > deepJ + th * 0.2 && bay + 0.5 < (lt - deepJ - th * 0.2) / (th * 0.25)) ? LV + ((lt + cc) & 7) : (lt > th * 0.8 ? SCR + 1 : BS);
            else if (lt > th * 0.82 && bay + 0.5 < (lt - th * 0.82) / (th * 0.18) * 0.6) idx = SCR + 1 + ((qx + dd) & 1);
            d[o] = idx;
          }
        } else if (L === 4) {                                           // old lava flows: ropey wavy bands, red and black, cracks that still glow
          var sF = 5 * sn(qx * 0.042 + 1.1), lastB = -99999, bh2 = 0, gl2 = 0;
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            var fw2 = lt + sF + 3 * sn(qx * 0.11 + lt * 0.05), bi2 = Math.floor(fw2 * (1 / 7)), fr2 = fw2 - bi2 * 7;
            if (bi2 !== lastB) { lastB = bi2; bh2 = PX.h2(bi2, 77); gl2 = PX.h2(bi2, qx >> 3) > 0.82 ? 1 : 0; }
            tone = 1.6 + bh2 * 1.3 - (lt / th) * 0.6 + bay * 0.5; if (fr2 < 1) tone += 1.4; else if (fr2 > 5.5) tone -= 0.9;
            if (lt === 0) tone += 1.5;
            var ii4 = (tone + 0.5) | 0; if (ii4 < 0) ii4 = 0; else if (ii4 > 4) ii4 = 4;
            idx = bh2 > 0.55 ? SCR + ii4 : BS + ii4;
            if (fr2 < 1 && gl2) idx = LV + ((qx + bi2 * 3) & 7);
            d[o] = idx;
          }
        } else if (L === 5) {                                           // cooled crust plates: black slabs split by glowing joints
          var rowH = Math.max(7, Math.round(10 * dsn)), lastPr = -99999, pw = 20, poff = 0, sgn = 1, lastPc = -99999, tA = 0, tB = 0;
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            var pr = (lt / rowH) | 0, fyy = lt - pr * rowH;
            if (pr !== lastPr) { lastPr = pr; pw = 12 + Math.floor(PX.h2(pr, 3) * 18); poff = Math.floor(PX.h2(pr, 4) * pw); sgn = PX.h2(pr, 6) < 0.5 ? 1 : -1; lastPc = -99999; }
            var shear = sgn * ((fyy * 0.4) | 0), pc = Math.floor((qx + poff + shear) / pw), pf = qx + poff + shear - pc * pw;
            if (pc !== lastPc) { lastPc = pc; tA = PX.h2(pc, pr + 5); tB = PX.h2(pc, pr + 9); }
            tone = 1.3 + tA * 1.6 + bay * 0.5 + (pf < 3 && fyy > 1 ? 0.7 : 0) - (fyy > rowH - 3 ? 0.6 : 0);
            var ii5 = (tone + 0.5) | 0; if (ii5 < 0) ii5 = 0; else if (ii5 > 4) ii5 = 4;
            idx = BS + ii5;
            if (tB > 0.7) idx = SCR + (ii5 > 3 ? 3 : ii5);
            if (fyy === 0 || pf === 0) idx = LV + ((qx + lt * 2 + pc) & 7);
            d[o] = idx;
          }
        } else {                                                        // the magma sea: dark crust plates breaking apart over a molten glow, more lava the deeper you go
          var rowM = Math.max(9, Math.round(14 * dsn)), lastR = -99999, pw2 = 20, po2 = 0, sg2 = 1, lastC = -99999, cA = 0, cB = 0, cCr = 0, lastBm = -99999, bhm = 0, dpk = 170 * ds + 40;
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            var dp = lt / dpk; if (dp > 1) dp = 1;
            var pr2 = (lt / rowM) | 0, fy2 = lt - pr2 * rowM;
            if (pr2 !== lastR) { lastR = pr2; pw2 = 14 + Math.floor(PX.h2(pr2, 13) * 20); po2 = Math.floor(PX.h2(pr2, 14) * pw2); sg2 = PX.h2(pr2, 16) < 0.5 ? 1 : -1; lastC = -99999; }
            var sh2 = sg2 * ((fy2 * 0.4) | 0), pc2 = Math.floor((qx + po2 + sh2) / pw2), pf2 = qx + po2 + sh2 - pc2 * pw2;
            if (pc2 !== lastC) { lastC = pc2; cA = PX.h2(pc2, pr2 + 5); cB = PX.h2(pc2, pr2 + 9); cCr = PX.h2(pc2, pr2 + 17); }
            var crust = cCr > 0.25 + dp * 0.85, gap = 1 + ((dp * 2.4) | 0);
            if (crust && fy2 >= gap && pf2 >= gap) {                    // a plate: dark, its upper-left edge catching the glow, a warm underside
              tone = 1.2 + cA * 1.5 + bay * 0.5 + (fy2 === gap ? 0.9 : 0) - (fy2 > rowM - 3 ? 0.7 : 0);
              var ii6 = (tone + 0.5) | 0; if (ii6 < 0) ii6 = 0;
              idx = cB > 0.6 ? SCR + (ii6 > 3 ? 3 : ii6) : BS + (ii6 > 4 ? 4 : ii6);
              if (dp > 0.5 && fy2 > rowM - 3) idx = SCR + 3;
            } else {
              nzv = VN[((qx >> 2) & 255) | (((dd >> 2) & 255) << 8)] * 0.00392157;
              var fwm = lt + 5 * sn(qx * 0.045 + 0.7) + 3 * sn(qx * 0.12 + lt * 0.05 + pr2), bim = Math.floor(fwm * (1 / 6)), frm = fwm - bim * 6;
              if (bim !== lastBm) { lastBm = bim; bhm = PX.h2(bim, 99); }
              var ii7 = (1.0 + 1.9 * dp + bhm * 1.3 + (nzv - 0.5) * 0.6 + bay * 0.6) | 0; idx = MG + (ii7 < 1 ? 1 : ii7 > 4 ? 4 : ii7);
              if (frm < 1) idx = LV + ((qx + bim * 3 + (dd >> 1)) & 7); else if (frm > 4.7) idx = MG;      // a flowing highlight along each band, a dark crust wrinkle below it
              else if (NZ[((qx * 5) & 255) | ((dd & 255) << 8)] > 252) idx = LV + ((qx + dd * 2) & 7);
            }
            d[o] = idx;
          }
        }
      }
    }
    features(fb, S, ds, heroX, t);
    surface(fb, S, ds, heroX, t);
  };

  // ---------- relics of a buried city, glowing bombs, fumarole veins ----------
  var RELICS = [
    ["..aaaaaa..", ".abbbbbba.", ".abccccba.", ".abbbbbba.", ".abccccba.", ".abbbbbba.", "..aaaaaa.."],                                                  // 0 a broken column drum (pale ash-white)
    ["...aa...", "..abba..", "..abba..", ".abccba.", "abcdccba", "abcdccba", ".abccba.", "..aabb.."],                                                       // 1 amphora
    ["..aaaaaa..", ".abbbbbba.", "abbcccbbba", "abcccccbba", "abc...cbba", "abc...cbba", "aab...baaa"],                                                    // 2 bronze helmet
    ["..aaaaaa..", ".abbbbbba.", "abbcbbcbba", "abbcbbcbba", ".abbbbbba.", "..abccba..", "..a.bb.a.."],                                                   // 3 skull
    ["ab.ba.ab.", ".bcb.bcb.", ".bcbbbcb.", "bcbccbcb.", ".bbccbb..", "..bbbb..."],                                                                        // 4 coin hoard
    [".aaa.....", "abbba....", "abcba..aa", ".abbaaabba", "..abbbbcba", "..abcccbba", "...abbbba.", ".....aaa.."]                                              // 5 curled figure cast in ash
  ];
  var RMAP = null;
  function relic(fb, n, x, y, flip) {
    if (!RMAP) RMAP = [{ a: I.ash + 1, b: I.ash + 4, c: I.ash + 6 }, { a: I.scor + 1, b: I.brz + 1, c: I.brz + 2, d: I.brz + 3 }, { a: I.brz, b: I.brz + 1, c: I.brz + 3 }, { a: I.ash + 1, b: I.ash + 5, c: I.ash }, { a: I.brz, b: I.brz + 2, c: I.brz + 3 }, { a: I.ash + 1, b: I.ash + 4, c: I.ash + 6 }];
    bmp(fb, RELICS[n], RMAP[n], x, y, flip);
  }
  function bomb(fb, cx, cy, r, seed, t) {                               // a volcanic bomb: a dark crust cracked over a molten core
    stone(fb, cx, cy, r * 1.2, r, I.scor, seed, 4);
    var k, len = Math.max(3, Math.round(r * 1.6));
    for (k = 0; k < 3; k++) {
      var ang = (PX.h1(seed * 5 + k) - 0.5) * 2.4 + 1.57, x0 = cx - Math.round(r * 0.6 * (PX.h1(seed + k * 3) - 0.3)), y0 = cy - Math.round(r * 0.5);
      for (var s = 0; s < len; s++) fb.set(x0 + Math.round(Math.cos(ang + s * 0.15) * s * 0.7), y0 + s, I.lava + ((s + k * 3 + seed) & 7));
    }
  }
  function vent(fb, cx, cy, rx, ry, seed) {                             // a lava tube mouth: a black hollow with a molten floor
    var x, y;
    for (y = -ry - 1; y <= ry + 1; y++) for (x = -rx - 1; x <= rx + 1; x++) {
      var e = (x * x) / ((rx + 1) * (rx + 1)) + (y * y) / ((ry + 1) * (ry + 1)); if (e > 1) continue;
      var ei = (x * x) / (rx * rx) + (y * y) / (ry * ry), c;
      if (ei > 1) c = (y < 0 && x < rx * 0.4) ? I.scor + 4 : (y < 0 ? I.scor + 2 : I.scor);
      else { var g = (y + ry) / (ry * 2); c = g > 0.72 ? I.lava + ((x + seed + 8 * 3) & 7) : g > 0.55 ? ((B4[(cy + y) & 3][(cx + x) & 3] + 0.5 < (g - 0.55) / 0.17) ? I.mag + 2 : I.mag) : I.ink; }
      fb.set(cx + x, cy + y, c);
    }
  }
  function oldStone(fb, cx, cy, r) {                                    // a stone lost long ago, sealed in the old flows: pale ash-grey, cracked, its edge lit by the lava around it
    var w = fb.w, h = fb.h, d = fb.d, x, y, R2 = r * 2.2;
    for (y = -Math.ceil(R2); y <= Math.ceil(R2); y++) for (x = -Math.ceil(R2); x <= Math.ceil(R2); x++) {
      var px = cx + x, py = cy + y; if (px < 0 || py < 0 || px >= w || py >= h) continue;
      var q = 1 - (x * x + y * y) / (R2 * R2); if (q <= 0 || B4[py & 3][px & 3] + 0.5 > q * 1.1) continue;
      var v = d[py * w + px]; if ((v >= I.bas && v <= I.bas + 4) || (v >= I.scor && v <= I.scor + 4)) d[py * w + px] = I.mag + (q > 0.55 ? 2 : 1);
    }
    for (y = -r; y <= r; y++) for (x = -r; x <= r; x++) {
      var d2 = x * x + y * y; if (d2 > r * r) continue;
      var lit = (-(x * 0.7 + y * 0.7)) / r, tone = lit > 0.5 ? 6 : lit > 0.1 ? 5 : lit > -0.35 ? 4 : 3;
      if (d2 > (r - 1) * (r - 1)) tone = lit > 0.3 ? 5 : 2;
      if (Math.abs(x - Math.round(y * 0.45) - 1) < 1 && y > -r * 0.7 && y < r * 0.55) tone = 0;
      fb.set(cx + x, cy + y, I.ash + tone);
    }
  }
  function features(fb, S, ds, heroX, t) {
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, sc = S.scroll, lipA = S.lip, a = S.adj || 1, c, r, kk;
    var wl = (0 - S.ztx) / zoom + sc, wr = (w - S.ztx) / zoom + sc, keep = clamp((S.zoom / a - 0.08) / 0.34, 0.3, 1);
    function sx(wx) { return Math.round(S.ztx + (wx - sc) * zoom); }
    function lipAt(x) { return lipA[clamp(x, 0, w - 1)]; }
    var CS = [0, 14, 64, 110, 242, 326, 372];                            // depth (du) where each bed starts
    // stones and bombs: basalt boulders, scoria lumps, glowing bombs in the ash and scoria
    var cw = 30, chh = 24;
    for (c = Math.floor(wl / cw) - 1; c <= Math.ceil(wr / cw) + 1; c++) for (r = 1; r < 24; r++) {
      var du = r * chh + PX.h2(c, r + 43) * chh, hh = PX.h2(c * 3 + 1, r * 5 + 2), pr;
      if (du < 24) continue;
      pr = du < 110 ? 0.08 : du < 242 ? 0.04 : du < 372 ? 0.05 : 0.02;
      if (hh > pr * keep) continue;
      var px = sx(c * cw + PX.h2(c, r + 41) * cw); if (px < -10 || px > w + 10) continue;
      var py = Math.round(lipAt(px) + du * ds); if (py < -8 || py > h + 8) continue;
      var rad = Math.max(1.6, (2.4 + 3.6 * PX.h2(c, r + 47)) * ds * 1.55);
      if (du < 110 && PX.h2(c, r + 51) < 0.4) bomb(fb, px, py, rad * 1.1, c * 5 + r, t);
      else stone(fb, px, py, rad * 1.25, rad, du < 110 ? I.scor : (du < 372 ? I.bas : I.scor), c * 13 + r, du < 372 ? 4 : 4);
    }
    // relics of a buried city in the ash beds and the scoria
    var rc = 150;
    for (c = Math.floor(wl / rc) - 1; c <= Math.ceil(wr / rc) + 1; c++) for (r = 0; r < 2; r++) {
      if (PX.h2(c * 5 + r, 181) < 1 - 0.3 * keep) continue;
      var rx = sx(c * rc + PX.h2(c, r + 182) * rc), rdu = 30 + r * 46 + PX.h2(c, r + 183) * 44; if (rx < -16 || rx > w + 16) continue;
      var ry = Math.round(lipAt(rx) + rdu * ds); if (ry < -12 || ry > h + 4) continue;
      relic(fb, [0, 0, 3, 3, 5, 1, 1, 2, 4][Math.floor(PX.h2(c, r + 184) * 9) % 9], rx, ry, PX.h2(c, r + 185) > 0.5);
    }
    var oc = 210;                                                        // an old stone, rarely, sealed in the flows
    for (c = Math.floor(wl / oc) - 1; c <= Math.ceil(wr / oc) + 1; c++) {
      if (PX.h2(c, 261) < 0.86) continue;
      var ox = sx(c * oc + PX.h2(c, 262) * oc), oy = Math.round(lipAt(ox) + (250 + 70 * PX.h2(c, 263)) * ds); if (ox < -16 || ox > w + 16 || oy < -14 || oy > h + 14) continue;
      oldStone(fb, ox, oy, Math.max(6, Math.round(12 * ds * 1.7)));
    }
    // lava veins: glowing cracks welling up from the magma through the basalt and old flows; the palette cycle makes the glow travel up them
    var vc = 96;
    for (c = Math.floor(wl / vc) - 1; c <= Math.ceil(wr / vc) + 1; c++) {
      if (PX.h2(c, 131) < 1 - 0.38 * keep) continue;
      var vx = sx(c * vc + PX.h2(c, 132) * vc), vy0 = lipAt(vx) + (300 + 90 * PX.h2(c, 133)) * ds; if (vx < -40 || vx > w + 40) continue;
      var len = Math.round((56 + 110 * PX.h2(c, 134)) * Math.max(0.7, ds * 1.5)), ang = -1.57 + (PX.h2(c, 135) - 0.5) * 1.2, xx = vx, yy = vy0, th2 = 1 + Math.floor(PX.h2(c, 136) * 2), s0 = Math.floor(PX.h2(c, 137) * 8);
      for (kk = 0; kk < len; kk++) {
        ang += (PX.h2(c, kk + 720) - 0.5) * 0.5; ang = clamp(ang, -2.5, -0.65);
        xx += Math.cos(ang) * 0.9; yy += Math.sin(ang) * 0.9;
        var ix = Math.round(xx), iy = Math.round(yy); if (iy < lipAt(ix) + 8 * ds) break;
        var ci = I.lava + ((kk + s0) & 7);
        fb.set(ix, iy, ci); if (th2 > 1 || kk % 3 === 0) fb.set(ix + 1, iy, I.lava + ((kk + s0 + 2) & 7));
        if (kk > 10 && kk % 17 === 0 && PX.h2(c, kk + 800) > 0.45) { var bx = ix, by = iy, bd = PX.h2(c, kk + 810) < 0.5 ? -1 : 1; for (var bs = 1; bs < 10; bs++) { bx += bd; by -= (bs & 1); fb.set(bx, by, I.lava + ((bs + s0 + 3) & 7)); } }
      }
    }
    // lava tubes: black mouths with a molten floor in the basalt
    var tc = 520;
    for (c = Math.floor(wl / tc) - 1; c <= Math.ceil(wr / tc) + 1; c++) {
      if (PX.h2(c, 201) < 1 - 0.6 * keep || zoom / a < 0.16) continue;
      var tx = sx(c * tc + (0.2 + 0.6 * PX.h2(c, 202)) * tc), ty = Math.round(lipAt(tx) + (168 + 60 * PX.h2(c, 203)) * ds); if (tx < -30 || tx > w + 30 || ty < -20 || ty > h + 20) continue;
      var trx = Math.max(7, Math.round((15 + 7 * PX.h2(c, 204)) * ds * 1.4)); vent(fb, tx, ty, trx, Math.max(4, Math.round(trx * 0.5)), c);
    }
  }

  // ---------- the lip: dead trees, basalt blocks, glowing surface cracks, steam vents; kept clear of the hero ----------
  function deadTree(fb, bx, by, hpx, seed) {                             // a charred trunk with a few snapped boughs, rim-lit orange on the vent side
    var k, tw = Math.max(1, Math.round(hpx * 0.06)), y, x, dir = PX.h1(seed * 3 + 1) > 0.5 ? 1 : -1;
    for (y = 0; y < hpx; y++) { var lean = Math.round(Math.sin(y * 0.18 + seed) * 1.2), half = Math.max(0, tw - (y > hpx * 0.75 ? 1 : 0)); for (x = -half; x <= half; x++) fb.set(bx + lean + x, by - y, x < 0 ? I.scor + 3 : (x === half ? I.ink : I.near + 1)); }
    for (k = 0; k < 4; k++) {
      var y0 = Math.round(hpx * (0.35 + k * 0.15)), sd = ((k + seed) & 1) ? 1 : -1, len = Math.max(3, Math.round(hpx * (0.22 - k * 0.03)));
      for (var s = 1; s <= len; s++) fb.set(bx + sd * (tw + s), by - y0 - (s >> 1), s === 1 ? I.near + 1 : (sd < 0 ? I.scor + 2 : I.near));
    }
  }
  function surface(fb, S, ds, heroX, t) {
    var w = fb.w, h = fb.h, zoom = S.zoom, sc = S.scroll, lipA = S.lip, a = S.adj || 1, c, kk, thin = clamp((S.zoom / a) / 0.28, 0.22, 1);
    var wl = (0 - S.ztx) / zoom + sc, wr = (w - S.ztx) / zoom + sc;
    function sx(wx) { return Math.round(S.ztx + (wx - sc) * zoom); }
    function lipAt(x) { return lipA[clamp(x, 0, w - 1)]; }
    var cw = 34;                                                         // basalt blocks and cinders on the ash
    for (c = Math.floor(wl / cw) - 1; c <= Math.ceil(wr / cw) + 1; c++) {
      if (PX.h1(c * 5 + 401) > 0.55 * thin) continue;
      var px = sx(c * cw + PX.h1(c * 7 + 403) * cw); if (px < -6 || px > w + 6 || Math.abs(px - heroX) < 22 * zoom + 8) continue;
      var rad = Math.max(1.4, (2 + 3.4 * PX.h1(c * 11 + 405)) * zoom * 1.5);
      stone(fb, px, lipAt(px) - Math.round(rad * 0.4) + 1, rad * 1.3, rad, PX.h1(c * 13 + 407) < 0.5 ? I.scor : I.bas, c, 4);
    }
    var kc = 55;                                                         // surface cracks that still glow
    for (c = Math.floor(wl / kc) - 1; c <= Math.ceil(wr / kc) + 1; c++) {
      if (PX.h1(c * 13 + 421) < 1 - 0.45 * thin) continue;
      var kx = sx(c * kc + PX.h1(c * 5 + 423) * kc); if (kx < -4 || kx > w + 4 || Math.abs(kx - heroX) < 26 * zoom + 8) continue;
      var ky = lipAt(kx) + 2, len = Math.max(4, Math.round((16 + PX.h1(c * 11 + 425) * 28) * ds)), cxp = kx, s0 = Math.floor(PX.h1(c * 3 + 427) * 8);
      for (kk = 0; kk < len; kk++) {
        if (PX.h2(c, kk + 300) < 0.34) cxp += PX.h2(c, kk + 500) < 0.5 ? -1 : 1;
        fb.set(cxp, ky + kk, I.lava + ((kk + s0) & 7));
      }
    }
    var dc = 380;                                                        // charred dead trees
    for (c = Math.floor(wl / dc) - 1; c <= Math.ceil(wr / dc) + 1; c++) {
      if (PX.h1(c * 5 + 431) > 0.5 * thin) continue;
      var tx = sx(c * dc + PX.h1(c * 7 + 433) * dc * 0.8); if (tx < -14 || tx > w + 14 || Math.abs(tx - heroX) < 46 * zoom + 20) continue;
      deadTree(fb, tx, lipAt(tx) + 2, Math.max(12, Math.round((54 + 34 * PX.h1(c * 11 + 435)) * zoom * 1.35)), c);
    }
    if (!S.reduced) {                                                    // steam vents: little plumes of pale smoke feeding upward
      var fc = 210;
      for (c = Math.floor(wl / fc) - 1; c <= Math.ceil(wr / fc) + 1; c++) {
        if (PX.h1(c * 5 + 441) > 0.5 * thin) continue;
        var fx = sx(c * fc + PX.h1(c * 7 + 443) * fc); if (fx < -6 || fx > w + 6 || Math.abs(fx - heroX) < 30 * zoom + 12) continue;
        var by0 = lipAt(fx);
        for (kk = 0; kk < 7; kk++) {
          var ph = ((t * 0.55 + kk / 7 + PX.h1(c * 3 + 445)) % 1), yy = by0 - Math.round(ph * 22 * Math.max(0.8, zoom * 2)), xx = fx + Math.round(Math.sin(ph * 5 + kk) * 2 + ph * 4), sz = ph < 0.5 ? 1 : 2;
          if (B4[yy & 3][xx & 3] + 0.5 > 1 - ph * 0.9) continue;
          fb.set(xx, yy, I.ash + 5); if (sz > 1) fb.set(xx + 1, yy, I.ash + 4);
        }
        fb.set(fx, by0 - 1, I.lava + ((fx + Math.floor(t * 4)) & 7));
      }
    }
  }

  // ---------- front: ash falling in three depths, embers rising from the glow, and the vent's slow eruptions ----------
  var FT = { t: -1, sc: 0, wx: 0, gx: 0, gy: 0 };
  function eruption(t) { var ph = (t % 47) / 47; return ph < 0.2 ? Math.pow(Math.sin(ph / 0.2 * Math.PI), 2) : 0; }   // 0..1: a burst every ~47 s
  R.front = function (fb, S, pal) {
    var w = fb.w, h = fb.h, d = fb.d, lipA = S.lip, zoom = S.zoom, wg = clamp01(S.windGust || 0), a = S.adj || 1, i;
    var dt = FT.t < 0 ? 0 : clamp(S.tSec - FT.t, 0, 0.1); FT.t = S.tSec; var dsc = clamp(S.scroll - FT.sc, -40, 40); FT.sc = S.scroll;
    if (S.reduced) dt = 0;
    FT.wx += dt * (10 + wg * 90); FT.gx += dsc * zoom; FT.gy += dsc * zoom * S.slope;
    var t = S.reduced ? 0 : S.tSec, zp = clamp01((S.altitude - 7450) / 1500), dens = clamp01(0.45 + 0.4 * Math.sin(zp * 3.1) + 0.2 * wg), E = eruption(t);
    var A = clamp(S.w * S.h / 144000, 0.4, 3), n0 = Math.round(220 * A), n1 = Math.round(120 * A), n2 = Math.round(40 * A), mX = 12, spanX = w + 2 * mX, spanY = h + 2 * mX;
    var LAY = [[0, n0, 14, 0.5, 0.2, I.ash + 3, 1, 1], [n0, n1, 26, 0.9, 0.5, I.ash + 5, 1, 2], [n0 + n1, n2, 46, 1.6, 1.1, I.ash + 6, 2, 4]];
    var tot = n0 + n1 + n2;
    for (var li = 0; li < 3; li++) {
      var Ly = LAY[li], base = Ly[0], cnt = Math.round(Ly[1] * (dens + E * 0.4)), fall = Ly[2], wf = Ly[3], par = Ly[4], col = Ly[5], sz = Ly[6], wob = Ly[7];
      for (i = 0; i < cnt; i++) {
        var j = base + i, v = 0.75 + 0.5 * PX.h1(j * 11 + 29);
        var fx = PX.h1(j * 3 + 11) * spanX - FT.wx * wf * v - FT.gx * par + Math.sin(t * 1.1 * v + PX.h1(j * 7 + 23) * 6.283) * wob;
        var fy = PX.h1(j * 5 + 17) * spanY + t * fall * v + FT.gy * par;
        fx = ((fx % spanX) + spanX) % spanX - mX; fy = ((fy % spanY) + spanY) % spanY - mX;
        var px = Math.round(fx), py = Math.round(fy);
        if (px < 0 || px >= w || py < 0 || py >= h || py > lipA[px] + (sz > 1 ? 2 : 0)) continue;
        var o = py * w + px, bgv = d[o], hot = (bgv >= I.sky + 6 && bgv <= I.sky + 13) || (bgv >= I.cloud + 4 && bgv <= I.cloud + 6) || bgv >= I.ash + 5 && bgv <= I.ash + 6, fc = hot ? I.near + 1 : col;
        d[o] = fc;
        if (sz > 1) { if (px + 1 < w) d[o + 1] = hot ? I.near + 2 : I.ash + 4; if (py + 1 < h) d[o + w] = hot ? I.near + 2 : I.ash + 4; }
      }
    }
    var ne = Math.round((14 + E * 26) * clamp(S.w / 480, 0.5, 1.4));                   // embers lifting off the fields, more during an eruption
    for (i = 0; i < ne; i++) {
      var sp = 9 + 16 * PX.h1(i * 7 + 3), ph = ((t * sp / (h * 0.9) + PX.h1(i * 5 + 1)) % 1), ex = PX.h1(i * 11 + 5) * (w + 40) - 20 - FT.gx * 0.6 + Math.sin(t * 1.3 + i * 2.1) * (3 + ph * 6) - ph * 24 * (0.5 + wg);
      ex = ((ex % (w + 40)) + (w + 40)) % (w + 40) - 20;
      var ey = lipA[clamp(Math.round(ex), 0, w - 1)] - ph * h * 0.85 - 2;
      var epx = Math.round(ex), epy = Math.round(ey); if (epx < 0 || epx >= w || epy < 0 || epy >= h) continue;
      var life = 1 - ph, ci = life > 0.6 ? 2 : life > 0.3 ? 1 : 0;
      d[epy * w + epx] = I.ember + ci; if (life > 0.5 && ((i + Math.floor(t * 8)) & 1) && epy + 1 < h) d[(epy + 1) * w + epx] = I.ember;
    }
  };

  V8.register("volcanic", R);
})(typeof window !== "undefined" ? window : this);
