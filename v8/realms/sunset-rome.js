// Sunset Rome - V8 scene. Golden hour over a calm sea: dithered orange-to-rose sky bands, long clouds with gold undersides,
// a big low sun with banded atmosphere, layered warm haze, islands, an acropolis of small temples on a far cliff, and a sea
// whose sun path glitters (palette-cycled glints). The ground is the shared stone bridge (V8.bridge): a two-tier arcade of
// rose-terracotta brick with travertine trim, great fluted columns and broken entablatures along its edge.
(function (root) {
  "use strict";
  var PX = root.PX, Sc = root.Sc, V8 = root.V8;
  if (!V8.bridge && root.document) {             // the realm test page loads only this file; the game loads _bridge.js first
    try {
      var cs = document.currentScript, base = cs && cs.src ? cs.src.replace(/[^\/]*$/, "") : "../realms/";
      var xr = new XMLHttpRequest(); xr.open("GET", base + "_bridge.js", false); xr.send();
      if (xr.status === 200) (0, eval)(xr.responseText);
    } catch (e) { /* the game always has the kit */ }
  }
  var B = V8.bridge, hex = PX.hex, clamp = PX.clamp, BAY = PX.BAYER4, hh = B.hh;
  var R = { rock: { mat: "warm", style: "granite" } }, I = {}, ST = {}, CL = [], GL = [], MOTES = [], built = "", DK = null, PK = null, TB = null;
  function H(list) { return list.map(hex); }

  R.init = function (pal, S) {
    I.sky = pal.ramp("sky", H(["#35264e", "#452d57", "#57345e", "#6c3c62", "#834564", "#9b4f65", "#b25a65", "#c66764", "#d67863", "#e38b63", "#eda066", "#f4b56c", "#f8c878", "#fbd98a"]));
    I.sun = pal.ramp("sun", H(["#f9c46c", "#fcdc8e", "#ffeeb4", "#fff9e2"]));
    I.cloud = pal.ramp("cloud", H(["#5a3a60", "#7a4666", "#a1566a", "#cf736c", "#f09d72", "#fdd08e"]));
    I.haze = pal.ramp("haze", H(["#6f4a6c", "#845571", "#9a6275", "#b27278", "#c9857c"]));
    I.sea = pal.ramp("sea", H(["#2c2446", "#382a50", "#46325a", "#573c62", "#6b4768", "#80536d", "#986172", "#b37277", "#cf8a7e"]));
    I.glit = pal.ramp("glit", H(["#e8a46a", "#fbd08a", "#fff0c4"]));
    I.cliff = pal.ramp("cliff", H(["#2e1f38", "#3d2640", "#50304a", "#673a52", "#82465a", "#a4585f", "#cc7a66"]));
    I.marb = pal.ramp("marb", H(["#4d3446", "#76505a", "#a47464", "#d5a47a", "#f7d6a2"]));
    I.veg = pal.ramp("veg", H(["#1f1626", "#2c1e2e", "#3d2936", "#57383f"]));
    I.wall = pal.ramp("wall", H(["#2a1519", "#3b1c1f", "#512625", "#69312c", "#823f34", "#9e513e", "#bd6b4e"]));
    I.trim = pal.ramp("trim", H(["#33222a", "#4f3533", "#6f4c41", "#936a53", "#b98a66", "#d8ab7c", "#f6d49c"]));
    I.stat = pal.ramp("stat", H(["#1c1218", "#2b1c21", "#3f2a2c", "#583a36", "#744d40", "#c08858", "#f2c27e"]));
    I.deep = pal.ramp("deep", H(["#170c12"]));
    DK = {
      wall: I.wall, trim: I.trim, ring: I.trim, mortar: I.wall + 1, deep: I.deep,
      A: 280, pier: 68, phase: 190, slab: 12, slabL: 58, frieze: 8, dentil: true, string: 5, course: 9, blockL: 28, minCoursePx: 3.6,
      crown: 26, ringT: 14, nv: 19, tiers: 2, tierGap: 46, band: 16, crown2: 6, light: -1, open: { band: 18 }, face: 12,
      fog: { mode: "mist", idx: I.sea + 3, idx2: I.sea + 4, v0: 280, v1: 760, see: true }
    };
    PK = { ramp: I.trim, statueRamp: I.stat, deep: I.deep, light: -1, seed: 53, pColumn: 0.16, pBroken: 0.16, pStatue: 0.08, pUrn: 0.08, pLintel: 0.2, hMin: 150, hMax: 210, R: 9.5, capital: "doric", statueH: 86, urnH: 32, drum: 28, lintelGap: 100 };
    TB = B.tables(pal); DK.T = TB; PK.T = TB;
    R.birdIdx = I.veg; R.watcherIdx = I.deep;                                    // warm near-black silhouettes against the bright sky and sea
    R.markerIdx = { c0: I.wall + 1, c1: I.trim + 3, c2: I.trim + 5, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };   // cairns in the deck's own stone
    // (the baked scene holds palette INDICES only, keyed by screen size: it stays valid across re-inits, so a revisit costs ~nothing)
    build(S);
  };

  // ---------- headlands: rock masses rising out of the sea (sunlit from the left), temples on the plateau ----------
  // o: { L, H, seed, heads:[{x, w, h, temple:{w,h} | null, small:{w,h} | null}], nc, ch }
  var PROF = [[0, 0], [0.05, 0.1], [0.09, 0.16], [0.13, 0.46], [0.18, 0.58], [0.22, 0.86], [0.27, 0.98], [0.3, 1], [0.7, 1], [0.74, 0.9], [0.8, 0.8], [0.86, 0.6], [0.92, 0.36], [0.97, 0.14], [1, 0]];
  function prof(u) { for (var i = 1; i < PROF.length; i++) if (u <= PROF[i][0]) { var a = PROF[i - 1], b = PROF[i], t = (u - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t; } return 0; }
  function headStrip(o) {
    var L = o.L, Hs = o.H, st = Sc.newStrip(L, Hs), put = B.put, x, y, i, top = new Int16Array(L).fill(Hs), own = new Int8Array(L).fill(-1);
    for (i = 0; i < o.heads.length; i++) {
      var hd = o.heads[i], x0 = Math.round(hd.x - hd.w / 2);
      for (x = x0; x < x0 + hd.w; x++) {
        var u = (x - x0) / hd.w, f = prof(u) + (hh(x >> 2, i * 7) - 0.5) * 0.05 + 0.02 * Math.sin(x * 0.7);
        if (u > 0.28 && u < 0.72) f = 1 + (hh(x >> 3, i) - 0.5) * 0.02;
        var tY = Math.round(Hs - Math.max(0, f) * hd.h), xx = ((x % L) + L) % L;
        if (tY < top[xx]) { top[xx] = tY; own[xx] = i; }
      }
    }
    // facets: irregular vertical slabs, each turned toward the sun, square to us, or away; strata broken per facet
    var fac = new Int16Array(L), fo = [], fx = 0, fi = 0;
    while (fx < L) { var fwd = 6 + Math.floor(hh(fi, 21 + o.seed) * 11); for (var q = 0; q < fwd && fx + q < L; q++) fac[fx + q] = fi; fo.push(hh(fi, 23 + o.seed)); fx += fwd; fi++; }
    for (x = 0; x < L; x++) {
      if (top[x] >= Hs) continue;
      var tl = top[(x - 1 + L) % L], tr = top[(x + 1) % L], f0 = fac[x], ori = fo[f0], sper = 5 + Math.floor(hh(f0, 27) * 3), soff = Math.floor(hh(f0, 25) * 6);
      var hd0 = o.heads[own[x]], uu = hd0 ? (x - (hd0.x - hd0.w / 2)) / hd0.w : 0.5;
      var face = (tl > top[x] + 1) ? 2 : (tr > top[x] + 1 ? -1.5 : 0);   // silhouette turning toward the low sun (left) = lit
      var facetLv = ori < 0.25 ? 0.7 : (ori > 0.8 ? -0.6 : 0), edgeL = x > 0 && fac[x - 1] !== f0;
      for (y = top[x]; y < Hs; y++) {
        var dd = y - top[x], strat = (y + Math.round(x * 0.07) + (hh(x >> 5, 31) * 3 | 0)) % 6, lv;   // strata sweep across the whole cliff
        lv = 2.5 + (dd < 3 ? face : face * 0.3) + facetLv + (0.5 - uu) * 1.5 - dd / (Hs * 0.8) * 1.8 + (PX.vnoise(x * 0.05, y * 0.04, o.seed) - 0.5) * 1.8 + BAY[y & 3][x & 3] * 0.7;
        if (strat === 0 && dd > 2 && hh(x >> 3, y) < 0.85) lv += 0.9; else if (strat === 1 && dd > 2 && hh(x >> 3, y - 1) < 0.85) lv -= 0.7;
        if (edgeL && dd > 4 && ori > 0.7 && hh(f0, y >> 4) < 0.5) lv -= 1.2;                      // a few vertical cracks
        if (dd === 0) lv = face > 0 ? 6 : (face < 0 ? 3 : 5);
        var c = I.cliff + clamp(Math.floor(lv + 0.5), 0, 6);
        if (y >= Hs - 2) c = y === Hs - 2 ? I.sea + 7 : I.cliff;                      // foam line at the waterline
        put(st, x, y, c);
      }
    }
    var rnd = PX.rng(o.seed);
    for (i = 0; i < o.heads.length; i++) {
      var hd2 = o.heads[i], px0 = Math.round(hd2.x - hd2.w / 2);
      // shrubs on the ledges
      for (var n = 0; n < hd2.w * 0.5; n++) { var sx = px0 + Math.floor(rnd() * hd2.w), sxx = ((sx % L) + L) % L, sy = top[sxx] + Math.floor(rnd() * Math.min(40, Hs - top[sxx] - 3)); if (sy >= Hs - 3 || ((sy - top[sxx]) % 6) !== 0) continue; put(st, sx, sy, I.veg + 1); put(st, sx + 1, sy, I.veg + 2); put(st, sx, sy - 1, I.veg + 3); }
      var tcx = px0 + Math.round(hd2.w * 0.5);
      if (hd2.temple) {
        var tw = hd2.temple.w, th = hd2.temple.h, tx = tcx - Math.round(tw * 0.62), ty = Hs - hd2.h;
        for (x = tx - 3; x < tx + tw + 3; x++) for (y = ty; y < ty + 3; y++) put(st, x, y, y === ty ? I.marb + 3 : I.cliff + 4);
        B.temple(st, tx, ty, tw, th, { lit: I.marb + 4, mid: I.marb + 2, dark: I.marb + 1, deep: I.marb, roof: I.marb + 1, glow: 0 }, -1, true);
      }
      if (hd2.small) { var sw = hd2.small.w, tx2 = tcx + Math.round(hd2.w * 0.16), ty2 = Hs - hd2.h; B.temple(st, tx2, ty2, sw, hd2.small.h, { lit: I.marb + 4, mid: I.marb + 2, dark: I.marb + 1, deep: I.marb, roof: I.marb + 1, glow: 0 }, -1, true); }
      for (n = 0; n < o.nc; n++) { var cx = px0 + Math.round(hd2.w * (0.2 + 0.65 * rnd())), cxx = ((cx % L) + L) % L; if (top[cxx] > Hs - hd2.h * 0.8) continue; if (hd2.temple && Math.abs(cx - tcx) < hd2.temple.w * 0.7) continue; B.cypress(st, cx, top[cxx] + 1, 4 + Math.floor(rnd() * o.ch), { dark: I.veg, mid: I.veg + 1, lit: I.veg + 3 }, -1, true); }
    }
    st.top = top;
    return st;
  }

  // distant islands: soft humps on the horizon, sunlit on the left, one with a tiny temple
  function islands(o) {
    var L = o.L, Hs = o.H, st = Sc.newStrip(L, Hs), x, y, i;
    for (i = 0; i < o.list.length; i++) {
      var c = o.list[i], cx = c[0] * L / 1.4 * 1.0, hwd = c[1] * L / 1.4, ht = Math.max(2, Math.round(c[2] * Hs));
      for (x = Math.round(cx - hwd); x <= Math.round(cx + hwd); x++) {
        var u = (x - cx) / hwd, f = Math.pow(Math.max(0, 1 - u * u), 0.8) * (1 + 0.15 * Math.sin(x * 0.5 + i)), tY = Math.round(Hs - f * ht);
        for (y = Math.max(0, tY); y < Hs; y++) B.put(st, x, y, y === tY ? (u < 0 ? I.haze + 4 : I.haze + 2) : (u < -0.3 ? I.haze + 3 : (u < 0.35 ? I.haze + 2 : I.haze + 1)));
      }
      if (i === o.temple) B.temple(st, Math.round(cx - 3), Math.round(Hs - ht) + 1, 7, 5, { lit: I.haze + 4, mid: I.haze + 3, dark: I.haze + 2, deep: I.haze + 1, roof: I.haze + 2, glow: 0 }, -1, true);
    }
    return st;
  }

  // clouds. A streak: long, thin, a gold underside. A bank: a cumulus cluster with a flat base, gold-lit belly, rose body,
  // violet crown and a bright rim on the side toward the low sun (left).
  function cloudLong(seed, w, h, big) {
    var rnd = PX.rng(seed), sp = new PX.Sprite(w, h), x, y, i, lens = [], n;
    if (big) {
      var base = h * 0.82;
      for (i = 0; i < 7 + Math.floor(w / 24); i++) { var r = h * (0.22 + 0.4 * rnd() * (1 - Math.abs(i / (7 + w / 24) - 0.5))); lens.push({ cx: w * (0.1 + 0.8 * rnd()), cy: base - r * 0.7, rx: r * 1.25, ry: r }); }
      lens.push({ cx: w * 0.5, cy: base - h * 0.1, rx: w * 0.46, ry: h * 0.16 });
    } else {
      n = 4 + Math.floor(rnd() * 4);
      for (i = 0; i < n; i++) lens.push({ cx: w * (0.08 + 0.84 * rnd()), cy: h * (0.55 + 0.25 * rnd()), rx: w * (0.12 + 0.22 * rnd()), ry: h * (0.25 + 0.35 * rnd()) });
      for (i = 0; i < 3; i++) lens.push({ cx: w * (0.25 + 0.5 * rnd()), cy: h * (0.4 + 0.2 * rnd()), rx: h * (0.4 + 0.3 * rnd()), ry: h * (0.35 + 0.25 * rnd()) });
    }
    n = lens.length;
    var tops = new Int16Array(w).fill(-1), bots = new Int16Array(w).fill(-1);
    for (x = 0; x < w; x++) for (y = 0; y < h; y++) {
      var ins = false; for (i = 0; i < n && !ins; i++) { var dx = (x + 0.5 - lens[i].cx) / lens[i].rx, dy = (y + 0.5 - lens[i].cy) / lens[i].ry; ins = dx * dx + dy * dy <= 1; }
      if (big && y > h * 0.84) ins = false;
      if (ins) { if (tops[x] < 0) tops[x] = y; bots[x] = y; }
    }
    for (x = 0; x < w; x++) {
      if (tops[x] < 0) continue;
      var lt = x > 0 ? tops[x - 1] : -1;
      for (y = tops[x]; y <= bots[x]; y++) {
        var db = bots[x] - y, dt = y - tops[x], hgt = bots[x] - tops[x] + 1, c;
        if (!big) c = db < 1 ? I.cloud + 5 : (db < 2 ? I.cloud + 4 : (dt < 1 ? I.cloud + 3 : (db < 3 + ((x >> 2) & 1) ? I.cloud + 3 : (dt < 2 ? I.cloud + 2 : I.cloud + 1))));
        else {
          var t = db / Math.max(1, hgt), lv = 1 + (1 - t) * 3.2 + BAY[y & 3][x & 3] * 0.55;
          c = I.cloud + clamp(Math.floor(lv), 0, 4);
          if (db < 1) c = I.cloud + 5;
          if (dt < 1) c = (lt < 0 || lt > y) ? I.cloud + 4 : I.cloud + 2;            // crown edge: a bright rim where it faces the sun
        }
        sp.set(x, y, c);
      }
    }
    return sp;
  }

  function sunPos(S) {
    var hs = seaY(S);
    var a = S.adj || 1;
    return { x: Math.round(S.w * 0.25), y: Math.round(hs - Math.max(10, S.h / a * 0.055) * a), r: Math.round(Math.max(10, Math.min(19, S.h / a * 0.05)) * a) };
  }
  function seaY(S) { return Math.round(S.horizonY - 0.17 * S.h + (1 - S.openingT) * S.h * 0.12); }

  function build(S) {
    var k = S.w + "x" + S.h + "|" + (S.adj || 1); if (built === k) return; built = k;
    var w = S.w, h = S.h, s = Math.max(0.55, Math.min(1, w / (480 * (S.adj || 1)))) * (S.adj || 1), os = Math.min(w / 480, h / 300) * 0.5 + 0.5 * Math.min(1, Math.min(w, h) / 300);
    var hw = Math.round(Math.min(w * 0.42, 200 * os + 20)), hh0 = Math.round(hw * 0.5), aH = hh0 + 40;
    ST.acro = headStrip({ L: Math.round(w * 1.5), H: aH, seed: 17, nc: 5, ch: Math.round(10 * os) + 3,
      heads: [{ x: w * 0.83, w: hw, h: hh0, temple: { w: Math.round(hw * 0.4) | 1, h: Math.round(hw * 0.22) }, small: { w: Math.round(hw * 0.12) + 2, h: Math.round(hw * 0.09) + 2 } },
              { x: w * 1.3, w: Math.round(hw * 0.5), h: Math.round(hh0 * 0.45), temple: { w: Math.round(hw * 0.14) + 2, h: Math.round(hw * 0.1) + 2 }, small: null }] });
    ST.isl = islands({ L: Math.round(w * 1.4), H: Math.round(h * 0.06) + 4, list: [[0.08, 0.07, 0.6], [0.2, 0.04, 0.35], [0.46, 0.09, 0.9], [0.58, 0.03, 0.3], [1.02, 0.08, 0.7], [1.2, 0.05, 0.45]], temple: 2 });
    ST.rocks = headStrip({ L: Math.round(w * 1.2), H: Math.round(h * 0.2), seed: 29, nc: 2, ch: 5,
      heads: [{ x: w * 0.14, w: Math.round(hw * 0.5), h: Math.round(h * 0.1), temple: null, small: null }, { x: w * 0.7, w: Math.round(hw * 0.7), h: Math.round(h * 0.15), temple: null, small: null }] });
    CL = [];
    for (var i = 0; i < 7; i++) {
      var big = i < 2, cw = Math.round((big ? 110 + PX.h1(i * 3 + 1) * 70 : 50 + PX.h1(i * 3 + 1) * 110) * s), ch = Math.round((big ? 20 + PX.h1(i * 5 + 2) * 10 : 5 + PX.h1(i * 5 + 2) * 7) * s) + 3;
      CL.push({ sp: cloudLong(501 + i * 11, cw, ch, big), x: big ? (i === 0 ? w * 0.52 : w * 1.3) : PX.h1(i * 7 + 3) * w * 1.7, y: big ? (i === 0 ? 0.3 : 0.12) : 0.04 + PX.h1(i * 11 + 4) * 0.5, v: big ? 0.35 : 0.5 + PX.h1(i * 13 + 5) * 1.0 });
    }
    // glints of the sun path: short horizontal dashes, denser and wider near the sun's column, each with its own phase
    GL = [];
    var rnd = PX.rng(91), n = Math.round(h * 2.2);
    for (i = 0; i < n; i++) GL.push({ t: Math.pow(rnd(), 0.8), u: (rnd() + rnd() + rnd() - 1.5) / 1.5, len: 1 + Math.floor(rnd() * 4), g: Math.floor(rnd() * 3) });
    MOTES = [];
    for (i = 0; i < 16; i++) MOTES.push({ x: PX.h1(i * 13 + 1), y: PX.h1(i * 17 + 2), sp: 0.5 + PX.h1(i * 19) * 1.2, ph: PX.h1(i * 23) * 6.28 });
  }

  R.light = function (S) { var p = sunPos(S); return { x: p.x, y: p.y, k: 0.82, col: [255, 202, 136], ambient: [150, 96, 116], bright: 0.8, ground: [140, 82, 62] }; };

  // the glints of the sun path sparkle by rotating three colours
  R.palette = function (pal, S) {
    var q = S.reduced ? 0 : Math.floor(S.tSec * 5) % 3, g = [[232, 164, 106], [251, 208, 138], [255, 240, 196]];
    for (var i = 0; i < 3; i++) pal.set(I.glit + i, g[(i + q) % 3]);
  };

  function glowAround(fb, cx, cy, rad, lo, hi, amt) {
    var w = fb.w, h = fb.h, d = fb.d, li1 = TB.light1;
    for (var y = Math.max(0, cy - rad); y < Math.min(h, cy + rad); y++) for (var x = Math.max(0, cx - rad); x < Math.min(w, cx + rad); x++) {
      var dx = x - cx + 0.5, dy = (y - cy + 0.5) * 1.25, q = 1 - Math.sqrt(dx * dx + dy * dy) / rad; if (q <= 0) continue;
      var o = y * w + x, v = d[o]; if (v < lo || v > hi) continue;
      var n = Math.floor(q * amt + BAY[y & 3][x & 3] + 0.5);
      while (n-- > 0 && v < hi) v = li1[v];
      d[o] = v;
    }
  }

  // big low sun: pale core, banded lower half (the thick air near the horizon), dithered rim
  function sun(fb, S) {
    var p = sunPos(S), w = fb.w, h = fb.h, d = fb.d, r = p.r;
    glowAround(fb, p.x, p.y, Math.round(r * 5), I.sky, I.sky + 13, 4.2);
    for (var y = p.y - r - 1; y <= p.y + r + 1; y++) for (var x = p.x - r - 1; x <= p.x + r + 1; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      var dx = x - p.x + 0.5, dy = y - p.y + 0.5, dist = Math.sqrt(dx * dx + dy * dy); if (dist > r + 0.3) continue;
      var o = y * w + x, band = dy > r * 0.2 && (((y - p.y) % 4 + 4) % 4) === 0;
      if (dist > r - 0.8) { if (((x + y) & 1) === 0) d[o] = I.sun; continue; }
      d[o] = band ? I.sun + 1 : (dist < r * 0.55 ? I.sun + 3 : (dist < r * 0.85 ? I.sun + 2 : I.sun + 1));
    }
  }

  R.backdrop = function (fb, S, pal) {
    build(S);
    var w = fb.w, h = fb.h, sh = Math.round((1 - S.openingT) * h * 0.12), al = S.altitude * Math.min(1, w / 480), i, d = fb.d, hs = seaY(S);
    var skyIdx = []; for (i = 0; i < 14; i++) skyIdx.push(I.sky + i);
    Sc.bands(fb, 0, hs, skyIdx, 3);
    // the sea: pale near the horizon, deepening toward us, faint long swells
    var seaIdx = [I.sea + 8, I.sea + 7, I.sea + 6, I.sea + 5, I.sea + 4, I.sea + 3, I.sea + 2, I.sea + 1, I.sea + 1, I.sea];
    Sc.bands(fb, hs, h, seaIdx, 3);
    sun(fb, S);
    for (i = 0; i < CL.length; i++) {
      var c = CL[i], span = w * 1.7 + c.sp.w, cx = ((c.x - S.tSec * c.v * (S.reduced ? 0 : 1) - al * 0.07) % span + span) % span - c.sp.w;
      fb.blit(c.sp, Math.round(cx), Math.round(c.y * (hs - h * 0.1)), 0);
    }
    // swells: long faint lines, longer toward us
    for (var y = hs + 2; y < h; y++) {
      var t = (y - hs) / (h - hs), row = y * w, per = Math.round(18 + t * 60), len = Math.round(3 + t * 26);
      if (((y - hs) % Math.max(2, Math.round(2 + t * 5))) !== 0) continue;
      var off = Math.round(hh(y, 3) * per + al * 0.1 * t);
      for (var x = 0; x < w; x++) { var m = (x + off) % per; if (m < len) { var o = row + x; d[o] = TB.light1[d[o]]; } }
    }
    // islands on the horizon and the acropolis headland (they sit in the sea; their bases melt into haze)
    Sc.blitStrip(fb, ST.isl, al * 0.01 + 40, hs - ST.isl.h + 1);
    Sc.blitStrip(fb, ST.acro, al * 0.035, hs - ST.acro.h + Math.round(h * 0.03));
    // the sun path: glints under the sun, widening toward us
    var sp = sunPos(S);
    for (i = 0; i < GL.length; i++) {
      var q = GL[i], yy = Math.round(hs + 1 + q.t * (h - hs - 1)); if (yy >= h) continue;
      var spread = 3 + q.t * w * 0.2, gx2 = Math.round(sp.x + q.u * spread), ln = Math.max(1, Math.round(q.len * (0.6 + q.t * 1.6)));
      var o2 = yy * w; if (d[o2 + clamp(gx2, 0, w - 1)] > I.sea + 8) continue;
      for (var k = 0; k < ln; k++) { var xx = gx2 + k; if (xx >= 0 && xx < w && d[o2 + xx] >= I.sea && d[o2 + xx] <= I.sea + 8) d[o2 + xx] = I.glit + q.g; }
    }
    // outcrops far below, in the sea under the bridge
    Sc.blitStrip(fb, ST.rocks, al * 0.08 + 90, Math.round(hs + (h - hs) * 0.62));
  };

  R.ground = function (fb, S, pal) {
    B.deck(fb, S, DK);
    B.props(fb, S, DK, PK);
  };

  // golden motes drifting in the low light (kept away from the hero)
  R.front = function (fb, S, pal) {
    if (S.reduced) return;
    var w = fb.w, h = fb.h, d = fb.d, ax = S.ztx + S.anchorX * S.zoom, ay = S.zty + S.anchorY * S.zoom, t = S.tSec, li1 = TB.light1;
    for (var i = 0; i < MOTES.length; i++) {
      var m = MOTES[i], x = Math.round(((m.x * w * 1.3 + t * 6 * m.sp - S.altitude * 0.6) % (w * 1.3) + w * 1.3) % (w * 1.3) - w * 0.15);
      var y = Math.round(h * 0.15 + m.y * h * 0.6 + Math.sin(t * m.sp + m.ph) * 10);
      if (Math.abs(x - ax) < 50 && Math.abs(y - ay) < 60) continue;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      var b = Math.sin(t * 1.6 * m.sp + m.ph * 2); if (b < 0.2) continue;
      var o = y * w + x; d[o] = li1[li1[d[o]]];
    }
  };

  R.thumb = { ratio: 0.8 };                   // realm card: a little more sea and sky above the deck
  V8.register("sunset-rome", R);
})(typeof window !== "undefined" ? window : this);
