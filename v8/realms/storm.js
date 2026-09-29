// Storm Pass - V8 scene (4450-5950 m). A high mountain pass in the teeth of a storm, built entirely in code on the shared
// indexed framebuffer: a banded, dithered sky under layered banks of heavy cauliflower cloud (hard-edged puffs with lit rims,
// dark bellies, mammatus lobes), a distant thunderhead whose crown flickers with heat lightning and silent far bolts, curtains
// of rain hanging over cold blue-grey relief-lit ridges (with runoff threads), the ruined Gate of the pass, gusting scud, and
// driving angled rain in four depth layers that LIFTS/DARKENS the palette entries under it (never RGB lines). Lightning is a
// clock: V8.emit("strike"), a palette flash (the actor is re-lit through R.light), a forked bolt with a dithered afterglow,
// sheet lightning inside the cloud, the odd warm bolt. The ground is wet dark slate (sheen, puddles that mirror the sky and flash
// white, rivulets, moss) over umber scree, shale beds with rusted and mossy seams, a cobble conglomerate, columnar basalt and,
// far below, the storm's charge grounded in the rock: fulgurite roots, quartz veins, crystal clusters and hot basalt joints that
// pulse whenever lightning strikes. Storm intensity, the warm leak at the horizon and the props follow a 1500 m cycle (any altitude works).
// QA hooks: R.qaStrike({hold, x, seed, sheet, warm, at, clear}), R.qaFlick({x}).
(function (root) {
  "use strict";
  var PX = root.PX, Sc = root.Sc, V8 = root.V8, hex = PX.hex, clamp = PX.clamp, clamp01 = PX.clamp01, B4 = PX.BAYER4, TAU = Math.PI * 2;
  var R = { rock: { mat: "granite", style: "granite" }, noThunder: true, thumb: { alt: 0, zoom: 0.74, slope: 0.02, ratio: 0.8 } }, I = {}, BASE = {};
  var ST = { built: "", skyKey: "", palKey: "", lastT: -1e9, next: 0, fnext: 0, sStart: -99, sX: 0.5, sSeed: 1, sheet: false, warm: false, flash: 0, pulse: 0, hold: null, force: null,
             bolt: null, boltKey: "", flick: null, G: {}, mSeed: -1, banks: [], scud: [], rain: null, WS: { t: -1, ss: 0, cp: 0 } };
  var BP = new Float32Array(16);                                          // Bayer thresholds in (0,1): BP[((y & 3) << 2) | (x & 3)]
  (function () { for (var i = 0; i < 16; i++) BP[i] = B4[i >> 2][i & 3] + 0.5; })();
  var LIFT = new Uint8Array(256), DARK = new Uint8Array(256), LUM = new Float32Array(256), RUP = [], RDN = [];   // one step lighter / darker along a ramp; base luminance

  function H(list) { return list.map(hex); }
  function sm(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function h1(n) { return PX.h1(n); }
  function h2(a, b) { return PX.h2(a, b); }
  function jag(x, seg, seed) { var k = Math.floor(x / seg), f = x / seg - k, a = PX.h2(k, seed), b = PX.h2(k + 1, seed); return a + (b - a) * f - 0.5; }   // piecewise-linear value noise, geological not sine-wavy

  // ---------- journey clock: the storm gathers, breaks over the pass and rolls away again every 1500 m (periodic, so any altitude works) ----------
  function zoneU(m) { return (((m - 4450) % 1500) + 1500) % 1500 / 1500; }
  function stormI(u) { return 0.40 + 0.60 * (0.5 - 0.5 * Math.cos(TAU * u)); }

  // ---------- palette: every ramp runs dark -> light ----------
  var RAMPS = [
    ["sky",    "0f1420 131a28 182131 1e2a3b 253346 2d3d51 374858 425464 4f6270 5f7580 728a8f 889f9b a1b3a8 bfcbb6"],
    ["glow",   "8fa298 aab8a6 c8d0b2 e6e6c4"],
    ["cloud",  "0a0d15 0e131d 131a27 1a2334 232f43 2f3e54 3f5169 566d84"],
    ["far",    "3d515f 465b69 526774 617783 7a909b"],
    ["mid",    "26333f 2e3d4b 384858 445668 5f7788"],
    ["near",   "121921 171f29 1d2732 26333f 41586b"],
    ["rock",   "070a0f 0d1219 141b25 1c2531 26323f 32414f 43566a 5a7288"],
    ["wet",    "7f98ab aac2d0 dfeaef"],
    ["slate",  "0b0e16 121722 1b2230 262f42 343f56 475673"],
    ["earth",  "100d0c 191412 241c18 322720 45362b"],
    ["moss",   "0d1613 142019 1b2d23 263f2f 355a41 4d7856"],
    ["rust",   "21100c 3c1c14 5c2c1c 82402a b06438"],
    ["bone",   "3a372f 6d6858 a39d86 d3ccb0"],
    ["quartz", "35465f 607d9f 9dbad2 e0eef6"],
    ["glowd",  "08102a 0f1d55 182f8a 2a4fc4 5b86f0 cfe0ff"],
    ["bolt",   "8ea2ff d8e2ff ffffff"],
    ["ink",    "05070b"]
  ];
  // flash response per ramp: [strength, lo target, hi target] (the ramp is pulled toward a blue-white lit version of itself)
  var FLASH = { sky: [0.86, [58, 70, 100], [222, 232, 252]], glow: [0.7, [200, 210, 220], [255, 255, 255]], cloud: [0.82, [50, 62, 92], [196, 210, 240]], far: [0.6, [90, 108, 140], [214, 226, 246]],
    mid: [0.6, [64, 78, 108], [190, 206, 236]], near: [0.52, [46, 58, 84], [170, 190, 224]], rock: [0.5, [40, 52, 74], [196, 214, 240]], wet: [0.6, [150, 172, 200], [255, 255, 255]],
    slate: [0.36, [34, 44, 64], [150, 170, 204]], earth: [0.3, [40, 44, 58], [130, 140, 160]], moss: [0.4, [44, 60, 66], [140, 168, 160]], rust: [0.3, [70, 60, 66], [190, 150, 140]],
    bone: [0.4, [90, 96, 112], [230, 236, 250]], quartz: [0.5, [90, 110, 150], [240, 248, 255]] };

  // ---------- clouds ----------
  function inE(lm, cx, px, py) { var dx = (px + 0.5 - cx) / lm.r, dy = (py + 0.5 - lm.cy) / lm.ry; return dx * dx + dy * dy <= 1; }
  // paints overlapping ellipse puffs (back to front = top first): hard-edged, each with a lit rim on its upper-left arc, a lit shoulder, a shaded
  // lower-right crescent and a dithered light -> dark body, so every puff reads as its own layered shape in front of the one behind it.
  // lumps with .arc also get a second, inner highlight arc (the billow line that makes a dome read as a dome)
  function puffPaint(d, L, Hh, lumps, T, wrap, limit) {
    var i, k, x, y;
    lumps.sort(function (a, b) { return (a.z || 0) - (b.z || 0) || a.cy - b.cy; });
    function tone(v, x, y) {
      var q = v + (BP[((y & 3) << 2) | (x & 3)] - 0.5) * 0.26;
      return q < 0.2 ? T.lit : q < 0.54 ? T.body : q < 0.82 ? T.shade : T.deep;
    }
    for (i = 0; i < lumps.length; i++) {
      var lm = lumps[i], sh = Math.max(1, Math.round(lm.ry * 0.36)), top = lm.cy - lm.ry;
      var e2 = { cx: 0, r: lm.r * 0.80, ry: lm.ry * 0.76, cy: lm.cy + lm.ry * 0.20 }, ox2 = lm.r * 0.14;
      for (k = wrap ? -1 : 0; k <= (wrap ? 1 : 0); k++) {
        var cxk = lm.cx + k * L, xa = Math.floor(cxk - lm.r), xb = Math.ceil(cxk + lm.r), ya = Math.max(0, Math.floor(top)), yb = Math.min(Hh - 1, Math.ceil(lm.cy + lm.ry));
        for (y = ya; y <= yb; y++) for (x = xa; x <= xb; x++) {
          if (!inE(lm, cxk, x, y)) continue;
          var xx = wrap ? ((x % L) + L) % L : x; if (xx < 0 || xx >= L) continue;
          if (limit && y > limit[xx]) continue;
          var c;
          if (!inE(lm, cxk, x - 1, y - 1) || !inE(lm, cxk, x, y - 1)) c = T.rim;
          else if (!inE(lm, cxk, x - 2, y - 2)) c = T.lit;
          else if (!inE(lm, cxk, x + sh, y + sh)) c = T.shade;
          else {
            c = tone((y - top) / (2 * lm.ry), x, y);
            if (lm.arc && x - cxk < lm.r * 0.15 && y - lm.cy < lm.ry * 0.1 && inE(e2, cxk + ox2, x, y) && !inE(e2, cxk + ox2, x - 1, y - 1)) c = T.lit;
          }
          d[y * L + xx] = c;
        }
      }
    }
  }

  // a cloud mass strip (tileable when wrap): puff crowns over a solid body, a ragged belly, hanging mammatus lobes underlit by the horizon.
  // o: L H seed s (puff size) T {rim lit body shade deep under} thin (min thickness 0..1) hang (px kept free below for lobes) lobes (0..1) wrap arcs (0..1)
  function cloudRow(o) {
    var L = o.L, Hh = o.H, st = Sc.newStrip(L, Hh), d = st.d, rnd = PX.rng(o.seed), T = o.T, s = o.s, i, x, y, wrap = o.wrap !== false;
    var env = Sc.periodic(L, o.seed * 3 + 1), n = Math.max(3, Math.round(L / (s * 1.05))), floorY = Hh - 2 - (o.hang || 0), lumps = [];
    for (i = 0; i < n; i++) {
      var cx = (i + 0.12 + 0.76 * rnd()) * L / n, e = 0.5 + 0.5 * env(cx);
      var tp = wrap ? 1 : Math.pow(Math.sin(Math.PI * clamp01(cx / L)), 0.6);
      var thick = (o.thin + (1 - o.thin) * Math.pow(e, 1.3)) * (0.66 + 0.34 * rnd()) * tp;
      var r = s * (0.55 + 1.2 * Math.pow(rnd(), 1.4)), hgt = Math.max(3, floorY * (0.16 + 0.82 * thick)), ry = Math.min(r * 0.9, hgt * 0.68);
      var cy = floorY - hgt + ry;
      lumps.push({ cx: cx, r: r, ry: ry, cy: cy, arc: r > 7 && rnd() < (o.arcs == null ? 0.7 : o.arcs) });
      var ns = r > s * 1.1 ? 2 : (rnd() < 0.6 ? 1 : 0);                     // satellites on the shoulders: cauliflower, not sausage
      for (var q = 0; q < ns; q++) {
        var sd = q === 0 ? -1 : 1, rr = r * (0.34 + 0.22 * rnd()), ryy = Math.min(rr * 0.92, ry * 0.9);
        lumps.push({ cx: cx + sd * r * (0.55 + 0.3 * rnd()), r: rr, ry: ryy, cy: cy + ry * 0.2 - ryy * 0.1 - ry * 0.15 * rnd() + (rnd() < 0.5 ? ry * 0.15 : 0), arc: false });
      }
    }
    var top = new Float32Array(L).fill(1e9), bot = new Int16Array(L), k, nl = lumps.length;
    for (x = 0; x < L; x++) {
      for (i = 0; i < nl; i++) {
        var lm = lumps[i];
        for (k = wrap ? -1 : 0; k <= (wrap ? 1 : 0); k++) {
          var dx = (x + 0.5) - (lm.cx + k * L); if (dx < -lm.r || dx > lm.r) continue;
          var ty = lm.cy - lm.ry * Math.sqrt(1 - (dx * dx) / (lm.r * lm.r)); if (ty < top[x]) top[x] = ty;
        }
      }
      bot[x] = floorY + Math.round(1.1 * Math.sin(x * 0.19 + o.seed) + 0.8 * Math.sin(x * 0.53 + o.seed * 2));
    }
    function tone(v, x, y) { var q = v + (BP[((y & 3) << 2) | (x & 3)] - 0.5) * 0.26; return q < 0.16 ? T.lit : q < 0.5 ? T.body : q < 0.8 ? T.shade : T.deep; }
    for (x = 0; x < L; x++) {                                             // the solid body under the crowns
      if (top[x] > 1e8) continue;
      var y1 = bot[x];
      for (y = Math.max(0, Math.ceil(top[x])); y <= y1 && y < Hh; y++) d[y * L + x] = tone((y - top[x]) / Math.max(1, y1 - top[x]) * 1.15, x, y);
    }
    puffPaint(d, L, Hh, lumps, T, wrap, bot);
    if (o.hang > 2) {                                                     // mammatus: lobes hanging from the belly, lit from below on their lower-left
      var nlb = Math.round(L / (s * 0.5));
      for (i = 0; i < nlb; i++) {
        var pr = rnd(), lx = (i + 0.2 + 0.6 * rnd()) * L / nlb, rm = Math.max(2, s * (0.12 + 0.14 * rnd())), dm = Math.min(o.hang, rm * (0.8 + 0.9 * rnd()));
        if (pr > (o.lobes == null ? 0.7 : o.lobes)) continue;
        var lxi = Math.floor(lx) % L; if (top[lxi] > 1e8) continue;
        var by = bot[lxi] - 2;
        for (y = by; y <= by + dm; y++) for (x = Math.floor(lx - rm); x <= Math.ceil(lx + rm); x++) {
          var ex = (x + 0.5 - lx) / rm, ey = (y - by) / dm, e2 = ex * ex + ey * ey; if (e2 > 1) continue;
          var xx = wrap ? ((x % L) + L) % L : x; if (xx < 0 || xx >= L) continue;
          var c2;
          if (e2 > 0.6 && ((ex < 0.1 && ey > 0.25) || ey > 0.8)) c2 = T.under;
          else c2 = BP[((y & 3) << 2) | (x & 3)] < 0.5 - ey * 0.3 ? T.shade : T.deep;
          d[y * L + xx] = c2;
        }
      }
    }
    for (x = 0; x < L; x++) {                                             // ragged underside: the last rows dissolve
      var b = bot[x]; if (b >= Hh || d[b * L + x] === 0) continue;
      if (BP[((b & 3) << 2) | (x & 3)] > 0.5 && d[(b + 1 < Hh ? b + 1 : b) * L + x] === 0) d[b * L + x] = 0;
    }
    st.floorY = floorY; st.bot = bot;
    return st;
  }


  // cauliflower: bumps of decreasing size crowd the upper boundary of every puff (generation z paints in front of its parent)
  function cauli(lumps, rnd, depth, minR, full) {
    var out = lumps.slice(), gen = lumps, g, i, q;
    for (g = 1; g <= depth; g++) {
      var next = [];
      for (i = 0; i < gen.length; i++) {
        var p = gen[i]; if (p.r < minR * (g === 1 ? 1.0 : 1.4)) continue;
        var nk = g === 1 ? 4 + Math.floor(rnd() * 4) : 2 + Math.floor(rnd() * 3);
        for (q = 0; q < nk; q++) {
          var th = full ? Math.PI * 0.85 + (q + 0.25 + 0.5 * rnd()) / nk * Math.PI * 1.3 : Math.PI + (q + 0.25 + 0.5 * rnd()) / nk * Math.PI, rr = p.r * (0.30 + 0.28 * rnd()), dist = p.r * (0.66 + 0.24 * rnd());
          var lm = { cx: p.cx + Math.cos(th) * dist, cy: p.cy + Math.sin(th) * dist * (p.ry / p.r), r: rr, ry: rr * (0.84 + 0.14 * rnd()), z: g, arc: rr > 7 && rnd() < 0.5 };
          next.push(lm); out.push(lm);
        }
      }
      gen = next;
    }
    return out;
  }

  // paints a set of lumps into a fresh strip and finishes it: solid body under the crowns, rimmed puffs, mammatus lobes, ragged belly
  // o: w h T {rim lit body shade deep under} hang lobes seed
  function massPaint(o, lumps) {
    var w = o.w, h = o.h, rnd = PX.rng(o.seed * 5 + 3), st = Sc.newStrip(w, h), d = st.d, T = o.T, x, y, i, n = lumps.length, base = h - 2 - (o.hang || 0);
    var top = new Float32Array(w).fill(1e9), bot = new Int16Array(w);
    for (x = 0; x < w; x++) {
      for (i = 0; i < n; i++) { var lm = lumps[i], dx = (x + 0.5) - lm.cx; if (dx < -lm.r || dx > lm.r) continue; var ty = lm.cy - lm.ry * Math.sqrt(1 - (dx * dx) / (lm.r * lm.r)); if (ty < top[x]) top[x] = ty; }
      bot[x] = base - Math.round(1.2 + 1.3 * Math.sin(x * 0.12 + o.seed) + 0.9 * Math.sin(x * 0.31 + o.seed * 2));
    }
    function tone(v, x, y) { var q = v + (BP[((y & 3) << 2) | (x & 3)] - 0.5) * 0.26; return q < 0.2 ? T.lit : q < 0.54 ? T.body : q < 0.82 ? T.shade : T.deep; }
    if (!o.nobody) for (x = 0; x < w; x++) { if (top[x] > 1e8) continue; var y1 = bot[x]; for (y = Math.max(0, Math.ceil(top[x])); y <= y1 && y < h; y++) d[y * w + x] = tone((y - top[x]) / Math.max(1, y1 - top[x]) * 1.15, x, y); }
    puffPaint(d, w, h, lumps, T, false, o.nolimit ? null : bot);
    if (o.hang > 2) {                                                     // mammatus lobes hanging from the belly, lit from below on their lower-left
      var nlb = Math.round(w / 9);
      for (i = 0; i < nlb; i++) {
        var pr = rnd(), lx = (i + 0.2 + 0.6 * rnd()) * w / nlb, rm = 2 + rnd() * o.hang * 0.55, dm = Math.min(o.hang, rm * (0.8 + 0.9 * rnd()));
        if (pr > (o.lobes == null ? 0.7 : o.lobes)) continue;
        var lxi = Math.floor(lx); if (top[lxi] > 1e8) continue;
        var by = bot[lxi] - 2;
        for (y = by; y <= by + dm; y++) for (x = Math.floor(lx - rm); x <= Math.ceil(lx + rm); x++) {
          if (x < 0 || x >= w || y >= h) continue;
          var ex = (x + 0.5 - lx) / rm, ey = (y - by) / dm, e2 = ex * ex + ey * ey; if (e2 > 1) continue;
          d[y * w + x] = (e2 > 0.6 && ((ex < 0.1 && ey > 0.25) || ey > 0.8)) ? T.under : (BP[((y & 3) << 2) | (x & 3)] < 0.5 - ey * 0.3 ? T.shade : T.deep);
        }
      }
    }
    for (x = 0; x < w; x++) { var b = bot[x]; if (b >= h - 1 || d[b * w + x] === 0) continue; if (BP[((b & 3) << 2) | (x & 3)] > 0.5 && d[(b + 1) * w + x] === 0) d[b * w + x] = 0; }
    st.floorY = base; st.bot = bot;
    return st;
  }

  // one cloud bank (single sprite): puffs along a random-walk envelope (tallest off-centre, a long tail), crowded with cauliflower bumps
  // o: w h seed T hang lobes tail plateau arcs cauli minR
  function bank(o) {
    var w = o.w, h = o.h, rnd = PX.rng(o.seed), lumps = [], base = h - 2 - (o.hang || 0), peakX = w * (0.2 + 0.6 * rnd()), ax = 2;
    while (ax < w - 3) {
      var e = ax < peakX ? ax / peakX : (w - ax) / (w - peakX); e = Math.pow(clamp01(e * (o.plateau || 1)), o.tail || 0.6);
      var r = Math.max(2.5, Math.min(base * 0.44, base * (0.10 + 0.27 * e) * (0.55 + 0.9 * rnd())));
      var topY = base - (base * 0.16 + base * 0.72 * Math.pow(e, 1.5) * (0.72 + 0.28 * rnd()));
      var cx = clamp(ax + r * 0.8, r + 1, w - r - 1);
      lumps.push({ cx: cx, cy: Math.max(r * 0.9 + 1, topY + r * 0.9), r: r, ry: r * 0.88, z: 0, arc: r > 8 && rnd() < (o.arcs == null ? 0.7 : o.arcs) });
      ax += r * (0.7 + 0.7 * rnd());
    }
    if (o.cauli) lumps = cauli(lumps, rnd, o.cauli, o.minR || 9);
    return massPaint(o, lumps);
  }

  // a thunderhead: a stem of billows widening upward, a cauliflower crown and a flat anvil spreading downwind, mammatus underneath
  function tower(Wt, Ht, seed, T) {
    var rnd = PX.rng(seed), lumps = [], cx = Wt * 0.44, j, q, base = Ht - 4, tiers = 8;
    for (j = 0; j < tiers; j++) {
      var t = j / (tiers - 1), yc = base - Ht * (0.06 + 0.62 * t), hw = Wt * (0.05 + 0.07 * Math.pow(t, 1.2)), r = Ht * (0.075 + 0.05 * t);
      for (q = 0; q < 3; q++) {
        var off = (q - 1) * hw * (0.5 + 0.35 * rnd()) + (rnd() - 0.5) * r * 0.5, rr = r * (0.8 + 0.45 * rnd());
        lumps.push({ cx: cx + off, r: rr, ry: rr * (0.84 + 0.14 * rnd()), cy: yc + (rnd() - 0.5) * r * 0.5, z: 0, arc: rr > 8 });
      }
    }
    var cy0 = base - Ht * 0.80;
    for (q = 0; q < 7; q++) {                                             // the cauliflower crown, overshooting the anvil plane
      var rr2 = Ht * (0.075 + 0.05 * rnd()), an = (q / 6 - 0.5) * 2.5;
      lumps.push({ cx: cx + Math.sin(an) * Wt * 0.11 + (rnd() - 0.5) * 6, r: rr2, ry: rr2 * 0.92, cy: cy0 - Math.cos(an) * Ht * 0.06 + (rnd() - 0.5) * 5, z: 0, arc: true });
    }
    lumps = cauli(lumps, rnd, 2, 8, true);
    var ay = base - Ht * 0.80;
    var st = massPaint({ w: Wt, h: Ht, seed: seed, T: T, hang: 0, nolimit: true, nobody: true }, lumps), d = st.d, x, y, lo = Math.round(ay + Ht * 0.06);
    for (q = 0; q < 18; q++) {                                             // dark pouches under the anvil
      var mx = Math.round(cx - Wt * 0.38 + Wt * 0.76 * rnd()), my = lo + Math.round(rnd() * 5), mr = 2 + Math.floor(rnd() * 3);
      for (y = 0; y <= mr + 1; y++) for (x = -mr; x <= mr; x++) { if (x * x + y * y * 1.3 > mr * mr) continue; var px = mx + x, py = my + y; if (px >= 0 && px < Wt && py < Ht && !d[py * Wt + px]) d[py * Wt + px] = (x < 0 && y > 0) ? T.under : T.deep; }
    }
    var an = bank({ w: Math.round(Wt * 0.98), h: Math.max(14, Math.round(Ht * 0.24)), seed: seed + 3, T: T, hang: Math.max(3, Math.round(Ht * 0.05)), lobes: 0.55, tail: 0.32, plateau: 2.4, arcs: 0, cauli: 1, minR: 5 });
    var ax0 = Math.round(cx - an.w * 0.42), ay0 = Math.round(ay - an.h * 0.42);
    for (y = 0; y < an.h; y++) for (x = 0; x < an.w; x++) { var av = an.d[y * an.w + x]; if (!av) continue; var tx2 = ax0 + x, ty2 = ay0 + y; if (tx2 >= 0 && tx2 < Wt && ty2 >= 0 && ty2 < Ht) d[ty2 * Wt + tx2] = av; }
    vgrad(st, Ht * 0.42, Ht * 0.98, 2.4, DARK);
    return st;
  }
  // darkens what is opaque in rows y0..y1 by up to `steps` ramp steps (ordered dither between whole steps): a tower is lit at the crown, black at the foot
  function vgrad(st, y0, y1, steps, lut) {
    var w = st.w, h = st.h, d = st.d, x, y;
    for (y = Math.max(0, Math.floor(y0)); y < h; y++) {
      var f = clamp01((y - y0) / Math.max(1, y1 - y0)) * steps, full = Math.floor(f), part = f - full, ob = (y & 3) << 2;
      for (x = 0; x < w; x++) {
        var v = d[y * w + x]; if (!v) continue;
        var k = full + (BP[ob | (x & 3)] < part ? 1 : 0);
        while (k-- > 0) v = lut[v];
        d[y * w + x] = v;
      }
    }
  }

  function blitSprite(fb, st, x0, y0) {                                   // non-wrapping strip blit
    var w = fb.w, h = fb.h, d = fb.d, sd = st.d, sw = st.w, sh = st.h;
    for (var y = Math.max(0, -y0); y < sh && y0 + y < h; y++) {
      var row = (y0 + y) * w, srow = y * sw, xa = Math.max(0, -x0), xb = Math.min(sw, w - x0);
      for (var x = xa; x < xb; x++) { var v = sd[srow + x]; if (v) d[row + x0 + x] = v; }
    }
  }

  // ---------- crags: relief-shaded storm ridges ----------
  // A tileable strip. Every peak is a concave cone with parallel spurs running down its flanks (a relief field), plus rock noise; the field is lit from the
  // upper left (Lambert), quantised to a 5-tone ramp with an ordered dither, given a lit rim along the sunward skyline, and dissolved into rain mist at the base.
  // o: L H seed peaks hMin hMax kMin kMax (flank slope) spur (spacing, of height) zz (ridge wander) base (ramp index) contrast mist fadeRows
  function vn(x, y, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, h = PX.ihash; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h(ix, iy, s), b = h(ix + 1, iy, s), c = h(ix, iy + 1, s), d = h(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function crags(o) {
    var L = o.L, Hh = o.H, N = L * Hh, st = Sc.newStrip(L, Hh), d = st.d, rnd = PX.rng(o.seed), n = o.peaks, B = o.base, ct = o.contrast || 1, i, x, y, k, p, s;
    var rel = new Float32Array(N).fill(-8), pr = new Float32Array(N), pk = [], span = L / n;
    for (i = 0; i < n; i++) {
      var hp = Hh * (o.hMin + (o.hMax - o.hMin) * Math.pow(rnd(), 0.75));
      pk.push({ x: (i + 0.1 + 0.8 * rnd()) * span, ay: Hh - hp - 3, Hc: hp, kL: o.kMin + (o.kMax - o.kMin) * rnd(), kR: o.kMin + (o.kMax - o.kMin) * rnd(), g: 0.86 + 0.08 * rnd(), lean: (rnd() - 0.5) * 0.3, zz: (0.5 + 1.2 * rnd()) * (o.zz == null ? 1.6 : o.zz), ph: rnd() * 6.28 });
    }
    for (p = 0; p < n; p++) {
      var q0 = pk[p], depth = Hh - q0.ay, spacing = Math.max(3.4, q0.Hc * (o.spur || 0.07)), sp = [], side, ts;
      for (side = -1; side <= 1; side += 2) {
        var base = Math.atan(side < 0 ? q0.kL : q0.kR);
        for (ts = spacing * (0.5 + 0.5 * rnd()); ts < depth * 0.92; ts += spacing * (0.75 + 0.5 * rnd())) {
          var phi = base + (rnd() - 0.35) * 0.24, ux = side * Math.cos(phi), uy = Math.sin(phi);
          var sx = q0.x + q0.lean * ts + q0.zz * Math.sin(ts * 0.19 + q0.ph), sy = q0.ay + ts, wS = spacing * (0.42 + 0.3 * rnd()), len = depth * (0.45 + 0.55 * rnd());
          sp.push({ x: sx, y: sy, ux: ux, uy: uy, len: len, w: wS, a: wS * (1.0 + 0.6 * rnd()), x0: Math.min(sx, sx + ux * len) - wS - 1, x1: Math.max(sx, sx + ux * len) + wS + 1, y0: sy - wS - 1, y1: sy + uy * len + wS + 1 });
        }
      }
      pr.fill(-1e9);
      for (k = -1; k <= 1; k++) {
        var ox = k * L, ya = Math.max(0, Math.floor(q0.ay - 3));
        if (q0.x + ox + 400 < 0 || q0.x + ox - 400 > L) continue;
        for (y = ya; y < Hh; y++) {
          var t = y - q0.ay, tt = t < 0 ? 0 : t, rx = q0.x + ox + q0.lean * tt + q0.zz * Math.sin(tt * 0.19 + q0.ph), reach = tt * 1.6 + 30;
          var xa = Math.floor(rx - reach / q0.kL), xb = Math.ceil(rx + reach / q0.kR);
          for (x = xa; x <= xb; x++) {
            var xx = ((x % L) + L) % L, dx = x - rx, a = dx < 0 ? -dx * q0.kL : dx * q0.kR, v = t - q0.Hc * Math.pow(a / q0.Hc, q0.g), o2 = y * L + xx;
            if (v > pr[o2]) pr[o2] = v;
          }
        }
        for (s = 0; s < sp.length; s++) {
          var q = sp[s], qy0 = Math.max(ya, Math.floor(q.y0)), qy1 = Math.min(Hh - 1, Math.ceil(q.y1));
          for (y = qy0; y <= qy1; y++) for (x = Math.floor(q.x0 + ox); x <= Math.ceil(q.x1 + ox); x++) {
            var ex = x - (q.x + ox), ey = y - q.y, along = ex * q.ux + ey * q.uy;
            if (along < -q.w || along > q.len) continue;
            var pe = Math.abs(ey * q.ux - ex * q.uy); if (pe >= q.w) continue;
            var o3 = y * L + (((x % L) + L) % L); if (pr[o3] > -1e8) pr[o3] += q.a * (1 - pe / q.w) * (along < 0 ? 1 + along / q.w : Math.sqrt(1 - along / q.len));
          }
        }
      }
      for (i = 0; i < N; i++) if (pr[i] > rel[i]) rel[i] = pr[i];
    }
    var nz = o.noise == null ? 2.0 : o.noise;
    for (y = 0; y < Hh; y++) for (x = 0; x < L; x++) { i = y * L + x; if (rel[i] > -6) rel[i] += (vn(x * 0.11, y * 0.11, 17) - 0.5) * nz + (vn(x * 0.31, y * 0.31, 42) - 0.5) * nz * 0.4; }
    var Lx = -0.80, Ly = -0.48, Lz = 0.36, ln = Math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz); Lx /= ln; Ly /= ln; Lz /= ln;
    var LI = new Float32Array(N);
    for (y = 1; y < Hh - 1; y++) for (x = 0; x < L; x++) {
      i = y * L + x; var r0 = rel[i]; if (r0 <= 0) continue;
      var xr = (x + 1) % L, xl = (x + L - 1) % L, rr = rel[y * L + xr], rl = rel[y * L + xl], rd = rel[i + L], ru = rel[i - L];
      var gx = (rr > 0 && rl > 0) ? (rr - rl) * 0.5 : rr > 0 ? rr - r0 : rl > 0 ? r0 - rl : 0;
      var gy = (rd > 0 && ru > 0) ? (rd - ru) * 0.5 : rd > 0 ? rd - r0 : ru > 0 ? r0 - ru : 1;
      var nx = -gx, ny = -gy, nz2 = 0.9, nl = Math.sqrt(nx * nx + ny * ny + nz2 * nz2), Li = (nx * Lx + ny * Ly + nz2 * Lz) / nl; LI[i] = Li;
      var li = 0.42 + (Li - 0.42) * ct + (BP[((y & 3) << 2) | (x & 3)] - 0.5) * 0.16 - (y / Hh) * 0.10;
      d[i] = B + (li < 0.15 ? 0 : li < 0.32 ? 1 : li < 0.52 ? 2 : 3);
    }
    for (x = 0; x < L; x++) for (y = 1; y < Hh; y++) {                    // rim along the sunward skyline
      i = y * L + x; if (!d[i] || d[i - L]) continue;
      d[i] = LI[i] > 0.3 ? B + 4 : B + 3;
    }
    if (o.runoff) {                                                       // rain runoff: thin pale threads sheeting down the cliffs, dashed where the water breaks over ledges
      var rr = PX.rng(o.seed * 5 + 17), q, kk;
      for (q = 0; q < o.runoff; q++) {
        var rx = Math.floor(rr() * L), ry = 0; while (ry < Hh && !d[ry * L + rx]) ry++;
        if (ry >= Hh - 12) continue;
        var len = Math.floor(10 + rr() * Hh * 0.55), yy0 = ry + 4 + Math.floor(rr() * 6);
        for (kk = 0; kk < len; kk++) {
          var yy = yy0 + kk; if (yy >= Hh - 2) break; var oi = yy * L + rx, v = d[oi];
          if (!v || v < B || v > B + 3) continue;
          if ((kk + q) % 7 < 5) d[oi] = Math.min(B + 4, v + 2 - ((yy + rx) & 1 ? 1 : 0));
          if (kk > 3 && (kk % 11) === 0) rx += rr() < 0.5 ? -1 : 1;
        }
      }
    }
    if (o.mist != null) for (y = 0; y < o.fadeRows; y++) {
      var ry = Hh - 1 - y, amt = 1 - y / o.fadeRows;
      for (x = 0; x < L; x++) if (d[ry * L + x] && BP[((ry & 3) << 2) | (x & 3)] < amt * 0.9) d[ry * L + x] = o.mist;
    }
    st.top = new Int16Array(L);
    for (x = 0; x < L; x++) { y = 0; while (y < Hh && !d[y * L + x]) y++; st.top[x] = y; }
    return st;
  }

  // ---------- init: palette, lookup tables, cached strips ----------
  R.init = function (pal, S) {
    var i, j, nm;
    for (i = 0; i < RAMPS.length; i++) {
      nm = RAMPS[i][0];
      BASE[nm] = H(RAMPS[i][1].split(" ").map(function (c) { return "#" + c; }));
      I[nm] = pal.ramp(nm, BASE[nm].map(function (c) { return c.slice(); }));
    }
    for (i = 0; i < 256; i++) { LIFT[i] = i; DARK[i] = i; LUM[i] = 0; }
    for (nm in pal.ramps) {
      var rp = pal.ramps[nm];
      for (j = 0; j < rp.n; j++) { LIFT[rp.base + j] = rp.base + Math.min(rp.n - 1, j + 1); DARK[rp.base + j] = rp.base + Math.max(0, j - 1); LUM[rp.base + j] = PX.lum(pal.rgb[rp.base + j]); }
    }
    for (var L = 0; L < 3; L++) { RUP[L] = new Uint8Array(256); RDN[L] = new Uint8Array(256); for (i = 0; i < 256; i++) { RUP[L][i] = LIFT[i]; RDN[L][i] = DARK[i]; } }
    for (nm in pal.ramps) {                                                 // rain: every pixel is moved along its OWN ramp to the tone that is a set luminance step lighter (bright backdrops: darker)
      var rq = pal.ramps[nm], dl = [0.10, 0.18, 0.30], k2, L2;
      for (j = 0; j < rq.n; j++) for (L2 = 0; L2 < 3; L2++) {
        var lj = LUM[rq.base + j], up = j, dn = j;
        for (k2 = j; k2 < rq.n; k2++) { up = k2; if (LUM[rq.base + k2] >= lj + dl[L2]) break; }
        for (k2 = j; k2 >= 0; k2--) { dn = k2; if (LUM[rq.base + k2] <= lj - dl[L2] * 0.7) break; }
        RUP[L2][rq.base + j] = rq.base + up; RDN[L2][rq.base + j] = rq.base + dn;
      }
    }
    R.markerIdx = { c0: I.rock + 4, c1: I.wet, c2: I.wet + 2, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };            // cairns: pale wet stones that read against the dark ridges and rock
    R.birdIdx = I.far + 1;                                                  // pale slate birds fleeing the storm, against the dark cloud deck
    R.watcherIdx = I.rock + 6;                                              // the watcher: a wet-grey cloak that reads on the dark rock
    R.footprint = { col: I.rock + 1, hi: I.rock + 6 };                      // dark damp marks with a wet lit rim
    ST.built = ""; ST.skyKey = ""; ST.palKey = ""; ST.bolt = null; ST.boltKey = ""; ST.rain = null; ST.WS.t = -1;
    ST.next = 0; ST.fnext = 0; ST.sStart = -99;                             // a fresh visit: the first strike comes a few seconds in, not on the first frame
    R.pal = pal;
    buildScene(S);
  };

  function bankTones(d, glowUnder) {                                        // d: 0 (far, pale, lit from beneath) .. 1 (overhead, black); the heavy banks keep a wide rim/body spread so their discs read as volumes
    var C = I.cloud, r = Math.round, hv = Math.max(0, d - 0.6) / 0.4;
    return { rim: C + 7 - r(d * 1.6), lit: C + 6 - r(d * 2.4), body: C + 5 - r(d * 3.0) - (hv > 0.5 ? 0 : 0), shade: C + 4 - r(d * 3.2), deep: C + 3 - r(d * 3), under: glowUnder != null ? glowUnder : C + 5 - r(d * 2) };
  }

  function buildScene(S) {
    var key = S.w + "x" + S.h + "@" + (S.adj || 1) + "|" + S.horizonY;
    if (ST.built === key) return; ST.built = key; ST.skyKey = "";
    var a = S.adj || 1, hz = S.horizonY, w = S.w, k, i;
    function A(v) { return Math.max(1, Math.round(v * a)); }
    ST.a = a;
    ST.banks = [];
    var hzc = clamp(hz, 110, 200), W = Math.max(w, 300);
    var spec = [                                                            // layer, count, width (of screen), height (of horizon), belly y (of horizon), darkness, cauli depth, min bump, speed, parallax
      [0, 2, 1.10, 0.15, 0.91, 0.00, 1, 6, 2.4, 0.02], [1, 2, 0.85, 0.21, 0.77, 0.28, 1, 7, 4.0, 0.04], [2, 2, 0.95, 0.29, 0.61, 0.55, 2, 7, 7.0, 0.07],
      [3, 2, 1.05, 0.40, 0.43, 0.68, 1, 11, 10, 0.10], [4, 3, 1.25, 0.56, 0.25, 0.80, 1, 14, 14, 0.14]];
    for (k = 0; k < spec.length; k++) {
      var sp = spec[k];
      for (i = 0; i < sp[1]; i++) {
        var bh = Math.round(hzc * sp[3]) + A(3 + 8 * sp[5]), hang = A(3 + 8 * sp[5]);
        ST.banks.push({ layer: sp[0], yb: sp[4] * (hz / hzc > 1 ? 1 : 1), v: sp[8] * (0.85 + 0.3 * h1(k * 7 + i)), par: sp[9], x0: (i + 0.3 * h1(k * 3 + i + 5)) / sp[1],
          st: bank({ w: Math.round(W * sp[2]), h: bh, seed: 400 + k * 31 + i * 7, T: bankTones(sp[5], sp[0] === 0 ? I.glow + 1 : (sp[0] === 1 ? I.glow : null)), hang: hang, lobes: 0.3 + 0.45 * sp[5], tail: 0.5, plateau: 1.5 - 0.2 * sp[5], arcs: 0.6, cauli: sp[6], minR: A(sp[7]) }) });
      }
    }
    var Hm = clamp(Math.round(hz * 0.42), 50, 128);
    ST.far = crags({ L: 1280, H: Math.round(Hm * 0.78), seed: 61, peaks: 22, hMin: 0.28, hMax: 0.98, kMin: 0.62, kMax: 1.25, spur: 0.10, base: I.far, contrast: 0.72, mist: I.far + 1, fadeRows: A(20) });
    ST.mid = crags({ L: 1152, H: Hm, seed: 73, peaks: 16, hMin: 0.26, hMax: 0.98, kMin: 0.6, kMax: 1.3, spur: 0.075, base: I.mid, contrast: 0.95, mist: I.mid + 1, fadeRows: A(16), runoff: 9 });
    ST.near = crags({ L: 1024, H: Math.round(Hm * 0.72), seed: 89, peaks: 9, hMin: 0.3, hMax: 0.95, kMin: 0.6, kMax: 1.2, spur: 0.06, base: I.near, contrast: 1.1, mist: I.near + 1, fadeRows: A(12), runoff: 6 });
    var Wt = clamp(Math.round(w * 0.5), 130, 300), Ht = clamp(Math.round(hzc * 0.72), 70, 160), C = I.cloud;
    ST.tower = tower(Wt, Ht, 907, { rim: I.glow + 1, lit: C + 7, body: C + 6, shade: C + 4, deep: C + 3, under: I.glow });
    ST.scud = [];
    for (i = 0; i < 14; i++) {
      var sw = A(46 + 90 * h1(i * 7 + 3)), shh = A(8 + 9 * h1(i * 11 + 5)), tier = i < 5 ? 0 : (i < 10 ? 1 : 2);
      var tt = tier === 0 ? { rim: C + 6, lit: C + 5, body: C + 4, shade: C + 3, deep: C + 2, under: C + 5 } : tier === 1 ? { rim: C + 6, lit: C + 5, body: C + 3, shade: C + 2, deep: C + 1, under: C + 4 } : { rim: C + 5, lit: C + 4, body: C + 2, shade: C + 1, deep: C + 0, under: C + 3 };
      ST.scud.push({ st: cloudRow({ L: sw, H: shh + A(3), seed: 700 + i * 13, s: A(7 + 6 * h1(i * 3 + 1)), T: tt, thin: 0.3, hang: A(2), lobes: 0.4, wrap: false }), tier: tier, x: h1(i * 13 + 9) * 1600, y: 0.28 + 0.6 * h1(i * 17 + 4), v: 22 + 46 * h1(i * 19 + 7) });
    }
    ST.rain = makeRain(S);
  }

  // ---------- sky: banded, dithered, with the low pale light that leaks under the storm ----------
  function skyBake(fb, S, hy) {
    var w = fb.w, h = fb.h, d = fb.d, i, x, y;
    var idx = []; for (i = 0; i < 14; i++) idx.push(I.sky + i);
    Sc.bands(fb, 0, hy + 26, idx, 5);
    if (hy + 26 < h) fb.fillRect(0, hy + 26, w, h - hy - 26, I.sky + 13);
    var gx = Math.round(w * 0.30), rx = Math.round(w * 0.62), gy = hy - 6, ry = Math.max(30, Math.round(hy * 0.34));
    for (y = Math.max(0, gy - ry); y < Math.min(h, hy + 26); y++) for (x = 0; x < w; x++) {
      var ex = (x - gx) / rx, ey = (y - gy) / ry, q = 1 - Math.sqrt(ex * ex + ey * ey * (ey > 0 ? 0.6 : 1)); if (q <= 0) continue;
      var qf = q * 4.2, kk = Math.floor(qf), fr = qf - kk, tone = kk;                                // hard elliptical bands, a narrow dithered seam between them
      if (fr > 0.72 && BP[((y & 3) << 2) | (x & 3)] < (fr - 0.72) * 3.5) tone = kk + 1;
      if (tone >= 1) d[y * w + x] = I.glow + Math.min(3, tone - 1);
    }
  }

  // a rolling rain-mist bank: a wavy crest with a dithered fringe, then two dithered bands from the crest colour down to a second one,
  // with faint wind-drawn streaks so even the fog is never a flat fill
  var MOD = new Int16Array(4096);
  function mist(fb, y0, amp, y1, idxA, idxB, drift) {
    var w = fb.w, d = fb.d, x, y, span = 46;
    for (x = 0; x < w; x++) { var xa = x + drift; MOD[x] = Math.round(amp * (Math.sin(xa * 0.021) * 0.55 + Math.sin(xa * 0.058 + 1.1) * 0.3 + Math.sin(xa * 0.131 + 2.3) * 0.15)); }
    for (y = Math.max(0, y0 - amp - 2); y < Math.min(fb.h, y1); y++) {
      var row = y * w, ob = (y & 3) << 2;
      for (x = 0; x < w; x++) {
        var e = y - (y0 + MOD[x]);
        if (e < -2 || (e === -1 && BP[ob | (x & 3)] > 0.5) || (e === -2 && BP[ob | (x & 3)] > 0.2)) continue;
        var f = e < 0 ? 0 : e / span, c = idxA;
        if (f > 0) { var st = (y >> 3) * 5 + (x >> 4) + ((drift * 0.5) | 0); if (f >= 1) { c = idxB; if (h2((y >> 2) * 7 + ((x + (drift | 0)) >> 4), 11) > 0.84 && BP[ob | (x & 3)] < 0.55) c = idxA; } else if (BP[ob | (x & 3)] < f * 1.1 - 0.05 + ((h2(st, 3) - 0.5) * 0.25)) c = idxB; }
        d[row + x] = c;
      }
    }
  }

  // ---------- geometry / light ----------
  function geom(S) {
    var G = ST.G, u = zoneU(S.altitude);
    G.hy = S.horizonY + Math.round((1 - S.openingT) * S.h * 0.12);
    G.u = u; G.I = stormI(u); G.a = S.adj || 1;
    G.wind = clamp01(0.30 + 0.42 * G.I + 0.7 * (S.windGust || 0));
    return G;
  }

  R.light = function (S) {
    tick(S);
    var G = geom(S), f = ST.flash, kb = 0.2 + 0.1 * G.I, col = [176, 196, 224], amb = [58, 76, 104], br = 0.56, x = Math.round(S.w * 0.3), y = Math.round(S.h * 0.05);
    if (ST.warm) col = [216, 206, 196];
    if (f > 0.02) {
      var fc = ST.warm ? [255, 236, 200] : [232, 240, 255];
      col = mix3(col, fc, clamp01(f * 1.4)); amb = mix3(amb, [130, 150, 190], f); kb = Math.max(kb, 0.15 + 0.8 * f); br = br + 0.36 * f; x = Math.round(ST.sX * S.w); y = 0;
    }
    return { x: x, y: y, k: kb, col: [Math.round(col[0]), Math.round(col[1]), Math.round(col[2])], ambient: [Math.round(amb[0]), Math.round(amb[1]), Math.round(amb[2])], bright: br, ground: [30, 40, 54], flash: f };
  };

  // ---------- lightning: a clock, a palette flash, a forked bolt with a dithered afterglow ----------
  function flashAt(a) {                                                   // a = seconds since the strike began: hard flash, dip, return stroke, long decay
    if (a < 0 || a > 0.9) return 0;
    if (a < 0.07) return 1;
    if (a < 0.14) return 0.2;
    if (a < 0.25) return 0.86;
    return 0.86 * Math.pow(1 - (a - 0.25) / 0.65, 1.7);
  }
  function flickAt(a) {
    if (a < 0 || a > 0.55) return 0;
    if (a < 0.05) return 1;
    if (a < 0.11) return 0.25;
    if (a < 0.2) return 0.8;
    return 0.8 * Math.pow(1 - (a - 0.2) / 0.35, 1.5);
  }
  function startStrike(S, t, str, forced) {
    ST.sStart = t; ST.sSeed = ((t * 1000) | 0) ^ 0x5bd1;
    var hxs = (S.ztx + S.anchorX * S.zoom + (S.stoneX || 40) * 0.5 * S.zoom) / S.w, rrs = ((S.stoneR || 30) * S.zoom * 1.05 + 26) / S.w;   // keep the bolt clear of the stone and the hero
    for (var tr = 0; tr < 8; tr++) { ST.sX = 0.10 + 0.8 * h1(ST.sSeed + tr * 5); if (Math.abs(ST.sX - hxs) > rrs) break; }
    ST.sheet = !forced && h1(ST.sSeed + 7) < 0.3;                         // a third stay inside the cloud: no bolt, a rolling glow
    ST.warm = h1(ST.sSeed + 13) < 0.16;                                   // the occasional warm bolt
    ST.bolt = null;
    V8.emit("strike", Math.max(0.4, str) * (ST.sheet ? 0.55 : 1));
  }
  function tick(S) {
    var t = S.tSec;
    if (t === ST.lastT) return;
    if (t < ST.lastT - 0.5) { ST.next = 0; ST.fnext = 0; ST.sStart = -99; }
    ST.lastT = t;
    var Iv = stormI(zoneU(S.altitude)), live = S.gameState === "playing" && !S.reduced, thumb = S.reduced && S.gameState === "title";
    if (ST.force) { var fo = ST.force; ST.force = null; startStrike(S, fo.at == null ? t : fo.at, Math.max(Iv, 0.7), true); if (fo.x != null) ST.sX = fo.x; if (fo.warm != null) ST.warm = fo.warm; }
    else if (live && S.mythic && S.mythic.type === "thunder" && S.mythic.seed !== ST.mSeed) { ST.mSeed = S.mythic.seed; startStrike(S, t, 0.85, true); }
    else if (live) {
      if (ST.next === 0) ST.next = t + 2.2 + 2.2 * h1((t * 613) | 0);
      else if (t >= ST.next) { startStrike(S, t, Iv); ST.next = t + lerp(10, 3.8, Iv) + 4.6 * h1((t * 977) | 0); }
    } else ST.next = 0;
    if (live && t >= ST.fnext) {                                           // heat lightning: flickers deep in the cloud, no bolt, no thunder
      if (ST.fnext > 0) ST.flick = { t0: t, x: 0.1 + 0.8 * h1((t * 331) | 0), y: 0.3 + 0.5 * h1((t * 173) | 0), r: 0.18 + 0.2 * h1((t * 89) | 0), bolt: h1((t * 57) | 0) < 0.55, seed: (t * 1000) | 0 };
      ST.fnext = t + lerp(6.5, 1.8, Iv) + 3 * h1((t * 421) | 0);
    }
    var a = t - ST.sStart;
    if (thumb) { ST.flash = 0.2; ST.sX = 0.64; ST.sSeed = 5; ST.sheet = false; ST.warm = false; ST.sStart = t - 0.02; a = 0.02; }
    ST.flash = S.reduced && !thumb ? 0 : (ST.hold != null ? ST.hold : (thumb ? 0.2 : flashAt(a) * (ST.sheet ? 0.55 : 1)));
    ST.pulse = (S.reduced && !thumb) ? 0 : (ST.hold != null ? ST.hold : (a > 0 && a < 2.6 ? sm(a / 0.35) * Math.exp(-Math.max(0, a - 0.35) * 1.3) : 0)) * (ST.sheet ? 0.5 : 1);
    ST.fl = ST.flick && !S.reduced ? flickAt(t - ST.flick.t0) : 0;
  }

  // palette animation: storm grade (blacker at the core of the zone, a warm leak at its edges), the flash, the deep charge
  var WARMK = [1.12, 1.0, 0.84];
  function toward(c, t, k) { c[0] += (t[0] - c[0]) * k; c[1] += (t[1] - c[1]) * k; c[2] += (t[2] - c[2]) * k; return c; }
  R.palette = function (pal, S) {
    tick(S);
    var Iv = stormI(zoneU(S.altitude)), f = ST.flash, pl = ST.pulse, warm = clamp01((0.80 - Iv) / 0.36), rel = (Iv - 0.7) / 0.3;   // -1 edge .. +1 core
    var breathe = S.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(S.tSec * 0.8);
    var key = Math.round(warm * 12) + "|" + Math.round(rel * 10) + "|" + Math.round(f * 24) + "|" + Math.round(pl * 16) + "|" + Math.round(breathe * 6) + "|" + (ST.warm ? 1 : 0);
    if (key === ST.palKey) return; ST.palKey = key;
    var fk = 1 - 0.17 * rel, j, n, c, nm, base, out, fl;
    function grade(c, j, n, nm) {
      var tt = j / (n - 1);
      c[0] *= fk; c[1] *= fk; c[2] *= fk * (1 + 0.04 * rel);
      if (warm > 0 && (nm === "sky" || nm === "far")) { var wk = 0.34 * warm * Math.pow(tt, 1.6); c[0] = c[0] * (1 + (WARMK[0] - 1) * wk / 0.34) + 16 * wk; c[1] = c[1] * (1 + (WARMK[1] - 1) * wk / 0.34) + 4 * wk; c[2] = c[2] * (1 + (WARMK[2] - 1) * wk / 0.34) - 6 * wk; }
      return c;
    }
    var names = ["sky", "glow", "cloud", "far", "mid", "near", "rock", "wet", "slate", "earth", "moss", "rust", "bone", "quartz"];
    for (var q = 0; q < names.length; q++) {
      nm = names[q]; base = BASE[nm]; n = base.length; out = []; fl = FLASH[nm];
      for (j = 0; j < n; j++) {
        c = base[j].slice();
        if (nm === "sky" || nm === "cloud" || nm === "far" || nm === "mid" || nm === "near") grade(c, j, n, nm);
        if (nm === "glow" && warm > 0) { var wg = [[168, 144, 118], [200, 170, 124], [228, 194, 140], [250, 222, 172]][j]; toward(c, wg, warm * 0.85); }
        if (fl && f > 0) toward(c, mix3(fl[1], fl[2], Math.pow(j / (n - 1), 0.8)), f * fl[0]);
        out.push(c);
      }
      pal.setRamp(nm, out);
    }
    out = []; base = BASE.glowd;                                           // the charge in the rock: breathes, and surges when lightning grounds
    var kg = clamp01(0.42 + 0.14 * breathe + 0.95 * pl);
    for (j = 0; j < base.length; j++) { c = base[j].slice(); var kj = j >= 4 ? clamp01(kg * 1.25) : kg; out.push([c[0] * kj, c[1] * kj, c[2] * kj]); }
    pal.setRamp("glowd", out);
    pal.setRamp("bolt", ST.warm ? [[255, 172, 92], [255, 226, 170], [255, 250, 232]] : [[126, 146, 255], [214, 226, 255], [255, 255, 255]]);
  };

  // ---------- the bolt ----------
  function makeBolt(S, G, endY) {
    var rnd = PX.rng(ST.sSeed ^ 0x2f1), w = S.w, x = Math.round(ST.sX * w), y0 = Math.round(G.hy * (0.03 + 0.09 * rnd())), a = G.a;
    var pts = [], chan = new Int16Array(Math.max(1, endY - y0 + 2)), y = y0, cx = x, forks = [], i;
    var amp = Math.max(6, Math.round(12 * a));
    while (y < endY) {
      var seg = 3 + Math.floor(rnd() * 6), nx = cx + Math.round((rnd() - 0.5) * amp);
      if (rnd() < 0.14) nx += Math.round((rnd() - 0.5) * amp * 1.6);
      for (var s2 = 0; s2 < seg && y + s2 < endY; s2++) {
        var bx = Math.round(lerp(cx, nx, (s2 + 1) / seg)); pts.push(bx, y + s2, y < y0 + (endY - y0) * 0.78 ? 2 : 1); chan[y + s2 - y0] = bx;
      }
      if (rnd() < 0.26 && y > y0 + 5) forks.push([nx, y + seg, rnd() < 0.5 ? -1 : 1, Math.round((8 + Math.floor(rnd() * 28)) * a)]);
      cx = nx; y += seg;
    }
    for (i = 0; i < forks.length; i++) {
      var fx = forks[i][0], fy = forks[i][1], dx = forks[i][2], len = forks[i][3];
      for (var q = 0; q < len && fy < endY; q++) { if (rnd() < 0.62) fx += dx; if (rnd() < 0.3) fx -= dx; fy += 1; if (rnd() < 0.18) fy += 1; pts.push(fx, fy, 0); }
    }
    for (var fe = 0; fe < 3; fe++) {                                       // feelers crawling sideways under the cloud base
      var ex = x + Math.round((rnd() - 0.5) * 6), ey = y0 + fe * 2, ed = rnd() < 0.5 ? -1 : 1, el = Math.round((8 + rnd() * 16) * a);
      for (q = 0; q < el; q++) { ex += ed; if (rnd() < 0.3) ey++; pts.push(ex, ey, 0); }
    }
    return { pts: new Int16Array(pts), chan: chan, y0: y0, endY: endY, endX: cx };
  }
  function boltState(S) {                                                  // 0 none, 1 dim, 2 full, 3 afterglow (with fade in ST.bfade)
    if (ST.sheet) return 0;
    var a = S.tSec - ST.sStart;
    if (ST.hold != null) { ST.bfade = 1; return ST.hold > 0.05 ? 2 : 0; }
    if (S.reduced) { if (S.gameState === "title") { ST.bfade = 1; return 2; } return 0; }
    if (a < 0 || a > 1.0) return 0;
    if (a < 0.06) return 2;
    if (a < 0.13) return 1;
    if (a < 0.31) return 2;
    ST.bfade = 1 - (a - 0.31) / 0.69; return 3;
  }
  function drawBolt(fb, S, G, endY) {
    var st = boltState(S); if (!st) return;
    var key = ST.sSeed + ":" + S.w + "x" + S.h + ":" + endY;
    if (ST.boltKey !== key || !ST.bolt) { ST.bolt = makeBolt(S, G, endY); ST.boltKey = key; }
    var B = ST.bolt, p = B.pts, w = fb.w, h = fb.h, d = fb.d, i, x, y, thumb = S.reduced && S.gameState === "title", fat = thumb ? Math.max(2, Math.round(w / 110)) : 0;
    var gw = Math.round(24 * G.a * (thumb ? 1.3 : 1)), amt = st === 2 ? 0.95 : st === 1 ? 0.25 : 0.55 * ST.bfade;
    // light the cloud belly and ridge around the channel (dithered lift of whatever is behind it)
    for (y = Math.max(0, B.y0); y < Math.min(h, B.endY); y++) {
      var cxr = B.chan[y - B.y0]; if (!cxr) continue;
      var vfade = 1 - 0.55 * (y - B.y0) / Math.max(1, B.endY - B.y0), row = y * w, ob = (y & 3) << 2;
      for (x = Math.max(0, cxr - gw); x <= Math.min(w - 1, cxr + gw); x++) {
        var q = (1 - Math.abs(x - cxr) / gw) * amt * vfade; if (q <= 0) continue;
        if (BP[ob | (x & 3)] < q) { var o = row + x; d[o] = LIFT[d[o]]; if (BP[ob | (x & 3)] < q - 0.5) d[o] = LIFT[d[o]]; }
      }
    }
    if (st === 3) {                                                        // afterglow: an ionised ghost of the channel, dissolving in ordered dither
      var dens = 0.62 * ST.bfade;
      for (i = 0; i < p.length; i += 3) { if (p[i + 2] === 0) continue; x = p[i]; y = p[i + 1]; if (x < 0 || y < 0 || x >= w || y >= h) continue; if (BP[((y & 3) << 2) | (x & 3)] < dens) d[y * w + x] = I.bolt; }
      return;
    }
    if (st === 1) { for (i = 0; i < p.length; i += 3) { if (p[i + 2] !== 2) continue; x = p[i]; y = p[i + 1]; if (x >= 0 && y >= 0 && x < w && y < h && ((y + x) & 1)) d[y * w + x] = I.bolt; } return; }
    for (i = 0; i < p.length; i += 3) {                                    // halo first, then the core on top
      x = p[i]; y = p[i + 1]; if (y < 0 || y >= h) continue;
      var kd = p[i + 2];
      if (kd === 0) continue;
      for (var hx = -1 - fat; hx <= 1 + fat + (kd === 2 ? 1 : 0); hx++) { var px = x + hx; if (px >= 0 && px < w && (kd === 2 || ((y + hx) & 1) === 0 || fat)) d[y * w + px] = I.bolt; }
    }
    for (i = 0; i < p.length; i += 3) {
      x = p[i]; y = p[i + 1]; if (y < 0 || y >= h) continue;
      var k2 = p[i + 2];
      if (k2 === 0) { if (x >= 0 && x < w) d[y * w + x] = ((x + y) & 3) === 0 ? I.bolt + 1 : I.bolt + 2; continue; }
      for (var cx2 = 0; cx2 < 1 + fat + (k2 === 2 ? 1 : 0); cx2++) { var pxx = x + cx2 - (fat >> 1); if (pxx >= 0 && pxx < w) d[y * w + pxx] = I.bolt + 2; }
    }
    // impact: a burst of dithered light and a few sparks where the channel meets the rock
    var ix = B.endX, iy = B.endY, rr = Math.round(4 * G.a * (thumb ? 1.8 : 1));
    for (y = -rr; y <= rr; y++) for (x = -rr * 2; x <= rr * 2; x++) {
      var e = (x * x) / (4 * rr * rr) + (y * y) / (rr * rr); if (e > 1) continue;
      var px2 = ix + x, py2 = iy + y; if (px2 < 0 || py2 < 0 || px2 >= w || py2 >= h) continue;
      if (py2 <= iy + 1 && BP[((py2 & 3) << 2) | (px2 & 3)] < (1 - e) * 1.2) d[py2 * w + px2] = e < 0.22 ? I.bolt + 2 : (e < 0.6 ? I.bolt + 1 : I.bolt);
    }
  }
  // soft sheet lightning / heat flicker: a dithered lift over an ellipse of whatever is behind it (stays inside the palette)
  function illum(fb, cx, cy, rx, ry, amt) {
    if (amt <= 0.02) return;
    var w = fb.w, h = fb.h, d = fb.d, x, y;
    for (y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(h - 1, Math.ceil(cy + ry)); y++) {
      var ey = (y - cy) / ry, ob = (y & 3) << 2, row = y * w;
      for (x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(w - 1, Math.ceil(cx + rx)); x++) {
        var ex = (x - cx) / rx, q = (1 - Math.sqrt(ex * ex + ey * ey)) * amt; if (q <= 0) continue;
        var th = BP[ob | (x & 3)]; if (th < q * 1.3) { var o = row + x; d[o] = LIFT[d[o]]; if (th < (q - 0.5) * 1.6) d[o] = LIFT[d[o]]; }
      }
    }
  }

  // ---------- rain ----------
  function makeRain(S) {
    var A = clamp(S.w * S.h / 144000, 0.4, 3), n = [Math.round(420 * A), Math.round(330 * A), Math.round(120 * A), Math.round(560 * A)], tot = n[0] + n[1] + n[2] + n[3], i;
    var F = { n: n, rx: new Float32Array(tot), ry: new Float32Array(tot), rv: new Float32Array(tot), rl: new Float32Array(tot) };
    for (i = 0; i < tot; i++) { F.rx[i] = h1(i * 3 + 11); F.ry[i] = h1(i * 5 + 17); F.rv[i] = 0.85 + 0.3 * h1(i * 7 + 23); F.rl[i] = h1(i * 11 + 29); }
    return F;
  }
  function advance(S) {                                                    // integrate slant + cloud drift once per frame (smooth under gusts)
    var G = ST.G, W = ST.WS, dt = W.t < 0 || S.reduced ? 0 : clamp(S.tSec - W.t, 0, 0.1); W.t = S.tSec;
    G.slant = 0.26 + 0.56 * G.wind;
    W.ss += G.slant * dt; W.cp += (0.55 + 1.0 * G.wind) * dt;
  }
  // rain streak pixel: raises the pixel to a pale tone of its own ramp (dark backdrops) or darkens it (bright ones); layer 0 far .. 2 near
  function rainPx(d, o, layer) {
    var v = d[o];
    if (v >= 200) { d[o] = I.wet + 1; return; }
    d[o] = LUM[v] > 0.5 ? RDN[layer][v] : RUP[layer][v];
  }
  function drawRain(fb, S, layer, clip) {
    var F = ST.rain, G = ST.G, w = fb.w, h = fb.h, d = fb.d, a = G.a, t = S.reduced ? 0 : S.tSec, W = ST.WS, slant = G.slant;
    var base = layer === 0 ? 0 : layer === 1 ? F.n[0] : layer === 2 ? F.n[0] + F.n[1] : F.n[0] + F.n[1] + F.n[2], cnt = Math.round(F.n[layer] * (0.34 + 0.66 * G.I) * (layer === 3 ? G.I : 1));
    var v0 = [120, 215, 340, 270][layer] * a, len0 = [4, 7, 12, 3][layer] * a, steps = [1, 1, 2][layer], cyc = h + 40, span = w + 120 + Math.round(h * slant), lip = S.lip, sb = ST.sbPx || 30;
    for (var i = 0; i < cnt; i++) {
      var j = base + i, v = v0 * F.rv[j], yy = (F.ry[j] * cyc + t * v) % cyc - 20, xx = ((F.rx[j] * span - v * W.ss * 0.9) % span + span) % span - 60;
      var len = Math.max(2, Math.round(len0 * (0.7 + 0.6 * F.rl[j]))), hx = Math.round(xx), hy = Math.round(yy), land = 1e9;
      if (clip) { var cxl = clamp(hx, 0, w - 1); land = lip[cxl] + Math.round((0.08 + 0.9 * F.rl[(j * 7) % F.rl.length]) * sb); }
      if (hy >= land) {                                                    // it has landed: a little crown of spray for a moment
        if (layer === 3) continue;
        var ph = (hy - land) / v; if (ph > 0.26 || hx < 1 || hx >= w - 1 || land >= h) continue;
        var o0 = land * w + hx;
        if (ph < 0.09) { d[o0] = I.wet + 1; }
        else if (ph < 0.18) { if (land > 0) d[o0 - w] = I.wet + 1; d[o0 - 1] = I.wet; d[o0 + 1] = I.wet; }
        else { if (land > 1) { d[o0 - w - 1] = I.wet; d[o0 - w + 1] = I.wet; } }
        continue;
      }
      for (var k = 0; k < len; k++) {
        var px = Math.round(hx + slant * k), py = hy - k; if (px < 0 || px >= w || py < 0 || py >= h || py >= land) continue;
        if (k > 1 && BP[((py & 3) << 2) | (px & 3)] > 1.15 - k / len) continue;                 // the tail fades out in dither
        if (layer === 0 && BP[((py & 3) << 2) | (px & 3)] > 0.7) continue;
        if (layer === 3 && BP[((py & 3) << 2) | (px & 3)] > 0.55) continue;
        rainPx(d, py * w + px, layer === 3 ? 1 : layer);
        if (layer === 2 && (j & 3) === 0 && k < len - 2 && px + 1 < w) rainPx(d, py * w + px + 1, 1);
      }
    }
  }

  // a distant fork of lightning over the far ridge: thin, brief, silent; it shows on the bright beats of a flicker
  function farBolt(fb, S, G, endY) {
    var f = ST.flick; if (!f || !f.bolt || ST.fl < 0.45 || S.reduced) return;
    var rnd = PX.rng(f.seed), w = fb.w, h = fb.h, d = fb.d, x = Math.round(f.x * w), y = Math.round(G.hy * (0.30 + 0.12 * rnd())), s2, bx;
    while (y < endY) {
      var seg = 2 + Math.floor(rnd() * 5), nx = x + Math.round((rnd() - 0.5) * 8 * G.a);
      for (s2 = 0; s2 < seg && y + s2 < endY; s2++) {
        bx = Math.round(lerp(x, nx, (s2 + 1) / seg)); var yy = y + s2; if (yy < 0 || yy >= h || bx < 1 || bx >= w - 1) continue;
        d[yy * w + bx] = I.bolt + 2;
        if (((yy + bx) & 1) === 0) { d[yy * w + bx - 1] = I.bolt; d[yy * w + bx + 1] = I.bolt; }
      }
      x = nx; y += seg;
    }
  }

  // ---------- backdrop ----------
  function mod(a, n) { return ((a % n) + n) % n; }
  // curtains of rain hanging under the cloud belly over the ridges: slanted streak texture, bell-shaped across, fading at both ends
  function curtains(fb, S, hy, cp) {
    var w = fb.w, d = fb.d, G = ST.G, slant = G.slant, a = G.a, n = 5, c, x, y;
    for (c = 0; c < n; c++) {
      var hw = Math.round(w * (0.07 + 0.07 * h1(c * 9 + 4))), top = Math.round(hy * (0.30 + 0.2 * h1(c * 11 + 2))), bot = hy + 4, amp = (0.3 + 0.62 * G.I) * (0.5 + 0.5 * h1(c * 13 + 1));
      var cxb = mod(w * (0.06 + 0.24 * c + 0.1 * h1(c * 5 + 1)) - cp * 2.6 * (0.6 + 0.8 * h1(c * 7 + 3)) - S.altitude * 0.03, w + 2 * hw + 40) - hw - 20;
      for (y = Math.max(0, top); y < Math.min(fb.h, bot); y++) {
        var fy = (y - top) / (bot - top), prof = Math.pow(Math.sin(Math.PI * Math.pow(fy, 0.75)), 0.7), sh = Math.round(slant * (y - top) * 0.9), row = y * w, ob = (y & 3) << 2;
        for (x = Math.max(0, Math.round(cxb - sh - hw)); x < Math.min(w, Math.round(cxb - sh + hw)); x++) {
          var xr = x + sh, q = (1 - Math.abs(xr - cxb) / hw) * prof * amp; if (q <= 0.02) continue;
          var hh = h2(xr * 3 + c, 17), ph = ((y >> 1) + Math.floor(hh * 9)) & 3;
          if (hh > q * 1.1 || ph > 1 || BP[ob | (x & 3)] > q * 1.6 + 0.2) continue;
          var o = row + x, v = d[o]; d[o] = LUM[v] > 0.5 ? DARK[v] : LIFT[v];
        }
      }
    }
  }

  R.backdrop = function (fb, S, pal) {
    buildScene(S);
    var G = geom(S); advance(S);
    var w = fb.w, h = fb.h, hy = G.hy, al = S.altitude, a = G.a, cp = ST.WS.cp, i, rw, lipMax = 0, lx;
    for (lx = 0; lx < w; lx++) if (S.lip[lx] > lipMax) lipMax = S.lip[lx];
    var bot = Math.min(h, lipMax + 4);                                      // the ground covers everything below the lip: the fills need not go deeper
    var skey = w + "x" + h + "|" + hy;
    if (ST.skyKey !== skey || !ST.sky || ST.sky.length !== w * h) {
      skyBake(fb, S, hy);
      if (!ST.sky || ST.sky.length !== w * h) ST.sky = new Uint8Array(w * h);
      ST.sky.set(fb.d); ST.skyKey = skey;
    } else fb.d.set(ST.sky);
    var tw = ST.tower, tspan = w + tw.w, tx = mod(Math.round(w * 0.80 - al * 0.04 - cp * 0.55), tspan) - tw.w, layer, bk;
    for (layer = 0; layer < 5; layer++) {
      if (layer === 3) {                                                    // the thunderhead stands in front of the three farthest banks, its anvil tucked under the heavy overhead ones
        blitSprite(fb, tw, tx, hy - tw.h + Math.round(hy * 0.02));
        if (ST.fl > 0.02) illum(fb, tx + tw.w * 0.45, hy - tw.h * 0.48, tw.w * 0.34, tw.h * 0.44, ST.fl);
      }
      for (i = 0; i < ST.banks.length; i++) {
        bk = ST.banks[i]; if (bk.layer !== layer) continue;
        var span = w + bk.st.w + 60, bx = mod(bk.x0 * span - cp * bk.v - al * bk.par, span) - bk.st.w;
        blitSprite(fb, bk.st, Math.round(bx), Math.round(hy * bk.yb - bk.st.floorY));
      }
    }
    if (ST.sheet && ST.flash > 0.03) illum(fb, ST.sX * w, hy * 0.40, w * 0.42, hy * 0.36, ST.flash * 1.5);
    if (ST.fl > 0.02 && ST.flick) illum(fb, ST.flick.x * w, ST.flick.y * hy, ST.flick.r * w, ST.flick.r * w * 0.5, ST.fl * 0.9);
    var thumb = S.reduced && S.gameState === "title";
    function scud(tier) {
      for (var j = 0; j < ST.scud.length; j++) {
        var sc = ST.scud[j]; if (sc.tier !== tier) continue;
        var span = w + sc.st.w + 60, sx = mod(sc.x - cp * sc.v * (0.8 + 0.6 * tier) - al * 0.18, span) - sc.st.w;
        blitSprite(fb, sc.st, Math.round(sx), Math.round(hy * sc.y) - (tier === 0 ? Math.round(hy * 0.2) : 0));
      }
    }
    scud(0);
    curtains(fb, S, hy, cp);
    var oxF = Math.floor(al * 0.07 + 130), yF = hy + 3 - ST.far.h;
    Sc.blitStrip(fb, ST.far, oxF, yF);
    mist(fb, hy - 4, 3, bot, I.far + 1, I.far + 2, cp * 1.2);
    if (ST.flick && ST.flick.bolt) farBolt(fb, S, G, yF + ST.far.top[mod(clamp(Math.round(ST.flick.x * w), 0, w - 1) + oxF, ST.far.w)]);
    var boltFar = (ST.sSeed & 4) === 0, bx = clamp(Math.round(ST.sX * w), 0, w - 1);
    if (boltFar && (ST.hold != null || S.tSec - ST.sStart < 1.05 || thumb)) drawBolt(fb, S, G, yF + ST.far.top[mod(bx + oxF, ST.far.w)]);
    var oxM = Math.floor(al * 0.15 + 240), yM = hy + 10 - ST.mid.h;
    Sc.blitStrip(fb, ST.mid, oxM, yM);
    if (!boltFar && (ST.hold != null || S.tSec - ST.sStart < 1.05 || thumb)) drawBolt(fb, S, G, yM + ST.mid.top[mod(bx + oxM, ST.mid.w)]);
    mist(fb, hy + 7, 3, bot, I.mid + 1, I.mid + 2, cp * 1.6 + 60);
    scud(1);
    drawRain(fb, S, 0, false);
    Sc.blitStrip(fb, ST.near, al * 0.32 + 500, hy + 22 - ST.near.h);
    mist(fb, hy + 20, 4, bot, I.near, I.near + 1, cp * 2.2 + 140);
    scud(2);
  };

  // ---------- props above the lip and stamps in the rock ----------
  function sxOf(S, wx) { return Math.round(S.ztx + (wx - S.scroll) * S.zoom); }
  function cellsOf(S, cw, pad) { var wl = (0 - S.ztx) / S.zoom + S.scroll - pad, wr = (S.w - S.ztx) / S.zoom + S.scroll + pad; return [Math.floor(wl / cw), Math.ceil(wr / cw)]; }
  function putU(fb, S, x, y, idx, m) {                                        // only below the crest (+ a margin), so nothing pokes through the surface
    if (x < 0 || x >= fb.w || y < 0 || y >= fb.h) return;
    if (y < S.lip[x] + (m == null ? 3 : m)) return;
    fb.d[y * fb.w + x] = idx;
  }
  // a rounded rock resting on the crest, lit from the upper left, wet glints, a dark base; optional moss cap
  function rockAt(fb, S, cx, base, r, seed, moss) {
    var RK = I.rock, rw = Math.round(r * (1.15 + 0.5 * h2(seed, 3))), rh = Math.round(r * (0.72 + 0.4 * h2(seed, 4))), x, y;
    for (y = -rh; y <= 1; y++) for (x = -rw; x <= rw; x++) {
      var ex = x / rw, ey = y / rh, q = ex * ex + ey * ey * (y < 0 ? 1 : 3) + 0.12 * (jag(x + seed * 7, 3, seed) ), px = cx + x, py = base + y;
      if (q > 1) continue;
      var lit = -(ex * 0.62 + ey * 0.78), tone;
      if (q > 0.8 && lit < 0.15) tone = 1;                                     // dark rim toward the shade
      else tone = lit > 0.62 ? 6 : lit > 0.28 ? 5 : lit > -0.15 ? 4 : lit > -0.55 ? 3 : 2;
      tone += (BP[((py & 3) << 2) | (px & 3)] - 0.5 > 0.3 ? -1 : 0) * (tone > 2 ? 1 : 0);
      var c = RK + clamp(tone, 1, 6);
      if (moss && y < -rh * 0.45 && lit > -0.3 && h2(px, py + seed) > 0.25) c = I.moss + (lit > 0.4 ? 4 : lit > 0 ? 3 : 2);
      if (y === 1 || (y === 0 && ex * ex > 0.5)) c = RK;                        // contact shadow
      fb.set(px, py, c);
    }
    if (h2(seed, 9) > 0.4) { fb.set(cx - Math.round(rw * 0.35), base - Math.round(rh * 0.72), I.wet + 1); fb.set(cx - Math.round(rw * 0.3), base - Math.round(rh * 0.72), I.wet); }
  }
  // a wind-flagged pine: a bare curving trunk, boughs streaming to the left (downwind), stubs on the windward side, needles as short strokes
  function flagPine(fb, bx, by, h, seed, sway) {
    if (h < 6) return;
    var rnd = PX.rng(seed | 0), N = I.rock, x, y, i, k, lean = -(0.10 + 0.14 * rnd()), tx = function (t) { return bx + Math.round(lean * t + Math.sin(t * 0.09 + seed) * 1.2 - sway * (t / h) * (t / h) * 2); };
    for (i = 0; i <= h; i++) { var xx = tx(i), yy = by - i; fb.set(xx, yy, N + 1); fb.set(xx + 1, yy, N); if (i < h * 0.6) fb.set(xx - 1, yy, N + 1); if (i > 2 && i < h * 0.8 && i % 2 === 0) fb.set(xx - 1, yy, I.near + 3); }
    var step = Math.max(3, Math.round(h / 13));
    for (i = Math.round(h * 0.18); i < h - 1; i += step) {
      var t = i / h, bxp = tx(i), byp = by - i, len = Math.max(3, Math.round(h * (0.16 + 0.26 * (1 - t * 0.6)) * (0.6 + 0.8 * rnd()))), droop = 0.06 + 0.1 * rnd();
      for (k = 1; k <= len; k++) {                                            // the leeward bough
        var px = bxp - k, py2 = byp + Math.round(k * droop) - (k < 3 ? 1 : 0) - sway * (k / len) * 0.6 * 0;
        fb.set(px, py2, N + 1);
        if (k > 2 && (k & 1) === 0) { fb.set(px, py2 + 1, N + 1); if (k > len * 0.5) fb.set(px - 1, py2 + 2, N); }
        if (k > 1 && (k % 3) === 0) fb.set(px, py2 - 1, I.near + 4);                 // rim light on the upper needles
      }
      var ws = 1 + Math.floor(rnd() * 3); for (k = 1; k <= ws; k++) fb.set(bxp + k, byp - 1 + (k > 1 ? 1 : 0), N + 1);   // windward stubs
    }
    fb.set(tx(h), by - h - 1, I.near + 4); fb.set(tx(h) - 1, by - h, N + 1);
  }
  // wind-bent grass tuft on the crest
  function tuft(fb, S, bx, by, hgt, seed, lean, tone) {
    var M = I.moss, n = 3 + Math.floor(h2(seed, 5) * 3), s, k;
    for (s = 0; s < n; s++) {
      var x0 = bx + (s - (n >> 1)) + (s & 1), hh = Math.max(2, Math.round(hgt * (0.55 + 0.45 * h2(seed, s + 7)))), dir = (s - (n - 1) / 2) * 0.3;
      for (k = 0; k < hh; k++) {
        var f = k / hh, xx = x0 + Math.round((dir - lean) * f * f * 2.4), yy = by - k;
        fb.set(xx, yy, k >= hh - 1 ? M + tone + 1 : (f > 0.5 ? M + tone : M + Math.max(1, tone - 1)));
      }
    }
  }


  // the Gate: two weathered standing stones and a lintel across them, wet and lit on the left, mossy on top. The stone is a mid tone so the dark hero reads against it
  function slab(fb, x0, base, wd, ht, seed, lean) {
    var RK = I.rock, y, x;
    for (y = 0; y < ht; y++) {
      var f = y / ht, w0 = wd * (1 - 0.14 * f) + 0.5, jl = Math.round(1.5 * jag(y + seed * 7, 4, seed)), jr = Math.round(1.5 * jag(y + seed * 13, 5, seed + 1));
      var xa = x0 + Math.round(lean * f) + jl, xb = x0 + Math.round(w0) + Math.round(lean * f) + jr;
      for (x = xa; x <= xb; x++) {
        var u = (x - xa) / Math.max(1, xb - xa), bay = BP[(((base - y) & 3) << 2) | (x & 3)] - 0.5, tone = u < 0.2 ? 6.3 : (u < 0.58 ? 5.0 : (u < 0.85 ? 3.4 : 2.2));
        tone += bay * 0.9 - f * 0.5 + (h2(x + seed * 5, y >> 2) > 0.955 ? -1.1 : 0);
        var c = RK + clamp(Math.floor(tone), 1, 6);
        if (u < 0.09 && y % 7 < 4) c = I.wet;                                                         // a wet highlight running down the lit edge
        fb.set(x, base - y, c);
      }
    }
    var tx0 = x0 + Math.round(lean) - 1, tw = Math.round(wd) + 3;
    for (x = tx0; x <= tx0 + tw; x++) { fb.set(x, base - ht, I.moss + 3); fb.set(x, base - ht - 1, h2(x, seed) > 0.4 ? I.moss + 4 : I.moss + 2); if (h2(x, seed + 3) > 0.7) fb.set(x, base - ht - 2, I.moss + 4); }   // moss on the crown
    for (x = tx0 + 1; x < tx0 + tw; x += 2) if (h2(x + seed, 9) > 0.55) { var hl = 2 + Math.floor(h2(x, seed + 5) * 4); for (y = 0; y < hl; y++) fb.set(x, base - ht + 1 + y, I.moss + (y < hl - 1 ? 2 : 3)); }   // moss hanging from the crown
  }
  function gateAt(fb, S, sx, lp, z, seed) {
    var pw = Math.max(5, Math.round(9 * z * 1.3)), gap = Math.round((30 + 8 * h2(seed, 3)) * z * 1.3), ht = Math.round((54 + 22 * h2(seed, 4)) * z * 1.3), ht2 = Math.round(ht * (0.72 + 0.26 * h2(seed, 5))), i, x, y, RK = I.rock;
    var full = h2(seed, 6) > 0.35;
    slab(fb, sx - Math.round(gap / 2) - pw, lp + 1, pw, ht, seed, -1);
    slab(fb, sx + Math.round(gap / 2), lp + 1, pw, ht2, seed + 11, 1);
    var ly0 = lp - ht + Math.round(3 * z), th = Math.max(4, Math.round(8 * z * 1.3)), xa = sx - Math.round(gap / 2) - pw - 2, xb = full ? sx + Math.round(gap / 2) + pw + 1 : sx + Math.round(gap * 0.05);
    for (y = 0; y < th; y++) for (x = xa; x <= xb; x++) {                                             // the lintel: a heavy slab resting on both, broken at one end if it fell
      var u = (x - xa) / Math.max(1, xb - xa), v = y / th, jr = full ? 0 : Math.round(3 * jag(y + seed, 3, seed + 2)) - (v > 0.5 ? 3 : 0);
      if (x > xb + jr) continue;
      var tone = v < 0.25 ? 6 : (v < 0.7 ? 4.6 : 2.6); tone += (BP[(((ly0 + y) & 3) << 2) | (x & 3)] - 0.5) * 0.9 - (u > 0.8 ? 0.6 : 0);
      var c = RK + clamp(Math.floor(tone), 1, 6); if (y === 0) c = I.wet; fb.set(x, ly0 + y, c);
    }
    for (x = xa; x <= xb; x++) if (h2(x, seed + 21) > 0.5) fb.set(x, ly0 - 1, I.moss + 3);
    for (i = 0; i < 5; i++) rockAt(fb, S, sx + Math.round((h2(seed, 30 + i) - 0.5) * gap * 2.4), lp + 1, Math.max(2, Math.round((2 + 3 * h2(seed, 40 + i)) * z * 1.3)), seed * 3 + i, false);   // fallen rubble
  }

  function groundAbove(fb, S, heroX) {
    var w = fb.w, zoom = S.zoom, sc = S.scroll, lipA = S.lip, G = ST.G, u = G.u, i, c, cc, a = G.a;
    var sway = S.reduced ? 0 : (G.wind * 2.4 + 0.5 * Math.sin(S.tSec * 1.7));
    var pineP = 0.5 * (1 - sm((u - 0.45) / 0.4)) + 0.12, rockP = 0.42 + 0.4 * sm((u - 0.3) / 0.5);            // pines thin out and rock takes over as the pass climbs
    cc = cellsOf(S, 1250, 120);
    for (c = cc[0]; c <= cc[1]; c++) {                                          // the Gate, a rare landmark of the pass
      if (h2(c, 601) > 0.55) continue;
      var gx = sxOf(S, c * 1250 + (0.15 + 0.7 * h2(c, 602)) * 1250); if (gx < -80 || gx > w + 80) continue;
      gateAt(fb, S, gx, lipA[clamp(gx, 0, w - 1)], zoom, c * 7 + 3);
    }
    cc = cellsOf(S, 170, 60);
    for (c = cc[0]; c <= cc[1]; c++) {
      var hv = h2(c, 71), sx = sxOf(S, c * 170 + (0.1 + 0.8 * h2(c, 73)) * 170); if (sx < -50 || sx > w + 50 || Math.abs(sx - heroX) < 42 * zoom + 22) continue;
      var lp = lipA[clamp(sx, 0, w - 1)];
      if (hv < pineP) flagPine(fb, sx, lp + 1, Math.round((44 + 44 * h2(c, 75)) * zoom * 1.25), c * 31 + 5, sway);
      else if (hv < pineP + rockP) { var nr = 1 + Math.floor(h2(c, 77) * 3); for (i = 0; i < nr; i++) rockAt(fb, S, sx + i * Math.round(9 * zoom * 1.3) - (nr > 1 ? 6 : 0), lipA[clamp(sx + i * 8, 0, w - 1)] + 1, Math.max(4, Math.round((7 + 12 * h2(c * 5 + i, 79)) * zoom * 1.3)), c * 7 + i, h2(c, 81) > 0.5); }
    }
    cc = cellsOf(S, 7, 8);
    var lean = 1.0 + G.wind * 3.0 + (S.reduced ? 0 : 0.6 * Math.sin(S.tSec * 2.3));
    for (c = cc[0]; c <= cc[1]; c++) {
      var dens = 0.16 + 0.34 * vn(c * 7 * 0.013, 1.7, 3); if (h2(c, 91) > dens) continue;
      var tsx = sxOf(S, c * 7 + h2(c, 92) * 7); if (tsx < 1 || tsx >= w - 1) continue;
      var near = Math.abs(tsx - heroX) < 18 + 22 * zoom, hg = Math.max(2, (2.5 + 5 * h2(c, 93) * h2(c, 94)) * zoom * 1.4 * (near ? 0.5 : 1));
      tuft(fb, S, tsx, lipA[tsx], hg, c, lean + 0.4 * Math.sin(S.tSec * 1.3 + c), 2 + Math.floor(h2(c, 95) * 2));
    }
  }

  // ---------- stamps on the wet surface: puddles that mirror the sky, pebbles, moss ----------
  function puddle(fb, S, cx, cy, A, B, seed, t) {
    var w = fb.w, x, y, SK = I.sky, WT = I.wet, RK = I.rock, ph = S.reduced ? 0.3 : t;
    for (y = -B - 1; y <= B + 1; y++) for (x = -A - 1; x <= A + 1; x++) {
      var e = (x * x) / (A * A) + (y * y) / (B * B) + 0.16 * jag(x + seed * 7, 4, seed), px = cx + x, py = cy + y; if (e > 1) continue;
      var c;
      if (e > 0.8 && y > 0) c = RK + 1;                                        // the dark near lip
      else if (e > 0.8 && y < -B * 0.3) c = WT;                                 // wet far edge catching light
      else {
        var ty = (y + B) / (2 * B + 0.001), bay = BP[((py & 3) << 2) | (px & 3)];
        var band = ty < 0.34 ? 10 : (ty < 0.68 ? 8 : 6);                          // the low sky mirrored in three bands, brightest at the far edge
        if (Math.abs(ty - 0.34) < 0.12 && bay < 0.5) band = 8; else if (Math.abs(ty - 0.68) < 0.12 && bay < 0.5) band = 6;
        c = SK + band;
        if (((py + Math.floor(h2(seed, 5) * 4)) & 3) === 1 && h2(seed + 1, (x + 4000) >> 3) > 0.7) c = I.cloud + 3;   // a mirrored dark cloud edge
      }
      fb.set(px, py, c);
    }
    fb.set(cx - Math.round(A * 0.5), cy - Math.round(B * 0.45), WT + 2); fb.set(cx - Math.round(A * 0.5) + 1, cy - Math.round(B * 0.45), WT + 1);
    for (var q = 0; q < 2; q++) {                                             // rain rings spreading over the water
      var p = ((ph * (0.8 + 0.3 * q) + h2(seed, q + 9)) % 1), rx0 = cx + Math.round((h2(seed, q + 13) - 0.5) * A * 1.2), ry0 = cy + Math.round((h2(seed, q + 15) - 0.5) * B * 0.9);
      var ra = Math.max(1, p * A * 0.45), rb = Math.max(0.6, ra * B / A);
      if (p > 0.85) continue;
      for (var a = 0; a < 20; a++) {
        var an = a / 20 * TAU, qx = rx0 + Math.round(Math.cos(an) * ra), qy = ry0 + Math.round(Math.sin(an) * rb);
        var ee = ((qx - cx) * (qx - cx)) / (A * A) + ((qy - cy) * (qy - cy)) / (B * B); if (ee > 0.7) continue;
        if (p < 0.6 || (a & 1)) fb.set(qx, qy, WT + (p < 0.3 ? 1 : 0));
      }
    }
  }
  function pebble(fb, x, y, r, seed) {
    var RK = I.rock, i, j;
    if (r <= 1) { fb.set(x, y, RK + 5); fb.set(x + 1, y, RK + 3); fb.set(x, y + 1, RK + 1); return; }
    for (j = -r + 1; j <= 0; j++) for (i = -r; i <= r; i++) {
      var e = (i * i) / (r * r) + (j * j) / ((r * 0.62) * (r * 0.62)); if (e > 1.05) continue;
      var lit = -(i * 0.6 + j * 1.2) / r; fb.set(x + i, y + j, RK + (e > 0.75 && lit < 0 ? 1 : (lit > 0.55 ? 6 : lit > 0.1 ? 5 : lit > -0.4 ? 3 : 2)));
    }
    for (i = -r + 1; i <= r; i++) fb.set(x + i, y + 1, RK);
  }
  function mossPatch(fb, S, cx, cy, hw, hh, seed) {
    var M = I.moss, x, y;
    for (y = -hh; y <= 1; y++) for (x = -hw; x <= hw; x++) {
      var e = (x * x) / (hw * hw) + (y * y) / (hh * hh) + 0.25 * jag(x + seed * 9, 3, seed) * 2, px = cx + x, py = cy + y; if (e > 1) continue;
      if (e > 0.72 && BP[((py & 3) << 2) | (px & 3)] < 0.55) continue;                     // ragged, dithered edge
      var lit = -(x / hw * 0.4 + y / hh * 0.9);
      fb.set(px, py, M + clamp(Math.floor(2.4 + lit * 1.5 + (BP[((py & 3) << 2) | (px & 3)] - 0.5) * 1.1 - (e > 0.6 ? 0.8 : 0)), 1, 5));
    }
  }
  function surfaceStamps(fb, S, heroX, sbPx, t) {
    var w = fb.w, zoom = S.zoom, lipA = S.lip, c, q, cc, k;
    cc = cellsOf(S, 170, 60);
    for (c = cc[0]; c <= cc[1]; c++) {                                          // moss first, so puddles and pebbles sit on top
      if (h2(c, 231) > 0.42) continue;
      var mx = sxOf(S, c * 170 + (0.1 + 0.8 * h2(c, 232)) * 170); if (mx < -30 || mx > w + 30 || Math.abs(mx - heroX) < 24 * zoom + 12) continue;
      mossPatch(fb, S, mx, lipA[clamp(mx, 0, w - 1)] + Math.round((0.28 + 0.5 * h2(c, 233)) * sbPx), Math.max(5, Math.round((10 + 16 * h2(c, 234)) * zoom * 1.25)), Math.max(2, Math.round(sbPx * 0.13)), c);
    }
    cc = cellsOf(S, 130, 50);
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 201) > 0.66) continue;
      var np = 1 + (h2(c, 202) > 0.8 ? 1 : 0);
      for (q = 0; q < np; q++) {
        var sx = sxOf(S, c * 130 + (0.1 + 0.8 * h2(c * 3 + q, 203)) * 130); if (sx < -40 || sx > w + 40 || Math.abs(sx - heroX) < 22 * zoom + 12) continue;
        var A = Math.max(5, Math.round((13 + 22 * h2(c * 3 + q, 205)) * zoom * 1.25)), B = Math.max(1, Math.round(A * 0.17)), py = lipA[clamp(sx, 0, w - 1)] + Math.round((0.36 + 0.42 * h2(c * 3 + q, 204)) * sbPx);
        puddle(fb, S, sx, py, A, B, c * 5 + q, t);
      }
    }
    cc = cellsOf(S, 58, 30);
    var tt = S.reduced ? 0 : t, Gi = ST.G;
    for (c = cc[0]; c <= cc[1]; c++) {                                          // rivulets: water racing downhill across the slick rock, a bright head running along a dashed thread
      if (h2(c, 231) > 0.42 - 0.12 * Gi.I) continue;
      var rx0 = sxOf(S, c * 58 + h2(c, 232) * 58); if (rx0 < -30 || rx0 > w + 30 || Math.abs(rx0 - heroX) < 24 * zoom + 12) continue;
      var rL = Math.round((8 + 14 * h2(c, 233)) * zoom * 1.3), ry0 = Math.round((0.14 + 0.78 * h2(c, 234)) * sbPx), head = Math.floor(mod(-tt * (0.7 + 0.5 * Gi.wind) * (0.6 + 0.8 * h2(c, 235)) + h2(c, 236), 1) * rL);
      for (k = 0; k < rL; k++) {
        var rxx = rx0 + k; if (rxx < 1 || rxx >= w - 1) continue;
        var ryy = lipA[rxx] + ry0, dist = (k - head + rL) % rL, cc2 = dist === 0 ? I.wet + 2 : (dist < 3 ? I.wet + 1 : ((k & 1) ? I.wet : 0));
        if (cc2) fb.set(rxx, ryy, cc2);
      }
    }
    cc = cellsOf(S, 24, 8);
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 211) > 0.26) continue;
      var pxs = sxOf(S, c * 24 + h2(c, 212) * 24); if (pxs < 1 || pxs >= w - 2 || Math.abs(pxs - heroX) < 20 * zoom + 8) continue;
      pebble(fb, pxs, lipA[pxs] + Math.round((0.12 + 0.82 * h2(c, 213)) * sbPx), 1 + Math.floor(h2(c, 214) * 2.4 * Math.min(1, zoom * 1.5)), c);
    }
  }

  // ---------- stamps in the rock: cracks, quartz veins, embedded boulders, buried relics, fulgurites, crystals ----------
  var RELICS = [
    { m: { a: 0, b: 2, c: 3, k: 0 }, ramp: "rust", rows: ["...kkkkk...", "..kcbbbck..", ".kcbbbbbck.", ".kcbbbbbbk.", ".kbbkbbkbk.", ".kbbkbbkbk.", ".kbbbbbbbk.", ".kbbkkkbbk.", ".kb.....bk.", ".kk.....kk."] },                       // an iron helm
    { m: { a: 0, b: 2, c: 3, k: 0 }, ramp: "rust", rows: ["....kkk....", "....kck....", "....kkk....", "..kkkbkkk..", "....kbk....", "....kbk....", "....kbk....", "k...kbk...k", "kk..kbk..kk", ".kkkkbkkkk.", "..kkkbkkk..", "....kkk...."] },                          // an anchor
    { m: { a: 0, b: 1, c: 2, k: 0 }, ramp: "bone", rows: ["..kkk....kkk..", ".kccck..kcccck", "kcbbbckkkbbbck", "kcbkkbcccbkkbk", "kcbkbbcccbbkbk", ".kbbbcbbbcbbk.", "..kbcbkkkbcb..", "...kbbbbbbbk..", "....kbkkkbk...", "....kk...kk..."] },                     // a ram's skull, horns curled
    { m: { a: 0, b: 2, c: 3, k: 0 }, ramp: "rust", rows: ["kkkk.......", "kcbbkkkkkkk", "kbbbbbbbbbk", "kcbbkkkkkkk", "kkkk......."] },                                                                        // a broken sword blade
    { m: { a: 0, b: 1, c: 2, k: 0 }, ramp: "quartz", rows: ["..kk......kk..", ".kcck....kcck.", "kcbbck..kcbbck", "kcb.bckkcb.bck", ".kcbbbccbbbck.", "..kkkkccckkk..", "....kcbbbck...", "....kkkkkkk..."] },                        // a glassy fulgurite bloom
    { m: { a: 0, b: 2, c: 3, k: 0 }, ramp: "rust", rows: ["k.kkk.......", "kkcbbk......", ".kcbbkkkk...", "..kkkkcbbk..", ".....kcbbkkk", "......kkkkbk", "..........kk"] }                                     // rusted chain links
  ];
  function drawRelic(fb, S, k, x, y, flip) {
    var r = RELICS[k], base = I[r.ramp], rows = r.rows;
    for (var yy = 0; yy < rows.length; yy++) for (var xx = 0; xx < rows[yy].length; xx++) {
      var ch = rows[yy].charAt(flip ? rows[yy].length - 1 - xx : xx); if (ch === ".") continue;
      putU(fb, S, x + xx, y + yy, ch === "k" ? I.rock + 1 : base + r.m[ch], 6);
    }
  }
  function walker(fb, S, x0, y0, len, dir, drift, seed, col, colLit, branchP, depth) {
    var x = x0, y = y0, rnd = PX.rng(seed | 0), i;
    for (i = 0; i < len; i++) {
      if (rnd() < 0.36) x += rnd() < 0.5 - drift ? -1 : 1;
      y += dir === 0 ? 1 : (rnd() < 0.55 ? 1 : 0); if (dir !== 0) x += dir;
      putU(fb, S, x, y, col, 2); if (colLit != null) putU(fb, S, x - 1, y, colLit, 2);
      if (depth > 0 && rnd() < branchP && i > 6) walker(fb, S, x, y, 6 + Math.floor(rnd() * 10), rnd() < 0.5 ? -1 : 1, drift, (rnd() * 1e6) | 0, col, colLit, branchP * 0.5, depth - 1);
    }
  }
  function deepStamps(fb, S, zd, sbPx, t) {
    var w = fb.w, h = fb.h, zoom = S.zoom, lipA = S.lip, c, cc, k, x, y, GD = I.glowd, SL = I.slate, QZ = I.quartz;
    var pulse = S.reduced ? 0 : 0.5 + 0.5 * Math.sin(t * 2.2);
    function at(wx, du, marginX) { var sx = sxOf(S, wx); if (sx < -marginX || sx > w + marginX) return null; return { x: sx, y: Math.round(lipA[clamp(sx, 0, w - 1)] + du * zd) }; }
    cc = cellsOf(S, 250, 80);                                                    // hairline cracks running down from the surface, chiselled with a lit edge
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 301) > 0.55) continue;
      var p = at(c * 250 + h2(c, 302) * 250, 30 + h2(c, 303) * 30, 40); if (!p || p.y > h + 10) continue;
      walker(fb, S, p.x, p.y, Math.round((50 + 90 * h2(c, 304)) * zd), 0, 0, c * 13 + 1, SL, SL + 5, 0.05, 1);
    }
    cc = cellsOf(S, 200, 100);                                                   // quartz veins: slanting, meandering, with a glint that runs along them
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 311) > 0.46) continue;
      var v = at(c * 200 + h2(c, 312) * 200, (75 + 120 * h2(c, 313)), 100); if (!v || v.y > h + 20) continue;
      var vl = Math.round((40 + 70 * h2(c, 314)) * Math.max(0.6, zd)), dirx = h2(c, 315) < 0.5 ? -1 : 1, vx = v.x, vy = v.y, rnd = PX.rng(c * 7 + 3);
      var slope = 0.35 + 0.6 * h2(c, 316);
      for (k = 0; k < vl; k++) {
        vx += dirx * (rnd() < 0.72 ? 1 : 0); if (rnd() < slope) vy += (rnd() < 0.5 ? 1 : 1) * (rnd() < 0.9 ? 1 : -1);
        var glint = !S.reduced && ((k + Math.floor(t * 16)) % 23) === 0;
        putU(fb, S, vx, vy - 1, SL, 8); putU(fb, S, vx, vy + 1, SL, 8);
        putU(fb, S, vx, vy, glint ? QZ + 3 : (k & 3 ? QZ + 2 : QZ + 1), 8);
      }
    }
    cc = cellsOf(S, 130, 40);                                                    // boulders caught in the rock
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 321) > 0.40) continue;
      var b = at(c * 130 + h2(c, 322) * 130, 50 + 210 * h2(c, 323), 40); if (!b || b.y > h + 14 || b.y < -14) continue;
      var br = Math.max(3, Math.round((5 + 6 * h2(c, 324)) * zd * 1.2)), bw = Math.round(br * 1.3);
      for (y = -br; y <= br; y++) for (x = -bw; x <= bw; x++) {
        var ex = x / 1.3, d2 = ex * ex + y * y; if (d2 > br * br + 0.3 * jag(x + c * 7, 3, c) * br) continue;
        var lit = -(ex * 0.65 + y * 0.75) / br, tone = lit > 0.55 ? 5 : lit > 0.15 ? 4 : lit > -0.35 ? 3 : 2;
        if (d2 > (br - 1) * (br - 1) && lit < 0.2) tone = 0;
        if (y === -br + 1 && lit > 0.3) tone = 5;
        putU(fb, S, b.x + x, b.y + y, SL + Math.min(5, tone), 6);
      }
    }
    cc = cellsOf(S, 260, 40);                                                    // relics of the ones who came before, buried in the beds and cobbles
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 331) > 0.62) continue;
      var rl = at(c * 260 + h2(c, 332) * 260, 70 + 130 * h2(c, 333), 30); if (!rl || rl.y > h + 8 || rl.y < -14) continue;
      drawRelic(fb, S, Math.floor(h2(c, 334) * RELICS.length) % RELICS.length, rl.x, rl.y, h2(c, 335) > 0.5);
    }
    cc = cellsOf(S, 210, 80);                                                    // fulgurites: the glassy roots where lightning grounded, glowing with the charge
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 341) > 0.5) continue;
      var f = at(c * 210 + h2(c, 342) * 210, 12, 60); if (!f) continue;
      var fl = Math.round((50 + 110 * h2(c, 343)) * zd * 1.2), fx = f.x, fy = f.y, rnd2 = PX.rng(c * 11 + 5), stack = [];
      for (k = 0; k < fl; k++) {
        fx += rnd2() < 0.3 ? (rnd2() < 0.5 ? -1 : 1) : 0; fy += 1;
        putU(fb, S, fx - 1, fy, GD + 1, 1); putU(fb, S, fx + 1, fy, GD + 1, 1); putU(fb, S, fx, fy, k % 5 === 0 ? GD + 5 : GD + 4, 1);
        if (k > 8 && rnd2() < 0.07 && stack.length < 3) stack.push([fx, fy, rnd2() < 0.5 ? -1 : 1, 6 + Math.floor(rnd2() * 16)]);
      }
      for (var s2 = 0; s2 < stack.length; s2++) {
        var sx2 = stack[s2][0], sy2 = stack[s2][1], sd = stack[s2][2], sl = stack[s2][3];
        for (k = 0; k < sl; k++) { sx2 += sd * (rnd2() < 0.7 ? 1 : 0); sy2 += rnd2() < 0.6 ? 1 : 0; putU(fb, S, sx2, sy2, k < sl * 0.6 ? GD + 4 : GD + 3, 1); putU(fb, S, sx2, sy2 - 1, GD + 1, 1); }
      }
      var scx = f.x, scy = lipA[clamp(f.x, 0, w - 1)] + Math.round(sbPx * 0.16);                       // the scorched glass rosette at the surface
      if (Math.abs(scx - Math.round(S.ztx + S.anchorX * zoom)) > 20) { for (k = -3; k <= 3; k++) { putU(fb, S, scx + k, scy, QZ + (Math.abs(k) < 2 ? 3 : 1), 0); } putU(fb, S, scx, scy - 1, QZ + 3, 0); putU(fb, S, scx - 2, scy + 1, QZ, 0); putU(fb, S, scx + 2, scy + 1, QZ, 0); }
    }
    cc = cellsOf(S, 130, 60);                                                    // crystal clusters where the charge pools in the deep, each in its own halo
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 351) > 0.36) continue;
      var cr = at(c * 130 + h2(c, 352) * 130, 200 + 320 * h2(c, 353), 50); if (!cr || cr.y > h + 40 || cr.y < -40) continue;
      var nsp = 3 + Math.floor(h2(c, 354) * 3), halo = Math.round(16 * zd * 1.3 + 6);
      for (y = -halo; y <= halo * 0.6; y++) for (x = -halo * 1.4; x <= halo * 1.4; x++) {
        var hq = Math.sqrt((x * x) / 1.96 + y * y * 1.3) / halo; if (hq > 1) continue;
        if (BP[(((cr.y + y) & 3) << 2) | ((cr.x + x) & 3)] < (1 - hq) * 0.85) { var pxh = cr.x + x, pyh = cr.y + y; if (pxh >= 0 && pxh < w && pyh >= 0 && pyh < h && pyh >= lipA[pxh] + 3) { var vv = fb.d[pyh * w + pxh]; if (vv >= SL && vv <= SL + 5) fb.d[pyh * w + pxh] = GD + (hq < 0.45 ? 1 : 0); } }
      }
      for (k = 0; k < nsp; k++) {
        var ang = (k / Math.max(1, nsp - 1) - 0.5) * 1.1 + (h2(c, 355 + k) - 0.5) * 0.25, ln = Math.round((14 + 22 * h2(c, 360 + k)) * Math.max(zd, 0.6) * 1.4), hw = Math.max(2, Math.round((2.8 + 2.6 * h2(c, 365 + k)) * Math.max(0.8, zd * 1.2))), sa = Math.sin(ang), ca = Math.cos(ang), bx = cr.x + Math.round((k - (nsp - 1) / 2) * hw * 1.6);
        for (var tt = 0; tt <= ln; tt++) {
          var half = tt < ln * 0.78 ? hw : Math.max(0, hw * (1 - (tt - ln * 0.78) / (ln * 0.22))), hi = Math.ceil(half);
          for (var ss = -hi; ss <= hi; ss++) {
            var px = Math.round(bx + sa * tt + ca * ss), py = Math.round(cr.y - ca * tt + sa * ss), rel = half > 0 ? ss / (half + 0.01) : 0;
            putU(fb, S, px, py, (tt < 2 || Math.abs(ss) >= hi && rel > 0.8) ? GD + 1 : (tt > ln * 0.86 ? GD + 5 : (rel < -0.3 ? GD + 4 : (rel < 0.45 ? GD + 3 : GD + 2))), 0);
          }
        }
      }
    }
    cc = cellsOf(S, 170, 120);                                                   // hot fault lines: bright cores in a blue halo, meandering down-slope
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 371) > 0.55) continue;
      var hv = at(c * 170 + h2(c, 372) * 170, 260 + 200 * h2(c, 373), 100); if (!hv || hv.y > h + 30) continue;
      var hl = Math.round((50 + 80 * h2(c, 374)) * Math.max(0.7, zd)), hx = hv.x, hy = hv.y, hd = h2(c, 375) < 0.5 ? -1 : 1, rnd3 = PX.rng(c * 17 + 9);
      for (k = 0; k < hl; k++) {
        hx += hd * (rnd3() < 0.6 ? 1 : 0); if (rnd3() < 0.55) hy += 1; if (rnd3() < 0.1) hx -= hd;
        var hot = !S.reduced && ((k + Math.floor(t * 9)) % 13) === 0;
        putU(fb, S, hx, hy - 1, GD + 1, 0); putU(fb, S, hx, hy + 1, GD + 1, 0); putU(fb, S, hx, hy, hot ? GD + 5 : (k & 1 ? GD + 4 : GD + 3), 0);
      }
    }
  }

  // ---------- ground textures: periodic tiles rendered once per depth-scale (Voronoi plates and cobbles, bedding, basalt prisms) ----------
  // The ground samples them by (screen x scrolled with the world, depth below the lip): no per-pixel noise at run time, and every layer can be
  // drawn as carefully as a hand-made tile. They are rebuilt only when the depth scale changes by a visible amount.
  var TP = 512, TM = TP - 1, TEX = { key: "" }, VO = { n1: 0, n2: 0, d1: 0, d2: 0, dx: 0, dy: 0, ex: 0, ey: 0 };
  function depthZoom(S) { var adj = S.adj || 1, z0 = S.zoom / adj; return adj * (0.2 + 0.73 * z0); }
  // periodic jittered-grid Voronoi over a P x Hh tile: fn(x, y, VO) -> palette index. cw x ch = cell size, ky stretches the y metric (flat plates)
  function voro(Hh, cw, ch, ky, seed, fn) {
    var ncx = Math.max(2, Math.round(TP / cw)), cwf = TP / ncx, nry = Math.ceil(Hh / ch) + 4, out = new Uint8Array(TP * Hh), fx = new Float32Array(ncx * nry), fy = new Float32Array(ncx * nry), i, j, x, y, ii, jj;
    for (j = 0; j < nry; j++) for (i = 0; i < ncx; i++) { fx[j * ncx + i] = (i + 0.12 + 0.76 * h2(i * 7 + seed, j * 13 + 1)) * cwf; fy[j * ncx + i] = (j - 1 + 0.12 + 0.76 * h2(i * 11 + seed + 5, j * 17 + 3)) * ch; }
    for (y = 0; y < Hh; y++) {
      var cj = Math.floor(y / ch) + 1;
      for (x = 0; x < TP; x++) {
        var ci = Math.floor(x / cwf), d1 = 1e9, d2 = 1e9, n1 = -1, n2 = -1, f1x = 0, f1y = 0, f2x = 0, f2y = 0;
        for (jj = -1; jj <= 1; jj++) {
          var jn = cj + jj;
          for (ii = -1; ii <= 1; ii++) {
            var inn = ci + ii, wo = 0; if (inn < 0) { inn += ncx; wo = -TP; } else if (inn >= ncx) { inn -= ncx; wo = TP; }
            var idx = jn * ncx + inn, px = fx[idx] + wo, py = fy[idx], ddx = x + 0.5 - px, ddy = (y + 0.5 - py) * ky, dd = ddx * ddx + ddy * ddy;
            if (dd < d1) { d2 = d1; n2 = n1; f2x = f1x; f2y = f1y; d1 = dd; n1 = idx; f1x = px; f1y = py; } else if (dd < d2) { d2 = dd; n2 = idx; f2x = px; f2y = py; }
          }
        }
        VO.n1 = n1; VO.n2 = n2; VO.d1 = Math.sqrt(d1); VO.d2 = Math.sqrt(d2); VO.dx = x + 0.5 - f1x; VO.dy = y + 0.5 - f1y; VO.ex = f2x - f1x; VO.ey = (f2y - f1y);
        out[y * TP + x] = fn(x, y, VO);
      }
    }
    return out;
  }
  function lowf(x) { return 0.55 * Math.sin(TAU * 3 * x / TP + 0.7) + 0.45 * Math.sin(TAU * 5 * x / TP + 2.1); }
  function seamLit(V) { var len = Math.sqrt(V.ex * V.ex + V.ey * V.ey) || 1; return -(V.ex * 0.6 + V.ey * 0.8) / len > 0.15; }   // the neighbour lies up-left: this edge faces the light

  function buildTex(S, zd, sbPx) {
    var RK = I.rock, SL = I.slate, ER = I.earth, RS = I.rust, MS = I.moss, GD = I.glowd, WT = I.wet, QZ = I.quartz, i, j, x, y;
    var T = { zd: zd, sb: sbPx };
    // surface: fractured wet slate plates, bright toward the far edge, seams with a lit upper-left lip
    T.surfRows = sbPx + 5;
    T.surf = voro(T.surfRows, 28, Math.max(3.4, sbPx / 4.6), 3.4, 3, function (x, y, V) {
      var tt = Math.min(1.2, y / sbPx), lv = 5.5 - 3.4 * Math.pow(tt, 0.8), bay = BP[((y & 3) << 2) | (x & 3)] - 0.5;
      if (y === 0) return (h2(x >> 1, 4) > 0.8) ? WT : RK + 6;
      if (V.d2 - V.d1 < 1.5) return seamLit(V) ? RK + clamp(Math.round(lv) + 1, 2, 7) : RK + 1;
      var sh = -(V.dx * 0.6 / 14 + V.dy * 0.8 / 3) * 0.5, tone = lv + (h2(V.n1, 7) - 0.5) * 1.6 + clamp(sh, -0.7, 0.7) + bay * 0.9 + 0.7 * lowf(x) * (1 - tt * 0.5);   // long slicks of wetter and drier rock
      if (V.dy < -0.6 && V.dy > -2.7 && h2(V.n1, 31) > 0.72 && (((x + Math.floor(h2(V.n1, 32) * 9)) % 10) < 2 + Math.floor(h2(V.n1, 33) * 4))) return tt < 0.5 ? WT + 1 : WT;   // sky mirrored in the wet plates
      return RK + clamp(Math.floor(tone), 1, 7);
    });
    // scree: broken gravel, umber with slate chips, lit upper left (bigger, calmer chips)
    T.screeRows = Math.ceil(44 * zd) + 16;
    T.scree = voro(T.screeRows, 12, 6.2, 1.5, 5, function (x, y, V) {
      var bay = BP[((y & 3) << 2) | (x & 3)] - 0.5, dg = y / T.screeRows;
      if (y === 0) return ER + 4;
      if (V.d2 - V.d1 < 1.25) return seamLit(V) ? ER + 4 : ER;
      var slate = h2(V.n1, 21) > 0.55, tone = (slate ? 2.6 : 2.0) + (h2(V.n1, 9) - 0.5) * 1.6 - dg * 0.9 + clamp(-(V.dx * 0.6 + V.dy * 0.8) / 7, -0.7, 0.7) + bay * 0.7;
      return slate ? SL + clamp(Math.floor(tone), 1, 5) : ER + clamp(Math.floor(tone), 0, 4);
    });
    // beds: shale laminae, cross-bedded sandstone, jointed slabs, rust-stained seams; thickness and tone wander along x
    T.bedRows = Math.ceil(82 * zd) + 18;
    T.beds = new Uint8Array(TP * T.bedRows);
    var wob = Sc.periodic(TP, 31), wob2 = Sc.periodic(TP, 47);
    for (x = 0; x < TP; x++) {
      var acc = 0, bi = 0, ib, bh, kind, bt;
      while (acc < T.bedRows + 4) {
        bt = h2(bi * 5 + 3, 51); kind = bt < 0.26 ? 2 : (bt < 0.64 ? 1 : (bt < 0.84 ? 4 : 3));
        bh = Math.max(3, Math.round(((kind === 2 ? 5 : 9) + 8 * h2(bi, 52) + 3 * wob(x + bi * 53)) * zd * 1.15));
        var tone0 = 1.7 + h2(bi, 53) * 1.8 + 0.5 * wob2(x + bi * 29), jw = 22 + Math.floor(h2(bi, 54) * 50);
        for (ib = 0; ib < bh; ib++) {
          y = acc + ib; if (y >= T.bedRows) break;
          var bay = BP[((y & 3) << 2) | (x & 3)] - 0.5, idx;
          if (ib === 0) idx = bi === 0 ? SL + 3 : SL;                                              // the seam
          else if (ib === 1) idx = SL + 4;                                                          // lit upper edge of the bed
          else if (kind === 2) idx = SL + clamp(Math.floor(tone0 + (((y + (x >> 2)) & 3) === 0 ? -0.9 : 0.35) + bay * 0.5), 1, 4);   // shale: fine slanted laminae
          else if (kind === 3) idx = (RS + clamp(Math.floor(1.0 + h2(bi, 55) * 1.2 - ib / bh * 0.8 + bay * 0.7), 0, 3));            // iron-stained bed
          else if (kind === 4) idx = MS + clamp(Math.floor(1.3 + h2(bi, 58) * 1.2 - ib / bh * 0.9 + bay * 0.7 + (((y + (x >> 2)) & 3) === 0 ? -0.7 : 0)), 0, 3);   // mossy green shale
          else {
            var jx = x + bi * 37, blk = Math.floor(jx / jw), fx = jx - blk * jw;
            if (fx === 0) idx = SL;
            else if (fx === 1 && ib < bh * 0.7) idx = SL + 4;
            else idx = SL + clamp(Math.floor(tone0 + (h2(blk, bi + 90) - 0.5) * 1.3 - (ib / bh) * 0.9 + bay * 0.7 + (((y * 2 + x) % 11) === 0 ? 0.6 : 0)), 1, 4);
          }
          if (ib === bh - 1 && kind !== 2 && h2(bi, 57) > 0.55) idx = kind === 3 ? RS + 1 : SL + 1;
          T.beds[y * TP + x] = idx;
        }
        acc += bh; bi++;
      }
    }
    // conglomerate: rounded cobbles of slate, rust, moss-green and pale quartzite packed in dark grit; wet ones glint
    T.cobRows = Math.ceil(78 * zd) + 16;
    var CR = Math.max(3, Math.round(5.2 * zd * 1.25));
    T.cob = voro(T.cobRows, CR * 2.15, CR * 2.15, 1, 7, function (x, y, V) {
      var bay = BP[((y & 3) << 2) | (x & 3)] - 0.5, hs = h2(V.n1, 13), rad = CR * (0.8 + 0.5 * hs), q = V.d1 / rad;
      if (y === 0) return SL;
      if (q >= 1) return ER + clamp(Math.floor(0.9 + h2(x >> 1, y >> 1) * 1.7 + bay * 0.8), 0, 3);   // grit between the stones
      var kind = h2(V.n1, 17), base, lo, hi, b0;
      if (kind < 0.62) { base = SL; b0 = 2.4; lo = 0; hi = 5; } else if (kind < 0.78) { base = RS; b0 = 1.9; lo = 0; hi = 4; } else if (kind < 0.9) { base = MS; b0 = 2.2; lo = 0; hi = 5; } else { base = QZ; b0 = 0.5; lo = 0; hi = 2; }
      var lit = -(V.dx * 0.6 + V.dy * 0.8) / rad, tone = b0 + (h2(V.n1, 19) - 0.5) * 1.4 + (lit > 0.55 ? 1.6 : lit > 0.15 ? 0.8 : lit > -0.35 ? 0 : -0.9) + bay * 0.5;
      if (q > 0.78) tone = lit > 0.25 ? tone + 0.4 : b0 - 1.6;                                     // dark rim on the shaded side, a lit edge on the upper left
      if (lit > 0.82 && q < 0.5 && h2(V.n1, 23) > 0.6) return WT;                                    // wet specular glint
      return base + clamp(Math.floor(tone), lo, hi);
    });
    // basalt: tall prisms; the joints glow with the charge below, a halo bleeds into the dark faces beside them
    T.basRows = Math.ceil(110 * zd) + 18;
    T.bas = new Uint8Array(TP * T.basRows);
    var cwid = Math.max(9, Math.round(24 * zd)), ncol = Math.max(2, Math.round(TP / cwid)), wcol = TP / ncol;
    for (x = 0; x < TP; x++) {
      var c = Math.floor(x / wcol), x0 = Math.round(c * wcol), fxp = x - x0, cwn = Math.round((c + 1) * wcol) - x0;
      var ch2 = Math.max(9, Math.round((28 + h2(c, 41) * 26) * zd)), co = Math.floor(h2(c, 42) * ch2), tone1 = 2.2 + h2(c, 43) * 1.1;
      for (y = 0; y < T.basRows; y++) {
        var gl = y / T.basRows, cy2 = (y + co) % ch2, kk = Math.floor((y + co) / ch2), bay2 = BP[((y & 3) << 2) | (x & 3)] - 0.5, idx2;
        var hotV = gl > 0.16 && h2(c, 99) > 0.5, hotH = gl > 0.18 && h2(c * 13 + kk, 5) > 0.5, hot = (fxp === 0 && cy2 !== 0) ? hotV : hotH;
        if (fxp === 0 || cy2 === 0) idx2 = hot ? GD + (gl > 0.62 ? 3 : (gl > 0.38 ? 2 : 1)) + ((x + y) % 5 === 0 && gl > 0.55 ? 1 : 0) : SL;
        else if (fxp === 1) idx2 = SL + 4;
        else if (fxp >= cwn - 2) idx2 = SL + 1;
        else idx2 = SL + clamp(Math.floor(tone1 - gl * 0.9 + bay2 * 0.7 - (cy2 === 1 ? -0.7 : 0) - (fxp === 2 ? -0.4 : 0)), 1, 4);
        if (idx2 >= SL && idx2 <= SL + 2 && gl > 0.3) {                                              // glow bleeding from a hot joint next door
          var hotL = fxp <= 2 && h2(c, 99) > 0.5, hotR = fxp >= cwn - 3 && h2(c + 1, 99) > 0.5;
          if ((hotL || hotR) && BP[((y & 3) << 2) | (x & 3)] < (gl - 0.3) * 0.9) idx2 = GD + (gl > 0.7 ? 1 : 0);
        }
        T.bas[y * TP + x] = idx2;
      }
    }
    return T;
  }

  var SH = new Int16Array(1024), TOFF = [0, 91, 173, 251, 337], DKK = new Uint8Array(256);

  R.ground = function (fb, S, pal) {
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, sc = S.scroll, lipA = S.lip, G = ST.G, t = S.reduced ? 0 : S.tSec, zd = Math.round(depthZoom(S) * 40) / 40, a = G.a, x, y, o, k;
    var heroX = Math.round(S.ztx + S.anchorX * zoom), slopeK = clamp(S.slope, 0, 0.7), qoff = Math.round(sc * zoom - S.ztx);
    var sbPx = Math.max(10, Math.round(34 * zd)); ST.sbPx = sbPx;
    var key = zd + "|" + sbPx, now = root.performance ? root.performance.now() : 0;
    if (TEX.key !== key || !TEX.t) {
      if (!TEX.t || Math.abs(zd - TEX.t.zd) > 0.14 || now - TEX.tb > 380) { TEX.t = buildTex(S, zd, sbPx); TEX.key = key; TEX.tb = now; }   // a fast zoom (pull-back) keeps the last tile for a moment instead of rebuilding every frame
    }
    var T = TEX.t, SL = I.slate, GD = I.glowd, DK2 = DKK;
    groundAbove(fb, S, heroX);
    var minLip = 0; for (x = 0; x < w; x++) if (lipA[x] < minLip) minLip = lipA[x];
    if (SH.length < h - minLip + 16) SH = new Int16Array(h - minLip + 64);
    for (y = 0; y < SH.length; y++) SH[y] = Math.round(y * slopeK * 0.85);
    for (y = 0; y < 256; y++) DKK[y] = DARK[DARK[y]];
    for (x = 0; x < w; x++) {
      var lip = lipA[x]; if (lip >= h) continue;
      var wxF = (x - S.ztx) / zoom + sc, qx = x + qoff;
      var sw1 = Math.sin(wxF * 0.017 + 1.3), sw2 = Math.sin(wxF * 0.011 + 4.0);
      var b1 = sbPx + ((h2(qx >> 1, 77) > 0.7) ? 1 : 0);
      var b2 = Math.max(b1 + 4, Math.round((66 + 2 * sw1 + 5 * jag(wxF, 23, 11)) * zd));
      var b3 = Math.max(b2 + 8, Math.round((132 + 3 * sw2 + 7 * jag(wxF, 31, 12)) * zd));
      var b4 = Math.max(b3 + 8, Math.round((196 + 3 * sw1 + 8 * jag(wxF, 19, 13)) * zd));
      var b5 = Math.max(b4 + 10, Math.round((290 + 4 * sw2 + 10 * jag(wxF, 29, 14)) * zd));
      var y0 = Math.max(0, lip); o = y0 * w + x;
      for (y = y0; y < h; y++, o += w) {
        var dd = y - lip, r, sx;
        if (dd < b1) { r = dd < T.surfRows ? dd : T.surfRows - 1; sx = (qx - SH[dd]) & TM; d[o] = T.surf[r * TP + sx]; }
        else if (dd < b2) { r = dd - b1; if (r >= T.screeRows) r = T.screeRows - 1; sx = (qx + TOFF[1] - SH[dd]) & TM; d[o] = T.scree[r * TP + sx]; }
        else if (dd < b3) { r = dd - b2; if (r >= T.bedRows) r = T.bedRows - 1; sx = (qx + TOFF[2] - SH[dd]) & TM; d[o] = T.beds[r * TP + sx]; }
        else if (dd < b4) { r = dd - b3; if (r >= T.cobRows) r = T.cobRows - 1; sx = (qx + TOFF[3] - SH[dd]) & TM; d[o] = T.cob[r * TP + sx]; }
        else if (dd < b5) { r = dd - b4; if (r >= T.basRows) r = T.basRows - 1; sx = (qx + TOFF[4] - SH[dd]) & TM; d[o] = T.bas[r * TP + sx]; }
        else {                                                                                          // the deep: the basalt goes on, blacker, its joints hot with the charge
          r = dd - b5; var half = T.basRows >> 1, lenR = T.basRows - half, seg = Math.floor(r / lenR);
          sx = (qx + TOFF[4] + 131 * (seg + 1) - SH[dd]) & TM; var v = T.bas[(half + (r - seg * lenR)) * TP + sx];
          if (v >= SL && v <= SL + 5) { v = DK2[v]; var gd = clamp01(r / (120 * zd)); if (BP[((y & 3) << 2) | (x & 3)] < gd * 0.22) v = GD; }
          d[o] = v;
        }
      }
    }
    surfaceStamps(fb, S, heroX, sbPx, t);
    deepStamps(fb, S, zd, sbPx, t);
  };

  // ---------- front: rain over the ground and the hero ----------
  R.front = function (fb, S, pal) {
    drawRain(fb, S, 3, true);
    drawRain(fb, S, 1, true);
    drawRain(fb, S, 2, true);
  };

  // ---------- QA hooks ----------
  // R.qaStrike()               -> a strike on the next frame
  // R.qaStrike({hold: 0.8})    -> freeze the flash at 0.8 (bolt drawn) until R.qaStrike({clear: true}); {sheet: true} freezes an in-cloud strike (no bolt), {warm: true} a warm one
  // R.qaFlick({x: 0.6})        -> a distant heat-lightning flicker with a silent far bolt, starting just before the next frame
  R.qaStrike = function (o) {
    o = o || {};
    if (o.clear) { ST.hold = null; ST.force = null; ST.sStart = -99; ST.sheet = false; ST.lastT = -1e9; ST.palKey = ""; return "cleared"; }
    if (o.hold != null) { ST.hold = o.hold; ST.sheet = !!o.sheet; if (o.x != null) ST.sX = o.x; ST.warm = !!o.warm; ST.bolt = null; ST.sSeed = (o.seed || 7) | 0; ST.lastT = -1e9; ST.palKey = ""; return "hold"; }
    ST.force = { x: o.x, warm: o.warm, at: o.at }; ST.lastT = -1e9; return "armed";
  };

  R.qaFlick = function (o) { o = o || {}; ST.flick = { t0: o.t0 == null ? 2.98 : o.t0, x: o.x || 0.6, y: o.y || 0.5, r: o.r || 0.25, bolt: true, seed: o.seed || 3 }; ST.fnext = 1e9; ST.lastT = -1e9; return "flick"; };
  V8.register("storm", R);
})(typeof window !== "undefined" ? window : this);
