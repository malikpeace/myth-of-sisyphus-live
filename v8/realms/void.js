// The Void - V8 scene for the end of the world (15000 m and beyond). Almost nothing: a black sky with a scatter of faint stars and ONE
// thin pale ring of light around a black sun; a lifeless ground that is only an edge of light. Below the edge, the cross-section holds
// what the climb left behind: fine dark strata, a few pale threads of glow, and the ghosts of everything he passed - a column, an
// amphora, a skull, a lantern with one warm spark, a bell, a crystal, and the stones of all the others who came before.
(function (root) {
  "use strict";
  var PX = root.PX, Sc = root.Sc, V8 = root.V8, hex = PX.hex, clamp = PX.clamp, clamp01 = PX.clamp01, B4 = PX.BAYER4, TAU = Math.PI * 2;
  var R = { rock: { mat: "obsidian", style: "obsidian" }, noBirds: true, noThunder: true, thumb: { alt: 15400, zoom: 0.7, slope: 0.08, ratio: 0.74 } };
  var I = {}, ST = { key: "", skyKey: "" }, BP = new Float32Array(16), SKY_N = 12, LITS = null;
  for (var bi = 0; bi < 16; bi++) BP[bi] = B4[bi >> 2][bi & 3] + 0.5;

  function H(list) { return list.map(hex); }
  function sm(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function keyRamp(keys, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var p = n === 1 ? 0 : i / (n - 1), k = 0;
      while (k < keys.length - 2 && p > keys[k + 1][0]) k++;
      var a = keys[k], b = keys[k + 1], f = clamp01((p - a[0]) / Math.max(1e-6, b[0] - a[0]));
      out.push([Math.round(a[1][0] + (b[1][0] - a[1][0]) * f), Math.round(a[1][1] + (b[1][1] - a[1][1]) * f), Math.round(a[1][2] + (b[1][2] - a[1][2]) * f)]);
    }
    return out;
  }
  function vn2(x, y, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, h = PX.ihash; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h(ix, iy, s), b = h(ix + 1, iy, s), c = h(ix, iy + 1, s), d = h(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm2(x, y, s) { return vn2(x, y, s) * 0.55 + vn2(x * 2.07 + 11.3, y * 2.07 + 4.1, s + 1) * 0.30 + vn2(x * 4.3 + 3.7, y * 4.3 + 17.9, s + 2) * 0.15; }

  // ---------------------------------------------------------------- palette
  var RGB = { ring: H(["#0a1020", "#161f36", "#26344f", "#43587a", "#7890b4", "#b4c6e2", "#e0eaf8", "#ffffff"]) };
  R.init = function (pal, S) {
    var t0 = performance.now();
    I.sky = pal.ramp("sky", keyRamp([[0, [0, 0, 0]], [0.55, [1, 2, 6]], [0.76, [4, 6, 14]], [0.90, [8, 12, 26]], [1, [14, 22, 42]]], SKY_N));
    I.st0 = pal.ramp("st0", H(["#2a3248", "#5a6884", "#a8b8d4"])); I.st1 = pal.ramp("st1", H(["#2a3248", "#5a6884", "#a8b8d4"])); I.st2 = pal.ramp("st2", H(["#2a3248", "#5a6884", "#a8b8d4"]));
    I.rg = pal.ramp("rg", RGB.ring);
    I.vd = pal.ramp("vd", H(["#000000", "#020308", "#05070f", "#0a0d18", "#101422", "#181e30", "#242c42"]));
    I.vr = pal.ramp("vr", H(["#5c7090", "#a4b8d8", "#f2f8ff"]));
    I.vv = pal.ramp("vv", H(["#0c1622", "#182a3e", "#2a4664", "#5486aa", "#b4d8f2"]));
    I.vdl = pal.ramp("vdl", H(["#02060c", "#040c16", "#08141f", "#0e202e", "#16303f", "#20465a", "#306682"]));
    I.wm = pal.ramp("wm", H(["#8a4a1a", "#e08a30", "#ffd88a"]));
    I.wl = pal.ramp("wl", H(["#0a0604", "#140c08", "#24160c", "#3a2412"]));
    R.markerIdx = { c0: I.vd + 3, c1: I.vd + 5, c2: I.vv + 3, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };
    R.birdIdx = I.vv + 2; R.watcherIdx = I.vv + 3;
    R.footprint = { col: I.vd + 4, hi: I.vv + 2 };
    R.pal = pal; LITS = null;
    ST.key = ""; ST.skyKey = "";
    buildScene(S);
    R.initMs = performance.now() - t0;
  };
  R.palette = function (pal, S) {
    var t = S.reduced ? 0.8 : S.tSec, g, br = 0.94 + 0.06 * Math.sin(t * 0.9);
    pal.setRamp("rg", RGB.ring.map(function (c, i) { var k = i >= 5 ? br : 1; return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)]; }));
    for (g = 0; g < 3; g++) { var k2 = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(t * (0.22 + 0.07 * g) + g * 2.1)); pal.setRamp("st" + g, [[42, 50, 72], [90, 104, 132], [168, 184, 212]].map(function (c) { return [c[0] * k2, c[1] * k2, c[2] * k2]; })); }
  };
  // the light is the bead of the ring: pale, cold, from the upper left
  function isThumb(S) { return S.gameState === "title" && !!S.reduced && S.altitude === R.thumb.alt; }     // the menu-card render: everything is reduced by a whole factor afterwards, so thin lines need to be bold
  function beadAngle(S) {                                                   // the last of the sun leaks out at a point that creeps around the ring as you climb: the light on the hero moves with it
    var q = Math.round(Math.max(0, S.altitude - 15000) * 0.00058 / 0.02) * 0.02;
    return -2.45 + q;
  }
  function ringGeom(S) {
    var w = S.w, hy = S.horizonY + Math.round((1 - S.openingT) * S.h * 0.12), port = w < hy * 1.1, r = Math.round(clamp(0.185 * Math.min(w, hy * 1.6), 22, 76));
    return { hy: hy, r: r, cx: Math.round(w * (port ? 0.54 : 0.38)), cy: Math.round(hy * (port ? 0.28 : 0.31)), bAng: beadAngle(S) };
  }
  R.light = function (S) {
    var G = ringGeom(S), ang = G.bAng;
    return { x: Math.round(G.cx + Math.cos(ang) * G.r), y: Math.round(G.cy + Math.sin(ang) * G.r), k: 0.86, col: [214, 228, 255], ambient: [16, 22, 40], bright: 0.92, ground: [8, 10, 18] };
  };

  // ---------------------------------------------------------------- scene caches
  function buildScene(S) {
    var a = S.adj || 1, key = S.w + "x" + S.h + "@" + a + "|" + S.horizonY + (isThumb(S) ? "T" : "");
    if (ST.key === key) return; ST.key = key; ST.skyKey = "";
    bakeStarList(S);
    ST.slab = buildSlab(S);
  }
  function bakeStarList(S) {
    var w = S.w, hy = S.horizonY, a = S.adj || 1, X = [], Y = [], T = [], G = [];
    for (var y = 0; y < hy + 6; y += 1) for (var x = 0; x < w; x++) {
      var hv = PX.ihash(x, y, 6151), fade = y > hy * 0.6 ? Math.max(0.1, 1 - (y - hy * 0.6) / (hy * 0.45)) : 1, dens = fade * a * a;
      var p2 = 0.00004 * dens, p1 = p2 + 0.00035 * dens, p0 = p1 + 0.0016 * dens; if (hv >= p0) continue;
      X.push(x); Y.push(y); T.push(hv < p2 ? 2 : hv < p1 ? 1 : 0); G.push((PX.ihash(x, y, 5) * 3) | 0);
    }
    ST.sx = Int16Array.from(X); ST.sy = Int16Array.from(Y); ST.stier = Uint8Array.from(T); ST.sgrp = Uint8Array.from(G); ST.ns = X.length;
  }

  // ---------------------------------------------------------------- sky (baked): black bands, the stars, and the ring around the black sun
  function bakeSky(S) {
    var G = ringGeom(S), w = S.w, h = S.h, hy = G.hy, a = S.adj || 1, tk = isThumb(S) ? 2.7 : 1, key = w + "x" + h + "|" + hy + "|" + tk + "|" + G.bAng;
    if (ST.skyKey === key && ST.sky) return; ST.skyKey = key;
    var fb = ST.skyFb;
    if (!fb || fb.w !== w || fb.h !== h) fb = ST.skyFb = new PX.Frame(w, h);
    var idx = []; for (var i = 0; i < SKY_N; i++) idx.push(I.sky + i);
    var skyBot = Math.min(h, hy + 30);
    Sc.bands(fb, 0, skyBot, idx, 4);
    if (skyBot < h) fb.fillRect(0, skyBot, w, h - skyBot, I.sky + SKY_N - 1);
    var d = fb.d, n = ST.ns, X = ST.sx, Y = ST.sy, T = ST.stier, GR = ST.sgrp, o, q, x, y;
    for (i = 0; i < n; i++) {
      x = X[i]; y = Y[i]; if (y >= skyBot) continue; o = y * w + x; var base = I.st0 + GR[i] * 3, tier = T[i];
      d[o] = base + (tier === 0 ? 0 : tier === 1 ? 1 : 2);
      if (tier === 2 && x > 2 && x < w - 3 && y > 2 && y < skyBot - 3) { d[o - 1] = base + 1; d[o + 1] = base + 1; d[o - w] = base + 1; d[o + w] = base + 1; }
    }
    // the ring: a black disc, a hairline of white light around it, a few steps of dithered glow, feathery streamers, and the bead where the last sun leaks out
    var cx = G.cx, cy = G.cy, r = G.r, RG = I.rg, bAng = G.bAng, bx = cx + Math.cos(bAng) * r, by = cy + Math.sin(bAng) * r, Rout = r + Math.round(30 * a);
    var bands = [[3.6, 1.0, 4], [5.6, 0.82, 3], [8.2, 0.58, 3], [11.2, 0.42, 2], [15, 0.28, 2], [19.5, 0.16, 1], [25, 0.08, 0]].map(function (b) { return [b[0] * tk, b[1], b[2]]; });
    for (y = Math.max(0, cy - Rout); y <= Math.min(h - 1, cy + Rout); y++) for (x = Math.max(0, cx - Rout); x <= Math.min(w - 1, cx + Rout); x++) {
      var dx = x + 0.5 - cx, dy = y + 0.5 - cy, dist = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx); o = y * w + x;
      var side = 0.62 + 0.55 * Math.max(0, Math.cos(ang - bAng)), qd = dist - r;
      if (qd < -0.5) { d[o] = 0; if (qd > -2.2 && Math.cos(ang - bAng) > 0.45 && BP[((y & 3) << 2) | (x & 3)] < (Math.cos(ang - bAng) - 0.45) * 1.6) d[o] = RG + 1; continue; }
      if (qd < 1.0 * tk) { d[o] = RG + 6; continue; }
      if (qd < 2.3 * tk) { d[o] = RG + 5; continue; }
      for (q = 0; q < bands.length; q++) if (qd < bands[q][0]) { if (BP[((y & 3) << 2) | (x & 3)] < bands[q][1] * side * 1.05) d[o] = RG + bands[q][2]; break; }
    }
    var st = [[bAng, 1.25, 3.4], [-1.35, 0.62, 2.4], [-0.30, 1.05, 3.0], [0.28, 1.00, 3.0], [2.95, 1.1, 3.0], [3.35, 0.7, 2.2], [1.6, 0.34, 1.8], [-1.75, 0.42, 2.0]];   // streamers: angle, length (of r), root width
    for (i = 0; i < st.length; i++) {
      var sa = Math.cos(st[i][0]), sb = Math.sin(st[i][0]), len = st[i][1] * r, rw = st[i][2] * a;
      for (var tt = r + 2; tt < r + len; tt++) {
        var u = (tt - r) / len, hw = rw * (1 - u * 0.85) + 0.4, dens = Math.pow(1 - u, 1.5) * (i === 0 ? 0.95 : 0.62);
        for (var s = -Math.ceil(hw); s <= Math.ceil(hw); s++) {
          var px = Math.round(cx + sa * tt - sb * s), py = Math.round(cy + sb * tt + sa * s); if (px < 0 || py < 0 || px >= w || py >= h) continue;
          var e = 1 - Math.abs(s) / (hw + 0.5); if (BP[((py & 3) << 2) | (px & 3)] < dens * e * 1.45) { var cur = d[py * w + px]; d[py * w + px] = cur >= RG && cur < RG + 8 ? Math.max(cur, RG + (u < 0.4 ? 2 : 1)) : RG + (u < 0.3 ? 2 : u < 0.65 ? 1 : 0); }
        }
      }
    }
    var bxr = Math.round(bx), byr = Math.round(by), bl = Math.round(17 * a), q2;                          // the bead: a hot core, a cross of light, two short diagonals
    for (y = -1; y <= 1; y++) for (x = -1; x <= 1; x++) if (Math.abs(x) + Math.abs(y) < 2 || (x === 0 && y === 0)) { var pp = (byr + y) * w + bxr + x; if (pp >= 0 && pp < d.length) d[pp] = RG + 7; }
    for (q2 = 2; q2 <= bl; q2++) {
      var tone = q2 < bl * 0.25 ? 7 : q2 < bl * 0.5 ? 6 : q2 < bl * 0.75 ? 4 : 2;
      [[q2, 0], [-q2, 0]].forEach(function (p) { fb.set(bxr + p[0], byr + p[1], RG + tone); });
      if (q2 <= bl * 0.7) [[0, q2], [0, -q2]].forEach(function (p) { fb.set(bxr + p[0], byr + p[1], RG + Math.max(1, tone - 1)); });
      if (q2 <= bl * 0.34) [[q2, q2], [-q2, q2], [q2, -q2], [-q2, -q2]].forEach(function (p) { fb.set(bxr + p[0], byr + p[1], RG + Math.max(1, tone - 2)); });
    }
    ST.sky = d;
  }

  // ---------------------------------------------------------------- the ground: black strata, a rim of light, pale threads (column-major slab)
  function litMaps() {
    LITS = { blue: new Uint8Array(256), warm: new Uint8Array(256) };
    for (var v = 0; v < 256; v++) { LITS.blue[v] = v; LITS.warm[v] = v; }
    for (var q = 0; q < 7; q++) { LITS.blue[I.vd + q] = I.vdl + q; LITS.warm[I.vd + q] = I.wl + Math.min(3, q >> 1); }
  }
  function buildSlab(S) {
    var a = S.adj || 1, L = 1536, D = clamp(S.h + 130, 330, 700), d = new Uint8Array(L * D), rnd = PX.rng(20261001), beds = [], cum, nb, qx, dd, k, i;
    if (!LITS) litMaps();
    function A(v) { return Math.max(1, Math.round(v * a)); }
    var crust = A(5), thumb = isThumb(S); cum = crust; nb = 0;
    while (cum < D + 70 && nb < 70) { var th = A(9 + Math.floor(rnd() * 26)); beds.push({ t: th, tone: rnd(), kind: Math.floor(rnd() * 3), n1: 2 + Math.floor(rnd() * 5), n2: 8 + Math.floor(rnd() * 10), p1: rnd() * TAU, p2: rnd() * TAU, a1: A(1 + rnd() * 3), a2: 0.5 + rnd() * 1.5, bw: A(20 + rnd() * 40) }); cum += th; nb++; }
    var ed = new Int16Array(nb + 2), VD = I.vd, crustE = new Int16Array(L), deepD = A(110);
    for (qx = 0; qx < L; qx++) {
      var col = qx * D, e0 = crust + Math.round(1.4 * Math.sin(qx * TAU * 5 / L) + 1.8 * (PX.h2(qx >> 2, 5) - 0.5)) + ((PX.h2(qx >> 1, 77) > 0.7) ? 1 : 0);
      crustE[qx] = e0; ed[0] = e0;
      for (k = 0; k < nb; k++) { var bd = beds[k]; ed[k + 1] = ed[k] + Math.max(3, bd.t + Math.round(bd.a1 * Math.sin(qx * TAU * bd.n1 / L + bd.p1) + bd.a2 * Math.sin(qx * TAU * bd.n2 / L + bd.p2))); }
      k = 0;
      for (dd = 0; dd < D; dd++) {
        var bay = BP[((dd & 3) << 2) | (qx & 3)] - 0.5, idx, fade = Math.max(0.05, 1 - dd / A(240)), gl = dd > deepD ? sm((dd - deepD) / A(260)) : 0;
        if (dd < e0) {
          var tc = dd / e0;
          if (dd === 0 || (thumb && dd < 3)) idx = I.vr + 2; else if (dd === 1) idx = PX.h2(qx >> 2, 91) > 0.35 ? I.vr : VD + 6;
          else idx = VD + clamp(Math.floor(5.2 - 2.4 * tc + bay * 1.1), 1, 5);
        } else {
          while (k < nb - 1 && dd >= ed[k + 1]) k++;
          var bd2 = beds[k], ib = dd - ed[k], bh = ed[k + 1] - ed[k], tone = 3.5 * fade + 0.7 + (bd2.tone - 0.5) * 1.0 * fade;
          if (ib === 0) idx = VD + clamp(Math.floor(tone + 1.3 * fade + 1.0 + bay * 0.4), 1, 6);
          else if (ib === bh - 1) idx = VD + clamp(Math.floor(tone - 1.6), 0, 2);
          else if (bd2.kind === 0) idx = VD + clamp(Math.floor(tone - 0.3 + bay * 0.85 - (ib / bh) * 0.5), 0, 4);
          else if (bd2.kind === 1) { idx = VD + clamp(Math.floor(tone + ((ib & 1) ? 0.4 : -0.5) + bay * 0.4), 0, 4); if (ib > 1 && ib % 5 === 0) idx = VD + clamp(Math.floor(tone - 1.5), 0, 2); }
          else { var jx = qx + k * 17, blk = Math.floor(jx / bd2.bw), fx = jx - blk * bd2.bw; idx = fx === 0 ? VD + clamp(Math.floor(tone - 2), 0, 1) : VD + clamp(Math.floor(tone - 0.2 + (PX.h2(blk, k + 60) - 0.5) * 1.0 + bay * 0.7 - (ib / bh) * 0.4), 0, 4); }
          var fh = PX.h2(qx * 3 + k, dd + 200); if (fh > 0.9955 && fade > 0.2) idx = I.vv + 2;
          if (gl > 0.05) { var pv = fbm2(qx * 0.014, dd * 0.02, 41) * gl; if (pv > 0.22 && BP[((dd & 3) << 2) | (qx & 3)] < clamp01((pv - 0.22) * 5)) idx = LITS.blue[idx]; if (pv > 0.42) { var lvg = Math.floor((pv - 0.42) * 9 + bay * 1.2); if (lvg >= 0) idx = I.vv + Math.min(2, lvg); } }
        }
        d[col + dd] = idx;
      }
    }
    function put(x, y, c) { x = ((x % L) + L) % L; if (y < 0 || y >= D) return; d[x * D + y] = c; }
    function lift(x, y, Rr, strength) {
      for (var yy = -Rr; yy <= Rr; yy++) for (var xx = -Rr; xx <= Rr; xx++) {
        var q = 1 - Math.sqrt(xx * xx + yy * yy) / (Rr + 0.6); if (q <= 0) continue;
        var px = (((x + xx) % L) + L) % L, py = y + yy; if (py < 0 || py >= D) continue;
        if (BP[((py & 3) << 2) | (px & 3)] < strength * q) { var o = px * D + py; d[o] = LITS.blue[d[o]]; }
      }
    }
    var vr = PX.rng(779);                                                    // a handful of pale threads, each fading out at both ends
    for (i = 0; i < 40; i++) {
      var vx = vr() * L, vy = A(40) + vr() * (D - A(80)), vl = A(50 + vr() * 110), ang = (vr() < 0.5 ? 0.55 : 2.55) + (vr() - 0.5) * 0.7, len0 = vl, pts = [];
      for (k = 0; k < vl; k++) {
        ang += (PX.h2(i, k + 1300) - 0.5) * 0.5; ang = clamp(ang, 0.2, 2.94); vx += Math.cos(ang); vy += Math.sin(ang);
        var ix = Math.round(vx), iy = Math.round(vy), ends = Math.min(k, len0 - k) / (len0 * 0.3), ct = ends < 0.5 ? 0 : ends < 1 ? 1 : 2 + (PX.h2(ix, iy) > 0.85 ? 1 : 0);
        if (iy < crustE[((ix % L) + L) % L] + 4 || iy >= D - 2) continue;
        if (k % 5 === 0 && ct > 1) lift(ix, iy, 3, 0.85);
        pts.push(ix, iy, ct);
      }
      for (k = 0; k < pts.length; k += 3) { put(pts[k] - 1, pts[k + 1], I.vd + 1); put(pts[k], pts[k + 1], I.vv + pts[k + 2]); }
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
  function halo(fb, cx, cy, Rx, Ry, strength, map) {
    if (fb.rec) { fb.halos.push([cx, cy, Rx, Ry, strength, map]); return; }
    var w = fb.w, h = fb.h, d = fb.d, x, y, x0 = Math.max(0, cx - Rx), x1 = Math.min(w - 1, cx + Rx), y0 = Math.max(0, cy - Ry), y1 = Math.min(h - 1, cy + Ry);
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      var dx = (x - cx) / Rx, dy = (y - cy) / Ry, q = 1 - Math.sqrt(dx * dx + dy * dy); if (q <= 0) continue;
      if (BP[((y & 3) << 2) | (x & 3)] < strength * Math.pow(q, 1.25)) { var o = y * w + x, v = map[d[o]]; if (v !== d[o]) d[o] = v; }
    }
  }

  // ---------------------------------------------------------------- the ghosts: outlines of what he passed, pale on the black. inside(u, v) -> 0 outside, 1 body, 2 detail line, 3 hollow, 4 warm spark
  function ghost(fb, cx, cy, U, V, inside, seed) {
    var W = 2 * U + 1, Hh = 2 * V + 1, m = new Uint8Array(W * Hh), u, v, VV = I.vv, VD = I.vd;
    for (v = -V; v <= V; v++) for (u = -U; u <= U; u++) m[(v + V) * W + u + U] = inside(u, v);
    function at(uu, vv) { uu += U; vv += V; return uu >= 0 && vv >= 0 && uu < W && vv < Hh ? m[vv * W + uu] : 0; }
    for (v = -V; v <= V; v++) for (u = -U; u <= U; u++) {
      var c = at(u, v); if (!c) continue;
      var edge = !(at(u - 1, v) && at(u + 1, v) && at(u, v - 1) && at(u, v + 1)), lit = -(u * 0.7 + v * 0.7) / Math.max(U, V), col;
      if (c === 4) col = I.wm + 2;
      else if (c === 3) col = VD;
      else if (edge) { if (PX.h2(cx + u + seed, cy + v) < 0.10) continue; col = lit > 0.15 ? VV + 4 : lit > -0.35 ? VV + 3 : VV + 2; }
      else if (c === 2) col = VV + 2;
      else col = BP[(((cy + v) & 3) << 2) | ((cx + u) & 3)] < 0.75 ? VD + 1 : VD + 2;
      fb.set(cx + u, cy + v, col);
    }
  }
  var SHAPES = {
    column: function (u, v) { if (v >= -19 && v <= -17) return Math.abs(u) <= 5 ? 1 : 0; if (v >= -16 && v <= 9) return Math.abs(u) <= 3 ? (((u === -1 || u === 1) && (v % 3) !== 0) ? 2 : 1) : 0; if (v >= 10 && v <= 13) return Math.abs(u) <= 5 ? 1 : 0; return 0; },
    broken: function (u, v) { if (v >= -8 + ((u + 8) % 3 === 0 ? 1 : 0) + (u > 0 ? 2 : 0) && v <= 9) return Math.abs(u) <= 3 ? (((u === -1 || u === 1) && (v % 3) !== 0) ? 2 : 1) : 0; if (v >= 10 && v <= 13) return Math.abs(u) <= 5 ? 1 : 0; return 0; },
    amphora: function (u, v) { var r = v < -9 ? 2 : v < -4 ? 2 + (v + 9) * 0.8 : v < 4 ? 6 : v < 11 ? 6 - (v - 4) * 0.43 : 3; if (v < -13 || v > 12) return 0; if (Math.abs(u) <= r) return (v === -9 || v === 2) && Math.abs(u) < r - 1 ? 2 : 1; if (v >= -12 && v <= -6 && Math.abs(u) >= 3 && Math.abs(u) <= 5 && (Math.abs(u) === 5 || v === -12 || v === -6)) return 1; return 0; },
    skull: function (u, v) { var e = (u / 6) * (u / 6) + ((v + 1) / 5) * ((v + 1) / 5); if (e <= 1) { if ((u + 2.5) * (u + 2.5) + v * v <= 2.2 || (u - 2.5) * (u - 2.5) + v * v <= 2.2) return 3; if (u === 0 && v >= 2 && v <= 3) return 3; return 1; } if (Math.abs(u) <= 3 && v >= 4 && v <= 7) return (u & 1) && v > 4 ? 3 : 1; return 0; },
    lantern: function (u, v) { if (v === -13 || v === -12) return Math.abs(u) <= 1 && (Math.abs(u) === 1 || v === -13) ? 1 : 0; if (v === -11) return Math.abs(u) <= 4 ? 1 : 0; if (v >= -10 && v <= 3) { if (Math.abs(u) === 3) return 1; if (Math.abs(u) < 3) return (u === 0 && v >= -6 && v <= -3) ? 4 : (v === 3 ? 1 : 3); } if (v === 4) return Math.abs(u) <= 4 ? 1 : 0; return 0; },
    bell: function (u, v) { var half = v < -8 ? 2 + (v + 11) * 0.5 : v < -2 ? 3.6 + (v + 8) * 0.12 : 4.3 + (v + 2) * 1.2; if (v < -11 || v > 0) return v === 2 && u === 0 ? 1 : (v === 1 && u === 0 ? 1 : 0); return Math.abs(u) <= half ? 1 : 0; },
    crystal: function (u, v) { var tip = v < -14 ? (v + 19) / 5 : 1; if (v < -19 || v > 4) return 0; var hw = 3 * tip + 0.3; if (Math.abs(u - (v < -14 ? 1 : 0)) <= hw) return u === -1 && v > -14 ? 2 : 1; return 0; },
    tablet: function (u, v) { if (Math.abs(u) > 8 || Math.abs(v) > 5) return 0; return ((u * 5 + v * 3 + 100) % 13 === 0 && Math.abs(u) < 7 && Math.abs(v) < 4) ? 2 : 1; }
  };
  var SHAPE_DIMS = { column: [6, 19, 13], broken: [6, 9, 13], amphora: [7, 13, 12], skull: [7, 6, 8], lantern: [5, 14, 4], bell: [8, 12, 3], crystal: [4, 19, 4], tablet: [9, 6, 6] };
  function oldStone(fb, cx, cy, r, seed) {                                  // the stone of another climber: an uneven circle faceted like his own, sunk in the dark
    var rnd = PX.rng(seed | 0), cs = Math.max(4, r * 1.05), ox = rnd() * 50, oy = rnd() * 50;
    ghost(fb, cx, cy, r + 3, r + 3, function (u, v) {
      var d = Math.sqrt(u * u + v * v), an = Math.atan2(v, u), rr = r * (0.9 + 0.2 * vn2(Math.cos(an) * 1.6 + seed * 0.13, Math.sin(an) * 1.6, 3)); if (d > rr) return 0;
      var px = (u + ox) / cs, py = (v + oy) / cs, ix = Math.floor(px), iy = Math.floor(py), d1 = 9, d2 = 9;
      for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) { var gx = ix + i, gy = iy + j, qx = gx + PX.ihash(gx, gy, seed), qy = gy + PX.ihash(gx, gy, seed + 5), dd = (qx - px) * (qx - px) + (qy - py) * (qy - py); if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd; }
      return (Math.sqrt(d2) - Math.sqrt(d1)) < 0.085 && d < rr - 1.6 ? 2 : 1;
    }, seed);
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
    var w = fb.w, h = fb.h, lip = S.lip, a = S.adj || 1, t = S.reduced ? 0 : S.tSec, c, j, names = ["column", "broken", "amphora", "skull", "lantern", "bell", "crystal", "tablet"];
    function A(v) { return Math.max(1, Math.round(v * a)); }
    var CW = A(58), c0 = Math.floor((qoff - 90) / CW), c1 = Math.floor((qoff + w + 90) / CW);
    for (c = c0; c <= c1; c++) {
      for (j = 0; j < 4; j++) {
        var hh = PX.h2(c * 13 + j, 7100 + j * 3), P = [0.5, 0.36, 0.62, 0.5][j];
        if (hh > P) continue;
        var qx = c * CW + PX.h2(c, 7200 + j) * CW, sx = Math.round(qx - qoff); if (sx < -40 || sx > w + 40) continue;
        var lo = [A(26), A(60), A(24), A(100)][j], hi = [A(180), A(300), A(230), A(300)][j];
        var dd = lo + PX.h2(c, 7300 + j) * (hi - lo), sy = Math.round(lip[clamp(sx, 0, w - 1)] + dd); if (sy < -30 || sy > h + 30) continue;
        var pick = PX.h2(c, 7400 + j), sd = c * 17 + j * 5;
        if (j === 0 || j === 1) { var rs = Math.max(4, A(7 + pick * 9)); stamp(fb, "os|" + rs + "|" + sd, sx, sy, function (r) { oldStone(r, 0, 0, rs, sd); }); }
        else {
          var nm = names[Math.floor(PX.h2(c, 7500 + j) * names.length) % names.length], fl = pick > 0.5;
          if (nm === "column" && PX.h2(c, 7501) < 0.4) nm = "broken";
          stamp(fb, "gh|" + nm + "|" + fl + "|" + sd + "|" + a, sx, sy, function (r) {
            if (nm === "lantern") halo(r, 0, -A(4), A(22), A(18), 0.8, LITS.warm); else halo(r, 0, 0, A(18), A(16), 0.45, LITS.blue);
            ghost(r, 0, 0, SHAPE_DIMS[nm][0], SHAPE_DIMS[nm][1] > SHAPE_DIMS[nm][2] ? SHAPE_DIMS[nm][1] : SHAPE_DIMS[nm][2], function (u, v) { return SHAPES[nm](fl ? -u : u, v); }, sd);
          });
        }
      }
    }
    var cw2 = A(72), q0 = Math.floor((qoff - 20) / cw2), q1 = Math.floor((qoff + w + 20) / cw2);     // faint glints along the edge of the world
    for (c = q0; c <= q1; c++) {
      if (PX.h2(c, 8100) > 0.5) continue; var x2 = Math.round(c * cw2 + PX.h2(c, 8101) * cw2 - qoff); if (x2 < 2 || x2 > w - 3) continue;
      var by = lip[x2] - 1; fb.set(x2, by, I.vr); if (PX.h2(c, 8102) > 0.5) fb.set(x2 + 1, by, I.vv + 3);
      if (!S.reduced && Math.floor(t * 0.7 + c) % 4 === 0) { fb.set(x2, by - 1, I.vr + 1); }
    }
  }

  // drifting motes: pale specks rising off the dead ground and thinning out
  R.front = function (fb, S, pal, res) {
    if (S.reduced) return;
    var w = fb.w, h = fb.h, d = fb.d, t = S.tSec, lip = S.lip, n = 18, i;
    for (i = 0; i < n; i++) {
      var sp = 1.2 + PX.h1(i * 7 + 1) * 2.0, span = w + 60, xx = (((PX.h1(i * 11 + 2) * span - t * sp * 0.6 - S.scroll * S.zoom * 0.06) % span) + span) % span - 30, ph = ((PX.h1(i * 13 + 3) + t * 0.018 * sp) % 1), x = Math.round(xx);
      if (x < 0 || x >= w) continue;
      var y = Math.round(lip[x] - 3 - ph * h * 0.55 + Math.sin(t * 0.7 + i * 2.1) * 3), fade = Math.sin(ph * Math.PI); if (y < 0 || y >= h || y > lip[x] - 2 || fade < 0.2) continue;
      if (BP[((y & 3) << 2) | (x & 3)] < fade + 0.15) d[y * w + x] = fade > 0.7 ? I.vv + 4 : I.vv + 3;
    }
  };

  var SCR = { acc: 0, sc: null, hx: 0 };
  function qoffset(S) {
    var hx = S.ztx + S.anchorX * S.zoom;
    if (SCR.sc === null) SCR.acc = S.scroll * S.zoom - hx; else SCR.acc += (S.scroll - SCR.sc) * S.zoom - (hx - SCR.hx);
    SCR.sc = S.scroll; SCR.hx = hx;
    return Math.round(SCR.acc);
  }
  R.backdrop = function (fb, S, pal) {
    buildScene(S);
    bakeSky(S);
    fb.d.set(ST.sky);
  };
  R.ground = function (fb, S, pal) {
    buildScene(S);
    var qoff = qoffset(S), heroX = Math.round(S.ztx + S.anchorX * S.zoom);
    blitSlab(fb, S, qoff);
    groundStamps(fb, S, qoff, heroX);
  };
  V8.register("void", R);
})(typeof window !== "undefined" ? window : this);
