// The Snow - V8 scene. A bleak, beautiful high-alpine winter built entirely in code on the shared indexed framebuffer:
// an overcast banded sky with a veiled low sun (22-degree halo, sundogs), heavy moody cloud banks, one colossal snow-and-ice
// mountain (relief-shaded facets, ice-blue shadow planes, rock bands, a wind-blown summit plume) among colder ranges and
// blue-grey haze, a frozen valley of snowy ridges with snow-laden dead pines; then the ground: a crisp snow crust (drifts,
// wind ripples, glints) over layered firn, blue glacier ice, frozen moraine and slate bedrock (ice veins, frozen relics) down
// to a cold glow far below. In front: falling snow in three depth layers, spindrift and a ground blizzard when the wind rises.
(function (root) {
  "use strict";
  var PX = root.PX, Sc = root.Sc, V8 = root.V8, hex = PX.hex, clamp = PX.clamp, clamp01 = PX.clamp01, B4 = PX.BAYER4;
  var R = { rock: { mat: "icy", style: "snowy" }, thumb: { alt: 0, zoom: 0.74, slope: 0.02, ratio: 0.8 } }, I = {}, ST = {}, CB = [], VL = [], built = "", FL = null, PP = {};
  var WS = { t: -1, sc: 0, wx: 0, gx: 0, gy: 0 }, SKY0 = null, skyF = -1;                     // snowfall state: integrated wind drift + camera travel
  var DH = new Float32Array(4096), MOD = new Float32Array(4096), BND = new Int16Array(8), LIT = new Uint8Array(256);
  var FIRN_L = [3.95, 3.25, 3.7, 2.85, 3.35], SINT = new Float32Array(1024);
  (function () { for (var i = 0; i < 1024; i++) SINT[i] = Math.sin(i / 1024 * Math.PI * 2); })();
  function H(list) { return list.map(hex); }
  function sm(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function vn2(x, y, s) {                                               // cheap smooth 2-D value noise in [0,1)
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, h = PX.ihash; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h(ix, iy, s), b = h(ix + 1, iy, s), c = h(ix, iy + 1, s), d = h(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  R.init = function (pal, S) {
    // ---- palette: every ramp runs dark -> light ----
    SKY0 = H(["#4d5f80", "#56698a", "#607394", "#6b7e9d", "#7688a6", "#8293af", "#8f9fb9", "#9dacc3", "#abb9cd", "#bac6d7", "#c9d3e1"]); skyF = -1;
    I.sky = pal.ramp("sky", SKY0);
    I.glow = pal.ramp("glow", H(["#d7d8d4", "#e8e4d6", "#f3eedf", "#fdf9ee"]));
    I.cloud = pal.ramp("cloud", H(["#5b6982", "#6a7891", "#7d8aa1", "#929eb3", "#abb5c6", "#c6cdd9"]));
    I.col = pal.ramp("col", H(["#3a4a68", "#475877", "#566787", "#677a98", "#647a9c", "#7a8fb0", "#93a8c6", "#b4c4d9", "#d6e0ec", "#f3f6fa"]));
    I.far = pal.ramp("far", H(["#5f7394", "#6c80a0", "#7a8dab", "#8a9cb8", "#a6b5ca", "#c0cbdb", "#dce3ec"]));
    I.mid = pal.ramp("mid", H(["#3e4f6c", "#4a5b78", "#586a86", "#687b96", "#94a8c2", "#bfcddd", "#e6edf4"]));
    I.pine = pal.ramp("pine", H(["#151b27", "#212a39", "#2f3a4c", "#435066"]));
    I.snow = pal.ramp("snow", H(["#6a7fa2", "#7d92b3", "#93a7c5", "#aabcd5", "#c1cfe2", "#d6e1ed", "#e9f0f6", "#fafcfe"]));
    I.ice = pal.ramp("ice", H(["#23446c", "#2f5884", "#3f6f9e", "#5a8dba", "#83b2d6", "#b8dcf0"]));
    I.earth = pal.ramp("earth", H(["#1d1b22", "#2a2730", "#3a3640", "#4d4853"]));
    I.rock = pal.ramp("rock", H(["#0e121a", "#161c27", "#202836", "#2c3646", "#3c485b", "#526076"]));
    I.dglow = pal.ramp("dglow", H(["#0f2433", "#163548", "#1f4c63", "#2d6a85", "#4a93ad", "#a6e6f4"]));
    I.bone = pal.ramp("bone", H(["#6a6658", "#a39e89", "#dcd7c2"]));
    I.bronze = pal.ramp("bronze", H(["#4f4530", "#86703f", "#c0a35c"]));
    I.ink = pal.ramp("ink", H(["#070a10"]));
    PP.near = { d0: I.pine, d1: I.pine + 1, d2: I.pine + 2, tr: I.pine + 1, s0: I.snow + 4, s1: I.snow + 6, s2: I.snow + 7 };
    PP.far = { d0: I.far + 1, d1: I.far + 2, d2: I.far + 3, tr: I.far + 1, s0: I.far + 4, s1: I.far + 5, s2: I.far + 6 };
    PP.mid = { d0: I.col, d1: I.col + 1, d2: I.col + 2, tr: I.col + 1, s0: I.snow + 4, s1: I.snow + 5, s2: I.snow + 7 };
    for (var li = 0; li < 256; li++) LIT[li] = li;                     // one step lighter along each of this realm's ramps
    for (var rn in pal.ramps) { var rp = pal.ramps[rn]; for (var ri = 0; ri < rp.n; ri++) LIT[rp.base + ri] = rp.base + Math.min(rp.n - 1, ri + 1); }
    LIT[I.sky + 10] = I.glow;
    R.markerIdx = { c0: I.rock + 1, c1: I.rock + 3, c2: I.snow + 6, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };
    R.birdIdx = I.pine + 1;                                             // shared overlays: dark slate birds against the overcast
    R.watcherIdx = I.pine;                                              // the watcher reads as a dark figure on the snow
    R.footprint = { col: I.snow + 3, hi: I.snow + 7 };                  // blue pressed snow with a lit rim
    R.pal = pal; RMAP = null;
    // (the baked scene holds palette INDICES only, keyed by screen size: it stays valid across re-inits, so a revisit costs ~nothing)
    buildScene(S);
  };

  function mtnPal(base, snowD) { return { rockDeep: base, rockS: base + 1, rockM: base + 2, rockL: base + 3, snowS: base + 4, snowL: base + 5, snowH: base + 6, snowD: snowD == null ? base + 4 : snowD }; }

  function buildScene(S) {
    var key = S.w + "x" + S.h + "@" + (S.adj || 1); if (built === key) return; built = key; ST.skyKey = "";
    var hy0 = S.horizonY, Hc = clamp(Math.round(hy0 * 0.66), 40, 200), i, a = S.adj || 1;
    function A(v) { return Math.max(1, Math.round(v * a)); }
    ST.Hc = Hc;
    ST.col = buildColossus(Hc);
    ST.far = Sc.mountainStrip({ L: 1024, H: Math.round(Hc * 0.5), seed: 41, peaks: 15, hMin: 0.40, hMax: 0.95, sharp: 1.25, snow: 0.72, gullies: 4, pal: mtnPal(I.far) });
    ST.mid = Sc.mountainStrip({ L: 960, H: Math.round(Hc * 0.38), seed: 57, peaks: 11, hMin: 0.45, hMax: 1.0, sharp: 1.18, snow: 0.55, gullies: 5, pal: mtnPal(I.mid, I.mid + 3) });
    ST.rFar = snowRidge({ L: 1100, H: A(44), seed: 7, amp: A(4), base: A(16), tones: [I.far + 2, I.far + 3, I.far + 4, I.far + 5], edge: I.far + 6, fall: 0.07 / a, trees: { n: 34, hMin: A(6), hMax: A(11), pal: PP.far }, haze: I.sky + 10, fadeRows: A(10) });
    ST.rNear = snowRidge({ L: 1000, H: A(64), seed: 13, amp: A(6), base: A(30), tones: [I.far, I.far + 1, I.far + 2, I.far + 3, I.far + 4], edge: I.snow + 4, fall: 0.06 / a, trees: { n: 22, hMin: A(8), hMax: A(19), pal: PP.mid }, haze: I.sky + 9, fadeRows: A(12) });
    ST.rLow = snowRidge({ L: 900, H: Math.max(A(120), S.h - hy0 + A(90)), seed: 29, amp: A(8), base: A(46), tones: [I.snow, I.snow + 1, I.snow + 2, I.snow + 3, I.snow + 4], edge: I.snow + 6, fall: 0.028 / a, trees: { n: 10, hMin: A(16), hMax: A(34), pal: PP.near, dead: true }, lines: true });
    // cloud heaps: a few big ones high up and to the right of the veiled sun, smaller ones lower; one drifts in front of the massif
    CB = [];
    // [width (of screen), height (of width), y (of horizon), tone, heavy, front]
    var spec = [[0.78, 0.2, 0.05, -1, 1, 0], [0.42, 0.2, 0.26, 0, 0.4, 0], [0.24, 0.22, 0.17, 0, 0, 0], [0.34, 0.18, 0.43, 0, 0.3, 0], [0.2, 0.24, 0.52, 0, 0, 0], [0.62, 0.13, 0.66, 0, 0.5, 1]];
    for (i = 0; i < spec.length; i++) {
      var bw = Math.round(clamp(S.w * spec[i][0], 70, 400)), bh = Math.round(clamp(bw * spec[i][1], 14, 68));
      CB.push({ sp: cloudBank(300 + i * 37, bw, bh, spec[i][3], spec[i][4]), x: PX.h1(i * 11 + 2) * 1600, y: spec[i][2], v: 0.8 + 1.2 * PX.h1(i * 17 + 4), front: !!spec[i][5] });
    }
    VL = [];
    for (i = 0; i < 6; i++) {
      var low = i >= 4, vw = Math.round(clamp(S.w * (low ? 0.6 : 0.3 + 0.35 * PX.h1(i * 19 + 7)), 60, 420)), vh = low ? 4 : 3 + Math.round(2 * PX.h1(i * 23 + 9));
      VL.push({ sp: veilSprite(vw, vh, i), x: PX.h1(i * 29 + 3) * 1200, y: low ? 0.6 + 0.08 * (i - 4) : 0.1 + 0.3 * PX.h1(i * 31 + 5), v: 0.6 + 0.8 * PX.h1(i * 37 + 1) });
    }
    FL = makeFlakes(S);
  }

  // ---------- the colossus: a relief field (peaks with concave flanks + parallel spurs + gentle noise) lit by a low sun ----------
  function buildColossus(Hc) {
    var k = Hc / 120, W = Math.round(Hc * 3.3), Hs = Hc + 8, ax = Math.round(W * 0.47), ay = 2, x, y, i, p, s;
    var rnd = PX.rng(907), N = W * Hs;
    var peaks = [
      { x: ax, y: ay, kL: 0.80, kR: 1.02, g: 0.90, lean: 0.07, zz: 2.4 * k, sp0: 0.052 },
      { x: ax - Hc * 0.72, y: ay + Hc * 0.44, kL: 0.95, kR: 1.10, g: 0.93, lean: -0.10, zz: 1.3 * k, sp0: 0.062 },
      { x: ax + Hc * 0.60, y: ay + Hc * 0.26, kL: 1.08, kR: 0.90, g: 0.91, lean: 0.14, zz: 1.6 * k, sp0: 0.06 },
      { x: ax + Hc * 1.26, y: ay + Hc * 0.62, kL: 1.10, kR: 1.00, g: 0.95, lean: 0.02, zz: 1.0 * k, sp0: 0.09 },
      { x: ax - Hc * 1.32, y: ay + Hc * 0.68, kL: 1.00, kR: 1.10, g: 0.95, lean: 0.05, zz: 1.0 * k, sp0: 0.09 }
    ];
    peaks.forEach(function (pk, pi) {                                  // spurs branch off the main ridge, parallel to each skyline
      pk.sp = []; var depth = ay + Hc + 8 - pk.y, spacing = Math.max(4, Hc * pk.sp0);
      for (var side = -1; side <= 1; side += 2) {
        var base = Math.atan(side < 0 ? pk.kL : pk.kR);
        for (var ts = spacing * (0.5 + 0.5 * rnd()); ts < depth * 0.92; ts += spacing * (0.75 + 0.5 * rnd())) {
          var phi = base + (rnd() - 0.35) * 0.24, ux = side * Math.cos(phi), uy = Math.sin(phi);
          var sx = pk.x + pk.lean * ts + pk.zz * Math.sin(ts * 0.19 + pi * 2.1), sy = pk.y + ts, wS = spacing * (0.42 + 0.3 * rnd()), len = depth * (0.45 + 0.55 * rnd());
          pk.sp.push({ x: sx, y: sy, ux: ux, uy: uy, len: len, w: wS, a: wS * (1.0 + 0.6 * rnd()),
            x0: Math.min(sx, sx + ux * len) - wS - 1, x1: Math.max(sx, sx + ux * len) + wS + 1, y0: sy - wS - 1, y1: sy + uy * len + wS + 1 });
        }
      }
    });
    var rel = new Float32Array(N).fill(-8), pr = new Float32Array(N);
    for (p = 0; p < peaks.length; p++) {                                 // each peak: base cone, then its spurs over their own boxes
      var pk = peaks[p], ya = Math.max(0, Math.floor(pk.y - 4));
      pr.fill(-1e9, ya * W);
      for (y = ya; y < Hs; y++) {
        var t = y - pk.y, tt = t < 0 ? 0 : t, rx = pk.x + pk.lean * tt + pk.zz * Math.sin(tt * 0.19 + p * 2.1), reach = tt * 1.6 + 30;
        var xa = Math.max(0, Math.floor(rx - reach / pk.kL)), xb = Math.min(W - 1, Math.ceil(rx + reach / pk.kR)), row = y * W;
        for (x = xa; x <= xb; x++) { var dx = x - rx, a = dx < 0 ? -dx * pk.kL : dx * pk.kR; pr[row + x] = t - Hc * Math.pow(a / Hc, pk.g); }
      }
      for (s = 0; s < pk.sp.length; s++) {
        var q = pk.sp[s], qx0 = Math.max(0, Math.floor(q.x0)), qx1 = Math.min(W - 1, Math.ceil(q.x1)), qy0 = Math.max(ya, Math.floor(q.y0)), qy1 = Math.min(Hs - 1, Math.ceil(q.y1));
        for (y = qy0; y <= qy1; y++) for (x = qx0; x <= qx1; x++) {
          var ex = x - q.x, ey = y - q.y, along = ex * q.ux + ey * q.uy;
          if (along < -q.w || along > q.len) continue;
          var pe = Math.abs(ey * q.ux - ex * q.uy); if (pe >= q.w) continue;
          var o2 = y * W + x; if (pr[o2] > -1e8) pr[o2] += q.a * (1 - pe / q.w) * (along < 0 ? 1 + along / q.w : Math.sqrt(1 - along / q.len));
        }
      }
      for (i = ya * W; i < N; i++) if (pr[i] > rel[i]) rel[i] = pr[i];
    }
    for (y = 0; y < Hs; y++) for (x = 0; x < W; x++) {
      i = y * W + x; if (rel[i] > -6) rel[i] += (vn2(x * 0.09 / k, y * 0.09 / k, 17) - 0.5) * 2.2 * k + (vn2(x * 0.27 / k, y * 0.27 / k, 42) - 0.5) * 0.8 * k;
    }
    var sp = { w: W, h: Hs, d: new Uint8Array(N), ax: ax, ay: ay }, LI = new Float32Array(N);
    var Lx = -0.80, Ly = -0.48, Lz = 0.36, C = I.col, ln = Math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz); Lx /= ln; Ly /= ln; Lz /= ln;
    for (y = 1; y < Hs - 1; y++) for (x = 1; x < W - 1; x++) {
      i = y * W + x; var r0 = rel[i]; if (r0 <= 0) continue;
      var rr = rel[i + 1], rl = rel[i - 1], rd = rel[i + W], ru = rel[i - W];
      var gx = (rr > 0 && rl > 0) ? (rr - rl) * 0.5 : rr > 0 ? rr - r0 : rl > 0 ? r0 - rl : 0;
      var gy = (rd > 0 && ru > 0) ? (rd - ru) * 0.5 : rd > 0 ? rd - r0 : ru > 0 ? r0 - ru : 1;
      var nx = -gx, ny = -gy, nz = 0.9, nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      var Li = (nx * Lx + ny * Ly + nz * Lz) / nl; LI[i] = Li;
      var tr = (y - ay) / Hc, litFace = gx > 0.05, bay = B4[y & 3][x & 3];
      var rock = false;
      if ((Li < 0.4 && tr > 0.16) || (!litFace && tr > 0.04) || tr > 0.84) {    // rock ribs follow the fall line (only where rock can show)
        var u = litFace ? (x * 0.8 + y * 0.6) : (x * 0.8 - y * 0.6), v = litFace ? (y * 0.8 - x * 0.6) : (y * 0.8 + x * 0.6);
        var s1 = vn2(u * 0.22 / k, v * 0.04 / k, 91);
        rock = (Li < 0.4 && tr > 0.16 && s1 > 0.58 - 0.14 * tr) || (!litFace && tr > 0.04 && s1 > 0.64 - 0.28 * tr) || (tr > 0.84 && s1 > 0.52 - (tr - 0.84) * 2.2);
      }
      var li = Li + bay * 0.09, idx;
      if (rock) idx = C + (li < 0.15 ? 0 : li < 0.32 ? 1 : li < 0.52 ? 2 : 3);
      else idx = C + (li < 0.12 ? 4 : li < 0.26 ? 5 : li < 0.42 ? 6 : li < 0.6 ? 7 : li < 0.9 ? 8 : 9);
      sp.d[i] = idx;
    }
    for (y = 1; y < Hs - 1; y++) for (x = 1; x < W - 1; x++) {                                           // pale-gold light on the sunward crests
      i = y * W + x; if (sp.d[i] < C + 8 || LI[i] < 0.86) continue;
      if ((sp.d[i + W + 1] && LI[i + W + 1] < LI[i] - 0.3) || (sp.d[i + 1] && LI[i + 1] < LI[i] - 0.34)) sp.d[i] = I.glow + 2;
    }
    for (y = 1; y < Hs; y++) for (x = 1; x < W - 1; x++) {                                               // skyline rim
      i = y * W + x; if (!sp.d[i] || sp.d[i - W]) continue;
      sp.d[i] = LI[i] > 0.5 ? I.glow + 2 : (LI[i] > 0.25 ? C + 7 : C + 6);
    }
    return sp;
  }

  // wind-blown snow banner streaming off the summit (downwind = left): a dense core that frays into streaks
  function plume(fb, sx, sy, Hc, t, wind) {
    var w = fb.w, h = fb.h, d = fb.d, Lp = Hc * (0.5 + 0.35 * wind), x, y;
    var x0 = Math.max(0, Math.floor(sx - Lp)), x1 = Math.min(w - 1, sx);
    for (x = x1; x >= x0; x--) {
      var dx = sx - x, f = dx / Lp; if (f > 1 || f < 0) continue;
      var yc = sy + 1 + dx * 0.08 + Math.sin(dx * 0.06 - t * 0.9) * (0.3 + dx * 0.03), ht = 0.6 + dx * 0.2;
      var ya = Math.max(0, Math.floor(yc - ht)), yb = Math.min(h - 1, Math.ceil(yc + ht));
      for (y = ya; y <= yb; y++) {
        var v = (y - yc) / ht; if (v * v >= 1) continue;
        var lane = Math.floor((v + 1) * 2.5 + 0.5 * Math.sin(dx * 0.05)), flow = (x + t * 22 + lane * 17) * 0.11;
        var streak = Math.sin(flow) * 0.5 + 0.5, dens = (1 - v * v) * (1 - f) * (1 - f) * (0.35 + 0.95 * streak) * 1.5;
        if (dens > 0.85) d[y * w + x] = I.snow + 7;
        else if (dens > 0.5) d[y * w + x] = I.col + 8;
        else if (dens > 0.22 && ((x + y) & 1) === 0) d[y * w + x] = I.col + 7;
      }
    }
  }

  // ---------- skies ----------
  function veilSprite(w, h, seed) {                                     // a thin stratus streak with dithered ends
    var sp = new PX.Sprite(w, h), x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var ex = (x + 0.5 - w / 2) / (w / 2), ey = (y + 0.5 - h / 2) / (h / 2), e = ex * ex + ey * ey * 0.8;
      if (e >= 1) continue;
      var dens = (1 - e) * (0.8 + 0.2 * Math.sin(x * 0.19 + seed));
      if (B4[y & 3][x & 3] + 0.5 < dens * 1.35) sp.d[y * w + x] = y < h * 0.45 ? I.sky + 9 : I.sky + 8;
    }
    return sp;
  }

  // a heavy cloud heap: its crown is a random walk of overlapping puffs under an asymmetric envelope (tallest off-centre, a long
  // tail), painted in order so each front puff shows a lit rim over the one behind; a crescent shadow on the side away from the
  // light, a darker lower band and a ragged, dithered underside that dissolves into the sky.
  function cloudBank(seed, w, h, tone, heavy) {
    var rnd = PX.rng(seed), sp = new PX.Sprite(w, h), arcs = [], x, y, i, C = I.cloud, base = h - 2;
    var peakX = w * (0.28 + 0.44 * rnd()), ax = 1;
    while (ax < w - 2) {
      var e = ax < peakX ? ax / peakX : (w - ax) / (w - peakX); e = Math.pow(clamp01(e), 0.6);
      var r = Math.max(2.5, Math.min(h * 0.3, h * (0.09 + 0.22 * e) * (0.55 + 0.9 * rnd())));
      var topY = base - (h * 0.2 + h * 0.68 * Math.pow(e, 1.6) * (0.72 + 0.28 * rnd()));
      var cx = clamp(ax + r * 0.8, r + 1, w - r - 1);
      arcs.push({ x: cx, cy: Math.max(r * 0.85 + 1, topY + r * 0.85), r: r, ry: r * 0.85 });
      ax += r * (0.7 + 0.7 * rnd());
    }
    arcs.sort(function (a, b) { return a.cy - b.cy; });
    function inL(L, px, py) { var dx = (px + 0.5 - L.x) / L.r, dy = (py + 0.5 - L.cy) / L.ry; return dx * dx + dy * dy <= 1; }
    var top = new Float32Array(w).fill(1e9), bot = new Int16Array(w);
    for (i = 0; i < arcs.length; i++) { var A = arcs[i]; for (x = Math.max(0, Math.ceil(A.x - A.r * 0.9)); x <= Math.min(w - 1, Math.floor(A.x + A.r * 0.9)); x++) if (A.cy < top[x]) top[x] = A.cy; }
    for (x = 0; x < w; x++) bot[x] = base - Math.round(1.4 + 1.4 * Math.sin(x * 0.12 + seed) + 0.9 * Math.sin(x * 0.31 + seed * 2));
    for (x = 0; x < w; x++) if (top[x] < 1e8) for (y = Math.max(0, Math.round(top[x])); y <= bot[x]; y++) {
      var fromBot = bot[x] - y, b = B4[y & 3][x & 3] + 0.5, c;
      var belly = h * (0.2 + 0.22 * (heavy || 0));
      if (fromBot < 3) c = b < (fromBot + 1) * 0.27 ? (heavy ? C + 1 : C + 2) : 0;
      else if (heavy && fromBot < 3 + belly * 0.45) c = b < 0.5 ? C + 1 : C + 2;
      else c = fromBot < 3 + belly ? (b < 0.5 ? C + 2 : C + 3) : C + 3;
      if (c) sp.d[y * w + x] = c;
    }
    for (i = 0; i < arcs.length; i++) {
      var L = arcs[i], s = Math.max(1, Math.round(L.ry * 0.45));
      for (y = Math.max(0, Math.floor(L.cy - L.ry)); y <= Math.ceil(L.cy + L.ry); y++) for (x = Math.max(0, Math.floor(L.x - L.r)); x <= Math.min(w - 1, Math.ceil(L.x + L.r)); x++) {
        if (!inL(L, x, y) || y > bot[x] - 3) continue;
        var cc;
        if (!inL(L, x - 1, y - 1) || !inL(L, x, y - 1)) cc = (x < peakX + w * 0.1) ? I.glow + 1 : C + 5;
        else if (!inL(L, x - 2, y - 2)) cc = C + 5;
        else if (!inL(L, x + s, y + s)) cc = C + 3;
        else cc = C + 4;
        sp.d[y * w + x] = cc;
      }
    }
    if (tone) for (i = 0; i < sp.d.length; i++) if (sp.d[i] >= C && sp.d[i] <= C + 5) sp.d[i] = C + clamp(sp.d[i] - C + tone, 0, 5);
    return sp;
  }

  // the sky is brighter toward the veiled sun: one ramp step lighter inside a big dithered disc (two steps near its heart)
  function skyGlow(fb, cx, cy, R0) {
    var w = fb.w, h = fb.h, d = fb.d, x, y, x0 = Math.max(0, cx - R0), x1 = Math.min(w - 1, cx + R0), y0 = Math.max(0, cy - R0), y1 = Math.min(h - 1, cy + R0);
    for (y = y0; y <= y1; y++) { var dy = (y - cy) / R0, row = y * w, br = B4[y & 3]; for (x = x0; x <= x1; x++) {
      var dx = (x - cx) / R0, q = 1 - Math.sqrt(dx * dx + dy * dy * 1.6); if (q <= 0) continue;
      var th = br[x & 3] + 0.5;
      if (th < q * 1.35) { var o = row + x; d[o] = LIT[d[o]]; if (th < (q - 0.55) * 1.6) d[o] = LIT[d[o]]; }
    } }
  }

  function veiledSun(fb, cx, cy, r) {
    var w = fb.w, h = fb.h, d = fb.d, L1 = LIT, ring = Math.round(r * 3.2), R2 = ring + 2, x, y;
    for (y = Math.max(0, cy - R2); y <= Math.min(h - 1, cy + R2); y++) for (x = Math.max(0, cx - R2); x <= Math.min(w - 1, cx + R2); x++) {
      var dx = x - cx + 0.5, dy = y - cy + 0.5, dist = Math.sqrt(dx * dx + dy * dy), o = y * w + x, b = B4[y & 3][x & 3] + 0.5;
      if (dist <= r) { d[o] = dist < r * 0.62 ? I.glow + 3 : (dist < r - 1 ? I.glow + 2 : I.glow + 1); continue; }
      var f = (dist - r) / (ring - r);
      if (f < 1) {
        if (b < 0.9 - f * 1.1) d[o] = L1[d[o]];
        if (b < 0.55 - f * 1.4) d[o] = L1[d[o]];
        if (f < 0.12 && b < 0.6) d[o] = I.glow;
      }
      if (Math.abs(dist - ring) < 0.75 && ((x + y) & 1) === 0) d[o] = L1[d[o]];
    }
    for (var sg = -1; sg <= 1; sg += 2) {
      var gx = cx + sg * ring;
      for (y = cy - 2; y <= cy + 2; y++) for (x = gx - 1; x <= gx + 1; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h || (Math.abs(y - cy) === 2 && x !== gx)) continue;
        var o2 = y * w + x; d[o2] = L1[L1[d[o2]]];
      }
    }
  }

  // a rolling fog bank: solid below a wavy crest line (y0 + swell), with a two-row dithered fringe on top; down to y1
  function mist(fb, y0, amp, y1, idx, drift) {
    var w = fb.w, d = fb.d, x, y;
    for (x = 0; x < w; x++) { var xa = x + drift; MOD[x] = Math.round(amp * (Math.sin(xa * 0.023) * 0.55 + Math.sin(xa * 0.061 + 1.1) * 0.3 + Math.sin(xa * 0.137 + 2.3) * 0.15)); }
    for (y = Math.max(0, y0 - amp - 2); y < Math.min(fb.h, y1); y++) {
      var row = y * w, br = B4[y & 3];
      for (x = 0; x < w; x++) {
        var e = y - (y0 + MOD[x]);
        if (e >= 0 || (e === -1 && br[x & 3] < 0) || (e === -2 && br[x & 3] < -0.3)) d[row + x] = idx;
      }
    }
  }

  // ---------- snowy ridge strips (tileable): rolling crest, lit on left-facing slopes, pines along the crest ----------
  function snowRidge(o) {
    var L = o.L, Hh = o.H, st = Sc.newStrip(L, Hh), wob = Sc.periodic(L, o.seed * 3 + 2), wob2 = Sc.periodic(L, o.seed * 5 + 9), x, y;
    var crest = new Int16Array(L), cf = new Float32Array(L), T = o.tones, nT = T.length;
    for (x = 0; x < L; x++) { cf[x] = o.base + o.amp * (0.7 * wob(x) + 0.3 * wob2(x)); crest[x] = Math.round(cf[x]); }
    for (x = 0; x < L; x++) {
      var c = crest[x], sl = (cf[(x + 3) % L] - cf[(x + L - 3) % L]) / 6, face = clamp(-sl * 3, -1, 1);
      for (y = Math.max(0, c); y < Hh; y++) {
        var dd = y - c, bay = B4[y & 3][x & 3];
        var idx = T[clamp(Math.floor(nT - 1.35 + face * 1.1 * Math.exp(-dd / 7) - dd * o.fall + bay * 0.85), 0, nT - 1)];
        if (dd === 0) idx = face > -0.15 ? o.edge : T[nT - 2];
        st.d[y * L + x] = idx;
      }
    }
    if (o.lines) {                                                       // wind-carved drift lines on the near slope
      var rn = PX.rng(o.seed * 11 + 3);
      for (var q = 0; q < L / 9; q++) {
        var lx = Math.floor(rn() * L), ly = crest[lx] + 6 + Math.floor(rn() * (Hh - o.base - 10)), len = 6 + Math.floor(rn() * 22);
        for (var e = 0; e < len; e++) { var xx = (lx + e) % L, yy = ly + Math.round(Math.sin(e * 0.3) * 0.6); if (yy < crest[xx] + 3 || yy >= Hh) continue; st.d[yy * L + xx] = T[Math.max(0, nT - 4)]; if (yy > 0) st.d[(yy - 1) * L + xx] = T[nT - 1]; }
      }
    }
    var put = function (px, py, cc) { if (py < 0 || py >= Hh) return; st.d[py * L + (((px % L) + L) % L)] = cc; };
    var rnd = PX.rng(o.seed * 77 + 5), tr = o.trees;
    if (tr) {
      var xp = Math.floor(rnd() * 30);
      while (xp < L - tr.hMax) {
        var cl = 1 + Math.floor(rnd() * 4);
        for (var m = 0; m < cl; m++) {
          var tx = Math.round(xp + m * tr.hMax * 0.42 * (0.6 + 0.8 * rnd())), th = Math.round(tr.hMin + (tr.hMax - tr.hMin) * rnd());
          var ty = crest[((tx % L) + L) % L] + 1 + Math.floor(rnd() * 3);
          snowPine(put, tx, ty, th, Math.floor(rnd() * 1e6), tr.pal, tr.dead && rnd() < 0.6);
        }
        xp += Math.round(L / tr.n * (0.5 + rnd() * 1.4)) + Math.round(cl * tr.hMax * 0.4);
      }
    }
    if (o.haze) for (y = 0; y < o.fadeRows; y++) {
      var ry = Hh - 1 - y, amt = 1 - y / o.fadeRows;
      for (x = 0; x < L; x++) if (st.d[ry * L + x] && (B4[ry & 3][x & 3] + 0.5) < amt) st.d[ry * L + x] = o.haze;
    }
    st.crest = o.base;
    return st;
  }
  // snow-laden conifer, alive (full tiers) or dead (ragged, missing boughs, bare spike); base at (bx, by), height h px
  function snowPine(put, bx, by, h, seed, P, dead) {
    if (h < 4) return;
    var rnd = PX.rng(seed | 0), tiers = clamp(Math.round(h / 4.2), 2, 9), top = by - h + 1, hw = h * (dead ? 0.22 : 0.27) + 0.8, y, dx;
    for (y = dead ? top : top + Math.round(h * 0.2); y <= by; y++) put(bx, y, P.tr);
    var usable = h - Math.max(1, Math.round(h * 0.1)), t0 = dead ? Math.max(1, Math.round(h * 0.12)) : 0;
    for (var i = 0; i < tiers; i++) {
      var ty0 = top + t0 + Math.round(i * (usable - t0) / tiers), ty1 = top + t0 + Math.round((i + 1) * (usable - t0) / tiers);
      var wMax = hw * (0.28 + 0.72 * (i + 1) / tiers) * (0.85 + 0.3 * rnd());
      var gapL = dead && rnd() < 0.34, gapR = dead && rnd() < 0.28, prevHalf = -1;
      for (y = ty0; y <= ty1; y++) {
        var tt = (y - ty0 + 1) / (ty1 - ty0 + 1), half = Math.round(wMax * (0.25 + 0.75 * tt) * (dead ? 0.85 : 1));
        for (dx = -half; dx <= half; dx++) {
          if ((dx < 0 && gapL) || (dx > 0 && gapR)) continue;
          var ad = dx < 0 ? -dx : dx, topEdge = ad > prevHalf || y === ty0, c;
          if (topEdge) c = dx <= 0 ? P.s2 : (ad >= half ? P.s0 : P.s1);
          else if (y === ty1 && tt > 0.7) c = P.d0;
          else c = dx < -half * 0.3 ? P.d2 : (dx > half * 0.4 ? P.d0 : P.d1);
          if (dead && !topEdge && ad > 1 && ((dx * 7 + y * 3) & 3) === 0) continue;
          put(bx + dx, y, c);
        }
        prevHalf = half;
      }
    }
  }

  function makeFlakes(S) {
    var A = clamp(S.w * S.h / 144000, 0.4, 3), n = [Math.round(320 * A), Math.round(170 * A), Math.round(52 * A)], tot = n[0] + n[1] + n[2];
    var F = { n: n, x: new Float32Array(tot), y: new Float32Array(tot), ph: new Float32Array(tot), v: new Float32Array(tot) };
    for (var i = 0; i < tot; i++) { F.x[i] = PX.h1(i * 3 + 11); F.y[i] = PX.h1(i * 5 + 17); F.ph[i] = PX.h1(i * 7 + 23) * 6.283; F.v[i] = 0.75 + 0.5 * PX.h1(i * 11 + 29); }
    return F;
  }

  // palette animation: high on the mountain the thin air deepens the zenith toward a colder blue (the horizon barely changes)
  R.palette = function (pal, S) {
    var f = Math.round(sm((S.altitude - 700) / 2600) * 16) / 16; if (f === skyF || !SKY0) return; skyF = f;
    pal.setRamp("sky", SKY0.map(function (c, i) { var k = f * (0.3 - 0.025 * i); return [c[0] + (34 - c[0]) * k, c[1] + (48 - c[1]) * k, c[2] + (98 - c[2]) * k]; }));
  };

  // a weak, cool, diffuse winter light from a low veiled sun on the upper left
  R.light = function (S) {
    return { x: Math.round(S.w * 0.2), y: Math.round(S.horizonY * 0.21) + Math.round((1 - S.openingT) * S.h * 0.04), k: 0.35, col: [236, 232, 218], ambient: [150, 168, 196], bright: 0.88, ground: [206, 218, 232] };
  };

  R.backdrop = function (fb, S, pal) {
    buildScene(S);
    var w = fb.w, h = fb.h, hy = S.horizonY + Math.round((1 - S.openingT) * S.h * 0.12), al = S.altitude, i;
    var t = S.reduced ? 0 : S.tSec, Hc = ST.Hc, wg = clamp01(S.windGust || 0), a = S.adj || 1;
    function A(v) { return Math.round(v * a); }
    var L = R.light(S), skey = w + "x" + h + "|" + hy + "|" + L.x + "," + L.y;
    if (ST.skyKey !== skey || !ST.sky || ST.sky.length !== w * h) {        // the sky (bands, glow, veiled sun) is static: bake it once
      var skyIdx = []; for (i = 0; i < 11; i++) skyIdx.push(I.sky + i);
      Sc.bands(fb, 0, hy + 24, skyIdx, 4);
      if (hy + 24 < h) fb.fillRect(0, hy + 24, w, h - hy - 24, I.sky + 10);
      skyGlow(fb, L.x, L.y, Math.round(clamp(hy * 0.42, 50, 150)));
      veiledSun(fb, L.x, L.y, Math.round(clamp(S.h * 0.026, 6, 11)));
      if (!ST.sky || ST.sky.length !== w * h) ST.sky = new Uint8Array(w * h);
      ST.sky.set(fb.d); ST.skyKey = skey;
    } else fb.d.set(ST.sky);
    for (i = 0; i < VL.length; i++) {
      var vv = VL[i], vspan = w + vv.sp.w + 40, vx = ((vv.x - t * vv.v - al * 0.1) % vspan + vspan) % vspan - vv.sp.w;
      fb.blit(vv.sp, Math.round(vx), Math.round(vv.y * hy), 0);
    }
    for (i = 0; i < CB.length; i++) {
      var c = CB[i]; if (c.front) continue;
      var span = w + c.sp.w + 60, cx = ((c.x - t * c.v - al * 0.16) % span + span) % span - c.sp.w;
      fb.blit(c.sp, Math.round(cx), Math.round(c.y * hy), 0);
    }
    Sc.blitStrip(fb, ST.far, al * 0.04 + 130, hy + A(2) - ST.far.h);
    var drift = w * 0.25 * (1 - Math.exp(-al * 0.03 / (w * 0.25)));
    var colX = Math.round(w * 0.64 - ST.col.ax - drift), colY = hy + A(8) - ST.col.h;
    fb.blit(ST.col, colX, colY, 0);
    plume(fb, colX + ST.col.ax, colY + ST.col.ay, Hc, t, wg);
    mist(fb, Math.round(hy - Hc * 0.2), A(7), hy + A(10), I.sky + 8, t * 1.5);
    mist(fb, Math.round(hy - Hc * 0.1), A(5), hy + A(10), I.sky + 9, t * 2.2 + 140);
    for (i = 0; i < CB.length; i++) {
      var c2 = CB[i]; if (!c2.front) continue;
      var span2 = w + c2.sp.w + 60, cx2 = ((c2.x - t * c2.v - al * 0.16) % span2 + span2) % span2 - c2.sp.w;
      fb.blit(c2.sp, Math.round(cx2), Math.round(c2.y * hy), 0);
    }
    Sc.blitStrip(fb, ST.mid, al * 0.09 + 420, hy + A(12) - ST.mid.h);
    mist(fb, Math.round(hy - ST.mid.h * 0.22), A(4), hy + A(12), I.sky + 10, t * 2 + 50);
    Sc.blitStrip(fb, ST.rFar, al * 0.24 + 60, hy - A(4) - ST.rFar.crest);
    Sc.blitStrip(fb, ST.rNear, al * 0.42 + 200, hy + A(5) - ST.rNear.crest);
    var yL = hy + A(26) - ST.rLow.crest;
    Sc.blitStrip(fb, ST.rLow, al * 0.68 + 333, yL);
    if (yL + ST.rLow.h < h) fb.fillRect(0, yL + ST.rLow.h, w, h - yL - ST.rLow.h, I.snow);
    // ground blizzard: veils of blowing snow racing along the valley when the wind rises (and always a little up high)
    var bz = clamp01(wg * 1.3 + sm((al - 1400) / 2200) * 0.3);
    if (bz > 0.04) {
      var y0 = hy - A(34), y1 = hy + A(44), x, y;
      for (y = Math.max(0, y0); y < Math.min(h, y1); y++) {
        var pr = 1 - Math.abs((y - hy - A(4)) / (40 * a)), row = y * w, br = B4[y & 3]; if (pr <= 0) continue;
        var ph = PX.h1(y * 7 + 3) * 400, spd = 60 + 70 * PX.h1(y * 13 + 1), amp = bz * pr * (0.45 + 0.55 * PX.h1(y * 5 + 9));
        var o1 = t * spd + ph, o2 = t * spd * 1.3 + ph;                    // sine lookups: 1024 steps per turn
        for (x = 0; x < w; x++) {
          var s = SINT[((x + o1) * 7.334) & 1023] + 0.35 * SINT[((x + o2) * 21.19) & 1023];
          if (s > 0.55 && br[x & 3] + 0.5 < amp * (s - 0.2) * 1.6) fb.d[row + x] = I.sky + 10;
        }
      }
    }
  };

  // ---------- ground ----------
  function bump(p) { return p <= -1 || p >= 1 ? 0 : (p < 0 ? Math.pow(1 - p * p, 0.7) : Math.pow(1 - p, 1.5) * (1 + 0.5 * p)); }
  function driftAt(wx) {                                               // wind drifts: steep lee face on the left, long tail to the right
    var s = 0, cell = 150, k0 = Math.floor(wx / cell), k;
    for (k = k0 - 1; k <= k0 + 1; k++) {
      if (PX.h1(k * 7 + 3) < 0.3) continue;
      var c = k * cell + (0.2 + 0.6 * PX.h1(k * 5 + 1)) * cell, hw = 20 + 36 * PX.h1(k * 11 + 2), ht = 5 + 9 * PX.h1(k * 13 + 4);
      var b = bump((wx - c) / hw) * ht; if (b > s) s = b;
    }
    var cell2 = 41, j0 = Math.floor(wx / cell2);
    for (k = j0 - 1; k <= j0 + 1; k++) {
      if (PX.h1(k * 17 + 9) < 0.45) continue;
      var c2 = k * cell2 + PX.h1(k * 19 + 5) * cell2, hw2 = 5 + 9 * PX.h1(k * 23 + 6), ht2 = 1.6 + 2.2 * PX.h1(k * 29 + 7);
      var b2 = bump((wx - c2) / hw2) * ht2; if (b2 > s) s = b2;
    }
    return s;
  }

  function outcrop(fb, cx, lip, r, seed) {                              // a slate rock poking through the crust, capped with snow
    var rw = Math.round(r * 1.35);
    for (var y = -r; y <= 1; y++) for (var x = -rw; x <= rw; x++) {
      var ex = x / 1.35, d2 = ex * ex + y * y * 1.1; if (d2 > r * r) continue;
      var sy = lip + y, lit = (-(ex * 0.7 + y * 0.7)) / r, c;
      if (y < -r * 0.45 + (PX.h2(x + seed * 7, 5) * 2 - 1) * 1.2 && lit > -0.5) c = lit > 0.2 ? I.snow + 7 : I.snow + 5;
      else c = I.rock + (lit > 0.45 ? 4 : lit > 0.05 ? 3 : lit > -0.4 ? 2 : 1);
      if (d2 > (r - 1) * (r - 1) && lit < 0.1 && c >= I.rock && c < I.rock + 6) c = I.rock;
      fb.set(cx + x, sy, c);
    }
  }

  function groundProps(fb, S, heroX) {
    var w = fb.w, zoom = S.zoom, sc = S.scroll, lipA = S.lip, al = S.altitude;
    var pineP = 0.62 * (1 - sm((al - 500) / 1300)), rockP = 0.15 + 0.4 * sm((al - 300) / 1500);
    var cell = 170, wl = (0 - S.ztx) / zoom + sc, wr = (w - S.ztx) / zoom + sc;
    var put = function (x, y, c) { fb.set(x, y, c); };
    for (var pc = Math.floor(wl / cell) - 1; pc <= Math.ceil(wr / cell) + 1; pc++) {
      var hv = PX.h1(pc * 3 + 71), pwx = pc * cell + (0.1 + 0.8 * PX.h1(pc * 5 + 73)) * cell, psx = Math.round(S.ztx + (pwx - sc) * zoom);
      if (psx < -40 || psx > w + 40 || Math.abs(psx - heroX) < 40 * zoom + 22) continue;
      var pl = lipA[clamp(psx, 0, w - 1)];
      if (hv < pineP) snowPine(put, psx, pl + 1, Math.round((46 + 50 * PX.h1(pc * 7 + 75)) * zoom * 1.2), pc * 31 + 5, PP.near, PX.h1(pc * 11 + 77) < 0.5);
      else if (hv < pineP + rockP) outcrop(fb, psx, pl, Math.max(3, Math.round((7 + 9 * PX.h1(pc * 13 + 79)) * zoom * 1.3)), pc);
    }
  }

  // layer depths shrink more gently than the camera zoom (0.74 -> 0.74, 0.22 -> 0.36, pull-back 0.1 -> 0.27), so a far view still
  // shows a readable snowpack instead of a sliver over a flooded deep; Chunky mode (S.adj < 1) keeps the same framing
  function depthZoom(S) { var adj = S.adj || 1, z0 = S.zoom / adj; return adj * (0.2 + 0.73 * z0); }
  // 1-D value noise with linear interpolation: piecewise-straight, irregular layer boundaries (geological, never sine waves)
  function jag(x, seg, seed) { var k = Math.floor(x / seg), f = x / seg - k, a = PX.h2(k, seed), b = PX.h2(k + 1, seed); return a + (b - a) * f - 0.5; }
  var BEDS = new Int16Array(64), BT = new Float32Array(64), BW = new Int16Array(64), BK = new Uint8Array(64);
  (function () { for (var i = 0; i < 64; i++) { var r = PX.h1(i * 7 + 1); BK[i] = r < 0.22 ? 2 : 1; BT[i] = BK[i] === 2 ? 5 + 4 * PX.h1(i * 3 + 5) : 8 + 9 * PX.h1(i * 5 + 2); BW[i] = 14 + Math.floor(PX.h1(i * 13 + 3) * 26); } })();

  R.ground = function (fb, S, pal) {
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, sc = S.scroll, lipA = S.lip;
    var t = S.reduced ? 0 : S.tSec, heroX = Math.round(S.ztx + S.anchorX * zoom), qoff = Math.round(sc * zoom - S.ztx);
    var SN = I.snow, IC = I.ice, E = I.earth, RK = I.rock, G = I.dglow, x, y, o, k, zd = depthZoom(S);
    groundProps(fb, S, heroX);
    for (x = 0; x < w; x++) {
      var calm = sm((Math.abs(x - heroX) - (22 * zoom + 8)) / (44 * zoom + 14));
      DH[x] = driftAt((x - S.ztx) / zoom + sc) * zoom * calm;
    }
    var sbD = Math.max(7, Math.round(28 * zd)), bedK = 0.7 + 0.4 * zd, slopeK = clamp(S.slope, 0, 0.7);
    for (x = 0; x < w; x++) {
      var lip = lipA[x]; if (lip >= h) continue;
      var wxF = (x - S.ztx) / zoom + sc, qx = x + qoff, dh = Math.round(DH[x]);
      if (dh > 0) {                                                    // the drift rises above the lip: lit windward-left face, blue lee
        var slp = DH[Math.min(w - 1, x + 1)] - DH[Math.max(0, x - 1)];
        for (k = 1; k <= dh; k++) {
          var yy = lip - k; if (yy < 0) break;
          var cT, b2 = B4[yy & 3][x & 3];
          if (k === dh) cT = slp > 0.3 ? I.glow + 3 : (slp < -0.5 ? SN + 5 : SN + 7);
          else if (slp > 0.25) cT = k === dh - 1 ? SN + 7 : SN + 6;
          else if (slp < -0.2) cT = k >= dh - 1 ? SN + 5 : (b2 > 0.1 ? SN + 3 : SN + 4);
          else cT = k === dh - 1 ? SN + 6 : SN + 5;
          d[yy * w + x] = cT;
        }
      }
      // layer boundaries (px below the lip): smooth swell + straight-segment jags
      var sw1 = Math.sin(wxF * 0.017 + 1.3), sw2 = Math.sin(wxF * 0.011 + 4.0);
      var sb = sbD + ((PX.h2(qx >> 1, 77) > 0.62) ? 1 : 0) + ((PX.h2(Math.floor(qx / 3), 78) > 0.86) ? 1 : 0);   // snow-cap pendants
      BND[0] = sb;
      BND[1] = Math.max(BND[0] + 3, Math.round((38 + 2 * sw1 + 5 * jag(wxF, 23, 11)) * zd));
      BND[2] = Math.max(BND[1] + 3, Math.round((48 + 2 * sw2 + 6 * jag(wxF, 31, 12)) * zd));
      BND[3] = Math.max(BND[2] + 3, Math.round((57 + 3 * sw1 + 6 * jag(wxF, 19, 13)) * zd));
      BND[4] = Math.max(BND[3] + 3, Math.round((66 + 3 * sw2 + 6 * jag(wxF, 27, 14)) * zd));
      var bIce = Math.max(BND[4] + 3, Math.round((76 + 4 * sw1 + 6 * jag(wxF, 29, 15)) * zd));
      var bEarth = Math.max(bIce + 4, Math.round((116 + 5 * sw2 + 12 * jag(wxF, 29, 16)) * zd));
      var bRock = Math.max(bEarth + 4, Math.round((148 + 6 * sw1 + 10 * jag(wxF, 21, 17)) * zd));
      var bDeep = Math.max(bRock + 8, Math.round((340 + 10 * sw2 + 16 * jag(wxF, 37, 18)) * zd));
      var nb = 0, acc = bRock;                                         // slate beds for this column (thickness varies per bed)
      while (acc < h - lip + 2 && nb < 63) { BEDS[nb] = acc; acc += Math.max(4, Math.round(BT[nb] * bedK + 2 * jag(wxF, 41, 30 + nb))); nb++; }
      BEDS[nb] = 32000;
      var patch = 0.5 * Math.sin(wxF * 0.012 + 0.7) + 0.35 * Math.sin(wxF * 0.037 + 2.1), fl = 0, bi = 0;
      var y0 = Math.max(0, lip);
      o = y0 * w + x;
      for (y = y0; y < h; y++, o += w) {
        var dd = y - lip, bay = B4[y & 3][x & 3], idx;
        if (dd < sb) {                                                 // the crust seen from just above: bright, softly shaded
          if (dd === 0) idx = dh > 0 ? SN + 6 : SN + 7;
          else { var tt = dd / sb; idx = SN + clamp(Math.floor(6.05 - 1.9 * tt * tt + patch * 0.8 + bay * 0.9 - (dd === 1 ? 0.55 : 0)), 4, 6); }
        } else if (dd < bIce) {                                        // firn: storm layers, hoar lines and broken ice crusts
          while (fl < 4 && dd >= BND[fl + 1]) fl++;
          var lt = dd - BND[fl], lh = (fl < 4 ? BND[fl + 1] : bIce) - BND[fl];
          if (fl === 0 && lt < 2) idx = lt === 0 ? SN + 1 : SN + 2;                                 // shadow under the cap
          else if (fl & 1 && lt < 2) idx = (lt === 0 || bay > 0) ? SN + 1 : SN + 2;                  // depth-hoar line
          else if (fl > 0 && !(fl & 1) && lt === 0 && PX.h2(Math.floor((qx + fl * 5) / 9), fl) > 0.3) idx = SN + 5;   // ice crust (segments)
          else if (fl > 0 && !(fl & 1) && lt === 1) idx = SN + 2;
          else { idx = SN + clamp(Math.floor(FIRN_L[fl] - 1.2 * (lt / lh) + bay * 0.9), 1, 5); if (fl === 3 && lt < 3 && PX.h2(qx >> 1, dd + 40) > 0.55) idx = E + 3; }
        } else if (dd < bEarth) {                                      // glacier ice: blue bands, darker below, broad glints, bubbles
          var it = (dd - bIce) / (bEarth - bIce);
          if (dd - bIce === 0) idx = IC + 5;
          else if (dd - bIce === 1) idx = IC + 4;
          else {
            var band = Math.sin((dd - bIce) * 0.55 + jag(wxF, 43, 19) * 3) * 0.55;
            idx = IC + clamp(Math.floor(3.3 - 2.1 * it + band + bay * 0.8), 1, 4);
            var gcell = Math.floor((qx + (dd >> 1)) / 23), gph = (qx + (dd >> 1)) - gcell * 23;
            if (gph < 3 && dd - bIce < 12 && PX.h2(gcell, 21) > 0.62) idx = gph === 0 ? IC + 5 : IC + 4;
            else if (PX.h2(qx, dd + 3000) > 0.992) idx = IC + 5;
          }
        } else if (dd < bRock) {                                       // frozen moraine: gravel and frost
          var et = (dd - bEarth) / (bRock - bEarth), gr = PX.h2(qx >> 1, (dd >> 1) + 500);
          if (dd === bEarth) idx = IC;
          else {
            idx = E + clamp(Math.floor(2.4 - 1.1 * et + (gr - 0.5) * 1.0 + bay * 0.6), 0, 3);
            if (gr > 0.985 && !(dd & 1) && !(qx & 1)) idx = SN + 1;
          }
        } else {                                                       // slate bedrock: beds of jointed blocks and laminated shale
          while (dd >= BEDS[bi + 1]) bi++;
          var ib = dd - BEDS[bi], bh2 = BEDS[bi + 1] - BEDS[bi], kind = BK[bi & 63], deep = dd >= bDeep;
          var gl = deep ? clamp01((dd - bDeep) / (190 * zd)) : 0, dimm = deep ? 1.0 + Math.min(1.3, (dd - bDeep) / (110 * zd)) : (dd - bRock) / (320 * zd);
          if (kind === 2) {                                            // shale: thin laminae
            idx = ib === 0 ? (gl > 0.3 ? G + 1 : RK) : RK + clamp(Math.floor(((ib & 1) ? 2.6 : 1.9) - dimm + bay * 0.6), 0, 3);
            if (deep && (ib & 1) && bay + 0.5 < gl * 0.4) idx = G;
          } else {
            var bw = BW[bi & 63], jx = qx - Math.round(ib * slopeK) + bi * 11, blk = Math.floor(jx / bw), fx = jx - blk * bw, bt = PX.h2(blk, bi + 90);
            if (ib === 0 || fx === 0) idx = deep ? (gl > 0.35 && bt > 0.45 ? G + (gl > 0.7 ? 2 : 1) : RK) : ((bt > 0.82 && ib > 0) ? IC + 3 : RK);   // joints: ice-filled, or glowing in the deep
            else if (ib === 1 && fx < bw * 0.6 && bt > 0.3) idx = deep ? RK + 1 : RK + 4;               // lit top edge
            else if (fx === 1 && ib < bh2 * 0.6) idx = deep ? RK + 1 : RK + 3;
            else if (ib === bh2 - 1 || fx === bw - 1) idx = deep ? (ib === bh2 - 1 && bt > 0.55 ? G + clamp(Math.floor(1 + gl * 3.2), 1, 4) : RK) : RK + 1;   // undersides catch the glow
            else {
              idx = RK + clamp(Math.floor(1.8 + bt * 1.4 - (ib / bh2) * 1.1 + bay * 0.7 - dimm), 0, 3);
              if (deep && bay + 0.5 < gl * 0.34 * (ib / bh2 + 0.2)) idx = G;
            }
          }
        }
        d[o] = idx;
      }
      // glints: single crystals catching the light
      if (Math.abs(x - heroX) > 34 * zoom + 12) for (k = 0; k < 2; k++) {
        var gh = PX.h2(Math.floor(wxF), 60 + k); if (gh < 0.986) continue;
        var gdd = 2 + Math.floor(PX.h2(Math.floor(wxF), 40 + k) * (sbD - 3)), gy = lip + gdd;
        if (gy < 0 || gy >= h) continue;
        if (Math.sin(t * 2.2 + gh * 900) > 0.35) d[gy * w + x] = gh > 0.995 ? I.glow + 3 : SN + 7;
      }
    }
    sastrugi(fb, S, sbD, heroX);
    tufts(fb, S, heroX);
    features(fb, S, sbD);
  };

  // dry golden grass poking through the crust low on the mountain: the one warm note in the snow (thins out with altitude)
  function tufts(fb, S, heroX) {
    var dens = 0.5 * (1 - sm((S.altitude - 150) / 550)); if (dens < 0.02) return;
    var w = fb.w, zoom = S.zoom, sc = S.scroll, lipA = S.lip, cw = 48, lean = S.reduced ? 0 : (S.windGust || 0) * 2.4, t = S.reduced ? 0 : S.tSec;
    var wl = (0 - S.ztx) / zoom + sc - cw, wr = (w - S.ztx) / zoom + sc + cw, B = I.bronze;
    for (var c = Math.floor(wl / cw); c <= Math.ceil(wr / cw); c++) {
      if (PX.h1(c * 5 + 301) > dens) continue;
      var sx = Math.round(S.ztx + (c * cw + PX.h1(c * 7 + 303) * cw - sc) * zoom); if (sx < 2 || sx > w - 3 || Math.abs(sx - heroX) < 34 * zoom + 14) continue;
      var n = 3 + Math.floor(PX.h1(c * 11 + 305) * 3), hmax = Math.max(3, Math.round((6 + 8 * PX.h1(c * 13 + 307)) * zoom * 1.3));
      for (var s = 0; s < n; s++) {
        var bx = sx + (s - (n >> 1)) * 2 + (s & 1), base = lipA[clamp(bx, 0, w - 1)] + 1, sh = Math.max(3, hmax - Math.floor(PX.h2(c, s + 309) * hmax * 0.55));
        var sway = lean + 0.5 * Math.sin(t * 1.8 + c + s * 0.7), dir = (s - (n - 1) / 2) * 0.35;
        for (var k = 0; k < sh; k++) { var f = k / sh; fb.set(bx + Math.round((dir - sway) * f * f * 2.2), base - k, k >= sh - 1 ? I.glow + 1 : (f > 0.45 ? B + 2 : B + 1)); }
      }
    }
  }

  // wind-carved sastrugi on the crust: short strokes, a lit crest over a blue lee line shifted downwind; smaller toward the lip
  function sastrugi(fb, S, sbD, heroX) {
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, sc = S.scroll, lipA = S.lip, cw = 26, rows = 5, zd = depthZoom(S);
    var wl = (0 - S.ztx) / zoom + sc - cw, wr = (w - S.ztx) / zoom + sc + cw;
    for (var c = Math.floor(wl / cw); c <= Math.ceil(wr / cw); c++) for (var r = 0; r < rows; r++) {
      var hv = PX.h2(c, r + 150); if (hv > 0.55) continue;
      var sx = Math.round(S.ztx + (c * cw + PX.h2(c, r + 160) * cw - sc) * zoom); if (sx < -12 || sx > w + 4) continue;
      var near = Math.abs(sx - heroX) < 30 * zoom + 10; if (near && r < 2) continue;
      var du = 4 + 5.2 * Math.pow(r + PX.h2(c, r + 170) * 0.6, 1.3), dd = Math.round(du * zd);
      if (dd < 2 || dd > sbD - 3) continue;
      var len = Math.max(3, Math.round((3 + 6 * PX.h2(c, r + 180)) * (0.55 + 0.45 * (r + 1) / rows) * zd * 1.7)), arch = len > 5;
      for (var i = 0; i < len; i++) {
        var x = sx + i; if (x < 0 || x >= w) continue;
        var y = lipA[x] + dd - (arch && i > len * 0.25 && i < len * 0.75 ? 1 : 0); if (y < 1 || y >= h - 1) continue;
        if (i > 0 && i < len - 1) d[y * w + x] = I.snow + 7;
        if (x + 1 < w && i > 0) d[(y + 1) * w + x + 1] = I.snow + 3;
      }
    }
  }

  // ---- relic bitmaps: '.' empty; a/b/c bone tones, e/f/g bronze, r/s/t rock, i/j ice, k ink ----
  var RELICS = [
    ["....abbbba....", "..abccccccba..", ".abcccccccccb.", ".bcccccccccccb", "abcccccccccccb", "abckkkcckkkccb", "abkkkkcckkkkcb", "abckkcccckkccb", ".bccccckccccb.",
     ".abcccckkcccb.", "..abcccccccba.", "...bkcbkcbkb..", "...abcbcbcba..", "....aababaa..."],                                       // a giant's skull
    ["....gggggg...", "...gffffffg..", "..gffffffffe.", ".gfffffffffe.", ".gff.kkkffffe", "gff..kkkfffe.", "gff....ffffe.", "gf.....fffe..", "gf......ffe..",
     "gfe.....ffe..", ".fe.....fe...", "..e.....e....", ".bbbbbbb.....", "...aaa......."],                                            // a bronze helmet and its crest
    ["...e..e...", "...feef...", "....ff....", "...effe...", "..effffe..", ".effgfffe.", "effgffffe.", "efgfffffe.", "efgfffffe.", "effffffe..", ".effffe...", "..effe....", "...ee.....", "...e......"],  // an amphora
    [".............c..", "............cb..", "...........cb...", "aab.......cb....", "abbcc....ccb....", ".abbcccccbba....", "...aabbbbaa.....", "................"],                     // a mammoth tusk
    ["ab..........ba", "bcb........bcb", ".bcb......bcb.", "..bcbbbbbbcb..", "..bcbbbbbbcb..", ".bcb......bcb.", "bcb........bcb", "ab..........ba"]                               // crossed long bones
  ];
  var RMAP = null;
  function relic(fb, n, x, y, flip) {
    if (!RMAP) RMAP = { a: I.bone, b: I.bone + 1, c: I.bone + 2, e: I.bronze, f: I.bronze + 1, g: I.bronze + 2, r: I.rock + 2, s: I.rock + 3, t: I.rock + 4, i: I.ice + 3, j: I.ice + 5, k: I.ink };
    var rows = RELICS[n];
    for (var yy = 0; yy < rows.length; yy++) for (var xx = 0; xx < rows[yy].length; xx++) {
      var ch = rows[yy].charAt(flip ? rows[yy].length - 1 - xx : xx); if (ch === ".") continue;
      fb.set(x + xx, y + yy, RMAP[ch]);
    }
  }
  function stoneBlob(fb, cx, cy, r, base, frost) {                     // an embedded stone lit from the upper left
    var rw = r * 1.3;
    for (var y = -Math.ceil(r); y <= Math.ceil(r); y++) for (var x = -Math.ceil(rw); x <= Math.ceil(rw); x++) {
      var ex = x / 1.3, d2 = ex * ex + y * y; if (d2 > r * r) continue;
      var lit = (-(ex * 0.7 + y * 0.7)) / r, tone = lit > 0.45 ? 3 : lit > 0.05 ? 2 : lit > -0.4 ? 1 : 0;
      if (d2 > (r - 1) * (r - 1) && lit < 0.25) tone = 0;
      var c = base + tone;
      if (frost && y <= -r + 1.2 && lit > -0.2) c = I.snow + 6;
      fb.set(cx + x, cy + y, c);
    }
  }

  function pocket(fb, cx, cy, rx, ry, seed) {                         // an irregular pocket of clear ice with a lit upper-left rim
    for (var y = -ry; y <= ry; y++) for (var x = -rx; x <= rx; x++) {
      var wob = 1 + 0.14 * Math.sin(Math.atan2(y, x) * 3 + seed), e = ((x * x) / (rx * rx) + (y * y) / (ry * ry)) / (wob * wob); if (e > 1) continue;
      var c = e > 0.72 ? ((x + y < 0) ? I.ice + 4 : I.ice + 1) : ((x + y) < -rx * 0.4 && e > 0.4 ? I.ice + 3 : I.ice + 2);
      fb.set(cx + x, cy + y, c);
    }
  }
  function oldStone(fb, cx, cy, r, seed) {                              // an older stone, lost long ago and frozen in
    pocket(fb, cx, cy, r + 3, r + 2, seed);
    for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) {
      var d2 = x * x + y * y; if (d2 > r * r) continue;
      var lit = (-(x * 0.7 + y * 0.7)) / r, tone = lit > 0.5 ? 4 : lit > 0.1 ? 3 : lit > -0.35 ? 2 : 1;
      if (d2 > (r - 1) * (r - 1)) tone = lit > 0.3 ? 3 : 0;
      if (Math.abs(x - Math.round(y * 0.4) - 1) < 1 && y > -r * 0.6 && y < r * 0.5) tone = 0;          // an old crack
      fb.set(cx + x, cy + y, I.rock + tone);
    }
  }
  function grotto(fb, cx, cy, rx, ry, seed, t) {                       // a dark hollow: rim, glow pooling below, icicles, frozen pool
    var x, y, pool = Math.round(ry * 0.45);
    for (y = -ry - 1; y <= ry + 1; y++) for (x = -rx - 1; x <= rx + 1; x++) {
      var e = (x * x) / ((rx + 1) * (rx + 1)) + (y * y) / ((ry + 1) * (ry + 1)); if (e > 1) continue;
      var ei = (x * x) / (rx * rx) + (y * y) / (ry * ry), c;
      if (ei > 1) c = y < 0 ? I.rock + 3 : I.rock;                                                       // lit lip above, dark below
      else if (y > pool) c = y === pool + 1 ? I.ice + 5 : I.ice + 2;                                       // the frozen pool
      else c = B4[(cy + y) & 3][(cx + x) & 3] + 0.5 < (y + ry) / (ry * 2.2) ? I.dglow + 1 : I.ink;          // darkness, glow pooling low
      fb.set(cx + x, cy + y, c);
    }
    for (x = -rx + 2; x <= rx - 2; x += 2) {                                                            // icicles hanging from the roof
      var len = 2 + Math.floor(PX.h2(x + seed * 31, 17) * ry * 0.9), top = cy - Math.round(ry * Math.sqrt(Math.max(0, 1 - (x * x) / (rx * rx)))) + 1;
      for (y = 0; y < len; y++) { fb.set(cx + x, top + y, y < len - 1 ? I.ice + 4 : I.ice + 5); if (y < len * 0.4) fb.set(cx + x + 1, top + y, I.ice + 3); }
    }
  }

  function features(fb, S, sbD) {
    var w = fb.w, h = fb.h, zoom = S.zoom, sc = S.scroll, lipA = S.lip, t = S.reduced ? 0 : S.tSec;
    var wl = (0 - S.ztx) / zoom + sc, wr = (w - S.ztx) / zoom + sc, c, r, k, zd = depthZoom(S), keep = clamp((S.zoom / (S.adj || 1) - 0.08) / 0.34, 0.22, 1);
    function sx(wx) { return Math.round(S.ztx + (wx - sc) * zoom); }
    function lipAt(x) { return lipA[clamp(x, 0, w - 1)]; }
    // stones: sparse and frosted in the firn, crowded in the moraine, big blocks in the bedrock
    var cw = 30, chh = 26;
    for (c = Math.floor(wl / cw) - 1; c <= Math.ceil(wr / cw) + 1; c++) {
      for (r = 1; r < 22; r++) {
        var du = r * chh + PX.h2(c, r + 43) * chh, hh = PX.h2(c * 3 + 1, r * 5 + 2);
        var pr = (du < 76 ? 0.06 : du < 116 ? 0.05 : du < 148 ? 0.55 : du < 340 ? 0.16 : 0.08) * keep; if (hh > pr) continue;
        var px = sx(c * cw + PX.h2(c, r + 41) * cw); if (px < -10 || px > w + 10) continue;
        var py = Math.round(lipAt(px) + du * zd); if (py < -6 || py > h + 6 || du * zd < sbD + 3) continue;
        var rad = Math.max(1.6, (du < 116 ? 2 + 2 * PX.h2(c, r + 47) : du < 148 ? 1.6 + 2.6 * PX.h2(c, r + 47) : 3 + 4.5 * PX.h2(c, r + 47)) * zd * 1.25);
        stoneBlob(fb, px, py, rad, du < 148 ? I.earth : I.rock + 1, du < 116);
      }
    }
    // thin slivers of clear ice caught between the firn layers
    var lc = 90;
    for (c = Math.floor(wl / lc) - 1; c <= Math.ceil(wr / lc) + 1; c++) {
      if (PX.h1(c * 9 + 5) < 1 - 0.55 * keep) continue;
      var lx = sx(c * lc + PX.h1(c * 3 + 1) * lc), ldu = 38 + PX.h1(c * 7 + 2) * 32; if (lx < -30 || lx > w + 30) continue;
      var ly = Math.round(lipAt(lx) + ldu * zd), llen = Math.max(4, Math.round((8 + 16 * PX.h1(c * 5 + 4)) * zd));
      if (ly <= lipAt(lx) + sbD + 3 || ly >= h) continue;
      for (k = 0; k < llen; k++) { var yk = ly + (k > llen * 0.35 && k < llen * 0.7 ? 1 : 0); fb.set(lx + k, yk, k < llen * 0.5 ? I.ice + 5 : I.ice + 4); fb.set(lx + k + 1, yk + 1, I.ice + 3); }
    }
    // cracks: dark hairlines running down from the crusts, chiselled with a pale left edge
    var kc = 64;
    for (c = Math.floor(wl / kc) - 1; c <= Math.ceil(wr / kc) + 1; c++) {
      if (PX.h1(c * 13 + 7) < 1 - 0.55 * keep) continue;
      var kx = sx(c * kc + PX.h1(c * 5 + 3) * kc); if (kx < -4 || kx > w + 4) continue;
      var ky = Math.round(lipAt(kx) + (36 + PX.h1(c * 11 + 9) * 30) * zd), len = Math.round((8 + 16 * PX.h1(c * 17 + 1)) * zd) + 3, cxp = kx;
      for (k = 0; k < len; k++) {
        if (PX.h2(c, k + 300) < 0.36) cxp += PX.h2(c, k + 500) < 0.5 ? -1 : 1;
        fb.set(cxp, ky + k, I.snow + 1); if (k < len - 2) fb.set(cxp - 1, ky + k, I.snow + 5);
      }
    }
    // ice veins through the bedrock: meandering with momentum, an embossed dark edge, thinner branches
    var vc = 120;
    for (c = Math.floor(wl / vc) - 1; c <= Math.ceil(wr / vc) + 1; c++) {
      if (PX.h1(c * 19 + 3) < 1 - 0.55 * keep) continue;
      var vx = sx(c * vc + PX.h1(c * 23 + 1) * vc); if (vx < -70 || vx > w + 70) continue;
      var vy = lipAt(vx) + (160 + PX.h1(c * 29 + 7) * 150) * zd, vl = Math.round((34 + 60 * PX.h1(c * 31 + 5)) * Math.max(0.6, zd));
      var ang = (PX.h1(c * 37 + 2) < 0.5 ? 0.9 : 2.24) + (PX.h1(c * 41 + 4) - 0.5) * 0.5, qx2 = vx, qy2 = vy, bleft = 2;
      for (k = 0; k < vl; k++) {
        ang += (PX.h2(c, k + 700) - 0.5) * 0.55; ang = clamp(ang, 0.35, 2.8);
        qx2 += Math.cos(ang); qy2 += Math.sin(ang);
        var ix = Math.round(qx2), iy = Math.round(qy2);
        if (iy < lipAt(ix) + 152 * zd) continue;
        fb.set(ix - 1, iy, I.rock); fb.set(ix, iy, I.ice + 5); fb.set(ix + 1, iy, k < vl * 0.7 ? I.ice + 3 : I.ice + 2);
        if (bleft > 0 && k > 8 && PX.h2(c, k + 800) > 0.93) {
          bleft--; var ba = ang + (PX.h2(c, k + 900) < 0.5 ? -0.8 : 0.8), bx2 = qx2, by2 = qy2, bl = 6 + Math.floor(PX.h2(c, k + 950) * 10);
          for (var e2 = 0; e2 < bl; e2++) { bx2 += Math.cos(ba); by2 += Math.sin(ba); fb.set(Math.round(bx2), Math.round(by2), e2 < bl * 0.6 ? I.ice + 4 : I.ice + 3); }
        }
      }
    }
    // an ice grotto: a hollow in the rock hung with icicles over a frozen pool
    var gcl = 420;
    for (c = Math.floor(wl / gcl) - 1; c <= Math.ceil(wr / gcl) + 1; c++) {
      if (zd < 0.42 || PX.h1(c * 61 + 11) < 1 - 0.5 * keep) continue;
      var gxc = sx(c * gcl + (0.2 + 0.6 * PX.h1(c * 67 + 3)) * gcl); if (gxc < -40 || gxc > w + 40) continue;
      var grx = Math.max(7, Math.round((22 + 12 * PX.h1(c * 71 + 5)) * zd)), gry = Math.max(4, Math.round(grx * 0.42));
      var gyc = Math.round(lipAt(gxc) + (200 + 90 * PX.h1(c * 73 + 7)) * zd); if (gyc - gry > h || gyc + gry < 0) continue;
      grotto(fb, gxc, gyc, grx, gry, c, t);
    }
    // frozen relics sealed in ice pockets deep in the moraine and the rock
    var rc = 170;
    for (c = Math.floor(wl / rc) - 1; c <= Math.ceil(wr / rc) + 1; c++) {
      if (PX.h1(c * 41 + 9) < 1 - 0.6 * keep * Math.sqrt(keep)) continue;
      var rx = sx(c * rc + PX.h1(c * 43 + 1) * rc), rdu = 135 + PX.h1(c * 47 + 3) * 190; if (rx < -24 || rx > w + 24) continue;
      var ry = Math.round(lipAt(rx) + rdu * zd); if (ry < -16 || ry > h + 2) continue;
      var n = Math.floor(PX.h1(c * 53 + 5) * (RELICS.length + 1)) % (RELICS.length + 1);
      if (n === RELICS.length) { oldStone(fb, rx, ry, Math.max(4, Math.round(9 * zd + 2)), c); continue; }
      var rows = RELICS[n], rw2 = rows[0].length, rh = rows.length;
      pocket(fb, rx + (rw2 >> 1), ry + (rh >> 1), (rw2 >> 1) + 3, (rh >> 1) + 3, c);
      relic(fb, n, rx, ry, PX.h1(c * 59 + 7) > 0.5);
    }
    // glowing crystals in the deep
    var gc = 58;
    for (c = Math.floor(wl / gc) - 1; c <= Math.ceil(wr / gc) + 1; c++) {
      for (r = 0; r < 3; r++) {
        if (PX.h2(c, r + 900) < 1 - 0.45 * keep * Math.sqrt(keep)) continue;
        var gx = sx(c * gc + PX.h2(c, r + 910) * gc), gdu = 370 + r * 60 + PX.h2(c, r + 920) * 50; if (gx < -8 || gx > w + 8) continue;
        var gy = Math.round(lipAt(gx) + gdu * zd); if (gy < -8 || gy > h + 8) continue;
        var gs = 1 + Math.floor(PX.h2(c, r + 930) * 3), pulse = Math.sin(t * 1.3 + c + r * 2) > 0.2;
        for (var yy = -gs * 2; yy <= gs * 2; yy++) { var hw = gs - Math.abs(yy) / 2; for (var xx = -Math.floor(hw); xx <= Math.floor(hw); xx++) fb.set(gx + xx, gy + yy, xx < 0 ? I.dglow + 4 : (xx === 0 && pulse ? I.dglow + 5 : I.dglow + 3)); }
      }
    }
  }

  // ---------- front: falling snow in three depth layers, spindrift racing along the crust ----------
  R.front = function (fb, S, pal) {
    var w = fb.w, h = fb.h, d = fb.d, lipA = S.lip, zoom = S.zoom, wg = clamp01(S.windGust || 0), i, k;
    var dt = WS.t < 0 ? 0 : clamp(S.tSec - WS.t, 0, 0.1); WS.t = S.tSec;
    var dsc = clamp(S.scroll - WS.sc, -40, 40); WS.sc = S.scroll;
    if (S.reduced) dt = 0;
    WS.wx += dt * (9 + wg * 110); WS.gx += dsc * zoom; WS.gy += dsc * zoom * S.slope;
    var t = S.reduced ? 0 : S.tSec;
    if (wg > 0.08 && !S.reduced) {
      var ns = Math.round(6 + 40 * wg), spanS = w + 60;
      for (i = 0; i < ns; i++) {
        var spd = 150 + 140 * PX.h1(i * 3 + 5), cyc = S.tSec * spd / spanS + PX.h1(i * 7 + 2), cy = Math.floor(cyc), ph = cyc - cy;
        var sx0 = Math.round(w + 30 - ph * spanS), len = 3 + Math.round(9 * PX.h2(i, cy)), lift = 1 + Math.round(PX.h2(i * 5, cy + 3) * 7 * (0.5 + wg));
        for (k = 0; k < len; k++) {
          var xx = sx0 + k; if (xx < 0 || xx >= w) continue;
          var yy = lipA[xx] - lift; if (yy < 0 || yy >= h || (k > len * 0.6 && ((xx + yy) & 1))) continue;
          d[yy * w + xx] = I.snow + 7;
        }
      }
    }
    var F = FL, dens = clamp01(0.42 + 0.58 * sm(S.altitude / 2400) + wg * 0.25), mX = 12, spanX = w + 2 * mX, spanY = h + 2 * mX;
    var LAY = [[0, F.n[0], 13, 0.45, 0.22, I.snow + 5, 1, 2], [F.n[0], F.n[1], 25, 0.9, 0.55, I.snow + 7, 1, 3], [F.n[0] + F.n[1], F.n[2], 46, 1.6, 1.2, I.snow + 7, 2, 5]];
    for (var li = 0; li < 3; li++) {
      var Ly = LAY[li], base = Ly[0], cnt = Math.round(Ly[1] * dens), fall = Ly[2], wf = Ly[3], par = Ly[4], col = Ly[5], sz = Ly[6], wob = Ly[7];
      for (i = 0; i < cnt; i++) {
        var j = base + i, v = F.v[j];
        var fx = F.x[j] * spanX - WS.wx * wf * v - WS.gx * par + Math.sin(t * 1.3 * v + F.ph[j]) * wob;
        var fy = F.y[j] * spanY + t * fall * v + WS.gy * par;
        fx = ((fx % spanX) + spanX) % spanX - mX; fy = ((fy % spanY) + spanY) % spanY - mX;
        var px = Math.round(fx), py = Math.round(fy);
        if (px < 0 || px >= w || py < 0 || py >= h || py > lipA[px] + (sz > 1 ? 2 : 0)) continue;
        if (sz === 1) { d[py * w + px] = col; if (wg > 0.55 && li === 1 && px + 1 < w) d[py * w + px + 1] = I.snow + 5; continue; }
        if (i % 7 === 0) {                                              // the nearest flakes: soft plus shapes
          d[py * w + px] = I.snow + 7;
          if (px > 0) d[py * w + px - 1] = I.snow + 5; if (px + 1 < w) d[py * w + px + 1] = I.snow + 5;
          if (py > 0) d[(py - 1) * w + px] = I.snow + 5; if (py + 1 < h) d[(py + 1) * w + px] = I.snow + 4;
        } else {
          d[py * w + px] = col;
          if (px + 1 < w) d[py * w + px + 1] = I.snow + 5;
          if (py + 1 < h) d[(py + 1) * w + px] = I.snow + 5;
          if (wg > 0.45 && px + 2 < w) d[py * w + px + 2] = I.snow + 4;
        }
      }
    }
  };

  V8.register("snow", R);
})(typeof window !== "undefined" ? window : this);
