// The Canyon River - V8 zone scene (2500-3200 m). Late afternoon in a deep red-ochre sandstone gorge, built entirely in code on the
// shared indexed framebuffer: a banded sky with a low gold sun that sinks and warms as the gorge is climbed out of (the nearer ranks sink
// faster: vertical parallax), puffy clouds lit gold from below, four receding ranks of strata mesas / buttes / hoodoos with a natural arch
// and two thin waterfalls that step from lavender haze to burnt red (aerial perspective is a palette mix, not a blend), a silver river far
// below with palette-cycled ripples and a glitter path under the sun, gold dust, and the odd tumbleweed. The ground is a cut through the
// gorge wall: baked crust plates, cross-bedded sandstone, red mudstone, limestone, the Redwall cliffs, shale with copper-green lenses,
// conglomerate, and dark folded schist with pegmatite dikes and a rose glow far below; fossils, calcite and rose-quartz geodes, caves,
// a carved stone and an old stone are sealed in the layers.
(function (root) {
  "use strict";
  var PX = root.PX, Sc = root.Sc, V8 = root.V8, hex = PX.hex, clamp = PX.clamp, clamp01 = PX.clamp01, B4 = PX.BAYER4;
  var R = { rock: { mat: "warm", style: "granite" }, thumb: { alt: 0, zoom: 0.74, slope: 0.02, ratio: 0.72, f: 3 } };
  var I = {}, ST = {}, CL = [], built = "", SKY0 = null, CLD0 = null, skyF = -1;
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
    var AIR = [176, 152, 198];
    SKY0 = H(["#36598a", "#3f6493", "#4a709c", "#597ea6", "#6b8cae", "#809bb5", "#98a9bb", "#b3b6bd", "#cdbfbc", "#e2c6b3", "#eebf9a", "#f4b688", "#f8c795", "#fbd9a9", "#feebc3"]);
    skyF = -1;
    I.sky = pal.ramp("sky", SKY0);
    I.sun = pal.ramp("sun", H(["#f6d3a6", "#ffbd5e", "#ffd67f", "#ffeeb0", "#fffbe2"]));
    I.cloud = pal.ramp("cloud", H(["#8f728c", "#b28c96", "#d7a898", "#f2c39b", "#ffe2b4"]));
    var rock = H(["#24101c", "#3c1a26", "#59232b", "#7a3134", "#9d4538", "#bf5d3f", "#dd7b4c", "#f29c62", "#ffc884"]);   // near rock, dark -> sunlit rim
    function pick(list, n) { var out = [], i; for (i = 0; i < n; i++) out.push(list[Math.round(i * (list.length - 1) / (n - 1))]); return out; }
    I.f0 = pal.ramp("f0", mixRamp(pick(rock.slice(3), 4), AIR, 0.74));                                                // lavender haze (4 tones)
    I.f1 = pal.ramp("f1", mixRamp(pick(rock.slice(2), 5), AIR, 0.52));
    I.f2 = pal.ramp("f2", mixRamp(pick(rock.slice(1), 6), AIR, 0.30));
    I.f3 = pal.ramp("f3", mixRamp(pick(rock, 7), AIR, 0.10));
    I.haze = pal.ramp("haze", H(["#dbb9b1", "#e9c8b3"]));
    I.river = pal.ramp("river", H(["#63719b", "#7c8bb0", "#9eabc8", "#c5cfe0", "#f6e4c6"]));
    I.rgl = pal.ramp("rgl", H(["#f7dcae", "#ffecc9", "#fff8e4", "#ffecc9"]));
    I.valley = pal.ramp("valley", H(["#9d7178", "#b4827f", "#c8958a", "#dba996", "#ecc0a2"]));
        I.orng = pal.ramp("orng", H(["#5a2b22", "#793a28", "#994c2f", "#b96137", "#d67b40", "#eb9855", "#f8b573", "#ffd497"]));
    I.red = pal.ramp("red", H(["#2b1318", "#431a1e", "#5d2325", "#7a2f2c", "#983c33", "#b54d3d", "#cf6449"]));
    I.lime = pal.ramp("lime", H(["#57474a", "#71605b", "#8d7a6d", "#a99384", "#c4ae9a", "#ddc8b0"]));
    I.shale = pal.ramp("shale", H(["#262c2c", "#353e3c", "#485249", "#5d6a5a", "#788771"]));
    I.schist = pal.ramp("schist", H(["#0c0a11", "#141019", "#1d1626", "#291f36", "#382b4a"]));
    I.plum = pal.ramp("plum", H(["#3a1630", "#5b1b35", "#83233a"]));
    I.pink = pal.ramp("pink", H(["#5b2b48", "#8d4266", "#c2688a", "#eb9bb0", "#ffe1e6"]));
    I.turq = pal.ramp("turq", H(["#13403f", "#1f6b60", "#3d9a82", "#a2dcc0"]));
    I.amber = pal.ramp("amber", H(["#4a1c12", "#7d2f14", "#b8501b"]));
    I.plant = pal.ramp("plant", H(["#26301f", "#3a4a2a", "#52663a", "#71875a", "#98a878"]));
    I.ink = pal.ramp("ink", H(["#0a0709"]));
    buildTables(pal);
    R.birdIdx = I.f3 + 1;                                               // shared overlays: warm maroon birds against the gold sky
    R.watcherIdx = I.red + 1;                                           // the watcher: a dark red-brown cloak on the sand
    R.footprint = { col: I.orng + 3, hi: I.orng + 7 };                  // pressed sand with a lit rim
    R.markerIdx = { c0: I.red + 1, c1: I.orng + 3, c2: I.orng + 6, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };   // cairns in the local sandstone
    R.pal = pal; RMAP = null;
    // (the baked scene holds palette INDICES only, keyed by screen size: it stays valid across re-inits, so a revisit costs ~nothing)
    build(S);
  };

  // ---------- the mesa strip: strata-cut mesas, buttes and needles, lit from the left, shaded to the right ----------
  // A silhouette (union of profiles: plateau, near-vertical cliff, ledge, talus skirt) is cut from one shared stratigraphy (resistant
  // layers stand proud with a lit lip, weak layers recede in shadow), then each pixel is shaded by its distance from the left / right
  // edge of its own face (cylinder light), its surface tilt near the crest, faint vertical fluting and varnish streaks.
  // o: L, H, seed, ramp (palette base), n (tones), ws (width scale), gap, hMin, hMax (fractions of H), pSpire, pButte, fade (palette idx), fadeRows, arch
  function mesaStrip(o) {
    var L = o.L, Hh = o.H, st = Sc.newStrip(L, Hh), d = st.d, rnd = PX.rng(o.seed), P = o.ramp, n = o.n, x, y, i, dx;
    var hg = new Float32Array(L), fid = new Int16Array(L).fill(-1), feats = [], jit = Sc.periodic(L, o.seed * 5 + 3);
    var cur = rnd() * o.gap;
    while (cur < L) {
      var r = rnd(), f, kind = r < o.pSpire ? 2 : r < o.pSpire + o.pButte ? 1 : 0;
      if (kind === 2) f = { hw: 1.2 + rnd() * 1.6, hh: Hh * o.hMax * (0.7 + 0.3 * rnd()) };
      else if (kind === 1) f = { hw: (5 + rnd() * 8) * o.ws, hh: Hh * (o.hMin + (o.hMax - o.hMin) * (0.4 + 0.6 * rnd())) };
      else f = { hw: (14 + rnd() * 36) * o.ws, hh: Hh * (o.hMin + (o.hMax - o.hMin) * rnd()) };
      // outline from the plateau edge outward as [dx, height] vertices: cliff, ledge, cliff, ledge ... then a talus skirt down to zero
      var vx = [0], vh = [f.hh], ex = 0, hc = f.hh, steps = kind === 2 ? 0 : (kind === 1 ? 1 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 2));
      for (i = 0; i < steps; i++) {
        var drop = hc * (0.22 + 0.28 * rnd()); ex += 0.8 + rnd() * 2.4; hc -= drop; vx.push(ex); vh.push(hc);
        ex += (2 + rnd() * 9) * o.ws; hc -= rnd() * 1.2; vx.push(ex); vh.push(hc);
      }
      ex += kind === 2 ? 1.5 : 0.8 + rnd() * 2; hc *= kind === 2 ? 0.7 : 0.45; vx.push(ex); vh.push(hc);                   // last cliff into the skirt
      ex += hc / (kind === 2 ? 2.6 : 0.55 + rnd() * 0.55); vx.push(ex); vh.push(0);                                        // the talus skirt
      f.vx = vx; f.vh = vh; f.reach = Math.ceil(ex);
      f.cx = cur + f.hw; f.tilt = (rnd() - 0.5) * 2.4; f.br = Math.floor(rnd() * 3) - 1; f.dz = Math.floor(rnd() * 5) - 2; f.ph = rnd() * TAU;
      feats.push(f); cur = f.cx + f.hw + o.gap * (-0.2 + 1.2 * rnd());
    }
    for (i = 0; i < feats.length; i++) {                                 // periodic union of the outlines
      f = feats[i];
      var cxr = Math.round(f.cx), reach = f.reach + Math.ceil(f.hw) + 2;
      for (dx = -reach; dx <= reach; dx++) {
        var ad = Math.abs(dx), h;
        if (ad <= f.hw) h = f.hh + f.tilt * (dx / f.hw) + 1.1 * jit(((cxr + dx) % L + L) % L);
        else {
          var e2 = ad - f.hw, q = 1; while (q < f.vx.length - 1 && e2 > f.vx[q]) q++;
          h = e2 > f.vx[f.vx.length - 1] ? 0 : f.vh[q - 1] + (f.vh[q] - f.vh[q - 1]) * (e2 - f.vx[q - 1]) / Math.max(0.001, f.vx[q] - f.vx[q - 1]);
        }
        if (h < 1) continue;
        var xx = (((cxr + dx) % L) + L) % L;
        if (h > hg[xx]) { hg[xx] = h; fid[xx] = i; }
      }
    }
    var top = new Int16Array(L), gr = new Float32Array(L), dl = new Int16Array(L), dr = new Int16Array(L);
    for (x = 0; x < L; x++) top[x] = Hh - Math.floor(hg[x]);
    for (x = 0; x < L; x++) gr[x] = (top[(x + 2) % L] - top[(x + L - 2) % L]) / 4;       // > 0: the surface falls toward the right (faces away from the sun)
    var strata = [], acc = 0, kk = 0;                                    // one shared stratigraphy, weak / resistant beds from the base up
    while (acc < Hh * 1.1) {
      var res = (kk & 1) ? 0 : 1; if (rnd() < 0.28) res = 1 - res;
      var th = Math.max(2, Hh * (res ? 0.05 + 0.06 * rnd() : 0.06 + 0.12 * rnd()));
      strata.push({ y0: acc, y1: acc + th, tone: (res ? (0.68 + 0.22 * rnd()) : (0.14 + 0.26 * rnd())) * (n - 1), res: res }); acc += th; kk++;
    }
    var kt = (n - 1) / 8, litW = Math.max(3, 5 * o.ws), darkW = Math.max(6, 15 * o.ws), fadeR = o.fadeRows || 12, ph0 = rnd() * TAU;
    for (y = 0; y < Hh; y++) {
      var run = 0, k, pf = -2, pfill = false;
      for (k = 0; k < 2 * L; k++) { x = k % L; var fl = top[x] <= y, ff = fid[x]; if (fl && pfill && ff === pf) run++; else run = 0; pfill = fl; pf = ff; if (k >= L) dl[x] = run; }
      run = 0; pfill = false; pf = -2;
      for (k = 2 * L - 1; k >= 0; k--) { x = k % L; fl = top[x] <= y; ff = fid[x]; if (fl && pfill && ff === pf) run++; else run = 0; pfill = fl; pf = ff; if (k < L) dr[x] = run; }
      for (x = 0; x < L; x++) {
        if (top[x] > y) continue;
        f = feats[fid[x]];
        var dip = 2.2 * Math.sin(x / L * TAU * 2 + ph0), yab = Hh - 1 - y + f.dz + dip, lay = strata[strata.length - 1];
        for (i = 0; i < strata.length; i++) if (yab < strata[i].y1) { lay = strata[i]; break; }
        var t = lay.tone + f.br * 0.55 * kt, wl = dl[x], wr = dr[x], dd = y - top[x];
        if (wl < litW) t += (1 - wl / litW) * 2.0 * kt;
        if (wr < darkW) t -= (1 - wr / darkW) * 2.6 * kt;
        if (dd < 4) { var g = gr[x]; t += (clamp(-g * 0.5, -1.5, 1.5) * (1 - dd / 4) + ((g < 0.8 && g > -0.8 && dd < 2) ? 0.8 : 0)) * kt; }
        var yr = lay.y1 - yab;                                           // rows below the top of this bed
        if (lay.res) { if (yr < 1.2) t += 1.0 * kt; } else if (yr < 1.2) t -= 1.1 * kt;
        t += 0.30 * kt * sn(x * 0.83 + f.ph + sn(y * 0.17) * 1.3);
        var idx = P + clamp(Math.floor(t + B4[y & 3][x & 3] * 0.9 + 0.5), 0, n - 1);
        if ((wl === 0 && dd > 0 && t > 2.2) || (dd === 0 && g <= 0.8)) idx = P + n - 1;             // hard 1-px rim light on the sunward edges
        d[y * L + x] = idx;
      }
    }
    for (x = 0; x < L; x++) {                                            // varnish streaks: dark vertical strokes hanging from the ledges
      if (PX.h2(x, o.seed + 41) > 0.16 || top[x] > Hh - 8) continue;
      var y0 = top[x] + 3 + Math.floor(PX.h2(x, o.seed + 43) * (Hh - top[x]) * 0.5), len = 3 + Math.floor(PX.h2(x, o.seed + 47) * 14);
      for (y = y0; y < Math.min(Hh - fadeR, y0 + len); y++) { var o2 = y * L + x; if (d[o2] > P + 1 && d[o2] < P + n) d[o2]--; }
    }
    if (o.arch) carveArch(st, feats, o, L, Hh, P, n);
    if (o.fall) carveFall(st, feats, o, L, Hh, top, fadeR);
    if (o.fade) for (y = 0; y < fadeR; y++) {                            // a mist bank at the base: dithered haze over rock AND gaps
      var ry = Hh - 1 - y, amt = 1 - y / fadeR;
      for (x = 0; x < L; x++) if ((B4[ry & 3][x & 3] + 0.5) < amt) d[ry * L + x] = o.fade;
    }
    st.top = top; return st;
  }
  function carveFall(st, feats, o, L, Hh, top, fadeR) {                 // a thin waterfall leaves a notch in the caprock and cascades down the face (index cycles with the palette)
    var best = null, bd = 1e9, i, tx = o.fallAt * L; for (i = 0; i < feats.length; i++) { var dx = Math.abs(feats[i].cx - tx); if (feats[i].hw > 12 && dx < bd) { bd = dx; best = feats[i]; } }
    if (!best) return;
    var d = st.d, x0 = ((Math.round(best.cx - best.hw * 0.3) % L) + L) % L, y0 = top[x0] + 1, y1 = Hh - fadeR - 2, y, k;
    for (y = y0; y < y1; y++) {
      var wob = Math.round(Math.sin(y * 0.21) * 0.6), c = I.rgl + 3 - ((y >> 1) & 3);
      d[y * L + ((x0 + wob + L) % L)] = c; if (y > y0 + 2 && (y & 3) !== 0) d[y * L + ((x0 + wob + 1) % L)] = I.rgl + ((c - I.rgl + 2) & 3);
    }
    for (k = 0; k < 14; k++) {                                          // spray at the foot
      var sx = x0 + Math.round((PX.h2(k, 7) - 0.5) * 8), sy = y1 - Math.round(PX.h2(k, 9) * 4), px = ((sx % L) + L) % L;
      if (B4[sy & 3][px & 3] + 0.5 < 0.7) d[sy * L + px] = I.haze + 1;
    }
  }
  function carveArch(st, feats, o, L, Hh, P, n) {                        // one natural arch through the broadest mesa
    var best = null, bd = 1e9, i, tx = (o.archAt == null ? 0.7 : o.archAt) * L; for (i = 0; i < feats.length; i++) { var dxa = Math.abs(feats[i].cx - tx); if (feats[i].hw > 22 && feats[i].hh > 40 && dxa < bd) { bd = dxa; best = feats[i]; } }
    if (!best) return;
    var d = st.d, cx = Math.round(best.cx + best.hw * 0.25), aw = Math.round(7 * o.ws + 2), ah = Math.round(best.hh * 0.30 + 4), y0 = 7, x, y;
    for (x = -aw - 1; x <= aw + 1; x++) for (y = 0; y <= ah + 2; y++) {
      var xx = ((cx + x) % L + L) % L, py = Hh - 1 - y0 - y, inside = Math.abs(x) <= aw && y <= ah * Math.sqrt(Math.max(0, 1 - (x * x) / ((aw + 0.5) * (aw + 0.5))));
      if (py < 0 || py >= Hh) continue;
      if (inside) d[py * L + xx] = 0;
    }
    for (x = -aw - 2; x <= aw + 2; x++) for (y = -1; y <= ah + 3; y++) {                       // lit inner wall on the right pillar, shaded on the left, dark under the span
      var xx2 = ((cx + x) % L + L) % L, py2 = Hh - 1 - y0 - y; if (py2 < 1 || py2 >= Hh - 1 || !d[py2 * L + xx2]) continue;
      var lft = d[py2 * L + ((xx2 + L - 1) % L)], rgt = d[py2 * L + ((xx2 + 1) % L)], upp = d[(py2 - 1) * L + xx2], dwn = d[(py2 + 1) * L + xx2];
      if (!rgt && x < 0) d[py2 * L + xx2] = Math.max(P, d[py2 * L + xx2] - 2);
      else if (!lft && x > 0) d[py2 * L + xx2] = P + n - 2;
      else if (!dwn && y0 + y > y0) d[py2 * L + xx2] = Math.max(P, d[py2 * L + xx2] - 2);
    }
  }

  // ---------- the river strip: a hazy valley floor under the ranks, a meandering silver ribbon with sand bars ----------
  function riverStrip(o) {
    var L = o.L, Hh = o.H, st = Sc.newStrip(L, Hh), d = st.d, rnd = PX.rng(o.seed), x, y, ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU], a = o.a;
    var yc = new Float32Array(L), hw = new Float32Array(L);
    for (x = 0; x < L; x++) {
      var u = x / L * TAU;
      yc[x] = o.yr + 3.4 * a * Math.sin(u * 2 + ph[0]) + 2.0 * a * Math.sin(u * 5 + ph[1]) + 1.0 * a * Math.sin(u * 11 + ph[2]);
      hw[x] = Math.max(1.6, (2.6 + 1.4 * Math.sin(u * 3 + ph[3]) + 0.7 * Math.sin(u * 8 + ph[0])) * a);
    }
    var wash = new Float32Array(L), wph = rnd() * TAU;
    for (x = 0; x < L; x++) wash[x] = Math.sin(x / L * TAU * 3 + wph) * 0.5 + Math.sin(x / L * TAU * 7 + wph * 2) * 0.3;
    for (y = 0; y < Hh; y++) for (x = 0; x < L; x++) {                   // valley floor: hazy far, warmer and darker near, strata-striped, with dry washes and scrub
      var t = y / Math.max(1, Hh - 1), nz = VN[((x >> 1) & 255) | ((y & 255) << 8)] / 255, band = ((y + Math.floor(wash[x] * 3)) % (7 + (y >> 4)) < 1) ? -0.8 : 0;
      var tone = 4.2 - t * 3.6 + (nz - 0.5) * 0.9 + band + B4[y & 3][x & 3] * 0.9 + 0.5;
      var wx0 = Math.abs(((x * 0.5 + y * 1.3 * (wash[(x + 40) % L] > 0 ? 1 : -1)) % 46) - 23);                   // dry wash channels
      if (y > o.yr + 6 && wx0 < 0.9 + t * 1.4) tone -= 1.3;
      d[y * L + x] = I.valley + clamp(Math.floor(tone), 0, 4);
      if (y > o.yr + 8 && PX.h2(x, y + o.seed) > 0.985 - t * 0.02) d[y * L + x] = I.valley;                          // scrub dots
      if (y > o.yr + 10 && PX.h2(x >> 1, y + 300) > 0.992) { d[y * L + x] = I.plant + 1; if (x + 1 < L) d[y * L + x + 1] = I.plant + 2; }
    }
    for (x = 0; x < L; x++) {                                            // far bank: a dark bluff line with a lit rim, then the water
      var top = Math.round(yc[x] - hw[x]), bot = Math.round(yc[x] + hw[x]), y2;
      for (y2 = top - 3; y2 < top; y2++) if (y2 >= 0) d[y2 * L + x] = (y2 === top - 3) ? I.valley + 4 : I.valley + (y2 === top - 1 ? 0 : 1);
      for (y = top; y <= bot; y++) {
        var rel = (y - top) / Math.max(1, bot - top), tone = rel < 0.28 ? 1 : rel < 0.55 ? 2 : rel < 0.85 ? 3 : 4;
        tone += (B4[y & 3][x & 3] + 0.5 < ((rel * 4) % 1)) ? 1 : 0;
        var cc = I.river + clamp(tone - 1, 0, 4);
        if (y > top + 1 && y < bot && PX.h2(x >> 1, y * 3 + 5) > 0.88) cc = I.rgl + ((x + y * 2) & 3);         // cycling ripples
        d[y * L + x] = cc;
      }
      d[(bot + 1) * L + x] = I.valley + 4; d[(bot + 2) * L + x] = I.valley + 3;                     // sunlit sand bar along the near bank
    }
    return st;
  }

  // ---------- clouds lit from below-left by the low sun ----------
  // A crown of overlapping puffs under an asymmetric envelope, dusty mauve on top, peach in the body and a glowing gold underside; each puff
  // keeps a lit rim on its sunward (left) edge and a shaded crescent on the right; the underside dissolves in a ragged ordered dither.
  function cloudBank(seed, w, h) {
    var rnd = PX.rng(seed), sp = new PX.Sprite(w, h), C = I.cloud, arcs = [], x, y, i, base = h - 2, peakX = w * (0.25 + 0.5 * rnd()), ax = 1;
    while (ax < w - 2) {
      var e = ax < peakX ? ax / peakX : (w - ax) / (w - peakX); e = Math.pow(clamp01(e), 0.6);
      var r = Math.max(2.5, Math.min(h * 0.32, h * (0.10 + 0.24 * e) * (0.55 + 0.9 * rnd())));
      var topY = base - (h * 0.16 + h * 0.66 * Math.pow(e, 1.5) * (0.72 + 0.28 * rnd()));
      arcs.push({ x: clamp(ax + r * 0.8, r + 1, w - r - 1), cy: Math.max(r * 0.85 + 1, topY + r * 0.85), r: r, ry: r * 0.85 });
      ax += r * (0.7 + 0.7 * rnd());
    }
    arcs.sort(function (p, q) { return p.cy - q.cy; });
    function inA(A, px, py) { var dx = (px + 0.5 - A.x) / A.r, dy = (py + 0.5 - A.cy) / A.ry; return dx * dx + dy * dy <= 1; }
    var top = new Float32Array(w).fill(1e9), bot = new Int16Array(w);
    for (i = 0; i < arcs.length; i++) for (x = Math.max(0, Math.ceil(arcs[i].x - arcs[i].r * 0.9)); x <= Math.min(w - 1, Math.floor(arcs[i].x + arcs[i].r * 0.9)); x++) if (arcs[i].cy < top[x]) top[x] = arcs[i].cy;
    for (x = 0; x < w; x++) bot[x] = base - Math.round(1.2 + 1.3 * Math.sin(x * 0.13 + seed) + 0.8 * Math.sin(x * 0.29 + seed * 2));
    for (x = 0; x < w; x++) if (top[x] < 1e8) for (y = Math.max(0, Math.round(top[x])); y <= bot[x]; y++) {
      var fromBot = bot[x] - y, b = B4[y & 3][x & 3] + 0.5, span = Math.max(4, bot[x] - top[x]), v = (y - top[x]) / span, c;
      if (fromBot < 2) c = b < 0.55 ? C + 4 : C + 3;
      else if (v > 0.66) c = b < 0.5 ? C + 3 : C + 2;
      else if (v > 0.36) c = b < 0.45 ? C + 2 : C + 1;
      else c = b < 0.4 ? C + 1 : C;
      if (fromBot < 3 && ((x + y) & 1) && v > 0.4) c = C + 4;
      sp.d[y * w + x] = c;
    }
    for (i = 0; i < arcs.length; i++) {                                  // every puff keeps its own lit sunward rim and shaded crescent over the ones behind it
      var A = arcs[i], sd = Math.max(1, Math.round(A.ry * 0.4));
      for (y = Math.max(0, Math.floor(A.cy - A.ry)); y <= Math.min(h - 1, Math.ceil(A.cy + A.ry)); y++) for (x = Math.max(0, Math.floor(A.x - A.r)); x <= Math.min(w - 1, Math.ceil(A.x + A.r)); x++) {
        if (!inA(A, x, y) || y > bot[x] - 2) continue;
        var rel = (y + 0.5 - (A.cy - A.ry)) / (2 * A.ry), bb = B4[y & 3][x & 3] + 0.5, cc = rel < 0.3 ? (bb < 0.45 ? 1 : 0) : rel < 0.55 ? 1 : rel < 0.8 ? (bb < 0.5 ? 2 : 1) : 2;
        if (!inA(A, x, y + 1)) cc = 4; else if (!inA(A, x - 1, y + 1) && rel > 0.4) cc = 3;
        if (!inA(A, x - 1, y) || !inA(A, x - 1, y - 1)) cc = Math.min(4, cc + 2);
        else if (!inA(A, x - 2, y - 1)) cc = Math.min(4, cc + 1);
        else if (!inA(A, x + sd, y - sd)) cc = Math.max(0, cc - 1);
        sp.d[y * w + x] = C + cc;
      }
    }
    return sp;
  }
  function wisp(seed, w, hgt) {                                          // a long thin streak of high cloud with dithered ends
    var sp = new PX.Sprite(w, hgt), x, y;
    for (y = 0; y < hgt; y++) for (x = 0; x < w; x++) {
      var ex = (x + 0.5 - w / 2) / (w / 2), ey = (y + 0.5 - hgt / 2) / (hgt / 2), e = ex * ex + ey * ey * 0.85; if (e >= 1) continue;
      var dens = (1 - e) * (0.85 + 0.15 * Math.sin(x * 0.17 + seed));
      if (B4[y & 3][x & 3] + 0.5 < dens * 1.4) sp.d[y * w + x] = (y < hgt * 0.5 ? I.cloud + 2 : I.cloud + 3);
    }
    return sp;
  }

  function build(S) {
    var key = S.w + "x" + S.h + "@" + (S.adj || 1); if (built === key) return; built = key; ST.skyKey = "";
    var a = S.adj || 1, hy = S.horizonY, i;
    function A(v) { return Math.max(1, Math.round(v * a)); }
    ST.a = a;
    ST.f0 = mesaStrip({ L: 1300, H: Math.round(hy * 0.34), seed: 4, ramp: I.f0, n: 4, ws: 1.5 * a, gap: 26 * a, hMin: 0.30, hMax: 0.78, pSpire: 0.0, pButte: 0.22, fade: I.haze + 1, fadeRows: A(9) });
    ST.f1 = mesaStrip({ L: 1200, H: Math.round(hy * 0.52), seed: 9, ramp: I.f1, n: 5, ws: 1.25 * a, gap: 34 * a, hMin: 0.28, hMax: 0.92, pSpire: 0.07, pButte: 0.30, fade: I.haze, fadeRows: A(9), arch: true, archAt: 0.36, fall: 1, fallAt: 0.2 });
    ST.river = riverStrip({ L: 1024, H: Math.max(S.h - hy, 60) + A(20), seed: 6, yr: A(11), a: a });
    ST.f2 = mesaStrip({ L: 1050, H: Math.round(hy * 0.30), seed: 15, ramp: I.f2, n: 6, ws: a, gap: 60 * a, hMin: 0.22, hMax: 0.80, pSpire: 0.12, pButte: 0.34, fade: I.valley + 1, fadeRows: A(5), fall: 1, fallAt: 0.83 });
    ST.f3 = mesaStrip({ L: 900, H: Math.round(hy * 0.22), seed: 21, ramp: I.f3, n: 7, ws: 0.9 * a, gap: 100 * a, hMin: 0.2, hMax: 0.8, pSpire: 0.16, pButte: 0.3, fade: I.f3 + 1, fadeRows: A(4) });
    CL = [];
    // [width (of screen), height (of width), y (of horizon), speed]
    var cspec = [[0.36, 0.20, 0.10, 1.0], [0.22, 0.24, 0.22, 0.7], [0.30, 0.18, 0.34, 1.3], [0.18, 0.26, 0.44, 0.6], [0.26, 0.19, 0.04, 0.9]];
    for (i = 0; i < cspec.length; i++) {
      var cw = Math.round(clamp(S.w * cspec[i][0], 50, 300)), ch = Math.round(clamp(cw * cspec[i][1], 10, 56));
      CL.push({ sp: cloudBank(500 + i * 31, cw, ch), x: PX.h1(i * 7 + 2) * 1400, y: cspec[i][2], v: 0.5 + cspec[i][3] * 0.9 });
    }
    for (i = 0; i < 4; i++) CL.push({ sp: wisp(700 + i * 13, Math.round(clamp(S.w * (0.28 + 0.2 * PX.h1(i * 3 + 1)), 60, 260)), 3 + (i & 1)), x: PX.h1(i * 11 + 5) * 1400, y: 0.06 + 0.46 * PX.h1(i * 17 + 3), v: 0.3 + 0.5 * PX.h1(i * 5 + 2) });
  }

  // the low sun on the left; it sinks and warms as the gorge is climbed out of (altitude 2500 -> 3200 m)
  function sunPos(S) {
    var a = S.adj || 1, vp = sm((S.altitude - 2500) / 700), sh = Math.round((1 - S.openingT) * S.h * 0.04);
    return { x: Math.round(S.w * 0.2), y: Math.round(S.horizonY * (0.40 + 0.16 * vp)) + sh, r: Math.round(clamp(S.h / a * 0.04, 9, 17) * a) };
  }
  R.light = function (S) { var p = sunPos(S); return { x: p.x, y: p.y, k: 0.85, col: [255, 204, 140], ambient: [150, 108, 128], bright: 0.86, ground: [156, 88, 58] }; };

  // altitude: the afternoon warms toward the coming sunset (the sky ramp only; the rock ramps already carry the warm light)
  R.palette = function (pal, S) {
    var t = S.reduced ? 0 : S.tSec, f = Math.round(sm((S.altitude - 2500) / 700) * 16) / 16;
    if (f !== skyF && SKY0) {
      skyF = f;
      pal.setRamp("sky", SKY0.map(function (c, i) { var k = f * (0.10 + 0.05 * (i / 14)); return [c[0] + (255 - c[0]) * k * 0.9, c[1] + (150 - c[1]) * k * (i > 7 ? 1 : 0.4), c[2] + (96 - c[2]) * k * (i > 7 ? 1 : 0.2)]; }));
    }
    var q = Math.floor(t * 3.2) % 4, g = [[247, 220, 174], [255, 236, 201], [255, 248, 228], [255, 236, 201]];
    pal.setRamp("rgl", [g[q], g[(q + 1) % 4], g[(q + 2) % 4], g[(q + 3) % 4]]);
  };

  R.backdrop = function (fb, S, pal) {
    build(S);
    var w = fb.w, h = fb.h, d = fb.d, a = S.adj || 1, sh = Math.round((1 - S.openingT) * S.h * 0.12), hy = S.horizonY + sh, al = S.altitude, t = S.reduced ? 0 : S.tSec, i;
    var vp = sm((al - 2500) / 700), L = sunPos(S);
    function A(v) { return Math.round(v * a); }
    var skey = w + "x" + h + "|" + hy + "|" + L.x + "," + L.y + "|" + L.r;
    if (ST.skyKey !== skey || !ST.sky || ST.sky.length !== w * h) {
      var idx = []; for (i = 0; i < 14; i++) idx.push(I.sky + i);
      Sc.bands(fb, 0, hy + A(26), idx, 4);
      if (hy + A(26) < h) fb.fillRect(0, hy + A(26), w, h - hy - A(26), I.sky + 13);
      lift(fb, L.x, L.y, Math.round(clamp(w * 0.52, 70, 280)), Math.round(clamp(hy * 0.8, 60, 220)), 2.7, I.sky, I.sky + 14);
      Sc.sun(fb, L.x, L.y, L.r, { core: I.sun + 4, disc: I.sun + 3, rim: I.sun + 2, glow1: I.sun + 1, glow2: I.sun }, 3);
      if (!ST.sky || ST.sky.length !== w * h) ST.sky = new Uint8Array(w * h);
      ST.sky.set(fb.d); ST.skyKey = skey;
    } else d.set(ST.sky);
    for (i = 0; i < CL.length; i++) {
      var c = CL[i], span = w + c.sp.w + 60, cx = ((c.x - t * c.v - al * 0.05) % span + span) % span - c.sp.w;
      fb.blit(c.sp, Math.round(cx), Math.round(c.y * hy), 0);
    }
    var sink = vp * S.h;                                                 // nearer ranks sink faster as we climb out of the gorge
    var y0 = hy - A(3) + Math.round(sink * 0.02);
    Sc.blitStrip(fb, ST.f0, al * 0.03 + 200, y0 - ST.f0.h + 1);
    fb.fillRect(0, y0 + 1, w, Math.max(0, h - y0 - 1), I.haze + 1);
    var y1 = hy + A(4) + Math.round(sink * 0.04);
    Sc.blitStrip(fb, ST.f1, al * 0.07 + 90, y1 - ST.f1.h + 1);
    fb.fillRect(0, y1 + 1, w, Math.max(0, h - y1 - 1), I.haze);
    var y2 = hy + A(15) + Math.round(sink * 0.05);
    Sc.blitStrip(fb, ST.f2, al * 0.16 + 300, y2 - ST.f2.h + 1);
    fb.fillRect(0, y2 + 1, w, Math.max(0, h - y2 - 1), I.valley + 1);
    if (!S.reduced) {                                                    // a faint heat shimmer: a few rows of the far ranks slide one pixel now and then
      for (var sy = Math.max(1, hy - A(16)); sy < Math.min(h, hy + A(6)); sy++) {
        var wv = Math.sin(t * 1.7 + sy * 0.9 + al * 0.004); if (wv < 0.72) continue;
        var rw = sy * w; d.copyWithin(rw + 1, rw, rw + w - 1);
      }
    }
    var yr = y2 + A(1);
    Sc.blitStrip(fb, ST.river, al * 0.12 + 40, yr);
    if (yr + ST.river.h < h) fb.fillRect(0, yr + ST.river.h, w, h - yr - ST.river.h, I.valley);
    var y3 = hy + A(60) + Math.round(sink * 0.11);
    Sc.blitStrip(fb, ST.f3, al * 0.36 + 500, y3 - ST.f3.h + 1);
    fb.fillRect(0, y3 + 1, w, Math.max(0, h - y3 - 1), I.f3 + 1);
    // glitter path under the sun on the river
    if (!S.reduced) for (var gy = yr; gy < Math.min(h, yr + A(38)); gy++) {
      var spread = A(6) + (gy - yr) * 0.5;
      for (var gx = Math.max(0, Math.round(L.x - spread)); gx < Math.min(w, Math.round(L.x + spread)); gx++) {
        var v = d[gy * w + gx]; if (v < I.river || v > I.river + 4) continue;
        var q = 1 - Math.abs(gx - L.x) / spread, hv = PX.h2(gx * 3 + (gy >> 1), gy + 17);
        if (hv < q * 0.5) d[gy * w + gx] = I.rgl + ((gx + gy) & 3); else if (hv < q * 0.9) d[gy * w + gx] = LIT[v];
      }
    }
  };

  // ---------- ground: a cut through the gorge wall, layered parallel to the slope ----------
  // bed thickness in world depth units: crust, cross-bedded sandstone, red mudstone, limestone, Redwall cliffs, shale, sandstone, red beds,
  // conglomerate; the dark schist below is endless. Layer depths use a gentler zoom (depthZoom) so a far view still shows the strata.
  var LT = [12, 54, 46, 26, 66, 26, 54, 42, 30], AMP = [0.8, 2.6, 2.8, 2.0, 3.2, 2.0, 2.8, 2.2, 5.5], BND = new Int16Array(12);
  var SBT = [0.3, -0.5, 0.6, -0.2, 0.5, -0.6, 0.1, -0.4];                     // per-sub-bed tone offsets for the cross-bedded sandstones

  R.ground = function (fb, S, pal) {
    build(S);
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, sc = S.scroll, lipA = S.lip, adj = S.adj || 1, t = S.reduced ? 0 : S.tSec;
    var ds = Math.min(depthZoom(S), 0.56 * adj), dsn = ds / (0.42 * adj), qoff = Math.round(sc * zoom - S.ztx), heroX = Math.round(S.ztx + S.anchorX * zoom);
    var SA = I.orng, OR = I.orng, RD = I.red, LM = I.lime, SH = I.shale, SC = I.schist, AM = I.amber, PL = I.plum, x, y, k, o;
    for (x = 0; x < w; x++) {
      var lip = lipA[x]; if (lip >= h) continue;
      var wxF = (x - S.ztx) / zoom + sc, qx = x + qoff, acc = 0, prev = 0, e1 = sn(wxF * 0.0113 + 1.3), e2 = sn(wxF * 0.0071 + 4.1), e3 = sn(wxF * 0.019 + 2.2);
      for (k = 0; k < 9; k++) {
        acc += LT[k];
        var wob = AMP[k] * (0.55 * ((k & 1) ? e1 : e2) + 0.45 * e3 * ((k % 3) ? 1 : -1) + 1.3 * jag(wxF, 26 + 9 * k, 11 + k)) * dsn;
        BND[k] = Math.max(prev + 2, Math.round(acc * ds + wob)); prev = BND[k];
      }
      y = Math.max(0, lip); var dd = y - lip, L = 0; while (L < 9 && dd >= BND[L]) L++;
      var blk, fx, bay, sw1 = 2 * sn(wxF * 0.03 + 1.7);
      for (; L <= 9 && y < h; L++) {
        var yEnd = L < 9 ? Math.min(h, lip + BND[L]) : h, ls0 = L ? BND[L - 1] : 0, th = (L < 9 ? BND[L] : 400) - ls0, idx, tone, lt, sb, v, lp, nzv;
        if (L === 0) {                                                  // baked crust: cracked plates, a lit rim
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)];
            blk = Math.floor((qx + 5) / 12); fx = qx + 5 - blk * 12;
            tone = (dd === 0 ? 7 : dd === 1 ? 6 : 5.4 - dd * 0.55) + (NZ[(blk * 7) & 255] / 255 - 0.5) * 1.3 + bay * 0.55;
            idx = SA + clamp(Math.floor(tone + 0.5), 2, 7);
            if (fx === 0 && dd > 0) idx = SA + 1; else if (fx === 1 && dd > 0 && idx > SA + 3) idx = SA + 6;
            d[o] = idx;
          }
        } else if (L === 1 || L === 6) {                                // cross-bedded sandstone: sub-beds with curved diagonal foreset lines
          var base = L === 1 ? 4.9 : 3.8, pshift = L === 1 ? 0 : 7;
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            sb = Math.floor((lt + sw1) / 11); v = lt + sw1 - sb * 11;
            tone = base - (lt / th) * 1.0 + SBT[(sb + L) & 7] + bay * 0.55;
            lp = ((((qx * 2 + Math.floor(v * v * 0.11) * ((sb & 1) ? 1 : -1) + sb * 11 + pshift) % 15) + 15) % 15);
            if (lp === 0) tone += 1.9; else if (lp === 1) tone -= 0.9;
            if (lt === 0) tone += 1.4; else if (v < 1.5 && sb > 0) tone -= 1.5;
            d[o] = OR + clamp(Math.floor(tone + 0.5), 0, 7);
          }
        } else if (L === 2 || L === 7) {                                // red mudstone: mottled, laminated, pale reduction spots
          var rb = L === 2 ? 3.7 : 2.7;
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            nzv = VN[((qx >> 1) & 255) | (((dd >> 1) & 255) << 8)] / 255;
            tone = rb + (nzv - 0.5) * 1.7 - (lt / th) * 0.6 + bay * 0.55;
            if (((dd + (qx >> 3)) & 7) === 0) tone -= 0.9;
            if (lt === 0) tone += 1.4; else if (lt === 1) tone -= 0.6;
            idx = RD + clamp(Math.floor(tone + 0.5), 0, 6);
            if (lt > 3 && NZ[(((qx >> 1) & 255) | (((dd >> 1) & 255) << 8)) ^ 0x5a00] > 250) idx = ((qx & 1) || (dd & 1)) ? LM + 3 : LM + 4;
            d[o] = idx;
          }
        } else if (L === 3) {                                           // limestone: pale, smooth, a hard lit lip and a dark underside
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            tone = 3.6 + (VN[((qx >> 1) & 255) | (((dd >> 1) & 255) << 8)] / 255 - 0.5) * 1.5 - (lt / th) * 0.9 + bay * 0.55;
            if (lt === 0) tone = 5.6; else if (lt === 1) tone += 0.7; else if (y === yEnd - 1) tone = 0.4;
            d[o] = LM + clamp(Math.floor(tone + 0.5), 0, 5);
          }
        } else if (L === 4) {                                           // Redwall: a massive red-stained cliff: irregular fractures, varnish streaks, faint bedding
          var rowH = Math.max(10, Math.round(30 * dsn)), lastBi = -99999, bwid = 30, off = 0, cb = 0, fxx = 0, jt = 0, bt = 0, lastCb = -99999, bedLine = 0, nk = 0;
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            var bi = (lt / rowH) | 0, fy = lt - bi * rowH;
            if (bi !== lastBi) {
              lastBi = bi; bwid = 26 + ((bi * 11) % 23); off = (bi * 17) % 29; cb = Math.floor((qx + off) / bwid); fxx = qx + off - cb * bwid;
              jt = PX.h2(cb * 5 + bi, 71) > 0.32; bt = PX.h2(cb, bi + 5) - 0.5; bedLine = PX.h2(cb, bi + 9) > 0.4; nk = NZ[((qx * 3) & 255) | (((bi * 41) & 255) << 8)] > 205;
            }
            tone = 3.7 + bt * 0.9 + (VN[((qx >> 1) & 255) | (((dd >> 1) & 255) << 8)] / 255 - 0.5) * 1.6 - (fy / rowH) * 0.7 + bay * 0.55;
            if (fy === 0 && bedLine) tone -= 0.9;                                                    // faint bedding
            if (nk && fy > 2 && fy < rowH * 0.8) tone -= 1.2;                                        // desert varnish streaks
            var ii = (tone + 0.5) | 0; if (ii < 0) ii = 0;
            idx = tone > 4.9 ? LM + (ii - 2 < 2 ? 2 : ii - 2 > 5 ? 5 : ii - 2) : RD + (ii > 6 ? 6 : ii);
            if (jt && fxx === 0) idx = RD; else if (jt && fxx === 1 && fy < rowH - 3) idx = RD + 5;
            d[o] = idx;
          }
        } else if (L === 5) {                                           // shale: thin green-grey laminae
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            tone = 2.5 + (((lt + (qx >> 4)) & 3) === 0 ? -0.9 : 0.5) + (VN[((qx >> 1) & 255) | (((dd >> 1) & 255) << 8)] / 255 - 0.5) * 1.1 + bay * 0.5;
            if (lt === 0) tone = 4.4; else if (lt === 1) tone -= 0.5;
            d[o] = SH + clamp(Math.floor(tone + 0.5), 0, 4);
          }
        } else if (L === 8) {                                           // conglomerate matrix (the cobbles are drawn on top)
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            tone = 3.3 + (VN[((qx >> 1) & 255) | (((dd >> 1) & 255) << 8)] / 255 - 0.5) * 1.4 + bay * 0.6; if (lt === 0) tone += 1.2;
            d[o] = RD + clamp(Math.floor(tone + 0.5), 0, 5);
          }
        } else {                                                        // the schist: folded violet foliation bands; below them the earth glows
          var g0 = 250 * ds, gstep = Math.max(12, 62 * ds), sA = 6 * sn(qx * 0.043 + 2.0), sB = qx * 0.11 + 0.7, lastBand = -99999, bh = 0;
          for (; y < yEnd; y++) {
            dd = y - lip; o = y * w + x; bay = BF[((y & 3) << 2) | (x & 3)]; lt = dd - ls0;
            var fw = dd + sA + 3.4 * sn(sB + dd * 0.02), band = Math.floor(fw * (1 / 6)), fr = fw - band * 6;
            if (band !== lastBand) { lastBand = band; bh = PX.h2(band, 93); }
            tone = 1.0 + bh * 1.9 + bay * 0.5; if (fr < 1) tone += 1.3; else if (fr < 2) tone += 0.5;
            if (lt === 0) tone += 2;
            var ii = (tone + 0.5) | 0; idx = SC + (ii < 0 ? 0 : ii > 4 ? 4 : ii);
            var gq = (lt - g0) / gstep + 0.5 * sn(qx * 0.03 + lt * 0.02);                            // glow contours: banded steps with a short dithered edge
            if (gq > 0) {
              var gk = gq | 0, gf = gq - gk, lev = gk + ((gf > 0.8 && bay + 0.5 < (gf - 0.8) / 0.2) ? 1 : 0);
              if (lev > 0) { var gi = lev - 1 > 4 ? 4 : lev - 1; idx = gi < 3 ? PL + gi : AM + 1; if (gi >= 1 && fr < 1) idx = DRK[idx]; }
            }
            d[o] = idx;
          }
        }
      }
    }
    features(fb, S, ds, heroX, t);
    surface(fb, S, ds, heroX, t);
  };

  // ---------- fossils and relics sealed in the beds ----------
  function ammonite(fb, cx, cy, r) {                                   // a coiled shell: ribbed spiral on a pale bed
    for (var a = 0; a < 15; a += 0.13) {
      var rad = 0.7 + a * (r / 15), px = Math.round(cx + Math.cos(a) * rad), py = Math.round(cy + Math.sin(a) * rad * 0.94), rib = ((a * 2.3) | 0) & 1;
      fb.set(px, py, rib ? I.lime + 5 : I.lime + 4); fb.set(px + 1, py, I.lime + 2); fb.set(px, py + 1, I.lime + 1);
    }
    fb.set(Math.round(cx), Math.round(cy), I.lime + 5);
  }
  function logRings(fb, cx, cy, r) {                                    // a petrified log seen end-on: growth rings in agate pinks and ambers
    for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) {
      var dd = Math.sqrt(x * x + y * y * 1.1); if (dd > r) continue;
      var ring = Math.floor(dd * 1.15) & 3, c = ring === 0 ? I.pink + 2 : ring === 1 ? I.amber + 3 : ring === 2 ? I.pink + 1 : I.amber + 1;
      if (dd > r - 1.1) c = I.pink; else if (dd < 1.2) c = I.amber + 5;
      fb.set(cx + x, cy + y, c);
    }
    fb.set(cx - Math.round(r * 0.5), cy - Math.round(r * 0.6), I.pink + 3);
  }
  var RELICS = [
    ["..aa......", ".abbaaaaa.", "abccbbbbba", ".abbbbbbbb", "..aabbaaa."],                                                                   // 0 trilobite (segmented oval)
    ["a....bb....a", "ab..bccb..ba", ".abbcccccbb.a", "..aabbbbba...", "...abbbba....", "..abb..bba..", ".abb....bba.", "ab........ba"],      // 1 crossed bones
    ["..aabbbb..", ".abcccccb.", "abccdcccbb", "abcdddcccb", ".abcdddcb.", "..abcccb..", "...aabb..."],                                    // 2 potsherd with a painted band
    ["...a...", "..aba..", "..abba.", ".abcba.", ".abccba", "abcccba", "abccba.", ".abba..", "..aa..."],                                    // 3 flint arrowhead
    ["..a.....a..", ".abaaaaaba.", "abbccccbbba", "abcdccdcbba", "abcccccccba", ".abcaaacba.", "..abbbbba..", "..ab.a.ba..", "..a.....a.."],  // 4 horned skull
    ["aaaaaaaaaaaa", "abbbbbbbbbba", "abbaaaaaabba", "abba.bbb.bba", "abba.b.a.bba", "abba.b.bbbba", "abba.b.....a", "abbaabbbbbba", "abbbbbbbbbba", "aaaaaaaaaaaa"]   // 5 a carved stone with a spiral
  ];
  var RMAP = null;
  function relic(fb, n, x, y, flip) {
    if (!RMAP) RMAP = [{ a: I.lime + 1, b: I.lime + 3, c: I.lime + 5, d: I.lime + 4 }, { a: I.lime + 1, b: I.lime + 4, c: I.lime + 5 }, { a: I.red + 1, b: I.orng + 3, c: I.orng + 5, d: I.orng + 1 },
      { a: I.shale + 1, b: I.shale + 3, c: I.lime + 5 }, { a: I.lime + 1, b: I.lime + 4, c: I.lime + 5, d: I.red + 1 }, { a: I.lime + 1, b: I.lime + 3 }];
    var rows = RELICS[n]; bmp(fb, rows, RMAP[n], x, y, flip);
    if (n === 5) for (var yy = 3; yy < 8; yy++) for (var xx = 4; xx < 8; xx++) if (rows[yy].charAt(xx) === "b") fb.set(x + xx, y + yy, I.lime + 5);
  }
  function geode(fb, cx, cy, r, seed, ramp, warm) {                                 // a pocket in the rock with a cluster of amber crystals and a warm halo
    var x, y, w = fb.w, h = fb.h, d = fb.d, R2 = r * 2.6;
    for (y = -Math.ceil(R2); y <= Math.ceil(R2); y++) for (x = -Math.ceil(R2); x <= Math.ceil(R2); x++) {          // halo: the rock around warms one step
      var px = cx + x, py = cy + y; if (px < 0 || py < 0 || px >= w || py >= h) continue;
      var q = 1 - (x * x + y * y * 1.3) / (R2 * R2); if (q <= 0 || B4[py & 3][px & 3] + 0.5 > q * 0.9) continue;
      var v = d[py * w + px]; if (v >= I.orng && v <= I.orng + 7) continue; if (v >= I.red && v <= I.red + 6) d[py * w + px] = I.orng + Math.max(0, v - I.red - 2);
    }
    for (y = -r; y <= 1; y++) for (x = -Math.round(r * 1.3); x <= Math.round(r * 1.3); x++) {
      var e = (x * x) / (r * r * 1.7) + (y * y) / (r * r); if (e > 1) continue;
      fb.set(cx + x, cy + y, e > 0.72 ? ((x + y < 0) ? I.lime + 4 : I.red) : I.schist + 1);
    }
    crystals(fb, cx, cy, ramp, seed, { n: 3 + (seed & 1) + ((seed >> 1) & 1), len: Math.max(9, Math.round(r * (2.6 + 0.9 * PX.h1(seed * 3 + 2)))), hw: Math.max(1.8, r * (0.28 + 0.1 * PX.h1(seed * 5 + 1))), lean: 0.45 + 0.35 * PX.h1(seed * 7 + 3), spread: Math.max(3, r * 0.8) });
  }
  function cave(fb, cx, cy, rx, ry, seed) {                             // a dark alcove: a lit lip above, a shaded lower rim, amber glow pooling on the floor
    var x, y;
    for (y = -ry - 1; y <= ry + 1; y++) for (x = -rx - 1; x <= rx + 1; x++) {
      var e = (x * x) / ((rx + 1) * (rx + 1)) + (y * y) / ((ry + 1) * (ry + 1)); if (e > 1) continue;
      var ei = (x * x) / (rx * rx) + (y * y) / (ry * ry), c;
      if (ei > 1) c = (y < 0 && x < rx * 0.4) ? I.lime + 4 : (y < 0 ? I.lime + 2 : I.red);
      else { var g = (y + ry) / (ry * 2); c = g > 0.8 ? I.amber + 2 : g > 0.66 ? ((B4[(cy + y) & 3][(cx + x) & 3] + 0.5 < (g - 0.66) / 0.14) ? I.amber + 1 : I.plum + 1) : g > 0.5 ? ((B4[(cy + y) & 3][(cx + x) & 3] + 0.5 < (g - 0.5) / 0.16) ? I.plum : I.ink) : I.ink; }
      fb.set(cx + x, cy + y, c);
    }
  }
  function dike(fb, x0, y0, len, ang, thick, seed) {                     // a pegmatite dike: a swelling and pinching pink vein with ragged edges, a pale core, a lit upper edge, small offshoots
    var x = x0, y = y0, k, q, P = I.pink, nx = PX.h1(seed) * 100;
    for (k = 0; k < len; k++) {
      ang += (PX.h2(seed, k + 720) - 0.5) * 0.16; x += Math.cos(ang); y += Math.sin(ang);
      var tp = Math.pow(Math.sin(Math.PI * (k + 1) / (len + 1)), 0.5), sw = 0.6 + 0.8 * vn2(k * 0.11 + nx, seed * 0.3, 5), th = Math.max(0.6, thick * tp * sw), hh = Math.floor(th), ix = Math.round(x), iy = Math.round(y);
      var jl = PX.h2(seed * 3 + k, 71) < 0.3 ? 1 : 0, jr = PX.h2(seed * 5 + k, 73) < 0.3 ? 1 : 0;
      for (q = -hh - 1 - jl; q <= hh + 1 + jr; q++) {
        var a2 = Math.abs(q), tone = a2 > hh ? 0 : (a2 === hh ? 1 : (a2 <= hh * 0.4 ? 3 : 2));
        if (q < 0 && a2 === hh && hh > 0) tone = 3;
        if (a2 <= hh * 0.3 && th > 2 && (k % 7) < 4) tone = 4;
        fb.set(ix, iy + q, P + tone);
      }
      if (k > 12 && k % 23 === 0 && PX.h2(seed, k + 90) > 0.4) { var bx = ix, by = iy, bd = PX.h2(seed, k + 91) < 0.5 ? -1 : 1; for (var s = 1; s < 7; s++) { bx += bd; by += (s & 1) ? 0 : -bd; fb.set(bx, by, s < 5 ? P + 2 : P + 1); fb.set(bx, by - 1, P + 3); } }
    }
  }
  function oldStone(fb, cx, cy, r, seed) {                              // a stone lost long ago, sealed deep with a warm halo and a crack
    var w = fb.w, h = fb.h, d = fb.d, x, y, R2 = r * 2.2;
    for (y = -Math.ceil(R2); y <= Math.ceil(R2); y++) for (x = -Math.ceil(R2); x <= Math.ceil(R2); x++) {
      var px = cx + x, py = cy + y; if (px < 0 || py < 0 || px >= w || py >= h) continue;
      var q = 1 - Math.sqrt(x * x + y * y) / R2; if (q <= 0 || B4[py & 3][px & 3] + 0.5 > q * 1.1) continue;
      var v = d[py * w + px]; if (v >= I.schist && v <= I.schist + 5) d[py * w + px] = I.plum + (q > 0.55 ? 1 : 0);
    }
    for (y = -r; y <= r; y++) for (x = -r; x <= r; x++) {
      var d2 = x * x + y * y; if (d2 > r * r) continue;
      var lit = (-(x * 0.7 + y * 0.7)) / r, tone = lit > 0.5 ? 4 : lit > 0.1 ? 3 : lit > -0.35 ? 2 : 1;
      if (d2 > (r - 1) * (r - 1)) tone = lit > 0.3 ? 3 : 0;
      if (Math.abs(x - Math.round(y * 0.45) - 1) < 1 && y > -r * 0.7 && y < r * 0.55) tone = 0;
      fb.set(cx + x, cy + y, I.lime + tone);
    }
  }

  function features(fb, S, ds, heroX, t) {
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, sc = S.scroll, lipA = S.lip, a = S.adj || 1, c, r, kk;
    var wl = (0 - S.ztx) / zoom + sc, wr = (w - S.ztx) / zoom + sc, keep = clamp((S.zoom / a - 0.08) / 0.34, 0.3, 1);
    function sx(wx) { return Math.round(S.ztx + (wx - sc) * zoom); }
    function lipAt(x) { return lipA[clamp(x, 0, w - 1)]; }
    // stones: rare in the soft beds, boulders in the schist
    var cw = 30, chh = 24;
    for (c = Math.floor(wl / cw) - 1; c <= Math.ceil(wr / cw) + 1; c++) for (r = 1; r < 24; r++) {
      var du = r * chh + PX.h2(c, r + 43) * chh, hh = PX.h2(c * 3 + 1, r * 5 + 2), pr;
      if (du < 30 || (du > 326 && du < 356)) continue;
      pr = du < 112 ? 0.05 : du < 204 ? 0.06 : du < 326 ? 0.05 : 0.07;
      if (hh > pr * keep) continue;
      var px = sx(c * cw + PX.h2(c, r + 41) * cw); if (px < -10 || px > w + 10) continue;
      var py = Math.round(lipAt(px) + du * ds); if (py < -8 || py > h + 8) continue;
      var rad = Math.max(1.6, (2.4 + 3.8 * PX.h2(c, r + 47)) * ds * 1.55), pick = PX.h2(c, r + 49);
      stone(fb, px, py, rad * 1.25, rad, du > 356 ? I.schist : (pick < 0.4 ? I.lime : pick < 0.72 ? I.orng : I.red), c * 13 + r, du > 356 ? 4 : 5);
    }
    var ccw = 13, cch = 11;                                            // the conglomerate: densely packed rounded cobbles
    for (c = Math.floor(wl / ccw) - 1; c <= Math.ceil(wr / ccw) + 1; c++) for (r = 0; r < 3; r++) {
      var cdu = 330 + r * cch + PX.h2(c, r + 143) * cch;
      if (PX.h2(c * 5 + r, 145) > 0.86) continue;
      var cx0 = sx(c * ccw + PX.h2(c, r + 141) * ccw); if (cx0 < -6 || cx0 > w + 6) continue;
      var cy0 = Math.round(lipAt(cx0) + cdu * ds); if (cy0 < -6 || cy0 > h + 6) continue;
      var pk2 = PX.h2(c, r + 147), cr = Math.max(1.5, (2.0 + 2.2 * PX.h2(c, r + 149)) * ds * 1.7);
      stone(fb, cx0, cy0, cr * 1.2, cr, pk2 < 0.3 ? I.lime : pk2 < 0.55 ? I.shale : pk2 < 0.8 ? I.orng : I.red, c * 7 + r, pk2 < 0.55 ? 4 : 5);
    }
    // cracks: dark hairlines with a lit right edge, running down from the crust through the sandstone and red beds
    var kc = 60;
    for (c = Math.floor(wl / kc) - 1; c <= Math.ceil(wr / kc) + 1; c++) {
      if (PX.h1(c * 13 + 7) < 1 - 0.5 * keep) continue;
      var kx = sx(c * kc + PX.h1(c * 5 + 3) * kc); if (kx < -4 || kx > w + 4 || Math.abs(kx - heroX) < 26 * zoom + 8) continue;
      var ky = lipAt(kx) + Math.round(4 * ds), len = Math.round((22 + PX.h1(c * 11 + 9) * 60) * ds), cxp = kx;
      for (kk = 0; kk < len; kk++) {
        if (PX.h2(c, kk + 300) < 0.34) cxp += PX.h2(c, kk + 500) < 0.5 ? -1 : 1;
        fb.set(cxp, ky + kk, I.red); if (kk < len - 3) fb.set(cxp + 1, ky + kk, I.orng + 5);
        if (kk > 6 && kk % 13 === 0 && PX.h2(c, kk + 700) > 0.5) { var bx = cxp, bd = PX.h2(c, kk + 710) < 0.5 ? -1 : 1; for (var bs = 1; bs < 7; bs++) { bx += bd; fb.set(bx, ky + kk + (bs >> 1), I.red); } }
      }
    }
    // fossils and relics: shells, bones, sherds, points and a carved stone; sealed in the limestone, sandstone and shale
    var rc = 150;
    for (c = Math.floor(wl / rc) - 1; c <= Math.ceil(wr / rc) + 1; c++) for (r = 0; r < 3; r++) {
      if (PX.h2(c * 5 + r, 181) < 1 - 0.5 * keep) continue;
      var rx = sx(c * rc + PX.h2(c, r + 182) * rc), rdu = 78 + r * 84 + PX.h2(c, r + 183) * 70; if (rx < -16 || rx > w + 16) continue;
      var ry = Math.round(lipAt(rx) + rdu * ds); if (ry < -12 || ry > h + 4) continue;
      var kind = Math.floor(PX.h2(c, r + 184) * 8) % 8, fl = PX.h2(c, r + 185) > 0.5;
      if (kind === 6) ammonite(fb, rx, ry, Math.max(4, Math.round(9 * ds * 1.6)));
      else if (kind === 7) logRings(fb, rx, ry, Math.max(3, Math.round(6 * ds * 1.7)));
      else relic(fb, kind, rx, ry, fl);
    }
    // geodes and caves in the Redwall and the limestone
    var gc = 230;
    for (c = Math.floor(wl / gc) - 1; c <= Math.ceil(wr / gc) + 1; c++) {
      if (PX.h2(c, 191) < 1 - 0.5 * keep) continue;
      var gx = sx(c * gc + PX.h2(c, 192) * gc), gy = Math.round(lipAt(gx) + (160 + PX.h2(c, 193) * 150) * ds); if (gx < -14 || gx > w + 14 || gy < -12 || gy > h + 12) continue;
      geode(fb, gx, gy, Math.max(4, Math.round((8 + 5 * PX.h2(c, 194)) * ds * 1.6)), c, I.lime + 1);
    }
    var vc = 560;
    for (c = Math.floor(wl / vc) - 1; c <= Math.ceil(wr / vc) + 1; c++) {
      if (PX.h2(c, 201) < 1 - 0.55 * keep || zoom / a < 0.16) continue;
      var vx = sx(c * vc + (0.2 + 0.6 * PX.h2(c, 202)) * vc), vy = Math.round(lipAt(vx) + (152 + 60 * PX.h2(c, 203)) * ds); if (vx < -30 || vx > w + 30 || vy < -20 || vy > h + 20) continue;
      var vrx = Math.max(7, Math.round((15 + 7 * PX.h2(c, 204)) * ds * 1.4)); cave(fb, vx, vy, vrx, Math.max(4, Math.round(vrx * 0.5)), c);
    }
    var sc2 = 120;                                                       // turquoise lenses in the shale, pink pegmatite dikes cutting the schist
    for (c = Math.floor(wl / sc2) - 1; c <= Math.ceil(wr / sc2) + 1; c++) {
      if (PX.h2(c, 211) < 1 - 0.45 * keep) continue;
      var inS = PX.h2(c, 213) > 0.35, zx = sx(c * sc2 + PX.h2(c, 212) * sc2);
      if (inS) {
        var zdu = 380 + PX.h2(c, 214) * 380, zy = lipAt(zx) + zdu * ds, zl = Math.round((44 + 90 * PX.h2(c, 216)) * Math.max(0.7, ds * 1.5)), ang = [-1.15, -0.95, -0.15, 0.3][Math.floor(PX.h2(c, 217) * 4) & 3] + (PX.h2(c, 219) - 0.5) * 0.2;
        if (zx < -160 || zx > w + 160 || zy < -160 || zy > h + 30) continue;
        dike(fb, zx, zy, zl, ang, 3 + Math.floor(PX.h2(c, 218) * 3), c);
      } else {
        var ldu = 208 + PX.h2(c, 215) * 12, llen = Math.round((24 + 36 * PX.h2(c, 216)) * Math.max(0.7, ds * 1.5)), lth = 1 + Math.round(PX.h2(c, 218) * 1.2);
        if (zx < -80 || zx > w + 80) continue;
        for (kk = 0; kk < llen; kk++) {                                  // a lens of copper-green mineral lying along the bedding
          var lx = zx + kk, ly = Math.round(lipAt(lx) + ldu * ds), tp = Math.sin(Math.PI * (kk + 0.5) / llen), hh2 = Math.max(0, Math.round(lth * tp));
          for (var q = -hh2; q <= hh2; q++) fb.set(lx, ly + q, q < 0 ? I.turq + 3 : q === hh2 ? I.turq : I.turq + 2);
        }
      }
    }
    var mc = 190;                                                        // amber crystal pockets, and an old stone, deep in the schist
    for (c = Math.floor(wl / mc) - 1; c <= Math.ceil(wr / mc) + 1; c++) for (r = 0; r < 2; r++) {
      if (PX.h2(c * 5 + r, 231) < 1 - 0.28 * keep) continue;
      var mx = sx(c * mc + PX.h2(c, r + 232) * mc), my = Math.round(lipAt(mx) + (392 + r * 130 + PX.h2(c, r + 233) * 90) * ds); if (mx < -14 || mx > w + 14 || my < -12 || my > h + 12) continue;
      if (PX.h2(c, r + 236) > 0.86) oldStone(fb, mx, my, Math.max(5, Math.round(9 * ds * 1.7)), c);
      else geode(fb, mx, my, Math.max(4, Math.round((7 + 4 * PX.h2(c, r + 234)) * ds * 1.7)), c * 3 + r, I.pink);
    }
  }

  // ---------- the lip: rubble, dry grass, sage, a saguaro; all world-locked and kept clear of the hero ----------
  function saguaro(fb, bx, by, hpx, seed) {                             // ribbed trunk with a domed top and two up-curved arms, lit from the left
    var P = I.plant, tw = Math.max(2, Math.round(hpx * 0.11)), y, x, rr = PX.h1(seed * 3 + 1) > 0.5 ? 1 : -1, dome = Math.max(2, tw);
    function limb(cx, yb, yt, hw) {                                     // a vertical column from row yb up to row yt: lit left, mid, shaded right, dark edge; a domed cap
      for (var yy = yb; yy <= yt; yy++) {
        var dtop = yt - yy, half = dtop < dome ? Math.max(0, hw - Math.round(((dome - dtop) * (dome - dtop)) / (dome * 1.4))) : hw;
        for (var xx = -half; xx <= half; xx++) {
          var rel = half ? (xx + half) / (2 * half) : 0.3, tone = rel < 0.22 ? 4 : rel < 0.5 ? 3 : rel < 0.8 ? 2 : 1;
          if (xx === half && half > 0) tone = 0; else if (((xx + 8) & 3) === 0 && tone > 1 && tone < 4) tone--;                // ribs
          fb.set(cx + xx, by - yy, P + tone);
        }
      }
    }
    var ay = Math.round(hpx * 0.5), al = Math.max(3, Math.round(hpx * 0.30)), sa = Math.round(hpx * 0.30), aw = Math.max(1, Math.round(tw * 0.62));
    limb(bx, 0, hpx, tw);
    for (var s = -1; s <= 1; s += 2) {
      var ax = s === rr ? Math.round(ay * 1.0) : Math.round(ay * 0.62), arl = s === rr ? al : Math.round(al * 0.8), asa = s === rr ? sa : Math.round(sa * 0.7);
      for (x = tw; x <= tw + arl; x++) for (y = -aw; y <= aw; y++) fb.set(bx + s * x, by - ax + y, P + (y < 0 ? 3 : y === aw ? 0 : 2));
      limb(bx + s * (tw + arl), ax + aw, ax + asa, aw);
    }
  }
  function surface(fb, S, ds, heroX, t) {
    var w = fb.w, h = fb.h, zoom = S.zoom, sc = S.scroll, lipA = S.lip, a = S.adj || 1, c, kk, thin = clamp((S.zoom / a) / 0.28, 0.22, 1);
    var wl = (0 - S.ztx) / zoom + sc, wr = (w - S.ztx) / zoom + sc, lean = S.reduced ? 0 : (S.windGust || 0) * 2.2;
    function sx(wx) { return Math.round(S.ztx + (wx - sc) * zoom); }
    function lipAt(x) { return lipA[clamp(x, 0, w - 1)]; }
    var cw = 26;                                                         // rubble: small red-brown rocks and pebbles on the crust
    for (c = Math.floor(wl / cw) - 1; c <= Math.ceil(wr / cw) + 1; c++) {
      if (PX.h1(c * 5 + 401) > 0.62 * thin) continue;
      var px = sx(c * cw + PX.h1(c * 7 + 403) * cw); if (px < -6 || px > w + 6 || Math.abs(px - heroX) < 22 * zoom + 8) continue;
      var rad = Math.max(1.4, (2 + 3.2 * PX.h1(c * 11 + 405)) * zoom * 1.5);
      stone(fb, px, lipAt(px) - Math.round(rad * 0.4) + 1, rad * 1.3, rad, PX.h1(c * 13 + 407) < 0.5 ? I.red : I.orng, c, 5);
    }
    var tw = 40;                                                         // dry golden grass
    for (c = Math.floor(wl / tw) - 1; c <= Math.ceil(wr / tw) + 1; c++) {
      if (PX.h1(c * 5 + 411) > 0.3 * thin) continue;
      var tx = sx(c * tw + PX.h1(c * 7 + 413) * tw); if (tx < 2 || tx > w - 3 || Math.abs(tx - heroX) < 30 * zoom + 12) continue;
      var n = 3 + Math.floor(PX.h1(c * 11 + 415) * 3), hmax = Math.max(3, Math.round((7 + 9 * PX.h1(c * 13 + 417)) * zoom * 1.4));
      for (var s = 0; s < n; s++) {
        var bx = tx + (s - (n >> 1)) * 2 + (s & 1), base = lipAt(bx) + 1, sh = Math.max(3, hmax - Math.floor(PX.h2(c, s + 419) * hmax * 0.5));
        var sw = lean + 0.4 * Math.sin(t * 1.6 + c + s * 0.8), dir = (s - (n - 1) / 2) * 0.35;
        for (kk = 0; kk < sh; kk++) { var f = kk / sh; fb.set(bx + Math.round((dir - sw) * f * f * 2.2), base - kk, kk >= sh - 1 ? I.orng + 7 : (f > 0.45 ? I.orng + 6 : I.orng + 5)); }
      }
    }
    var sw2 = 110;                                                       // sage: a low grey-green dome
    for (c = Math.floor(wl / sw2) - 1; c <= Math.ceil(wr / sw2) + 1; c++) {
      if (PX.h1(c * 5 + 421) > 0.5 * thin) continue;
      var bxs = sx(c * sw2 + PX.h1(c * 7 + 423) * sw2 * 0.8); if (bxs < -8 || bxs > w + 8 || Math.abs(bxs - heroX) < 40 * zoom + 18) continue;
      var brr = Math.max(3, Math.round((6 + 5 * PX.h1(c * 11 + 425)) * zoom * 1.5)), bsy = lipAt(bxs) + 1;
      for (var yy = -brr; yy <= 1; yy++) for (var xx = -Math.round(brr * 1.5); xx <= Math.round(brr * 1.5); xx++) {
        var ex = xx / 1.5, d3 = ex * ex + yy * yy; if (d3 > brr * brr) continue;
        var lit = (-(ex * 0.5 + yy * 0.85)) / brr + B4[(bsy + yy) & 3][(bxs + xx) & 3] * 0.5;
        fb.set(bxs + xx, bsy + yy, I.plant + (lit > 0.5 ? 4 : lit > 0.15 ? 3 : lit > -0.25 ? 2 : 1));
      }
    }
    var cc = 460;                                                        // a saguaro now and then, standing straight up out of the slope
    for (c = Math.floor(wl / cc) - 1; c <= Math.ceil(wr / cc) + 1; c++) {
      if (PX.h1(c * 5 + 431) > 0.5 * thin) continue;
      var cxx = sx(c * cc + PX.h1(c * 7 + 433) * cc * 0.8); if (cxx < -14 || cxx > w + 14 || Math.abs(cxx - heroX) < 50 * zoom + 22) continue;
      saguaro(fb, cxx, lipAt(cxx) + 2, Math.max(14, Math.round((56 + 34 * PX.h1(c * 11 + 435)) * zoom * 1.35)), c);
    }
  }

  // ---------- front: gold dust drifting in the low sun, and now and then a tumbleweed rolling down the slope ----------
  function tumbleweed(fb, cx, cy, r, ang) {                             // a tangle of dry stems: a broken ring plus spiralling strands, spinning as it rolls
    var k, O = I.orng;
    for (k = 0; k < 30; k++) {
      var a = ang + k * 2.399963, rr = r * (0.3 + 0.7 * ((k * 0.618034) % 1)), px = Math.round(cx + Math.cos(a) * rr), py = Math.round(cy + Math.sin(a) * rr * 0.95);
      fb.set(px, py, (k % 3) === 0 ? O + 2 : (k % 3 === 1 ? O + 4 : O + 5));
    }
    for (k = 0; k < 16; k++) { var b = ang * 0.7 + k * (TAU / 16), q = Math.round(cx + Math.cos(b) * r), z = Math.round(cy + Math.sin(b) * r * 0.95); if ((k + Math.floor(ang * 2)) & 1) fb.set(q, z, O + 3); else fb.set(q, z, O + 1); }
    fb.set(Math.round(cx - r * 0.35), Math.round(cy - r * 0.4), O + 6);
  }
  R.front = function (fb, S, pal) {
    if (S.reduced) return;
    var w = fb.w, h = fb.h, t = S.tSec, i, lip = S.lip, a = S.adj || 1, zoom = S.zoom;
    for (i = 0; i < 16; i++) {                                           // dust motes catching the light
      var sp = 2 + PX.h1(i * 7 + 1) * 5, mx = ((PX.h1(i * 3 + 1) * (w + 80) - t * sp - S.scroll * zoom * 0.02) % (w + 80) + (w + 80)) % (w + 80) - 40;
      var my = (0.06 + PX.h1(i * 11 + 3) * 0.66) * h + Math.sin(t * (0.6 + PX.h1(i * 5) * 0.5) + i * 2.1) * 5, px = Math.round(mx), py = Math.round(my);
      if (px < 0 || px >= w || py < 0 || py > lip[px] - 3) continue;
      fb.set(px, py, I.sun + 3); if ((Math.floor(t * 1.6 + i) & 1) && px + 1 < w) fb.set(px + 1, py, I.sun + 2);
    }
    var per = 52, ph = t % per, run = 15;                                // a tumbleweed every ~50 s: rolls left (downhill) along the crest
    if (ph < run && S.altitude > 0) {
      var u = ph / run, r = Math.max(3, Math.round(6 * zoom * 1.6 * a + 2)), tx = Math.round(w + 20 - u * (w + 60)), hop = Math.abs(Math.sin(u * 40)) * 4 * a;
      if (tx > -10 && tx < w + 10) { var ly = lip[clamp(tx, 0, w - 1)]; tumbleweed(fb, tx, Math.round(ly - r + 1 - hop), r, -u * 60); }
    }
  };

  V8.register("canyon", R);
})(typeof window !== "undefined" ? window : this);
