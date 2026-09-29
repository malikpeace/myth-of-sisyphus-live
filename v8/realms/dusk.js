// The Dusk - V8 scene. The silhouette realm, built natively on the shared indexed framebuffer.
// A banded, dithered dusk sky with a huge striped sun that sinks as he climbs (dusk -> night -> dusk every 2400 m: the
// whole day/night cycle is PALETTE ANIMATION), layered violet ridges with cypresses, stone pines and a far temple, bird
// flocks, stars and a crescent moon, fireflies after dark - and every 700 m (from 260 m) a noir storm: colour drains to
// grey, the cloud deck rolls in, rain falls in three layers and lightning blows the sky out so the world becomes black
// cut-outs. The ground is black earth with a rim-lit crest; below it lies the underworld: faint violet strata, ghostly
// roots, buried columns, bones and old boulders, and far down the dim embers of Tartarus.
(function (root) {
  "use strict";
  var PX = root.PX, Sc = root.Sc, V8 = root.V8, clamp = PX.clamp, clamp01 = PX.clamp01, B4 = PX.BAYER4, TAU = Math.PI * 2;
  var R = { rock: { mat: "obsidian", style: "granite" }, noShadow: true, noBirds: true, noThunder: true, thumb: { alt: 0, zoom: 0.74, slope: 0.02, ratio: 0.8 } }, I = {};
  var ST = { built: "", skyKey: "", lastT: -1e9, next: 0, sStart: -99, sX: 0.5, sSeed: 1, flash: 0, force: null, hold: null, bolt: null, boltKey: "", G: {}, U: 1 };
  var BP = new Float32Array(16);                                    // Bayer thresholds in (0,1): BP[((y & 3) << 2) | (x & 3)]
  (function () { for (var i = 0; i < 16; i++) BP[i] = B4[i >> 2][i & 3] + 0.5; })();
  var D1 = [0.125, 0.625, 0.375, 0.875];                            // 1-D ordered dither (along a line)

  function smooth(v) { v = v < 0 ? 0 : v > 1 ? 1 : v; return v * v * (3 - 2 * v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function h1(n) { return PX.h1(n); }
  function h2(a, b) { return PX.h2(a, b); }

  // ---------- journey clocks ----------
  // 0 = golden dusk, 1 = deep night; back to dusk every 2400 m.
  function nightAt(m) { var f = ((m / 2400) % 1 + 1) % 1; return smooth(1 - Math.abs(2 * f - 1)); }
  // storms: the first at 260 m, then every 700 m, each ~220 m long with soft 45 m edges
  function stormAt(m) {
    if (m < 260) return 0;
    var l = ((m - 260) % 700 + 700) % 700;
    if (l > 220) return 0;
    return smooth(l / 45) * smooth((220 - l) / 45);
  }

  // ---------- colour keys: [golden dusk, ember sunset, blue hour, night] (ramps dark -> light) ----------
  var K = {
    sky: ["1b1336 241842 311d4d 44235a 5c295e 782f60 96375f b3435c cc5559 e06d57 ef8c58 f8b062",
          "150f2c 1c1237 26163f 331a48 43204e 57244f 6e284e 882c4b a33447 bc4140 d45739 e8773a",
          "0c0b22 110e2b 17123a 1f1642 291a4a 331e51 3f2257 4c275b 5a2c5e 69315f 7a375f 8c3f5e",
          "05040e 080719 0c0a22 100d2a 151031 1a1338 1f163e 251943 2b1c48 321f4c 39224f 412653"],
    sun: ["e0465a ec5f56 f6805a fba462 fec57a ffe5b0",
          "c6324a d8453f e65d3c f07b42 f79a52 fbba6e",
          "9a2a44 ae323f c03e3b cc4c3b d85f3e e07446",
          "9a2a44 ae323f c03e3b cc4c3b d85f3e e07446"],
    cloud: ["2c1942 4a2152 6e2c5e a4435f ec8a64",
            "22133a 3a1846 57204e 88304c d25a44",
            "120e2a 1c1436 281a42 3c2350 5c3264",
            "0a0918 100e22 18132e 241c3c 3a3260"],
    r0: ["a14a6a e8876c", "82305a c65852", "44285a 70406c", "33264f 55497a"],
    r1: ["723060 c85e66", "5a224f a2424f", "311e4a 58345e", "251a42 40366a"],
    r2: ["431a44 94405a", "351538 723046", "1f1233 3c2450", "181030 2e2854"],
    r3: ["1f0d25 5e2642", "190a1e 441c34", "100a1b 261638", "0a0614 1e1c3a"],
    earth: ["07050b 0b0711 140c1e 1e1430 2c1e44 3c2a58", "050409 080610 0f0b1a 18122c 22193c 2e234e"],
    deep: ["130710 1f0a12 2e0f18"],
    rim: ["4e1e2c b4523e ffb36a", "421626 a03c2e f5874a", "24193a 4e3a6a 9282b8", "161a32 3c4a7c a0b0e8"],
    ghost: ["3a2c5a 58467e", "2c3458 44507e"],
    ember: ["4a1410 7a2410 c2461a f28a2e"],
    star: ["8a86b0 c4c0dc fff6ee"],
    moon: ["1a1834 5c5882 b2aed2 dcd8ee f6f4ff"],
    fly: ["3c5a22 b4de5e f2ffc0"],
    rain: ["4c5264 8a92a8 c4cad8"],
    bolt: ["b4aef0 ffffff"],
    cairn: ["07050b 150e1e 2a1c34 ffb36a"]
  };
  var GLOW = [[[249, 174, 106], 0.42], [[244, 124, 76], 0.38], [[194, 92, 92], 0.22], [[138, 106, 160], 0.10]];
  var KP = {};
  (function () {
    for (var name in K) KP[name] = K[name].map(function (s) { return s.split(" ").map(PX.hex); });
  })();
  var OUT = {};
  function outFor(name, n) { if (!OUT[name]) { OUT[name] = []; for (var i = 0; i < n; i++) OUT[name].push([0, 0, 0]); } return OUT[name]; }
  function keyed(name, n) {
    var k = KP[name], m = k.length, cols = k[0].length, out = outFor(name, cols), j;
    if (m === 1) { for (j = 0; j < cols; j++) { out[j][0] = k[0][j][0]; out[j][1] = k[0][j][1]; out[j][2] = k[0][j][2]; } return out; }
    var s = clamp01(n) * (m - 1), i = Math.min(m - 2, Math.floor(s)), f = s - i, A = k[i], B = k[i + 1];
    for (j = 0; j < cols; j++) { out[j][0] = A[j][0] + (B[j][0] - A[j][0]) * f; out[j][1] = A[j][1] + (B[j][1] - A[j][1]) * f; out[j][2] = A[j][2] + (B[j][2] - A[j][2]) * f; }
    return out;
  }
  function glowKey(n) {
    var s = clamp01(n) * 3, i = Math.min(2, Math.floor(s)), f = s - i;
    return { col: mix3(GLOW[i][0], GLOW[i + 1][0], f), amt: lerp(GLOW[i][1], GLOW[i + 1][1], f) };
  }
  // noir: colour drains to a cool grey (in place)
  function grade(c, st) {
    if (st <= 0) return c;
    var l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], k = st * 0.9;
    c[0] += (l * 0.93 - c[0]) * k; c[1] += (l * 0.96 - c[1]) * k; c[2] += (l * 1.07 + 3 - c[2]) * k;
    return c;
  }
  function toward(c, t, k) { c[0] += (t[0] - c[0]) * k; c[1] += (t[1] - c[1]) * k; c[2] += (t[2] - c[2]) * k; return c; }

  // ---------- lightning ----------
  function flashAt(a) {                                                          // two strokes at least ~0.27 s apart (never more than 3 flashes a second): a flicker, not a strobe
    if (a < 0 || a > 0.86) return 0;
    if (a < 0.07) return 1;
    if (a < 0.27) return 0.30 - 0.14 * (a - 0.07) / 0.20;
    if (a < 0.35) return 0.72;
    return 0.72 * Math.pow(1 - (a - 0.35) / 0.51, 1.7);
  }
  function startStrike(S, t, storm, forceBolt) {
    ST.sStart = t; ST.sSeed = ((t * 1000) | 0) ^ 0x5bd1;
    ST.sX = 0.1 + 0.8 * h1(ST.sSeed);
    ST.sheet = !forceBolt && h1(ST.sSeed + 7) < 0.3;                             // a third of them flash inside the cloud: no bolt, a distant rumble
    ST.bolt = null;
    V8.emit("strike", Math.max(0.35, storm) * (ST.sheet ? 0.5 : 1));
  }
  // advance the storm clock once per frame (R.light runs first in the game; R.palette first in the test page)
  function tick(S) {
    var t = S.tSec;
    if (t === ST.lastT) return;
    if (t < ST.lastT - 0.5) { ST.next = 0; ST.sStart = -99; }
    ST.lastT = t;
    var storm = stormAt(S.altitude), live = S.gameState === "playing" && !S.reduced;
    if (ST.force) { var fo = ST.force; ST.force = null; startStrike(S, fo.at == null ? t : fo.at, Math.max(storm, 0.6), true); if (fo.x != null) ST.sX = fo.x; }
    else if (live && storm > 0.35) {
      if (t >= ST.next) { if (ST.next > 0) startStrike(S, t, storm); ST.next = t + 2.2 + h1((t * 977) | 0) * 4.6; }
    } else ST.next = t + 1.2;
    ST.flash = S.reduced ? 0 : (ST.hold != null ? ST.hold : flashAt(t - ST.sStart) * (ST.sheet ? 0.55 : 1));
  }

  // ---------- geometry of the sky (screen space) ----------
  function geom(S) {
    var G = ST.G, w = S.w, h = S.h, n = nightAt(S.altitude), U = clamp(h / 300, 0.72, 1.4);
    G.n = n; G.U = U;
    G.hy = S.horizonY + Math.round((1 - S.openingT) * h * 0.12);
    G.skyBot = Math.max(24, G.hy - Math.round(10 * U));
    G.r = Math.round(clamp(Math.min(w, h) * 0.2, 16, 96));
    G.sx = Math.round(w * (h > w ? 0.66 : 0.68));
    G.sy = Math.round(G.hy - G.r * 1.18 - 30 * U + Math.pow(n, 1.2) * (G.r * 2.2 + 30 * U));
    var mv = smooth((n - 0.42) / 0.33);
    G.moon = mv;
    G.mr = Math.max(5, Math.round(G.r * 0.27));
    G.mx = Math.round(w * (h > w ? 0.27 : 0.21));
    G.my = Math.round(G.skyBot * 0.26 + (1 - mv) * G.skyBot * 0.3);
    G.sunUp = G.sy - G.r < G.skyBot;
    // where the light comes from this frame (sun -> moon), used for rims
    var sw = smooth((n - 0.46) / 0.24);
    G.sw = sw;
    G.lx = Math.round(lerp(G.sx, G.mx, sw)); G.ly = Math.round(lerp(G.sy, G.my, sw));
    return G;
  }

  // ---------- init: palette + caches ----------
  function H(name, key) { return KP[name][key || 0]; }
  R.init = function (pal, S) {
    I.sky = pal.ramp("sky", H("sky"));
    I.glow = pal.ramp("skyGlow", H("sky"));                        // must follow "sky": glow twin of index v is v + 12
    I.sun = pal.ramp("sun", H("sun"));
    I.cloud = pal.ramp("cloud", H("cloud"));
    I.r0 = pal.ramp("r0", H("r0")); I.r1 = pal.ramp("r1", H("r1")); I.r2 = pal.ramp("r2", H("r2")); I.r3 = pal.ramp("r3", H("r3"));
    I.earth = pal.ramp("earth", H("earth"));
    I.deep = pal.ramp("deep", H("deep"));
    I.rim = pal.ramp("rim", H("rim"));
    I.ghost = pal.ramp("ghost", H("ghost"));
    I.ember = pal.ramp("ember", H("ember"));
    I.star = pal.ramp("star", H("star"));
    I.moon = pal.ramp("moon", H("moon"));
    I.halo = pal.ramp("halo", [[40, 30, 70]]);
    I.birdFar = pal.ramp("birdFar", [[60, 30, 60]]);
    I.fly = pal.ramp("fly", H("fly"));
    I.rain = pal.ramp("rain", H("rain"));
    I.bolt = pal.ramp("bolt", H("bolt"));
    I.cairn = pal.ramp("cairn", H("cairn"));
    I.ink = I.earth + 1;
    R.markerIdx = { c0: I.cairn, c1: I.cairn + 1, c2: I.cairn + 3, p0: I.cairn + 2, p1: I.cairn + 1, f0: 249, f1: 250, g0: 251, g1: 252 };
    R.birdIdx = I.ink; R.watcherIdx = I.ghost + 1;                                   // shared mythic eagle: silhouette; the watcher: a pale shade from below
    R.footprint = { col: I.earth + 3, hi: I.earth + 4 };
    ST.built = ""; ST.skyKey = ""; ST.boltKey = "";
    build(S);
  };

  // ---------- ridge strips: silhouettes stored as edge CODES so rims can follow the light every frame ----------
  //   1 body | 2 top edge | 3 left edge | 4 right edge | 5 mist (valley haze)
  function stampRow(d, L, H, y, x0, x1) {
    if (y < 0 || y >= H) return;
    for (var x = x0; x <= x1; x++) d[y * L + (((x % L) + L) % L)] = 1;
  }
  function stampCypress(d, L, H, cx, by, th, tw, rnd) {
    if (th < 3) { for (var q = 0; q < th; q++) stampRow(d, L, H, by - q, cx, cx); return; }
    var lean = rnd() < 0.3 ? (rnd() < 0.5 ? -1 : 1) : 0;
    for (var i = 0; i < th; i++) {
      var t = i / (th - 1), y = by - th + 1 + i;
      var p = t < 0.07 ? 0 : t < 0.64 ? Math.pow(Math.sin(Math.min(1, (t - 0.07) / 0.57) * Math.PI / 2), 1.15) : 1 - 0.2 * Math.pow((t - 0.64) / 0.36, 2);
      var wpx = Math.max(1, Math.round(tw * p)), l = (wpx - 1) >> 1, r = wpx - 1 - l;
      if (th > 13 && i > 3 && i < th - 3 && (i % 4) === 1) { if ((i >> 2) & 1) l = Math.max(0, l - 1); else r = Math.max(0, r - 1); }   // foliage tiers
      var sx = cx + (lean && t < 0.3 ? Math.round(lean * (0.3 - t) * 3) : 0);
      stampRow(d, L, H, y, sx - l, sx + r);
    }
    stampRow(d, L, H, by + 1, cx, cx); stampRow(d, L, H, by + 2, cx, cx);
  }
  function stampPine(d, L, H, cx, by, th, rnd) {                                   // Italian stone pine: bare trunk, flat parasol crown
    var lean = (rnd() - 0.5) * th * 0.16, trunkTop = by - Math.round(th * 0.6), tw = th > 22 ? 1 : 0, y, x, j;
    for (y = by + 2; y >= trunkTop; y--) { var tx = cx + Math.round(lean * (by - y) / (by - trunkTop + 1)); stampRow(d, L, H, y, tx, tx + tw); }
    var fy = Math.round(by - th * 0.46), fdir = rnd() < 0.5 ? -1 : 1, fx = cx + Math.round(lean * (by - fy) / (by - trunkTop + 1));
    for (j = 1; j <= Math.max(2, Math.round(th * 0.16)); j++) stampRow(d, L, H, fy - j, fx + fdir * j, fx + fdir * j);   // a forked limb
    var ccx = cx + lean, W = th * 1.2, Hc = Math.max(3, th * 0.3), ctop = trunkTop - Hc * 0.55, n = 3 + Math.floor(rnd() * 3), flat = ctop + Hc * 0.95;
    for (j = 0; j < n; j++) {
      var lx = ccx - W / 2 + W * (j + 0.5) / n + (rnd() - 0.5) * 2, ly = ctop + Hc * (0.45 + (rnd() - 0.5) * 0.3) + Math.abs(j - (n - 1) / 2) * Hc * 0.12, rx = W / n * 0.78 + 1, ry = Hc * (0.42 + rnd() * 0.12);
      for (y = Math.floor(ly - ry); y <= Math.ceil(Math.min(flat, ly + ry)); y++) for (x = Math.floor(lx - rx); x <= Math.ceil(lx + rx); x++) {
        var dx = (x + 0.5 - lx) / rx, dy = (y + 0.5 - ly) / ry; if (dx * dx + dy * dy <= 1) stampRow(d, L, H, y, x, x);
      }
    }
  }
  function stampOlive(d, L, H, cx, by, th, rnd) {
    var y, x, trunkH = Math.round(th * 0.38);
    for (y = by + 2; y >= by - trunkH; y--) stampRow(d, L, H, y, cx + (y < by - trunkH * 0.5 ? 1 : 0), cx + (th > 14 ? 1 : 0) + (y < by - trunkH * 0.5 ? 1 : 0));
    var lobes = 3 + Math.floor(rnd() * 2), R0 = th * 0.34;
    for (var k = 0; k < lobes; k++) {
      var lx = cx + (k - (lobes - 1) / 2) * R0 * 0.9 + (rnd() - 0.5) * 2, ly = by - trunkH - R0 * (0.55 + rnd() * 0.5), lr = R0 * (0.7 + rnd() * 0.4);
      for (y = Math.floor(ly - lr); y <= Math.ceil(ly + lr * 0.7); y++) for (x = Math.floor(lx - lr); x <= Math.ceil(lx + lr); x++) {
        var dx = x + 0.5 - lx, dy = y + 0.5 - ly; if (dx * dx + dy * dy <= lr * lr) stampRow(d, L, H, y, x, x);
      }
    }
  }
  // Greek temple: stepped stylobate, a row of columns (the sky shows between them), architrave, cornice, pediment
  function stampTemple(d, L, H, cx, by, W, cols, ruined, rnd) {
    var half = Math.round(W / 2), colH = Math.max(4, Math.round(W * 0.34)), cw = W >= 30 ? 2 : 1, y, i;
    stampRow(d, L, H, by, cx - half - 2, cx + half + 2);
    stampRow(d, L, H, by - 1, cx - half - 1, cx + half + 1);
    stampRow(d, L, H, by - 2, cx - half, cx + half);
    var top = by - 3 - colH, gap = (W - cw) / (cols - 1);
    for (i = 0; i < cols; i++) {
      var x0 = Math.round(cx - half + i * gap), hgt = colH;
      if (ruined && (i === 1 || i === cols - 2 || rnd() < 0.2)) hgt = Math.round(colH * (0.25 + rnd() * 0.5));
      for (y = by - 3; y > by - 3 - hgt; y--) stampRow(d, L, H, y, x0, x0 + cw - 1);
      if (hgt === colH) stampRow(d, L, H, top + 1, x0 - (cw > 1 ? 1 : 0), x0 + cw - (cw > 1 ? 0 : 1));   // capitals
    }
    if (ruined) {                                                                  // a surviving stretch of architrave
      stampRow(d, L, H, top, cx - half, cx - half + Math.round(W * 0.45));
      stampRow(d, L, H, top - 1, cx - half - 1, cx - half + Math.round(W * 0.38));
      return;
    }
    stampRow(d, L, H, top, cx - half, cx + half);
    stampRow(d, L, H, top - 1, cx - half, cx + half);
    stampRow(d, L, H, top - 2, cx - half - 1, cx + half + 1);                       // cornice
    var ph = Math.max(2, Math.round(W * 0.16));
    for (i = 1; i <= ph; i++) { var hw2 = Math.round((half + 1) * (1 - i / (ph + 0.6))); stampRow(d, L, H, top - 2 - i, cx - hw2, cx + hw2); }
  }
  function stampColumns(d, L, H, cx, by, W, rnd) {                                // a lone broken colonnade
    var n = 3 + Math.floor(rnd() * 2), gap = Math.max(3, Math.round(W / n)), colH = Math.max(4, Math.round(W * 0.42)), cw = W >= 30 ? 2 : 1;
    stampRow(d, L, H, by, cx - 2, cx + gap * (n - 1) + cw + 1);
    for (var i = 0; i < n; i++) {
      var hgt = i === n - 1 ? Math.round(colH * 0.4) : colH - (i === 1 ? 0 : Math.round(rnd() * 2)), x0 = cx + i * gap;
      for (var y = by - 1; y > by - 1 - hgt; y--) stampRow(d, L, H, y, x0, x0 + cw - 1);
      if (i < 2) stampRow(d, L, H, by - 1 - colH, x0 - 1, x0 + cw);
    }
    stampRow(d, L, H, by - 2 - colH, cx - 1, cx + gap + cw);
  }

  // o: L, H, seed, cm (mean crest row), amp, hills, round, jag, mistTop, mistRows, props(d, L, H, top, rnd)
  function ridgeStrip(o) {
    var L = o.L, Hh = o.H, d = new Uint8Array(L * Hh), top = new Int16Array(L), rnd = PX.rng(o.seed), per = Sc.periodic(L, o.seed * 7 + 3), per2 = Sc.periodic(L, o.seed * 11 + 5), x, y, i, k;
    var hills = [], sp = L / o.hills;
    for (i = 0; i < o.hills; i++) {
      var hc = (i + 0.2 + 0.6 * rnd()) * sp, hw = sp * (0.5 + 0.45 * rnd()), ha = 0.45 + 0.55 * rnd();
      hills.push({ c: hc, w: hw, a: ha, peak: o.peak || 0 });
      if (rnd() < 0.7) hills.push({ c: hc + (rnd() < 0.5 ? -1 : 1) * hw * (0.45 + 0.3 * rnd()), w: hw * (0.35 + 0.25 * rnd()), a: ha * (0.5 + 0.3 * rnd()), peak: 0 });   // a shoulder
    }
    for (x = 0; x < L; x++) {
      var v = 0;
      for (i = 0; i < hills.length; i++) for (k = -1; k <= 1; k++) {
        var u = (x - hills[i].c - k * L) / hills[i].w;
        if (u > -1 && u < 1) { var au = Math.abs(u), pr = hills[i].peak ? Math.pow(1 - au, 1.25) * Math.pow(1 - u * u, 0.35) : Math.pow(1 - u * u, o.round); v = Math.max(v, hills[i].a * pr); }
      }
      v += o.jag * (0.7 * per(x) + 0.3 * per2(x));
      top[x] = Math.round(o.cm - o.amp * Math.max(0, v));
    }
    for (x = 0; x < L; x++) for (y = Math.max(0, top[x]); y < Hh; y++) d[y * L + x] = 1;
    if (o.props) o.props(d, L, Hh, top, rnd);
    var e = new Uint8Array(L * Hh);
    for (y = 0; y < Hh; y++) for (x = 0; x < L; x++) {
      var o0 = y * L + x; if (!d[o0]) continue;
      var up = y === 0 ? 0 : d[o0 - L], lf = d[y * L + (x === 0 ? L - 1 : x - 1)], rt = d[y * L + (x === L - 1 ? 0 : x + 1)];
      e[o0] = !up ? 2 : !lf ? 3 : !rt ? 4 : 1;
    }
    if (o.mistRows) for (y = Math.max(0, o.mistTop); y < Hh; y++) {
      var amt = Math.min(o.mistMax || 0.75, (y - o.mistTop + 1) / o.mistRows);
      amt = Math.round(amt * 4) / 4;
      for (x = 0; x < L; x++) { var o1 = y * L + x; if (e[o1] === 1 && BP[((y & 3) << 2) | (x & 3)] < amt) e[o1] = 5; }
    }
    return { w: L, h: Hh, d: e, top: top };
  }

  function build(S) {
    var key = S.w + "x" + S.h; if (ST.built === key) return; ST.built = key;
    var w = S.w, h = S.h, U = clamp(h / 300, 0.72, 1.4), G = geom(S);
    ST.U = U;
    // layer layout relative to the horizon: F = valley floor, A = peak height above it (px)
    var F = [-20 * U, -6 * U, 4 * U, 11 * U], A = [52 * U, 32 * U, 22 * U, 15 * U];
    ST.layF = F;
    function mk(k, L, seed, hills, rnd0, jag, props) {
      var cm = Math.round(A[k] + 34 * U), next = k < 3 ? F[k + 1] - F[k] : 0;
      var Hh = k < 3 ? Math.round(cm + next + 10 * U) : Math.round(cm + 90 * U);
      var mistTop = k < 3 ? Math.round(cm + next - A[k + 1] * 0.55 - 6 * U) : Math.round(cm + 6 * U);
      var st = ridgeStrip({ L: L, H: Hh, seed: seed, cm: cm, amp: A[k], hills: hills, round: rnd0, jag: jag, peak: k === 0, mistTop: mistTop, mistRows: Math.round((k < 3 ? 14 : 30) * U), mistMax: k < 3 ? 0.75 : 0.5, props: props });
      st.cm = cm; st.k = k;
      return st;
    }
    var templeAt = Math.round(w * (h > w ? 0.82 : 0.8)), sunAt = G.sx;
    ST.off = [300, 120, 40, 500];
    ST.r = [
      mk(0, 1240, 71, 4, 1.1, 0.07, function (d, L, Hh, top, rnd) {
        var vx = 0, vmax = -1e9, x; for (x = 0; x < L; x++) if (top[x] > vmax) { vmax = top[x]; vx = x; }     // the sun sets into the deepest valley
        ST.off[0] = ((vx - sunAt) % L + L) % L;
        var best = 1e9, bx = 0; for (x = 0; x < L; x++) { var sx = ((x - ST.off[0]) % L + L) % L; if (sx > w * 0.06 && sx < w * 0.34 && top[x] < best) { best = top[x]; bx = x; } }
        stampTemple(d, L, Hh, bx, top[bx] + 1, Math.round(16 * U), 5, false, rnd);
      }),
      mk(1, 1150, 83, 5, 1.3, 0.1, function (d, L, Hh, top, rnd) {
        var tc = (ST.off[1] + templeAt) % L; stampTemple(d, L, Hh, tc, top[tc] + 2, Math.round(42 * U), 6, false, rnd);
        var rc = (tc + 560) % L; stampTemple(d, L, Hh, rc, top[rc] + 2, Math.round(34 * U), 5, true, rnd);
        var cc = (tc + 300) % L; stampColumns(d, L, Hh, cc, top[cc] + 1, Math.round(20 * U), rnd);
        for (var c = 0; c < L; c += 90 + Math.floor(rnd() * 150)) {                     // cypress groves: tight clusters, tallest in the middle
          if (Math.abs(c - tc) < 50 * U || Math.abs(c - rc) < 44 * U || Math.abs(c - cc) < 34 * U) continue;
          var n = 3 + Math.floor(rnd() * 4);
          for (var j = 0; j < n; j++) {
            var mid = 1 - Math.abs(j - (n - 1) / 2) / (n / 2), xx = (c + j * Math.round(2.6 * U)) % L;
            stampCypress(d, L, Hh, xx, top[xx] + 1, Math.round((5 + 6 * mid + rnd() * 2) * U), Math.max(2, Math.round(2.4 * U)), rnd);
          }
        }
      }),
      mk(2, 1060, 97, 6, 1.6, 0.12, function (d, L, Hh, top, rnd) {
        for (var c = 0; c < L; c += 44 + Math.floor(rnd() * 96)) {
          var kind = rnd();
          if (kind < 0.6) {
            var n = 1 + Math.floor(rnd() * 3);
            for (var j = 0; j < n; j++) { var xx = (c + j * Math.round((3 + rnd() * 3) * U)) % L; stampCypress(d, L, Hh, xx, top[xx] + 1, Math.round((10 + rnd() * 9) * U), Math.max(3, Math.round((3 + rnd()) * U)), rnd); }
          } else if (kind < 0.88) { var px = c % L; stampPine(d, L, Hh, px, top[px] + 1, Math.round((11 + rnd() * 6) * U), rnd); }
          else { var ox = c % L; stampOlive(d, L, Hh, ox, top[ox] + 1, Math.round((9 + rnd() * 4) * U), rnd); }
        }
      }),
      mk(3, 980, 113, 5, 1.8, 0.12, function (d, L, Hh, top, rnd) {
        for (var c = 0; c < L; c += 70 + Math.floor(rnd() * 130)) {
          var kind = rnd();
          if (kind < 0.55) {
            var n = 1 + Math.floor(rnd() * 3);
            for (var j = 0; j < n; j++) { var xx = (c + j * Math.round((5 + rnd() * 4) * U)) % L; stampCypress(d, L, Hh, xx, top[xx] + 1, Math.round((17 + rnd() * 14) * U), Math.max(4, Math.round((4.4 + rnd() * 1.6) * U)), rnd); }
          } else if (kind < 0.82) { var px = c % L; stampPine(d, L, Hh, px, top[px] + 1, Math.round((18 + rnd() * 10) * U), rnd); }
          else { var ox = c % L; stampOlive(d, L, Hh, ox, top[ox] + 1, Math.round((13 + rnd() * 6) * U), rnd); }
        }
      })
    ];
    ST.colSide = new Uint8Array(w);
    // stars
    var rs = PX.rng(4242), nStars = Math.round(w * G.skyBot / 700);
    ST.stars = [];
    for (var i = 0; i < nStars; i++) {
      var tr = rs(), tier = tr < 0.66 ? 0 : tr < 0.9 ? 1 : tr < 0.975 ? 2 : 3;
      ST.stars.push({ x: rs(), y: Math.pow(rs(), 1.25) * 0.92, tier: tier, th: 0.05 + rs() * 0.85 });
    }
    for (i = 0; i < nStars * 0.9; i++) {                                                // the Milky Way: a faint diagonal river of small stars
      var u = rs(), off = (rs() + rs() + rs() - 1.5) * 0.09, bx = u, by = 0.08 + u * 0.55 + off;
      if (by < 0 || by > 0.85) continue;
      ST.stars.push({ x: bx, y: by, tier: rs() < 0.9 ? 0 : 1, th: 0.45 + rs() * 0.5 });
    }
    // cloud bars (the last few only come with a storm)
    var rb = PX.rng(909);
    ST.bars = [];
    for (i = 0; i < 16; i++) {
      var storm = i >= 10 ? 0.15 + (i - 10) * 0.12 : 0;
      ST.bars.push({ len: 0.12 + rb() * 0.34, th: storm ? 2 + Math.floor(rb() * 2) : 1 + (rb() > 0.55 ? 1 : 0) + (rb() > 0.88 ? 1 : 0), y: storm ? 0.45 + rb() * 0.5 : 0.04 + Math.pow(rb(), 0.8) * 0.62, x: rb(), v: 1.1 + rb() * 2.6, par: 0.6 + rb() * 0.8, storm: storm });
    }
    for (i = 0; i < 4; i++) ST.bars.push({ len: 0.08 + rb() * 0.18, th: 1, y: 0.8 + rb() * 0.5, x: rb(), v: 0.5 + rb() * 0.9, par: 0.3, storm: 0, tone: 3 });   // high cirrus, lit pink from below
    // storm deck: a lumpy cloud ceiling that slides down as the storm builds
    ST.deck = deckStrip(960, Math.round(h * 0.36), 515);
    buildStrata();
  }

  function deckStrip(L, Hh, seed) {
    var d = new Uint8Array(L * Hh), rnd = PX.rng(seed), per = Sc.periodic(L, seed), per2 = Sc.periodic(L, seed + 5), x, y, i, k, bl = [];
    var base = Hh * 0.44, edge = new Float32Array(L);
    for (var xx = 0; xx < L;) { var r = Hh * (0.09 + 0.2 * Math.pow(rnd(), 1.3)); bl.push({ c: xx + r * 0.8, r: r, dy: base - r * (0.2 + rnd() * 0.45) }); xx += r * (1.25 + rnd() * 1.1); }
    for (x = 0; x < L; x++) {                                                         // the base line + hanging pouches
      var e = base + Hh * (0.05 * per(x) + 0.025 * per2(x));
      for (i = 0; i < bl.length; i++) for (k = -1; k <= 1; k++) { var dx = x - bl[i].c - k * L; if (dx > -bl[i].r && dx < bl[i].r) e = Math.max(e, bl[i].dy + Math.sqrt(bl[i].r * bl[i].r - dx * dx)); }
      edge[x] = e;
    }
    for (x = 0; x < L; x++) {
      var sl = Math.abs((x + 1 < L ? edge[x + 1] : edge[0]) - (x > 0 ? edge[x - 1] : edge[L - 1]));   // steep pouch sides stay dark
      for (y = 0; y < Hh; y++) {
        var dist = edge[x] - y; if (dist < 0) continue;
        var b2 = BP[((y & 3) << 2) | (x & 3)], c;
        if (dist < 1) c = sl > 2.5 ? 3 : 4; else if (dist < 3) c = b2 < 0.5 ? 2 : 3; else if (dist < 6) c = 2; else if (dist < 10) c = b2 < 0.5 ? 1 : 2; else c = 1;
        d[y * L + x] = c;
      }
    }
    return { w: L, h: Hh, d: d };
  }

  // underworld strata: per world-depth unit, two palette indices and a dither mix
  var MAXD = 2400, TA = new Uint8Array(MAXD + 1), TB = new Uint8Array(MAXD + 1), TM = new Float32Array(MAXD + 1);
  // world-locked offset field (5 world units x 8 depth units per cell): strata wander, thicken and pinch out
  var OFFS = new Int8Array(256 * 64);
  (function () {
    for (var j = 0; j < 64; j++) for (var i = 0; i < 256; i++) {
      var v = 0, a = 1, f = 1 / 24, tw = 0;
      for (var o = 0; o < 3; o++) { v += a * (PX.vnoise(i * f * 256 / 256, j * f * 3, o * 7.1) - 0.5); tw += a; a *= 0.5; f *= 2.1; }
      OFFS[j * 256 + i] = Math.round(v / tw * 22);
    }
    // make the field tile across x = 255 -> 0 by blending the last 32 columns into the first
    for (var jj = 0; jj < 64; jj++) for (var k = 0; k < 32; k++) { var t = k / 32, a0 = OFFS[jj * 256 + 224 + k], b0 = OFFS[jj * 256 + k]; OFFS[jj * 256 + 224 + k] = Math.round(a0 * (1 - t) + b0 * t); }
  })();
  // Strata are CONTOUR LINES: a pixel is on a line when a line depth falls between its row and the next one, so every line is
  // exactly one pixel thick at any zoom (no dither mush). Between lines: solid fills; far down, a dithered warm glow.
  var LCNT = new Uint16Array(MAXD + 2), LTONE = [], LDASH = [];
  function buildStrata() {
    var E = I.earth, Dp = I.deep, D, rnd = PX.rng(1212), lines = [];
    function solid(d0, d1, a) { for (D = Math.max(0, Math.floor(d0)); D < Math.min(MAXD + 1, d1); D++) { TA[D] = a; TB[D] = a; TM[D] = 0; } }
    function blend(d0, d1, a, b) {                                              // a -> b in quantized ordered-dither steps
      var n = Math.max(1, d1 - d0);
      for (D = Math.max(0, Math.floor(d0)); D < Math.min(MAXD + 1, d1); D++) { var m = Math.round(((D - d0 + 0.5) / n) * 4) / 4; TA[D] = a; TB[D] = b; TM[D] = clamp(m, 0.25, 0.75); }
    }
    solid(0, 24, E + 1);                                                        // the silhouette mass right under the crest
    var z = 24, fill = E + 1;
    while (z < 200) {                                                           // faint violet strata: a crisp seam, then a band
      var tone = rnd() < 0.3 ? E + 4 : E + 3, dash = rnd() < 0.45 ? 1 + Math.floor(rnd() * 2) : 0;
      lines.push([z, tone, dash]);
      if (rnd() < 0.22) lines.push([z + 3, E + 2, 2]);                          // a fainter companion seam
      fill = fill === E + 1 ? (rnd() < 0.7 ? E + 2 : E + 1) : E + 1;
      var th = 13 + Math.floor(rnd() * 30);
      solid(z, z + th, fill); z += th;
    }
    solid(z, z + 20, E + 1); z += 20;                                           // then down toward the fires of Tartarus
    blend(z, z + 30, E + 1, Dp); z += 30;
    solid(z, z + 16, Dp); z += 16;
    blend(z, z + 30, Dp, Dp + 1); z += 30;
    ST.deepStart = z;
    solid(z, z + 30, Dp + 1); z += 30;
    blend(z, z + 36, Dp + 1, Dp + 2); z += 36;
    solid(z, z + 44, Dp + 2); z += 44;                                          // the glowing seam
    blend(z, z + 40, Dp + 2, Dp + 1); z += 40;
    solid(z, z + 60, Dp + 1); z += 60;
    blend(z, z + 70, Dp + 1, Dp); z += 70;
    solid(z, z + 120, Dp); z += 120;
    blend(z, z + 90, Dp, E + 0); z += 90;                                       // and below it the lightless abyss
    solid(z, MAXD + 1, E + 0);
    LTONE = []; LDASH = [];
    var li = 0;
    for (D = 0; D <= MAXD + 1; D++) { while (li < lines.length && lines[li][0] <= D) { LTONE.push(lines[li][1]); LDASH.push(lines[li][2]); li++; } LCNT[D] = li; }
  }

  // ---------- palette animation: day/night keys -> noir storm grade -> lightning flash ----------
  var WHITE = [238, 236, 252], BLACK = [5, 4, 9], FLASHR = [[92, 90, 116], [66, 64, 86], [46, 44, 62], [30, 28, 42]];
  R.palette = function (pal, S) {
    tick(S);
    var n = nightAt(S.altitude), st = stormAt(S.altitude), f = ST.flash, G = geom(S), t = S.reduced ? 0 : S.tSec, j, c;
    var sky = keyed("sky", n), gl = glowKey(n), skyC = [], glowC = [];
    for (j = 0; j < 12; j++) {
      c = sky[j].slice(); var g2 = mix3(c, gl.col, gl.amt);
      grade(c, st); grade(g2, st * 0.95);
      if (f > 0) { var wt = mix3(WHITE, [255, 255, 255], j / 11); toward(c, wt, f * 0.9); toward(g2, wt, f * 0.92); }
      skyC.push(c); glowC.push(g2);
    }
    pal.setRamp("sky", skyC); pal.setRamp("skyGlow", glowC);
    var sun = keyed("sun", n), sunC = [], ref = sky[9];
    for (j = 0; j < 6; j++) { c = sun[j].slice(); toward(c, ref, st * 0.62); grade(c, st); if (f > 0) toward(c, WHITE, f); sunC.push(c); }
    pal.setRamp("sun", sunC);
    var cl = keyed("cloud", n), clC = [];
    for (j = 0; j < 5; j++) { c = cl[j].slice(); if (st > 0) { toward(c, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.85], st * 0.4); grade(c, st); } if (f > 0) toward(c, mix3([150, 148, 176], WHITE, j / 4), f); clC.push(c); }
    pal.setRamp("cloud", clC);
    ["r0", "r1", "r2", "r3"].forEach(function (nm, k) {
      var r = keyed(nm, n), b = r[0].slice(), rm = r[1].slice();
      grade(b, st); grade(rm, st);
      if (st > 0) toward(rm, b, st * 0.55);                                      // no sun in a storm: rims go dull
      if (f > 0) { toward(b, FLASHR[k], f); toward(rm, WHITE, f * (0.9 - k * 0.12)); }
      pal.setRamp(nm, [b, rm]);
    });
    var ea = keyed("earth", n), eaC = [];
    for (j = 0; j < 6; j++) { c = ea[j].slice(); grade(c, st); if (f > 0) toward(c, BLACK, f * 0.85); eaC.push(c); }
    pal.setRamp("earth", eaC);
    var rim = keyed("rim", n), rimC = [];
    for (j = 0; j < 3; j++) { c = rim[j].slice(); grade(c, st); if (st > 0) toward(c, eaC[2], st * 0.35 * (1 - j * 0.2)); if (f > 0) toward(c, WHITE, f * (0.6 + j * 0.2)); rimC.push(c); }
    pal.setRamp("rim", rimC);
    var gh = keyed("ghost", n), ghC = [];
    for (j = 0; j < 2; j++) { c = gh[j].slice(); grade(c, st * 0.7); if (f > 0) toward(c, BLACK, f * 0.7); ghC.push(c); }
    pal.setRamp("ghost", ghC);
    var dp = keyed("deep", 0), dpC = [];
    for (j = 0; j < 3; j++) { c = dp[j].slice(); grade(c, st * 0.6); if (f > 0) toward(c, BLACK, f * 0.5); dpC.push(c); }
    pal.setRamp("deep", dpC);
    // embers flicker: three phase channels
    var em = keyed("ember", 0), emC = [em[0].slice()];
    for (j = 1; j < 4; j++) { var ph = S.reduced ? 0.6 : 0.5 + 0.5 * Math.sin(t * (2.1 + j * 0.83) + j * 2.2) * Math.sin(t * (0.7 + j * 0.31) + j); emC.push(mix3([96, 30, 14], [255, 176, 72], clamp01(0.18 + 0.82 * ph))); }
    pal.setRamp("ember", emC);
    // stars + moon come out with the night (and hide behind a storm)
    var sv = smooth((n - 0.28) / 0.5) * (1 - st), stC = [];
    for (j = 0; j < 3; j++) { c = mix3(sky[2], KP.star[0][j], sv); if (f > 0) toward(c, WHITE, f * 0.9); stC.push(c); }
    pal.setRamp("star", stC);
    var mv = G.moon * (1 - st * 0.85), mb = sky[G.moonBand == null ? 3 : G.moonBand], moC = [];
    for (j = 0; j < 5; j++) { c = grade(mix3(mb, KP.moon[0][j], mv), st); if (f > 0) toward(c, WHITE, f * 0.9); moC.push(c); }
    pal.setRamp("moon", moC);
    c = grade(mix3(sky[G.moonBand == null ? 3 : G.moonBand], [190, 188, 236], 0.14 * mv), st); if (f > 0) toward(c, WHITE, f * 0.9);
    pal.setRamp("halo", [c]);
    var bf = mix3(sky[6], ea[1], 0.6); grade(bf, st); if (f > 0) toward(bf, BLACK, f);
    pal.setRamp("birdFar", [bf]);
    var rn = keyed("rain", 0), rnC = [];
    for (j = 0; j < 3; j++) { c = rn[j].slice(); if (n > 0.5) toward(c, [c[0] * 0.72, c[1] * 0.74, c[2] * 0.82], (n - 0.5) * 1.4); if (f > 0) toward(c, WHITE, f * 0.7); rnC.push(c); }
    pal.setRamp("rain", rnC);
    var caC = [ea[0].slice(), mix3(ea[1], ea[3], 0.35), mix3(ea[2], ea[4], 0.6), rimC[1].slice()];
    if (f > 0) { toward(caC[0], BLACK, f); toward(caC[1], BLACK, f); toward(caC[2], BLACK, f); }
    pal.setRamp("cairn", caC);
  };

  // ---------- light for the hero and the stone ----------
  R.light = function (S) {
    tick(S);
    var G = geom(S), n = G.n, st = stormAt(S.altitude), f = ST.flash, sw = G.sw;
    var x = G.lx, y = G.ly;
    var kSun = 0.92 * (1 - smooth((n - 0.2) / 0.42)), kMoon = 0.6 * smooth((n - 0.52) / 0.3), k = Math.max(kSun, kMoon, 0.16);
    var warm = mix3([255, 196, 132], [255, 140, 92], smooth(n / 0.45)), col = mix3(warm, [178, 190, 242], sw);
    var amb = mix3(keyed("sky", n)[6], [0, 0, 0], 0.4), bright = 0.2 - 0.1 * n;
    if (st > 0) { k *= 1 - 0.68 * st; grade(col, st); grade(amb, st); bright *= 1 - 0.3 * st; }
    if (f > 0.02) {
      col = mix3(col, [242, 242, 255], clamp01(f * 1.5)); k = Math.max(k, f);
      x = Math.round(ST.sX * S.w); y = 0; bright = bright * (1 - f); amb = mix3(amb, [8, 8, 14], f);
    }
    return { x: Math.round(x), y: Math.round(y), k: k, col: [Math.round(col[0]), Math.round(col[1]), Math.round(col[2])], ambient: [Math.round(amb[0]), Math.round(amb[1]), Math.round(amb[2])], bright: bright, ground: [16, 10, 22], flash: f, storm: st, night: n };
  };

  // ---------- sky cache: bands + the sun's stepped glow + the moon (re-rendered only when geometry changes) ----------
  function skyCache(S, G) {
    var w = S.w, h = S.h, moonOn = G.moon > 0.02;
    var key = w + "," + h + "," + G.hy + "," + G.sx + "," + G.sy + "," + G.r + "," + (moonOn ? G.mx + "," + G.my + "," + G.mr : "-");
    if (key === ST.skyKey && ST.sky && ST.sky.length === w * h) return;
    ST.skyKey = key;
    var d = (ST.sky && ST.sky.length === w * h) ? ST.sky : (ST.sky = new Uint8Array(w * h)), N = 12, skyBot = G.skyBot, x, y, k;
    var Bk = []; for (k = 0; k <= N; k++) Bk.push(skyBot * Math.pow(k / N, 0.86));
    ST.Bk = Bk;
    k = 0;
    for (y = 0; y < h; y++) {
      var row = y * w, a, b = -1, m = 0;
      if (y >= skyBot) a = I.sky + N - 1;
      else {
        while (k < N - 1 && y >= Bk[k + 1]) k++;
        a = I.sky + k;
        if (k < N - 1) {
          var bh = Bk[k + 1] - Bk[k], dr = clamp(Math.round(bh * 0.34), 2, 5), into = y - (Math.ceil(Bk[k + 1]) - dr);
          if (into >= 0) { b = a + 1; m = Math.round((into + 0.5) / dr * 4) / 4; }
        }
      }
      if (b < 0 || m <= 0) { d.fill(a, row, row + w); continue; }
      var bo = (y & 3) << 2;
      for (x = 0; x < w; x++) d[row + x] = BP[bo | (x & 3)] < m ? b : a;
    }
    // stepped, dithered glow around the sun: sky index v -> its glow twin v + 12
    var r = G.r, cx = G.sx + 0.5, cy = G.sy + 0.5;
    var aj = S.adj || 1, rad = [r + 1.6 * aj, r + 4 * aj + r * 0.04, r + 7 * aj + r * 0.1, r + 10 * aj + r * 0.19, r + 10.5 * aj + r * 0.2], den = [1, 0.75, 0.5, 0.25, 0], rad2 = rad.map(function (q) { return q * q; });
    var Rm = rad[4], y0 = Math.max(0, Math.floor(cy - Rm)), y1 = Math.min(h - 1, Math.ceil(cy + Rm)), x0 = Math.max(0, Math.floor(cx - Rm)), x1 = Math.min(w - 1, Math.ceil(cx + Rm)), r2 = (r - 0.5) * (r - 0.5);
    for (y = y0; y <= y1; y++) {
      var dy = y + 0.5 - cy, bo2 = (y & 3) << 2;
      for (x = x0; x <= x1; x++) {
        var dx = x + 0.5 - cx, dd = dx * dx + dy * dy; if (dd < r2 || dd >= rad2[4]) continue;
        var ring = 0; while (dd >= rad2[ring]) ring++;
        if (BP[bo2 | (x & 3)] < den[ring]) { var o = y * w + x, v = d[o]; if (v >= I.sky && v < I.sky + 12) d[o] = v + 12; }
      }
    }
    // the moon: a crescent (lit toward the set sun) with earthshine, a few craters and a faint halo
    G.moonBand = null;
    if (moonOn) {
      var mr = G.mr, mcx = G.mx + 0.5, mcy = G.my + 0.5;
      k = 0; while (k < N - 1 && G.my >= Bk[k + 1]) k++; G.moonBand = k;
      var hr = [mr + 2, mr + 5, mr + 10], hd = [0.5, 0.25, 0.125];
      for (y = Math.max(0, Math.floor(mcy - hr[2])); y <= Math.min(h - 1, Math.ceil(mcy + hr[2])); y++) for (x = Math.max(0, Math.floor(mcx - hr[2])); x <= Math.min(w - 1, Math.ceil(mcx + hr[2])); x++) {
        var ex = x + 0.5 - mcx, ey = y + 0.5 - mcy, de = Math.sqrt(ex * ex + ey * ey), o2 = y * w + x;
        if (de < mr) {
          var sx2 = ex + mr * 0.46, sy2 = ey + mr * 0.3, ds = Math.sqrt(sx2 * sx2 + sy2 * sy2), lit = ds > mr * 0.96;
          if (!lit) { d[o2] = I.moon; continue; }
          var ed = ds - mr * 0.96, limb = mr - de, tone = ed < 1.3 ? 2 : (limb < 1.2 ? 4 : 3);
          if (tone === 3 && ed > 3.2 && limb > 2.2) tone = 4;
          d[o2] = I.moon + tone;
        } else {
          var ring2 = de < hr[0] ? 0 : de < hr[1] ? 1 : de < hr[2] ? 2 : 3;
          if (ring2 < 3 && BP[((y & 3) << 2) | (x & 3)] < hd[ring2]) d[o2] = I.halo;
        }
      }
      var cr = [[0.35, 0.28, 0.16], [0.62, -0.05, 0.12], [0.2, 0.62, 0.1]];                // craters (only where lit)
      for (var q = 0; q < cr.length; q++) {
        var ccx = Math.round(mcx + cr[q][0] * mr), ccy = Math.round(mcy + cr[q][1] * mr), crr = Math.max(0.8, cr[q][2] * mr);
        for (y = Math.floor(ccy - crr); y <= Math.ceil(ccy + crr); y++) for (x = Math.floor(ccx - crr); x <= Math.ceil(ccx + crr); x++) {
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          var qx = x - ccx, qy = y - ccy; if (qx * qx + qy * qy > crr * crr) continue;
          var o3 = y * w + x; if (d[o3] >= I.moon + 3) d[o3] = I.moon + 2;
        }
      }
    }
  }

  function drawStars(fb, S, G, vis, t) {
    if (vis <= 0.02) return;
    var w = fb.w, d = fb.d, list = ST.stars, lim = 0.3 + 0.7 * vis, sb = G.skyBot, mx = G.mx, my = G.my, mr2 = (G.mr + 3) * (G.mr + 3);
    for (var i = 0; i < list.length; i++) {
      var s = list[i]; if (s.th > vis || s.y > lim) continue;
      var x = Math.floor(s.x * w), y = Math.floor(s.y * sb * 0.96);
      if (G.moon > 0.02 && (x - mx) * (x - mx) + (y - my) * (y - my) < mr2) continue;
      var tier = s.tier;
      if (!S.reduced && tier > 0 && h1(i * 31 + Math.floor(t * 2.6 + i * 0.37)) < 0.14) tier--;
      var o = y * w + x;
      if (tier === 3 && vis > 0.55) {
        d[o] = I.star + 2;
        if (x > 0) d[o - 1] = I.star; if (x < w - 1) d[o + 1] = I.star; if (y > 0) d[o - w] = I.star; d[o + w] = I.star;
      } else d[o] = I.star + Math.min(2, tier);
    }
  }

  function drawMeteor(fb, S, G, vis, t) {
    if (vis < 0.6 || S.reduced) return;
    var per = 9.5, k = Math.floor(t / per), a = t - k * per; if (a > 0.55 || h1(k * 3 + 1) < 0.35) return;
    var w = fb.w, d = fb.d, x0 = (0.15 + 0.7 * h1(k * 3 + 2)) * w, y0 = (0.06 + 0.3 * h1(k * 3 + 3)) * G.skyBot, dir = h1(k * 3 + 4) < 0.5 ? -1 : 1;
    var aj = S.adj || 1, hx = x0 + dir * a * 170 * aj, hy = y0 + a * 70 * aj, len = Math.round((6 + 10 * Math.sin(Math.min(1, a / 0.55) * Math.PI)) * aj);
    for (var i = 0; i < len; i++) {
      var x = Math.round(hx - dir * i * 2.4), y = Math.round(hy - i * 1); if (x < 0 || x >= w || y < 0 || y >= G.skyBot) continue;
      d[y * w + x] = i < 2 ? I.star + 2 : i < len * 0.5 ? I.star + 1 : I.star;
    }
  }

  // the sun: banded disc (cream top -> rose bottom) with retro horizontal cuts drifting down through its lower half
  function drawSun(fb, S, G, t) {
    var w = fb.w, h = fb.h, d = fb.d, r = G.r, cx = G.sx, cy = G.sy, bot = G.skyBot + 4;
    var per = Math.max(4, Math.round(r * 0.17)), u0 = 0.06, off = S.reduced ? 0 : (t * 2.4 * (S.adj || 1)) % per;
    for (var dy = -r; dy < r; dy++) {
      var y = cy + dy; if (y < 0 || y >= h || y > bot) continue;
      var yc = dy + 0.5, hw = Math.sqrt(r * r - yc * yc); if (hw < 0.5) continue;
      var u = yc / r;
      if (u > u0) {                                                             // the cuts: gaps widen toward the bottom
        var into = (u - u0) / (1 - u0), gap = 1 + into * per * 0.62, pos = ((dy - u0 * r - off) % per + per) % per;
        if (pos < gap) continue;
      }
      var tf = (1 - (u + 1) / 2) * 6, kk = Math.min(5, Math.floor(tf)), fr = tf - kk, x0 = Math.max(0, Math.round(cx - hw)), x1 = Math.min(w - 1, Math.round(cx + hw) - 1);
      var a = I.sun + kk, b = I.sun + Math.max(0, kk - 1), m = fr < 0.32 && kk > 0 ? Math.round((0.32 - fr) / 0.32 * 4) / 4 : 0;
      var row = y * w, bo = (y & 3) << 2;
      if (m <= 0) { d.fill(a, row + x0, row + x1 + 1); continue; }
      for (var x = x0; x <= x1; x++) d[row + x] = BP[bo | (x & 3)] < m ? b : a;
    }
  }

  function drawDeck(fb, S, G, st, t) {
    var dk = ST.deck, w = fb.w, h = fb.h, d = fb.d, L = dk.w, Hh = dk.h, sd = dk.d;
    var y0 = Math.round(-Hh + Hh * 0.98 * smooth(st)), ox = ((Math.floor(t * 3.2 + S.altitude * 0.5) % L) + L) % L, C = I.cloud - 1;
    for (var y = Math.max(0, y0); y < Math.min(h, y0 + Hh); y++) {
      var srow = (y - y0) * L, row = y * w, sx = ox;
      for (var x = 0; x < w; x++) { var v = sd[srow + sx]; if (v) d[row + x] = C + v; if (++sx === L) sx = 0; }
    }
    ST.deckY0 = y0;
  }

  function drawBars(fb, S, G, st, t) {
    var w = fb.w, h = fb.h, d = fb.d, list = ST.bars, sb = G.skyBot, r2 = G.r * G.r, scx = G.sx, scy = G.sy, sunOn = G.sunUp;
    for (var i = 0; i < list.length; i++) {
      var b = list[i]; if (b.storm > st) continue;
      var L = Math.round(b.len * w * (1 + st * 0.7)), th = b.th + (st > 0.6 ? 1 : 0);
      var span = w + L + 24, x0 = Math.round(((b.x * span - t * b.v * (S.adj || 1) - S.altitude * 0.32 * b.par) % span + span) % span - L);
      var yb = Math.round(sb - 3 - b.y * sb * 0.66);
      for (var rr = 0; rr < th; rr++) {
        var y = yb - (th - 1 - rr); if (y < 0 || y >= h) continue;
        var inset = (th - 1 - rr) * 3 + (rr === th - 1 ? 0 : 1), tone = b.tone || (th === 1 ? 2 : (rr === th - 1 ? 4 : (rr === 0 && th > 2 ? 1 : 2)));
        var xs = Math.max(0, x0 + inset), xe = Math.min(w - 1, x0 + L - inset), row = y * w, dy = y + 0.5 - scy;
        for (var x = xs; x <= xe; x++) {
          var tn = tone;
          if (sunOn) { var dx = x + 0.5 - scx; if (dx * dx + dy * dy < r2) tn = rr === th - 1 && th > 1 ? 1 : 0; }
          d[row + x] = I.cloud + tn;
        }
      }
    }
  }

  // rims follow the light: code -> palette index per column side (0 none, 6 light to the left, 12 light to the right)
  var RT = new Uint8Array(18);
  function blitRidge(fb, st, offX, y0, body, rim, mist, lx, reach) {
    var w = fb.w, h = fb.h, d = fb.d, L = st.w, sd = st.d, Hh = st.h, cs = ST.colSide, x, y;
    var ox = ((Math.floor(offX) % L) + L) % L;
    RT[1] = body; RT[2] = body; RT[3] = body; RT[4] = body; RT[5] = mist;             // no rim
    RT[7] = body; RT[8] = rim; RT[9] = rim; RT[10] = body; RT[11] = mist;             // light on the left: tops + left edges
    RT[13] = body; RT[14] = rim; RT[15] = body; RT[16] = rim; RT[17] = mist;          // light on the right: tops + right edges
    for (x = 0; x < w; x++) { var p = 1 - Math.abs(x + 0.5 - lx) / reach; cs[x] = p > D1[x & 3] ? (x < lx ? 12 : 6) : 0; }
    for (y = Math.max(0, y0); y < Math.min(h, y0 + Hh); y++) {
      var srow = (y - y0) * L, row = y * w, sx = ox;
      for (x = 0; x < w; x++) { var v = sd[srow + sx]; if (v) d[row + x] = RT[cs[x] + v]; if (++sx === L) sx = 0; }
    }
  }

  // ---------- birds ----------
  var BIRD = [
    [["X.X", ".X."], ["XXX"], [".X.", "X.X"]],                                         // tiny
    [["X...X", ".X.X.", "..X.."], ["XX.XX", "..X.."], ["..X..", ".X.X.", "X...X"]],     // small
    [["X.....X", ".X...X.", "..XXX.."], [".XX.XX.", "X..X..X"], ["..XXX..", ".X...X.", "X.....X"]],   // gull
    [["X.......X", ".X.....X.", "..XX.XX..", "....X...."], [".XXX.XXX.", "X...X...X"], ["....X....", "..XX.XX..", ".X.....X.", "X.......X"]]  // big
  ];
  var FLAP = [0, 1, 2, 1];
  var BIRDSTEP = 0;
  function bird(fb, x, y, size, frame, idx) {
    size = Math.max(0, size - BIRDSTEP);
    var sp = BIRD[size][frame], w = fb.w, h = fb.h, d = fb.d, hw = sp[0].length >> 1, yo = frame === 0 ? sp.length - 1 : (frame === 2 ? 0 : 1);
    for (var r = 0; r < sp.length; r++) {
      var yy = y + r - yo; if (yy < 0 || yy >= h) continue;
      for (var c = 0; c < sp[r].length; c++) { if (sp[r].charCodeAt(c) !== 88) continue; var xx = x + c - hw; if (xx >= 0 && xx < w) d[yy * w + xx] = idx; }
    }
  }
  var SLOTS = [{ p: 23, s: 11 }, { p: 31, s: 23 }, { p: 41, s: 37 }];
  function drawBirds(fb, S, G, st, t) {
    var w = fb.w, sb = G.skyBot, act = (1 - smooth((G.n - 0.52) / 0.2)) * (1 - st * 0.9), title = S.gameState === "title";
    BIRDSTEP = (S.adj || 1) < 0.8 ? 1 : 0;
    if (act <= 0.02) return;
    for (var si = 0; si < SLOTS.length; si++) {
      var sl = SLOTS[si], tt = t + sl.s * 3.7, k = Math.floor(tt / sl.p), local = tt - k * sl.p, hk = h1(k * 7 + sl.s);
      if (hk > act * (si === 0 && title ? 1 : 0.82)) continue;
      var type = Math.floor(h1(k * 13 + sl.s) * 4), dir = h1(k * 5 + sl.s) < 0.62 ? -1 : 1, seed = k * 97 + sl.s;
      var dur = sl.p * (type === 2 ? 1 : 0.85), ph = local / dur; if (ph > 1) continue;
      var margin = 60, lead = dir > 0 ? -margin + ph * (w + 2 * margin) : w + margin - ph * (w + 2 * margin);
      var yb = sb * (type === 3 ? 0.2 + 0.25 * h1(seed + 3) : 0.34 + 0.44 * h1(seed + 3)) + Math.sin(t * 0.21 + seed) * 4;
      var i, n, x, y, fr;
      if (type === 0) {                                                             // a V of geese
        n = 5 + 2 * Math.floor(h1(seed + 5) * 4); var size = h1(seed + 6) < 0.45 ? 2 : 1, gx = size === 2 ? 7 : 5, gy = size === 2 ? 4 : 3;
        for (i = 0; i < n; i++) {
          var row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
          x = Math.round(lead - dir * row * gx); y = Math.round(yb + side * row * gy + Math.sin(t * 1.4 + i * 0.9) * 0.7);
          fr = FLAP[Math.floor(t * 5.2 - row * 0.9 + 64) & 3];
          bird(fb, x, y, size, fr, I.ink);
        }
      } else if (type === 1) {                                                      // a loose murmuration of small birds
        n = 6 + Math.floor(h1(seed + 5) * 9);
        for (i = 0; i < n; i++) {
          var ax = (h1(seed + i * 3) - 0.5) * 70, ay = (h1(seed + i * 3 + 1) - 0.5) * 22;
          x = Math.round(lead + ax + Math.sin(t * (0.9 + h1(seed + i) * 0.8) + i) * 5); y = Math.round(yb + ay + Math.cos(t * (1.1 + h1(seed + i * 2) * 0.7) + i * 1.7) * 3);
          fr = FLAP[Math.floor(t * (8 + h1(seed + i * 5) * 4) + i * 1.3) & 3];
          bird(fb, x, y, h1(seed + i * 7) < 0.3 ? 0 : 1, fr, I.ink);
        }
      } else if (type === 2) {                                                      // two or three big birds gliding
        n = 1 + Math.floor(h1(seed + 5) * 3);
        for (i = 0; i < n; i++) {
          x = Math.round(lead - dir * i * 17 + (h1(seed + i) - 0.5) * 8); y = Math.round(yb + (i % 2 ? 6 : -3) * i * 0.8 + Math.sin(t * 0.8 + i * 2) * 1.5);
          var cyc = (t * 0.45 + h1(seed + i * 9)) % 1;
          fr = cyc < 0.36 ? FLAP[Math.floor(t * 3.4 + i) & 3] : 1;
          bird(fb, x, y, 3, fr, I.ink);
        }
      } else {                                                                      // far specks, high up
        n = 4 + Math.floor(h1(seed + 5) * 6);
        for (i = 0; i < n; i++) {
          x = Math.round(lead + (h1(seed + i * 3) - 0.5) * 50); y = Math.round(yb + (h1(seed + i * 3 + 1) - 0.5) * 12);
          fr = FLAP[Math.floor(t * 6 + i * 1.7) & 3];
          bird(fb, x, y, 0, fr, I.birdFar);
        }
      }
    }
  }

  // ---------- lightning bolt ----------
  function makeBolt(S, G) {
    var rnd = PX.rng(ST.sSeed), w = S.w, x = Math.round(ST.sX * w), top = Math.max(0, (ST.deckY0 == null ? 0 : ST.deckY0 + Math.round(ST.deck.h * 0.5))), end = G.hy + Math.round(ST.layF[1] - 4 * G.U);
    var pts = [], y = top, forks = [];
    while (y < end) {
      var seg = 3 + Math.floor(rnd() * 6), nx = x + Math.round((rnd() - 0.5) * 9);
      for (var s = 0; s < seg && y + s < end; s++) { var bx0 = Math.round(lerp(x, nx, s / seg)); pts.push(bx0, y + s, 1); if (y + s < top + (end - top) * 0.55) pts.push(bx0 + 1, y + s, 1); }
      if (rnd() < 0.24 && y > top + 8) forks.push([nx, y + seg, rnd() < 0.5 ? -1 : 1, Math.round((6 + Math.floor(rnd() * 16)) * (S.adj || 1))]);
      x = nx; y += seg;
    }
    for (var f = 0; f < forks.length; f++) {
      var fx = forks[f][0], fy = forks[f][1], dirx = forks[f][2], len = forks[f][3];
      for (var q = 0; q < len && fy < end; q++) { fx += (rnd() < 0.6 ? dirx : 0); fy += 1; if (rnd() < 0.3) fx -= dirx; pts.push(fx, fy, 0); }
    }
    return pts;
  }
  function drawBolt(fb, S, G) {
    var a = S.tSec - ST.sStart;
    if (ST.hold != null ? ST.hold < 0.05 : (a < 0 || a > 0.3 || (a > 0.06 && a < 0.13))) return;
    var key = ST.sSeed + ":" + S.w + "x" + S.h; if (ST.boltKey !== key || !ST.bolt) { ST.bolt = makeBolt(S, G); ST.boltKey = key; }
    var p = ST.bolt, w = fb.w, h = fb.h, d = fb.d, i;
    for (i = 0; i < p.length; i += 3) { var x = p[i], y = p[i + 1]; if (y < 0 || y >= h) continue; if (x > 0) d[y * w + x - 1] = I.bolt; if (x < w - 1) d[y * w + x + 1] = I.bolt; }
    for (i = 0; i < p.length; i += 3) { var x2 = p[i], y2 = p[i + 1]; if (x2 < 0 || x2 >= w || y2 < 0 || y2 >= h) continue; d[y2 * w + x2] = p[i + 2] ? I.bolt + 1 : I.bolt + (((i / 3) & 1) ? 1 : 0); }
  }

  function drawRain(fb, S, st, t, layer, clipLip) {
    var w = fb.w, h = fb.h, d = fb.d, area = w * h / 144000, n, len, v0, v1, idx, slant = 0.22 + (S.windGust || 0) * 0.55, aj = S.adj || 1;
    if (layer === 0) { n = Math.round(150 * st * area); len = 2; v0 = 95; v1 = 130; idx = I.rain; }
    else if (layer === 1) { n = Math.round(95 * st * area); len = Math.max(2, Math.round(4 * aj)); v0 = 170; v1 = 230; idx = I.rain + 1; }
    else { n = Math.round(26 * st * area); len = Math.max(3, Math.round(8 * aj)); v0 = 300; v1 = 400; idx = I.rain + 2; }
    v0 *= aj; v1 *= aj;
    var lip = S.lip, span = w + 60;
    for (var i = 0; i < n; i++) {
      var sd = i * 7 + layer * 1301, v = v0 + (v1 - v0) * h1(sd), yy = (h1(sd + 1) * (h + 30) + t * v) % (h + 30) - 15;
      var xx = ((h1(sd + 2) * span - (yy + t * v) * slant) % span + span) % span - 30, L = len + (h1(sd + 3) < 0.3 ? 1 : 0);
      for (var s = 0; s < L; s++) {
        var y = Math.round(yy) + s, x = Math.round(xx - s * slant); if (x < 0 || x >= w || y < 0 || y >= h) continue;
        if (clipLip && y >= lip[x]) break;
        d[y * w + x] = idx;
      }
    }
  }

  R.backdrop = function (fb, S, pal) {
    build(S);
    var G = geom(S), w = fb.w, h = fb.h, st = stormAt(S.altitude), n = G.n, t = S.reduced ? 0 : S.tSec, al = S.altitude;
    skyCache(S, G);
    fb.d.set(ST.sky);
    drawStars(fb, S, G, smooth((n - 0.28) / 0.5) * (1 - st), t);
    drawMeteor(fb, S, G, smooth((n - 0.28) / 0.5) * (1 - st), t);
    if (G.sunUp) drawSun(fb, S, G, t);
    if (st > 0.01) drawDeck(fb, S, G, st, t); else ST.deckY0 = null;
    drawBars(fb, S, G, st, t);
    var reach = w * (0.55 + 0.25 * (1 - st)), F = ST.layF, rr = ST.r, off = ST.off;
    blitRidge(fb, rr[0], al * 0.2 + off[0], G.hy + Math.round(F[0]) - rr[0].cm, I.r0, I.r0 + 1, I.sky + 11, G.lx, reach);
    if (ST.flash > 0.05 && !ST.sheet) drawBolt(fb, S, G);
    blitRidge(fb, rr[1], al * 0.4 + off[1], G.hy + Math.round(F[1]) - rr[1].cm, I.r1, I.r1 + 1, I.r0, G.lx, reach);
    blitRidge(fb, rr[2], al * 0.75 + off[2], G.hy + Math.round(F[2]) - rr[2].cm, I.r2, I.r2 + 1, I.r1, G.lx, reach);
    var y3 = G.hy + Math.round(F[3]) - rr[3].cm;
    blitRidge(fb, rr[3], al * 1.3 + off[3], y3, I.r3, I.r3 + 1, I.r2, G.lx, reach);
    if (y3 + rr[3].h < h) fb.fillRect(0, y3 + rr[3].h, w, h - y3 - rr[3].h, I.r3);
    drawNear(fb, S, G);
    drawBirds(fb, S, G, st, S.reduced ? 7 : S.tSec);
    if (st > 0.02) drawRain(fb, S, st, t, 0, false);
  };

  // ---------- ground: black earth, rim-lit crest, the underworld ----------
  function putU(fb, S, x, y, idx, m) {                                                // only below the crest
    if (x < 0 || x >= fb.w || y < 0 || y >= fb.h) return;
    if (y < S.lip[x] + (m == null ? 4 : m)) return;
    fb.d[y * fb.w + x] = idx;
  }
  function lineU(fb, S, x0, y0, x1, y1, idx, dotted) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, n = 0;
    for (var guard = 0; guard < 2000; guard++) {
      if (!dotted || (n++ & 1) === 0) putU(fb, S, x0, y0, idx);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function lipAt(S, sx) { return S.lip[clamp(Math.round(sx), 0, S.w - 1)]; }

  // ghostly relic bitmaps: '1' faint, '2' brighter (outline art)
  var RELIC = [
    ["..22222..", ".2111112.", "211111112", "21..1..12", "21..1..12", ".2111112.", "..21.12..", "..21212..", "...222..."],             // skull
    ["22.......22", "211.....112", ".21.....12.", "..21...12..", "...21.12...", "....212....", "...21.12...", "..21...12..", ".21.....12.", "211.....112", "22.......22"],   // crossed bones
    ["..222..", "...2...", ".2.1.2.", ".21112.", "2111112", "2111112", "2111112", ".21112.", ".21112.", "..212..", "...2...", "..222.."],   // amphora
    [".22222.", "2111112", "21.1.12", "2111112", "2111112", "21...12", ".21.12.", "..222.."],                                                   // a tragedy mask
    [".222.", "21112", "21.12", "21112", ".222."]                                                                                  // Charon's obol
  ];
  var CHARON = ["...........2.......", "..........222......", "..........212......", ".........2112......", "..2......2112......", "...2.....21112.....",
                "....2....21112.....", ".....2...211112....", "2222222222222222222", ".21111111111111112.", "..222222222222222.."];
  function relic(fb, S, x, y, k, flip) {
    var r = RELIC[k];
    for (var yy = 0; yy < r.length; yy++) for (var xx = 0; xx < r[yy].length; xx++) {
      var ch = r[yy].charAt(flip ? r[yy].length - 1 - xx : xx); if (ch === ".") continue;
      putU(fb, S, x + xx, y + yy, ch === "2" ? I.ghost + 1 : I.earth + 3, 6);
    }
  }
  // buried ruins are FILLED shapes (a shade lighter than the earth), lit faintly from above, with a ghost-bright top edge
  var UW = { fb: null, S: null, set: function (x, y, c) { putU(this.fb, this.S, x, y, c); } };
  function drum(fb, S, cx, cy, len, dia, ang, z, seed) {                          // a fallen, fluted column drum
    var L = len * z, D = dia * z; if (D < 3) return;
    var ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca, E = I.earth, G = I.ghost, nfl = Math.max(2, Math.round(D / 4));
    var ex = cx - ca * L / 2, ey = cy - sa * L / 2, fx = cx + ca * L / 2, fy = cy + sa * L / 2, pts = [], jag = [0, 0.35, -0.2, 0.3, -0.15, 0.22, 0];
    pts.push([ex + nx * D / 2, ey + ny * D / 2], [ex - nx * D / 2, ey - ny * D / 2]);
    for (var j = 0; j < jag.length; j++) { var tt = -1 + 2 * j / (jag.length - 1), jj = jag[(j + seed) % jag.length] * D * 0.45; pts.push([fx + ca * jj - nx * tt * D / 2, fy + sa * jj - ny * tt * D / 2]); }
    UW.fb = fb; UW.S = S;
    PX.poly(UW, pts, function (x, y) {
      var v = ((x + 0.5 - cx) * nx + (y + 0.5 - cy) * ny) / (D / 2);
      if (v < -0.78) return G + 1;
      if (v > 0.8) return E + 1;
      return (Math.floor((v + 1) * nfl) & 1) ? E + 2 : E + 3;
    });
    var er = D / 2, ea = Math.max(1.2, D * 0.2);                                        // the end face
    for (var yy = Math.floor(ey - er - 1); yy <= Math.ceil(ey + er + 1); yy++) for (var xx = Math.floor(ex - er - 1); xx <= Math.ceil(ex + er + 1); xx++) {
      var qx = xx + 0.5 - ex, qy = yy + 0.5 - ey, au = (qx * ca + qy * sa) / ea, an = (qx * nx + qy * ny) / er, q = au * au + an * an;
      if (q > 1) continue;
      putU(fb, S, xx, yy, q > 0.6 ? (an < 0 ? G + 1 : G) : (q < 0.05 ? E + 1 : E + 3));
    }
  }
  function columnUp(fb, S, cx, by, wd, ht, z, broken, seed) {                      // an upright column, fluted, with a Doric capital
    var W = Math.max(3, Math.round(wd * z)), Hc = Math.round(ht * z), x0 = Math.round(cx - W / 2), top = Math.round(by - Hc), E = I.earth, G = I.ghost, x, y;
    var capH = Math.max(2, Math.round(5 * z)), nfl = Math.max(2, Math.round(W / 3));
    for (y = top + capH; y <= by; y++) {
      var ent = (y - top) / Math.max(1, Hc) < 0.35 ? 0 : 0, bt = broken ? Math.round(Math.sin((x0 + seed) * 1.7) * 2) : 0;
      for (x = x0 - ent; x < x0 + W + ent; x++) {
        if (broken && y < top + capH + 2 + Math.abs(((x - x0) * 7 + seed) % 5) + bt) continue;
        var u = (x - x0) / W, tone = u < 0.12 ? G + 1 : u > 0.85 ? E + 1 : ((Math.floor(u * nfl * 2) & 1) ? E + 2 : E + 3);
        putU(fb, S, x, y, tone);
      }
    }
    if (!broken) {
      for (x = x0 - 2; x < x0 + W + 2; x++) { putU(fb, S, x, top, G + 1); putU(fb, S, x, top + 1, E + 3); }
      for (y = top + 2; y < top + capH; y++) for (x = x0 - 1; x < x0 + W + 1; x++) putU(fb, S, x, y, x === x0 - 1 ? G + 1 : E + 2);
    }
    for (x = x0 - 2; x < x0 + W + 2; x++) putU(fb, S, x, by + 1, E + 3);
  }
  function oldBoulder(fb, S, cx, cy, rad, z, seed) {                               // the stones of those who came before
    var r = rad * z, E = I.earth, G = I.ghost; if (r < 2) return;
    for (var y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (var x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      var dx = x + 0.5 - cx, dy = y + 0.5 - cy, a = Math.atan2(dy, dx), rr = r * (1 + 0.07 * Math.sin(a * 3 + seed) + 0.04 * Math.sin(a * 5 + seed * 2)), dd = Math.sqrt(dx * dx + dy * dy);
      if (dd > rr) continue;
      var lit = -(dx * 0.62 + dy * 0.78) / rr, edge = dd > rr - 1.2;
      var tone = edge ? (lit > 0.1 ? G + 1 : E + 1) : (lit > 0.45 ? E + 4 : lit > 0.05 ? E + 3 : lit > -0.45 ? E + 2 : E + 1);
      if (!edge && tone > E + 2 && BP[((y & 3) << 2) | (x & 3)] < 0.25) tone--;
      putU(fb, S, x, y, tone);
    }
    lineU(fb, S, cx - r * 0.35, cy - r * 0.6, cx - r * 0.05, cy - r * 0.12, E + 1);
    lineU(fb, S, cx - r * 0.05, cy - r * 0.12, cx + r * 0.32, cy + r * 0.02, E + 1);
  }

  R.ground = function (fb, S, pal) {
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, iz = 1 / zoom, sc = S.scroll, lipA = S.lip, G = ST.G, t = S.reduced ? 0 : S.tSec, x, y;
    var E = I.earth, ink = I.ink, lx = G.lx, st = stormAt(S.altitude);
    // 1) the earth, column by column: crest rim (hot near the light), then strata by world depth
    for (x = 0; x < w; x++) {
      var lip = lipA[x]; if (lip >= h) continue;
      var wxF = (x - S.ztx) * iz + sc;
      var wob = 3.5 * Math.sin(wxF * 0.0105 + 1.3) + 2 * Math.sin(wxF * 0.031 + 0.4) + Math.sin(wxF * 0.077), fold = 1 + 0.07 * Math.sin(wxF * 0.0041 + 2), ofc = (Math.floor(wxF / 5) & 255);
      var ln = x > 0 ? lipA[x - 1] : lip, rn = x < w - 1 ? lipA[x + 1] : lip, rimBot = Math.max(lip, Math.max(ln, rn) - 1);
      var far = Math.abs(x + 0.5 - lx) / w, lvl = 2.25 - far * 2.6 - st * 0.8, top = lvl + D1[x & 3] - 0.5;
      var tTop = top >= 1.5 ? 2 : top >= 0.5 ? 1 : 0;
      for (y = Math.max(0, lip); y <= rimBot && y < h; y++) d[y * w + x] = I.rim + tTop;
      y = rimBot + 1;
      var bo;
      if (y >= 0 && y < h) { bo = ((y & 3) << 2) | (x & 3); d[y * w + x] = (tTop >= 1 && BP[bo] < 0.5) ? I.rim + tTop - 1 : ink; }
      y++;
      if (y >= 0 && y < h) { bo = ((y & 3) << 2) | (x & 3); d[y * w + x] = (tTop === 2 && BP[bo] < 0.25) ? I.rim : ink; }
      y = Math.max(0, y + 1);
      var row = y * w + x, bx = x & 3, step = iz * fold, wxi = Math.floor(wxF), prevC = -1;
      for (; y < h; y++, row += w) {
        var Df = (y - lip) * step + wob, D0 = Df | 0; if (D0 < 0) D0 = 0; else if (D0 > MAXD) D0 = MAXD;
        var Di = D0 + OFFS[((D0 >> 3) & 63) * 256 + ofc]; if (Di < 0) Di = 0; else if (Di > MAXD) Di = MAXD;
        var cn = LCNT[Di];
        if (prevC >= 0 && cn > prevC) {                                            // crossed a stratum line on this row
          var ln2 = prevC, ds = LDASH[ln2];
          if (!ds || ((((wxi >> (ds + 1)) + ln2 * 3) & 3) !== 0)) { d[row] = LTONE[ln2]; prevC = cn; continue; }
        }
        prevC = cn;
        d[row] = BP[((y & 3) << 2) | bx] < TM[Di] ? TB[Di] : TA[Di];
      }
    }
    var wl = (0 - S.ztx) * iz + sc, wr = (w - S.ztx) * iz + sc, c;
    // 2) roots: branching threads hanging from the turf, thick near the top
    var rc = 58;
    for (c = Math.floor(wl / rc) - 1; c <= Math.ceil(wr / rc) + 1; c++) {
      if (h2(c, 5) < 0.4) continue;
      var px = c * rc + h2(c, 6) * rc, py = 3, len = 10 + Math.floor(h2(c, 7) * 20), drift = (h2(c, 8) - 0.5) * 1.4, pts = [px, py];
      for (var s = 0; s < len; s++) { px += (h2(c * 31 + s, 9) - 0.5) * 3 + drift; py += 2.4 + h2(c * 17 + s, 10) * 1.8; pts.push(px, py); }
      for (s = 0; s + 3 < pts.length; s += 2) {
        var sx0 = S.ztx + (pts[s] - sc) * zoom, sx1 = S.ztx + (pts[s + 2] - sc) * zoom, sy0 = lipAt(S, sx0) + pts[s + 1] * zoom, sy1 = lipAt(S, sx1) + pts[s + 3] * zoom;
        var col = s < pts.length * 0.5 ? E + 3 : E + 2;
        lineU(fb, S, sx0, sy0, sx1, sy1, col);
        if (s < pts.length * 0.3 && zoom > 0.34) lineU(fb, S, sx0 + 1, sy0, sx1 + 1, sy1, E + 2);
        if (s > 2 && h2(c * 13 + s, 11) < 0.3) {                                        // a side rootlet
          var bl = 4 + h2(c, s) * 9, bd = h2(c * 7, s) < 0.5 ? -1 : 1, ex = pts[s] + bd * bl, ey = pts[s + 1] + bl * 0.9, ssx = S.ztx + (ex - sc) * zoom;
          lineU(fb, S, sx0, sy0, ssx, lipAt(S, ssx) + ey * zoom, E + 2);
        }
      }
    }
    // 3) buried things (world-locked): small relics near the surface, fallen ruins lower down, old boulders deepest
    var rcell = 170;
    if (zoom > 0.3) for (c = Math.floor(wl / rcell) - 1; c <= Math.ceil(wr / rcell) + 1; c++) {
      if (h2(c, 21) < 0.55) continue;
      var rwx = c * rcell + h2(c, 22) * rcell * 0.8, rdu = 40 + h2(c, 23) * 70, rsx = S.ztx + (rwx - sc) * zoom; if (rsx < -16 || rsx > w + 16) continue;
      relic(fb, S, Math.round(rsx), Math.round(lipAt(S, rsx) + rdu * zoom), Math.floor(h2(c, 24) * RELIC.length) % RELIC.length, h2(c, 25) > 0.5);
    }
    var ucell = 430;
    for (c = Math.floor(wl / ucell) - 1; c <= Math.ceil(wr / ucell) + 1; c++) {
      if (h2(c, 31) < 0.3) continue;
      var uwx = c * ucell + h2(c, 32) * ucell * 0.7, udu = 120 + h2(c, 33) * 130, usx = S.ztx + (uwx - sc) * zoom; if (usx < -80 || usx > w + 80) continue;
      var usy = lipAt(S, usx) + udu * zoom; if (usy > h + 60) continue;
      var uk = h2(c, 34);
      if (uk < 0.6) drum(fb, S, usx, usy, 60 + h2(c, 35) * 34, 22 + h2(c, 36) * 8, (h2(c, 37) - 0.5) * 0.7 - S.slope * 0.4, zoom, c & 7);
      else columnUp(fb, S, usx, usy + 30 * zoom, 20, 52 + h2(c, 38) * 34, zoom, uk > 0.82, c & 7);
    }
    var bcell = 900;
    for (c = Math.floor(wl / bcell) - 1; c <= Math.ceil(wr / bcell) + 1; c++) {
      if (h2(c, 51) < 0.35) continue;
      var bwx2 = c * bcell + h2(c, 52) * bcell * 0.7, bdu = 300 + h2(c, 53) * 220, bsx = S.ztx + (bwx2 - sc) * zoom; if (bsx < -60 || bsx > w + 60) continue;
      var bsy = lipAt(S, bsx) + bdu * zoom; if (bsy > h + 40) continue;
      oldBoulder(fb, S, bsx, bsy, 26 + h2(c, 54) * 14, zoom, c);
    }
    // the ferryman: once in a long while his ghost boat drifts along the glowing seam
    var chc = 5200;
    for (c = Math.floor(wl / chc) - 1; c <= Math.ceil(wr / chc) + 1; c++) {
      if (h2(c, 71) < 0.5) continue;
      var cwx = c * chc + h2(c, 72) * chc * 0.6 + (S.reduced ? 0 : Math.sin(t * 0.05 + c) * 30), csx = Math.round(S.ztx + (cwx - sc) * zoom); if (csx < -24 || csx > w + 4) continue;
      var csy = Math.round(lipAt(S, csx + 9) + ((ST.deepStart || 250) + 50) * zoom + (S.reduced ? 0 : Math.sin(t * 0.9 + c) * 1.2)); if (csy > h || csy < 0) continue;
      for (var cy2 = 0; cy2 < CHARON.length; cy2++) for (var cx2 = 0; cx2 < CHARON[cy2].length; cx2++) {
        var cc2 = CHARON[cy2].charAt(cx2); if (cc2 === ".") continue;
        putU(fb, S, csx + cx2, csy - CHARON.length + cy2, cc2 === "2" ? I.ghost + 1 : I.ghost, 20);
      }
    }
    // 4) embers deep down: they drift up slowly and flicker (palette channels)
    var ec = 44, drow = ST.deepStart || 370, ezk = Math.min(1, (zoom / 0.55) * (zoom / 0.55));
    for (c = Math.floor(wl / ec) - 1; c <= Math.ceil(wr / ec) + 1; c++) {
      for (var er = 0; er < 12; er++) {
        var eh = h2(c * 5 + er, 41); if (eh < 1 - (er >= 2 && er <= 5 ? 0.2 : 0.07) * ezk) continue;
        var edu = drow + er * 44 + h2(c, er + 42) * 44 - ((t * (3 + eh * 5)) % 44), ewx = c * ec + h2(c, er + 43) * ec + Math.sin(t * 0.6 + c + er) * 2;
        var esx = Math.round(S.ztx + (ewx - sc) * zoom); if (esx < 0 || esx >= w) continue;
        var esy = Math.round(lipAt(S, esx) + edu * zoom); if (esy < 0 || esy >= h) continue;
        var ch = I.ember + 1 + (Math.floor(eh * 300) % 3);
        putU(fb, S, esx, esy, ch, 20);
        if (eh > 0.985 && zoom > 0.3) { putU(fb, S, esx - 1, esy, I.ember, 20); putU(fb, S, esx + 1, esy, I.ember, 20); putU(fb, S, esx, esy - 1, I.ember, 20); putU(fb, S, esx, esy + 1, I.ember, 20); }
      }
    }
    // 5) grass tufts and reeds: silhouettes along the crest, in patches, leaning with the wind
    var gc = 3.1, heroX = Math.round(S.ztx + S.anchorX * zoom), gust = S.windGust || 0, gz = zoom * 1.15;
    for (c = Math.floor(wl / gc) - 2; c <= Math.ceil(wr / gc) + 2; c++) {
      var dens = 0.2 + 0.62 * PX.vnoise(c * gc * 0.021, 1.7, 3.1), gh = h1(c * 2 + 1); if (gh > dens) continue;
      var bwx = c * gc + h1(c * 3 + 2) * gc, gx = Math.round(S.ztx + (bwx - sc) * zoom); if (gx < 1 || gx >= w - 1) continue;
      var near = Math.abs(gx - heroX) < 16 + 22 * zoom, gl = lipA[gx];
      var hb = Math.max(1, (1.6 + 4.2 * h1(c * 7) * h1(c * 11)) * gz); if (near) hb = Math.min(hb, 1.6);
      var sway = S.reduced ? 0 : (Math.sin(t * 1.9 + bwx * 0.05) * (0.35 + gust * 0.9) - gust * 2.2);
      var nb = 1 + Math.floor(h1(c * 13) * 3);
      for (var bj = 0; bj < nb; bj++) {
        var spread = (bj - (nb - 1) / 2), bh = Math.max(1, Math.round(hb * (spread === 0 ? 1 : 0.72))), rootX = gx + Math.round(spread);
        var tipLean = spread * 0.9 + sway;
        for (var kq = 1; kq <= bh; kq++) {
          var f = kq / bh, xx = rootX + Math.round(tipLean * f * f * Math.min(1.6, bh / 3)), yy = gl - kq;
          if (yy < 0 || xx < 0 || xx >= w) continue;
          d[yy * w + xx] = ink;
        }
      }
    }
    var rcl = 52;                                                                  // reeds: rare clusters, cattail heads
    for (c = Math.floor(wl / rcl) - 1; c <= Math.ceil(wr / rcl) + 1; c++) {
      if (h1(c * 5 + 77) < 0.58) continue;
      var rwx = c * rcl + h1(c * 3 + 78) * rcl, rx0 = Math.round(S.ztx + (rwx - sc) * zoom); if (rx0 < -4 || rx0 > w + 4) continue;
      if (Math.abs(rx0 - heroX) < 26 + 30 * zoom) continue;
      var nr = 2 + Math.floor(h1(c * 7 + 79) * 3);
      for (var ri = 0; ri < nr; ri++) {
        var rxx = rx0 + ri * 2 - nr + Math.round(h1(c * 11 + ri) * 2), rlip = lipA[clamp(rxx, 0, w - 1)], rh = Math.max(3, Math.round((12 + 14 * h1(c * 13 + ri)) * gz));
        var rsw = S.reduced ? 0 : (Math.sin(t * 1.6 + rwx * 0.04 + ri) * (0.5 + gust) - gust * 2.6) + (ri - nr / 2) * 0.5;
        for (var kr = 1; kr <= rh; kr++) {
          var fr = kr / rh, rxp = rxx + Math.round(rsw * fr * fr * 2.2), ryp = rlip - kr; if (ryp < 0 || rxp < 0 || rxp >= w) continue;
          d[ryp * w + rxp] = ink;
          if (kr > rh - 4 && kr < rh && (ri & 1) === 0 && rxp + 1 < w) d[ryp * w + rxp + 1] = ink;      // a cattail head
        }
      }
    }
  };

  // ---------- the near layer: giant cypresses and broken columns standing just behind the crest ----------
  // (drawn before the ground so the hero always stays in front; slower than the ground, faster than the ridges = depth)
  function nearSpan(fb, S, y, x0, x1, rimX, bodyIdx, rimIdx) {
    var w = fb.w, h = fb.h, d = fb.d; if (y < 0 || y >= h) return;
    x0 = Math.max(0, x0); x1 = Math.min(w - 1, x1);
    for (var x = x0; x <= x1; x++) d[y * w + x] = x === rimX ? rimIdx : bodyIdx;
  }
  function drawNear(fb, S, G) {
    var w = fb.w, h = fb.h, zoom = S.zoom, fs = S.scroll * 0.8, cell = 620, lx = G.lx, t = S.reduced ? 0 : S.tSec, gust = S.windGust || 0, U = G.U, body = I.r3, rim = I.r3 + 1;
    var k0 = Math.floor(((0 - S.ztx) / zoom + fs) / cell) - 1, k1 = Math.ceil(((w - S.ztx) / zoom + fs) / cell) + 1, y;
    for (var k = k0; k <= k1; k++) {
      if (h1(k * 9 + 5) < 0.45) continue;
      var fx = k * cell + h1(k * 3 + 1) * cell * 0.6, sx = Math.round(S.ztx + (fx - fs) * zoom), kind = h1(k * 7 + 2) < 0.72 ? 0 : 1;
      if (sx < -40 || sx > w + 40) continue;
      var base = S.lip[clamp(sx, 0, w - 1)] + Math.round(6 * U), rimSide = sx < lx ? 1 : -1, sc = Math.max(0.55, zoom * 1.35);
      if (kind === 0) {                                                               // a cluster of tall cypresses
        var n = 1 + Math.floor(h1(k * 17) * 3);
        for (var j = 0; j < n; j++) {
          var th = Math.round((46 + 30 * h1(k * 5 + j)) * U * sc), tw = Math.max(4, Math.round(th * 0.16)), cx = sx + Math.round((j - (n - 1) / 2) * tw * 1.1), top = base - th;
          var sway = S.reduced ? 0 : Math.sin(t * 0.8 + k + j) * (0.4 + gust * 1.5) - gust * 2;
          for (y = Math.max(0, top); y <= base; y++) {
            var tt = (y - top) / th, p = tt < 0.06 ? 0.08 : tt < 0.62 ? Math.pow(Math.sin(Math.min(1, (tt - 0.06) / 0.56) * Math.PI / 2), 1.1) : 1 - 0.18 * (tt - 0.62) / 0.38;
            var half = Math.max(0.5, tw * p / 2); if (tt > 0.12 && tt < 0.9 && ((y >> 2) & 3) === 1) half -= 1;
            var c2 = cx + Math.round(sway * (1 - tt) * (1 - tt) * 2), xa = Math.round(c2 - half), xb = Math.round(c2 + half);
            nearSpan(fb, S, y, xa, xb, rimSide > 0 ? xb : xa, body, rim);
          }
        }
      } else {                                                                        // a pair of broken columns with a lintel
        var cw = Math.max(3, Math.round(7 * U * sc)), gap = cw * 3, ch1 = Math.round((40 + 16 * h1(k * 13)) * U * sc), ch2 = Math.round(ch1 * (0.55 + 0.3 * h1(k * 19)));
        for (var q = 0; q < 2; q++) {
          var x0 = sx + (q ? gap : 0) - (cw >> 1), chh = q ? ch2 : ch1, top2 = base - chh;
          for (y = Math.max(0, top2 - 2); y <= base; y++) {
            var xl = x0, xr = x0 + cw - 1;
            if (y < top2 + 2) { if (q === 0) { xl -= 1; xr += 1; } else if (y < top2) continue; else xl += (y - top2) + 1; }   // capital / broken top
            nearSpan(fb, S, y, xl, xr, rimSide > 0 ? xr : xl, body, rim);
          }
        }
        for (y = base - ch1 - 4; y < base - ch1 - 1; y++) nearSpan(fb, S, y, sx - (cw >> 1) - 2, sx + Math.round(gap * 0.6), -99, body, rim);   // a surviving lintel end
      }
    }
  }

  // ---------- foreground: rain, splashes, fireflies ----------
  R.front = function (fb, S, pal, res) {
    var G = ST.G, w = fb.w, h = fb.h, st = stormAt(S.altitude), t = S.reduced ? 0 : S.tSec, n = G.n, i;
    if (res && ST.flash > 0.5) {                                                    // lightning: hero + stone become stark cut-outs, rims blaze
      var kf = clamp01((ST.flash - 0.5) / 0.35), AB = root.V8Actor ? root.V8Actor.ACTOR_BASE : 200;
      for (var sl = 1; sl <= 43; sl++) {                                            // (transient: the actor re-sets these entries every frame)
        var e = pal.rgb[AB + sl];
        if (sl === 9 || sl === 20 || sl === 43) pal.set(AB + sl, [e[0] + (246 - e[0]) * kf, e[1] + (246 - e[1]) * kf, e[2] + (255 - e[2]) * kf]);
        else pal.set(AB + sl, [e[0] + (6 - e[0]) * kf, e[1] + (5 - e[1]) * kf, e[2] + (10 - e[2]) * kf]);
      }
    }
    if (st > 0.02) {
      drawRain(fb, S, st, t, 1, false);
      drawRain(fb, S, st, t, 2, false);
      if (!S.reduced) {                                                             // splashes on the crest
        var slot = Math.floor(t * 9), ns = Math.round(18 * st * w / 480);
        for (i = 0; i < ns; i++) {
          var sx = Math.floor(h1(slot * 131 + i) * w), ph = (t * 9) % 1, sy = S.lip[sx] - 1; if (sy < 2 || sy >= h) continue;
          if (ph < 0.34) fb.set(sx, sy, I.rain + 2);
          else if (ph < 0.67) { fb.set(sx - 1, sy, I.rain + 1); fb.set(sx + 1, sy, I.rain + 1); fb.set(sx, sy - 1, I.rain + 2); }
          else { fb.set(sx - 2, sy - 1, I.rain + 1); fb.set(sx + 2, sy - 1, I.rain + 1); }
        }
      }
    }
    var fv = smooth((n - 0.45) / 0.25) * (1 - st);
    if (fv > 0.02 && !S.reduced) {                                                  // fireflies come out after dark
      var nf = Math.round(28 * w / 480), heroX = S.ztx + S.anchorX * S.zoom, heroY = S.zty + S.anchorY * S.zoom;
      for (i = 0; i < nf; i++) {
        if (h1(i * 5 + 3) > fv) continue;
        var span = w + 40, fx = ((h1(i * 4 + 1) * span + Math.sin(t * 0.37 + i * 1.3) * 14 - S.scroll * S.zoom * 0.12) % span + span) % span - 20;
        var ix = clamp(Math.round(fx), 0, w - 1), fy = S.lip[ix] - (6 + 30 * h1(i * 7 + 2)) * Math.max(0.6, S.zoom) + Math.sin(t * 0.9 + i * 1.7) * 3;
        var bx = Math.round(fx), by = Math.round(fy);
        if (Math.abs(bx - heroX) < 26 && Math.abs(by - heroY) < 40) continue;
        var bl = Math.sin(t * (1.2 + h1(i) * 1.3) + i * 2.1);
        if (bl < 0.15) continue;
        if (bl > 0.9) { fb.set(bx, by, I.fly + 2); fb.set(bx - 1, by, I.fly + 1); fb.set(bx + 1, by, I.fly + 1); fb.set(bx, by - 1, I.fly + 1); fb.set(bx, by + 1, I.fly + 1); fb.set(bx - 2, by, I.fly); fb.set(bx + 2, by, I.fly); fb.set(bx, by - 2, I.fly); fb.set(bx, by + 2, I.fly); fb.set(bx - 1, by - 1, I.fly); fb.set(bx + 1, by + 1, I.fly); fb.set(bx + 1, by - 1, I.fly); fb.set(bx - 1, by + 1, I.fly); }
        else if (bl > 0.72) { fb.set(bx, by, I.fly + 2); fb.set(bx - 1, by, I.fly); fb.set(bx + 1, by, I.fly); fb.set(bx, by - 1, I.fly); fb.set(bx, by + 1, I.fly); }
        else if (bl > 0.45) { fb.set(bx, by, I.fly + 1); if ((i + Math.floor(t * 4)) & 1) fb.set(bx + 1, by, I.fly); }
        else fb.set(bx, by, I.fly);
      }
    }
  };

  // ---------- QA hooks ----------
  // R.qaStrike()                 -> a strike on the next frame (works outside storms too)
  // R.qaStrike({at: t, x: 0.3})  -> a strike that started at time t, x as a fraction of the width
  // R.qaStrike({hold: 0.8})      -> freeze the flash at 0.8 (bolt drawn) until R.qaStrike({clear: true})
  R.qaStrike = function (o) {
    o = o || {};
    if (o.clear) { ST.hold = null; ST.force = null; ST.sStart = -99; ST.sheet = false; ST.lastT = -1e9; return "cleared"; }
    if (o.hold != null) { ST.hold = o.hold; ST.sheet = false; if (o.x != null) ST.sX = o.x; ST.bolt = null; ST.sSeed = (o.seed || 7) | 0; ST.lastT = -1e9; return "hold"; }
    if (o.at != null) { ST.sStart = o.at; ST.sheet = false; ST.sSeed = ((o.at * 1000) | 0) ^ 0x5bd1; ST.sX = o.x == null ? 0.5 : o.x; ST.bolt = null; ST.lastT = -1e9; return "at"; }
    ST.force = { x: o.x }; ST.lastT = -1e9; return "armed";
  };
  R.nightAt = nightAt; R.stormAt = stormAt;

  V8.register("dusk", R);
})(typeof window !== "undefined" ? window : this);
