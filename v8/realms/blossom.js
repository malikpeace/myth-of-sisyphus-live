// The Blossom - V8 scene. A cherry-blossom valley at a rose-gold sunset, generated entirely in code on the shared
// indexed framebuffer: a banded plum-to-peach sky wrapped around a low sun, lit cloud streaks and the first stars,
// misty layered ranges, a winding river catching the last light, cherry-forest hillsides, gnarled cherry trees at
// two depths (and giants sweeping past in front), a petal-strewn meadow over deep layered ground (roots, relics,
// rose quartz, and far below a warm glow), with petals drifting on the wind.
(function (root) {
  "use strict";
  var PX = root.PX, Sc = root.Sc, V8 = root.V8, hex = PX.hex, clamp = PX.clamp, clamp01 = PX.clamp01;
  var R = { rock: { mat: "warm", style: "granite" } }, I = {}, RX = {}, WATER = [], K = { key: "" }, CACHE = {}, CKEYS = [];
  var DITH = new Float32Array(16);
  (function () { for (var i = 0; i < 16; i++) DITH[i] = PX.BAYER4[i >> 2][i & 3]; })();
  function dth(x, y) { return DITH[((y & 3) << 2) | (x & 3)]; }
  function H(list) { return list.map(hex); }

  // ---- 256x256 periodic noise tiles: NT = white grain, VT = smooth value noise (both 0..255) ----
  var NT = new Uint8Array(65536), VT = new Uint8Array(65536);
  (function () {
    var i, x, y, g1 = new Float32Array(256), g2 = new Float32Array(1024);
    for (i = 0; i < 65536; i++) NT[i] = Math.floor(PX.ihash(i & 255, i >> 8, 77) * 256);
    for (i = 0; i < 256; i++) g1[i] = PX.ihash(i & 15, i >> 4, 91);
    for (i = 0; i < 1024; i++) g2[i] = PX.ihash(i & 31, i >> 5, 93);
    function lat(g, n, fx, fy) {
      var ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      var x0 = ix % n, x1 = (ix + 1) % n, y0 = (iy % n) * n, y1 = ((iy + 1) % n) * n;
      var a = g[y0 + x0], b = g[y0 + x1], c = g[y1 + x0], e = g[y1 + x1];
      return (a + (b - a) * tx) * (1 - ty) + (c + (e - c) * tx) * ty;
    }
    for (y = 0; y < 256; y++) for (x = 0; x < 256; x++) VT[y * 256 + x] = Math.floor((lat(g1, 16, x / 16, y / 16) * 0.64 + lat(g2, 32, x / 8, y / 8) * 0.36) * 255.99);
  })();
  function vt(x, y) { return VT[((y & 255) << 8) | (x & 255)]; }

  // ================================================================ palette
  R.init = function (pal, S) {
    // sky: deep plum overhead -> violet -> magenta -> rose -> peach -> cream (the top entries only appear around the sun)
    I.sky = pal.ramp("sky", H(["#140c26", "#1b0f2e", "#231236", "#2d153f", "#381848", "#451b51", "#531e59", "#632260", "#742766", "#872d6a", "#9a346d", "#ad3d6f", "#be4870", "#cd5571", "#da6573", "#e57876", "#ed8d7b", "#f4a581", "#f9be8c", "#fcd7a1", "#fff0c6"]));
    I.star = pal.ramp("star", H(["#d9b8d4", "#fff1f0"]));
    I.mtn = pal.ramp("mtn", H(["#3b1f4f", "#4a2659", "#5a2e63", "#6b366c", "#7d4074", "#904a7a", "#a4567f", "#b86383", "#cb7386", "#dc868a"]));
    WATER = [I.sky + 8, I.sky + 11, I.sky + 13, I.sky + 15, I.sky + 17, I.sky + 19];   // the river mirrors the sky: same colours
    I.glint = pal.ramp("glint", H(["#fde7c0", "#fff4da", "#fffcf0"]));
    I.hill = pal.ramp("hill", H(["#170e22", "#1f122c", "#281837", "#321e43", "#3d254f", "#4a2d5a", "#583666"]));
    I.val = I.hill + 2;                                                     // the valley floor shares the hill purples
    I.bloom = pal.ramp("bloom", H(["#3a1636", "#5c2148", "#842f5c", "#ab4371", "#cd5e88", "#e97fa0", "#f8a6ba", "#ffcac9", "#ffe9dc"]));
    I.bark = pal.ramp("bark", H(["#100910", "#1c1019", "#2d1822", "#41222a", "#583030", "#78463a", "#a0644a"]));
    I.grass = pal.ramp("grass", H(["#130d18", "#1b1621", "#212427", "#28322c", "#344032", "#4a5037", "#6a6a40", "#91864c"]));
    I.soil = pal.ramp("soil", H(["#0e080d", "#170c14", "#22111b", "#2e1722", "#3c1f29", "#4e2930"]));
    I.clay = pal.ramp("clay", H(["#2b1317", "#401e1e", "#572b26", "#70392e", "#8b4b39"]));
    I.rock = pal.ramp("rock", H(["#19131e", "#261e2b", "#352b3a", "#4a3d4b", "#62535e", "#7f6c74"]));
    I.glow = pal.ramp("glow", H(["#3a1115", "#611c16", "#922f19", "#c7521d", "#f28b32", "#ffc865"]));
    // relics borrow existing ramps: bone = stone greys into blossom cream, bronze/gold = clay into the glow, quartz = blossom
    RX.bone = [I.rock + 3, I.rock + 5, I.bloom + 7, I.bloom + 8]; RX.gold = [I.clay + 2, I.glow + 3, I.glow + 4, I.glow + 5];
    RX.clay = [I.clay, I.clay + 1, I.clay + 2, I.clay + 3, I.clay + 4]; RX.quartz = [I.bloom + 2, I.bloom + 4, I.bloom + 6];
    R.birdIdx = I.hill + 1;                                                  // flocks and the eagle: dark plum against the rose sky
    R.watcherIdx = I.hill;                                                   // the watcher: a plum-black silhouette against the valley haze
    R.pal = pal;
    build(S);
  };

  // per-frame palette life: river sparkles cycle, the first stars twinkle, the deep glow breathes
  var GL = H(["#f4a98b", "#fde7c0", "#fffcf0"]), STAR = H(["#8e5f93", "#f3d6e6", "#fff6f2"]), GLOWC = H(["#3a1115", "#611c16", "#922f19", "#c7521d", "#f28b32", "#ffc865"]);
  R.palette = function (pal, S) {
    if (!I.glint) return;
    var t = S.reduced ? 0 : S.tSec, ph = Math.floor(t * 5);
    for (var k = 0; k < 3; k++) pal.set(I.glint + k, GL[(k + ph) % 3]);
    var a = 0.5 + 0.5 * Math.sin(t * 2.3), b = 0.5 + 0.5 * Math.sin(t * 1.7 + 2.1);
    pal.set(I.star, PX.round3(PX.mix(STAR[0], STAR[1], a)));
    pal.set(I.star + 1, PX.round3(PX.mix(STAR[1], STAR[2], b)));
    var br = 0.92 + 0.08 * Math.sin(t * 0.9);
    for (k = 2; k < 6; k++) pal.set(I.glow + k, PX.round3([GLOWC[k][0] * br, GLOWC[k][1] * (0.96 + 0.04 * br), GLOWC[k][2]]));
  };

  // ================================================================ layout (all screen shapes)
  function layout(S, open) {
    var w = S.w, h = S.h, sh = Math.round((1 - open) * h * 0.12), hy = S.horizonY + sh;
    var hz = hy - Math.round(h * 0.075);                                   // foot of the far ranges = the true horizon
    var sunR = clamp(Math.round(Math.min(w, h) * 0.027), 5, 10);
    return { sh: sh, hy: hy, hz: hz, sunR: sunR, sunX: Math.round(w * 0.30), sunY: hz - Math.round(h * 0.075) - Math.round(sunR * 0.4) };
  }

  R.light = function (S) {
    var L = layout(S, S.openingT);
    return { x: L.sunX, y: L.sunY, k: 0.7, col: [255, 188, 148], ambient: [118, 62, 112], bright: 0.78, ground: [58, 50, 52] };
  };

  // ================================================================ build caches (per screen size)
  function build(S) {
    // caches are kept per frame size (palette indices never change between inits), so the menu-card thumbnail and the
    // live view can take turns initialising this realm without rebuilding each other's strips and trees
    var key = S.w + "x" + S.h + "|" + S.horizonY; if (K.key === key) return;
    if (CACHE[key]) { K = CACHE[key]; return; }
    K = CACHE[key] = { key: key, trees: {}, windAcc: 0, lastT: -1 }; CKEYS.push(key);
    if (CKEYS.length > 2) delete CACHE[CKEYS.shift()];
    var w = S.w, h = S.h, L = layout(S, 1);
    K.ext = Math.ceil(h * 0.12) + 2;
    buildSky(S, L);
    buildClouds(S, L);
    var Hm = clamp(Math.round(h * 0.17), 34, 90);
    // far ranges: the farthest stands still (it is far enough away) and parts around the sun; the others drift
    K.r1 = rangeStrip({ L: w, H: Hm, seed: 71, peaks: Math.max(3, Math.round(w / 110)), hMin: 0.35, hMax: 0.95, hPow: 1.3, sharp: 1.25, rough: 0.10, floor: 0.10, spurs: 2,
      tones: { deep: I.mtn + 6, shade: I.mtn + 7, body: I.mtn + 7, lit: I.mtn + 8, rim: I.mtn + 9, haze1: I.mtn + 8, haze2: I.mtn + 9 }, hazeFrom: 0.45, sunX: L.sunX, dip: { x: L.sunX, w: Math.max(14, L.sunR * 2.6), floor: (L.hz + 2) - (L.sunY + Math.round(L.sunR * 0.35)) } });
    K.r2 = rangeStrip({ L: 1280, H: Math.round(h * 0.062), seed: 83, peaks: 13, hMin: 0.3, hMax: 0.85, sharp: 1.15, rough: 0.12, floor: 0.12, spurs: 3,
      tones: { deep: I.mtn + 4, shade: I.mtn + 5, body: I.mtn + 5, lit: I.mtn + 6, rim: I.mtn + 8, haze1: I.mtn + 7, haze2: I.mtn + 8 }, hazeFrom: 0.40, litLeft: true });
    K.r3 = rangeStrip({ L: 1024, H: Math.round(h * 0.042), seed: 97, peaks: 10, hMin: 0.35, hMax: 0.9, sharp: 1.3, rough: 0.14, floor: 0.16, spurs: 3,
      tones: { deep: I.mtn + 2, shade: I.mtn + 3, body: I.mtn + 3, lit: I.mtn + 4, rim: I.mtn + 6, haze1: I.mtn + 5, haze2: I.mtn + 6 }, hazeFrom: 0.35, litLeft: true });
    K.valH = Math.max(18, Math.round(h * 0.13));
    K.val = valleyStrip(1536, K.valH, 5);
    // cherry-forest hillsides, far -> near (each darker, bigger and less hazy than the one behind it)
    var u = h / 300;
    K.hA = hillStrip({ L: Math.max(768, Math.round(w * 1.3)), H: Math.round(h * 0.26), seed: 11, crest: Math.round(5 * u), amp: 4 * u, rMin: 1.5, rMax: Math.max(2.2, 2.6 * u), pine: 0.25, pack: 1.3, pink: 0.55,
      body: [I.mtn + 3, I.mtn + 4, I.mtn + 5], dark: [I.mtn + 3, I.mtn + 4, I.mtn + 5], bloom: [I.mtn + 6, I.bloom + 4, I.bloom + 5], pineP: [I.mtn + 2, I.mtn + 4], fadeIdx: [I.mtn + 5, I.mtn + 6], fadeFrom: 0.3 });
    K.hB = null; K.hC = null; K.mkB = function () { return hillStrip({ L: 1024, H: Math.round(h * 0.34), seed: 23, crest: Math.round(7 * u), amp: 6 * u, rMin: 2.2, rMax: Math.max(3, 4.2 * u), pine: 0.22, pack: 1.25, pink: 0.5,
      body: [I.hill + 3, I.hill + 4, I.hill + 5], dark: [I.hill + 3, I.hill + 4, I.hill + 5, I.hill + 6], bloom: [I.bloom + 2, I.bloom + 3, I.bloom + 4, I.bloom + 5], pineP: [I.hill + 2, I.hill + 5], fadeIdx: [I.mtn + 3, I.mtn + 4], fadeFrom: 0.42 }); };
    K.mkC = function () { return hillStrip({ L: 1280, H: Math.round(h * 0.52), seed: 37, crest: Math.round(9 * u), amp: 9 * u, rMin: 3.2, rMax: Math.max(4.5, 7 * u), pine: 0.2, pack: 1.2, pink: 0.45,
      body: [I.hill + 0, I.hill + 1, I.hill + 2], dark: [I.hill + 1, I.hill + 2, I.hill + 3, I.hill + 4], bloom: [I.bloom + 1, I.bloom + 2, I.bloom + 3, I.bloom + 4, I.bloom + 5], pineP: [I.hill + 0, I.hill + 3], fadeIdx: null, fadeFrom: 1 }); };
    K.crB = Math.round(7 * u); K.crC = Math.round(9 * u);
    // cherry tree slot -> palette lookups (near = full colour, far = paler and lower in contrast)
    K.lutNear = new Uint8Array(32); K.lutFar = new Uint8Array(32); K.lutGiant = new Uint8Array(32);
    for (var s = 0; s < 7; s++) { K.lutNear[1 + s] = I.bark + s; K.lutGiant[1 + s] = I.bark + Math.max(0, s - 1); K.lutFar[1 + s] = I.hill + [2, 3, 3, 4, 5, 6, 6][s]; }
    for (s = 0; s < 9; s++) { K.lutNear[8 + s] = I.bloom + s; K.lutGiant[8 + s] = I.bloom + s; K.lutFar[8 + s] = I.bloom + [2, 3, 3, 4, 4, 5, 5, 6, 7][s]; }
    K.lutNear[17] = I.bloom + 7; K.lutFar[17] = I.bloom + 6; K.lutGiant[17] = I.bloom + 7;
    K.trees = {}; K.nTrees = 0;
    K.giants = [null, null]; K.gH = [Math.round(Math.min(h * 1.28, w * 1.9 + h * 0.2)), Math.round(Math.min(h * 1.12, w * 1.7 + h * 0.2))];
    var gg = cherryGeom(505, true); K.g0x = Math.round(w * 0.56) + Math.round(-gg.x0 * K.gH[0] / (0 - gg.y0));
  }

  // ---------------------------------------------------------------- sky (static: banded glow + sun + stars)
  function buildSky(S, L) {
    var w = S.w, h = S.h, ext = K.ext, H2 = h + ext, sky = new Uint8Array(w * H2), lev = new Uint8Array(w * H2);
    var hz = L.hz, sx = L.sunX, sy = L.sunY, sr = L.sunR, x, y, vy;
    var ax = 1 / (w * 0.5), ay = 1 / (h * 0.30), s2 = 1 / (2 * Math.pow(sr * 3.3, 2)), GX1 = new Float32Array(w), GX2 = new Float32Array(w);
    for (x = 0; x < w; x++) { var gxd = (x - sx) * ax; GX1[x] = 3.1 * Math.exp(-gxd * gxd * 1.5); GX2[x] = 2.0 * Math.exp(-(x - sx) * (x - sx) * s2); }
    for (vy = 0; vy < H2; vy++) {
      y = vy - ext;
      if (y > hz + 3) { sky.fill(I.sky + 15, vy * w, vy * w + w); lev.fill(185, vy * w, vy * w + w); continue; }
      var u = clamp01((hz - y) / hz), vv = y > hz ? 15.4 : 0.35 + 15.05 * Math.pow(1 - u, 1.65), gyd = (y - sy) * ay, GY1 = Math.exp(-gyd * gyd * 1.95), GY2 = Math.exp(-(y - sy) * (y - sy) * s2);
      for (x = 0; x < w; x++) {
        var v = vv + GX1[x] * GY1 + GX2[x] * GY2;
        if (v > 18.7) v = 18.7;
        var o = vy * w + x; lev[o] = Math.round(v * 12);
        var lv = Math.floor(v), f = v - lv;
        if (f > 0.6 && DITH[((y & 3) << 2) | (x & 3)] + 0.5 < (f - 0.6) / 0.4) lv++;
        sky[o] = I.sky + Math.min(20, lv);
      }
    }
    // stars in the deep plum overhead
    for (vy = 0; vy < H2; vy++) {
      y = vy - ext; if (lev[vy * w] > 7 * 12 && lev[vy * w + w - 1] > 7 * 12) break;
      for (x = 0; x < w; x++) {
        var o2 = vy * w + x; if (lev[o2] > 3.4 * 12) continue;
        var hs = (NT[((y & 255) << 8) | (x & 255)] * 256 + NT[(((y + 97) & 255) << 8) | ((x * 3 + 41) & 255)]) / 65536;
        if (hs > 0.9982) {
          sky[o2] = hs > 0.9994 ? I.star + 1 : I.star;
          if (hs > 0.99975 && x > 1 && x < w - 2 && vy > 1 && vy < H2 - 2) { sky[o2 - 1] = I.sky + 6; sky[o2 + 1] = I.sky + 6; sky[o2 - w] = I.sky + 6; sky[o2 + w] = I.sky + 6; sky[o2] = I.star + 1; }
        }
      }
    }
    // the sun: a small hot disc, a rim, two thin bands of haze across its lower half
    for (y = sy - sr - 1; y <= sy + sr + 1; y++) for (x = sx - sr - 1; x <= sx + sr + 1; x++) {
      if (x < 0 || x >= w) continue;
      vy = y + ext; if (vy < 0 || vy >= H2) continue;
      var ddx = x + 0.5 - sx, ddy = y + 0.5 - sy, dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist > sr) continue;
      var ry = y - sy, tone = dist <= sr * 0.58 ? 20 : dist <= sr * 0.86 ? 19 : 18;
      if (ry === Math.round(sr * 0.34) || ry === Math.round(sr * 0.68)) tone = 17;
      sky[vy * w + x] = I.sky + tone;
    }
    K.sky = sky; K.lev = lev;
  }

  // ---------------------------------------------------------------- cloud streaks (relative to the sky they sit in)
  // a sunset cloud: flat, sun-lit underside; a lumpy top made of rounded bumps; thin wisps trailing off both ends.
  // Roles: 1 = shaded top edge, 2 = body, 3 = lit underside, 4 = the warmest inner rim (sunward half)
  function streak(seed, len, th) {
    var rnd = PX.rng(seed), Hs = th + 4, sp = { w: len, h: Hs, d: new Uint8Array(len * Hs) }, x, y, k;
    var n = 2 + Math.floor(rnd() * 3) + Math.floor(len / 70), bumps = [], base = Hs - 2;
    for (k = 0; k < n; k++) bumps.push({ cx: len * (0.16 + 0.68 * (k + 0.2 + 0.6 * rnd()) / n), hw: len * (0.09 + 0.13 * rnd()) + 3, t: th * (0.35 + 0.65 * rnd() * rnd() + 0.2 * (k === (n >> 1) ? 1 : 0)) });
    for (x = 0; x < len; x++) {
      var top = 99, ends = Math.min(x, len - 1 - x) / (len * 0.18);
      for (k = 0; k < n; k++) { var uu = (x - bumps[k].cx) / bumps[k].hw; if (uu * uu >= 1) continue; var hh = bumps[k].t * Math.sqrt(1 - uu * uu) * Math.min(1, ends + 0.25); if (base - hh < top) top = base - hh; }
      var b2 = base + (((x * 7 + seed) % 23) < 4 ? 1 : 0);
      if (top > 90) { if (ends < 1.6 && rnd() < 0.75) sp.d[b2 * len + x] = 2; continue; }   // the wisp: a broken 1-px line
      var ty = Math.max(0, Math.round(top));
      for (y = ty; y <= b2; y++) {
        var role = y === b2 ? 3 : (y === ty && b2 - ty >= 2 ? 1 : 2);
        if (role === 2 && y === b2 - 1 && x < len * 0.55) role = 4;
        sp.d[y * len + x] = role;
      }
    }
    return sp;
  }
  function buildClouds(S, L) {
    var w = S.w, rnd = PX.rng(4242), n = Math.round(4 + w / 70), sc = clamp(w / 480, 0.6, 1.4);
    K.clouds = [];
    for (var i = 0; i < n; i++) {
      var yf = 0.12 + 0.86 * Math.pow(rnd(), 0.75);
      var cy = Math.round(yf * (L.hz - 16)), len = Math.round((50 + rnd() * 170) * (0.55 + 0.7 * yf) * sc), th = 3 + Math.round((rnd() * 4 + yf * 5) * clamp(S.h / 300, 0.75, 1.3));
      K.clouds.push({ sp: streak(900 + i * 31, len, th), x: rnd() * (w + 400), y: cy, v: 0.5 + rnd() * 1.3, yf: yf });
    }
  }
  function drawClouds(fb, S, L, t) {
    var w = fb.w, h = fb.h, d = fb.d, lev = K.lev, ext = K.ext, al = S.altitude;
    for (var i = 0; i < K.clouds.length; i++) {
      var c = K.clouds[i], sp = c.sp, span = w + sp.w + 80;
      var x0 = Math.round(((c.x - t * c.v - al * (0.04 + 0.06 * c.yf)) % span + span) % span) - sp.w - 40, y0 = c.y + L.sh;
      var hf = c.yf, dBody = 2.2 - 4.4 * hf, dLit = 4.2 - 1.0 * hf, dTop = 0.8 - 4.4 * hf, dRim = 3.2 - 1.6 * hf;
      for (var yy = 0; yy < sp.h; yy++) {
        var y = y0 + yy; if (y < 0 || y >= h) continue;
        var vrow = (y - L.sh + ext) * w, srow = yy * sp.w, drow = y * w;
        for (var xx = 0; xx < sp.w; xx++) {
          var role = sp.d[srow + xx]; if (!role) continue;
          var x = x0 + xx; if (x < 0 || x >= w) continue;
          var v = lev[vrow + x] / 12 + (role === 3 ? dLit : role === 2 ? dBody : role === 4 ? dRim : dTop);
          d[drow + x] = I.sky + clamp(Math.floor(v + DITH[((y & 3) << 2) | (x & 3)] * 0.9), 0, 19);
        }
      }
    }
  }

  // ---------------------------------------------------------------- misty mountain ranges
  // Peaks get a spine (sun-facing side lit, far side shaded) and a few spurs that split each face into alternating
  // wedges; sun-facing crests carry a bright rim; the foot of the range dissolves into haze with an ordered dither.
  function rangeStrip(o) {
    var Lw = o.L, Hh = o.H, st = Sc.newStrip(Lw, Hh), d = st.d, rnd = PX.rng(o.seed), n = o.peaks, T = o.tones, i, x, y, k, g;
    var peaks = [];
    for (i = 0; i < n; i++) {
      var span = Lw / n, pk = { x: (i + 0.15 + 0.7 * rnd()) * span, h: Hh * (o.hMin + (o.hMax - o.hMin) * Math.pow(rnd(), o.hPow || 1)), w: span * (0.85 + 1.0 * rnd()), spine: (rnd() - 0.5) * 0.6, sp: [] };
      for (g = 0; g < (o.spurs || 0); g++) {
        var sa = (rnd() - 0.5) * 2.1, spo = { a: sa, len: 0.3 + 0.6 * rnd(), wob: rnd() * 6.283, off: new Float32Array(Hh + 1) }, ta = Math.tan(sa);
        for (var q0 = 0; q0 <= Hh; q0++) spo.off[q0] = ta * q0 * (0.55 + 0.45 * Math.min(1, q0 / 18)) + Math.sin(q0 * 0.21 + spo.wob) * 1.1;
        pk.sp.push(spo);
      }
      pk.ts = Math.tan(pk.spine);
      pk.sp.sort(function (p, q) { return p.a - q.a; });
      peaks.push(pk);
    }
    var jit = Sc.periodic(Lw, o.seed * 7 + 1), jit2 = Sc.periodic(Lw, o.seed * 13 + 5);
    var top = new Int16Array(Lw), dom = new Int16Array(Lw);
    for (x = 0; x < Lw; x++) {
      var best = 0, bi = 0, j1 = jit(x), j2 = jit2(x);
      for (i = 0; i < n; i++) for (k = -1; k <= 1; k++) {
        var ad = Math.abs(x - (peaks[i].x + k * Lw)); if (ad >= peaks[i].w) continue;
        var prof = Math.pow(1 - ad / peaks[i].w, o.sharp);
        var f = peaks[i].h * prof * (1 + o.rough * j1 * (0.5 + prof)) + 1.8 * j2 * prof;
        if (f > best) { best = f; bi = i; }
      }
      best = Math.max(best, Hh * o.floor * (0.75 + 0.25 * jit(x + 57)));
      if (o.dip) { var q = (x - o.dip.x) / o.dip.w, wgt = Math.exp(-q * q * 0.7); best = best * (1 - wgt) + Math.min(best, o.dip.floor + Math.abs(q) * 3) * wgt; }
      top[x] = clamp(Math.round(Hh - best), 0, Hh - 1); dom[x] = bi;
    }
    for (x = 0; x < Lw; x++) {
      var p = peaks[dom[x]], px = p.x; if (x - px > Lw / 2) px += Lw; else if (px - x > Lw / 2) px -= Lw;
      var apexY = Hh - p.h, litLeft = o.sunX != null ? px > o.sunX : !!o.litLeft;
      for (y = top[x]; y < Hh; y++) {
        var tt = Math.max(0, y - apexY), d0 = y - top[x], left = x < px + p.ts * tt, lit = left === litLeft, ti = Math.min(Hh, Math.round(tt));
        var wedge = 0, onSp = false;
        for (g = 0; g < p.sp.length; g++) {
          var s = p.sp[g], gx = px + s.off[ti];
          if (x >= gx) wedge++;
          if (tt <= s.len * p.h && Math.abs(x - gx) < 0.55) onSp = true;
        }
        var alt = (wedge & 1) === 1, idx = lit ? (alt ? T.body : T.lit) : (alt ? T.deep : T.shade);
        if (onSp) idx = lit ? T.body : T.deep;
        if (d0 === 0) idx = lit ? T.rim : T.body;
        var hzf = (y / Hh - o.hazeFrom) / (1 - o.hazeFrom);
        if (hzf > 0) { var bb = DITH[((y & 3) << 2) | (x & 3)] + 0.5; if (bb < hzf * 1.1) idx = T.haze1; if (bb < (hzf - 0.5) * 2.0) idx = T.haze2; }
        d[y * Lw + x] = idx;
      }
    }
    return st;
  }

  // ---------------------------------------------------------------- valley floor with the winding river
  function valleyStrip(Lw, Hv, seed) {
    var st = Sc.newStrip(Lw, Hv), d = st.d, rnd = PX.rng(seed), x, y, k;
    var VAL = [I.val, I.val + 1, I.val + 2, I.val + 3, I.val + 4, I.mtn + 5, I.mtn + 6, I.mtn + 7, I.mtn + 8];
    for (y = 0; y < Hv; y++) {
      var t = y / (Hv - 1);
      for (x = 0; x < Lw; x++) {
        var patch = vt(x >> 1, y * 3 + 17) / 255;
        var lv = 8.2 - Math.pow(t, 0.55) * 8.0 + (patch - 0.5) * 1.4 + DITH[((y & 3) << 2) | (x & 3)] * 0.9;
        d[y * Lw + x] = VAL[clamp(Math.floor(lv), 0, 8)];
      }
    }
    // tree lines and hedgerows: thin dark strokes across the fields, hazier with distance
    var nLines = Math.round(Lw * Hv / 260);
    for (k = 0; k < nLines; k++) {
      y = 1 + Math.floor(Math.pow(rnd(), 0.9) * (Hv - 2)); x = Math.floor(rnd() * Lw);
      var tl = y / Hv, len = Math.round((6 + rnd() * 30) * (0.5 + tl)), col = tl < 0.28 ? I.mtn + 5 : tl < 0.55 ? I.mtn + 3 : I.val + 1, lit = tl < 0.28 ? I.mtn + 7 : tl < 0.55 ? I.mtn + 5 : I.val + 3;
      for (var q = 0; q < len; q++) { var xq = (x + q) % Lw, yq = y + Math.round(Math.sin((x + q) * 0.07 + k) * 0.6); if (yq < 1 || yq >= Hv) continue; d[yq * Lw + xq] = col; if (tl > 0.4 && rnd() < 0.5) d[(yq - 1) * Lw + xq] = lit; }
    }
    // the river's course: long lazy meanders that swing toward us (wide, darker reflection) and away (thin, bright)
    var TAU = Math.PI * 2, ph1 = rnd() * TAU, ph2 = rnd() * TAU, ph3 = rnd() * TAU, yc = new Float32Array(Lw), th = new Float32Array(Lw), wmax = Math.max(3, Hv * 0.16);
    for (x = 0; x < Lw; x++) {
      var c = clamp01(0.5 + 0.3 * Math.sin(TAU * 2 * x / Lw + ph1) + 0.16 * Math.sin(TAU * 5 * x / Lw + ph2) + 0.03 * Math.sin(TAU * 11 * x / Lw + ph3));
      yc[x] = Hv * (0.1 + 0.72 * c); th[x] = 1 + (wmax - 1) * Math.pow(c, 1.7);
    }
    // groves: tiny cherry crowns (pink) and dark cypress ticks, bigger toward us, gathered by a grove mask, clear of the water
    var nTrees = Math.round(Lw * Hv / 24);
    for (k = 0; k < nTrees; k++) {
      x = Math.floor(rnd() * Lw); y = Math.floor(Math.pow(rnd(), 0.8) * Hv);
      var tt = y / Hv, grove = vt(x >> 2, 99 + (y >> 1)) / 255;
      if (grove < 0.52 + 0.1 * rnd()) continue;
      if (y > yc[x] - th[x] - 2 && y < yc[x] + th[x] + 3) continue;
      var s = tt < 0.25 ? 0 : tt < 0.55 ? 1 : tt < 0.8 ? 2 : 3;
      if (rnd() < 0.32) {                                                  // cypress
        var ch = 1 + s + (rnd() < 0.5 ? 1 : 0);
        for (var j = 0; j < ch; j++) { var yy = y - j; if (yy >= 0) d[yy * Lw + x] = tt < 0.3 ? I.mtn + 4 : I.val; }
      } else {                                                            // cherry crown
        var P = tt < 0.3 ? [I.mtn + 7, I.bloom + 5] : tt < 0.6 ? [I.bloom + 3, I.bloom + 5] : [I.bloom + 2, I.bloom + 4, I.bloom + 6];
        var cw = 1 + s, chh = Math.max(1, s);
        for (var a = 0; a < chh; a++) for (var b = 0; b <= cw; b++) {
          if ((a === 0 && (b === 0 || b === cw) && cw > 1)) continue;
          var xx = (x + b) % Lw, y2 = y - a; if (y2 < 0) continue;
          d[y2 * Lw + xx] = P[Math.min(P.length - 1, a === chh - 1 && b < cw ? P.length - 1 : (b === cw ? 0 : 1))];
        }
      }
    }
    for (x = 0; x < Lw; x++) {
      var x1 = (x + 1) % Lw, ya = Math.min(yc[x], yc[x1]) - th[x] * 0.5, yb = Math.max(yc[x], yc[x1]) + th[x] * 0.5;
      var y0 = Math.round(ya), y1 = Math.max(y0, Math.round(yb) - 1), near = clamp01((yc[x] / Hv - 0.1) / 0.72);
      if (y0 - 1 >= 0) d[(y0 - 1) * Lw + x] = near < 0.35 ? I.mtn + 5 : I.val + 2;          // the far bank, a dark line above the bright water
      for (y = y0; y <= y1; y++) {
        if (y < 0 || y >= Hv) continue;
        var edgeRow = (y === y0 || y === y1) && y1 - y0 >= 2;
        var rip = Math.sin(x * 0.31 + y * 2.3 + Math.sin(x * 0.05) * 3) * 0.6;
        var wl = 5.3 - near * 2.3 + rip + DITH[((y & 3) << 2) | (x & 3)] * 0.7 - (edgeRow ? 1.2 : 0) - (y === y1 && y1 > y0 ? 0.6 : 0);
        var idx = WATER[clamp(Math.floor(wl), 0, 5)];
        if (!edgeRow && PX.ihash(x, y, 606) > 0.955) idx = I.glint + ((x * 7 + y * 3) % 3);
        d[y * Lw + x] = idx;
      }
      if (y1 + 1 < Hv) d[(y1 + 1) * Lw + x] = I.val;                        // shaded near bank
      if (y1 + 2 < Hv && near > 0.5) d[(y1 + 2) * Lw + x] = I.val + 1;
    }
    // paddies and pools near the river: tiny slivers of sky lying in the fields
    var nPools = Math.round(Lw * Hv / 520);
    for (k = 0; k < nPools; k++) {
      x = Math.floor(rnd() * Lw); var yp = Math.round(yc[x] + (rnd() - 0.5) * Hv * 0.5); if (yp < 2 || yp >= Hv - 1) continue;
      if (Math.abs(yp - yc[x]) < th[x] + 2) continue;
      var tp = yp / Hv, pl = 2 + Math.round(rnd() * 5 * (0.4 + tp));
      for (var q2 = 0; q2 < pl; q2++) { var xp = (x + q2) % Lw; d[yp * Lw + xp] = WATER[(tp < 0.4 ? 3 : 2) - (q2 === 0 || q2 === pl - 1 ? 1 : 0)]; d[(yp + 1) * Lw + xp] = I.val; }
    }
    st.yc = yc; st.th = th;
    return st;
  }

  // ---------------------------------------------------------------- cherry-forest hillsides
  function canopyBlob(st, cx, cy, r, P, seed) {
    var Lw = st.w, Hh = st.h, d = st.d, rx = r * 1.12, ry = r * 0.92, irx = 1 / rx, iry = 1 / ry, np = P.length - 1;
    var ya = Math.max(0, Math.floor(cy - ry - 1)), yb = Math.min(Hh - 1, Math.ceil(cy + ry)), xa = Math.floor(cx - rx - 1), xb = Math.ceil(cx + rx + 1);
    for (var yy = ya; yy <= yb; yy++) {
      var ny = (yy + 0.5 - cy) * iry, ny2 = ny * ny, row = yy * Lw, nrow = ((yy + seed) & 255) << 8, drow = (yy & 3) << 2;
      if (ny2 > 1.25) continue;
      for (var xx = xa; xx <= xb; xx++) {
        var nx = (xx + 0.5 - cx) * irx, q = nx * nx + ny2;
        if (q > 0.75 + NT[nrow | ((xx + seed) & 255)] * 0.00196) continue;
        var v = np * (0.42 - 0.42 * (nx * 0.78 + ny * 0.62)) + DITH[drow | (xx & 3)] * 0.9 - (ny > 0.55 ? 0.7 : 0), k = Math.round(v);
        d[row + (xx < 0 ? xx + Lw : xx >= Lw ? xx - Lw : xx)] = P[k < 0 ? 0 : k > np ? np : k];
      }
    }
  }
  function cypress(st, cx, cy, r, P) {
    var Lw = st.w, Hh = st.h, d = st.d, hgt = Math.max(3, Math.round(r * 2.7)), hw = Math.max(1, r * 0.62);
    for (var k = 0; k < hgt; k++) {
      var yy = cy + Math.round(r * 0.7) - hgt + k; if (yy < 0 || yy >= Hh) continue;
      var tt = k / hgt, half = Math.max(0, Math.round(hw * Math.min(1, tt * 1.6) - ((k % 3) === 0 ? 0.5 : 0)));
      for (var dx = -half; dx <= half; dx++) d[yy * Lw + ((((cx + dx) % Lw) + Lw) % Lw)] = (dx === -half && half > 0) ? P[1] : P[0];
    }
  }
  function hillStrip(o) {
    var Lw = o.L, Hh = o.H, st = Sc.newStrip(Lw, Hh), d = st.d, rnd = PX.rng(o.seed), x, y;
    var p1 = Sc.periodic(Lw, o.seed * 3 + 2), p2 = Sc.periodic(Lw, o.seed * 5 + 9), B = o.body;
    var crest = new Int16Array(Lw);
    for (x = 0; x < Lw; x++) crest[x] = Math.round(o.crest + o.amp * (0.72 * p1(x) + 0.28 * p2(x)));
    for (x = 0; x < Lw; x++) for (y = Math.max(0, crest[x]); y < Hh; y++) {
      var dd = y - crest[x], lv = 1.2 - dd / (Hh * 0.8) + (vt(x, y * 2 + o.seed) / 255 - 0.5) * 0.9 + DITH[((y & 3) << 2) | (x & 3)] * 0.8;
      d[y * Lw + x] = B[clamp(Math.round(lv), 0, B.length - 1)];
    }
    // crowns packed in rows: the first row makes the skyline; pink blossom gathers in groves, the rest are dusky greens gone violet
    var rowStep = Math.max(2, o.rMax * 1.1), nRows = Math.ceil((Hh - o.crest + o.amp) / rowStep) + 1;
    for (var row = 0; row < nRows; row++) {
      var fade = row / nRows;
      x = rnd() * o.rMax * 2;
      while (x < Lw) {
        var r = o.rMin + (o.rMax - o.rMin) * rnd(), cx = Math.round(x), cy = crest[cx % Lw] + Math.round(row * rowStep + (rnd() - 0.3) * rowStep * 0.7);
        var grove = vt(cx >> 3, 60 + o.seed) / 255;
        if (rnd() > fade * 0.6) {
          if (rnd() < o.pine) cypress(st, cx, cy, r, o.pineP);
          else canopyBlob(st, cx, cy, r, (grove > 0.52 && rnd() < o.pink) ? o.bloom : o.dark, (cx * 7 + cy * 3) & 255);
        }
        x += r * o.pack * (0.75 + 0.6 * rnd());
      }
    }
    if (o.fadeIdx) for (y = Math.round(Hh * o.fadeFrom); y < Hh; y++) {
      var amt = (y - Hh * o.fadeFrom) / (Hh * (1 - o.fadeFrom));
      for (x = 0; x < Lw; x++) {
        if (!d[y * Lw + x]) continue;
        var bb = DITH[((y & 3) << 2) | (x & 3)] + 0.5;
        if (bb < amt * 1.2) d[y * Lw + x] = bb < (amt - 0.45) * 1.8 ? o.fadeIdx[1] : o.fadeIdx[0];
      }
    }
    st.crest0 = o.crest;
    return st;
  }

  // ================================================================ the cherry tree (sprite with tone SLOTS)
  // Geometry is grown once per seed in UNIT space (height ~100) and rasterised natively at any pixel height, so the same
  // tree keeps its shape at every zoom. Slots: 1..7 bark (crevice -> sunlit rim), 8..16 blossom (deep shade -> cream), 17 petal.
  var GEOM = {};
  function cherryGeom(seed, giant) {
    var key = seed + (giant ? "g" : ""); if (GEOM[key]) return GEOM[key];
    var rnd = PX.rng(seed), segs = [], tips = [], r0 = giant ? 4.2 : 4.5, forkH = 24 + 9 * rnd(), lean = (rnd() - 0.5) * 0.3, i;
    var n = 7, px = 0, py = 0, ph = rnd() * 6.283, sw = 0.2 + 0.16 * rnd();
    for (i = 0; i < n; i++) {
      var s0 = i / n, s1 = (i + 1) / n, aa = -Math.PI / 2 + lean + sw * Math.sin(ph + s1 * 4.2);
      var nx = px + Math.cos(aa) * forkH / n, ny = py + Math.sin(aa) * forkH / n;
      var f0 = 1 + 1.0 * Math.pow(Math.max(0, 1 - s0 / 0.28), 2), f1 = 1 + 1.0 * Math.pow(Math.max(0, 1 - s1 / 0.28), 2);
      segs.push({ x0: px, y0: py, x1: nx, y1: ny, r0: r0 * f0 * (1 - 0.16 * s0), r1: r0 * f1 * (1 - 0.16 * s1), dep: 0 });
      px = nx; py = ny;
    }
    var count = 0;
    function limb(x, y, a, len, r, dep, dir) {
      if (++count > 90) { tips.push({ x: x, y: y, dep: dep }); return; }
      var m = Math.max(2, Math.round(len / 5.5)), cx = x, cy = y, target = dir > 0 ? -0.55 : -Math.PI + 0.55, rb = r;
      for (var j = 0; j < m; j++) {
        a += (target - a) * (0.08 + 0.05 * dep) + ((j & 1) ? 1 : -1) * 0.2 * (0.4 + rnd()) + (rnd() - 0.5) * 0.12;
        if (a > -0.1) a = -0.1; if (a < -Math.PI + 0.1) a = -Math.PI + 0.1;
        var ra = r * (1 - 0.34 * j / m); rb = r * (1 - 0.34 * (j + 1) / m);
        var nx2 = cx + Math.cos(a) * len / m, ny2 = cy + Math.sin(a) * len / m;
        segs.push({ x0: cx, y0: cy, x1: nx2, y1: ny2, r0: ra, r1: rb, dep: dep });
        cx = nx2; cy = ny2;
        if (dep < 3 && j > 0 && j < m - 1 && rnd() < 0.34) { var sd = rnd() < 0.5 ? -1 : 1; limb(cx, cy, a + sd * (0.5 + 0.4 * rnd()), len * (0.4 + 0.18 * rnd()), rb * 0.6, dep + 1, dir); }
      }
      if (dep < 3) { var k2 = rnd() < 0.3 ? 3 : 2; for (var q = 0; q < k2; q++) limb(cx, cy, a + (q / (k2 - 1) - 0.5) * 1.15 + (rnd() - 0.5) * 0.3, len * (0.58 + 0.2 * rnd()), rb * 0.78, dep + 1, dir); }
      else tips.push({ x: cx, y: cy, dep: dep });
      if (dep === 2) tips.push({ x: cx, y: cy, dep: dep, mid: 1 });
    }
    var nl = rnd() < 0.55 ? 2 : 3;
    for (var k = 0; k < nl; k++) {
      var side = nl === 2 ? (k ? 1 : -1) : (k - 1), dir = side === 0 ? (rnd() < 0.5 ? -1 : 1) : side;
      limb(px, py, -Math.PI / 2 + side * (0.52 + 0.3 * rnd()) + (rnd() - 0.5) * 0.2, (25 + 9 * rnd()) * (side === 0 ? 0.85 : 1), r0 * 0.8 * (side === 0 ? 0.8 : 1), 1, dir);
    }
    var nr = 2 + Math.floor(rnd() * 2);                                    // root flare
    for (i = 0; i < nr; i++) { var dr = i % 2 ? 1 : -1; segs.push({ x0: 0, y0: -r0 * 0.9, x1: dr * r0 * (2.0 + 1.3 * rnd()), y1: 1.2, r0: r0 * 0.8, r1: r0 * 0.28, dep: 0 }); }
    var clouds = [], x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = 0, tx0 = 1e9, tx1 = -1e9, ty0 = 1e9, ty1 = -1e9;
    for (i = 0; i < tips.length; i++) { tx0 = Math.min(tx0, tips[i].x); tx1 = Math.max(tx1, tips[i].x); ty0 = Math.min(ty0, tips[i].y); ty1 = Math.max(ty1, tips[i].y); }
    var ecx = (tx0 + tx1) / 2, erx = (tx1 - tx0) / 2 + 9, ecy = ty0 + (ty1 - ty0) * 0.45, ery = Math.max(10, (ty1 - ty0) * 0.62 + 6);
    for (i = 0; i < tips.length; i++) {
      var tp = tips[i], cr = (tp.mid ? 9 : 11) * (0.75 + 0.45 * rnd());
      if (tp.y > ecy + ery * 0.85) { rnd(); rnd(); rnd(); rnd(); continue; }     // low twigs stay bare: no hanging balls under the crown
      if (tp.y > ecy + ery * 0.55) cr *= 0.72;
      var cyy = tp.y - cr * 0.35 + (rnd() - 0.5) * 3; if (cyy > ecy + ery * 0.25) cyy = cyy * 0.5 + (ecy + ery * 0.25) * 0.5;
      clouds.push({ x: tp.x + (rnd() - 0.5) * 4, y: cyy, r: cr, z: rnd() * 0.7 + (tp.mid ? 0 : 0.3), s: Math.floor(rnd() * 1e6) });
    }
    for (var f = 0; f < 70 && clouds.length < tips.length + 14; f++) {         // fill the dome between the limbs
      var fa = rnd() * Math.PI, fr = Math.sqrt(rnd()) * 0.85, fx = ecx + Math.cos(fa) * erx * fr, fy = ecy - Math.sin(fa) * ery * fr * 0.9 + ery * 0.12;
      var near = 1e9; for (var q2 = 0; q2 < clouds.length; q2++) { var ddx = clouds[q2].x - fx, ddy = (clouds[q2].y - fy) * 1.3; near = Math.min(near, Math.sqrt(ddx * ddx + ddy * ddy) - clouds[q2].r); }
      if (near < 3) continue;
      clouds.push({ x: fx, y: fy, r: 10 + 5 * rnd(), z: 0.15 + rnd() * 0.5, s: Math.floor(rnd() * 1e6) });
    }
    clouds.sort(function (a2, b2) { return a2.z - b2.z; });
    for (i = 0; i < clouds.length; i++) { var cc = clouds[i]; x0 = Math.min(x0, cc.x - cc.r * 1.2); x1 = Math.max(x1, cc.x + cc.r * 1.2); y0 = Math.min(y0, cc.y - cc.r); }
    for (i = 0; i < segs.length; i++) { var sg = segs[i]; x0 = Math.min(x0, sg.x0 - sg.r0, sg.x1 - sg.r1); x1 = Math.max(x1, sg.x0 + sg.r0, sg.x1 + sg.r1); y0 = Math.min(y0, sg.y1 - sg.r1); }
    var cy0 = 1e9, cy1 = -1e9; for (i = 0; i < clouds.length; i++) { cy0 = Math.min(cy0, clouds[i].y - clouds[i].r); cy1 = Math.max(cy1, clouds[i].y + clouds[i].r); }
    return (GEOM[key] = { segs: segs, clouds: clouds, x0: x0, x1: x1, y0: y0, cy0: cy0, cy1: cy1, seed: seed, ecx: ecx, ecy: ecy, erx: erx, ery: ery });
  }
  function makeCherry(seed, Ht, o) {
    o = o || {};
    var g = cherryGeom(seed, !!o.giant), sc = Ht / (0 - g.y0), LX = -0.84, LY = -0.54;
    var pad = 3, Wd = Math.ceil((g.x1 - g.x0) * sc) + pad * 2, Hd = Ht + pad + Math.max(3, Math.ceil(2 * sc)), sp = new PX.Sprite(Wd, Hd), SD = sp.d;
    var bx = Math.round(-g.x0 * sc) + pad, by = Ht + pad;
    sp.bx = bx; sp.by = by;
    var cTop = by + g.cy0 * sc, cH = Math.max(1, (g.cy1 - g.cy0) * sc), cMid = bx + ((g.x0 + g.x1) / 2) * sc, cW = Math.max(1, (g.x1 - g.x0) * sc);
    var Ecx = bx + g.ecx * sc, Ecy = by + g.ecy * sc, iErx = 1 / Math.max(1, (g.erx + 8) * sc), iEry = 1 / Math.max(1, (g.ery + 8) * sc);
    var sub = o.giant ? clamp(Ht * 0.021, 5, 10) : clamp(Ht * 0.024, 1.5, 7), rimOK = Ht >= 22;
    function put(x, y, s) { if (x >= 0 && y >= 0 && x < Wd && y < Hd) SD[y * Wd + x] = s; }
    function blob(cx, cy, r, macro, mdot) {
      var rx = r * 1.15, ry = r * 0.88, xa = Math.floor(cx - rx - 1), xb = Math.ceil(cx + rx + 1), ya = Math.floor(cy - ry - 1), yb = Math.ceil(cy + ry + 1);
      var gy = (cy - cTop) / cH, gx = (cx - cMid) / cW, rough = r > 2.5 ? 0.4 : 0.18, outer = rimOK && mdot > 0.45 && macro > -9;
      for (var yy = ya; yy <= yb; yy++) for (var xx = xa; xx <= xb; xx++) {
        var nx = (xx + 0.5 - cx) / rx, ny = (yy + 0.5 - cy) / ry, qq = nx * nx + ny * ny;
        var edge = 1 + (NT[((yy & 255) << 8) | ((xx + g.seed) & 255)] / 255 - 0.5) * rough;
        if (qq > edge) continue;
        var nz = Math.sqrt(Math.max(0, 1 - qq)), dif = nx * LX * 0.75 + ny * LY * 0.9 + nz * 0.42;
        var enx = (xx - Ecx) * iErx, eny = (yy - Ecy) * iEry, crown = -(enx * 0.8 + eny * 0.95);
        var v = 3.3 + dif * 0.6 + macro * 0.7 + crown * 2.1 - gy * 0.9 + DITH[((yy & 3) << 2) | (xx & 3)] * 0.9;
        var tone = clamp(Math.floor(v), 0, 7);
        if (outer && qq > edge * 0.5 && dif > 0.35 && gy < 0.7) tone = Math.max(tone, mdot > 0.7 ? 8 : 7);
        else if (ny > 0.5 && qq > edge * 0.45 && macro < 0.6) tone = Math.max(0, Math.min(tone, 2) - (gy > 0.55 ? 1 : 0));
        put(xx, yy, 8 + Math.min(8, tone));
      }
    }
    function cloud(c) {
      var cx = bx + c.x * sc, cy = by + c.y * sc, R = c.r * sc, zb = (c.z - 0.5) * 1.5;
      if (R <= sub * 1.7) { blob(cx, cy, R, zb, 0.55); if (R > 2.2) florets(cx, cy, R, PX.rng(c.s)); return; }
      var lr = PX.rng(c.s), ns = Math.round(1.0 * R * R / (sub * sub)) + 3, subs = [];
      for (var s = 0; s < ns; s++) {
        var ang = lr() * 6.283, rad = Math.sqrt(lr()) * (R - sub * 0.5);
        var sx2 = cx + Math.cos(ang) * rad * 1.15, sy2 = cy + Math.sin(ang) * rad * 0.85;
        var mnx = (sx2 - cx) / (R * 1.15), mny = (sy2 - cy) / (R * 0.85), mnz = Math.sqrt(Math.max(0, 1 - mnx * mnx - mny * mny));
        var md = mnx * LX * 0.8 + mny * LY * 0.95 + mnz * 0.25, rad01 = Math.sqrt(mnx * mnx + mny * mny);
        subs.push({ x: sx2, y: sy2, r: sub * (0.7 + 0.55 * lr()), m: zb + md * 2.6 - (mny > 0.3 ? (mny - 0.3) * 2.2 : 0), d: rad01 > 0.62 ? md : -1, zz: mnz * 0.8 - mny * 0.1 + lr() * 0.25 });
      }
      subs.sort(function (a3, b3) { return a3.zz - b3.zz; });
      for (s = 0; s < subs.length; s++) blob(subs[s].x, subs[s].y, subs[s].r, subs[s].m, subs[s].d);
      florets(cx, cy, R, lr);
    }
    // florets: tiny blossom clusters stamped over a clump - lighter toward the sun, darker in the shade - so the crown reads
    // as thousands of flowers rather than a smooth cloud
    function florets(cx, cy, R, lr) {
      var nf = Math.round(R * R * (sub > 2.4 ? 0.16 : 0.22)), big = sub > 2.4;
      for (var f = 0; f < nf; f++) {
        var ang = lr() * 6.283, rad = Math.sqrt(lr()) * R, fx = Math.round(cx + Math.cos(ang) * rad * 1.15), fy = Math.round(cy + Math.sin(ang) * rad * 0.85);
        if (fx < 1 || fy < 1 || fx >= Wd - 1 || fy >= Hd - 1) continue;
        var o = fy * Wd + fx, cur = SD[o]; if (cur < 8 || cur > 16) continue;
        var mnx = (fx - cx) / (R * 1.15), mny = (fy - cy) / (R * 0.85), md = mnx * LX * 0.8 + mny * LY * 0.95 + 0.25;
        var tn = cur - 8, up = md > 0.4 ? 2 : md > -0.05 ? 1 : -1;
        var nt2 = clamp(tn + up, 0, 8);
        SD[o] = 8 + nt2;
        if (big && up > 0 && lr() < 0.6) {
          var arm = 8 + clamp(nt2 - 1, 0, 8), r4 = lr(), o2 = o + (r4 < 0.25 ? -1 : r4 < 0.5 ? 1 : r4 < 0.75 ? Wd : -Wd), o3 = o + (r4 < 0.5 ? Wd : 1);
          if (SD[o2] >= 8 && SD[o2] <= 16) SD[o2] = Math.max(SD[o2], arm);
          if (lr() < 0.4 && SD[o3] >= 8 && SD[o3] <= 16) SD[o3] = Math.max(SD[o3], arm - 1);
        }
      }
    }
    function wood() {
      for (var q = 0; q < g.segs.length; q++) {
        var S0 = g.segs[q], ax = bx + S0.x0 * sc, ay = by + S0.y0 * sc, bx2 = bx + S0.x1 * sc, by2 = by + S0.y1 * sc;
        var ra0 = Math.max(0.5, S0.r0 * sc), ra1 = Math.max(0.5, S0.r1 * sc), vx = bx2 - ax, vy = by2 - ay, L2 = vx * vx + vy * vy || 1e-6, len2 = Math.sqrt(L2);
        var pxv = -vy / len2, pyv = vx / len2, facing = pxv * LX + pyv * LY, rmax = Math.max(ra0, ra1);
        var xa = Math.floor(Math.min(ax, bx2) - rmax - 1), xb = Math.ceil(Math.max(ax, bx2) + rmax + 1), ya = Math.floor(Math.min(ay, by2) - rmax - 1), yb = Math.ceil(Math.max(ay, by2) + rmax + 1);
        for (var yy = ya; yy <= yb; yy++) for (var xx = xa; xx <= xb; xx++) {
          var ppx = xx + 0.5, ppy = yy + 0.5, tt = ((ppx - ax) * vx + (ppy - ay) * vy) / L2; tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
          var r = ra0 + (ra1 - ra0) * tt, ex = ppx - (ax + vx * tt), ey = ppy - (ay + vy * tt);
          if (ex * ex + ey * ey > r * r) continue;
          var uu = (ex * pxv + ey * pyv) / r, l = uu * facing, tone;
          if (r < 1.05) tone = 1;
          else {
            tone = clamp(Math.round(2.4 + l * 2.2 + DITH[((yy & 3) << 2) | (xx & 3)] * 0.7), 1, 5);
            if (l > 0.6 && Math.abs(uu) > 0.5) tone = 6;
            else if (l < -0.55) tone = 0;
            if (r > 2.6) { var fur = ((tt * len2 * 0.26 + uu * 2.1 + q * 0.37) % 1 + 1) % 1; if (fur < 0.17 && tone > 0 && tone < 6) tone--; }
          }
          put(xx, yy, 1 + tone);
        }
      }
    }
    var split = Math.floor(g.clouds.length * 0.42);
    for (var b = 0; b < split; b++) cloud(g.clouds[b]);
    wood();
    for (b = split; b < g.clouds.length; b++) cloud(g.clouds[b]);
    // loose petals clinging around the crown and drifting under it
    var rnd = PX.rng(seed * 7 + Ht), np = Math.round(g.clouds.length * (o.giant ? 6 : Ht > 40 ? 2.5 : 1));
    for (var pp = 0; pp < np; pp++) {
      var cc = g.clouds[Math.floor(rnd() * g.clouds.length)]; if (!cc) break;
      var ang2 = rnd() * 6.283, dist = cc.r * sc * (1.1 + rnd() * 0.8), px2 = bx + cc.x * sc + Math.cos(ang2) * dist, py2 = by + cc.y * sc + Math.abs(Math.sin(ang2)) * dist * (rnd() < 0.3 ? 2.4 : 0.9);
      var ix = Math.floor(px2), iy = Math.floor(py2);
      if (ix >= 0 && iy >= 0 && ix < Wd && iy < Hd && !SD[iy * Wd + ix]) SD[iy * Wd + ix] = 17;
    }
    // row spans (skip transparent margins when blitting)
    sp.r0 = new Int16Array(Hd); sp.r1 = new Int16Array(Hd); sp.minX = Wd;
    for (var yy2 = 0; yy2 < Hd; yy2++) { var a0 = Wd, a1 = -1; for (var xx2 = 0; xx2 < Wd; xx2++) if (SD[yy2 * Wd + xx2]) { if (xx2 < a0) a0 = xx2; a1 = xx2; } sp.r0[yy2] = a0; sp.r1[yy2] = a1 + 1; if (a0 < sp.minX) sp.minX = a0; }
    return sp;
  }
  function treeSprite(variant, hp) {
    var key = variant * 4096 + hp, sp = K.trees[key];
    if (sp) return sp;
    if (K.gen <= 0) {                                                       // over this frame's budget: borrow the nearest size
      for (var dz = 1; dz < 40; dz++) { sp = K.trees[key - dz] || K.trees[key + dz]; if (sp) return sp; }
    }
    K.gen--;
    if (++K.nTrees > 320) { K.trees = {}; K.nTrees = 0; }
    sp = makeCherry(1300 + variant * 97, hp, {});
    K.trees[key] = sp;
    return sp;
  }
  function blitLUT(fb, sp, dx, dy, lut, hole) {
    var sw = sp.w, sh = sp.h, sd = sp.d, w = fb.w, h = fb.h, d = fb.d;
    var y0 = Math.max(0, -dy), y1 = Math.min(sh, h - dy);
    for (var y = y0; y < y1; y++) {
      var xa = Math.max(sp.r0 ? sp.r0[y] : 0, -dx), xb = Math.min(sp.r1 ? sp.r1[y] : sw, w - dx); if (xb <= xa) continue;
      var srow = y * sw, ty = y + dy, drow = ty * w + dx, hy = 0;
      if (hole) { hy = (ty - hole.cy) / hole.ry; hy = hy * hy; if (hy >= 1) hy = -1; } else hy = -1;
      for (var x = xa; x < xb; x++) {
        var v = sd[srow + x]; if (!v) continue;
        if (hy >= 0) { var tx = x + dx, hx = (tx - hole.cx) / hole.rx, q = hx * hx + hy; if (q < 1 && DITH[((ty & 3) << 2) | (tx & 3)] + 0.5 < 0.78 * (1 - q * q)) continue; }
        var dv = d[drow + x]; if (dv > 200 && dv < 244) continue;             // never paint over the man or the stone: the tree stands BEHIND them
        d[drow + x] = lut[v];
      }
    }
  }

  // ================================================================ backdrop
  // rows of the frame that are still sky/backdrop (y < lip) per row: [rmin, rmax) - everything else is ground
  function rowSpans(S) {
    var w = S.w, h = S.h, lip = S.lip, x, y;
    if (!K.rmin || K.rmin.length !== h) { K.rmin = new Int16Array(h); K.rmax = new Int16Array(h); K.tmn = new Int16Array(h); K.tmx = new Int16Array(h); }
    var tmn = K.tmn, tmx = K.tmx; tmn.fill(w); tmx.fill(-1);
    for (x = 0; x < w; x++) { var L = Math.min(h, lip[x]) - 1; if (L < 0) continue; if (x > tmx[L]) tmx[L] = x; if (x < tmn[L]) tmn[L] = x; }
    var cmx = -1, cmn = w;
    for (y = h - 1; y >= 0; y--) { if (tmx[y] > cmx) cmx = tmx[y]; if (tmn[y] < cmn) cmn = tmn[y]; K.rmax[y] = cmx + 1; K.rmin[y] = cmn; }
  }
  function blitRows(fb, st, offX, y0) {
    var w = fb.w, sw = st.w, sh = st.h, d = fb.d, sd = st.d, ox = ((Math.floor(offX) % sw) + sw) % sw;
    var ya = Math.max(0, y0), yb = Math.min(fb.h, y0 + sh);
    for (var y = ya; y < yb; y++) {
      var xa = K.rmin[y], xb = K.rmax[y]; if (xb <= xa) continue;
      var srow = (y - y0) * sw, row = y * w, sx = (ox + xa) % sw;
      for (var x = xa; x < xb; x++) { var v = sd[srow + sx]; if (v) d[row + x] = v; if (++sx === sw) sx = 0; }
    }
  }
  function fillRows(fb, y0, c) {
    var w = fb.w, d = fb.d;
    for (var y = Math.max(0, y0); y < fb.h; y++) { var xa = K.rmin[y], xb = K.rmax[y]; if (xb > xa) d.fill(c, y * w + xa, y * w + xb); }
  }

  R.backdrop = function (fb, S, pal) {
    build(S);
    var w = fb.w, h = fb.h, d = fb.d, L = layout(S, S.openingT), al = S.altitude, t = S.reduced ? 0 : S.tSec, ext = K.ext, y;
    rowSpans(S);
    for (y = 0; y < h; y++) { var xa = K.rmin[y], xb = K.rmax[y]; if (xb <= xa) continue; var vy = y - L.sh + ext; d.set(K.sky.subarray(vy * w + xa, vy * w + xb), y * w + xa); }
    drawClouds(fb, S, L, t);
    blitRows(fb, K.r1, 0, L.hz - K.r1.h + 2);
    blitRows(fb, K.r2, al * 0.03 + 300, L.hz - K.r2.h + 3);
    blitRows(fb, K.r3, al * 0.06 + 700, L.hz - K.r3.h + 4);
    // valley floor + river, and the sun's reflection path on the water
    var vy0 = L.hz + 1;
    blitRows(fb, K.val, al * 0.09 + 200, vy0);
    var wr = Math.max(4, Math.round(L.sunR * 1.6));
    for (y = vy0; y < Math.min(h, vy0 + K.valH); y++) {
      var near = (y - vy0) / K.valH, half = Math.round(wr * (0.6 + near * 1.4));
      for (var x = Math.max(K.rmin[y], L.sunX - half); x <= Math.min(K.rmax[y] - 1, L.sunX + half); x++) {
        var o = y * w + x, v = d[o]; if (v < I.sky + 8 || v > I.sky + 19) continue;        // in the valley band only the river uses sky colours
        var k = 1 - Math.abs(x - L.sunX) / (half + 1);
        if (DITH[((y & 3) << 2) | (x & 3)] + 0.5 < k * 1.25) d[o] = (k > 0.55 && ((x + y + (t * 6 | 0)) % 3 === 0)) ? I.glint + ((x + y) % 3) : Math.min(I.sky + 19, v + 2);
      }
    }
    // cherry-forest hillsides stepping toward us (they rise into view as the climb opens the valley below)
    var yA = vy0 + Math.round(h * 0.075) - K.hA.crest0, yB = vy0 + Math.round(h * 0.15) - K.crB, yC = vy0 + Math.round(h * 0.25) - K.crC, yVis = h - 1;
    while (yVis > 0 && K.rmax[yVis] <= K.rmin[yVis]) yVis--;
    if (!K.hB && yB - 12 < yVis) K.hB = K.mkB();
    if (!K.hC && yC - 14 < yVis) K.hC = K.mkC();
    blitRows(fb, K.hA, al * 0.14 + 50, yA);
    if (yA + K.hA.h < h) fillRows(fb, yA + K.hA.h, I.mtn + 6);
    if (K.hB) { blitRows(fb, K.hB, al * 0.24 + 400, yB); if (yB + K.hB.h < h) fillRows(fb, yB + K.hB.h, I.mtn + 4); }
    if (K.hC) { blitRows(fb, K.hC, al * 0.38 + 900, yC); if (yC + K.hC.h < h) fillRows(fb, yC + K.hC.h, I.hill); }
  };

  // ================================================================ ground
  // world positions of the cherry trees on the two meadow planes (plane 1 = the hero's own plane)
  function forTrees(S, plane, fn) {
    var w = S.w, zoom = S.zoom, par = plane ? 1 : 0.72, sc = S.scroll * par, cell = plane ? 600 : 340, zp = zoom * (plane ? 1 : 0.58);
    var wl = (0 - S.ztx) / zoom + sc - 320, wr = (w - S.ztx) / zoom + sc + 320;
    for (var c = Math.floor(wl / cell); c <= Math.ceil(wr / cell); c++) {
      if (PX.h2(c, 700 + plane) > (plane ? 0.5 : 0.62)) continue;
      var twx = c * cell + PX.h2(c, 710 + plane) * cell * 0.7;
      if (plane && Math.abs(twx - S.anchorX - 250) < 150) continue;         // keep the opening view of the sun open
      var sx = Math.round(S.ztx + (twx - sc) * zoom), hw = (plane ? 150 : 135) * (0.8 + 0.4 * PX.h2(c, 720 + plane)), hp = Math.max(9, Math.round(hw * zp));
      if (sx < -hp * 1.2 || sx > w + hp * 1.2) continue;
      fn(sx, hp, Math.floor(PX.h2(c, 730 + plane) * 4), c);
    }
  }
  function treesPlane(fb, S, plane) {
    var w = fb.w, zoom = S.zoom;
    forTrees(S, plane, function (sx, hp, variant) {
      var sp = treeSprite(variant, hp), base = S.lip[clamp(sx, 0, w - 1)] + Math.max(1, Math.round((plane ? 4 : 7) * zoom));
      blitLUT(fb, sp, sx - sp.bx, base - sp.by, plane ? K.lutNear : K.lutFar, null);
    });
  }

  var RELIC = {
    skull: { r: "bone", rows: ["..1221..", ".123332.", "12333332", "13003003", "13303033", ".1233321", "..1.1.1."] },
    bone: { r: "bone", rows: ["12.....21", "233333332", "12.....21"] },
    ribs: { r: "bone", rows: ["1.1.1.1..", "2.2.2.2.1", "2.2.2.2.2", "233333332", ".2.2.2.2.", ".1.1.1.1."] },
    amph: { r: "clay", rows: ["..2332..", "...33...", ".233332.", "23444432", "34444443", "34224243", "23444432", ".233332.", "..2332..", "...22..."] },
    helm: { r: "gold", rows: ["..1221..", ".123321.", "1233332.", "123..32.", "12.1..2.", "12.1.21.", ".1...1.."] },
    coin: { r: "gold", rows: [".23..", "2332.", ".21.2", "...23"] },
    shell: { r: "bone", rows: [".1221.", "12..21", "1.32.2", "1.2.12", "12..2.", ".1221."] },
    crys: { r: "quartz", rows: ["...2...", "..121.2", "..121.1", ".2121.1", "01210..", ".010..."] }
  };
  function relic(fb, rl, x, y, flip) {
    var ramp = RX[rl.r];
    for (var yy = 0; yy < rl.rows.length; yy++) { var row = rl.rows[yy]; for (var xx = 0; xx < row.length; xx++) {
      var ch = row.charAt(flip ? row.length - 1 - xx : xx); if (ch === ".") continue;
      fb.set(x + xx, y + yy, ramp[Math.min(ramp.length - 1, ch.charCodeAt(0) - 48)]);
    } }
  }

  // cobble tile (256x256 texels): packed rounded stones. bits 0-2 shade (0 = crevice), bit 3 = lower rim, bits 4-11 cell hash
  var COB = new Uint16Array(65536);
  (function () {
    var G = 16, cs = 16, fx = new Float32Array(G * G), fy = new Float32Array(G * G), j, x, y;
    for (j = 0; j < G * G; j++) { fx[j] = ((j % G) + 0.12 + 0.76 * PX.ihash(j, 1, 501)) * cs; fy[j] = (Math.floor(j / G) + 0.12 + 0.76 * PX.ihash(j, 2, 501)) * cs; }
    for (y = 0; y < 256; y++) for (x = 0; x < 256; x++) {
      var cx = x >> 4, cy = y >> 4, d1 = 1e9, d2 = 1e9, id = 0, ex = 0, ey = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var gx = cx + dx, gy = cy + dy, jj = ((gy + G) % G) * G + ((gx + G) % G);
        var ddx = x + 0.5 - (fx[jj] + (gx < 0 ? -256 : gx >= G ? 256 : 0)), ddy = (y + 0.5 - (fy[jj] + (gy < 0 ? -256 : gy >= G ? 256 : 0))) * 1.5, dd = ddx * ddx + ddy * ddy;
        if (dd < d1) { d2 = d1; d1 = dd; id = jj; ex = ddx; ey = ddy; } else if (dd < d2) d2 = dd;
      }
      var edge = (Math.sqrt(d2) - Math.sqrt(d1)) * 0.5, v, rim = 0;
      if (edge < 0.85) v = 0;
      else {
        var lit = -(ex * 0.62 + ey * 0.78) / 9, rr = Math.sqrt(d1) / 12;
        v = clamp(Math.round(2.7 + lit * 1.7 - rr * 0.7 + (PX.ihash(id, 3, 502) - 0.5) * 1.3), 1, 5);
        if (edge < 2.2 && lit < -0.1) { v = Math.max(1, v - 1); rim = 1; }
      }
      COB[y * 256 + x] = v | (rim << 3) | ((Math.floor(PX.ihash(id, 4, 503) * 256) & 255) << 4);
    }
  })();
  var STRAT = [2, 3, 1, 3, 2, 4, 2, 3], STRATC = [0, 0, 1, 0, 0, 1, 0, 0], COBS = [1 / 3.2, 1 / 2.3, 1 / 4.4, 1 / 2.8];

  R.ground = function (fb, S, pal) {
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, iz = 1 / zoom, sc = S.scroll, lipA = S.lip, t = S.reduced ? 0 : S.tSec;
    K.gen = 2;
    treesPlane(fb, S, 0);
    treesPlane(fb, S, 1);
    var G = I.grass, gDu = 58, gD = Math.max(9, Math.round(gDu * zoom)), tipMax = 1 + 2.5 * Math.min(1, zoom / 0.7);
    var lean = S.reduced ? 0 : (S.windGust || 0) * 3;
    var tex = zoom > 0.55 ? 2 : zoom > 0.3 ? 4 : 8, x, y;
    var B1 = 150, B2 = 262, B3 = 440, B4 = 650, B5 = 1040, cobS = 1 / 3.2, clS = 1 / 1.35;
    if (!K.gt || K.gt.length < gD + 1) K.gt = new Float32Array(gD + 64);
    for (y = 0; y <= gD; y++) K.gt[y] = 0.7 - 3.9 * Math.pow(y / gD, 0.85);
    var GT = K.gt, iB = 1 / (B5 - B4);
    for (x = 0; x < w; x++) {
      var lip = lipA[x]; if (lip >= h) continue;
      var wxF = (x - S.ztx) * iz + sc, wx = Math.floor(wxF), gx = Math.floor(wxF / tex) & 255, xb = x & 3;
      var c1 = NT[(11 << 8) | (wx & 255)] / 255, c2 = NT[(23 << 8) | ((wx >> 1) & 255)] / 255;
      var patch = VT[(40 << 8) | (Math.floor(wxF * 0.05) & 255)] / 255;
      var lvBase = 2.5 + 1.5 * c1 + 1.8 * (patch - 0.5), pthr = 255 - Math.max(0, VT[(77 << 8) | (Math.floor(wxF * 0.009) & 255)] - 135) * 0.2;
      var sway = S.reduced ? 0 : lean + 0.5 * Math.sin(t * 2.0 + wxF * 0.03);
      var tip = 1 + Math.floor(c2 * c2 * tipMax);
      for (var kk = 1; kk <= tip; kk++) {
        var ty = lip - kk, tx = x + Math.round(sway * (kk / 6)); if (ty < 0 || tx < 0 || tx >= w) continue;
        d[ty * w + tx] = G + clamp(Math.floor(lvBase + 1.8 - kk * 0.5 + DITH[((ty & 3) << 2) | (tx & 3)] * 0.8), 2, 7);
      }
      var b1 = B1 + 10 * Math.sin(wxF * 0.019 + 1.3) + 5 * Math.sin(wxF * 0.051), b2 = B2 + 14 * Math.sin(wxF * 0.015 + 4.1) + 6 * Math.sin(wxF * 0.047 + 2);
      var b3 = B3 + 18 * Math.sin(wxF * 0.011 + 0.4) + 8 * Math.sin(wxF * 0.037);
      var wav = 11 * Math.sin(wxF * 0.012 + 1.7) + 6 * Math.sin(wxF * 0.037 + 0.3) + (VT[(150 << 8) | (Math.floor(wxF * 0.08) & 255)] / 255 - 0.5) * 10;
      var seam = B5 + 190 + 26 * Math.sin(wxF * 0.009 + 0.7) + 11 * Math.sin(wxF * 0.031 + 2.2);
      var cxC = Math.floor(wxF * clS) & 255, cxT = Math.floor(wxF * cobS) & 255, vph = wxF * 0.0034 + VT[(120 << 8) | (Math.floor(wxF * 0.02) & 255)] / 255, vth = 0.004 + 0.006 * zoom;
      var wxs0 = wx * 3 + 1, pcol = (wx * 5 + 3) & 255, gx1 = gx >> 1;
      var y0 = Math.max(0, lip), o = y0 * w + x, dd, du, bay, idx, gr;
      var yG = Math.min(h, lip + gD), y1b = Math.min(h, lip + Math.ceil(b1 * zoom)), y2b = Math.min(h, lip + Math.ceil(b2 * zoom)), y3b = Math.min(h, lip + Math.ceil(b3 * zoom));
      y = y0;
      for (; y < yG; y++, o += w) {                                         // meadow: blades, lit tops, fallen petals
        dd = y - lip; bay = DITH[((y & 3) << 2) | xb];
        var tq = dd / gD, wxs = (sway === 0 ? wxs0 : (wx + Math.round(sway * (1 - tq) * 1.6)) * 3 + 1);
        var s = NT[((((dd + c1 * 7) / 3.4) & 255) << 8) | (wxs & 255)] / 255;
        idx = G + clamp(Math.floor(lvBase + GT[dd] + (s - 0.5) * 1.3 + bay * 0.9), 0, 7);
        if (s < 0.045 && tq > 0.2) idx = G + 1;
        if (tq < 0.5) { var pt = NT[((dd & 255) << 8) | pcol]; if (pt > pthr + (tq < 0.25 ? -2 : 1)) idx = I.bloom + 4 + (pt & 1) + (tq < 0.25 ? 1 : 0); }
        d[o] = idx;
      }
      var fringe = 2 + ((NT[(31 << 8) | (x & 255)] * 7) >> 8), fr0 = NT[(37 << 8) | ((x * 3) & 255)] > 110;
      for (; y < y1b; y++, o += w) {                                        // loam: dark plum clods, a fringe of turf roots, petals mixed into the top
        dd = y - lip; du = dd * iz; bay = DITH[((y & 3) << 2) | xb]; gr = NT[(((dd >> 1) & 255) << 8) | gx];
        var e1 = (du - gDu) / (b1 - gDu), cl = VT[((((du / 5) | 0) & 255) << 8) | gx1], cd = COB[((((du * clS) | 0) & 255) << 8) | cxC] & 7;
        var lv1 = 4.1 - e1 * 2.0 + (cl - 127.5) * 0.0055 + (gr - 127.5) * 0.003 + bay * 0.7 + (cd === 0 ? -0.75 : (cd - 3) * 0.26);
        idx = I.soil + clamp(Math.floor(lv1), 0, 5);
        var fd = dd - gD;
        if (fd < 1) idx = I.soil + 1; else if (fr0 && fd < fringe) idx = fd === fringe - 1 ? I.bark + 1 : I.soil;
        else if (gr > 253 && e1 < 0.3) idx = I.bloom + 3;
        d[o] = idx;
      }
      for (; y < y2b; y++, o += w) {                                        // subsoil: warmer, gritty
        dd = y - lip; du = dd * iz; bay = DITH[((y & 3) << 2) | xb]; gr = NT[(((dd >> 1) & 255) << 8) | gx];
        var e2 = (du - b1) / (b2 - b1), cl2 = VT[((((du / 7) | 0) & 255) << 8) | gx1], ib = du + wav * 0.6, ibf = ib - Math.floor(ib / 23) * 23;
        idx = I.clay + clamp(Math.floor(2.3 + (cl2 - 127.5) * 0.0065 + (gr - 127.5) * 0.0035 + bay * 0.8 - e2 * 1.3 + (ibf < 1.6 * iz ? 1.2 : ibf < 3.2 * iz ? -0.6 : 0)), 0, 4);
        if (du - b1 < iz) idx = I.soil + 1; else if (du - b1 < 2 * iz && bay > 0) idx = I.soil + 2;
        d[o] = idx;
      }
      for (; y < y3b; y++, o += w) {                                        // sedimentary strata, gently folded, with rose-quartz veins
        dd = y - lip; du = dd * iz; bay = DITH[((y & 3) << 2) | xb]; gr = NT[(((dd >> 1) & 255) << 8) | gx];
        var sv = du + wav, bi = Math.floor(sv / 14), fr = sv - bi * 14, bk = bi & 7, rp = STRATC[bk] ? I.clay : I.rock;
        var tn = STRAT[bk] + (gr - 127.5) * 0.0039 + bay * 0.8 - fr * 0.057;
        if (fr < iz * 1.05) tn = STRAT[bk] - 1.6; else if (fr < iz * 2.1) tn += 0.9;
        idx = rp + clamp(Math.floor(tn), 0, STRATC[bk] ? 4 : 5);
        if (du - b2 < iz) idx = I.rock;
        var vp = vph + du * 0.0054, vf = vp - Math.floor(vp);
        if (vf < vth) idx = gr > 140 ? I.bloom + 4 : I.bloom + 2;
        d[o] = idx;
      }
      for (; y < h; y++, o += w) {                                          // packed stones; deeper, the underworld's glow seeps up the cracks
        dd = y - lip; du = dd * iz; bay = DITH[((y & 3) << 2) | xb];
        var bed = ((du + wav * 1.4) / 150) | 0, bs2 = COBS[bed & 3], cv = COB[((((du * bs2) | 0) & 255) << 8) | ((wxF * bs2 + bed * 61) & 255)], sh = cv & 7, gw = (du - B4) * iB;
        var gwc = gw < 0 ? gw : gw > 1.3 ? 1.3 : gw, gv = gwc;
        if (gwc > 0) { var gm = VT[((((du * 0.018) | 0) & 255) << 8) | ((((wxF * 0.011) | 0) + 40) & 255)] / 255; gv = gwc * (0.3 + 2.4 * (gm > 0.38 ? gm - 0.38 : 0)); }   // the glow rises in veins
        if (sh === 0) {                                                      // crevices: dark, or lit from within where a vein runs
          if (gwc < 0) idx = I.rock + (du - b3 < 30 ? 1 : 0);
          else idx = gv * 2.6 + bay * 1.2 < 0.3 ? I.rock : I.glow + clamp(Math.floor(gv * 2.2 + bay * 1.0 - 0.2), 0, 3);
        } else {                                                             // stones keep their lit tops; shadows warm toward the glow
          var sl = sh * 0.9 + 0.2 - (du - b3) / 260 + bay * 0.6;
          if (gwc > 0) { sl -= (gwc < 1 ? gwc : 1) * 1.2; if ((cv & 8) && bay + 0.5 < gv * 0.7) { d[o] = I.glow + (gv > 0.9 && bay > 0.2 ? 2 : 1); continue; } }
          idx = I.rock + clamp(Math.floor(sl), 0, 5);
          if (gw > 0.45 && sh <= 2 && bay + 0.5 < Math.min(0.62, gw - 0.45)) idx = I.glow + (sh === 1 ? 0 : 1);
        }
        var sm = du - seam;                                                  // the underworld's seam: one thin glowing vein far below
        if (sm > -9 && sm < 9) { var sa2 = 1 - Math.abs(sm) / 9 + bay * 0.45; if (sa2 > 0.35) idx = I.glow + clamp(Math.floor(1 + sa2 * 3.2), 1, 4); }
        d[o] = idx;
      }
    }
    // meadow tufts: rows of small blade fans painted back (top) to front (bottom); the first row makes the skyline
    var rowDu = 9, nRowsG = Math.max(2, Math.ceil((gDu - 8) / rowDu)), tuftW = 8, bs = clamp(zoom / 0.74, 0.42, 1.1), wlT = (0 - S.ztx) * iz + sc - 20, wrT = (w - S.ztx) * iz + sc + 20;
    for (var gr2 = 0; gr2 < nRowsG; gr2++) {
      var rdu = 1 + gr2 * rowDu, dT = gr2 / nRowsG, tw = tuftW * (1 + dT * 0.3);
      for (var tc = Math.floor(wlT / tw); tc <= Math.ceil(wrT / tw); tc++) {
        var th1 = PX.h2(tc, 300 + gr2), th2 = PX.h2(tc, 330 + gr2);
        var twx = tc * tw + th1 * tw * 0.9, tsx = Math.round(S.ztx + (twx - sc) * zoom); if (tsx < -3 || tsx > w + 3) continue;
        var tby = lipA[clamp(tsx, 0, w - 1)] + Math.round(rdu * zoom); if (tby >= h + 6) continue;
        var bh = Math.max(2, Math.round((3.2 + 5 * th2) * bs * (gr2 === 0 ? 1.15 : 1))), nb = 2 + Math.floor(th1 * 2.99), tsw = S.reduced ? 0 : lean + 0.6 * Math.sin(t * 2.0 + twx * 0.03 + gr2);
        var tip0 = gr2 === 0 ? 6.6 : gr2 === 1 ? 6 : 5.4 - dT * 2.4, base0 = 2.2 - dT * 1.2, pinkTip = th2 > 0.86 && gr2 < 3;
        for (var bl = 0; bl < nb; bl++) {
          var lean0 = (bl - (nb - 1) / 2) * 0.9 + (th2 - 0.5) * 0.8, blen = bh - (bl === 1 ? 0 : Math.round(th1 * 2));
          for (var kk2 = 0; kk2 < blen; kk2++) {
            var fk = kk2 / Math.max(1, blen - 1), bxp2 = tsx + Math.round((lean0 + tsw * 0.35) * fk * fk * 1.6) + (bl - (nb >> 1)), byp2 = tby - kk2;
            if (bxp2 < 0 || bxp2 >= w || byp2 < 0 || byp2 >= h) continue;
            var tn2 = base0 + (tip0 - base0) * fk + DITH[((byp2 & 3) << 2) | (bxp2 & 3)] * 0.8 + (bl === 0 ? 0.6 : bl === nb - 1 ? -0.5 : 0);
            d[byp2 * w + bxp2] = (pinkTip && kk2 === blen - 1) ? I.bloom + 5 + (bl & 1) : G + clamp(Math.floor(tn2), 1, 7);
          }
        }
      }
    }
    // pebbles bedded in the loam and subsoil, lit from the upper left
    var pcw = 26, pch = 22, wl3 = (0 - S.ztx) * iz + sc - pcw, wr3 = (w - S.ztx) * iz + sc + pcw, rowMax = Math.min(12, Math.ceil(h * iz / pch) + 1);
    for (var pc0 = Math.floor(wl3 / pcw); pc0 <= Math.ceil(wr3 / pcw); pc0++) for (var pr = 3; pr < rowMax; pr++) {
      var lens = VT[((pr * 9) & 255) << 8 | (Math.floor(pc0 * 0.35) & 255)] / 255;
      if (PX.h2(pc0 * 3 + 1, pr * 5 + 2) < 1 - (0.05 + 0.5 * Math.max(0, lens - 0.45)) * clamp(Math.pow(zoom / 0.74, 1.4), 0.2, 1)) continue;
      var pwx = pc0 * pcw + PX.h2(pc0, pr + 41) * pcw, pdu = pr * pch + PX.h2(pc0, pr + 43) * pch; if (pdu > B2 + 20) continue;
      var psx = Math.round(S.ztx + (pwx - sc) * zoom); if (psx < -6 || psx > w + 6) continue;
      var psy = Math.round(lipA[clamp(psx, 0, w - 1)] + pdu * zoom); if (psy < 2 || psy > h + 3) continue;
      var rr = Math.max(1.2, (2.2 + 2.6 * PX.h2(pc0, pr + 47)) * Math.max(0.5, zoom) * 1.2);
      for (var by = -Math.ceil(rr); by <= Math.ceil(rr); by++) for (var bx = -Math.ceil(rr * 1.35); bx <= Math.ceil(rr * 1.35); bx++) {
        var ex = bx / 1.35, q = ex * ex + by * by; if (q > rr * rr) continue;
        var lt = -(ex * 0.7 + by * 0.7) / rr, tone = lt > 0.45 ? 4 : lt > 0 ? 3 : lt > -0.45 ? 2 : 1;
        if (q > (rr - 1) * (rr - 1) && lt < 0.1) tone = 0;
        fb.set(psx + bx, psy + by, I.rock + tone + 1);
      }
    }
    // roots: each meadow cherry's root system, plus fine turf roots hanging into the loam
    forTrees(S, 1, function (sx, hp, variant, c) {
      var top = lipA[clamp(sx, 0, w - 1)] + gD - 1, nR = 4, sz = hp / 110;
      for (var q = 0; q < nR; q++) {
        var rx = sx + (q - 1.5) * 2 * sz, ry = top, ang = Math.PI / 2 + (q - 1.5) * 0.55 + (PX.h2(c, q + 900) - 0.5) * 0.3, len = Math.round((50 + 60 * PX.h2(c, q + 910)) * zoom * 1.4), th = Math.max(1, Math.round(2.6 * sz));
        for (var st = 0; st < len; st++) {
          ang += (PX.h2(c * 13 + q, st + 920) - 0.5) * 0.35; ang = clamp(ang, 0.35, Math.PI - 0.35);
          rx += Math.cos(ang); ry += Math.sin(ang) * 0.9;
          var tk = Math.max(1, Math.round(th * (1 - st / len)));
          for (var tq2 = 0; tq2 < tk; tq2++) fb.set(Math.round(rx) + tq2, Math.round(ry), I.bark + (tq2 === 0 && tk > 1 ? 3 : 2));
          if (st > 6 && st % 11 === 0) { var fx2 = rx, fy2 = ry, fa = ang + (st % 22 ? 0.9 : -0.9); for (var fs = 0; fs < 8; fs++) { fx2 += Math.cos(fa); fy2 += Math.sin(fa) * 0.9; fb.set(Math.round(fx2), Math.round(fy2), I.bark + 1); } }
        }
      }
    });
    var rcell = 40, wl = (0 - S.ztx) * iz + sc - rcell, wr = (w - S.ztx) * iz + sc + rcell;
    for (var rc = Math.floor(wl / rcell); rc <= Math.ceil(wr / rcell); rc++) {
      if (PX.h2(rc, 61) < 0.45) continue;
      var rwx = rc * rcell + PX.h2(rc, 62) * rcell, rsx = Math.round(S.ztx + (rwx - sc) * zoom); if (rsx < -10 || rsx > w + 10) continue;
      var cxp = rsx, cyp = lipA[clamp(rsx, 0, w - 1)] + gD - 1, len = Math.round((12 + 22 * PX.h2(rc, 63)) * zoom * 1.2), dir = PX.h2(rc, 64) < 0.5 ? -1 : 1;
      for (var st2 = 0; st2 < len; st2++) {
        cyp += 1; if (PX.h2(rc * 31 + st2, 65) < 0.35) cxp += dir;
        fb.set(cxp, cyp, st2 < len * 0.4 ? I.bark + 2 : I.bark + 1);
        if (st2 === (len >> 1) && len > 6) { fb.set(cxp - dir, cyp + 1, I.bark + 1); fb.set(cxp - 2 * dir, cyp + 2, I.soil + 1); }
      }
    }
    if (zoom > 0.33) {
      var wc = 110, wl7 = (0 - S.ztx) * iz + sc - wc, wr7 = (w - S.ztx) * iz + sc + wc, wig = S.reduced ? 0 : Math.floor(t * 1.7);
      for (var ec = Math.floor(wl7 / wc); ec <= Math.ceil(wr7 / wc); ec++) {
        var eh = PX.h2(ec, 170); if (eh > 0.34) continue;
        var ewx = ec * wc + PX.h2(ec, 171) * wc, esx = Math.round(S.ztx + (ewx - sc) * zoom); if (esx < -8 || esx > w + 8) continue;
        var esy = Math.round(lipA[clamp(esx, 0, w - 1)] + (gDu + 18 + PX.h2(ec, 172) * 110) * zoom); if (esy > h) continue;
        var ef = (wig + ec) & 1, edir = eh < 0.17 ? 1 : -1, EW = ef ? [0, 0, -1, -1, 0, 0, 1] : [-1, 0, 0, -1, -1, 0, 0];
        for (var ek = 0; ek < 7; ek++) fb.set(esx + ek * edir, esy + EW[ek], ek === 6 ? I.bloom + 5 : ek === 0 ? I.bloom + 2 : I.bloom + 3 + (ek & 1));
      }
      var fc2 = 130, wl8 = (0 - S.ztx) * iz + sc - fc2, wr8 = (w - S.ztx) * iz + sc + fc2;
      for (var oc = Math.floor(wl8 / fc2); oc <= Math.ceil(wr8 / fc2); oc++) {
        if (PX.h2(oc, 180) > 0.4) continue;
        var owx = oc * fc2 + PX.h2(oc, 181) * fc2, osx = Math.round(S.ztx + (owx - sc) * zoom); if (osx < -40 || osx > w + 40) continue;
        var osy = lipA[clamp(osx, 0, w - 1)] + (gDu + 30 + PX.h2(oc, 182) * 120) * zoom, olen = Math.round((14 + 26 * PX.h2(oc, 183)) * zoom * 1.3), oph = PX.h2(oc, 184) * 6;
        for (var ok = 0; ok < olen; ok++) { var oy = Math.round(osy + Math.sin(ok * 0.22 + oph) * 1.6 + ok * 0.12); fb.set(osx + ok, oy, I.bark + 1); fb.set(osx + ok, oy - 1, ok % 5 ? I.bark + 3 : I.bark + 2); }
      }
    }
    // relics bedded in the stone: bones, skulls, amphorae, a bronze helm, coins, fossil shells and rose-quartz crystals
    var rlc = 150, wl5 = (0 - S.ztx) * iz + sc - rlc, wr5 = (w - S.ztx) * iz + sc + rlc, keys = ["skull", "bone", "amph", "helm", "coin", "shell", "crys", "crys", "ribs", "coin", "bone"];
    for (var lc = Math.floor(wl5 / rlc); lc <= Math.ceil(wr5 / rlc); lc++) {
      for (var lr = 0; lr < 5; lr++) {
        if (PX.h2(lc * 5 + lr, 81) < 1 - 0.5 * clamp(Math.pow(zoom / 0.45, 1.6), 0.28, 1)) continue;
        var lwx = lc * rlc + PX.h2(lc, lr + 82) * rlc, ldu = 290 + (lr + PX.h2(lc, lr + 83) * 1.6) * 170;
        var lsx = Math.round(S.ztx + (lwx - sc) * zoom); if (lsx < -10 || lsx > w + 10) continue;
        var lsy = Math.round(lipA[clamp(lsx, 0, w - 1)] + ldu * zoom); if (lsy < 2 || lsy > h - 2) continue;
        var kind = keys[Math.floor(PX.h2(lc, lr + 84) * keys.length) % keys.length];
        if (kind === "shell" && ldu > 560) kind = "skull"; else if ((kind === "skull" || kind === "ribs" || kind === "helm") && ldu < 430) kind = "shell";
        relic(fb, RELIC[kind], lsx, lsy, PX.h2(lc, lr + 85) > 0.5);
      }
    }
    // meadow flowers: white and rose five-petal heads with a warm eye, a stem, mostly in the sunlit top rows
    var flc = 30, wl9 = (0 - S.ztx) * iz + sc - flc, wr9 = (w - S.ztx) * iz + sc + flc, fsz = zoom > 0.5 ? 1 : 0;
    for (var fl = Math.floor(wl9 / flc); fl <= Math.ceil(wr9 / flc); fl++) for (var fr2 = 0; fr2 < 2; fr2++) {
      var fh = PX.h2(fl, 190 + fr2); if (fh > 0.34) continue;
      var fwx = fl * flc + PX.h2(fl, 195 + fr2) * flc, fsx = Math.round(S.ztx + (fwx - sc) * zoom); if (fsx < 2 || fsx > w - 3) continue;
      var fsy = Math.round(lipA[fsx] + (3 + fr2 * 14 + PX.h2(fl, 199 + fr2) * 8) * zoom); if (fsy < 2 || fsy > h - 3) continue;
      var petal = fh < 0.2 ? I.bloom + 8 : I.bloom + 6, shade = fh < 0.2 ? I.bloom + 6 : I.bloom + 4, fsw = S.reduced ? 0 : Math.round(Math.sin(t * 2 + fwx * 0.05) * 0.6 + lean * 0.3);
      fb.set(fsx, fsy + 1, G + 3); fb.set(fsx, fsy + 2, G + 2);
      var cx2 = fsx + fsw;
      fb.set(cx2, fsy, I.glow + 5); fb.set(cx2 - 1, fsy, petal); fb.set(cx2 + 1, fsy, shade); fb.set(cx2, fsy - 1, petal);
      if (fsz) { fb.set(cx2 - 1, fsy - 1, shade); fb.set(cx2 + 1, fsy - 1, petal); fb.set(cx2, fsy + 1, shade); }
    }
    var stc = 170, wl10 = (0 - S.ztx) * iz + sc - stc, wr10 = (w - S.ztx) * iz + sc + stc, heroSX = Math.round(S.ztx + S.anchorX * zoom);
    for (var sc2 = Math.floor(wl10 / stc); sc2 <= Math.ceil(wr10 / stc); sc2++) {
      if (PX.h2(sc2, 210) > 0.42) continue;
      var swx = sc2 * stc + PX.h2(sc2, 211) * stc, ssx = Math.round(S.ztx + (swx - sc) * zoom); if (ssx < -12 || ssx > w + 12 || Math.abs(ssx - heroSX) < 40 * zoom + 18) continue;
      var srr = Math.max(2, Math.round((4 + 4 * PX.h2(sc2, 212)) * zoom * 1.3)), ssy = lipA[clamp(ssx, 0, w - 1)] + Math.round(2 * zoom);
      for (var sy2 = -srr; sy2 <= 1; sy2++) for (var sx3 = -Math.round(srr * 1.4); sx3 <= Math.round(srr * 1.4); sx3++) {
        var e5 = sx3 / 1.4, q5 = e5 * e5 + sy2 * sy2 * 1.2; if (q5 > srr * srr) continue;
        var lt5 = (-(e5 * 0.8 + sy2 * 0.6)) / srr, tn5 = lt5 > 0.5 ? 5 : lt5 > 0.1 ? 4 : lt5 > -0.35 ? 3 : 2;
        if (q5 > (srr - 1) * (srr - 1) && lt5 < 0.25) tn5 = 1;
        fb.set(ssx + sx3, ssy + sy2, I.rock + tn5);
      }
      fb.set(ssx - Math.round(srr * 0.5), ssy - srr + 1, I.bloom + 5);        // a fallen petal resting on it
    }
    // fallen marble column drums lying in the packed stone: a rare, larger relic of some older climb
    var ccl = 900, wl11 = (0 - S.ztx) * iz + sc - ccl, wr11 = (w - S.ztx) * iz + sc + ccl;
    for (var cc3 = Math.floor(wl11 / ccl); cc3 <= Math.ceil(wr11 / ccl); cc3++) {
      if (PX.h2(cc3, 230) > 0.55) continue;
      var cwx = cc3 * ccl + PX.h2(cc3, 231) * ccl * 0.7, cdu = 520 + PX.h2(cc3, 232) * 260, csx = Math.round(S.ztx + (cwx - sc) * zoom); if (csx < -30 || csx > w + 30) continue;
      var csy = Math.round(lipA[clamp(csx, 0, w - 1)] + cdu * zoom); if (csy < 4 || csy > h + 8) continue;
      var CW = 14 + Math.round(PX.h2(cc3, 233) * 8), CH = 7 + Math.round(PX.h2(cc3, 234) * 3), MB = RX.bone;
      for (var cy3 = 0; cy3 < CH; cy3++) for (var cx3 = 0; cx3 < CW; cx3++) {
        var ey3 = (cy3 + 0.5) / CH * 2 - 1, cap = cx3 === 0 || cx3 === CW - 1;
        if (cap && Math.abs(ey3) > 0.8) continue;
        var tn6 = cy3 === 0 ? 3 : cy3 === CH - 1 ? 0 : (cy3 & 1) ? 2 : 1;             // flutes run along the drum; the top catches the glow of the world above
        if (cx3 === CW - 1) tn6 = Math.max(0, tn6 - 1); else if (cx3 === 0) tn6 = Math.min(3, tn6 + 1);
        if (cx3 === Math.round(CW * 0.62) && cy3 > 0 && cy3 < CH - 1) tn6 = 0;          // a crack across it
        fb.set(csx + cx3, csy + cy3, MB[tn6]);
      }
    }
    // petal drifts on the turf
    var pc = 52, wl6 = (0 - S.ztx) * iz + sc - pc, wr6 = (w - S.ztx) * iz + sc + pc;
    for (var hc = Math.floor(wl6 / pc); hc <= Math.ceil(wr6 / pc); hc++) {
      if (PX.h2(hc, 140) < 0.45) continue;
      var hwx = hc * pc + PX.h2(hc, 141) * pc, hsx = Math.round(S.ztx + (hwx - sc) * zoom); if (hsx < -8 || hsx > w + 8) continue;
      var hl = lipA[clamp(hsx, 0, w - 1)], hwid = Math.max(2, Math.round((4 + 7 * PX.h2(hc, 142)) * Math.max(0.45, zoom)));
      for (var hx = -hwid; hx <= hwid; hx++) {
        var ht = Math.round((1 - (hx * hx) / (hwid * hwid)) * (1.2 + 1.2 * PX.h2(hc, 143)));
        for (var hy2 = 0; hy2 <= ht; hy2++) {
          var yy2 = hl - hy2 + 1, xx2 = hsx + hx; if (PX.ihash(hx, hy2, 150 + hc) < 0.2) continue;
          fb.set(xx2, yy2, I.bloom + clamp(Math.round(4.5 + (hy2 === ht ? 1.5 : 0) - hx / hwid * 1.1 + dth(xx2, yy2)), 3, 7));
        }
      }
    }
    if (fb !== V8.fb && S.reduced && S.gameState === "title") giants(fb, S, null);   // menu card: no front pass, so the framing tree is drawn here
  };

  // ================================================================ foreground: giant cherries + drifting petals
  R.front = function (fb, S, pal) {
    var w = fb.w, h = fb.h, zoom = S.zoom, t = S.reduced ? 0 : S.tSec;
    var dt = K.lastT < 0 ? 0 : clamp(S.tSec - K.lastT, 0, 0.1); K.lastT = S.tSec;
    K.windAcc += (S.windGust || 0) * dt * 70;
    var heroX = Math.round(S.ztx + S.anchorX * zoom), heroY = S.lip[clamp(heroX, 0, w - 1)];
    var hole = { cx: heroX + Math.round(16 * zoom), cy: heroY - Math.round(30 * zoom), rx: Math.round(62 * zoom) + 14, ry: Math.round(58 * zoom) + 14 };
    giants(fb, S, null);                                                        // (the hero-shaped see-through window is gone: the actor pixels are protected instead)
    petals(fb, S, t);
  };

  function giants(fb, S, hole) {
    var w = fb.w, h = fb.h, zoom = S.zoom, heroX = Math.round(S.ztx + S.anchorX * zoom);
    // giants ride a track that runs faster than the ground (they are close to us); k = 0 frames the opening view
    var G = S.scroll * 1.6, zf = Math.max(0.45, zoom), cell = 3600, off0 = K.g0x - S.anchorX, span = (w + h * 2.2) / zf;
    var k0 = Math.floor((G - span - off0 / zf) / cell) - 1, k1 = Math.ceil((G + span) / cell) + 1;
    K.rain = null;
    for (var k = Math.max(0, k0); k <= k1; k++) {
      if (k > 0 && PX.h1(k * 9 + 4) < 0.38) continue;
      var P = k * cell + (k === 0 ? 0 : (PX.h1(k * 3 + 2) - 0.5) * 1200), sx = Math.round(heroX + off0 + (P - G) * zf);
      if (sx < -h * 2 || sx > w + h * 2) continue;
      if (!K.giants[k & 1]) K.giants[k & 1] = makeCherry(k & 1 ? 911 : 505, K.gH[k & 1], { giant: 1 });
      var gsp = K.giants[k & 1];
      if (sx + gsp.w - gsp.bx < 0 || sx - gsp.bx > w) continue;
      var gy0 = h + Math.round(h * 0.06) - gsp.by;
      blitLUT(fb, gsp, sx - gsp.bx, gy0, K.lutGiant, hole);
      var ca = Math.max(0, sx - gsp.bx + gsp.minX), cb = Math.min(w, sx - gsp.bx + gsp.w);
      if (cb - ca > 20) K.rain = { x0: ca, x1: cb, y0: Math.max(0, gy0 + Math.round(gsp.h * 0.12)) };
    }
  }

  function petals(fb, S, t) {
    var w = fb.w, h = fb.h, d = fb.d, n = Math.round(w * h / 1500), gust = S.windGust || 0, ww = w + 40, hh = h + 30;
    for (var i = 0; i < n; i++) {
      var layer = i % 5 < 2 ? 0 : (i % 5 < 4 ? 1 : 2), r1 = PX.h1(i * 7 + 1), r2 = PX.h1(i * 11 + 2), r3 = PX.h1(i * 13 + 3);
      var vy = (6 + layer * 7) * (0.75 + 0.5 * r3) * (1 + gust * 0.4), vx = -(2 + layer * 4) * (0.6 + 0.8 * r2) - gust * (10 + layer * 14);
      var y = ((r1 * hh + t * vy) % hh + hh) % hh - 15;
      var x = r2 * ww + t * vx - K.windAcc * (0.5 + 0.35 * layer) - S.scroll * S.zoom * (0.1 + 0.3 * layer) + Math.sin(t * (0.9 + r3) + i) * (3 + layer * 3);
      x = ((x % ww) + ww) % ww - 20;
      var xi = Math.round(x), yi = Math.round(y);
      if (xi < 1 || yi < 0 || xi >= w - 1 || yi >= h - 1) continue;
      var f = Math.floor(t * (2 + r3 * 3) + i) & 3, o = yi * w + xi;
      if (layer === 0) { d[o] = I.bloom + 5; }
      else if (layer === 1) { d[o] = I.bloom + 6; if (f === 0) d[o + 1] = I.bloom + 5; else if (f === 2) d[o + w] = I.bloom + 5; }
      else { d[o] = I.bloom + 7; if (f < 2) { d[o + 1] = I.bloom + 6; if (f === 0) d[o + w] = I.bloom + 5; } else { d[o + w] = I.bloom + 6; if (f === 2) d[o + w - 1] = I.bloom + 4; } }
    }
    var rn = K.rain; if (!rn) return;
    var rw = rn.x1 - rn.x0, rh = h - rn.y0 + 10, m = Math.round(rw * rh / 2600);
    for (i = 0; i < m; i++) {
      var q1 = PX.h1(i * 17 + 5), q2 = PX.h1(i * 19 + 7), q3 = PX.h1(i * 23 + 9), fall = (8 + 10 * q3) * (1 + gust * 0.5);
      var ry = rn.y0 + ((q1 * rh + t * fall) % rh), rx = rn.x0 + q2 * rw + Math.sin(t * (1.1 + q3) + i * 1.7) * 4 - gust * ((t * 18 + i * 13) % 60);
      var rxi = Math.round(rx), ryi = Math.round(ry); if (rxi < 1 || ryi < 0 || rxi >= w - 1 || ryi >= h - 1) continue;
      var o3 = ryi * w + rxi, f3 = Math.floor(t * (2.5 + q3 * 3) + i) & 3;
      d[o3] = q3 > 0.5 ? I.bloom + 7 : I.bloom + 6; if (f3 === 1) d[o3 + 1] = I.bloom + 5; else if (f3 === 3) d[o3 + w] = I.bloom + 5;
    }
  }

  R.thumb = { ratio: 0.8 };
  V8.register("blossom", R);
})(typeof window !== "undefined" ? window : this);
