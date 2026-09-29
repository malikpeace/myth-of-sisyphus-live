// The Aurora - V8 scene for the aurora zone (8950-10450 m): a frozen tundra night. Everything is generated in code on the shared
// indexed framebuffer: a cold banded sky and a thin scatter of crisp stars, three curtains of aurora (green, teal, violet) drawn
// every frame as ordered-dither ribbons that slowly fold and flicker, ice-blue mountains that catch the green, a frozen lake that
// mirrors the whole sky, dark spruce ridges - and below, the ground as a lit cross-section: snow dust over frost-shattered rock,
// ice lenses, jointed basalt columns whose seams glow green in the deep, a lantern somebody left burning, tusks, a ship's wheel.
(function (root) {
  "use strict";
  var PX = root.PX, Sc = root.Sc, V8 = root.V8, hex = PX.hex, clamp = PX.clamp, clamp01 = PX.clamp01, B4 = PX.BAYER4, TAU = Math.PI * 2;
  var R = { rock: { mat: "icy", style: "granite" }, noThunder: true, thumb: { alt: 9700, zoom: 0.66, slope: 0.10, ratio: 0.74 } };
  var I = {}, ST = { key: "", skyKey: "" }, BP = new Float32Array(16), M = 8, SKY_N = 12, DIM1 = new Uint8Array(256), DIM2 = new Uint8Array(256);
  for (var bi = 0; bi < 16; bi++) BP[bi] = B4[bi >> 2][bi & 3] + 0.5;

  function H(list) { return list.map(hex); }
  function sm(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function keyRamp(keys, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var p = n === 1 ? 0 : i / (n - 1), k = 0;
      while (k < keys.length - 2 && p > keys[k + 1][0]) k++;
      var a = keys[k], b = keys[k + 1], f = clamp01((p - a[0]) / Math.max(1e-6, b[0] - a[0]));
      out.push([a[1][0] + (b[1][0] - a[1][0]) * f, a[1][1] + (b[1][1] - a[1][1]) * f, a[1][2] + (b[1][2] - a[1][2]) * f]);
    }
    return out;
  }
  function vn2(x, y, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, h = PX.ihash; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h(ix, iy, s), b = h(ix + 1, iy, s), c = h(ix, iy + 1, s), d = h(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm2(x, y, s) { return vn2(x, y, s) * 0.55 + vn2(x * 2.07 + 11.3, y * 2.07 + 4.1, s + 1) * 0.30 + vn2(x * 4.3 + 3.7, y * 4.3 + 17.9, s + 2) * 0.15; }
  function zoneF(al) { return al < 8000 ? 0.45 : clamp01((al - 8950) / 1500); }
  function act(t, f) {                                                       // how bright the lights are right now (0.55 .. 1.25): a slow tide with the odd surge
    var s = Math.sin(t * 0.21 + f * 3.1), u = Math.max(0, Math.sin(t * 0.067 + 1.3 + f * 2.0));
    return 0.98 + 0.18 * s + 0.24 * u * u * u;
  }

  // ---------------------------------------------------------------- palette
  var BASE = {};
  function tint(c, k) { return [c[0] + (90 - c[0]) * 0 + 0, c[1], c[2]]; }
  R.init = function (pal, S) {
    var t0 = performance.now();
    BASE.sky = keyRamp([[0, [2, 4, 14]], [0.35, [5, 12, 30]], [0.62, [8, 26, 50]], [0.85, [14, 52, 72]], [1, [24, 88, 92]]], SKY_N).map(function (c) { return c.map(Math.round); });
    I.sky = pal.ramp("sky", BASE.sky);
    I.star = pal.ramp("star", H(["#5a6e98", "#a4bcd8", "#f2f8ff", "#3e6c8c", "#84c4e0", "#e0fcff", "#3c7060", "#86d6a4", "#e0ffe8"]));
    I.ag = pal.ramp("ag", H(["#0a3a3a", "#0f5a48", "#17805a", "#26aa6c", "#4cd68a", "#8cf4ac", "#d0ffd8"]));
    I.at = pal.ramp("at", H(["#0a2c4c", "#0f4874", "#1868a0", "#2e94c8", "#62c4e4", "#b4ecf8"]));
    I.av = pal.ramp("av", H(["#24124a", "#3c1c72", "#5c2c9c", "#8444c4", "#b468e4", "#e4a4f8"]));
    I.ap = pal.ramp("ap", H(["#6a2470", "#a83c94", "#e068b4", "#ffa8d8"]));
    BASE.far = H(["#123048", "#1a4260", "#245a7c", "#34789a", "#4894b4", "#88c4d8", "#d4f0f8"]);
    BASE.mid = H(["#081a30", "#0e2840", "#163a54", "#245470", "#346e8c", "#62a0bc", "#a8d4e4"]);
    BASE.near = H(["#040a16", "#08121f", "#0e1e30", "#162e44", "#223f58", "#3a637e", "#78a6c0"]);
    I.far = pal.ramp("far", BASE.far); I.mid = pal.ramp("mid", BASE.mid); I.near = pal.ramp("near", BASE.near);
    I.lk = pal.ramp("lk", H(["#040a16", "#08182a", "#0e2a40", "#184260"]));
    I.ar = pal.ramp("ar", H(["#03060c", "#070d16", "#0c1622", "#12222f", "#1a3140", "#254456", "#376078"]));
    I.an = pal.ramp("an", H(["#2c4258", "#4c6c88", "#7c9cb6", "#aac6da", "#d8eaf4", "#f8fdff"]));
    I.ai = pal.ramp("ai", H(["#0a2842", "#12446a", "#1c6894", "#3094c0", "#6cc4e0", "#bcf0fa"]));
    I.arl = pal.ramp("arl", H(["#04120f", "#08201a", "#0e3026", "#16463a", "#225e50", "#327c6a", "#52a48a"]));
    I.gg0 = pal.ramp("gg0", H(["#08342c", "#0d5442", "#14785a", "#22a874", "#5cdc98", "#c8ffe0"]));
    I.gg1 = pal.ramp("gg1", H(["#08342c", "#0d5442", "#14785a", "#22a874", "#5cdc98", "#c8ffe0"]));
    I.wm = pal.ramp("wm", H(["#7a3a10", "#c8701c", "#f0a838", "#ffe49a"]));
    I.wl = pal.ramp("wl", H(["#100a08", "#20140e", "#36211a", "#563428", "#7c4c34"]));
    I.bn = pal.ramp("bn", H(["#4c483c", "#86806c", "#b8b29a", "#e8e2ca"]));
    I.bz = pal.ramp("bz", H(["#3c2c18", "#7a5a26", "#b48e3c", "#ecc870"]));
    I.ink = pal.ramp("ink", H(["#02050b"]));
    var i, n;
    for (i = 0; i < 256; i++) { DIM1[i] = i; DIM2[i] = i; }
    for (var rn in pal.ramps) { var rp = pal.ramps[rn]; for (n = 0; n < rp.n; n++) { DIM1[rp.base + n] = rp.base + Math.max(0, n - 1); DIM2[rp.base + n] = rp.base + Math.max(0, n - 2); } }
    R.markerIdx = { c0: I.ar + 2, c1: I.ar + 4, c2: I.an + 3, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };
    R.birdIdx = I.near + 1; R.watcherIdx = I.an + 2;
    R.footprint = { col: I.an + 1, hi: I.an + 4 };
    R.pal = pal; SKYA = -1; LITS = null;
    ST.key = ""; ST.skyKey = "";
    buildScene(S);
    R.initMs = performance.now() - t0;
  };
  var SKYA = -1;
  function rgbTint(c, g, k) { return [c[0] + (g[0] - c[0]) * k, c[1] + (g[1] - c[1]) * k, c[2] + (g[2] - c[2]) * k]; }
  R.palette = function (pal, S) {
    var t = S.reduced ? 1.5 : S.tSec, f = zoneF(S.altitude), a = act(t, f), q = Math.round(clamp01((a - 0.55) / 0.75) * 24) / 24;
    if (q !== SKYA) {
      SKYA = q;
      pal.setRamp("sky", BASE.sky.map(function (c, i) { var w = (i / (SKY_N - 1)); return rgbTint(c, [30, 120, 96], q * 0.30 * w * w); }));
      ["far", "mid", "near"].forEach(function (nm, ri) { var base = BASE[nm], k = q * (0.34 - ri * 0.06); pal.setRamp(nm, base.map(function (c, i) { return rgbTint(c, [120, 250, 190], i >= 3 ? k * (i - 2) / 4 : 0); })); });
    }
    for (var g = 0; g < 2; g++) {                                            // the glow in the ground breathes, each group out of step
      var k2 = 0.90 + 0.20 * Math.sin(t * 0.8 + g * 2.4);
      pal.setRamp("gg" + g, [[8, 52, 44], [13, 84, 66], [20, 120, 90], [34, 168, 116], [92, 220, 152], [200, 255, 224]].map(function (c, i) { var w = i < 2 ? 0.9 + 0.1 * k2 : k2; return [Math.min(255, c[0] * w), Math.min(255, c[1] * w), Math.min(255, c[2] * w)]; }));
    }
  };

  R.light = function (S) {
    return { x: Math.round(S.w * 0.30), y: Math.round(S.horizonY * 0.34), k: 0.5, col: [140, 255, 205], ambient: [40, 84, 108], bright: 0.62, ground: [24, 50, 60] };
  };

  // ---------------------------------------------------------------- scene caches
  function mtnPal(b) { return { rockDeep: b, rockS: b + 1, rockM: b + 2, rockL: b + 3, snowS: b + 4, snowL: b + 5, snowH: b + 6, snowD: b + 4 }; }
  function buildScene(S) {
    var a = S.adj || 1, key = S.w + "x" + S.h + "@" + a + "|" + S.horizonY;
    if (ST.key === key) return; ST.key = key; ST.skyKey = "";
    function A(v) { return Math.max(1, Math.round(v * a)); }
    var h = S.h, Hm = clamp(Math.round(h * 0.32), 86, 140);
    bakeStars(S);
    ST.far = polishPeaks(Sc.mountainStrip({ L: 1280, H: Math.round(Hm * 0.72), seed: 141, peaks: 16, hMin: 0.4, hMax: 0.95, sharp: 1.24, snow: 0.62, gullies: 4, pal: mtnPal(I.far) }), I.far);
    ST.mid = polishPeaks(Sc.mountainStrip({ L: 1152, H: Math.round(Hm * 0.90), seed: 153, peaks: 12, hMin: 0.45, hMax: 1.0, sharp: 1.16, snow: 0.52, gullies: 5, pal: mtnPal(I.mid) }), I.mid);
    ST.shoreF = tundra({ L: 1000, H: A(46), seed: 5, amp: A(4), base: A(14), tr: [A(4), A(9)], spacing: A(5), body: [I.mid + 1, I.mid + 2, I.mid + 3], trees: I.near });
    ST.tundraN = tundra({ L: 900, H: A(90) + (h - S.horizonY), seed: 9, amp: A(6), base: A(22), tr: [A(7), A(16)], spacing: A(9), body: [I.near + 1, I.near + 2, I.near + 3], trees: I.ar });
    ST.slab = buildSlab(S);
  }
  function polishPeaks(st, b) {
    var L = st.w, Hh = st.h, d = st.d, x, y, o, v;
    for (y = 1; y < Hh - 1; y++) for (x = 0; x < L; x++) {
      o = y * L + x; v = d[o]; if (v !== b + 2) continue;
      var l = d[y * L + (x + L - 1) % L], r = d[y * L + (x + 1) % L], u = d[o - L], dn = d[o + L];
      if (l === r && l === u && l === dn && l !== 0 && l !== v) d[o] = l;
    }
    for (y = Math.round(Hh * 0.5); y < Hh; y++) { var p = Math.pow((y - Hh * 0.5) / (Hh * 0.5), 1.2) * 0.7; for (x = 0; x < L; x++) { o = y * L + x; v = d[o]; if (v >= b && v < b + 3 && BP[((y & 3) << 2) | (x & 3)] < p) d[o] = v + 1; } }
    for (y = 1; y < Hh - 1; y++) for (x = 0; x < L - 1; x++) {
      o = y * L + x; v = d[o]; var r2 = d[o + 1]; if (v < b + 1 || v > b + 3 || r2 < b || r2 > b + 3) continue;
      if (v - r2 >= 2 && d[o - 1] === v) d[o] = Math.min(b + 3, v + 1);
    }
    return st;
  }
  // rolling snow dunes (tileable) with spruce silhouettes standing along the crest
  function tundra(o) {
    var L = o.L, Hh = o.H, st = Sc.newStrip(L, Hh), rnd = PX.rng(o.seed), wob = Sc.periodic(L, o.seed * 3 + 1), wob2 = Sc.periodic(L, o.seed * 5 + 9), crest = new Int16Array(L), x, y, B = o.body;
    for (x = 0; x < L; x++) crest[x] = Math.round(o.base + o.amp * (0.7 * wob(x) + 0.3 * wob2(x)));
    for (x = 0; x < L; x++) {
      var facing = clamp((crest[(x + 3) % L] - crest[(x - 3 + L) % L]) / -3, -1, 1);
      for (y = crest[x]; y < Hh; y++) { var dd = y - crest[x], b = BP[((y & 3) << 2) | (x & 3)]; st.d[y * L + x] = dd < 1 ? B[2] : dd < 3 ? (facing > 0.2 || b < 0.4 ? B[2] : B[1]) : dd < 12 ? (b < (dd - 2) / 10 ? B[0] : B[1]) : B[0]; }
    }
    var px = 0;
    while (px < L) {
      var th = Math.round(o.tr[0] + (o.tr[1] - o.tr[0]) * rnd()), hw = Math.max(1, Math.round(th * 0.26)), cy = crest[px % L] + 1, cx = px;
      for (var yy = 0; yy < th; yy++) {
        var t = yy / th, half = Math.max(0, Math.round(hw * (t < 0.08 ? 0.15 : 0.15 + t * 0.95)) - (((yy + (cx & 1)) % 3 === 0) ? 1 : 0)), top = cy - th + 1 + yy;
        if (top < 0) continue;
        for (var dx = -half; dx <= half; dx++) { var xx = (((cx + dx) % L) + L) % L; st.d[top * L + xx] = dx < -half * 0.3 ? o.trees + 2 : o.trees + 1; }
      }
      px += Math.max(2, Math.round(o.spacing * (0.5 + 1.1 * rnd())));
    }
    st.crest = o.base;
    return st;
  }

  // ---------------------------------------------------------------- sky
  function bakeSky(S, hy) {
    var w = S.w, h = S.h, key = w + "x" + h + "|" + hy;
    if (ST.skyKey === key && ST.sky) return; ST.skyKey = key;
    var fb = ST.skyFb;
    if (!fb || fb.w !== w || fb.h !== h) fb = ST.skyFb = new PX.Frame(w, h);
    var idx = []; for (var i = 0; i < SKY_N; i++) idx.push(I.sky + i);
    var skyBot = Math.min(h, hy + 30);
    Sc.bands(fb, 0, skyBot, idx, 4);
    if (skyBot < h) fb.fillRect(0, skyBot, w, h - skyBot, I.sky + SKY_N - 1);
    ST.sky = fb.d;
  }
  function bakeStars(S) {
    var w = S.w, hy = S.horizonY, a = S.adj || 1, X = [], Y = [], T = [], TT = [], TN = [], CW = w + 2 * M, CH = hy + 8 + 2 * M, ow = Math.ceil(CW / 6), occ = new Uint8Array(ow * Math.ceil(CH / 6));
    for (var y = 0; y < CH; y++) for (var x = 0; x < CW; x++) {
      var sy = y - M; if (sy < 0 || sy > hy + 4) continue;
      var hv = PX.ihash(x, y, 8123), fade = sy > hy * 0.55 ? Math.max(0.15, 1 - (sy - hy * 0.55) / (hy * 0.5)) : 1, dens = fade * a * a;
      var p3 = 0.00003 * dens, p2 = p3 + 0.0003 * dens, p1 = p2 + 0.0017 * dens, p0 = p1 + 0.0050 * dens, tier;
      if (hv >= p0) continue;
      tier = hv < p3 ? 3 : hv < p2 ? 2 : hv < p1 ? 1 : 0;
      if (tier > 0) { var oc = (y / 6 | 0) * ow + (x / 6 | 0); if (occ[oc]) continue; occ[oc] = 1; }
      var tv = PX.ihash(x, y, 9), tint = tv < 0.62 ? 0 : tv < 0.86 ? 1 : 2, tn = tier === 0 ? (PX.ihash(x, y, 13) < 0.7 ? 0 : 1) : tier === 1 ? (PX.ihash(x, y, 13) < 0.65 ? 1 : 2) : 2;
      X.push(x); Y.push(y); T.push(tier); TT.push(tint); TN.push(tn);
    }
    ST.ns = X.length; ST.sx = Int16Array.from(X); ST.sy = Int16Array.from(Y); ST.stier = Uint8Array.from(T); ST.stt = Uint8Array.from(TT); ST.stn = Uint8Array.from(TN);
  }
  function drawStars(fb, S, ox, oy, skyBot, t) {
    var n = ST.ns, X = ST.sx, Y = ST.sy, T = ST.stier, TT = ST.stt, TN = ST.stn, w = fb.w, d = fb.d, a = S.adj || 1, tick = S.reduced ? -1 : Math.floor(t * 2.0), i, o;
    for (i = 0; i < n; i++) {
      var x = X[i] + ox, y = Y[i] + oy; if (x < 0 || x >= w || y < 0 || y >= skyBot) continue;
      var tier = T[i], tn = TN[i], base = I.star + TT[i] * 3;
      if (tick >= 0 && (tier > 0 || (i & 3) === 0)) { var hh = PX.h2(i * 7 + 3, tick + (i % 5)); if (hh < 0.07 + 0.05 * tier) tn = Math.max(0, tn - 1); }
      o = y * w + x; d[o] = base + tn;
      if (tier >= 2 && x > 6 * a && x < w - 7 * a && y > 6 * a && y < skyBot - 7 * a) {
        var arm = base + (tn > 0 ? 1 : 0);
        if (tier === 2 || tn === 0) { d[o - 1] = arm; d[o + 1] = arm; d[o - w] = arm; d[o + w] = arm; }
        else { var len = Math.max(2, Math.round((3 + (i % 3)) * a)), q; for (q = 1; q <= len; q++) { var tone = q > len * 0.6 ? 0 : 1; d[o - q] = base + tone; d[o + q] = base + tone; d[o - q * w] = base + tone; d[o + q * w] = base + tone; } }
      }
    }
  }

  // ---------------------------------------------------------------- the lights: three curtains, each a lower bright edge with rays that fade upward, drawn as ordered dither
  var RIB = [
    { c: 0.50, a1: 0.075, f1: 3.4, s1: 0.16, p1: 0.9, a2: 0.040, f2: 8.1, s2: -0.27, p2: 2.2, a3: 0.016, f3: 17.0, s3: 0.42, p3: 1.3, h: 0.40, lo: "ag", hi: "at", split: 0.42, str: 1.00, seed: 1 },
    { c: 0.34, a1: 0.062, f1: 2.7, s1: -0.12, p1: 2.4, a2: 0.036, f2: 6.4, s2: 0.20, p2: 0.4, a3: 0.014, f3: 14.0, s3: -0.33, p3: 0.2, h: 0.34, lo: "at", hi: "av", split: 0.50, str: 0.80, seed: 2 },
    { c: 0.21, a1: 0.050, f1: 2.1, s1: 0.10, p1: 4.0, a2: 0.030, f2: 5.2, s2: -0.18, p2: 1.6, a3: 0.012, f3: 11.0, s3: 0.30, p3: 2.5, h: 0.26, lo: "av", hi: "ap", split: 0.60, str: 0.62, seed: 3 }
  ];
  var COLY = new Int16Array(4096), COLH = new Float32Array(4096), COLA = new Float32Array(4096), REFL = new Float32Array(4096), PROF = new Float32Array(257);
  (function () { for (var i = 0; i <= 256; i++) PROF[i] = Math.pow(1 - i / 256, 1.45); })();
  var SINT = new Float32Array(2048);
  (function () { for (var i = 0; i < 2048; i++) SINT[i] = Math.sin(i / 2048 * TAU); })();
  function sinT(x) { return SINT[((x * 325.9493) & 2047)]; }                    // sin(x) from a table (2048 steps per turn); x in radians, any sign handled by masking
  function drawAurora(fb, S, hy, t, f) {
    var w = fb.w, h = fb.h, d = fb.d, a = act(t, f), x, y, r, tt = S.reduced ? 1.5 : t, RAMP = [I.ag, I.at, I.av, I.ap], nT = [7, 6, 6, 4], SP = [0, 1, 2, 3];
    for (x = 0; x < w; x++) REFL[x] = 0;
    for (r = 0; r < RIB.length; r++) {
      var B = RIB[r], gain = r === 0 ? 1.05 - 0.15 * f : r === 1 ? 0.62 + 0.55 * f : 0.34 + 0.85 * f, ri = { ag: 0, at: 1, av: 2, ap: 3 }, lo = RAMP[ri[B.lo]], hi = RAMP[ri[B.hi]], nl = nT[ri[B.lo]], nh = nT[ri[B.hi]], cyc = B.c - 0.04 * (f - 0.5);
      var sgn = B.seed & 1 ? 1 : -1, hyB = hy * B.h;
      for (x = 0; x < w; x++) {
        var px = x / w * TAU, yb = hy * (cyc + B.a1 * sinT(px * B.f1 + tt * B.s1 + B.p1) + B.a2 * sinT(px * B.f2 + tt * B.s2 + B.p2) + B.a3 * sinT(px * B.f3 + tt * B.s3 + B.p3));
        var ray = 0.5 + 0.5 * sinT(x * 0.55 + 2.4 * sinT(x * 0.071 + tt * 0.33 + B.seed * 2) + B.seed), ray2 = 0.5 + 0.5 * sinT(x * 1.13 + tt * 0.7 * sgn + 3 * sinT(x * 0.19 + B.seed));
        var body = 0.60 + 0.40 * sinT(px * 2.2 + tt * 0.1 + B.seed * 1.7), amp = B.str * gain * a * (0.28 + 0.72 * (0.62 * ray + 0.38 * ray2)) * (0.55 + 0.45 * body);
        COLY[x] = Math.round(yb); COLH[x] = hyB * (0.62 + 0.5 * ray) * (0.65 + 0.35 * body); COLA[x] = amp;
        if (r === 0) REFL[x] = amp;
      }
      for (x = 0; x < w; x++) {
        var amp2 = COLA[x]; if (amp2 < 0.16) continue;
        var yb2 = COLY[x], Hh = COLH[x], uMax = 1 - Math.pow(0.075 / amp2, 0.6897), top = Math.max(0, Math.floor(yb2 - Hh * uMax)), inv = 256 / Hh, splitQ = (B.split - 0.10) * Hh, splitW = 0.20 * Hh, ylim = Math.min(h - 1, yb2 + 3);
        for (y = top; y <= ylim; y++) {
          var q = yb2 - y, I0, bay = BP[((y & 3) << 2) | (x & 3)];
          if (q < 0) I0 = amp2 * 0.55 * (1 + q / 4.2);
          else { I0 = amp2 * PROF[(q * inv) | 0] + (q < 2 ? amp2 * 0.55 * (1 - q / 2) : 0); }
          var lv = Math.floor(I0 * 6.0 + (bay - 0.5) * 0.95); if (lv < 1) continue;
          var useHi = q > splitQ && BP[(((y + 1) & 3) << 2) | ((x + 2) & 3)] < (q - splitQ) / splitW;
          d[y * w + x] = useHi ? hi + (lv > nh ? nh : lv) - 1 : lo + (lv > nl ? nl : lv) - 1;
        }
      }
    }
  }
  // ---------------------------------------------------------------- the frozen lake: the sky and the far peaks, mirrored, dimmed, rippled
  function drawLake(fb, S, hy, t) {
    var w = fb.w, h = fb.h, d = fb.d, a = S.adj || 1, y0 = hy + Math.round(2 * a), y1 = Math.min(h, y0 + Math.round(46 * a)), x, y, tt = S.reduced ? 0 : t;
    for (y = y0; y < y1; y++) {
      var k = y - y0, ys = y0 - 1 - Math.round(k * 0.92), row = y * w; if (ys < 0) break;
      for (x = 0; x < w; x++) {
        var rip = Math.round(Math.sin(y * 0.9 + x * 0.045 + tt * 0.5) * (0.6 + k * 0.04)) + ((k & 1) ? 1 : 0) * (PX.h2(x >> 3, y) > 0.7 ? 1 : 0), sx = clamp(x + rip, 0, w - 1), v = d[ys * w + sx];
        var b = BP[((y & 3) << 2) | (x & 3)], dm = k < 4 ? 0.0 : k < 12 ? 0.5 : k < 24 ? 1.0 : 1.6;
        var o = DIM1[v]; if (dm > 0.9 || b < dm) v = o; if (dm > 1.3 && b < dm - 1.0) v = DIM2[v];
        if (k > 26 && b < (k - 26) / 20) v = I.lk + 1 + ((y + x) & 1);
        d[row + x] = v;
      }
    }
    for (y = y0 + 1; y < y1; y += 3) for (x = ((y * 7) % 23); x < w; x += 23 + ((y * 5) & 7)) { var run = 3 + ((x * 3 + y) & 5); for (var q = 0; q < run && x + q < w; q++) d[y * w + x + q] = I.lk + 3; }   // ice glints
  }

  // ---------------------------------------------------------------- the ground: a baked, world-locked cross-section (column-major slab)
  var LITS = null, VO = { d1: 0, d2: 0, id: 0, cx: 0, cy: 0 };
  function litMaps() {                                                    // rock tone -> the same tone in a tinted twin ramp (light spilling from glow / lantern)
    LITS = { green: new Uint8Array(256), warm: new Uint8Array(256), ice: new Uint8Array(256) };
    for (var v = 0; v < 256; v++) { LITS.green[v] = v; LITS.warm[v] = v; LITS.ice[v] = v; }
    for (var q = 0; q < 7; q++) { LITS.green[I.ar + q] = I.arl + q; LITS.warm[I.ar + q] = I.wl + Math.min(4, q); LITS.ice[I.ar + q] = I.ai + Math.min(5, q); }
  }
  function voro(x, y, cs, nx, seed) {                                      // jittered-grid Voronoi, periodic in x (nx cells): nearest / second-nearest distance, id, centre
    var ix = Math.floor(x / cs), iy = Math.floor(y / cs), d1 = 1e9, d2 = 1e9, id = 0, cx = 0, cy = 0, i, j;
    for (j = -1; j <= 1; j++) for (i = -1; i <= 1; i++) {
      var gx = ix + i, gy = iy + j, wx = ((gx % nx) + nx) % nx, px = (gx + PX.ihash(wx, gy, seed)) * cs, py = (gy + PX.ihash(wx, gy, seed + 77)) * cs, dx = px - x, dy = py - y, dd = dx * dx + dy * dy;
      if (dd < d1) { d2 = d1; d1 = dd; id = wx * 73 + gy * 19; cx = px; cy = py; } else if (dd < d2) d2 = dd;
    }
    VO.d1 = Math.sqrt(d1); VO.d2 = Math.sqrt(d2); VO.id = id; VO.cx = cx; VO.cy = cy;
  }
  function buildSlab(S) {
    var a = S.adj || 1, L = 1536, D = clamp(S.h + 130, 330, 700), d = new Uint8Array(L * D), rnd = PX.rng(20260930), beds = [], cum, nb, qx, dd, k, i;
    if (!LITS) litMaps();
    function A(v) { return Math.max(1, Math.round(v * a)); }
    var crustBase = A(6); cum = crustBase; nb = 0;
    while (cum < D + 70 && nb < 70) {
      var th = A(12 + Math.floor(rnd() * 24));
      beds.push({ t: th, tone: rnd(), n1: 2 + Math.floor(rnd() * 5), n2: 8 + Math.floor(rnd() * 10), p1: rnd() * TAU, p2: rnd() * TAU, a1: A(1 + rnd() * 3.2), a2: 0.5 + rnd() * 1.5, jh: A(9 + rnd() * 6), jo: rnd() });
      cum += th; nb++;
    }
    var ed = new Int16Array(nb + 2), AR = I.ar, deepD = A(70), crustE = new Int16Array(L), cs = L / Math.round(L / A(17)), nvx = Math.round(L / cs), cs2 = L / Math.round(L / A(29)), nvx2 = Math.round(L / cs2), cw = L / Math.round(L / A(13)), ncw = Math.round(L / cw);
    var FLT = [], fr2 = PX.rng(556), fi;
    for (i = 0; i < 4; i++) FLT.push({ x: Math.floor(fr2() * L), s: (fr2() < 0.5 ? -1 : 1) * (0.35 + 0.5 * fr2()), o: (fr2() < 0.5 ? -1 : 1) * A(4 + fr2() * 9) });     // faults: slanted planes that shift the strata on one side
    for (qx = 0; qx < L; qx++) {
      var col = qx * D, snow = crustBase + Math.round(A(3) * (0.5 + 0.5 * Math.sin(qx * TAU * 7 / L + 1.0)) * (0.6 + 0.8 * PX.h2(qx >> 3, 3))) + ((PX.h2(qx >> 1, 77) > 0.62) ? 1 : 0) + ((PX.h2(Math.floor(qx / 3), 78) > 0.86) ? 1 : 0), e0 = snow;
      crustE[qx] = e0; ed[0] = e0 + A(3);
      for (k = 0; k < nb; k++) { var bd = beds[k]; ed[k + 1] = ed[k] + Math.max(4, bd.t + Math.round(bd.a1 * Math.sin(qx * TAU * bd.n1 / L + bd.p1) + bd.a2 * Math.sin(qx * TAU * bd.n2 / L + bd.p2))); }
      k = 0;
      for (dd = 0; dd < D; dd++) {
        var bay = BP[((dd & 3) << 2) | (qx & 3)] - 0.5, idx, gl = dd > deepD ? sm((dd - deepD) / A(230)) : 0;
        if (dd < e0) {                                                       // snow dust: a white rim, a green glow line in broken runs, then dithered fall-off into the rock
          var tc = dd / e0;
          if (dd === 0) idx = I.an + 5;
          else if (dd === 1) idx = PX.h2(qx >> 2, 91) > 0.28 ? I.gg1 + 4 : I.an + 4;
          else if (dd === 2) idx = PX.h2(qx >> 2, 91) > 0.28 ? I.gg1 + 2 : I.an + 3;
          else idx = I.an + clamp(Math.floor(4.4 - 2.9 * tc + bay * 1.2 + (PX.h2(qx, dd + 40) > 0.95 ? 1 : 0)), 0, 4);
        } else {
          var fld = A(15) * Math.sin(qx * TAU / L + 0.7) * clamp01((dd - A(40)) / A(160)) + A(7) * Math.sin(qx * TAU * 3 / L + 2.2) * clamp01((dd - A(70)) / A(200)), foff = 0, onF = 0, fhit = 0;
          if (dd > A(26)) for (fi = 0; fi < FLT.length; fi++) { var fu0 = qx - FLT[fi].x - FLT[fi].s * dd; fu0 = ((fu0 + L * 1.5) % L) - L * 0.5; if (fu0 > 0) foff += FLT[fi].o; if (fu0 > -0.6 && fu0 < 0.6) { onF = 1; fhit = fi; } else if (fu0 >= 0.6 && fu0 < 1.6 && !onF) onF = 2; }
          var dp = dd - fld - foff;
          while (k > 0 && dp < ed[k]) k--; while (k < nb - 1 && dp >= ed[k + 1]) k++;
          var bd2 = beds[k], ib = Math.max(0, dp - ed[k]), bh = ed[k + 1] - ed[k], fu = (qx + 0.4 * dp + 70 * Math.sin(qx * TAU * 3 / L) + 26 * Math.sin(dp * 0.045)) / A(340), fR = Math.floor(fu), ff = fu - fR;
          if (ff > 0.74 && BP[((dd & 3) << 2) | (qx & 3)] < (ff - 0.74) / 0.26) fR++;
          var fk = PX.h2(k * 5 + 1, fR * 7 + 3), kindV = fk < 0.34 ? 0 : fk < 0.62 ? 1 : fk < 0.84 ? 2 : 3;
          if (k < 1 && kindV === 0) kindV = 1;
          var tone = 4.6 - dd * 0.0055 + (bd2.tone - 0.5) * 1.2 + (PX.h2(k * 7 + 3, fR * 13 + 1) - 0.5) * 0.5;
          if (ib === 0) { idx = AR + clamp(Math.floor(tone + 1.4 + bay * 0.5), 2, 6); if (gl > 0 && PX.h2(qx >> 1, k + 300) < gl * 0.8) idx = I.gg1 + clamp(Math.floor(0.8 + gl * 3.2), 0, 4); }
          else if (ib === bh - 1) idx = AR + clamp(Math.floor(tone - 2.2), 0, 2);
          else if (kindV === 0) {                                             // jointed basalt columns
            var c = Math.floor(qx / cw), fx = qx - c * cw, cj = PX.h2(((c % ncw) + ncw) % ncw, k + 50), jy = (ib + Math.floor(cj * bd2.jh)) % bd2.jh, ct = tone + (cj - 0.5) * 1.3;
            if (fx < 1) { idx = AR + clamp(Math.floor(ct - 2.6), 0, 2); if (gl > 0.25 && PX.h2(c, dd >> 1) < gl * 0.9) idx = I.gg0 + clamp(Math.floor(gl * 3.6), 0, 4); }
            else if (fx < 2 && ib < bh * 0.8) idx = AR + clamp(Math.floor(ct + 0.7), 1, 6);
            else if (jy === 0) idx = AR + clamp(Math.floor(ct - 2.0), 0, 3);
            else if (jy === 1 && fx < cw * 0.75) idx = AR + clamp(Math.floor(ct + 0.5), 1, 5);
            else idx = AR + clamp(Math.floor(ct + bay * 0.85 - (ib / bh) * 0.7 - (fx > cw * 0.7 ? 0.5 : 0)), 0, 5);
          } else if (kindV === 1) {                                           // frost-shattered rock: angular cells, dark cracks, some filled with ice
            var big = (k % 3) === 0, ccs = big ? cs2 : cs, sxq = qx + 0.5 * dp, syq = dp * 1.15;                       // plates lean with the bedding; every third bed has bigger ones
            voro(sxq, syq, ccs, big ? nvx2 : nvx, big ? 503 : 501);
            var edge = VO.d2 - VO.d1 < 1.15, ch = PX.h2(VO.id, 3), lit = -((sxq - VO.cx) * 0.7 + (syq - VO.cy) * 0.7) / (ccs * 0.6), pang = PX.h2(VO.id, 4) * TAU, spl = ((sxq - VO.cx) * Math.cos(pang) + (syq - VO.cy) * Math.sin(pang)) / ccs;
            if (edge) idx = ch > 0.90 ? I.ai + (lit > -0.2 ? 3 : 2) : AR + clamp(Math.floor(tone - 2.4), 0, 2);
            else if (Math.abs(spl) < 0.045) idx = AR + clamp(Math.floor(tone - 1.9), 0, 2);                        // a hairline split inside the plate
            else idx = AR + clamp(Math.floor(tone + (ch - 0.5) * 1.5 + (spl > 0 ? 0.9 : -0.9) + lit * 0.5 + bay * 0.55), 0, 5);
          } else if (kindV === 2) {                                           // laminated dark rock with hoar lines
            idx = AR + clamp(Math.floor(tone - 0.3 + ((ib & 1) ? 0.4 : -0.5) + bay * 0.5 - (ib / bh) * 0.6), 0, 5);
            if (ib > 1 && (ib % 6 === 0)) idx = AR + clamp(Math.floor(tone - 1.6), 0, 3);
            var fh = PX.h2(qx * 3 + k, dd + 200); if (fh > 0.992) idx = I.ai + 5; else if (fh > 0.982) idx = I.ai + 3;
          } else idx = AR + clamp(Math.floor(tone - 0.9 + bay * 0.85 - (ib / bh) * 0.5), 0, 4);   // massive dark bed
          if (gl > 0.05) {                                                    // glow pooling in the deep: the rock turns green-lit in dithered patches, with a few hot cores
            var pv = fbm2(qx * 0.016, dd * 0.024, 41) * gl;
            if (pv > 0.24 && BP[((dd & 3) << 2) | (qx & 3)] < clamp01((pv - 0.24) * 5)) idx = LITS.green[idx];
            if (pv > 0.40) { var lvg = Math.floor((pv - 0.40) * 9 + bay * 1.2); if (lvg >= 0) idx = I.gg1 + Math.min(3, lvg); }
          }
          if (onF === 1) idx = (gl > 0.12 && PX.h2(dd >> 1, fhit + 1900) < gl * 1.6) ? I.gg1 + 3 : AR;                       // the fault plane: a dark seam, glowing in the deep
          else if (onF === 2 && idx >= AR && idx < AR + 7) idx = AR + Math.min(6, idx - AR + 2);                               // its lit lip
        }
        d[col + dd] = idx;
      }
    }
    function put(x, y, c) { x = ((x % L) + L) % L; if (y < 0 || y >= D) return; d[x * D + y] = c; }
    function lift(x, y, Rr, strength) {
      for (var yy = -Rr; yy <= Rr; yy++) for (var xx = -Rr; xx <= Rr; xx++) {
        var q = 1 - Math.sqrt(xx * xx + yy * yy) / (Rr + 0.6); if (q <= 0) continue;
        var px = (((x + xx) % L) + L) % L, py = y + yy; if (py < 0 || py >= D) continue;
        if (BP[((py & 3) << 2) | (px & 3)] < strength * q) { var o = px * D + py; d[o] = LITS.green[d[o]]; }
      }
    }
    // ice lenses: elongated pockets of clear ice along the bedding, lit on top
    var lr = PX.rng(909);
    for (i = 0; i < 26; i++) {
      var lx = Math.floor(lr() * L), ldd = A(24) + Math.floor(lr() * (D - A(70))), llen = A(14 + lr() * 34), lth = A(3.6 + lr() * 3.6);
      for (var xx = -llen; xx <= llen; xx++) {
        var f = xx / llen, hgt = lth * (1 - f * f) * (0.8 + 0.4 * PX.h2(i, xx + 600)), wy = Math.round(Math.sin(f * 2.4 + i) * 1.5), y0 = ldd + wy;
        if (y0 < crustE[(((lx + xx) % L) + L) % L] + 4) continue;
        for (var yy = 0; yy <= hgt; yy++) put(lx + xx, y0 + yy, yy === 0 ? (Math.abs(f) < 0.7 ? I.ai + 5 : I.ai + 4) : (yy >= hgt - 0.5 ? I.ai + 1 : (yy === 1 ? I.ai + 3 : I.ai + 2 + (BP[((yy & 3) << 2) | ((lx + xx) & 3)] < 0.35 ? 1 : 0))));
        if (hgt >= 1) put(lx + xx, y0 + Math.ceil(hgt) + 1, AR);
      }
    }
    // cracks
    var cr = PX.rng(4243);
    for (i = 0; i < 40; i++) {
      var cx = Math.floor(cr() * L), cy = A(16) + Math.floor(cr() * (D - A(60))), cl = A(20 + cr() * 60), sl = (cr() < 0.5 ? -1 : 1) * (0.5 + cr() * 1.3);
      for (k = 0; k < cl; k++) { var px = cx + k, py = Math.round(cy + k * sl * 0.5 + (PX.h2(i, k + 900) - 0.5) * 1.6); if (py < crustE[((px % L) + L) % L] + 5) continue; put(px, py, AR); put(px, py + 1, AR + 3 + (PX.h2(px, py) > 0.6 ? 1 : 0)); }
    }
    // veins of glow: meandering green threads with a lit halo, in two pulse groups
    var vr = PX.rng(778);
    for (i = 0; i < 56; i++) {
      var vgs = [I.gg0, I.gg1][i % 2], vx = vr() * L, vy = A(60) + vr() * (D - A(90)), vl = A(50 + vr() * 130), ang = (vr() < 0.5 ? 0.55 : 2.55) + (vr() - 0.5) * 0.7, len0 = vl, pts = [];
      for (k = 0; k < vl; k++) {
        ang += (PX.h2(i, k + 1300) - 0.5) * 0.55; ang = clamp(ang, 0.2, 2.94); vx += Math.cos(ang); vy += Math.sin(ang);
        var ix = Math.round(vx), iy = Math.round(vy), ends = Math.min(k, len0 - k) / (len0 * 0.18), ct = ends < 1 ? 2 : 4 + (PX.h2(ix, iy) > 0.8 ? 1 : 0);
        if (iy < crustE[((ix % L) + L) % L] + 6 || iy >= D - 2) continue;
        if (k % 4 === 0) lift(ix, iy, 4, 0.9);
        pts.push(ix, iy, ct, ends < 1 ? 0 : 2, iy > A(150) ? 1 : 0);
      }
      for (k = 0; k < pts.length; k += 5) { put(pts[k] - 1, pts[k + 1], AR); put(pts[k], pts[k + 1], vgs + pts[k + 2]); put(pts[k] + 1, pts[k + 1], vgs + pts[k + 3]); if (pts[k + 4]) { put(pts[k] + 1, pts[k + 1], vgs + pts[k + 2] - 1); put(pts[k] + 2, pts[k + 1], vgs + 1); } }
    }
    return { d: d, L: L, D: D, crust: crustE };
  }
  function blitSlab(fb, S, qoff) {
    var w = fb.w, h = fb.h, d = fb.d, lip = S.lip, SLB = ST.slab, sd = SLB.d, L = SLB.L, D = SLB.D, x, i;
    for (x = 0; x < w; x++) {
      var l = lip[x]; if (l >= h) continue;
      var col = ((((x + qoff) % L) + L) % L) * D, y0 = l < 0 ? 0 : l, dd = y0 - l, o = y0 * w + x, n = Math.min(h - y0, D - dd);
      for (i = 0; i < n; i++, o += w) d[o] = sd[col + dd + i];
      if (n < h - y0) { var fill = sd[col + D - 1]; for (i = n; i < h - y0; i++, o += w) d[o] = fill; }
    }
  }
  // ---------------------------------------------------------------- underground props (upright stamps, world-locked through the same scroll offset)
  function halo(fb, cx, cy, Rx, Ry, strength, map) {
    if (fb.rec) { fb.halos.push([cx, cy, Rx, Ry, strength, map]); return; }
    var w = fb.w, h = fb.h, d = fb.d, x, y, x0 = Math.max(0, cx - Rx), x1 = Math.min(w - 1, cx + Rx), y0 = Math.max(0, cy - Ry), y1 = Math.min(h - 1, cy + Ry);
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      var dx = (x - cx) / Rx, dy = (y - cy) / Ry, q = 1 - Math.sqrt(dx * dx + dy * dy); if (q <= 0) continue;
      if (BP[((y & 3) << 2) | (x & 3)] < strength * Math.pow(q, 1.25)) { var o = y * w + x, v = map[d[o]]; if (v !== d[o]) d[o] = v; }
    }
  }
  function stoneBlob(fb, cx, cy, r, cap) {                                  // an embedded stone: lit top-left, dark rim on the shaded side; shallow ones wear a cap of snow
    var rw = r * 1.3, AR = I.ar, x, y;
    for (y = -Math.ceil(r); y <= Math.ceil(r); y++) for (x = -Math.ceil(rw); x <= Math.ceil(rw); x++) {
      var ex = x / 1.3, d2 = ex * ex + y * y; if (d2 > r * r) continue;
      var lit = (-(ex * 0.7 + y * 0.7)) / r, bay = BP[(((cy + y) & 3) << 2) | ((cx + x) & 3)] - 0.5, tone = clamp(Math.floor(3.4 + lit * 3.0 + bay * 0.9), 2, 6), c = AR + tone;
      if (d2 > (r - 1.1) * (r - 1.1)) c = AR + (lit > 0.15 ? 6 : lit > -0.2 ? 4 : 0);
      if (cap && y < -r * 0.30 && lit > -0.15) c = I.an + (y < -r * 0.62 ? 5 : 4);
      fb.set(cx + x, cy + y, c);
    }
  }
  function rockShard(fb, cx, cy, r, seed, cap) {                            // an angular embedded rock: a lit facet, a mid facet, a shaded one
    var rnd = PX.rng(seed | 0), n = 6 + Math.floor(rnd() * 2), vx = [], vy = [], i, j, x, y, R0 = Math.ceil(r * 1.4) + 2, W = R0 * 2 + 1, mask = new Uint8Array(W * W), AR = I.ar;
    for (i = 0; i < n; i++) { var an = (i + rnd() * 0.5) / n * TAU, rr = r * (0.72 + 0.34 * rnd()); vx.push(Math.cos(an) * rr * 1.3); vy.push(Math.sin(an) * rr * 0.8); }
    for (y = -R0; y <= R0; y++) for (x = -R0; x <= R0; x++) {
      var inside = false; for (i = 0, j = n - 1; i < n; j = i++) { if (((vy[i] > y + 0.5) !== (vy[j] > y + 0.5)) && (x + 0.5 < (vx[j] - vx[i]) * (y + 0.5 - vy[i]) / (vy[j] - vy[i]) + vx[i])) inside = !inside; }
      if (inside) mask[(y + R0) * W + x + R0] = 1;
    }
    function at(xx, yy) { xx += R0; yy += R0; return xx >= 0 && yy >= 0 && xx < W && yy < W && mask[yy * W + xx] === 1; }
    var ca = Math.cos(rnd() * TAU), sa = Math.sin(rnd() * TAU);
    for (y = -R0; y <= R0; y++) for (x = -R0; x <= R0; x++) {
      if (!at(x, y)) continue;
      var lit = -(x * 0.62 + y * 0.78) / (r * 1.3), facet = (x * ca + y * sa) / (r * 1.3), tone = lit > 0.34 ? 5 : lit > -0.05 ? 4 : lit > -0.45 ? 3 : 2;
      if (facet > 0.28 && tone > 2) tone--; else if (facet < -0.35 && tone < 5) tone++;
      tone = clamp(Math.floor(tone + (BP[(((cy + y) & 3) << 2) | ((cx + x) & 3)] - 0.5) * 0.6), 2, 5);
      if (!(at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1))) tone = lit > 0.1 ? 6 : lit > -0.25 ? 4 : 0;
      var c = AR + tone; if (cap && y < -r * 0.15 && lit > -0.1) c = I.an + (at(x, y - 1) ? 4 : 5);
      fb.set(cx + x, cy + y, c);
    }
  }
  function tonesOf(ramp) { return [ramp, ramp + 1, ramp + 2, ramp + 3, ramp + 5]; }
  function crystalShards(fb, cx, cy, seed, k, ramp, up) {                   // faceted prisms with a slanted tip: left face lit, a bright centre face, a dark right face
    var rnd = PX.rng(seed | 0), n = 3 + Math.floor(rnd() * 3), i, x, y, tn = tonesOf(ramp), list = [], sgn = up ? 1 : -1;
    for (i = 0; i < n; i++) {
      var f = n === 1 ? 0 : (i / (n - 1)) * 2 - 1, main = i === Math.floor(n / 2);
      list.push({ f: f, main: main, ang: f * 0.5 + (rnd() - 0.5) * 0.22, len: (main ? 14 + rnd() * 8 : 7 + rnd() * 8) * k, hw: Math.max(1.8, (main ? 3.3 : 2.3 + rnd() * 0.8) * k), bx: cx + f * 4.5 * k });
    }
    list.sort(function (p, q) { return (q.main ? 0 : 1) - (p.main ? 0 : 1) || Math.abs(q.f) - Math.abs(p.f); });
    for (i = 0; i < list.length; i++) {
      var S0 = list[i], ca = Math.cos(S0.ang), sa = Math.sin(S0.ang), ext = Math.ceil(S0.len + S0.hw * 2 + 2), tip0 = 0.60 * S0.len;
      for (y = -ext; y <= ext; y++) for (x = -ext; x <= ext; x++) {
        var dx = x + 0.5 - (S0.bx - cx), dy = (y + 0.5) * sgn, u = dx * sa - dy * ca, s = dx * ca + dy * sa;
        if (u < -0.5 || u > S0.len) continue;
        var tipK = u > tip0 ? (u - tip0) / (S0.len - tip0) : 0, half = S0.hw * (1 - tipK) + 0.2, off = tipK * S0.hw * 0.45, rs = s - off;
        if (rs < -half || rs > half) continue;
        var rel = rs / half, tone;
        if (tipK > 0) tone = rel < -0.1 ? 3 : 1;
        else tone = rel < -0.80 ? 4 : rel < -0.42 ? 3 : rel < 0.26 ? 4 : rel < 0.80 ? 2 : 0;
        if (tipK === 0 && rel < -0.80 && half > 2.6) tone = 3;
        if (u < 0.8) tone = 0;
        if (tipK > 0.82 && rel < 0.1) tone = 4;
        fb.set(cx + x, cy + y, tn[tone]);
      }
    }
  }
  function lantern(fb, cx, cy, fl) {                                   // somebody's lantern, still burning: brass cage, a live flame, a warm light on the rock
    var BZ = I.bz, WM = I.wm, x, y;
    halo(fb, cx, cy - 7, 28, 24, 0.95, LITS.warm);
    fb.set(cx, cy - 15, BZ + 2); fb.set(cx - 1, cy - 14, BZ + 1); fb.set(cx + 1, cy - 14, BZ + 1); fb.set(cx - 1, cy - 13, BZ + 1); fb.set(cx + 1, cy - 13, BZ + 1);
    for (x = -3; x <= 3; x++) { fb.set(cx + x, cy - 12, x < 0 ? BZ + 3 : BZ + 2); fb.set(cx + x, cy - 11, BZ + 1); }
    for (y = -10; y <= -3; y++) for (x = -3; x <= 3; x++) {
      var c;
      if (x === -3) c = BZ + 2; else if (x === 3) c = BZ; else c = WM + (Math.abs(x) === 2 ? 0 : 1);
      if (Math.abs(x) < 3) { var fx = Math.abs(x), top = -9 + (fl === 1 ? 1 : 0), bot = -4; if (y >= top && y <= bot) { var half = y === top ? 0 : (y < -7 ? 1 : (y < -5 ? 1 : 1)); if (y >= -7 && y <= -5) half = 1; if (fx <= half) c = (fx === 0 && y > top && y < bot) ? WM + 3 : WM + 2; if (y === bot && fx === 0) c = WM + 3; if (fx === 2 && y >= -6 && y <= -5 && fl === 2) c = WM + 2; } }
      fb.set(cx + x, cy + y, c);
    }
    for (x = -4; x <= 4; x++) fb.set(cx + x, cy - 2, x < 0 ? BZ + 2 : BZ + 1);
    for (x = -3; x <= 3; x++) fb.set(cx + x, cy - 1, BZ);
  }
  function tusk(fb, cx, cy, R, flip) {                                      // a mammoth tusk: a long ivory arc, thick at the root, ringed with growth lines
    var BN = I.bn, x, y, a0 = Math.PI * 1.08, a1 = Math.PI * 1.86;
    for (y = -R - 3; y <= 3; y++) for (x = -R - 4; x <= R + 4; x++) {
      var xx = flip ? -x : x, r = Math.sqrt(xx * xx + y * y), ang = Math.atan2(y, xx); if (ang < 0) ang += TAU;
      if (ang < a0 || ang > a1) continue;
      var t = (ang - a0) / (a1 - a0), th = 4.4 - 3.6 * t; if (Math.abs(r - R) > th * 0.5) continue;
      var side = (r - R) / (th * 0.5), lit = -(Math.cos(ang) * 0.7 + Math.sin(ang) * 0.7) * (side > 0 ? 1 : -0.6), c = side > 0.55 ? BN + 3 : (side < -0.55 ? BN + 1 : BN + 2);
      if (Math.abs(side) > 0.8) c = lit > 0 ? BN + 3 : BN;
      if (t < 0.4 && ((Math.floor(ang * 26)) % 3) === 0 && Math.abs(side) < 0.6) c = BN + 1;
      fb.set(cx + x, cy + y, c);
    }
  }
  function wheel(fb, cx, cy, r) {                                           // a ship's wheel from an expedition that never came home, frosted along its upper rim
    var BZ = I.bz, k, x, y;
    for (y = -r - 4; y <= r + 4; y++) for (x = -r - 4; x <= r + 4; x++) {
      var dd = Math.sqrt(x * x + y * y), lit = -(x + y) / (r * 1.4);
      if (dd <= r + 0.5 && dd > r - 1.5) fb.set(cx + x, cy + y, lit > 0.3 ? I.an + 4 : (lit > -0.2 ? BZ + 3 : BZ + 1));
      else if (dd <= r * 0.42 && dd > r * 0.42 - 1.3) fb.set(cx + x, cy + y, BZ + 2);
      else if (dd < r * 0.42 - 1.3) fb.set(cx + x, cy + y, I.ar + 1);
    }
    for (k = 0; k < 8; k++) {
      var a = k / 8 * TAU + 0.2, ca = Math.cos(a), sa = Math.sin(a), t;
      for (t = r * 0.42; t < r + 4; t++) { var px = Math.round(cx + ca * t), py = Math.round(cy + sa * t); fb.set(px, py, t > r + 1.5 ? BZ + 3 : (ca + sa < 0 ? BZ + 3 : BZ + 1)); }
    }
    fb.set(cx, cy, I.gg1 + 4);
  }
  function antler(fb, x, y, len, flip, seed) {
    var BN = I.bn, rnd = PX.rng(seed | 0);
    function branch(bx, by, ang, l, depth) {
      var px = bx, py = by;
      for (var s = 0; s < l; s++) {
        ang += (rnd() - 0.5) * 0.18 - 0.03 * (flip ? -1 : 1); px += Math.cos(ang) * (flip ? -1 : 1); py += Math.sin(ang);
        fb.set(Math.round(px), Math.round(py), s < l * 0.7 ? BN + 2 : BN + 3); fb.set(Math.round(px) + 1, Math.round(py) + 1, BN + 1);
        if (depth < 2 && s > 3 && s % 5 === 0 && rnd() < 0.85) branch(px, py, ang - 0.7 - rnd() * 0.5, Math.round(l * (0.35 + 0.25 * rnd())), depth + 1);
      }
    }
    branch(x, y, -1.0, len, 0); branch(x + 3, y + 1, -0.5, Math.round(len * 0.7), 1);
  }
  function bell(fb, cx, cy, seed) {                                         // a bronze bell gone green, its clapper still hanging
    var BZ = I.bz, y, x;
    fb.set(cx, cy - 13, BZ + 2); fb.set(cx - 1, cy - 12, BZ + 1); fb.set(cx + 1, cy - 12, BZ + 1);
    for (y = -11; y <= 0; y++) {
      var half = y < -8 ? 2 + (y + 11) * 0.5 : y < -2 ? 3.6 + (y + 8) * 0.12 : 4.3 + (y + 2) * 1.2;
      for (x = -Math.ceil(half); x <= Math.ceil(half); x++) {
        if (Math.abs(x) > half) continue;
        var rel = x / half, c = rel < -0.5 ? BZ + 3 : rel < 0.3 ? BZ + 2 : BZ + 1;
        if (y === 0) c = BZ + 3; if (Math.abs(rel) > 0.85) c = rel < 0 ? BZ + 3 : BZ;
        if (PX.h2(x * 7 + seed, y * 3) > 0.78) c = I.gg1 + 2;                          // verdigris
        fb.set(cx + x, cy + y, c);
      }
    }
    fb.set(cx, cy + 1, BZ + 1); fb.set(cx, cy + 2, BZ + 2);
  }
  function iceleaf(fb, cx, cy, seed) {                                      // a block of clear ice with a fern still glowing green inside it
    var x, y, rx = 12, ry = 8, rnd = PX.rng(seed | 0), c1 = 0.25 + rnd() * 0.15;
    halo(fb, cx, cy, 26, 20, 0.75, LITS.green);
    for (y = -ry; y <= ry; y++) for (x = -rx; x <= rx; x++) {                // a chamfered block: corners cut, one long edge lit
      var ax = Math.abs(x) / rx, ay = Math.abs(y) / ry; if (ax + ay * 0.62 > 1.28 - c1 * 0.2 || ax > 1 || ay > 1) continue;
      var lit = -(x / rx * 0.6 + y / ry * 0.8), edge = ax > 0.9 || ay > 0.88 || (ax + ay * 0.62 > 1.08), c;
      if (edge) c = lit > 0.25 ? I.ai + 5 : lit > -0.3 ? I.ai + 3 : I.ai + 1;
      else c = BP[(((cy + y) & 3) << 2) | ((cx + x) & 3)] < 0.30 + 0.3 * (y / ry + 1) * 0.5 ? I.ai + 1 : I.ai + 2;
      fb.set(cx + x, cy + y, c);
    }
    for (y = -5; y <= 5; y++) fb.set(cx - (y >> 3), cy + y, I.gg1 + 3);                                             // the stem
    for (var k = 0; k < 5; k++) { var yy = -4 + k * 2, ln = 5 - Math.abs(k - 1.6) * 0.9; for (x = 1; x <= ln; x++) { var c2 = I.gg1 + (x > 3 ? 3 : 4); fb.set(cx + x, cy + yy - (x >> 1), c2); fb.set(cx - x, cy + yy - (x >> 1), c2); } }
    fb.set(cx, cy - 6, I.gg1 + 5); fb.set(cx, cy - 5, I.gg1 + 5);
  }
  function grotto(fb, cx, cy, rx, ry, seed, grp) {                          // an ice cavern: a lit lip, dark air, a green pool, icicles hanging from the roof and crystals rising from the water
    var gg = grp % 2 ? I.gg1 : I.gg0, rnd = PX.rng(seed | 0), x, y, w0 = rnd() * TAU, w1 = rnd() * TAU, poolY = Math.round(ry * 0.32), k = Math.max(0.8, rx / 24), i;
    halo(fb, cx, cy, Math.round(rx * 2.1), Math.round(ry * 2.3), 0.9, LITS.green);
    for (y = -ry - 4; y <= ry + 4; y++) for (x = -rx - 4; x <= rx + 4; x++) {
      var th = Math.atan2(y / ry, x / rx), e = Math.sqrt((x / rx) * (x / rx) + (y / ry) * (y / ry)) / (1 + 0.10 * Math.sin(3 * th + w0) + 0.06 * Math.sin(7 * th + w1));
      if (e > 1.14) continue;
      var lit = -(x / rx * 0.7 + y / ry * 0.7), c, bay = BP[(((cy + y) & 3) << 2) | ((cx + x) & 3)];
      if (e > 1.0) c = lit > 0.25 ? I.ai + 5 : lit > -0.25 ? I.ai + 2 : I.ar;
      else if (y > poolY) { var pd = y - poolY; c = pd === 1 ? gg + 4 : (pd < 4 ? (bay < 0.5 ? gg + 3 : gg + 2) : ((pd % 3) === 0 && bay < 0.6 ? gg + 1 : (bay < 0.35 ? gg + 2 : gg + 1))); }
      else c = (bay < (y + ry) / (ry * 2.6) * 0.5 + 0.06) ? gg : I.ink;
      fb.set(cx + x, cy + y, c);
    }
    for (i = 0; i < 3; i++) crystalShards(fb, cx + Math.round((-0.55 + 1.1 * (i + 0.5) / 3) * rx * 0.8), cy + poolY + 1, seed * 3 + i, k * (0.55 + 0.45 * rnd()), gg, true);
    for (i = 0; i < 6; i++) { var qx = cx + Math.round((-0.75 + 1.5 * (i + 0.5) / 6) * rx * 0.7), qt = Math.round(-ry * Math.sqrt(Math.max(0.05, 1 - Math.pow((qx - cx) / rx, 2))) * 0.94); crystalShards(fb, qx, cy + qt + 1, seed * 5 + i, k * (0.3 + 0.35 * rnd()), I.ai, false); }
  }
  function greenCluster(fb, cx, cy, seed, k) {
    halo(fb, cx, cy - Math.round(6 * k), Math.round(26 * k), Math.round(22 * k), 0.85, LITS.green);
    var mr = Math.round(7 * k), x, y;
    for (y = -Math.round(mr * 0.6); y <= 2; y++) for (x = -mr; x <= mr; x++) if ((x * x) / (mr * mr) + (y * y) / (mr * mr * 0.36) <= 1) fb.set(cx + x, cy + y, I.ar + ((y < 0 && x < 0) ? 3 : 1));
    crystalShards(fb, cx, cy, seed, k * 1.15, seed & 1 ? I.gg0 : I.gg1, true);
    crystalShards(fb, cx - Math.round(2 * k), cy + 1, seed + 5, k * 0.7, I.ai, true);
  }

  // a stamp is rendered once into a list of pixels (plus the light it spills on its surroundings) and replayed every frame
  var SCACHE = new Map();
  function stamp(fb, key, cx, cy, fn) {
    var rec = SCACHE.get(key), i;
    if (!rec) {
      var pix = new Map(), halos = [], R0 = { w: 0, h: 0, d: null, rec: true, halos: halos, set: function (x, y, c) { if (x > -250 && x < 700 && y > -250 && y < 700) pix.set((y + 256) * 1024 + (x + 256), c); } };
      fn(R0);
      var n = pix.size, xs = new Int16Array(n), ys = new Int16Array(n), cs = new Uint8Array(n); i = 0;
      pix.forEach(function (c, k) { xs[i] = (k & 1023) - 256; ys[i] = ((k / 1024) | 0) - 256; cs[i] = c; i++; });
      rec = { xs: xs, ys: ys, cs: cs, n: n, halos: halos };
      SCACHE.set(key, rec); if (SCACHE.size > 700) SCACHE.delete(SCACHE.keys().next().value);
    }
    for (i = 0; i < rec.halos.length; i++) { var hs = rec.halos[i]; halo(fb, cx + hs[0], cy + hs[1], hs[2], hs[3], hs[4], hs[5]); }
    var w = fb.w, h = fb.h, d = fb.d, xs2 = rec.xs, ys2 = rec.ys, cs2 = rec.cs;
    for (i = 0; i < rec.n; i++) { var x = cx + xs2[i], y = cy + ys2[i]; if (x >= 0 && y >= 0 && x < w && y < h) d[y * w + x] = cs2[i]; }
  }

  function groundStamps(fb, S, qoff, heroX) {
    if (!LITS) litMaps();
    var w = fb.w, h = fb.h, lip = S.lip, a = S.adj || 1, t = S.reduced ? 0 : S.tSec, c, j;
    function A(v) { return Math.max(1, Math.round(v * a)); }
    var CW = A(52), c0 = Math.floor((qoff - 80) / CW), c1 = Math.floor((qoff + w + 80) / CW);
    for (c = c0; c <= c1; c++) {
      for (j = 0; j < 8; j++) {
        var hh = PX.h2(c * 13 + j, 7100 + j * 3), P = [0.62, 0.5, 0.40, 0.26, 0.34, 0.18, 0.14, 0.14][j];
        if (hh > P) continue;
        var qx = c * CW + PX.h2(c, 7200 + j) * CW, sx = Math.round(qx - qoff); if (sx < -40 || sx > w + 40) continue;
        var lo = [14, 90, 34, 50, 70, 90, 100, 30][j], hi = [150, 300, 260, 300, 300, 300, 320, 250][j];
        var dd = A(lo + PX.h2(c, 7300 + j) * (hi - lo)), sy = lip[clamp(sx, 0, w - 1)] + dd; if (sy < -30 || sy > h + 30) continue;
        var sd = c * 17 + j * 5, pick = PX.h2(c, 7400 + j), K = "|" + sd, fl = S.reduced ? 0 : Math.floor(t * 7 + c) % 3;
        if (j <= 1) {
          var rr0 = Math.max(2, A(2.5 + PX.h2(c, 7500 + j) * 6)), cap = dd < A(80);
          if (rr0 >= 5 && pick > 0.3) stamp(fb, "rs" + K + "|" + rr0 + cap, sx, sy, function (r) { rockShard(r, 0, 0, rr0, sd, cap); });
          else stamp(fb, "sb|" + rr0 + cap, sx, sy, function (r) { stoneBlob(r, 0, 0, rr0, cap); });
        } else if (j === 2) {
          if (pick < 0.16) stamp(fb, "ln|" + fl, sx, sy, function (r) { lantern(r, 0, 0, fl); });
          else if (pick < 0.42) { var tr = A(15 + pick * 8), tfl = pick > 0.33; stamp(fb, "tu|" + tr + tfl, sx, sy, function (r) { tusk(r, 0, 0, tr, tfl); }); }
          else if (pick < 0.62) stamp(fb, "wh|" + a, sx, sy, function (r) { wheel(r, 0, 0, A(8)); });
          else if (pick < 0.84) { var al = A(15 + pick * 6), afl = pick > 0.75; stamp(fb, "an|" + al + afl + K, sx, sy, function (r) { antler(r, 0, 0, al, afl, sd); }); }
          else if (pick < 0.92) stamp(fb, "bl" + K, sx, sy, function (r) { bell(r, 0, 0, sd); });
          else stamp(fb, "il" + K, sx, sy, function (r) { iceleaf(r, 0, 0, sd); });
        }
        else if (j === 3) stamp(fb, "il" + K, sx, sy, function (r) { iceleaf(r, 0, 0, sd); });
        else if (j === 4) { var kc = Math.max(0.8, a * (0.85 + 0.5 * pick)); stamp(fb, "gc|" + kc.toFixed(2) + K, sx, sy, function (r) { greenCluster(r, 0, 0, sd, kc); }); }
        else if (j === 5) { if (pick < 0.7) stamp(fb, "ln|" + fl, sx, sy, function (r) { lantern(r, 0, 0, fl); }); else stamp(fb, "bl" + K, sx, sy, function (r) { bell(r, 0, 0, sd); }); }
        else if (j === 6) { var gx = A(20 + pick * 10), gy = A(12 + pick * 7); stamp(fb, "gr|" + gx + "|" + gy + K + "|" + (c % 2), sx, sy, function (r) { grotto(r, 0, 0, gx, gy, sd, c); }); }
        else { var r7 = Math.max(3, A(4 + pick * 4)), cap7 = dd < A(80); stamp(fb, "rs" + K + "|" + r7 + cap7, sx, sy, function (r) { rockShard(r, 0, 0, r7, sd, cap7); }); }
      }
    }
    // things standing on the crest, kept clear of the hero and his stone: ice spires, snow mounds, capped pebbles
    var cw2 = A(46), q0 = Math.floor((qoff - 30) / cw2), q1 = Math.floor((qoff + w + 30) / cw2), clearL = heroX - 34 * a - 8, clearR = heroX + ((S.stoneX || 40) + (S.stoneR || 30) * 2) * S.zoom + 24;
    for (c = q0; c <= q1; c++) {
      var hv = PX.h2(c, 8100); if (hv > 0.62) continue;
      var x2 = Math.round(c * cw2 + PX.h2(c, 8101) * cw2 - qoff); if (x2 < 2 || x2 > w - 3 || (x2 > clearL && x2 < clearR)) continue;
      var by = lip[x2] + 1, kk = Math.max(0.6, a * (0.5 + 0.6 * PX.h2(c, 8102))), cp = PX.h2(c, 8103), seed2 = c * 7 + 3;
      if (cp < 0.45) { stamp(fb, "is|" + kk.toFixed(2) + "|" + seed2, x2, by, function (r) { crystalShards(r, 0, 0, seed2, kk, I.ai, true); }); if (!S.reduced && Math.floor(t * 1.5 + c) % 3 === 0) fb.set(x2 + 1, by - Math.round(15 * kk), I.star + 5); }
      else if (cp < 0.78) { var mr = Math.max(3, A(4 + 6 * PX.h2(c, 8104))); stamp(fb, "sm|" + mr, x2, by, function (r) { var mh = Math.max(2, Math.round(mr * 0.45)), xx, yy; for (yy = 0; yy < mh; yy++) for (xx = -mr; xx <= mr; xx++) { var e2 = (xx * xx) / (mr * mr) + ((yy - 0.5) * (yy - 0.5)) / (mh * mh); if (e2 > 1) continue; r.set(xx, -yy, yy === mh - 1 || (e2 > 0.8 && xx < 0) ? I.an + 5 : (xx > mr * 0.35 ? I.an + 2 : I.an + 4)); } }); }
      else { var pr = Math.max(2, A(2 + PX.h2(c, 8106) * 2.4)); stamp(fb, "pb|" + pr, x2, by, function (r) { stoneBlob(r, 0, 0, pr, true); }); }
    }
  }

  // diamond dust: tiny ice crystals turning in the light, drifting a little, catching the green
  function drawDust(fb, S) {
    if (S.reduced) return;
    var w = fb.w, h = fb.h, d = fb.d, t = S.tSec, lip = S.lip, n = 26, i;
    for (i = 0; i < n; i++) {
      var sp = 1.6 + PX.h1(i * 7 + 1) * 3.0, span = w + 60, xx = (((PX.h1(i * 11 + 2) * span - t * sp - S.scroll * S.zoom * 0.10) % span) + span) % span - 30, yy = (0.12 + 0.78 * PX.h1(i * 13 + 3)) * h + Math.sin(t * (0.4 + PX.h1(i * 5) * 0.5) + i * 2.3) * 6;
      var x = Math.round(xx), y = Math.round(yy); if (x < 0 || x >= w || y < 0 || y >= h || y > lip[x] - 3) continue;
      var ph = Math.sin(t * (1.3 + PX.h1(i * 3 + 9) * 1.4) + i * 1.7); if (ph < 0.25) continue;
      d[y * w + x] = ph > 0.8 ? I.star + 5 : I.star + 4;
      if (ph > 0.9) { if (x + 1 < w) d[y * w + x + 1] = I.star + 3; if (x > 0) d[y * w + x - 1] = I.star + 3; if (y > 0) d[(y - 1) * w + x] = I.star + 3; if (y + 1 < h) d[(y + 1) * w + x] = I.star + 3; }
    }
  }

  var SCR = { acc: 0, sc: null, hx: 0 };
  function qoffset(S) {
    var hx = S.ztx + S.anchorX * S.zoom;
    if (SCR.sc === null) SCR.acc = S.scroll * S.zoom - hx; else SCR.acc += (S.scroll - SCR.sc) * S.zoom - (hx - SCR.hx);
    SCR.sc = S.scroll; SCR.hx = hx;
    return Math.round(SCR.acc);
  }
  // ---------------------------------------------------------------- backdrop
  R.backdrop = function (fb, S, pal) {
    buildScene(S);
    var w = fb.w, h = fb.h, hy = S.horizonY + Math.round((1 - S.openingT) * S.h * 0.12), al = S.altitude, t = S.reduced ? 0 : S.tSec, a = S.adj || 1, f = zoneF(al), zone = f * 1500;
    function A(v) { return Math.max(1, Math.round(v * a)); }
    bakeSky(S, hy);
    fb.d.set(ST.sky);
    var skyBot = Math.min(h, hy + 30), ox = -M - Math.round(f * 6), oy = -M + Math.round((1 - S.openingT) * S.h * 0.05);
    drawStars(fb, S, ox, oy, skyBot, t);
    drawAurora(fb, S, hy, t, f);
    Sc.blitStrip(fb, ST.far, zone * 0.03 + 60, hy - ST.far.h + A(10));
    Sc.blitStrip(fb, ST.mid, zone * 0.07 + 300, hy - ST.mid.h + A(14));
    Sc.blitStrip(fb, ST.shoreF, zone * 0.10 + 80, hy - A(6) - ST.shoreF.crest);
    drawLake(fb, S, hy, t);
    var yN = hy + A(40) - ST.tundraN.crest;
    Sc.blitStrip(fb, ST.tundraN, zone * 0.30 + 20, yN);
  };
  R.ground = function (fb, S, pal) {
    buildScene(S);
    var qoff = qoffset(S), heroX = Math.round(S.ztx + S.anchorX * S.zoom);
    blitSlab(fb, S, qoff);
    groundStamps(fb, S, qoff, heroX);
  };
  R.front = function (fb, S, pal, res) { drawDust(fb, S); };
  V8.register("aurora", R);
})(typeof window !== "undefined" ? window : this);
