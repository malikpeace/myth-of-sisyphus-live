// Obsidian - V8 zone scene (11950-13450 m). A deep blue night with two crescent moons (they drift on slow arcs as the fields are crossed)
// over a plain of black glass that mirrors the whole sky (brighter at grazing angles, dimmer with distance), a faceted glass mountain range,
// three ranks of crystalline black shards (prisms, blades, flat-topped chunks; facets lit toward the moons, hard cyan-white rim light, glints
// that twinkle by palette cycling) and their reflections. The ground is a cut through polished volcanic glass: a mirror-bright crust with
// long light streaks, faceted planes, flow-banded glass with mahogany swirls and rainbow sheen, snowflake spherulites, shatter points,
// crystal pockets, and a violet glow rising from far below; blades, skulls, rings and (rarely) an old stone are sealed in bubbles of glass.
(function (root) {
  "use strict";
  var PX = root.PX, Sc = root.Sc, V8 = root.V8, hex = PX.hex, clamp = PX.clamp, clamp01 = PX.clamp01, B4 = PX.BAYER4;
  var R = { rock: { mat: "obsidian", style: "granite" }, noBirds: true, thumb: { alt: 0, zoom: 0.74, slope: 0.02, ratio: 0.7, f: 3 } };
  var I = {}, ST = {}, built = "", STAR0 = null, GL0 = null, MD = new Uint8Array(256), MD1 = new Uint8Array(256), MD2 = new Uint8Array(256);
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
    I.sky = pal.ramp("sky", H(["#04061a", "#060a22", "#080f2c", "#0b1638", "#0f1f47", "#142b58", "#1a3a69", "#214a79", "#2a5b87", "#356d92", "#43809a", "#5b95a5", "#79aab0", "#9cc0bd"]));
    STAR0 = H(["#5d6fa0", "#9db2dc", "#dbe8ff", "#ffffff"]);
    I.star = pal.ramp("star", STAR0);
    I.moon = pal.ramp("moon", H(["#7fa8c8", "#b7dcee", "#e6f6fb", "#ffffff"]));
    I.moon2 = pal.ramp("moon2", H(["#8c7fc0", "#bdb0ea", "#e5dcff"]));
    I.far = pal.ramp("far", H(["#0e2036", "#15304c", "#1d4262", "#2a5878"]));
    I.mid = pal.ramp("mid", H(["#070d1c", "#0b1428", "#101d38", "#182a4c", "#243d62", "#37587e"]));
    I.near = pal.ramp("near", H(["#03040c", "#060814", "#0a0e20", "#101632", "#1a2244", "#2a3a66", "#4a6a94"]));
    GL0 = H(["#36c8dc", "#8ff0ff", "#ffffff", "#8ff0ff", "#36c8dc", "#1e7ea0"]);
    I.gl = pal.ramp("gl", GL0);
    I.obs = pal.ramp("obs", H(["#03030a", "#07061a", "#0c0a26", "#141036", "#1e1848", "#2c2560", "#403880", "#5c52a4"]));
    I.sheen = pal.ramp("sheen", H(["#0c2a3a", "#134860", "#1d6c88", "#2f95b0", "#5cc6d6", "#a4ecf2", "#e8ffff"]));
    I.mah = pal.ramp("mah", H(["#241010", "#3e1a16", "#5e281c", "#84402a", "#a85e3a"]));
    I.dg = pal.ramp("dg", H(["#1c0a3a", "#341068", "#55198f", "#7d26b8", "#a63fd8", "#d572f0"]));
    I.gold = pal.ramp("gold", H(["#5a4520", "#8f6f2c", "#c9a03e", "#f0d068"]));
    I.bone = pal.ramp("bone", H(["#5c5a6a", "#8c8a9c", "#c0bfce", "#e8e8f2"]));
    I.ink = pal.ramp("ink", H(["#020208"]));
    buildTables(pal);
    var i, k; for (i = 0; i < 256; i++) { MD1[i] = DRK[i]; MD2[i] = DRK[DRK[i]]; MD[i] = DRK[DRK[DRK[i]]]; }     // mirror: 1 / 2 / 3 steps darker along every ramp (brighter at grazing angles)
    R.birdIdx = I.sheen + 5; R.watcherIdx = I.sheen + 4;
    R.footprint = { col: I.obs + 3, hi: I.sheen + 4 };                  // a scuff in the glass with a bright lit rim
    R.markerIdx = { c0: I.obs + 2, c1: I.obs + 5, c2: I.sheen + 5, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };   // cairns of black glass with a cyan edge
    R.pal = pal; RMAP = null;
    built = "";
    build(S);
  };

  // ---------- crystalline shards: hexagonal prisms with pyramid tips, leaning; a lit left face, a dark right face, a bright ridge line ----------
  // o: L, H, seed, ramp, n, rim (palette idx), base (y of the standing line), hMin, hMax, ws (width scale), spread (cluster width px), gap, glint (density), fade (idx), fadeRows
  function shardStrip(o) {
    var L = o.L, Hh = o.H, st = Sc.newStrip(L, Hh), d = st.d, rnd = PX.rng(o.seed), P = o.ramp, n = o.n, shards = [], x = rnd() * 30, i, t, px, k;
    while (x < L) {
      var nc = 2 + Math.floor(rnd() * 4), cw = o.spread * (0.7 + 0.6 * rnd());
      for (i = 0; i < nc; i++) {
        var main = i === (nc >> 1), kr = rnd(), kind = kr < (o.blade || 0) ? 1 : (kr < (o.blade || 0) + (o.chunk || 0) ? 2 : 0), hh = o.hMin + (o.hMax - o.hMin) * Math.pow(rnd(), 1.2) * (main ? 1 : 0.62), bwd = (2.2 + rnd() * 4.6) * o.ws * (main ? 1.3 : 1), ln = (rnd() - 0.5) * 0.55, tp = 0.16 + rnd() * 0.14;
        if (kind === 1) { bwd = (1.4 + rnd() * 1.8) * o.ws; hh = hh * 1.12; ln = (rnd() < 0.5 ? -1 : 1) * (0.22 + rnd() * 0.3); tp = 0.14; }
        else if (kind === 2) { bwd = (5 + rnd() * 6) * o.ws; hh = o.hMin + (o.hMax - o.hMin) * (0.16 + 0.3 * rnd()); tp = 0.05; }
        shards.push({ bx: x + cw * (0.5 + (rnd() - 0.5) * 0.9), bw: bwd, h: hh, lean: ln, ridge: (rnd() - 0.3) * 0.8, tip: tp, ph: rnd() * TAU, flat: kind === 2 });
      }
      x += cw + o.gap * (0.4 + 1.2 * rnd());
    }
    shards.sort(function (p, q) { return p.bw * 3 + p.h * 0.1 - (q.bw * 3 + q.h * 0.1); });
    var glints = [];
    for (i = 0; i < shards.length; i++) {
      var s = shards[i], base = o.base + Math.round((rnd() - 0.5) * 3), hh2 = Math.round(s.h), cx0 = s.bx;
      for (t = 0; t <= hh2; t++) {
        var u = t / hh2, hw = u < 1 - s.tip ? s.bw * (1 - 0.1 * u) : (s.flat ? s.bw * 0.9 : s.bw * 0.9 * (1 - (u - (1 - s.tip)) / s.tip) + 0.3), c = cx0 + s.lean * t, xl = c - hw, xr = c + hw, rx = c + s.ridge * hw;
        var y = base - t; if (y < 0 || y >= Hh) continue;
        for (px = Math.round(xl); px <= Math.round(xr); px++) {
          var lf = px < rx, tone;
          if (lf) tone = 0.62 * (n - 1) + 0.9 * (1 - (rx - px) / Math.max(1, rx - xl)) + u * 0.9;
          else tone = 0.2 * (n - 1) - 0.8 * ((px - rx) / Math.max(1, xr - rx)) + u * 0.6;
          if (u > 1 - s.tip) tone += s.flat ? 1.4 : (lf ? 0.7 : 0.3);
          if (t < 5) tone -= (5 - t) * 0.25;
          if ((t + Math.floor(s.ph * 3)) % 8 === 0) tone -= 0.9;                                   // growth striations
          if (lf && (((px * 2 + t) % 21) === 0)) tone += 1.5;                                        // a specular streak
          var idx = P + clamp(Math.floor(tone + B4[y & 3][((px % L) + L) % 4] * 0.7 + 0.5), 0, n - 1);
          if (px === Math.round(xl) && t > 2) idx = o.rim;                                            // hard rim light on the moon-facing edge
          else if (px === Math.round(rx) && t > 4 && u < 1 - s.tip * 0.5) idx = P + n - 2;            // the bright ridge between the faces
          d[y * L + (((px % L) + L) % L)] = idx;
        }
      }
      if (o.glint && rnd() < o.glint) glints.push({ x: Math.round(cx0 + s.lean * hh2 * (0.7 + 0.3 * rnd())), y: base - Math.round(hh2 * (0.75 + 0.22 * rnd())), k: Math.floor(rnd() * 6) });
    }
    for (i = 0; i < glints.length; i++) {                                // sharp glints on lit edges and tips: a cross of cycling cyan-white pixels
      var g = glints[i], gx = ((g.x % L) + L) % L;
      for (k = -2; k <= 2; k++) { if (g.y >= 0 && g.y < Hh) d[g.y * L + (((gx + k) % L + L) % L)] = I.gl + ((g.k + Math.abs(k)) % 6); if (g.y + k >= 0 && g.y + k < Hh) d[(g.y + k) * L + gx] = I.gl + ((g.k + Math.abs(k)) % 6); }
      d[g.y * L + gx] = I.gl + 2;
    }
    if (o.fade) for (var y2 = 0; y2 < o.fadeRows; y2++) {
      var ry = Hh - 1 - y2, amt = 1 - y2 / o.fadeRows;
      for (x = 0; x < L; x++) if ((B4[ry & 3][x & 3] + 0.5) < amt) d[ry * L + x] = o.fade;
    }
    st.base = o.base; return st;
  }

  // ---------- a range of broad glass mountains: sharp peaks split into slanting facets, lit toward the moons ----------
  function facetRange(o) {
    var L = o.L, Hh = o.H, st = Sc.newStrip(L, Hh), d = st.d, rnd = PX.rng(o.seed), P = o.ramp, n = o.n, x, y, k, crest = new Float32Array(L), waves = [], cnt = [4, 9, 21];      // whole periods per strip: seamless tiling
    for (k = 0; k < cnt.length; k++) waves.push({ c: cnt[k], a: Math.pow(0.5, k), ph: rnd() });
    for (x = 0; x < L; x++) { var s = 0, ws = 0; for (k = 0; k < waves.length; k++) { var f = (x * waves[k].c / L + waves[k].ph) % 1; s += waves[k].a * Math.abs(f * 2 - 1); ws += waves[k].a; } crest[x] = o.base - o.amp * (s / ws - 0.3) * 1.4; }
    for (x = 0; x < L; x++) {
      var sl = (crest[(x + 2) % L] - crest[(x + L - 2) % L]) / 4, lit = sl < -0.02, ci = Math.round(crest[x]);
      for (y = Math.max(0, ci); y < Hh; y++) {
        var dd = y - ci, xs = (((x - Math.round(dd * (lit ? -0.55 : 0.55))) % L) + L) % L, sl2 = (crest[(xs + 2) % L] - crest[(xs + L - 2) % L]) / 4, lit2 = sl2 < -0.02, fb = Math.floor(xs / 9);
        var t = (lit2 ? 0.62 : 0.2) * (n - 1) + (PX.h2(fb, o.seed) - 0.5) * 0.9 - (dd / Hh) * 0.5 * (n - 1) + B4[y & 3][x & 3] * 0.7;
        if (dd === 0) t = lit2 ? n - 1 : 0.4 * (n - 1);
        d[y * L + x] = P + clamp(Math.floor(t + 0.5), 0, n - 1);
      }
    }
    if (o.fade) for (y = 0; y < o.fadeRows; y++) { var ry = Hh - 1 - y, amt = 1 - y / o.fadeRows; for (x = 0; x < L; x++) if ((B4[ry & 3][x & 3] + 0.5) < amt) d[ry * L + x] = o.fade; }
    st.base = o.base; return st;
  }

  // a vertically flipped, darkened copy of a strip standing on the mirror plain (fainter with distance from the standing line)
  function reflect(fb, st, offX, yb, maxRows) {
    var w = fb.w, h = fb.h, d = fb.d, sw = st.w, sh = st.h, sd = st.d, ox = ((Math.floor(offX) % sw) + sw) % sw, r, x;
    for (r = 0; r < sh; r++) {
      var dist = (sh - 1 - r) + 1, y = yb + dist; if (y < 0 || y >= h || dist > maxRows) continue;
      var amt = 1 - dist / (maxRows + 1), srow = r * sw, row = y * w, sx = ox;
      for (x = 0; x < w; x++) {
        var v = sd[srow + sx]; if (++sx === sw) sx = 0;
        if (v && B4[y & 3][x & 3] + 0.5 < amt * 1.15) d[row + x] = dist < 8 ? MD1[v] : (dist < 24 ? MD2[v] : MD[v]);
      }
    }
  }

  function build(S) {
    var key = S.w + "x" + S.h + "@" + (S.adj || 1); if (built === key) return; built = key; ST.skyKey = "";
    var a = S.adj || 1, hy = S.horizonY;
    function A(v) { return Math.max(1, Math.round(v * a)); }
    ST.a = a;
    ST.range = facetRange({ L: 1500, H: Math.round(hy * 0.34), seed: 5, ramp: I.far, n: 4, base: Math.round(hy * 0.19), amp: hy * 0.15, fade: I.far, fadeRows: A(5) });
    ST.far = shardStrip({ L: 1300, H: Math.round(hy * 0.42), seed: 3, ramp: I.far, n: 4, rim: I.sheen + 3, base: Math.round(hy * 0.42) - 1, hMin: hy * 0.08, hMax: hy * 0.34, ws: 0.9 * a, spread: 60 * a, gap: 50 * a, glint: 0.25, blade: 0.25, chunk: 0.1, fade: I.far, fadeRows: A(4) });
    ST.mid = shardStrip({ L: 1150, H: Math.round(hy * 0.66), seed: 7, ramp: I.mid, n: 6, rim: I.sheen + 4, base: Math.round(hy * 0.66) - 1, hMin: hy * 0.10, hMax: hy * 0.62, ws: 1.35 * a, spread: 80 * a, gap: 90 * a, glint: 0.5, blade: 0.2, chunk: 0.16, fade: I.mid, fadeRows: A(4) });
    ST.near = shardStrip({ L: 950, H: Math.round(hy * 0.5), seed: 13, ramp: I.near, n: 7, rim: I.sheen + 5, base: Math.round(hy * 0.5) - 1, hMin: hy * 0.10, hMax: hy * 0.46, ws: 2.0 * a, spread: 70 * a, gap: 150 * a, glint: 0.7, blade: 0.2, chunk: 0.2 });
  }

  function moons(S) {                                                    // both moons drift on slow arcs while the glass fields are crossed (11950 -> 13450 m)
    var a = S.adj || 1, hy = S.horizonY, sh = Math.round((1 - S.openingT) * S.h * 0.04), r1 = Math.round(clamp(S.h / a * 0.05, 11, 20) * a), r2 = Math.max(4, Math.round(r1 * 0.55));
    var mp = sm((S.altitude - 11950) / 1500), arc = Math.sin(Math.PI * mp);
    return { x1: Math.round(S.w * (0.17 + 0.2 * mp)), y1: Math.round(hy * (0.36 - 0.11 * arc)) + sh, r1: r1, x2: Math.round(S.w * (0.6 - 0.2 * mp)), y2: Math.round(hy * (0.15 + 0.04 * arc)) + sh, r2: r2 };
  }
  R.light = function (S) { var m = moons(S); return { x: m.x1, y: m.y1, k: 0.68, col: [150, 226, 255], ambient: [34, 48, 104], bright: 0.55, ground: [34, 44, 92] }; };

  R.palette = function (pal, S) {                                        // stars twinkle; glints cycle out of step; the sky's cold glow drifts very slowly
    var t = S.reduced ? 0 : S.tSec, i;
    pal.setRamp("star", STAR0.map(function (c, k) { var f = 0.7 + 0.3 * Math.sin(t * (1.3 + k * 0.7) + k * 2.1); return [c[0] * f, c[1] * f, c[2] * f]; }));
    var ph = Math.floor(t * 4) % 6, rot = []; for (i = 0; i < 6; i++) rot.push(GL0[(i + ph) % 6]);
    pal.setRamp("gl", rot);
  };

  function crescent(fb, cx, cy, r, ramp, earth, lit) {                  // a thin crescent lit on the left, with faint earthshine on the dark part
    var w = fb.w, h = fb.h, d = fb.d, ox = r * 0.46, oy = -r * 0.18, r2 = r * 0.94, x, y;
    for (y = cy - r - 1; y <= cy + r + 1; y++) for (x = cx - r - 1; x <= cx + r + 1; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      var dx = x - cx + 0.5, dy = y - cy + 0.5, dist = Math.sqrt(dx * dx + dy * dy); if (dist > r) continue;
      var ex = dx - ox, ey = dy - oy, inner = Math.sqrt(ex * ex + ey * ey), o = y * w + x;
      if (inner < r2) { if (earth && inner > r2 - 1.4) d[o] = ramp; else if (earth) d[o] = LIT[d[o]]; continue; }
      var edge = inner - r2;
      d[o] = dist > r - 1.1 ? ramp + 1 : (edge < 1.2 ? ramp + lit - 1 : (edge < 3 ? ramp + lit - 1 : ramp + lit));
    }
  }

  R.backdrop = function (fb, S, pal) {
    build(S);
    var w = fb.w, h = fb.h, d = fb.d, a = S.adj || 1, sh = Math.round((1 - S.openingT) * S.h * 0.12), hy = S.horizonY + sh, al = S.altitude, t = S.reduced ? 0 : S.tSec, i, x, y;
    function A(v) { return Math.round(v * a); }
    var m = moons(S), skey = w + "x" + h + "|" + hy + "|" + m.x1 + "," + m.y1 + "|" + m.r1;
    if (ST.skyKey !== skey || !ST.sky || ST.sky.length !== w * h) {
      var idx = []; for (i = 0; i < 14; i++) idx.push(I.sky + i);
      Sc.bands(fb, 0, hy + A(2), idx, 4);
      lift(fb, m.x1, m.y1, Math.round(m.r1 * 7), Math.round(m.r1 * 5.5), 3.0, I.sky, I.sky + 13);
      lift(fb, m.x2, m.y2, Math.round(m.r2 * 6), Math.round(m.r2 * 5), 2.2, I.sky, I.sky + 13);
      var rnd = PX.rng(71), ns = Math.round(w * hy / 300), sd = fb.d;
      for (i = 0; i < ns; i++) {                                         // stars (sparser near the glowing horizon), some with a small cross
        var sx = Math.floor(rnd() * w), sy = Math.floor(Math.pow(rnd(), 1.4) * (hy - A(6))), g = Math.floor(rnd() * 3), big = rnd() < 0.05;
        if (sd[sy * w + sx] >= I.sky + 10 || Math.abs(sx - m.x1) < m.r1 * 1.4 && Math.abs(sy - m.y1) < m.r1 * 1.4) continue;
        sd[sy * w + sx] = big ? I.star + 3 : I.star + g;
        if (big) { fb.set(sx - 1, sy, I.star + 1); fb.set(sx + 1, sy, I.star + 1); fb.set(sx, sy - 1, I.star + 1); fb.set(sx, sy + 1, I.star + 1); }
      }
      crescent(fb, m.x1, m.y1, m.r1, I.moon, true, 3);
      crescent(fb, m.x2, m.y2, m.r2, I.moon2, false, 2);
      for (y = hy + 1; y < h; y++) {                                     // the plain mirrors the sky: a flipped, dimmed copy (stars and moons included)
        var src = Math.max(0, 2 * hy - y - A(3)), row = y * w, srow = src * w;
        var lut = (y - hy) < A(7) ? MD1 : ((y - hy) < A(26) ? MD2 : MD);
        for (x = 0; x < w; x++) sd[row + x] = lut[sd[srow + x]];
      }
      fb.fillRect(0, hy, w, 1, I.sky + 13);
      if (!ST.sky || ST.sky.length !== w * h) ST.sky = new Uint8Array(w * h);
      ST.sky.set(fb.d); ST.skyKey = skey;
    } else d.set(ST.sky);
    var y0 = hy + A(1), y1 = hy + A(4), y2 = hy + A(38), yr = hy + A(1);
    Sc.blitStrip(fb, ST.range, al * 0.015 + 400, yr - ST.range.h + 1);
    reflect(fb, ST.range, al * 0.015 + 400, yr, Math.round(hy * 0.3));
    Sc.blitStrip(fb, ST.far, al * 0.03 + 200, y0 - ST.far.h + 1);
    reflect(fb, ST.far, al * 0.03 + 200, y0, Math.round(hy * 0.3));
    Sc.blitStrip(fb, ST.mid, al * 0.08 + 90, y1 - ST.mid.h + 1);
    reflect(fb, ST.mid, al * 0.08 + 90, y1, Math.round(hy * 0.42));
    Sc.blitStrip(fb, ST.near, al * 0.22 + 300, y2 - ST.near.h + 1);
    reflect(fb, ST.near, al * 0.22 + 300, y2, Math.round(hy * 0.3));
    // long light streaks on the mirror: the moons' paths, broken into bright dashes (palette-cycled glints)
    if (!S.reduced) for (var mm = 0; mm < 2; mm++) {
      var mx = mm ? m.x2 : m.x1, len = Math.round((h - hy) * 0.9), spr0 = mm ? m.r2 * 0.4 : m.r1 * 0.55;
      for (y = hy + A(2); y < Math.min(h, hy + len); y += 1) {
        var k = (y - hy) / len, spr = spr0 + k * spr0 * 2.2, hv = PX.h2(y, mm * 7 + 3);
        if (hv < 0.55 - k * 0.3) continue;
        var wd = Math.max(1, Math.round(spr * (0.35 + 0.65 * PX.h2(y, 11 + mm)))), sx0 = Math.round(mx + (PX.h2(y, 13 + mm) - 0.5) * spr * 1.6 + Math.sin(t * 0.8 + y * 0.35) * 1.5);
        for (x = sx0 - wd; x <= sx0 + wd; x++) if (x >= 0 && x < w && B4[y & 3][x & 3] + 0.5 < 0.9 - k * 0.6) d[y * w + x] = (mm ? I.moon2 + 1 : I.gl + ((x + y) % 6));
      }
    }
  };

  // ---------- ground: a cut through polished volcanic glass, layered parallel to the slope ----------
  // mirror crust, faceted planes, flow-banded glass (mahogany swirls, rainbow sheen), clear black glass with spherulites and fractures, and a
  // violet glow rising from below. Layer depths use depthZoom so a far view keeps them; boundaries are bright reflective seams.
  var LT = [16, 64, 92, 130], AMP = [0.6, 2.4, 3.0, 3.4], BND = new Int16Array(6), DH = new Float32Array(4096);

  R.ground = function (fb, S, pal) {
    build(S);
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, sc = S.scroll, lipA = S.lip, adj = S.adj || 1, t = S.reduced ? 0 : S.tSec;
    var ds = Math.min(depthZoom(S), 0.56 * adj), dsn = ds / (0.42 * adj), qoff = Math.round(sc * zoom - S.ztx), heroX = Math.round(S.ztx + S.anchorX * zoom);
    var OB = I.obs, SH = I.sheen, MH = I.mah, DG = I.dg, x, y, k, o;
    for (x = 0; x < w; x++) {
      var lip = lipA[x]; if (lip >= h) continue;
      var wxF = (x - S.ztx) / zoom + sc, qx = x + qoff, acc = 0, prev = 0, e1 = sn(wxF * 0.0113 + 1.3), e2 = sn(wxF * 0.0071 + 4.1), e3 = sn(wxF * 0.019 + 2.2);
      for (k = 0; k < 4; k++) {
        acc += LT[k];
        var wob = AMP[k] * (0.55 * ((k & 1) ? e1 : e2) + 0.45 * e3 * ((k % 3) ? 1 : -1) + 1.3 * jag(wxF, 26 + 9 * k, 31 + k)) * dsn;
        BND[k] = Math.max(prev + 2, Math.round(acc * ds + wob)); prev = BND[k];
      }
      y = Math.max(0, lip); var dd = y - lip, L = 0; while (L < 4 && dd >= BND[L]) L++;
      var bay, lt, tone, idx, nzv;
      for (; L <= 4 && y < h; L++) {
        var yEnd = L < 4 ? Math.min(h, lip + BND[L]) : h, ls0 = L ? BND[L - 1] : 0, th = (L < 4 ? BND[L] : 400) - ls0;
        if (L === 0) {                                                  // the mirror crust: a hard cyan-white edge light, the sky's glow reflected in the polish, dashes of glare
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)];
            if (dd === 0) idx = (PX.h2(qx >> 1, 3) > 0.55) ? SH + 6 : SH + 5;
            else if (dd === 1) idx = (PX.h2(qx >> 2, 5) > 0.5) ? SH + 4 : SH + 3;
            else {
              tone = 3.4 - dd * 0.8 + bay * 0.6 + ((((qx >> 3) * 7 + dd * 3) % 13) === 0 ? 1.2 : 0);
              idx = tone > 2.5 ? SH + clamp(Math.floor(tone - 1.5), 1, 3) : OB + clamp(Math.floor(tone + 3), 2, 6);
            }
            d[o] = idx;
          }
        } else if (L === 1) {                                           // faceted planes: sheared parallelogram facets, each with a lit top-left corner
          var rowH = Math.max(8, Math.round(15 * dsn)), lastPr = -99999, pw = 20, sgn = 1, poff = 0, lastPc = -99999, ct = 0;
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            var pr = (lt / rowH) | 0, fyy = lt - pr * rowH;
            if (pr !== lastPr) { lastPr = pr; pw = 14 + Math.floor(PX.h2(pr, 33) * 26); sgn = PX.h2(pr, 36) < 0.5 ? 1 : -1; poff = Math.floor(PX.h2(pr, 34) * pw); lastPc = -99999; }
            var sh = sgn * ((fyy * 0.55) | 0), pc = Math.floor((qx + poff + sh) / pw), pf = qx + poff + sh - pc * pw;
            if (pc !== lastPc) { lastPc = pc; ct = PX.h2(pc, pr + 37); }
            tone = 0.7 + ct * 3.6 + bay * 0.55 - (fyy / rowH) * 1.1 + (pf < pw * 0.25 ? 0.7 : 0);
            var ii = (tone + 0.5) | 0; idx = OB + (ii < 0 ? 0 : ii > 5 ? 5 : ii);
            if (ct > 0.9) { var mi = (0.3 + (1 - fyy / rowH) * 1.9 + bay * 0.6 + (pf < pw * 0.4 ? 0.7 : 0)) | 0; idx = SH + (mi < 0 ? 0 : mi > 3 ? 3 : mi); }
            else if (fyy === 0 && ct > 0.5) idx = OB + 6; else if (pf === 0 && fyy > 1 && ct > 0.7) idx = OB + 6;
            d[o] = idx;
          }
        } else if (L === 2) {                                           // flow-banded glass: wavy bands, mahogany swirls, thin iridescent seams
          var sA = 6 * sn(qx * 0.038 + 0.9), lastBi = -99999, bh = 0, kind = 0;
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            var fw = lt + sA + 3 * sn(qx * 0.1 + lt * 0.03), bi = Math.floor(fw * (1 / 6)), fr = fw - bi * 6;
            if (bi !== lastBi) { lastBi = bi; bh = PX.h2(bi, 83); kind = bh > 0.8 ? 2 : (bh > 0.62 ? 1 : 0); }
            if (kind === 2) { tone = 1.4 + bh * 1.3 + bay * 0.55; var jj = (tone - 0.1) | 0; idx = MH + (jj < 0 ? 0 : jj > 4 ? 4 : jj); if (fr < 1) idx = MH + 4; else if (fr > 4.5) idx = MH; }
            else {
              tone = 1.0 + bh * 2.6 + bay * 0.55 - (lt / th) * 0.5; if (fr < 1) tone += 0.8; else if (fr > 5) tone -= 0.8;
              var ii2 = (tone + 0.5) | 0; idx = OB + (ii2 < 0 ? 0 : ii2 > 5 ? 5 : ii2);
              if (kind === 1 && fr >= 2 && fr < 3) idx = ((qx >> 3) & 1) ? SH + 1 : DG + 2;                             // an iridescent seam
            }
            if (lt === 0) idx = SH + 2;
            d[o] = idx;
          }
        } else if (L === 3) {                                           // clear black glass: faint cloudy inclusions, a violet glow starting to rise
          var gT0 = th * 0.72, gTs = Math.max(12, th * 0.3);
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            nzv = VN[((qx >> 1) & 255) | (((dd >> 1) & 255) << 8)] * 0.00392157;
            tone = 0.9 + (nzv - 0.35) * 2.6 + bay * 0.5; if (tone < 0.4) tone = 0.4;
            var fr3 = (((qx * 3 + dd * 2 + ((nzv * 9) | 0)) % 17) + 17) % 17;
            if (fr3 === 0) tone += 1.6;
            var ii3 = tone | 0; idx = OB + (ii3 > 4 ? 4 : ii3);
            if (lt === 0) idx = SH + 3;
            var gq = (lt - gT0) / gTs + 0.4 * sn(qx * 0.03 + lt * 0.02);                                              // violet glow contours
            if (gq > 0) { var gk = gq | 0, gf = gq - gk, lev = gk + ((gf > 0.8 && bay + 0.5 < (gf - 0.8) / 0.2) ? 1 : 0); if (lev > 0) idx = DG + (lev - 1 > 1 ? 1 : lev - 1); }
            d[o] = idx;
          }
        } else {                                                        // the deep: violet glow deepening toward magenta, dark crystal-veined glass bands
          var g0 = 90 * ds, gstep = Math.max(16, 70 * ds), sA4 = 6 * sn(qx * 0.043 + 2.0), sB4 = qx * 0.11 + 0.7, lastB4 = -99999, bh4 = 0;
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            var fw4 = dd + sA4 + 3.4 * sn(sB4 + dd * 0.02), band4 = Math.floor(fw4 * (1 / 6)), fr4 = fw4 - band4 * 6;
            if (band4 !== lastB4) { lastB4 = band4; bh4 = PX.h2(band4, 93); }
            var gq2 = (lt - g0) / gstep + 0.4 * sn(qx * 0.03 + lt * 0.02) + 1.2, gl = gq2 | 0, gf2 = gq2 - gl, lev2 = gl + ((gf2 > 0.8 && bay + 0.5 < (gf2 - 0.8) / 0.2) ? 1 : 0);
            idx = lev2 <= 0 ? OB + 1 + (fr4 < 1.2 && bh4 > 0.55 ? 1 : 0) : DG + (lev2 - 1 > 3 ? 3 : lev2 - 1);
            if (lev2 > 0 && bh4 > 0.6 && fr4 < 1.2) idx = DRK[idx]; else if (lev2 > 0 && fr4 >= 1.2 && fr4 < 2 && bh4 > 0.75) idx = LIT[idx];
            d[o] = idx;
          }
        }
      }
    }
    features(fb, S, ds, heroX, t);
    surface(fb, S, ds, heroX, t);
  };

  // ---------- things sealed in the glass ----------
  function pocket(fb, cx, cy, rx, ry, seed) {                            // a clear bubble in the glass: a lit upper-left rim, a slightly lighter body
    for (var y = -ry; y <= ry; y++) for (var x = -rx; x <= rx; x++) {
      var wob = 1 + 0.12 * Math.sin(Math.atan2(y, x) * 3 + seed), e = ((x * x) / (rx * rx) + (y * y) / (ry * ry)) / (wob * wob); if (e > 1) continue;
      fb.set(cx + x, cy + y, e > 0.74 ? ((x + y < 0) ? I.sheen + 3 : I.obs + 5) : ((x + y) < -rx * 0.4 && e > 0.4 ? I.obs + 4 : I.obs + 3));
    }
  }
  var RELICS = [
    ["....aa....", "...abba...", "..abbcba..", ".abbcccba.", ".abbcccba.", "..abbcba..", "...abba...", "....aa...."],                                              // 0 an obsidian blade (leaf shape, bright edge)
    ["..aaaaaa..", ".abbbbbba.", "abbcbbcbba", "abbcbbcbba", ".abbbbbba.", "..abccba..", "..a.bb.a.."],                                                  // 1 a skull
    [".aaaaaa.", "abbbbbba", "abcccbba", "abc.cbba", "abc.cbba", "abcccbba", "abbbbbba", ".aaaaaa."],                                                      // 2 a gold ring
    ["a..a..a..a", "ab.ab.ab.ab", "abbabbabba", ".abbbbbba.", "..abbbba..", "...abba...", "...abba...", "...aaaa..."],                                    // 3 a hand reaching up
    ["..a.......", ".aba......", "abcba.....", ".abcba....", "..abcba...", "...abcba..", "....abcba.", ".....abba."],                                       // 4 a dagger
    ["...aa...", "..abba..", "..abba..", ".abccba.", "abcdccba", "abcdccba", ".abccba.", "..aabb.."]                                                       // 5 an amphora
  ];
  var RMAP = null;
  function relic(fb, n, x, y, flip) {
    if (!RMAP) RMAP = [{ a: I.obs + 2, b: I.obs + 4, c: I.sheen + 5 }, { a: I.bone, b: I.bone + 1, c: I.bone + 3 }, { a: I.gold, b: I.gold + 1, c: I.gold + 3 }, { a: I.bone, b: I.bone + 2, c: I.bone + 3 },
      { a: I.sheen, b: I.sheen + 3, c: I.sheen + 6 }, { a: I.mah, b: I.gold + 1, c: I.gold + 2, d: I.gold + 3 }];
    var rows = RELICS[n]; pocket(fb, x + (rows[0].length >> 1), y + (rows.length >> 1), (rows[0].length >> 1) + 3, (rows.length >> 1) + 3, n * 3);
    bmp(fb, rows, RMAP[n], x, y, flip);
  }
  function spheru(fb, cx, cy, r) {                                       // snowflake obsidian: pale radial spherulites in the black
    for (var k = 0; k < 7; k++) {
      var px = cx + Math.round((PX.h2(cx + k, cy) - 0.5) * r * 2.4), py = cy + Math.round((PX.h2(cy + k, cx) - 0.5) * r * 1.2);
      fb.set(px, py, I.bone + 2); fb.set(px - 1, py, I.bone); fb.set(px + 1, py, I.bone); fb.set(px, py - 1, I.bone + 1); fb.set(px, py + 1, I.bone);
    }
  }
  function conch(fb, cx, cy, r0, seed) {                                 // a shatter point in the glass: radial cracks of uneven length, a broken ripple ring between them
    var n = 5 + Math.floor(PX.h1(seed + 3) * 3), a0 = PX.h1(seed) * TAU, i, s;
    for (i = 0; i < n; i++) {
      var ang = a0 + i * TAU / n + (PX.h1(seed + i * 5) - 0.5) * 0.5, len = Math.round(r0 * (1.2 + 2.2 * PX.h1(seed * 3 + i))), ca = Math.cos(ang), sa = Math.sin(ang);
      for (s = 1; s <= len; s++) fb.set(cx + Math.round(ca * s), cy + Math.round(sa * s * 0.9), s < 3 ? I.sheen + 4 : (s < len * 0.6 ? I.sheen + 2 : I.obs + 6));
    }
    var ring = r0 * 1.5, span = 1.3 + PX.h1(seed + 9) * 1.4, ra = a0 + 0.5, a;
    for (a = ra; a < ra + span; a += 1 / (ring * 1.4)) fb.set(cx + Math.round(Math.cos(a) * ring), cy + Math.round(Math.sin(a) * ring * 0.9), I.obs + 6);
    fb.set(cx, cy, I.sheen + 6);
  }
  function needle(fb, cx, cy, len, ang, seed) {                          // a sharp black sliver embedded in the glass: lit half, dark half, a cyan edge
    var ca = Math.cos(ang), sa = Math.sin(ang), t, s;
    for (t = 0; t <= len; t++) {
      var hw = Math.max(0.5, (1 - t / len) * 1.8 + (t < 3 ? -0.6 + t * 0.2 : 0));
      for (s = -Math.ceil(hw); s <= Math.ceil(hw); s++) {
        if (Math.abs(s) > hw + 0.3) continue;
        fb.set(Math.round(cx + ca * t - sa * s), Math.round(cy + sa * t + ca * s), s < -hw * 0.3 ? I.sheen + 4 : (s > hw * 0.4 ? I.obs : I.obs + 3));
      }
    }
    fb.set(Math.round(cx + ca * len), Math.round(cy + sa * len), I.sheen + 6);
  }

  function oldStone(fb, cx, cy, r) {                                    // a stone lost long ago, sealed in the glass: pale, cracked, ringed by a violet halo
    var w = fb.w, h = fb.h, d = fb.d, x, y, R2 = r * 2.3;
    for (y = -Math.ceil(R2); y <= Math.ceil(R2); y++) for (x = -Math.ceil(R2); x <= Math.ceil(R2); x++) {
      var px = cx + x, py = cy + y; if (px < 0 || py < 0 || px >= w || py >= h) continue;
      var q = 1 - (x * x + y * y) / (R2 * R2); if (q <= 0 || B4[py & 3][px & 3] + 0.5 > q * 1.1) continue;
      var v = d[py * w + px]; if (v >= I.obs && v <= I.obs + 5) d[py * w + px] = I.dg + (q > 0.55 ? 2 : 1);
    }
    for (y = -r; y <= r; y++) for (x = -r; x <= r; x++) {
      var d2 = x * x + y * y; if (d2 > r * r) continue;
      var lit = (-(x * 0.7 + y * 0.7)) / r, tone = lit > 0.5 ? 3 : lit > 0.1 ? 2 : lit > -0.35 ? 1 : 0;
      if (d2 > (r - 1) * (r - 1)) tone = lit > 0.3 ? 2 : 0;
      if (Math.abs(x - Math.round(y * 0.45) - 1) < 1 && y > -r * 0.7 && y < r * 0.55) tone = -1;
      fb.set(cx + x, cy + y, tone < 0 ? I.obs : I.bone + tone);
    }
  }
  function features(fb, S, ds, heroX, t) {
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, sc = S.scroll, lipA = S.lip, a = S.adj || 1, c, r, kk;
    var wl = (0 - S.ztx) / zoom + sc, wr = (w - S.ztx) / zoom + sc, keep = clamp((S.zoom / a - 0.08) / 0.34, 0.3, 1);
    function sx(wx) { return Math.round(S.ztx + (wx - sc) * zoom); }
    function lipAt(x) { return lipA[clamp(x, 0, w - 1)]; }
    // long light streaks: reflections gliding along the polish, faint at both ends
    var sw = 84;
    for (c = Math.floor(wl / sw) - 1; c <= Math.ceil(wr / sw) + 1; c++) for (r = 0; r < 3; r++) {
      if (PX.h2(c * 3 + r, 501) < 1 - 0.75 * keep) continue;
      var x0 = sx(c * sw + PX.h2(c, r + 502) * sw), len = Math.round((28 + 70 * PX.h2(c, r + 503)) * Math.max(0.45, zoom * 2)), dep = Math.round((5 + r * 7 + PX.h2(c, r + 504) * 5) * ds * 2.3);
      if (x0 > w + 4 || x0 + len < -4) continue;
      for (kk = 0; kk < len; kk++) {
        var xx = x0 + kk, yy = lipAt(xx) + dep + Math.floor((kk / len) * 0.8), q = Math.sin(Math.PI * (kk + 0.5) / len);
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        var thr = q * 1.25 - 0.1; if (B4[yy & 3][xx & 3] + 0.5 > thr) continue;
        d[yy * w + xx] = q > 0.75 ? I.sheen + 5 : (q > 0.4 ? I.sheen + 3 : I.sheen + 1);
        if (q > 0.6 && yy + 1 < h && B4[(yy + 1) & 3][xx & 3] + 0.5 < q * 0.6) d[(yy + 1) * w + xx] = I.sheen + 1;
      }
    }
    // needles and shard slivers sealed at every angle
    var nc = 46;
    for (c = Math.floor(wl / nc) - 1; c <= Math.ceil(wr / nc) + 1; c++) for (r = 0; r < 4; r++) {
      if (PX.h2(c * 5 + r, 511) < 1 - 0.14 * keep) continue;
      var nx = sx(c * nc + PX.h2(c, r + 512) * nc), ny = Math.round(lipAt(nx) + (24 + r * 86 + PX.h2(c, r + 513) * 70) * ds); if (nx < -14 || nx > w + 14 || ny < -14 || ny > h + 14) continue;
      needle(fb, nx, ny, Math.max(5, Math.round((10 + 16 * PX.h2(c, r + 514)) * Math.max(0.6, ds * 1.4))), (PX.h2(c, r + 515) - 0.5) * 3.0 + 1.2, c);
    }
    // conchoidal fractures and snowflake spherulites in the clear glass
    var fc = 110;
    for (c = Math.floor(wl / fc) - 1; c <= Math.ceil(wr / fc) + 1; c++) {
      var isC = PX.h2(c, 521) > 0.5; if (PX.h2(c, 522) < 1 - 0.5 * keep) continue;
      var fx = sx(c * fc + PX.h2(c, 523) * fc), fy = Math.round(lipAt(fx) + (90 + PX.h2(c, 524) * 300) * ds); if (fx < -20 || fx > w + 20 || fy < -20 || fy > h + 20 || Math.abs(fx - heroX) < 20) continue;
      if (isC) conch(fb, fx, fy, Math.max(3, Math.round(4 * ds * 2)), c * 7); else spheru(fb, fx, fy, Math.max(3, Math.round(5 * ds * 2)));
    }
    // crystal pockets (cyan-white in the glass, a warm violet in the deep) and an old stone
    var gc = 200;
    for (c = Math.floor(wl / gc) - 1; c <= Math.ceil(wr / gc) + 1; c++) for (r = 0; r < 2; r++) {
      if (PX.h2(c * 5 + r, 531) < 1 - 0.45 * keep) continue;
      var gx = sx(c * gc + PX.h2(c, r + 532) * gc), du = 120 + r * 190 + PX.h2(c, r + 533) * 120, gy = Math.round(lipAt(gx) + du * ds); if (gx < -16 || gx > w + 16 || gy < -14 || gy > h + 14) continue;
      var gr = Math.max(4, Math.round((7 + 4 * PX.h2(c, r + 534)) * ds * 1.7));
      var halo = gr * 2.6;                                                                  // the glass around the pocket lifts a step, dithered
      for (var yy = -Math.ceil(halo); yy <= Math.ceil(halo); yy++) for (var xx = -Math.ceil(halo); xx <= Math.ceil(halo); xx++) {
        var px = gx + xx, py = gy + yy; if (px < 0 || py < 0 || px >= w || py >= h) continue;
        var q = 1 - Math.sqrt(xx * xx + yy * yy * 1.2) / halo; if (q <= 0 || B4[py & 3][px & 3] + 0.5 > q * 0.95) continue;
        var v = d[py * w + px]; if (v >= I.obs && v <= I.obs + 5) d[py * w + px] = Math.min(I.obs + 6, v + 2); else if (v >= I.dg && v < I.dg + 5) d[py * w + px] = v + 1;
      }
      for (yy = -gr; yy <= 1; yy++) for (xx = -Math.round(gr * 1.3); xx <= Math.round(gr * 1.3); xx++) { var e = (xx * xx) / (gr * gr * 1.7) + (yy * yy) / (gr * gr); if (e <= 1) fb.set(gx + xx, gy + yy, e > 0.72 ? ((xx + yy < 0) ? I.sheen + 2 : I.obs) : I.obs + 1); }
      crystals(fb, gx, gy, I.sheen + 1, c * 3 + r, { n: 4, len: Math.max(9, Math.round(gr * 3.2)), hw: Math.max(1.8, gr * 0.34), lean: 0.62, spread: Math.max(3, gr * 0.8) });
    }
    var oc = 230;                                                        // an old stone, rarely, deep in the glass
    for (c = Math.floor(wl / oc) - 1; c <= Math.ceil(wr / oc) + 1; c++) {
      if (PX.h2(c, 561) < 0.88) continue;
      var ox = sx(c * oc + PX.h2(c, 562) * oc), oy = Math.round(lipAt(ox) + (260 + 120 * PX.h2(c, 563)) * ds); if (ox < -16 || ox > w + 16 || oy < -14 || oy > h + 14) continue;
      oldStone(fb, ox, oy, Math.max(5, Math.round(9 * ds * 1.7)));
    }
    // relics sealed in bubbles of glass
    var rc = 190;
    for (c = Math.floor(wl / rc) - 1; c <= Math.ceil(wr / rc) + 1; c++) for (r = 0; r < 2; r++) {
      if (PX.h2(c * 5 + r, 541) < 1 - 0.4 * keep) continue;
      var rx = sx(c * rc + PX.h2(c, r + 542) * rc), rdu = 70 + r * 130 + PX.h2(c, r + 543) * 90; if (rx < -18 || rx > w + 18) continue;
      var ry = Math.round(lipAt(rx) + rdu * ds); if (ry < -14 || ry > h + 4) continue;
      relic(fb, Math.floor(PX.h2(c, r + 544) * 6) % 6, rx, ry, PX.h2(c, r + 545) > 0.5);
    }
    // glass veins: thin bright cracks (cyan in the upper glass, violet fire in the deep)
    var vc = 130;
    for (c = Math.floor(wl / vc) - 1; c <= Math.ceil(wr / vc) + 1; c++) {
      if (PX.h2(c, 551) < 1 - 0.3 * keep) continue;
      var vx = sx(c * vc + PX.h2(c, 552) * vc), deep = PX.h2(c, 553) > 0.5, vy = lipAt(vx) + (deep ? 300 + PX.h2(c, 554) * 260 : 40 + PX.h2(c, 554) * 200) * ds;
      var len = Math.round((30 + 70 * PX.h2(c, 555)) * Math.max(0.7, ds * 1.4)), ang = (PX.h2(c, 556) - 0.5) * 1.8 - 0.6, xx2 = vx, yy2 = vy;
      if (vx < -100 || vx > w + 100 || vy < -100 || vy > h + 40) continue;
      for (kk = 0; kk < len; kk++) {
        ang += (PX.h2(c, kk + 720) - 0.5) * 0.4; ang = clamp(ang, -1.6, 0.6); xx2 += Math.cos(ang); yy2 += Math.sin(ang);
        var ix = Math.round(xx2), iy = Math.round(yy2);
        if (deep) { fb.set(ix, iy, kk % 4 === 0 ? I.dg + 5 : I.dg + 4); fb.set(ix + 1, iy, I.dg + 2); } else { fb.set(ix, iy, kk % 5 === 0 ? I.sheen + 6 : I.sheen + 4); fb.set(ix + 1, iy, I.sheen); }
        if (kk > 8 && kk % 15 === 0 && PX.h2(c, kk + 800) > 0.5) { var bx = ix, by = iy, bd = PX.h2(c, kk + 810) < 0.5 ? -1 : 1; for (var bs = 1; bs < 8; bs++) { bx += bd; by -= (bs & 1); fb.set(bx, by, deep ? I.dg + 3 : I.sheen + 3); } }
      }
    }
  }

  // ---------- the lip: glass spikes and small crystal clusters, a broken edge of shards; all rim-lit, kept clear of the hero ----------
  function spike(fb, bx, by, hpx, seed) {                                // a thin glass spire: lit left face, dark right face, a bright tip
    var lean = (PX.h1(seed * 3 + 1) - 0.5) * 0.5, t, x, hw0 = Math.max(1.5, hpx * 0.16);
    for (t = 0; t < hpx; t++) {
      var u = t / hpx, hw = hw0 * (1 - u * 0.95) + 0.3, c = bx + lean * t, xl = Math.round(c - hw), xr = Math.round(c + hw);
      for (x = xl; x <= xr; x++) fb.set(x, by - t, x === xl && t > 1 ? I.sheen + 5 : (x < c ? I.obs + 5 : (x === xr ? I.obs : I.obs + 3)));
    }
    fb.set(Math.round(bx + lean * hpx), by - hpx, I.sheen + 6);
  }
  function surface(fb, S, ds, heroX, t) {
    var w = fb.w, h = fb.h, zoom = S.zoom, sc = S.scroll, lipA = S.lip, a = S.adj || 1, c, kk, thin = clamp((S.zoom / a) / 0.28, 0.22, 1);
    var wl = (0 - S.ztx) / zoom + sc, wr = (w - S.ztx) / zoom + sc;
    function sx(wx) { return Math.round(S.ztx + (wx - sc) * zoom); }
    function lipAt(x) { return lipA[clamp(x, 0, w - 1)]; }
    var cw = 40;
    for (c = Math.floor(wl / cw) - 1; c <= Math.ceil(wr / cw) + 1; c++) {
      if (PX.h1(c * 5 + 401) > 0.5 * thin) continue;
      var px = sx(c * cw + PX.h1(c * 7 + 403) * cw); if (px < -6 || px > w + 6 || Math.abs(px - heroX) < 24 * zoom + 8) continue;
      var n = 1 + Math.floor(PX.h1(c * 11 + 405) * 3);
      for (kk = 0; kk < n; kk++) spike(fb, px + kk * 3 - 3, lipAt(px + kk * 3) + 2, Math.max(4, Math.round((10 + 24 * PX.h1(c * 13 + kk * 3 + 407)) * zoom * 1.6 * (kk === 1 ? 1 : 0.65))), c * 5 + kk);
    }
    var cc = 300;                                                        // a crystal cluster now and then
    for (c = Math.floor(wl / cc) - 1; c <= Math.ceil(wr / cc) + 1; c++) {
      if (PX.h1(c * 5 + 431) > 0.5 * thin) continue;
      var cxx = sx(c * cc + PX.h1(c * 7 + 433) * cc * 0.8); if (cxx < -14 || cxx > w + 14 || Math.abs(cxx - heroX) < 40 * zoom + 18) continue;
      crystals(fb, cxx, lipAt(cxx) + 2, I.sheen + 1, c, { n: 4, len: Math.max(10, Math.round((34 + 26 * PX.h1(c * 11 + 435)) * zoom * 1.5)), hw: Math.max(2, 2.6 * zoom * 2), lean: 0.6, spread: Math.max(4, 8 * zoom * 2) });
    }
  }

  // ---------- front: glints drifting over the glass, and a slow sheen that sweeps along the polished edge ----------
  R.front = function (fb, S, pal) {
    if (S.reduced) return;
    var w = fb.w, h = fb.h, d = fb.d, lip = S.lip, t = S.tSec, zoom = S.zoom, a = S.adj || 1, i, x, y;
    for (i = 0; i < 18; i++) {                                           // motes of light: twinkle out of step through the glint cycle
      var sp = 1.5 + PX.h1(i * 7 + 1) * 4, mx = ((PX.h1(i * 3 + 1) * (w + 80) - t * sp - S.scroll * zoom * 0.02) % (w + 80) + (w + 80)) % (w + 80) - 40;
      var my = (0.05 + PX.h1(i * 11 + 3) * 0.7) * h + Math.sin(t * (0.5 + PX.h1(i * 5) * 0.5) + i * 2.1) * 4, px = Math.round(mx), py = Math.round(my);
      if (px < 0 || px >= w || py < 0 || py > lip[px] - 3) continue;
      var tw = Math.sin(t * 2.2 + i * 1.7); if (tw < -0.2) continue;
      d[py * w + px] = I.gl + ((i + Math.floor(t * 3)) % 6); if (tw > 0.7) { if (px + 1 < w) d[py * w + px + 1] = I.gl + 5; if (px > 0) d[py * w + px - 1] = I.gl + 5; }
    }
    var per = 15, sw = (t % per) / per, xs = Math.round(-50 + sw * (w + 100)), half = Math.round(34 * Math.max(0.6, w / 480));   // a glide of light along the crust, brightest at its heart
    for (x = Math.max(0, xs - half); x < Math.min(w, xs + half); x++) {
      var q = 1 - Math.abs(x - xs) / half, ly = lip[x];
      for (y = Math.max(0, ly); y < Math.min(h, ly + Math.round(9 * a)); y++) {
        var k = q * (1 - (y - ly) / (9 * a)) * 1.4; if (B4[y & 3][x & 3] + 0.5 > k) continue;
        d[y * w + x] = LIT[d[y * w + x]]; if (k > 0.9) d[y * w + x] = LIT[d[y * w + x]];
      }
      var deep = Math.round(64 * a), y1 = Math.min(h, ly + Math.round(9 * a) + deep);         // and deeper, a faint refracted glow passes through the black glass
      for (y = Math.max(0, ly + Math.round(9 * a)); y < y1; y++) {
        var v0 = d[y * w + x]; if (v0 < I.obs || v0 > I.obs + 4) continue;
        var k2 = q * (1 - (y - ly - 9 * a) / deep) * 0.75; if (B4[y & 3][x & 3] + 0.5 > k2) continue;
        d[y * w + x] = LIT[v0];
      }
    }
  };

  V8.register("obsidian", R);
})(typeof window !== "undefined" ? window : this);
