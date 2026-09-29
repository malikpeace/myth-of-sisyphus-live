// The Night Sky - V8 scene for the galaxy zone (1800-2500 m). Everything is generated in code on the shared indexed
// framebuffer: a banded, dithered indigo-to-violet sky, a dense star field in four sizes and tints (they twinkle), a
// milky-way band with dust lanes and a warm core, three soft nebulae, the odd shooting star, a cold sea of cloud tops
// with starlit peaks rising out of it - and below, the ground as a lit cross-section: violet slate strata, cyan veins that
// pulse slowly, geodes, meteorites, fossils and a buried observatory, with a deep cyan glow far below.
(function (root) {
  "use strict";
  var PX = root.PX, Sc = root.Sc, V8 = root.V8, hex = PX.hex, clamp = PX.clamp, clamp01 = PX.clamp01, B4 = PX.BAYER4, TAU = Math.PI * 2;
  var R = { rock: { mat: "night", style: "granite" }, noBirds: true, noThunder: true, thumb: { alt: 2150, zoom: 0.66, slope: 0.10, ratio: 0.74 } };
  var I = {}, ST = { key: "", skyKey: "" }, BP = new Float32Array(16), M = 24, SKY_N = 13;
  for (var bi = 0; bi < 16; bi++) BP[bi] = B4[bi >> 2][bi & 3] + 0.5;

  function H(list) { return list.map(hex); }
  function sm(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function keyRamp(keys, n) {                                        // keys: [[pos 0..1, [r,g,b]], ...] -> n colours
    var out = [];
    for (var i = 0; i < n; i++) {
      var p = n === 1 ? 0 : i / (n - 1), k = 0;
      while (k < keys.length - 2 && p > keys[k + 1][0]) k++;
      var a = keys[k], b = keys[k + 1], f = clamp01((p - a[0]) / Math.max(1e-6, b[0] - a[0]));
      out.push([Math.round(a[1][0] + (b[1][0] - a[1][0]) * f), Math.round(a[1][1] + (b[1][1] - a[1][1]) * f), Math.round(a[1][2] + (b[1][2] - a[1][2]) * f)]);
    }
    return out;
  }
  function vn2(x, y, s) {                                              // smooth 2-D value noise in [0,1)
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, h = PX.ihash; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h(ix, iy, s), b = h(ix + 1, iy, s), c = h(ix, iy + 1, s), d = h(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm2(x, y, s) { return vn2(x, y, s) * 0.55 + vn2(x * 2.07 + 11.3, y * 2.07 + 4.1, s + 1) * 0.30 + vn2(x * 4.3 + 3.7, y * 4.3 + 17.9, s + 2) * 0.15; }
  function zoneM(al) { return al < 1000 ? al : Math.max(0, al - 1800); }              // metres into the zone (a legacy mode that reaches this scene on a low altitude counter just uses its own metres)
  function zoneF(al) { return clamp01(zoneM(al) / 700); }                              // 0 at 1800 m .. 1 at 2500 m

  // ---------------------------------------------------------------- palette
  var SKY0 = null, SKYF = -1, VBASE = [[8, 34, 48], [14, 54, 72], [22, 90, 112], [34, 144, 170], [76, 200, 220], [176, 244, 248]];
  function skyColors(f) {
    return keyRamp([[0, [3, 3, 22 + 4 * f]], [0.30, [10, 8, 44 + 6 * f]], [0.55, [24, 16, 74 + 8 * f]], [0.78, [52, 30, 104 + 6 * f]], [0.92, [86, 46, 132]], [1, [118, 66, 152]]], SKY_N);
  }
  R.init = function (pal, S) {
    var t0 = performance.now();
    SKYF = -1; SKY0 = skyColors(0.5);
    I.sky = pal.ramp("sky", SKY0);
    I.mw = pal.ramp("mw", H(["#15134f", "#211d6e", "#342b90", "#5646b4", "#8a6cd4", "#c2a6ee", "#f2e2fa"]));
    I.mwc = pal.ramp("mwc", H(["#d8a4d4", "#eebcc4", "#ffdcc8"]));                     // the warm heart of the galaxy
    I.nv = pal.ramp("nv", H(["#241a5a", "#3c2a86", "#5e3ea8", "#8a62c8"]));
    I.nt = pal.ramp("nt", H(["#0c2440", "#123a5c", "#195478", "#2c7c9a"]));
    I.nr = pal.ramp("nr", H(["#40183e", "#6c2860", "#a04080", "#d07aa8"]));
    I.star = pal.ramp("star", H(["#4c5490", "#98a8e4", "#f4f6ff", "#d8b48c", "#fff0cc", "#84d0ea", "#e4ffff", "#e690bc", "#ffe0f0"]));
    I.far = pal.ramp("far", H(["#241e5c", "#2c2670", "#383288", "#4a44a4", "#5a54b4", "#9a8ee0", "#e0d4ff"]));
    I.mid = pal.ramp("mid", H(["#0e0f3a", "#151850", "#1e2468", "#2a3484", "#364498", "#6478cc", "#a8b8f4"]));
    I.clA = pal.ramp("clA", H(["#3a3886", "#4a4698", "#5e58ae", "#7c72c6", "#b0a0e4"]));
    I.clB = pal.ramp("clB", H(["#1c2460", "#26327e", "#344498", "#4c60b4", "#8498dc"]));
    I.sl = pal.ramp("sl", H(["#06051a", "#0c0a26", "#141134", "#1e1a46", "#2a245c", "#3a3278", "#524a98", "#a8b0f4"]));
    I.sb = pal.ramp("sb", H(["#060a1e", "#0c142e", "#141f42", "#1e2e5a", "#2c4276", "#40598e", "#6480b4"]));
    I.sw = pal.ramp("sw", H(["#100818", "#1c0e2a", "#2c183c", "#402450", "#5a3468", "#784a80", "#a06c9c"]));
    I.sll = pal.ramp("sll", H(["#061a26", "#0a2836", "#103a4c", "#175066", "#226a84", "#328aa4", "#54b0c8"]));
    I.slp = pal.ramp("slp", H(["#0c0a2c", "#171238", "#261c50", "#3a2a6c", "#5a44a0"]));
    I.vg0 = pal.ramp("vg0", VBASE); I.vg1 = pal.ramp("vg1", VBASE); I.vg2 = pal.ramp("vg2", VBASE);
    I.cv = pal.ramp("cv", H(["#2a1466", "#4c2a9c", "#7c4cd4", "#b490f2", "#eee0ff"]));
    I.cp = pal.ramp("cp", H(["#4a1052", "#821e8a", "#c444bc", "#f290dc", "#ffe4f6"]));
    I.bn = pal.ramp("bn", H(["#4c4670", "#7c76a0", "#aaa4c8", "#dcd8f0"]));
    I.bz = pal.ramp("bz", H(["#3c2c1c", "#7a5c2c", "#b89040", "#f0cc74"]));
    I.mt = pal.ramp("mt", H(["#161214", "#2a2426", "#443c40", "#665c62"]));
    I.ht = pal.ramp("ht", H(["#d05a24", "#ff9c48", "#ffe8b0"]));
    I.ink = pal.ramp("ink", H(["#04030c"]));
    R.markerIdx = { c0: I.sl + 2, c1: I.sl + 4, c2: I.sl + 6, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };
    R.birdIdx = I.star + 2; R.watcherIdx = I.bn + 2;
    R.footprint = { col: I.sl + 3, hi: I.sl + 6 };
    R.pal = pal;
    LITS = null;
    // (the baked caches hold palette INDICES only and the ramps are allocated in a fixed order, so they stay valid across re-inits with the same size)
    buildScene(S);
    R.initMs = performance.now() - t0;
  };

  R.palette = function (pal, S) {
    var f = Math.round(zoneF(S.altitude) * 8) / 8;
    if (f !== SKYF) { SKYF = f; SKY0 = skyColors(f); pal.setRamp("sky", SKY0); }
    var t = S.reduced ? 0.8 : S.tSec, g;
    for (g = 0; g < 3; g++) {                                            // the cyan veins breathe, each group out of step with the others
      var k = 0.90 + 0.20 * Math.sin(t * 0.85 + g * 2.1);
      pal.setRamp("vg" + g, VBASE.map(function (c, i) { var q = i < 2 ? 0.88 + 0.12 * k : k; return [Math.min(255, c[0] * q), Math.min(255, c[1] * q), Math.min(255, c[2] * q)]; }));
    }
  };

  R.light = function (S) {
    return { x: Math.round(S.w * 0.24), y: Math.round(S.horizonY * 0.20), k: 0.5, col: [178, 198, 255], ambient: [70, 62, 140], bright: 0.85, ground: [46, 40, 90] };
  };

  // ---------------------------------------------------------------- scene caches
  function buildScene(S) {
    var a = S.adj || 1, key = S.w + "x" + S.h + "@" + a + "|" + S.horizonY;
    if (ST.key === key) return; ST.key = key; ST.skyKey = "";
    var w = S.w, h = S.h, i;
    function A(v) { return Math.max(1, Math.round(v * a)); }
    ST.a = a;
    bakeMilkyWay(S);
    bakeStars(S);
    ST.neb = [];                                                         // [ramp, y (of horizon), x (of width), drift, size]
    var spec = [[I.nv, 0.05, 0.62, 0.42, 0.52, 1.0], [I.nt, 0.46, 0.06, 0.36, 0.42, 0.50], [I.nr, 0.26, 0.86, 0.30, 0.32, 0.72]];
    for (i = 0; i < spec.length; i++) {
      var sw = clamp(Math.round(w * spec[i][4]), 100, 280), sh = Math.round(sw * (0.40 + 0.08 * PX.h1(i * 5 + 1)));
      ST.neb.push({ sp: nebula(500 + i * 37, sw, sh, spec[i][0], spec[i][5]), x: spec[i][2] * w, y: spec[i][1], v: spec[i][3] });
    }
    var Hm = clamp(Math.round(h * 0.34), 90, 150), rest = h - S.horizonY;
    ST.far = polishPeaks(Sc.mountainStrip({ L: 1280, H: Math.round(Hm * 0.70), seed: 71, peaks: 17, hMin: 0.4, hMax: 0.95, sharp: 1.26, snow: 0.34, gullies: 4, pal: mtnPal(I.far) }), I.far, I.clA + 2);
    ST.mid = polishPeaks(Sc.mountainStrip({ L: 1152, H: Math.round(Hm * 0.86), seed: 83, peaks: 12, hMin: 0.45, hMax: 1.0, sharp: 1.18, snow: 0.22, gullies: 5, pal: mtnPal(I.mid) }), I.mid, I.clB + 2);
    ST.dA = cloudDeck({ L: 1100, H: A(70) + rest, seed: 11, big: A(20), small: A(6), rise: A(4), base: A(16), cell: A(32), tones: [I.clA, I.clA + 1, I.clA + 2, I.clA + 3, I.clA + 4] });
    ST.dB = cloudDeck({ L: 1000, H: A(60) + rest, seed: 23, big: A(24), small: A(7), rise: A(5), base: A(16), cell: A(38), tones: [I.clB, I.clB + 1, I.clB + 2, I.clB + 3, I.clB + 4] });
    ST.dC = cloudDeck({ L: 900, H: A(40) + rest, seed: 37, big: A(28), small: A(8), rise: A(5), base: A(14), cell: A(44), tones: [I.clB, I.clB, I.clB + 1, I.clB + 2, I.clB + 3] });
    ST.slab = buildSlab(S);
  }
  function mtnPal(b) { return { rockDeep: b, rockS: b + 1, rockM: b + 2, rockL: b + 3, snowS: b + 4, snowL: b + 5, snowH: b + 6, snowD: b + 4 }; }
  // the shared mountain generator stamps a regular dot pattern on its lit faces; take it out, and let the base of each range dissolve into the cloud tone in front of it
  function polishPeaks(st, b, haze) {
    var L = st.w, Hh = st.h, d = st.d, x, y, o, v;
    for (y = 1; y < Hh - 1; y++) for (x = 0; x < L; x++) {
      o = y * L + x; v = d[o]; if (v !== b + 2) continue;
      var l = d[x === 0 ? o + L - 1 : o - 1], r = d[x === L - 1 ? o - L + 1 : o + 1], u = d[o - L], dn = d[o + L];
      if (l === r && l === u && l === dn && l !== 0 && l !== v) d[o] = l;
    }
    for (y = Math.round(Hh * 0.45); y < Hh; y++) {                            // the cloud sea below lights the feet of the peaks: rock climbs one tone, dithered
      var p = Math.pow((y - Hh * 0.45) / (Hh * 0.55), 1.2) * 0.75;
      for (x = 0; x < L; x++) { o = y * L + x; v = d[o]; if (v >= b && v < b + 3 && BP[((y & 3) << 2) | (x & 3)] < p) d[o] = v + 1; }
    }
    for (y = 1; y < Hh - 1; y++) for (x = 0; x < L - 1; x++) {                 // facet edges facing the light catch a highlight: the last lit column before a much darker face
      o = y * L + x; v = d[o]; var r2 = d[o + 1]; if (v < b + 1 || v > b + 3 || r2 < b || r2 > b + 3) continue;
      if (v - r2 >= 2 && d[o - 1] === v) d[o] = Math.min(b + 3, v + 1);
    }
    return st;
  }
  // ---------------------------------------------------------------- sky: bands (baked per size / horizon)
  function bakeSky(S, hy) {
    var w = S.w, h = S.h, key = w + "x" + h + "|" + hy;
    if (ST.skyKey === key && ST.sky) return; ST.skyKey = key;
    var fb = ST.skyFb;
    if (!fb || fb.w !== w || fb.h !== h) fb = ST.skyFb = new PX.Frame(w, h);
    var idx = []; for (var i = 0; i < SKY_N; i++) idx.push(I.sky + i);
    var skyBot = Math.min(h, hy + 30);
    Sc.bands(fb, 0, skyBot, idx, 4);
    if (skyBot < h) fb.fillRect(0, skyBot, w, h - skyBot, I.sky + SKY_N - 1);
    // airglow: a faint teal band hugging the horizon, thin and patchy, dissolving upward through ordered dither
    var a = S.adj || 1, gh = Math.round(34 * a), gy0 = hy - gh + Math.round(6 * a), d = fb.d, x, y;
    for (x = 0; x < w; x++) {
      var top = gy0 + Math.round(3 * a * Math.sin(x * 0.021 + 1.3) + 2 * a * Math.sin(x * 0.057)), pat = 0.65 + 0.7 * fbm2(x * 0.03, 5.5, 71);
      for (y = Math.max(0, top); y <= Math.min(h - 1, hy + 6); y++) {
        var f = (y - top) / Math.max(1, hy + 6 - top), dens = Math.pow(f, 1.25) * pat, lv = Math.floor(dens * 3.3 + (BP[((y & 3) << 2) | (x & 3)] - 0.5) * 0.95);
        if (lv >= 1) d[y * w + x] = I.nt + Math.min(2, lv - 1);
      }
    }
    ST.sky = fb.d;
  }

  // ---------------------------------------------------------------- the milky way: a diagonal river of banded, dithered light, with patchy dust lanes
  function bakeMilkyWay(S) {
    var w = S.w, hy = S.horizonY, CW = w + 2 * M, CH = hy + 30 + 2 * M, d = new Uint8Array(CW * CH), Bf = new Uint8Array(CW * CH), x, y, port = w < hy * 1.1;
    var ax = (port ? 0.10 : 0.10) * w, ay = -0.10 * hy, bx = (port ? 0.98 : 0.76) * w, by = (port ? 0.66 : 0.80) * hy;
    var ux = bx - ax, uy = by - ay, len = Math.sqrt(ux * ux + uy * uy); ux /= len; uy /= len;
    var W0 = clamp(0.14 * hy + 0.035 * w, 26, 66), sCore = 0.24 * len;
    for (y = 0; y < CH; y++) for (x = 0; x < CW; x++) {
      var sx = x - M, sy = y - M, rx = sx - ax, ry = sy - ay, s = rx * ux + ry * uy, n = -rx * uy + ry * ux;
      var meander = (fbm2(s * 0.010, 4.2, 17) - 0.5) * 0.9 + 0.16 * Math.sin(s * 0.018 + 1.3);
      var Wd = W0 * (0.82 + 0.5 * vn2(s * 0.0075, 2.2, 5)) * (0.7 + 0.3 * Math.min(1, s / (0.25 * len))) * (1 - 0.35 * clamp01((s - 0.7 * len) / (0.5 * len)));
      var nn = n - meander * Wd;
      var prof = Math.exp(-Math.pow(nn / Wd, 2) * 1.05);
      var nz = fbm2(sx * 0.020, sy * 0.029, 7);
      var B = prof * (0.42 + 1.3 * (nz - 0.26));
      var dust = clamp01((fbm2(sx * 0.034 + 20, sy * 0.048, 21) - 0.50) * 4.2);            // patchy dark clouds inside the band
      var rift = Math.exp(-Math.pow((nn - 0.26 * Wd - 0.18 * Wd * Math.sin(s * 0.03 + 0.6)) / (0.085 * Wd), 2)) * clamp01((fbm2(s * 0.02, 8.5, 33) - 0.36) * 3.4);
      B *= 1 - 0.88 * Math.max(dust * Math.sqrt(prof), rift);
      var cs = (s - sCore) / (0.18 * len), cn = nn / (0.7 * Wd); B += 0.42 * Math.exp(-(cs * cs + cn * cn)) * (0.75 + 0.5 * nz);
      B = Math.max(0, B);
      Bf[y * CW + x] = Math.min(255, Math.round(B * 200));
      var lv = Math.floor(Math.pow(B, 0.92) * 7.0 + (BP[((y & 3) << 2) | (x & 3)] - 0.5) * 0.95);
      if (lv >= 1) {
        var ti = Math.min(6, lv - 1), warm = B - 0.98 + 0.22 * (nz - 0.5);                        // the core turns warm: cream and rose in dithered steps
        var iv;
        if (ti >= 5 && warm > -0.05) {
          var wl = Math.floor(warm * 11 + 0.9 + (BP[((y & 3) << 2) | (x & 3)] - 0.5) * 1.6);                 // ordered dither between lavender, rose, cream
          iv = wl <= 0 ? I.mw + 5 : wl === 1 ? I.mwc : wl === 2 ? I.mwc + 1 : I.mwc + 2;
        } else iv = I.mw + Math.min(5, ti);
        d[y * CW + x] = iv;
      }
    }
    // a far spiral galaxy: a tilted, banded ellipse with a hot core, a dust lane and a small companion
    var ga = clamp(0.09 * w, 22, 46), gb = ga * 0.30, gx = M + (port ? 0.64 : 0.58) * w, gy = M + (port ? 0.15 : 0.20) * hy, gca = Math.cos(-0.33), gsa = Math.sin(-0.33);
    for (y = Math.floor(gy - ga - 6); y <= Math.ceil(gy + ga + 6); y++) for (x = Math.floor(gx - ga - 6); x <= Math.ceil(gx + ga + 6); x++) {
      if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
      var ddx = x - gx, ddy = y - gy, gu = ddx * gca + ddy * gsa, gv = -ddx * gsa + ddy * gca, gr = Math.sqrt((gu / ga) * (gu / ga) + (gv / gb) * (gv / gb)); if (gr > 1.5) continue;
      var gI = Math.exp(-gr * 2.5) * 0.9 + 1.15 * Math.exp(-Math.pow(gr * 4.4, 2));
      gI *= 1 - 0.78 * Math.exp(-Math.pow((gv / gb - 0.46) / 0.11, 2)) * (gr > 0.30 && gr < 1.05 ? 1 : 0);
      gI *= 0.86 + 0.3 * fbm2(x * 0.11, y * 0.2, 61);
      var glv = Math.floor(gI * 5.4 + (BP[((y & 3) << 2) | (x & 3)] - 0.5) * 0.9);
      if (glv >= 1) d[y * CW + x] = I.mw + Math.min(gI > 0.95 ? 6 : 5, glv - 1);
    }
    var cu = gx + ga * 0.62 * gca - (-gb * 1.7) * gsa, cv2 = gy + ga * 0.62 * gsa + (-gb * 1.7) * gca;
    for (y = -3; y <= 3; y++) for (x = -4; x <= 4; x++) { var cr = Math.sqrt((x / 4) * (x / 4) + (y / 2.6) * (y / 2.6)); if (cr > 1) continue; var cl = Math.floor((1 - cr) * 4.4 + (BP[(((Math.round(cv2) + y) & 3) << 2) | ((Math.round(cu) + x) & 3)] - 0.5) * 0.9); if (cl >= 1) { var ci = (Math.round(cv2) + y) * CW + Math.round(cu) + x; if (ci >= 0 && ci < d.length) d[ci] = I.mw + Math.min(5, cl + 1); } }
    ST.mw = d; ST.mwB = Bf; ST.mwW = CW; ST.mwH = CH;
  }

  // ---------------------------------------------------------------- stars: four sizes, four tints (positions baked, drawn live so they can twinkle)
  function bakeStars(S) {
    var CW = ST.mwW, CH = ST.mwH, Bf = ST.mwB, hy = S.horizonY, a = S.adj || 1, X = [], Y = [], T = [], TT = [], TN = [], ow = Math.ceil(CW / 5), occ = new Uint8Array(ow * Math.ceil(CH / 5));
    for (var y = 0; y < CH; y++) for (var x = 0; x < CW; x++) {
      var sy = y - M; if (sy < 0 || sy > hy + 8) continue;
      var hv = PX.ihash(x, y, 4711), b = Bf[y * CW + x] / 200, fade = sy > hy * 0.62 ? Math.max(0.22, 1 - (sy - hy * 0.62) / (hy * 0.52)) : 1;
      var dens = fade * (0.6 + 1.5 * b) * a * a;
      var p3 = 0.00007 * dens, p2 = p3 + 0.0007 * dens, p1 = p2 + 0.0038 * dens, p0 = p1 + 0.0105 * dens, tier;
      if (hv >= p0) continue;
      tier = hv < p3 ? 3 : hv < p2 ? 2 : hv < p1 ? 1 : 0;
      if (tier > 0) { var oc = (y / 5 | 0) * ow + (x / 5 | 0); if (occ[oc]) continue; occ[oc] = 1; }
      var tv = PX.ihash(x, y, 9), tint = tv < 0.56 ? 0 : tv < 0.70 ? 1 : tv < 0.86 ? 2 : 3, tn = tier === 0 ? (PX.ihash(x, y, 13) < 0.72 ? 0 : 1) : tier === 1 ? (PX.ihash(x, y, 13) < 0.7 ? 1 : 2) : 2;
      if (b > 0.5 && tn < 2) tn++;
      X.push(x); Y.push(y); T.push(tier); TT.push(tint); TN.push(Math.min(2, tn));
    }
    ST.ns = X.length; ST.sx = Int16Array.from(X); ST.sy = Int16Array.from(Y); ST.stier = Uint8Array.from(T); ST.stt = Uint8Array.from(TT); ST.stn = Uint8Array.from(TN);
  }
  function sidx(tint, tn) { return tint === 0 ? I.star + tn : I.star + 3 + (tint - 1) * 2 + (tn >= 2 ? 1 : 0); }
  function drawStars(fb, S, ox, oy, skyBot, t) {
    var n = ST.ns, X = ST.sx, Y = ST.sy, T = ST.stier, TT = ST.stt, TN = ST.stn, w = fb.w, d = fb.d, a = S.adj || 1, tick = S.reduced ? -1 : Math.floor(t * 2.3), i, o;
    for (i = 0; i < n; i++) {
      var x = X[i] + ox, y = Y[i] + oy; if (x < 0 || x >= w || y < 0 || y >= skyBot) continue;
      var tier = T[i], tn = TN[i], tint = TT[i];
      if (tick >= 0 && (tier > 0 || (i & 3) === 0)) { var hh = PX.h2(i * 7 + 3, tick + (i % 5)); if (hh < 0.07 + 0.05 * tier) tn = Math.max(0, tn - 1); else if (hh > 0.965 && tier === 0) tn = Math.min(2, tn + 1); }
      o = y * w + x; d[o] = sidx(tint, tn);
      if (tier >= 2 && x > 6 * a && x < w - 7 * a && y > 6 * a && y < skyBot - 7 * a) {
        var arm = sidx(tint, tn > 0 ? 1 : 0); if (tier === 2 || tn === 0) { d[o - 1] = arm; d[o + 1] = arm; d[o - w] = arm; d[o + w] = arm; }
        else {
          var len = Math.max(2, Math.round((3 + (i % 3)) * a)), q;
          var c0 = sidx(tint, 0), c1 = sidx(tint, 1);
          for (q = 1; q <= len; q++) { var cq = q > len * 0.6 ? c0 : c1; d[o - q] = cq; d[o + q] = cq; d[o - q * w] = cq; d[o + q * w] = cq; }
          d[o - w - 1] = c1; d[o - w + 1] = c1; d[o + w - 1] = c1; d[o + w + 1] = c1;
        }
      }
    }
  }

  // a shooting star: a bright head and a dithered tail that thins out behind it
  function drawMeteor(fb, S, skyBot, t) {
    if (S.reduced) return;
    var per = 7.4, k = Math.floor(t / per), at = t - k * per, dur = 0.85; if (at > dur || PX.h1(k * 3 + 1) < 0.32) return;
    var w = fb.w, d = fb.d, a = S.adj || 1, dir = PX.h1(k * 3 + 4) < 0.5 ? -1 : 1, x0 = (0.16 + 0.68 * PX.h1(k * 3 + 2)) * w, y0 = (0.05 + 0.30 * PX.h1(k * 3 + 3)) * skyBot;
    var u = at / dur, sp = 210 * a, ang = 0.34 + 0.2 * PX.h1(k * 5 + 7), vx = dir * Math.cos(ang), vy = Math.sin(ang);
    var hx = x0 + vx * sp * at, hy = y0 + vy * sp * at, len = Math.round((16 + 24 * Math.sin(Math.min(1, u) * Math.PI)) * a), j;
    for (j = 0; j < len; j++) {
      var x = Math.round(hx - vx * j), y = Math.round(hy - vy * j); if (x < 0 || x >= w || y < 0 || y >= skyBot) continue;
      var al = 1 - j / len; if (j > 1 && BP[((y & 3) << 2) | (x & 3)] > al * 1.15) continue;
      d[y * w + x] = j < 2 ? I.star + 2 : al > 0.5 ? I.star + 6 : I.star + 5;
      if (j < 3 && y + 1 < skyBot) d[(y + 1) * w + x] = I.star + 1;
    }
  }

  // ---------------------------------------------------------------- nebulae: warped blobs, posterised, dithered at the edges, faded to nothing at the sprite border
  function nebula(seed, w, h, base, gain) {          // note: sprite x positions are its LEFT edge at t = 0
    var sp = new PX.Sprite(w, h), rnd = PX.rng(seed), n = 5 + Math.floor(rnd() * 3), bl = [], i, x, y, ex0 = Math.max(8, Math.min(w, h * 2) * 0.30);
    for (i = 0; i < n; i++) { var t = (i + 0.5) / n; bl.push({ x: w * (0.14 + 0.72 * t), y: h * (0.5 + 0.18 * Math.sin(t * 3.4 + seed)), rx: w * (0.12 + 0.09 * rnd()), ry: h * (0.22 + 0.18 * rnd()), amp: 0.6 + 0.5 * rnd() }); }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var wx = x + (fbm2(x * 0.045, y * 0.06, seed) - 0.5) * w * 0.20, wy = y + (fbm2(x * 0.05 + 9, y * 0.07 + 3, seed + 5) - 0.5) * h * 0.62, f = 0;
      for (i = 0; i < n; i++) { var ex = (wx - bl[i].x) / bl[i].rx, ey = (wy - bl[i].y) / bl[i].ry; f += bl[i].amp * Math.exp(-(ex * ex + ey * ey) * 1.35); }
      var rg = 1 - Math.abs(2 * fbm2(x * 0.075 + 40, y * 0.09 + 17, seed + 21) - 1);                  // filaments: ridged noise
      f *= (0.45 + 1.0 * rg * rg + 0.35 * (fbm2(x * 0.10, y * 0.12, seed + 9) - 0.42)) * gain;
      f *= sm(Math.min(x, w - 1 - x, (y) * 2, (h - 1 - y) * 2) / ex0);
      var lv = Math.floor(f * 3.3 + (BP[((y & 3) << 2) | (x & 3)] - 0.5) * 0.95);
      if (lv >= 1) sp.d[y * w + x] = base + Math.min(3, lv - 1);
    }
    return sp;
  }

  // ---------------------------------------------------------------- a sea of cloud tops (tileable): lumpy crest of overlapping swells; the body is lit like a relief (bulges catch the light on their upper-left)
  var LAT = null;
  function ensureLAT() { if (!LAT) { LAT = new Float32Array(65536); var lr = PX.rng(31337); for (var q0 = 0; q0 < 65536; q0++) LAT[q0] = lr(); } }
  function lat(ix, iy) { return LAT[((iy & 255) << 8) | (ix & 255)]; }
  function vnP(x, y, P) {                                                  // value noise from a 256x256 lattice, periodic in x with period P (cells)
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var x0 = ((ix % P) + P) % P, x1 = (x0 + 1) % P, a = lat(x0, iy), b = lat(x1, iy), c = lat(x0, iy + 1), d = lat(x1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function pnoise(qx, dd, L) {                                              // smooth noise that tiles seamlessly along the slab (period L); features ~60 px wide, ~40 px tall
    return vnP(qx * 24 / L, dd * 0.024, 24) * 0.55 + vnP(qx * 48 / L + 7.3, dd * 0.048 + 3.1, 48) * 0.30 + vnP(qx * 96 / L + 1.9, dd * 0.096 + 8.7, 96) * 0.15;
  }
  function poolGrid(L, D) {                                                // the glow-pool noise sampled every 4 px (it tiles along x): the slab bake then just interpolates it
    var nx = L >> 2, ny = (D >> 2) + 3, g = new Float32Array(nx * ny), gx, gy;
    for (gy = 0; gy < ny; gy++) for (gx = 0; gx < nx; gx++) g[gy * nx + gx] = pnoise(gx * 4, gy * 4, L);
    return { g: g, nx: nx, ny: ny };
  }
  function cloudDeck(o) {
    ensureLAT();
    var L = o.L, Hh = o.H, st = Sc.newStrip(L, Hh), rnd = PX.rng(o.seed), wob = Sc.periodic(L, o.seed * 7 + 1), T = o.tones, x, y, i, base = o.base, arcs = [];   // tones: [under, shade, mid, lit, rim]
    var topBig = new Float32Array(L).fill(1e9), top = new Int16Array(L).fill(Hh);
    x = 0;
    while (x < L) { var r = o.big * (0.6 + 0.9 * rnd()), cy = base + o.rise * wob(x) + r * 0.62; arcs.push({ x: x + r * 0.5, cy: cy, r: r, ry: r * (0.55 + 0.3 * rnd()) }); x += r * (0.8 + 0.8 * rnd()); }
    function add(A, tgt) { for (var k = -1; k <= 1; k++) for (var xx = Math.max(0, Math.floor(A.x + k * L - A.r)); xx <= Math.min(L - 1, Math.ceil(A.x + k * L + A.r)); xx++) { var ex = (xx + 0.5 - A.x - k * L) / A.r; if (ex * ex >= 1) continue; var ty = A.cy - A.ry * Math.sqrt(1 - ex * ex); if (ty < tgt[xx]) tgt[xx] = ty; } }
    for (i = 0; i < arcs.length; i++) add(arcs[i], topBig);
    x = 0;
    while (x < L) { var r2 = o.small * (0.5 + 1.0 * rnd()), tx = Math.min(L - 1, Math.round(x + r2 * 0.5)); arcs.push({ x: x + r2 * 0.5, cy: topBig[tx] + r2 * 0.34, r: r2, ry: r2 * 0.8 }); x += r2 * (0.7 + 0.8 * rnd()); }
    var tf = new Float32Array(L).fill(1e9); for (i = 0; i < arcs.length; i++) add(arcs[i], tf);
    for (x = 0; x < L; x++) top[x] = Math.floor(tf[x]);
    var n1 = Math.round(L / o.cell), n2 = n1 * 2, n3 = n1 * 4, ky = 2.8;                     // relief field: broad lumps, then medium, then fine; much wider than tall
    var F = new Float32Array(L * Hh);
    for (y = 0; y < Hh; y++) for (x = 0; x < L; x++) F[y * L + x] = vnP(x * n1 / L, y * n1 / L * ky, n1) * 0.55 + vnP(x * n2 / L + 7.3, y * n2 / L * ky + 3.1, n2) * 0.30 + vnP(x * n3 / L + 1.9, y * n3 / L * ky + 8.7, n3) * 0.15;
    for (x = 0; x < L; x++) {
      var facing = clamp((top[(x - 3 + L) % L] - top[(x + 3) % L]) / 3.5, -1.2, 1.2);
      for (y = Math.max(0, top[x]); y < Hh; y++) {
        var depth = y - top[x], b = BP[((y & 3) << 2) | (x & 3)], e = depth - Math.round(facing * 1.6), c;
        var em = (F[y * L + x] - F[Math.min(Hh - 1, y + 3) * L + (x + 1) % L]) * 13 + (F[y * L + x] - 0.5) * 1.1;   // >0: this lump faces the light (from above, a little from the left)
        var tone = 2.5 - Math.min(1.6, Math.max(0, e - 3) / 34) + em * (e < 3 ? 0.5 : 1) * (1 - Math.min(0.5, Math.max(0, e - 40) / 90));
        var ti = Math.floor(tone + (b - 0.5) * 0.8);
        if (e <= 0) c = facing > -0.5 ? T[4] : T[3];
        else if (e <= 1 && facing > 0.2) c = T[3];
        else c = T[clamp(ti, 0, 3)];
        st.d[y * L + x] = c;
      }
    }
    st.crest = base;
    return st;
  }
  // ---------------------------------------------------------------- the ground: a baked, world-locked cross-section (column-major slab)
  var LITS = null;
  function litMaps() {                                                     // slate tone -> the same tone in a tinted twin ramp (light spilling from veins / crystals)
    LITS = { teal: new Uint8Array(256), pur: new Uint8Array(256) };
    for (var v = 0; v < 256; v++) { LITS.teal[v] = v; LITS.pur[v] = v; }
    var fams = [I.sl, I.sb, I.sw];
    for (var f = 0; f < 3; f++) for (var q = 0; q < 7; q++) { LITS.teal[fams[f] + q] = I.sll + q; LITS.pur[fams[f] + q] = I.slp + Math.min(4, q); }
    LITS.teal[I.sl + 7] = I.sll + 6; LITS.pur[I.sl + 7] = I.slp + 4;
  }
  function buildSlab(S) {
    var a = S.adj || 1, L = 1536, D = clamp(S.h + 130, 330, 700), d = new Uint8Array(L * D), rnd = PX.rng(20260929), beds = [], cum, nb, qx, dd, k, i;
    if (!LITS) litMaps(); ensureLAT();
    function A(v) { return Math.max(1, Math.round(v * a)); }
    var NF = Math.max(2, Math.round(L / A(340))), WF = L / NF;
    var crust = A(8); cum = crust; nb = 0;
    while (cum < D + 70 && nb < 70) {
      var kr = rnd(), kind = kr < 0.34 ? 0 : kr < 0.62 ? 1 : kr < 0.84 ? 2 : 3, th = A(9 + Math.floor(rnd() * 24)), fr = rnd(), fam = fr < 0.60 ? I.sl : fr < 0.84 ? I.sb : I.sw;
      beds.push({ t: th, kind: kind, fam: fam, tone: rnd(), n1: 2 + Math.floor(rnd() * 5), n2: 8 + Math.floor(rnd() * 10), p1: rnd() * TAU, p2: rnd() * TAU, a1: A(1 + rnd() * 3.2), a2: 0.5 + rnd() * 1.5, bw: A(16 + rnd() * 44), sh: Math.floor(rnd() * 200) });
      cum += th; nb++;
    }
    var PG = poolGrid(L, D), PGg = PG.g, PGn = PG.nx;
    var ed = new Int16Array(nb + 2), SL = I.sl, deepD = A(80), crustE = new Int16Array(L), FLT = [], fr2 = PX.rng(555), fi, PL = TAU / L, aF1 = A(15), aF2 = A(7), a40 = A(40), a160 = A(160), a70 = A(70), a200 = A(200), a26 = A(26), a240 = A(240), HL = L * 0.5;
    var S45 = new Float32Array(D + 400); for (i = 0; i < S45.length; i++) S45[i] = 26 * Math.sin((i - 200) * 0.045);
    var fu0c = new Float32Array(4), FSl = new Float32Array(4), FOf = new Float32Array(4), ck = -1, cfr = -1, cKind = 0, cF = 0, cToneAdd = 0, cOre = false;
    for (i = 0; i < 4; i++) FLT.push({ x: Math.floor(fr2() * L), s: (fr2() < 0.5 ? -1 : 1) * (0.35 + 0.5 * fr2()), o: (fr2() < 0.5 ? -1 : 1) * A(4 + fr2() * 9) });     // faults: slanted planes that shift the strata on one side
    for (i = 0; i < 4; i++) { FSl[i] = FLT[i].s; FOf[i] = FLT[i].o; }
    var FJ = new Float32Array(D + 400); for (i = 0; i < FJ.length; i++) FJ[i] = A(2.4) * Math.sin(i * 0.037 + 2.1) + A(1.5) * Math.sin(i * 0.11 + 0.7) + A(0.9) * Math.sin(i * 0.29 + 3.3);    // faults meander a little: no ruled lines
    for (qx = 0; qx < L; qx++) {
      var col = qx * D, jag = PX.h2(qx >> 2, 5) - 0.5, e0 = crust + Math.round(1.5 * Math.sin(qx * TAU * 5 / L) + 2.2 * jag);
      crustE[qx] = e0; ed[0] = e0;
      for (k = 0; k < nb; k++) { var bd = beds[k]; ed[k + 1] = ed[k] + Math.max(3, bd.t + Math.round(bd.a1 * Math.sin(qx * TAU * bd.n1 / L + bd.p1) + bd.a2 * Math.sin(qx * TAU * bd.n2 / L + bd.p2))); }
      k = 0; ck = -1; cfr = -1;
      var pxi = qx >> 2, pxi1 = pxi + 1 >= PGn ? 0 : pxi + 1, ptx = (qx & 3) * 0.25;
      var sf1 = aF1 * Math.sin(qx * PL + 0.7), sf2 = aF2 * Math.sin(qx * PL * 3 + 2.2), sfu = 70 * Math.sin(qx * PL * 3);
      for (fi = 0; fi < FLT.length; fi++) { var fw = qx - FLT[fi].x; fu0c[fi] = ((fw + L * 1.5) % L) - HL; }
      for (dd = 0; dd < D; dd++) {
        var bay = BP[((dd & 3) << 2) | (qx & 3)] - 0.5, idx, gl = dd > deepD ? sm((dd - deepD) / a240) : 0;
        if (dd < e0) {                                                       // starlit regolith crust: bright rim, then a dithered fall-off into the strata
          var tc = dd / e0;
          if (dd === 0) idx = SL + 7; else if (dd === 1) idx = SL + 6;
          else idx = SL + clamp(Math.floor(5.6 - 2.6 * tc + bay * 1.1 + (PX.h2(qx, dd + 40) > 0.95 ? 1 : 0)), 3, 6);
        } else {
          var fld = sf1 * clamp01((dd - a40) / a160) + sf2 * clamp01((dd - a70) / a200), foff = 0, onF = 0, fhit = 0;
          if (dd > a26) for (fi = 0; fi < 4; fi++) { var fu0 = fu0c[fi] - FSl[fi] * dd + FJ[dd + fi * 37]; if (fu0 < -HL) fu0 += L; else if (fu0 >= HL) fu0 -= L; if (fu0 > 0) foff += FOf[fi]; if (fu0 > -0.6 && fu0 < 0.6) { onF = 1; fhit = fi; } else if (fu0 >= 0.6 && fu0 < 1.6 && !onF) onF = 2; }
          var dp = dd - fld - foff;
          while (k > 0 && dp < ed[k]) k--; while (k < nb - 1 && dp >= ed[k + 1]) k++;
          var bd2 = beds[k], ib = Math.max(0, dp - ed[k]), bh = ed[k + 1] - ed[k], fu = (qx + 0.4 * dp + sfu + S45[(dp + 200.5) | 0]) / WF, fR = Math.floor(fu), ff = fu - fR;   // facies: the character of a bed changes sideways along steep seams
          if (ff > 0.74 && BP[((dd & 3) << 2) | (qx & 3)] < (ff - 0.74) / 0.26) fR++;
          fR = ((fR % NF) + NF) % NF;
          if (k !== ck || fR !== cfr) {                                                                            // per (bed, facies) constants, recomputed only when they change
            ck = k; cfr = fR;
            var fk = PX.h2(k * 5 + 1, fR * 7 + 3), fF = PX.h2(k * 3 + 2, fR * 11 + 5);
            cKind = fk < 0.30 ? 0 : fk < 0.58 ? 1 : fk < 0.82 ? 2 : 3; if (k < 2 && cKind === 0) cKind = 1;      // no brick courses right under the crust
            cF = fF < 0.58 ? I.sl : fF < 0.84 ? I.sb : I.sw;
            cToneAdd = (bd2.tone - 0.5) * 1.5 + (PX.h2(k * 7 + 3, fR * 13 + 1) - 0.5) * 0.5;
            cOre = PX.h2(k * 3 + 1, fR * 5 + 9) < 0.16;
          }
          var kindV = cKind, F = cF, tone = 5.4 - dd * 0.0095 + cToneAdd, tn;
          if (ib === 0) {
            tn = clamp(Math.floor(tone + 1.3 + bay * 0.5), 2, 6); idx = F + tn; if (gl > 0 && PX.h2(qx >> 1, k + 300) < gl * 0.9) idx = I.vg2 + clamp(Math.floor(0.8 + gl * 3.2), 0, 4);
            if (cOre && PX.h2(qx >> 2, k) < 0.86) { var oreK = (k + fR) % 3; idx = oreK === 0 ? I.vg0 + 3 : oreK === 1 ? I.cv + 3 : I.cp + 2; }             // an ore seam: a glittering line of crystal along the bedding
          }
          else if (ib === bh - 1) idx = F + clamp(Math.floor(tone - 2.2), 0, 3);
          else if (kindV === 0) {                                          // jointed blocks
            var jx = qx + bd2.sh * 7 + k * 13, blk = Math.floor(jx / bd2.bw), fx = jx - blk * bd2.bw, bt = PX.h2(blk, k + 90);
            if (fx === 0) idx = F + clamp(Math.floor(tone - 2.6), 0, 2);
            else if (fx === 1 && ib < bh * 0.7) idx = F + clamp(Math.floor(tone + 0.6), 1, 5);
            else idx = F + clamp(Math.floor(tone + (bt - 0.5) * 1.7 - (ib / bh) * 0.9 + bay * 0.85), 0, 5);
          } else if (kindV === 1) {                                        // laminated shale
            idx = F + clamp(Math.floor(tone + ((ib & 1) ? 0.5 : -0.6) + bay * 0.5 - (ib / bh) * 0.6), 0, 5);
            if (ib > 1 && (ib % 5 === 0)) idx = F + clamp(Math.floor(tone - 1.6), 0, 3);
          } else if (kindV === 2) {                                        // sandstone with a few glittering grains
            idx = F + clamp(Math.floor(tone - 0.2 + bay * 1.15 - (ib / bh) * 0.7), 0, 5);
            var fh = PX.h2(qx * 3 + k, dd + 200); if (fh > 0.9935) idx = I.vg0 + 4; else if (fh > 0.982) idx = F + Math.min(6, 5);
          } else idx = F + clamp(Math.floor(tone - 1.0 + bay * 0.8 - (ib / bh) * 0.5), 0, 4);          // dark massive bed
          if (gl > 0.05) {                                                    // glow pooling in the deep: the strata turn teal-lit in dithered patches, with a few hot cores
            var pyi = (dd >> 2) * PGn, pty = (dd & 3) * 0.25, pa = PGg[pyi + pxi], pb = PGg[pyi + pxi1], pc = PGg[pyi + PGn + pxi], pd = PGg[pyi + PGn + pxi1], pv = (pa + (pb - pa) * ptx + (pc - pa) * pty + (pa - pb - pc + pd) * ptx * pty) * gl;
            if (pv > 0.24 && BP[((dd & 3) << 2) | (qx & 3)] < clamp01((pv - 0.24) * 5)) idx = LITS.teal[idx];
            if (pv > 0.40) { var lvg = Math.floor((pv - 0.40) * 9 + bay * 1.2); if (lvg >= 0) idx = I.vg1 + Math.min(3, lvg); }
          }
          if (onF === 1) { idx = (gl > 0.12 && PX.h2(dd >> 3, fhit + 1900) < gl * 1.25) ? I.vg1 + 3 : F; }                       // the fault plane: a dark seam, glowing in the deep
          else if (onF === 2 && idx >= F && idx < F + 7) idx = F + Math.min(6, idx - F + 2);                                   // its lit lip
        }
        d[col + dd] = idx;
      }
    }
    function put(x, y, c) { x = ((x % L) + L) % L; if (y < 0 || y >= D) return; d[x * D + y] = c; }
    function lift(x, y, R, strength) {                                     // veins light the rock around them: slate -> teal-lit slate, dithered by distance
      for (var yy = -R; yy <= R; yy++) for (var xx = -R; xx <= R; xx++) {
        var q = 1 - Math.sqrt(xx * xx + yy * yy) / (R + 0.6); if (q <= 0) continue;
        var px = (((x + xx) % L) + L) % L, py = y + yy; if (py < 0 || py >= D) continue;
        if (BP[((py & 3) << 2) | (px & 3)] < strength * q) { var o = px * D + py, v = LITS.teal[d[o]]; d[o] = v; }
      }
    }
    // pods: lens-shaped concretions in another colour, banded like a cut onion, lit on top
    var pr = PX.rng(31415);
    for (i = 0; i < 16; i++) {
      var pcx = Math.floor(pr() * L), pcy = A(30) + Math.floor(pr() * (D - A(80))), prx = A(22 + pr() * 46), pry = A(6 + pr() * 9), pf = pr() < 0.5 ? I.sb : (pr() < 0.5 ? I.sw : I.sl);
      for (var py0 = -pry - 1; py0 <= pry + 1; py0++) for (var px0 = -prx - 1; px0 <= prx + 1; px0++) {
        var pe = (px0 * px0) / (prx * prx) + (py0 * py0) / (pry * pry); if (pe > 1) continue;
        var pyy = pcy + py0; if (pyy < crustE[(((pcx + px0) % L) + L) % L] + 4) continue;
        var band = Math.floor(pe * 4.4), plit = -(py0 / pry) * 0.8 - (px0 / prx) * 0.3, ptone = clamp(Math.floor(3.9 + plit * 1.6 - band * 0.35 + (BP[((pyy & 3) << 2) | ((pcx + px0) & 3)] - 0.5) * 0.7), 1, 6);
        if (pe > 0.86) ptone = plit > 0.1 ? 6 : 0;
        put(pcx + px0, pyy, pf + ptone);
      }
    }
    // cracks: dark hairlines cutting the beds at a slant, with a lit lower edge
    var cr = PX.rng(4242);
    for (i = 0; i < 44; i++) {
      var cx = Math.floor(cr() * L), cy = A(16) + Math.floor(cr() * (D - A(60))), cl = A(20 + cr() * 60), sl = (cr() < 0.5 ? -1 : 1) * (0.5 + cr() * 1.3);
      for (k = 0; k < cl; k++) { var px = cx + k, py = Math.round(cy + k * sl * 0.5 + (PX.h2(i, k + 900) - 0.5) * 1.6); if (py < crustE[((px % L) + L) % L] + 2) continue; put(px, py, SL); put(px, py + 1, SL + 3 + (PX.h2(px, py) > 0.6 ? 1 : 0)); }
    }
    // veins: meandering cyan threads (core, glow, embossed dark edge, a halo of lit rock), each in one of three pulse groups
    var vr = PX.rng(777);
    for (i = 0; i < 62; i++) {
      var vgs = [I.vg0, I.vg1, I.vg2][i % 3], vx = vr() * L, vy = A(30) + vr() * (D - A(60)), vl = A(50 + vr() * 130), ang = (vr() < 0.5 ? 0.55 : 2.55) + (vr() - 0.5) * 0.7, len0 = vl, pts = [];
      for (k = 0; k < vl; k++) {
        ang += (PX.h2(i, k + 1300) - 0.5) * 0.55; ang = clamp(ang, 0.2, 2.94); vx += Math.cos(ang); vy += Math.sin(ang);
        var ix = Math.round(vx), iy = Math.round(vy), ends = Math.min(k, len0 - k) / (len0 * 0.18), ct = ends < 1 ? 2 : 4 + (PX.h2(ix, iy) > 0.8 ? 1 : 0);
        if (iy < crustE[((ix % L) + L) % L] + 3 || iy >= D - 2) continue;
        if (k % 4 === 0) lift(ix, iy, 4, 0.9);
        pts.push(ix, iy, ct, ends < 1 ? 0 : 2, iy > A(170) ? 1 : 0);
      }
      for (k = 0; k < pts.length; k += 5) { put(pts[k] - 1, pts[k + 1], SL); put(pts[k], pts[k + 1], vgs + pts[k + 2]); put(pts[k] + 1, pts[k + 1], vgs + pts[k + 3]); if (pts[k + 4]) { put(pts[k] + 1, pts[k + 1], vgs + pts[k + 2] - 1); put(pts[k] + 2, pts[k + 1], vgs + 1); } if (pts[k + 2] > 2 && (k % 25) === 0) put(pts[k], pts[k + 1] - 1, vgs + 2); }
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
  function halo(fb, cx, cy, Rx, Ry, strength, map) {            // lifts the surrounding rock toward a tinted twin ramp, dithered by distance
    if (fb.rec) { fb.halos.push([cx, cy, Rx, Ry, strength, map]); return; }
    var w = fb.w, h = fb.h, d = fb.d, x, y, x0 = Math.max(0, cx - Rx), x1 = Math.min(w - 1, cx + Rx), y0 = Math.max(0, cy - Ry), y1 = Math.min(h - 1, cy + Ry);
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      var dx = (x - cx) / Rx, dy = (y - cy) / Ry, q = 1 - Math.sqrt(dx * dx + dy * dy); if (q <= 0) continue;
      if (BP[((y & 3) << 2) | (x & 3)] < strength * Math.pow(q, 1.25)) { var o = y * w + x, v = map[d[o]]; if (v !== d[o]) d[o] = v; }
    }
  }
  function stoneBlob(fb, cx, cy, r, glowLow) {                              // an embedded stone: lit top-left, dark rim on the shaded side, a glint
    var rw = r * 1.3, SL = I.sl, x, y;
    for (y = -Math.ceil(r); y <= Math.ceil(r); y++) for (x = -Math.ceil(rw); x <= Math.ceil(rw); x++) {
      var ex = x / 1.3, d2 = ex * ex + y * y; if (d2 > r * r) continue;
      var lit = (-(ex * 0.7 + y * 0.7)) / r, bay = BP[(((cy + y) & 3) << 2) | ((cx + x) & 3)] - 0.5, tone = Math.floor(3.6 + lit * 3.0 + bay * 0.9);
      tone = clamp(tone, 2, 6);
      if (d2 > (r - 1.1) * (r - 1.1)) tone = lit > 0.15 ? 7 : lit > -0.2 ? 4 : 0;
      var c = SL + tone; if (glowLow && y > r * 0.3 && tone < 5) c = I.sll + Math.min(6, tone);
      fb.set(cx + x, cy + y, c);
    }
  }
  // a cluster of faceted shards, rasterised by inverse mapping so the facets are crisp: hexagonal prisms with a slanted pyramid tip; left face lit,
  // a bright centre face, a dark right face; tn = 5 palette indices dark -> bright
  function tonesOf(ramp) { return ramp === I.cv || ramp === I.cp ? [ramp, ramp + 1, ramp + 2, ramp + 3, ramp + 4] : [ramp, ramp + 1, ramp + 2, ramp + 3, ramp + 5]; }
  function crystalShards(fb, cx, cy, seed, k, ramp, up) {
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
  function rockShard(fb, cx, cy, r, seed, glowLow) {                   // an angular embedded rock: polygon with a lit facet, a mid facet and a shaded one
    var rnd = PX.rng(seed | 0), n = 6 + Math.floor(rnd() * 2), vx = [], vy = [], i, x, y, R0 = Math.ceil(r * 1.4) + 2, W = R0 * 2 + 1, mask = new Uint8Array(W * W), SL = I.sl;
    for (i = 0; i < n; i++) { var an = (i + rnd() * 0.5) / n * TAU, rr = r * (0.72 + 0.34 * rnd()); vx.push(Math.cos(an) * rr * 1.3); vy.push(Math.sin(an) * rr * 0.8); }
    for (y = -R0; y <= R0; y++) for (x = -R0; x <= R0; x++) {
      var inside = false; for (i = 0, j = n - 1; i < n; j = i++) { if (((vy[i] > y + 0.5) !== (vy[j] > y + 0.5)) && (x + 0.5 < (vx[j] - vx[i]) * (y + 0.5 - vy[i]) / (vy[j] - vy[i]) + vx[i])) inside = !inside; }
      if (inside) mask[(y + R0) * W + x + R0] = 1;
    }
    var j;
    function at(xx, yy) { xx += R0; yy += R0; return xx >= 0 && yy >= 0 && xx < W && yy < W && mask[yy * W + xx] === 1; }
    var ca = Math.cos(rnd() * TAU), sa = Math.sin(rnd() * TAU);
    for (y = -R0; y <= R0; y++) for (x = -R0; x <= R0; x++) {
      if (!at(x, y)) continue;
      var lit = -(x * 0.62 + y * 0.78) / (r * 1.3), facet = (x * ca + y * sa) / (r * 1.3), tone = lit > 0.34 ? 5 : lit > -0.05 ? 4 : lit > -0.45 ? 3 : 2;
      if (facet > 0.28 && tone > 2) tone--; else if (facet < -0.35 && tone < 5) tone++;
      tone = clamp(Math.floor(tone + (BP[(((cy + y) & 3) << 2) | ((cx + x) & 3)] - 0.5) * 0.6), 2, 5);
      if (!(at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1))) tone = lit > 0.1 ? 7 : lit > -0.25 ? 4 : 0;
      var c = SL + tone; if (glowLow && y > 0 && tone < 5) c = I.sll + Math.min(6, tone);
      fb.set(cx + x, cy + y, c);
    }
  }
  function geode(fb, cx, cy, rx, ry, seed, grp) {                        // a split geode: a rocky shell, a ring of glowing crystal teeth, a dark hollow with a bright heart
    var SL = I.sl, vgs = [I.vg0, I.vg1, I.vg2], vg = vgs[grp % 3], purple = (seed % 3) === 0, rnd = PX.rng(seed | 0), x, y, w0 = rnd() * TAU, w1 = rnd() * TAU, nf = 12 + Math.floor(rnd() * 5);
    halo(fb, cx, cy, Math.round(rx * 2.7), Math.round(ry * 2.7), 0.95, purple ? LITS.pur : LITS.teal);
    for (y = -ry - 2; y <= ry + 2; y++) for (x = -rx - 2; x <= rx + 2; x++) {
      var th = Math.atan2(y / ry, x / rx), e = Math.sqrt((x / rx) * (x / rx) + (y / ry) * (y / ry)) / (1 + 0.10 * Math.sin(3 * th + w0) + 0.06 * Math.sin(5 * th + w1)); if (e > 1.14) continue;
      var lit = -(x / rx * 0.7 + y / ry * 0.7), c, bay = BP[(((cy + y) & 3) << 2) | ((cx + x) & 3)], fac = Math.floor((th + Math.PI) / TAU * nf + 0.5 * Math.sin(th * 5 + w1));
      if (e > 1.0) c = lit > 0.15 ? SL + 6 : SL;                                                     // outer edge: lit / dark
      else if (e > 0.82) c = lit > 0.1 ? SL + 5 : lit > -0.3 ? SL + 3 : SL + 2;                       // the shell
      else if (e > 0.30 + 0.05 * Math.sin(th * nf + w0)) {                                           // crystal teeth: facets alternate, brighter toward the hollow
        var t = (0.82 - e) / 0.52, base = purple ? I.cv : vg;
        c = purple ? base + clamp(Math.floor(1.6 + t * 2.4 + ((fac & 1) ? 0.8 : -0.4) + bay * 0.6), 1, 4) : base + clamp(Math.floor(2.0 + t * 2.4 + ((fac & 1) ? 0.9 : -0.5) + bay * 0.6), 1, 5);
        if (t > 0.86) c = purple ? base + 4 : base + 5;
      }
      else c = (bay < 0.30 + 0.35 * (y / ry + 1) * 0.5) ? (purple ? I.cv : vg) : I.ink;              // the hollow, a little glow settling low
      fb.set(cx + x, cy + y, c);
    }
    fb.set(cx, cy, purple ? I.cv + 4 : vg + 5); fb.set(cx - 1, cy, purple ? I.cv + 3 : vg + 4); fb.set(cx, cy - 1, purple ? I.cv + 3 : vg + 4);
  }
  function meteorite(fb, cx, cy, r, seed) {
    var rnd = PX.rng(seed | 0), x, y, MT = I.mt;
    halo(fb, cx, cy, Math.round(r * 3.2), Math.round(r * 2.6), 0.75, LITS.teal);
    for (y = -r - 1; y <= r + 1; y++) for (x = -r - 2; x <= r + 2; x++) {
      var ang = Math.atan2(y, x), rr = r * (0.82 + 0.28 * vn2(Math.cos(ang) * 1.6 + seed, Math.sin(ang) * 1.6, 3)), e = Math.sqrt((x / 1.25) * (x / 1.25) + y * y) / rr; if (e > 1) continue;
      var lit = -(x * 0.6 + y * 0.8) / r, tone = lit > 0.45 ? 3 : lit > 0 ? 2 : lit > -0.5 ? 1 : 0; if (e > 0.86) tone = lit > 0.25 ? 3 : 0;
      fb.set(cx + x, cy + y, MT + tone);
    }
    var fx = cx - Math.round(r * 0.5), fy = cy - Math.round(r * 0.3);                   // a glowing fissure with an amber heart
    for (var s = 0; s < r * 1.5; s++) { fx += rnd() < 0.7 ? 1 : 0; fy += rnd() < 0.55 ? 1 : (rnd() < 0.2 ? -1 : 0); fb.set(fx, fy, s > r * 0.5 && s < r ? I.ht + 2 : (s & 1 ? I.vg1 + 4 : I.vg1 + 5)); fb.set(fx, fy + 1, I.vg1 + 2); }
  }
  function ammonite(fb, cx, cy, r) {
    var BN = I.bn, s, th = 0, rr, x, y;
    for (s = 0; s < 240; s++) {
      th += 0.12; rr = 0.9 + th * (r / 14); if (rr > r) break;
      var px = cx + Math.cos(th) * rr, py = cy + Math.sin(th) * rr * 0.96;
      for (var q = 0; q < 2; q++) { x = Math.round(px + (q ? 0.7 : 0)); y = Math.round(py + (q ? 0.7 : 0)); fb.set(x, y, q ? BN + 1 : (Math.cos(th - 2.4) > 0.2 ? BN + 3 : BN + 2)); }
    }
    fb.set(cx, cy, BN);
  }
  function skull(fb, x, y, flip) {                                          // a fossil skull: domed cranium, deep sockets with a cold glint, a notch of nose, a row of teeth
    var BN = I.bn, cx = x + 7, cy = y + 6, u, v;
    for (v = -7; v <= 8; v++) for (u = -8; u <= 8; u++) {
      var uu = flip ? -u : u, cr = (uu / 6.6) * (uu / 6.6) + ((v + 0.5) / 5.6) * ((v + 0.5) / 5.6), inCr = cr <= 1, inJaw = v >= 4 && v <= 7 && Math.abs(uu) <= 3.8 - (v - 4) * 0.25;
      if (!inCr && !inJaw) continue;
      var e1 = ((uu + 2.8) / 2.0) * ((uu + 2.8) / 2.0) + ((v - 0.6) / 1.8) * ((v - 0.6) / 1.8), e2 = ((uu - 2.8) / 2.0) * ((uu - 2.8) / 2.0) + ((v - 0.6) / 1.8) * ((v - 0.6) / 1.8), c;
      if (e1 <= 1 || e2 <= 1) c = (e1 <= 0.16 || e2 <= 0.16) ? I.vg1 + 4 : I.sl;                                                   // sockets: dark, with a cold spark
      else if (v >= 3 && v <= 4 && Math.abs(uu) <= 0.6) c = I.sl;                                                                  // the nose
      else if (inJaw && v >= 5 && (uu & 1) === 0 && Math.abs(uu) <= 3) c = BN;                                                    // gaps between teeth
      else {
        var lit = -(uu * 0.7 + v * 0.65) / 6.5, edge = inCr ? cr > 0.78 : (v === 7 || Math.abs(uu) >= 3.2);
        c = edge ? (lit > 0.05 ? BN + 3 : BN + 1) : (lit > 0.35 ? BN + 3 : lit > -0.1 ? BN + 2 : BN + 1);
      }
      fb.set(cx + u, cy + v, c);
    }
  }
  function tablet(fb, cx, cy, seed) {
    var BN = I.bn, x, y, rnd = PX.rng(seed | 0), w = 17, hh = 11;
    halo(fb, cx, cy, 20, 14, 0.5, LITS.teal);
    for (y = 0; y < hh; y++) for (x = 0; x < w; x++) {
      var edge = x === 0 || y === 0 || x === w - 1 || y === hh - 1, c;
      if (edge) c = (x === 0 || y === 0) ? BN + 3 : BN; else if (x === 1 || y === 1) c = BN + 1; else c = I.sl + 1 + ((x + y) & 1 && rnd() < 0.2 ? 1 : 0);
      fb.set(cx - 8 + x, cy - 5 + y, c);
    }
    var pts = []; for (var i = 0; i < 5; i++) pts.push([cx - 6 + Math.round(rnd() * 12), cy - 3 + Math.round(rnd() * 6)]);
    for (i = 0; i < 4; i++) { var a0 = pts[i], b0 = pts[i + 1], n = Math.max(Math.abs(b0[0] - a0[0]), Math.abs(b0[1] - a0[1])); for (var s = 1; s < n; s++) fb.set(Math.round(a0[0] + (b0[0] - a0[0]) * s / n), Math.round(a0[1] + (b0[1] - a0[1]) * s / n), I.vg1 + 2); }
    for (i = 0; i < 5; i++) fb.set(pts[i][0], pts[i][1], I.vg1 + 5);
  }
  function astrolabe(fb, cx, cy, r) {
    var BZ = I.bz, x, y;
    for (y = -r - 2; y <= r + 2; y++) for (x = -r - 2; x <= r + 2; x++) {
      var dd = Math.sqrt(x * x + y * y), lit = -(x + y) / (r * 1.4);
      if (dd <= r + 0.5 && dd > r - 1.3) fb.set(cx + x, cy + y, lit > 0.2 ? BZ + 3 : lit > -0.3 ? BZ + 2 : BZ + 1);
      else if (dd <= r - 2.4 && dd > r - 3.4) fb.set(cx + x, cy + y, BZ + 1);
      else if (dd < r - 3.4 && (x === 0 || y === 0)) fb.set(cx + x, cy + y, BZ + 1);
      else if (dd < r - 3.4) fb.set(cx + x, cy + y, I.sl + 1);
    }
    for (var k = 0; k < 12; k++) { var a = k / 12 * TAU; fb.set(cx + Math.round(Math.cos(a) * (r + 1.7)), cy + Math.round(Math.sin(a) * (r + 1.7)), BZ + 2); }
    fb.set(cx, cy, I.vg1 + 5); fb.set(cx + Math.round(r * 0.45), cy - Math.round(r * 0.3), BZ + 3);
  }
  function telescope(fb, cx, cy, len, ang) {
    var BZ = I.bz, ca = Math.cos(ang), sa = Math.sin(ang), t, s;
    for (t = 0; t < len; t++) for (s = -1; s <= 1; s++) {
      var x = Math.round(cx + ca * t - sa * s), y = Math.round(cy + sa * t + ca * s), thick = t > len * 0.7 ? 1 : 0;
      fb.set(x, y, s < 0 ? BZ + 3 : (s === 0 ? BZ + 2 : BZ + 1));
      if (t % 5 === 4) fb.set(x, y, BZ);
      if (thick && s === 0) fb.set(Math.round(cx + ca * t - sa * 2), Math.round(cy + sa * t + ca * 2), BZ + 1);
    }
    for (s = -2; s <= 2; s++) fb.set(Math.round(cx + ca * (len - 1) - sa * s), Math.round(cy + sa * (len - 1) + ca * s), I.bn + 3);
    fb.set(Math.round(cx + ca * len), Math.round(cy + sa * len), I.vg1 + 5);
  }
  function dome(fb, cx, cy, r, seed) {                            // a buried observatory: a chamber in the rock, lit from within; a ribbed stone dome on a drum with a bronze band, a shutter slit with a glint of lens
    var BZ = I.bz, BN = I.bn, x, y, drumH = Math.max(3, Math.round(r * 0.32)), slitX = Math.round(r * 0.22), SL = I.sl, cw = r + 4, ch = r + 4;
    halo(fb, cx, cy - Math.round(r * 0.4), Math.round(r * 2.6), Math.round(r * 2.0), 0.7, LITS.teal);
    for (y = -r - 3; y <= drumH + 3; y++) for (x = -cw; x <= cw; x++) {                                     // the chamber: a dark hollow with a lit lower lip
      var e = (x / cw) * (x / cw) + (y < 0 ? (y / (r + 3)) * (y / (r + 3)) : (y / (drumH + 3)) * (y / (drumH + 3))); if (e > 1) continue;
      fb.set(cx + x, cy + y, e > 0.86 ? (y > 0 ? I.sll + 4 : SL) : SL + 1 - (BP[(((cy + y) & 3) << 2) | ((cx + x) & 3)] < 0.4 && y > 0 ? 1 : 0));
    }
    for (y = -r; y <= drumH; y++) for (x = -r - 1; x <= r + 1; x++) {
      var c = 0;
      if (y <= 0) {
        var dxr = x / (r + 0.3), ee = dxr * dxr + (y / r) * (y / r); if (ee > 1) continue;
        var lit = -(x / r * 0.72 + y / r * 0.62), edge = ee > (1 - 2.2 / r);
        c = edge ? (lit > 0.15 ? BN + 3 : BN) : (lit > 0.42 ? BN + 3 : lit > 0.05 ? BN + 2 : lit > -0.4 ? BN + 1 : BN);
        var ry0 = Math.sqrt(Math.max(0, r * r - y * y));                      // gore ribs converge on the crown
        for (var kk = -2; kk <= 2; kk++) if (kk !== 0 && Math.abs(x - Math.round(kk * 0.36 * ry0)) < 0.55 && y > -r + 2) c = lit > 0 ? BN + 1 : BN;
        if (y < -1 && y > -r * 0.86 && x >= slitX - 1 && x <= slitX) c = x === slitX ? I.vg1 + 2 : BN;   // the shutter slit
        if (y === 0) c = BZ + 2;                                            // the bronze band where dome meets drum
      } else {
        if (Math.abs(x) > r) continue;
        var dl = -(x / r);
        c = y === 1 ? BZ + 1 : (x === -r ? BN + 3 : (x === r ? BN : (dl > 0.1 ? BN + 2 : BN + 1)));
        if (y >= 2 && y <= drumH - 1 && (x + 40) % 6 === 0 && Math.abs(x) < r - 1) c = SL;                  // dark window slits
        if (y === drumH) c = BN;
      }
      if (c) fb.set(cx + x, cy + y, c);
    }
    fb.set(cx + slitX, cy - Math.round(r * 0.62), I.vg1 + 5);
    fb.set(cx - Math.round(r * 0.5), cy - Math.round(r * 0.62), BN + 3);
  }
  function crystalCluster(fb, cx, cy, seed, k, ramp, mapKey) {
    halo(fb, cx, cy - Math.round(6 * k), Math.round(26 * k), Math.round(22 * k), 0.85, LITS[mapKey]);
    var mr = Math.round(7 * k), x, y;
    for (y = -Math.round(mr * 0.6); y <= 2; y++) for (x = -mr; x <= mr; x++) if ((x * x) / (mr * mr) + (y * y) / (mr * mr * 0.36) <= 1) fb.set(cx + x, cy + y, I.sl + ((y < 0 && x < 0) ? 3 : 1));
    crystalShards(fb, cx, cy, seed, k * 1.15, ramp, true);
    crystalShards(fb, cx - Math.round(2 * k), cy + 1, seed + 5, k * 0.7, ramp, true);
  }
  function cavern(fb, cx, cy, rx, ry, seed, grp) {                        // a hollow in the rock: dark air, a lit lip, a glowing pool, crystals growing up from it and hanging from the roof
    var vg = [I.vg0, I.vg1, I.vg2][grp % 3], SL = I.sl, rnd = PX.rng(seed | 0), x, y, w0 = rnd() * TAU, w1 = rnd() * TAU, poolY = Math.round(ry * 0.32), k = Math.max(0.8, rx / 24);
    halo(fb, cx, cy, Math.round(rx * 2.1), Math.round(ry * 2.3), 0.9, LITS.teal);
    for (y = -ry - 4; y <= ry + 4; y++) for (x = -rx - 4; x <= rx + 4; x++) {
      var th = Math.atan2(y / ry, x / rx), e = Math.sqrt((x / rx) * (x / rx) + (y / ry) * (y / ry)) / (1 + 0.10 * Math.sin(3 * th + w0) + 0.06 * Math.sin(7 * th + w1));
      if (e > 1.14) continue;
      var lit = -(x / rx * 0.7 + y / ry * 0.7), c, bay = BP[(((cy + y) & 3) << 2) | ((cx + x) & 3)];
      if (e > 1.0) c = lit > 0.25 ? SL + 6 : lit > -0.25 ? SL + 3 : SL;
      else if (y > poolY) {                                                // the pool: a bright surface line, ripples, a darker depth
        var pd = y - poolY; c = pd === 1 ? vg + 4 : (pd < 4 ? (bay < 0.5 ? vg + 3 : vg + 2) : ((pd % 3) === 0 && bay < 0.6 ? vg + 1 : (bay < 0.35 ? vg + 2 : vg + 1)));
      } else c = (bay < (y + ry) / (ry * 2.6) * 0.5 + 0.06) ? vg : I.ink;   // dark air with a little glow settling low
      fb.set(cx + x, cy + y, c);
    }
    var n1 = 3 + Math.floor(rnd() * 2), i;
    for (i = 0; i < n1; i++) { var px = cx + Math.round((-0.6 + 1.2 * (i + 0.5) / n1) * rx * 0.8); crystalShards(fb, px, cy + poolY + 1, seed * 3 + i, k * (0.55 + 0.5 * rnd()), (i + grp) % 3 === 0 ? I.cv : vg, true); }
    for (i = 0; i < 4; i++) { var qx = cx + Math.round((-0.7 + 1.4 * (i + 0.5) / 4) * rx * 0.7), qt = Math.round(-ry * Math.sqrt(Math.max(0.05, 1 - Math.pow((qx - cx) / rx, 2))) * 0.94); crystalShards(fb, qx, cy + qt + 1, seed * 5 + i, k * (0.3 + 0.3 * rnd()), vg, false); }
  }
  function sundial(fb, cx, cy, r, seed) {                                   // a great stone sundial for the night: a tilted star-marked disc, a triangular gnomon fin and its long tapering shadow, sunk in a chamber
    var BN = I.bn, SL = I.sl, x, y, k, t, q, ry = r * 0.62;
    halo(fb, cx, cy, Math.round(r * 2.2), Math.round(r * 1.5), 0.6, LITS.teal);
    for (y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for (x = -r - 4; x <= r + 4; x++) {                // the disc, seen tilted: an ellipse with a chunky bronze rim
      var e = (x * x) / ((r + 3) * (r + 3)) + (y * y) / (ry * ry); if (e > 1) continue;
      var lit = -(x / r * 0.6 + y / r * 0.8), rim = e > 0.80;
      fb.set(cx + x, cy + y, rim ? (lit > 0.1 ? BN + 3 : (lit > -0.3 ? BN + 1 : BN)) : (e > 0.66 ? SL + 1 : (lit > 0.2 ? SL + 3 : SL + 2)));
    }
    for (k = 0; k < 8; k++) {                                                          // eight radial star-ticks on the rim ring, two of them lit
      var a = (k + 0.5) / 8 * TAU, ca = Math.cos(a), sa = Math.sin(a);
      for (t = 0.66; t <= 0.80; t += 0.045) fb.set(Math.round(cx + ca * (r + 3) * Math.sqrt(t)), Math.round(cy + sa * ry * Math.sqrt(t)), (k === 1 || k === 5) ? I.vg1 + 4 : BN + 1);
    }
    for (k = 0; k < 26; k++) {                                                         // a dashed inner ring
      if (k % 3 === 2) continue; var a2 = k / 26 * TAU; fb.set(Math.round(cx + Math.cos(a2) * (r + 3) * 0.52), Math.round(cy + Math.sin(a2) * ry * 0.52), SL + 1);
    }
    var sl0 = Math.round(r * 0.95);                                                    // the shadow: a dark wedge that tapers as it runs out across the dial
    for (t = 1; t <= sl0; t++) { var sxp = cx + Math.round(t * 0.95), syp = cy + Math.round(t * 0.30), wid = t < sl0 * 0.35 ? 4 : (t < sl0 * 0.7 ? 3 : 2); for (q = 0; q < wid; q++) fb.set(sxp, syp + q - 1, SL); }
    var H = Math.max(6, Math.round(r * 0.62)), len = Math.max(5, Math.round(r * 0.55));   // the gnomon: a right-triangle fin, tall at the pole end, lit on its slope
    for (x = -len; x <= 0; x++) {
      var hh = Math.round(H * (1 + x / len)), by = cy + 1;
      for (y = 0; y <= hh; y++) fb.set(cx + x, by - y, y === hh ? BN + 3 : (x >= -1 ? BN + 1 : (y >= hh - 1 ? BN + 3 : BN + 2)));
      if (x === -len) fb.set(cx + x, by, BN);
    }
    fb.set(cx, cy + 1 - H - 1, I.vg1 + 5);
  }
  function armillary(fb, cx, cy, r, seed) {                               // the old star-machine: three bronze rings around a small pale sphere
    var BZ = I.bz, rings = [[1.0, 0.30, 0.15], [0.42, 1.0, 0.12], [0.86, 0.62, -0.75]], q, t;
    halo(fb, cx, cy, Math.round(r * 2.2), Math.round(r * 2.0), 0.55, LITS.teal);
    for (q = 0; q < rings.length; q++) {
      var rx = rings[q][0] * r, ry = rings[q][1] * r, rot = rings[q][2] + (seed % 7) * 0.02, cr = Math.cos(rot), sr = Math.sin(rot);
      for (t = 0; t < TAU; t += 0.012) {
        var ex = Math.cos(t) * rx, ey = Math.sin(t) * ry, x = Math.round(cx + ex * cr - ey * sr), y = Math.round(cy + ex * sr + ey * cr), lit = -((ex * cr - ey * sr) * 0.7 + (ex * sr + ey * cr) * 0.7) / r;
        fb.set(x, y, lit > 0.35 ? BZ + 3 : lit > -0.15 ? BZ + 2 : BZ + 1); if (lit < 0.1) fb.set(x + 1, y + 1, BZ);
        if (q === 0 && Math.abs(((t / TAU) * 24) % 1) < 0.02) fb.set(x + Math.round(cr * 1.6), y + Math.round(sr * 1.6), BZ + 2);
      }
    }
    var sr0 = Math.max(2, Math.round(r * 0.26)), x, y;
    for (y = -sr0; y <= sr0; y++) for (x = -sr0; x <= sr0; x++) if (x * x + y * y <= sr0 * sr0) fb.set(cx + x, cy + y, (x + y) < -sr0 * 0.4 ? I.bn + 3 : (x + y) < sr0 * 0.6 ? I.bn + 2 : I.bn + 1);
    fb.set(cx - Math.round(sr0 * 0.4), cy - Math.round(sr0 * 0.4), I.vg1 + 5);
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
    var w = fb.w, h = fb.h, lip = S.lip, a = S.adj || 1, t = S.reduced ? 0 : S.tSec, i;
    function A(v) { return Math.max(1, Math.round(v * a)); }
    var CW = A(52), c0 = Math.floor((qoff - 80) / CW), c1 = Math.floor((qoff + w + 80) / CW), c, j;
    for (c = c0; c <= c1; c++) {
      for (j = 0; j < 8; j++) {
        var hh = PX.h2(c * 13 + j, 7100 + j * 3), P = [0.62, 0.5, 0.36, 0.24, 0.40, 0.2, 0.16, 0.09][j];
        if (hh > P) continue;
        var qx = c * CW + PX.h2(c, 7200 + j) * CW, sx = Math.round(qx - qoff); if (sx < -40 || sx > w + 40) continue;
        var lo = [14, 90, 34, 50, 70, 100, 100, 50][j], hi = [150, 300, 260, 300, 300, 320, 320, 260][j];
        var dd = A(lo + PX.h2(c, 7300 + j) * (hi - lo)), sy = lip[clamp(sx, 0, w - 1)] + dd; if (sy < -30 || sy > h + 30) continue;
        var sd = c * 17 + j * 5, pick = PX.h2(c, 7400 + j), K = "|" + sd;
        if (j <= 1) {
          var rr0 = Math.max(2, A(2.5 + PX.h2(c, 7500 + j) * 6)), gl0 = dd > A(200);
          if (rr0 >= 5 && pick > 0.3) stamp(fb, "rs" + K + "|" + rr0 + gl0, sx, sy, function (r) { rockShard(r, 0, 0, rr0, sd, gl0); });
          else stamp(fb, "sb|" + rr0 + gl0, sx, sy, function (r) { stoneBlob(r, 0, 0, rr0, gl0); });
        } else if (j === 2) {
          var rA = A(7 + pick * 4), rD = A(15 + pick * 4), tf = pick > 0.11;
          if (pick < 0.22) stamp(fb, "sk|" + tf, sx, sy, function (r) { skull(r, 0, 0, tf); });
          else if (pick < 0.40) stamp(fb, "tb" + K, sx, sy, function (r) { tablet(r, 0, 0, sd); });
          else if (pick < 0.58) stamp(fb, "am|" + rA, sx, sy, function (r) { ammonite(r, 0, 0, rA); });
          else if (pick < 0.74) stamp(fb, "as|" + a, sx, sy, function (r) { astrolabe(r, 0, 0, A(6)); });
          else if (pick < 0.88) stamp(fb, "tl|" + a + "|" + pick.toFixed(3), sx, sy, function (r) { telescope(r, 0, 0, A(15), 0.5 + pick); });
          else if (pick < 0.94) stamp(fb, "dm|" + a + K, sx, sy, function (r) { dome(r, 0, 0, A(16), sd); });
          else stamp(fb, "ar|" + rD + K, sx, sy, function (r) { armillary(r, 0, 0, rD, sd); });
        } else if (j === 3) { var gx = A(10 + pick * 6), gy = A(7 + pick * 5), gg = c + j; stamp(fb, "ge|" + gx + "|" + gy + K + "|" + (gg % 3), sx, sy, function (r) { geode(r, 0, 0, gx, gy, sd, gg); }); }
        else if (j === 6) { var cx0 = A(20 + pick * 10), cy0 = A(12 + pick * 7); stamp(fb, "cv|" + cx0 + "|" + cy0 + K + "|" + (c % 3), sx, sy, function (r) { cavern(r, 0, 0, cx0, cy0, sd, c); }); }
        else if (j === 7) { var sr = A(16 + pick * 6); stamp(fb, "sd|" + sr + K, sx, sy, function (r) { sundial(r, 0, 0, sr, sd); }); }
        else if (j === 4) { var kc = Math.max(0.9, a * ((pick < 0.5 ? 1.0 : 0.95) + 0.6 * pick)), rmp = pick < 0.5 ? I.cv : I.cp; stamp(fb, "cc|" + kc.toFixed(2) + "|" + rmp + K, sx, sy, function (r) { crystalCluster(r, 0, 0, sd, kc, rmp, "pur"); }); }
        else { var mr = A(4 + pick * 3.5); stamp(fb, "mt|" + mr + K, sx, sy, function (r) { meteorite(r, 0, 0, mr, sd); }); }
      }
    }
    // small crystals standing on the crest, glinting; kept clear of the hero and his stone
    var cw2 = A(58), q0 = Math.floor((qoff - 30) / cw2), q1 = Math.floor((qoff + w + 30) / cw2), clearL = heroX - 34 * a - 8, clearR = heroX + ((S.stoneX || 40) + (S.stoneR || 30) * 2) * S.zoom + 24;
    for (c = q0; c <= q1; c++) {
      if (PX.h2(c, 8100) > 0.55) continue;
      var x2 = Math.round(c * cw2 + PX.h2(c, 8101) * cw2 - qoff); if (x2 < 2 || x2 > w - 3 || (x2 > clearL && x2 < clearR)) continue;
      var by = lip[x2] + 1, kk = Math.max(0.7, a * (0.55 + 0.6 * PX.h2(c, 8102))), cp = PX.h2(c, 8103), seed2 = c * 7 + 3, rmp2 = cp < 0.45 ? I.vg0 : cp < 0.8 ? I.cv : I.cp, peb = PX.h2(c, 8105) < 0.4, pr0 = Math.max(2, A(2 + PX.h2(c, 8106) * 2));
      stamp(fb, "cs|" + kk.toFixed(2) + "|" + rmp2 + "|" + seed2 + "|" + peb, x2, by, function (r) { if (peb) stoneBlob(r, 5, 1, pr0, false); crystalShards(r, 0, 0, seed2, kk, rmp2, true); });
      if (!S.reduced && Math.floor(t * 1.6 + c) % 3 === 0) fb.set(x2 + 1, by - Math.round(15 * kk), I.star + 6);
    }
  }
  // ---------------------------------------------------------------- scroll integrator: the ground grain moves rigidly, at the true ground speed, whatever the zoom does
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
    var w = fb.w, h = fb.h, hy = S.horizonY + Math.round((1 - S.openingT) * S.h * 0.12), al = S.altitude, t = S.reduced ? 0 : S.tSec, a = S.adj || 1, i, x, y;
    function A(v) { return Math.max(1, Math.round(v * a)); }
    var zone = Math.min(zoneM(al), 1400);                                   // metres into the zone: parallax is measured from the zone's start so previews look the same
    bakeSky(S, hy);
    fb.d.set(ST.sky);
    var skyBot = Math.min(h, hy + 30), zf = zoneF(al), ox = -M - Math.round(zf * 20), oy = -M + Math.round(zf * 5) + Math.round((1 - S.openingT) * S.h * 0.05);
    var mw = ST.mw, CW = ST.mwW, CH = ST.mwH, d = fb.d;
    for (y = Math.max(0, -oy); y < Math.min(CH, skyBot - oy); y++) {
      var row = (y + oy) * w, srow = y * CW;
      for (x = Math.max(0, -ox); x < Math.min(CW, w - ox); x++) { var v = mw[srow + x]; if (v) d[row + x + ox] = v; }
    }
    for (i = 0; i < ST.neb.length; i++) {
      var nb = ST.neb[i], span = w + nb.sp.w + 60, nx = (((nb.x + nb.sp.w - t * nb.v - zone * 0.03) % span) + span) % span - nb.sp.w;
      fb.blit(nb.sp, Math.round(nx), Math.round(nb.y * hy), 0);
    }
    drawStars(fb, S, ox, oy, skyBot, t);
    drawMeteor(fb, S, skyBot, t);
    Sc.blitStrip(fb, ST.far, zone * 0.05 + 90, hy - ST.far.h + A(8));
    var yA = hy - A(4) - ST.dA.crest;
    Sc.blitStrip(fb, ST.dA, zone * 0.16 + t * 0.4, yA);
    Sc.blitStrip(fb, ST.mid, zone * 0.11 + 300, hy - ST.mid.h + A(30));
    var yB = hy + A(14) - ST.dB.crest;
    Sc.blitStrip(fb, ST.dB, zone * 0.30 + 140 + t * 0.7, yB);
    var yC = hy + A(40) - ST.dC.crest;
    Sc.blitStrip(fb, ST.dC, zone * 0.55 + 40 + t * 1.0, yC);
  };

  // ---------------------------------------------------------------- ground
  R.ground = function (fb, S, pal) {
    buildScene(S);
    var qoff = qoffset(S), heroX = Math.round(S.ztx + S.anchorX * S.zoom);
    blitSlab(fb, S, qoff);
    groundStamps(fb, S, qoff, heroX);
  };

  // slow stardust drifting in front of the world, catching the light and going out again
  R.front = function (fb, S, pal, res) {
    if (S.reduced) return;
    var w = fb.w, h = fb.h, d = fb.d, t = S.tSec, lip = S.lip, a = S.adj || 1, n = 16, i;
    for (i = 0; i < n; i++) {
      var sp = 2.2 + PX.h1(i * 7 + 1) * 3.4, span = w + 60, xx = (((PX.h1(i * 11 + 2) * span - t * sp - S.scroll * S.zoom * 0.08) % span) + span) % span - 30, yy = (0.10 + 0.70 * PX.h1(i * 13 + 3)) * h + Math.sin(t * (0.5 + PX.h1(i * 5) * 0.5) + i * 2.3) * 5;
      var x = Math.round(xx), y = Math.round(yy); if (x < 0 || x >= w || y < 0 || y >= h || y > lip[x] - 3) continue;
      var ph = Math.sin(t * (1.1 + PX.h1(i * 3 + 9)) + i * 1.7); if (ph < 0.15) continue;
      d[y * w + x] = ph > 0.7 ? I.star + 6 : I.star + 5;
      if (ph > 0.85 && x + 1 < w) d[y * w + x + 1] = I.star + 5;
    }
  };

  R.debugStamps = { stoneBlob: stoneBlob, rockShard: rockShard, crystalShards: crystalShards, crystalCluster: crystalCluster, geode: geode, cavern: cavern, meteorite: meteorite, ammonite: ammonite, skull: skull, tablet: tablet, astrolabe: astrolabe, telescope: telescope, dome: dome, armillary: armillary, sundial: sundial };   // (QA: lets a test page paint each prop on its own)
  V8.register("galaxy", R);
})(typeof window !== "undefined" ? window : this);
