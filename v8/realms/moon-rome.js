// Moonlit Rome - V8 scene. Night over the seven hills: a deep navy sky with twinkling stars (palette animation), a crescent
// moon with a dithered halo, faint cloud bands lit from above, a moonlit mountain range, a hilltop temple city with tiny warm
// lamp windows and cypresses, and below the bridge a lamplit city along a river whose reflections shimmer. The ground is the
// shared stone bridge (V8.bridge): a two-tier Roman arcade of cool granite with marble trim, tall columns along its edge.
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
  var R = { rock: { mat: "night", style: "granite" } }, I = {}, ST = {}, CL = [], STARS = [], FF = [], built = "", DK = null, PK = null, TB = null;
  function H(list) { return list.map(hex); }

  R.init = function (pal, S) {
    I.sky = pal.ramp("sky", H(["#060919", "#090d21", "#0c1229", "#101732", "#141d3b", "#192444", "#1f2b4e", "#263458", "#2e3d62", "#38486c"]));
    I.star = pal.ramp("star", H(["#4c5a86", "#8d9dc8", "#c3d0ec", "#ffffff"]));
    I.moon = pal.ramp("moon", H(["#8e9cbc", "#c4cde0", "#e6ebf2", "#fbfbf4"]));
    I.cloud = pal.ramp("cloud", H(["#141b38", "#1d2747", "#2c3a60", "#4d5f88", "#7c8fb6"]));
    I.mtn = pal.ramp("mtn", H(["#121a36", "#172140", "#1e2a4c", "#2a385c", "#4a5c84", "#7385ad", "#a2b3d3"]));
    I.land = pal.ramp("land", H(["#080d1d", "#0c1326", "#111a31", "#17223d", "#1f2c4a", "#2b3a5c"]));
    I.bld = pal.ramp("bld", H(["#0f1528", "#161e36", "#1f2945", "#2b3858", "#3d4d72", "#5b6e96", "#8a9dc2"]));
    I.lamp = pal.ramp("lamp", H(["#3a2236", "#6e3526", "#b5602a", "#e9a045", "#ffd878", "#fff4c8"]));
    I.tree = pal.ramp("tree", H(["#05080f", "#090e1a", "#0f1726", "#182335"]));
    I.river = pal.ramp("river", H(["#070d1d", "#0c1630", "#132243", "#1c3158", "#2a446e"]));
    I.refl = pal.ramp("refl", H(["#7a4a3a", "#c98a4e", "#f2c878"]));
    I.wall = pal.ramp("wall", H(["#0d1222", "#141b2f", "#1c253d", "#26314c", "#323f5d", "#435273", "#5f7194"]));
    I.trim = pal.ramp("trim", H(["#121829", "#1e273d", "#2c3752", "#3e4b6a", "#566686", "#7a8cae", "#b3c4df"]));
    I.stat = pal.ramp("stat", H(["#0a0e1b", "#121829", "#1b233a", "#26304b", "#364364", "#6b82aa", "#a7bbdb"]));
    I.deep = pal.ramp("deep", H(["#04060d"]));
    DK = {
      wall: I.wall, trim: I.trim, ring: I.trim, mortar: I.wall, deep: I.deep,
      A: 280, pier: 68, phase: 130, slab: 12, slabL: 64, frieze: 8, dentil: true, string: 5, course: 16, blockL: 42,
      crown: 26, ringT: 14, nv: 17, tiers: 2, tierGap: 44, band: 16, crown2: 6, light: 1, open: { band: 22 }, face: 12,
      fog: { mode: "dark", idx: I.land + 1, v0: 260, v1: 760, see: true }
    };
    PK = { ramp: I.trim, statueRamp: I.stat, deep: I.deep, light: 1, seed: 97, pColumn: 0.3, pBroken: 0.12, pStatue: 0.12, pUrn: 0.08, pLintel: 0.0, hMin: 150, hMax: 215, R: 8.5, capital: "ionic", statueH: 88, urnH: 32, drum: 26 };
    TB = B.tables(pal); DK.T = TB; PK.T = TB;
    R.birdIdx = I.cloud + 4; R.watcherIdx = I.trim + 3;                           // moonlit silver birds; a moonlit cloak that reads on the dark city
    R.markerIdx = { c0: I.wall + 1, c1: I.trim + 3, c2: I.trim + 5, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };   // cairns in the deck's own stone
    built = "";
    build(S);
  };

  // ---------- the hilltop city strip ----------
  function cityStrip(o) {
    var L = o.L, Hs = o.H, st = Sc.newStrip(L, Hs), d = st.d, put = B.put, get = B.get, x, y, i;
    var hills = o.hills, top = new Int16Array(L);
    for (x = 0; x < L; x++) {
      var best = Hs;
      for (i = 0; i < hills.length; i++) for (var k = -1; k <= 1; k++) {
        var hl = hills[i], dx = (x - hl.x - k * L) / hl.r; if (Math.abs(dx) >= 1) continue;
        var prof = Math.pow(Math.cos(dx * Math.PI / 2), hl.p), yy = Math.round(Hs - hl.h * Math.min(1, prof * hl.flat) - 1.5 * Math.sin(x * 0.19));
        if (yy < best) best = yy;
      }
      top[x] = Math.min(Hs - 2, best);
    }
    // land: moonlit crest, a few long retaining walls at irregular heights, a low town along the foot of the hills
    for (x = 0; x < L; x++) for (y = top[x]; y < Hs; y++) {
      var dd = y - top[x], c = I.land + (dd < 1 ? 5 : dd < 3 ? 3 : (dd < 12 ? 2 : 1));
      put(st, x, y, c);
    }
    for (var wv = 0; wv < o.walls; wv++) {
      var wx0 = Math.floor(hh(wv, 3) * L), wlen = 10 + Math.floor(hh(wv, 5) * 40), wy = Math.floor(Hs * (0.35 + 0.5 * hh(wv, 7)));
      for (x = wx0; x < wx0 + wlen; x++) { var xx0 = ((x % L) + L) % L; if (wy <= top[xx0] + 2) continue; put(st, x, wy, I.land + 4); put(st, x, wy + 1, I.land); }
    }
    for (x = 0; x < L; x++) {                                    // the town at the foot: a band of tiny roofs and lights
      var ht0 = 2 + Math.floor(hh(x >> 2, 9) * 4) + ((x >> 1) & 1);
      for (y = Hs - o.town - ht0; y < Hs; y++) { if (y < top[x]) continue; put(st, x, y, y === Hs - o.town - ht0 ? I.bld + 3 : (x % 7 === 6 ? I.bld : I.bld + 1)); }
      if (hh(x, 17) < 0.14) put(st, x, Hs - o.town + Math.floor(hh(x, 19) * (o.town - 2)), hh(x, 23) < 0.4 ? I.lamp + 5 : I.lamp + 4);
    }
    // the hill town: rows of houses stacked up the slopes (upper rows first so each lower row overlaps the one above);
    // moonlit right faces and roof edges, dark alleys, warm windows
    var rnd = PX.rng(o.seed), ry0 = 0;
    while (ry0 < Hs) {
      var tH = o.rowH + Math.floor(rnd() * 3), rowY = ry0 + tH, px = Math.floor(rnd() * 4), tone = I.bld + (ry0 < Hs * 0.35 ? 2 : 1), rowLit = o.lit * (1.35 - ry0 / Hs);
      while (px < L) {
        var gx = ((px % L) + L) % L;
        var bw = 3 + Math.floor(rnd() * o.bw), gap = rnd() < 0.16 ? 1 + Math.floor(rnd() * 3) : 0;
        var inCalm = o.calm && px > o.calm[0] - 4 && px < o.calm[1];
        if (inCalm || top[gx] > rowY - 3 || top[((px + bw) % L + L) % L] > rowY - 3) { px += 2; continue; }
        if (rnd() < 0.1) {                                        // a garden: dark trees between the houses
          for (var tq = 0; tq < 2 + Math.floor(rnd() * 2); tq++) B.cypress(st, px + 1 + tq * 3, rowY + 1, tH + 2 + Math.floor(rnd() * 5), { dark: I.tree, mid: I.tree + 1, lit: I.tree + 3 }, 1, true);
          px += 8; continue;
        }
        var bhgt = tH - 1 + Math.floor(rnd() * 4), by = rowY + Math.floor(rnd() * 2), sideW = Math.max(1, Math.round(bw * 0.3)), pitched = rnd() < 0.5, bright = rnd() < 0.25;
        for (y = by - bhgt; y <= by; y++) for (x = px; x < px + bw + sideW; x++) {
          var fc = x >= px + bw ? (bright ? (x === px + bw ? I.bld + 5 : I.bld + 4) : I.bld + 3) : (y === by - bhgt ? tone + 2 : tone);
          if (x === px) fc = tone - 1 < I.bld ? I.bld : tone - 1;
          put(st, x, y, fc);
        }
        if (pitched) { var rh = Math.max(1, Math.round((bw + sideW) * 0.3)); for (var rr = 1; rr <= rh; rr++) for (x = px + rr - 1; x < px + bw + sideW - rr + 1; x++) put(st, x, by - bhgt - rr, x >= px + (bw + sideW) / 2 ? (bright ? I.bld + 5 : I.bld + 4) : I.bld); }
        else for (x = px; x < px + bw + sideW; x++) put(st, x, by - bhgt - 1, bright ? I.bld + 5 : I.bld + 3);
        for (y = by - bhgt + 1; y < by; y += 2) for (x = px + 1; x < px + bw - 1; x += 2) if (rnd() < rowLit) put(st, x, y, rnd() < 0.3 ? I.lamp + 5 : (rnd() < 0.6 ? I.lamp + 4 : I.lamp + 3));
        px += bw + sideW + gap;
      }
      ry0 += tH;
    }
    // a grove of umbrella pines and cypresses in the calm valley (dark, quiet shapes behind the hero)
    if (o.calm) for (x = o.calm[0]; x < o.calm[1]; x += 5 + Math.floor(rnd() * 6)) {
      var gy2 = top[((x % L) + L) % L] + 1 + Math.floor(rnd() * 6);
      if (rnd() < 0.55) { var tr = 5 + Math.floor(rnd() * 5), cw2 = 5 + Math.floor(rnd() * 5); for (y = gy2 - tr; y <= gy2; y++) put(st, x, y, I.tree + 1); for (var yk = 0; yk < 3; yk++) for (var xk = -cw2 / 2 + yk; xk <= cw2 / 2 - yk; xk++) put(st, Math.round(x + xk), gy2 - tr - yk, yk === 2 ? I.tree + 3 : (xk > 0 ? I.tree + 2 : I.tree)); }
      else B.cypress(st, x, gy2, 6 + Math.floor(rnd() * 8), { dark: I.tree, mid: I.tree + 1, lit: I.tree + 3 }, 1, true);
    }
    // cypresses
    for (var n = 0; n < o.nc; n++) { var cx = Math.floor(rnd() * L), cy = top[cx] + 2 + Math.floor(rnd() * 12); B.cypress(st, cx, cy, 5 + Math.floor(rnd() * o.ch), { dark: I.tree, mid: I.tree + 1, lit: I.tree + 3 }, 1, true); }
    // temples on the chosen summits, with lamp glow between their columns
    for (i = 0; i < o.temples.length; i++) {
      var T = o.temples[i], tx = Math.round(T.x - T.w / 2), ty = top[((Math.round(T.x) % L) + L) % L] + 1;
      for (x = tx - 3; x < tx + T.w + 3; x++) for (y = ty - 1; y < ty + 3; y++) put(st, x, y, y === ty - 1 ? I.bld + 5 : I.land + 2);
      B.temple(st, tx, ty - 1, T.w, T.h, { lit: I.bld + 6, mid: I.bld + 4, dark: I.bld + 2, deep: I.bld, roof: I.bld + 3, glow: I.lamp + 4 }, 1, true);
    }
    // domes (with a drum and a lit crown) as landmarks
    if (o.domes) for (i = 0; i < o.domes.length; i++) {
      var Dm = o.domes[i], dcx = Math.round(Dm.x), dr = Dm.r, dgy = top[((dcx % L) + L) % L] + 2, dh = Math.max(2, Math.round(dr * 0.5));
      for (y = dgy - dh; y <= dgy + 2; y++) for (x = dcx - dr - 1; x <= dcx + dr + 1; x++) put(st, x, y, x > dcx + dr * 0.4 ? I.bld + 4 : (y === dgy - dh ? I.bld + 5 : I.bld + 2));
      for (y = 0; y <= dr; y++) { var hwd = Math.round(Math.sqrt(Math.max(0, dr * dr - y * y))); for (x = dcx - hwd; x <= dcx + hwd; x++) put(st, x, dgy - dh - 1 - y, (x - dcx) > hwd * 0.25 ? (x - dcx > hwd * 0.7 ? I.bld + 5 : I.bld + 4) : (y === dr ? I.bld + 4 : I.bld + 2)); }
      put(st, dcx, dgy - dh - dr - 2, I.bld + 6); put(st, dcx - 1, dgy - 1, I.lamp + 4); put(st, dcx + 1, dgy - 1, I.lamp + 3);
    }
    // a little aqueduct striding between two hills
    if (o.aq) { var a = o.aq; for (x = a.x0; x < a.x1; x++) { var ay = a.y; put(st, x, ay, I.bld + 4); put(st, x, ay + 1, I.bld + 2); var ph2 = (x - a.x0) % 7; if (ph2 === 0 || ph2 === 1) for (y = ay + 2; y < Math.min(Hs, top[((x % L) + L) % L] + 2); y++) put(st, x, y, ph2 === 0 ? I.bld + 3 : I.bld + 1); else if (ph2 === 2 || ph2 === 6) put(st, x, ay + 2, I.bld + 2); } }
    // lamp halos: a dithered warm ring around the brightest windows
    for (y = 1; y < Hs - 1; y++) for (x = 0; x < L; x++) {
      var v = d[y * L + x]; if (v !== I.lamp + 5) continue;
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) { if (!ox && !oy) continue; var g = get(st, x + ox, y + oy); if (g && g < I.lamp && ((x + ox + y + oy) & 1)) put(st, x + ox, y + oy, I.lamp + 1); }
    }
    st.top = top;
    return st;
  }

  // ---------- the lower city along the river (seen through the arches) ----------
  // rows of buildings recede (far rows paler), with domes, towers, porticos, umbrella pines and cypresses; a river crosses
  // with a bridge, quay lamps and animated reflections
  function building(st, px, by, bw, bh, tone, rnd, lit) {
    var put = B.put, x, y, type = rnd(), side = Math.max(1, Math.round(bw * 0.28));
    if (type < 0.1 && bw >= 6) {                                 // dome on a drum
      var r = Math.floor(bw / 2) - 1, cx = px + bw / 2 - 0.5, dy0 = by - bh;
      for (y = dy0; y <= by; y++) for (x = px; x < px + bw; x++) put(st, x, y, x >= px + bw - side ? tone + 2 : (y === dy0 ? tone + 3 : tone + 1));
      for (y = 0; y <= r; y++) { var hw = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); for (x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) put(st, x, dy0 - 1 - y, (x - cx) > hw * 0.2 ? tone + 4 : (y === r ? tone + 3 : tone + 1)); }
      put(st, Math.round(cx), dy0 - r - 2, tone + 4); put(st, Math.round(cx), dy0 - r - 3, tone + 3);
      if (rnd() < 0.5) put(st, px + 1, by - 1, I.lamp + 4);
      return;
    }
    if (type < 0.22) {                                           // tower
      var tw = Math.max(3, Math.round(bw * 0.45)), th = bh * 2 + 2;
      for (y = by - th; y <= by; y++) for (x = px; x < px + tw; x++) put(st, x, y, x === px + tw - 1 ? tone + 3 : (y === by - th ? tone + 4 : tone + 1));
      for (x = px - 1; x <= px + tw; x++) put(st, x, by - th - 1, (x - px) % 2 ? tone + 3 : tone + 1);
      for (y = by - th + 2; y < by - 1; y += 3) if (rnd() < lit * 1.6) put(st, px + 1, y, I.lamp + 4);
      return;
    }
    if (type < 0.3 && bw >= 7) {                                 // portico: columns, pediment, warm light inside
      var ph = Math.max(1, Math.round(bw * 0.25));
      for (y = by - bh; y <= by; y++) for (x = px; x < px + bw; x++) put(st, x, y, ((x - px) % 2 === 0) ? tone + 3 : (y > by - bh + 1 && rnd() < 0.5 ? I.lamp + 2 : tone));
      for (x = px - 1; x <= px + bw; x++) put(st, x, by - bh - 1, tone + 3);
      for (y = 0; y < ph; y++) for (x = px + y; x < px + bw - y; x++) put(st, x, by - bh - 2 - y, x > px + bw / 2 ? tone + 4 : tone + 2);
      return;
    }
    if (type < 0.4) {                                            // umbrella pine: tall trunk, flat dark canopy with a moonlit crown
      var trunk = bh + 3, cw = bw + 3, cxp = px + (bw >> 1);
      for (y = by - trunk; y <= by; y++) put(st, cxp, y, I.tree + 1);
      for (y = 0; y < 3; y++) for (x = cxp - cw / 2 + y; x <= cxp + cw / 2 - y; x++) put(st, Math.round(x), by - trunk - y, y === 2 ? I.tree + 3 : (x > cxp ? I.tree + 2 : I.tree));
      return;
    }
    for (y = by - bh; y <= by; y++) for (x = px; x < px + bw; x++) {                   // house with a pitched roof
      var fc = x >= px + bw - side ? tone + 2 : tone;
      if (y === by - bh) fc = tone + 3;
      put(st, x, y, fc);
    }
    if (rnd() < 0.6) { var rh2 = Math.max(1, Math.round(bw * 0.3)); for (var k = 1; k <= rh2; k++) for (x = px + k - 1; x < px + bw - k + 1; x++) put(st, x, by - bh - k, x >= px + bw * 0.5 ? tone + 4 : tone + 1); }
    for (y = by - bh + 2; y < by; y += 3) for (x = px + 1; x < px + bw - side - 1; x += 2) if (rnd() < lit) put(st, x, y, rnd() < 0.35 ? I.lamp + 5 : I.lamp + 4);
  }
  function lowCity(o) {
    var L = o.L, Hs = o.H, st = Sc.newStrip(L, Hs), put = B.put, x, y, rnd = PX.rng(o.seed), rows = o.rows, r;
    for (y = 0; y < Hs; y++) for (x = 0; x < L; x++) st.d[y * L + x] = I.land + (y < Hs * 0.05 ? 2 : 1);
    var ry = Math.round(Hs * o.river), rh = Math.round(Hs * 0.12);
    for (r = 0; r < rows.length; r++) {
      var R0 = rows[r], by = Math.round(Hs * R0.y), px = Math.floor(rnd() * 6);
      if (R0.y > o.river && !R0.done) {                          // the river lies between the far and the near rows
        for (y = ry; y < ry + rh; y++) for (x = 0; x < L; x++) { var t = (y - ry) / rh; put(st, x, y, I.river + (t < 0.12 ? 3 : (t < 0.55 ? 2 : 1))); }
        for (x = 3; x < L; x += 9 + Math.floor(rnd() * 12)) {    // quay lamps and their broken reflections
          put(st, x, ry - 1, I.lamp + 5); put(st, x, ry - 2, I.lamp + 3);
          for (y = ry + 1; y < ry + rh - 1; y++) if (((y + x) % 3) !== 2 && rnd() < 0.85) put(st, x + ((y >> 1) & 1 ? 0 : (rnd() < 0.5 ? -1 : 1)), y, I.refl + (y - ry < rh * 0.4 ? 2 : (y & 1)));
        }
        var bx0 = Math.round(L * 0.3), bx1 = bx0 + Math.round(L * 0.16);  // an arched bridge across the river
        for (x = bx0; x < bx1; x++) { var u = ((x - bx0) % 14) / 14, arch = Math.round(5 * Math.sin(u * Math.PI)); for (y = ry - 3; y < ry + rh - arch; y++) put(st, x, y, y === ry - 3 ? I.bld + 4 : (y === ry - 2 ? I.bld + 3 : (y >= ry + rh - arch - 1 ? I.river : I.bld + 2))); }
        R0.done = true;
      }
      while (px < L) {
        var bw = R0.bw[0] + Math.floor(rnd() * (R0.bw[1] - R0.bw[0])), bh = R0.bh[0] + Math.floor(rnd() * (R0.bh[1] - R0.bh[0]));
        building(st, px, by, bw, bh, R0.tone, rnd, R0.lit);
        for (y = by + 1; y < Math.min(Hs, by + R0.depth); y++) for (x = px; x < px + bw; x++) if (!(y >= ry && y < ry + rh)) put(st, x, y, R0.tone - (R0.tone > I.bld ? 1 : 0));
        if (rnd() < 0.12) B.cypress(st, px + bw + 1, by + 1, 4 + Math.floor(rnd() * R0.bh[1] * 1.3), { dark: I.tree, mid: I.tree + 1, lit: I.tree + 3 }, 1, true);
        px += bw + (rnd() < 0.35 ? 1 + Math.floor(rnd() * 3) : 0);
      }
    }
    st.ry = ry; st.rh = rh;
    return st;
  }

  // cloud band: a few soft strands (dithered edges), dark bellies; the moonlit crowns are added per frame near the moon
  function cloudBand(seed, w, h) {
    var rnd = PX.rng(seed), sp = new PX.Sprite(w, h), x, y, i, n = 2 + Math.floor(rnd() * 3);
    for (i = 0; i < n; i++) {
      var cx = w * (0.2 + 0.6 * rnd()), hw = w * (0.22 + 0.28 * rnd()), cy = Math.round(h * (0.3 + 0.45 * rnd())), th = 2 + Math.floor(rnd() * Math.max(1, h * 0.45));
      for (x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        var u = (x - cx) / hw, tt = th * Math.sqrt(Math.max(0, 1 - u * u)) + (hh(x >> 2, seed + i) - 0.5) * 1.5, ti = Math.round(tt);
        if (ti <= 0) { if (Math.abs(u) < 1 && ((x + cy) & 1)) sp.set(x, cy, I.cloud); continue; }
        for (y = cy - ti; y <= cy + Math.max(0, ti >> 1); y++) {
          var edge = y === cy - ti || y === cy + Math.max(0, ti >> 1);
          if (edge && ((x + y) & 1)) continue;                                   // dithered, soft edges
          sp.set(x, y, y <= cy - ti + 1 ? I.cloud + 2 : (y > cy ? I.cloud : I.cloud + 1));
        }
      }
    }
    return sp;
  }

  function build(S) {
    var k = S.w + "x" + S.h + "|" + (S.adj || 1); if (built === k) return; built = k;
    var w = S.w, h = S.h, hy = S.horizonY, s = Math.max(0.55, Math.min(1, w / (480 * (S.adj || 1)))) * (S.adj || 1);
    ST.mtn = Sc.mountainStrip({ L: Math.round(w * 1.3), H: Math.round(Math.min(h * 0.22, w * 0.3)), seed: 61, peaks: Math.max(4, Math.round(9 * w / 480)), hMin: 0.35, hMax: 1.0, sharp: 1.18, snow: 0.42, gullies: 5,
      pal: { rockDeep: I.mtn, rockS: I.mtn + 1, rockM: I.mtn + 2, rockL: I.mtn + 3, snowS: I.mtn + 4, snowL: I.mtn + 5, snowH: I.mtn + 6, snowD: I.mtn + 4 } });
    var cH = Math.round(Math.min(h * 0.34, w * 0.6)), cL = Math.round(w * 1.6), hr = Math.max(1, cH * 0.95 / (w * 0.28));   // hr widens the hills on tall screens
    ST.city = cityStrip({ L: cL, H: cH, seed: 23, walls: 10, town: Math.round(cH * 0.1), rowH: Math.round(5 * s) + 2, calm: [Math.round(w * 0.3), Math.round(w * 0.5)], domes: [{ x: w * 0.79, r: Math.round(10 * s) + 4 }], bw: Math.round(6 * s) + 2, bh: Math.round(5 * s) + 2, lit: 0.22, nc: Math.round(cL * 0.09), ch: Math.round(12 * s),
      hills: [{ x: w * 0.66, r: w * 0.28 * hr, h: cH * 0.78, p: 1.4, flat: 1.25 }, { x: w * 0.12, r: w * 0.2 * hr, h: cH * 0.46, p: 1.6, flat: 1.1 }, { x: w * 0.4, r: w * 0.16, h: cH * 0.2, p: 2, flat: 1 }, { x: w * 1.12, r: w * 0.26, h: cH * 0.55, p: 1.5, flat: 1.2 }, { x: w * 1.42, r: w * 0.2, h: cH * 0.34, p: 1.8, flat: 1 }],
      temples: [{ x: w * 0.66, w: Math.round(30 * s) + 6, h: Math.round(20 * s) + 6 }, { x: w * 1.12, w: Math.round(14 * s) + 4, h: Math.round(10 * s) + 4 }],
      aq: { x0: Math.round(w * 0.93), x1: Math.round(w * 1.04), y: Math.round(cH * 0.6) } });
    ST.low = lowCity({ L: Math.round(w * 1.3), H: Math.round(h * 0.62), seed: 31, river: 0.33,
      rows: [{ y: 0.08, bw: [4, 9], bh: [2, 5], depth: 5, tone: I.bld + 2, lit: 0.3 }, { y: 0.18, bw: [5, 11], bh: [3, 7], depth: 6, tone: I.bld + 1, lit: 0.26 }, { y: 0.29, bw: [6, 13], bh: [4, 8], depth: 4, tone: I.bld + 1, lit: 0.22 },
             { y: 0.58, bw: [8, 17], bh: [6, 12], depth: 12, tone: I.bld, lit: 0.2 }, { y: 0.8, bw: [10, 22], bh: [8, 15], depth: 20, tone: I.bld, lit: 0.18 }, { y: 1.0, bw: [12, 26], bh: [10, 18], depth: 4, tone: I.bld, lit: 0.16 }] });
    STARS = [];
    var rnd = PX.rng(71), n = Math.round(w * h / 420);
    for (var i = 0; i < n; i++) { var y = Math.pow(rnd(), 1.6) * (hy - 0.1 * h), x = rnd() * w; STARS.push({ x: Math.round(x), y: Math.round(y), g: Math.floor(rnd() * 3), big: rnd() < 0.06 }); }
    CL = [];
    for (i = 0; i < 6; i++) CL.push({ sp: cloudBand(401 + i * 7, Math.round((70 + PX.h1(i * 3) * 130) * s), Math.round(7 + PX.h1(i * 5) * 7)), x: PX.h1(i * 7 + 1) * w * 1.8, y: i === 0 ? 0.04 : 0.5 + PX.h1(i * 11 + 2) * 0.4, v: 0.6 + PX.h1(i * 13) * 1.2 });
    FF = [];
    for (i = 0; i < 12; i++) FF.push({ x: PX.h1(i * 17 + 3), y: PX.h1(i * 19 + 5), ph: PX.h1(i * 23) * 6.28, sp: 0.4 + PX.h1(i * 29) * 0.8 });
  }

  function moonPos(S) { var a = S.adj || 1, sh = Math.round((1 - S.openingT) * S.h * 0.04); return { x: Math.round(S.w * 0.78), y: Math.round(S.h * 0.14) + sh, r: Math.round(Math.max(8, Math.min(15, S.h / a * 0.036)) * a) }; }
  R.light = function (S) { var m = moonPos(S); return { x: m.x, y: m.y, k: 0.62, col: [196, 212, 255], ambient: [40, 54, 94], bright: 0.5, ground: [36, 46, 72] }; };

  // twinkling stars, breathing lamps, shimmering river reflections
  R.palette = function (pal, S) {
    var t = S.reduced ? 0 : S.tSec, i;
    var st = [[76, 90, 134], [141, 157, 200], [195, 208, 236]];
    for (i = 0; i < 3; i++) { var k = 0.72 + 0.28 * Math.sin(t * (1.3 + i * 0.7) + i * 2.1); pal.set(I.star + i, [st[i][0] * k + 14 * (1 - k), st[i][1] * k + 18 * (1 - k), st[i][2] * k + 40 * (1 - k)]); }
    var f = S.reduced ? 1 : 0.93 + 0.07 * Math.sin(t * 7.3) * Math.sin(t * 2.9);
    pal.set(I.lamp + 4, [255 * f, 216 * f, 120 * f]);
    var q = S.reduced ? 0 : Math.floor(t * 6) % 3, rf = [[122, 74, 58], [201, 138, 78], [242, 200, 120]];
    for (i = 0; i < 3; i++) pal.set(I.refl + i, rf[(i + q) % 3]);
  };

  function glow(fb, cx, cy, rad, lo, hi, amt) {
    var w = fb.w, h = fb.h, d = fb.d, li1 = TB.light1;
    for (var y = Math.max(0, cy - rad); y < Math.min(h, cy + rad); y++) for (var x = Math.max(0, cx - rad); x < Math.min(w, cx + rad); x++) {
      var dx = x - cx + 0.5, dy = y - cy + 0.5, q = 1 - Math.sqrt(dx * dx + dy * dy) / rad; if (q <= 0) continue;
      var o = y * w + x, v = d[o]; if (v < lo || v > hi) continue;
      var n = Math.floor(q * q * amt + BAY[y & 3][x & 3] + 0.5);
      while (n-- > 0 && v < hi) v = li1[v];
      d[o] = v;
    }
  }

  function moon(fb, S) {
    var m = moonPos(S), w = fb.w, h = fb.h, d = fb.d, r = m.r, ox = r * 0.42, oy = -r * 0.28, r2 = r * 0.93;
    glow(fb, m.x, m.y, Math.round(r * 5.2), I.sky, I.sky + 9, 3.2);
    for (var y = m.y - r - 1; y <= m.y + r + 1; y++) for (var x = m.x - r - 1; x <= m.x + r + 1; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      var dx = x - m.x + 0.5, dy = y - m.y + 0.5, dist = Math.sqrt(dx * dx + dy * dy); if (dist > r) continue;
      var ex = dx - ox, ey = dy - oy, inner = Math.sqrt(ex * ex + ey * ey), o = y * w + x;
      if (inner < r2) { d[o] = inner > r2 - 1.2 ? I.moon : (TB.light1[TB.light1[d[o]]]); continue; }   // earthshine
      var edge = inner - r2;
      d[o] = dist > r - 1.1 ? I.moon + 2 : (edge < 1.2 ? I.moon + 1 : (edge < 3 ? I.moon + 2 : I.moon + 3));
    }
  }

  R.backdrop = function (fb, S, pal) {
    build(S);
    var w = fb.w, h = fb.h, sh = Math.round((1 - S.openingT) * h * 0.12), hy = S.horizonY + sh, al = S.altitude * Math.min(1, w / 480), i, d = fb.d;
    var skyIdx = []; for (i = 0; i < 10; i++) skyIdx.push(I.sky + i);
    var skyBot = Math.round(hy - 0.06 * h);
    Sc.bands(fb, 0, skyBot, skyIdx, 3);
    if (skyBot < h) fb.fillRect(0, Math.max(0, skyBot), w, h, I.sky + 9);
    // stars (fewer near the horizon), some with a small cross
    var sdy = sh * 0.5 | 0, drift = al * 0.004;
    for (i = 0; i < STARS.length; i++) {
      var s0 = STARS[i], x = Math.round(((s0.x - drift) % w + w) % w), y = s0.y + sdy; if (y < 0 || y >= skyBot - 4) continue;
      var o = y * w + x, bg = d[o]; if (bg < I.sky || bg > I.sky + 9) continue;
      d[o] = s0.big ? I.star + 3 : I.star + s0.g;
      if (s0.big) { fb.set(x - 1, y, I.star + 1); fb.set(x + 1, y, I.star + 1); fb.set(x, y - 1, I.star + 1); fb.set(x, y + 1, I.star + 1); }
    }
    moon(fb, S);
    for (i = 0; i < CL.length; i++) {
      var c = CL[i], span = w * 1.8 + c.sp.w, cx = ((c.x - S.tSec * c.v * (S.reduced ? 0 : 1) - al * 0.05) % span + span) % span - c.sp.w;
      fb.blit(c.sp, Math.round(cx), Math.round(c.y * (hy - h * 0.2)), 0);
    }
    var mm = moonPos(S), mr = mm.r * 9;
    for (var yy = Math.max(0, mm.y - mr); yy < Math.min(h, mm.y + mr); yy++) for (var xx = Math.max(0, mm.x - mr); xx < Math.min(w, mm.x + mr); xx++) {
      var oo = yy * w + xx, cv = d[oo]; if (cv < I.cloud || cv > I.cloud + 3) continue;
      var dd2 = Math.sqrt((xx - mm.x) * (xx - mm.x) + (yy - mm.y) * (yy - mm.y) * 2) / mr;
      if (dd2 < 1 && BAY[yy & 3][xx & 3] + 0.5 < (1 - dd2) * 1.6) { var up = oo >= w ? d[oo - w] : 0; d[oo] = (up < I.cloud || up > I.cloud + 4) ? I.cloud + 4 : TB.light1[cv]; }
    }
    Sc.blitStrip(fb, ST.mtn, al * 0.02 + 180, Math.round(hy - 0.1 * h - ST.mtn.h));
    fb.fillRect(0, Math.round(hy - 0.1 * h), w, h, I.mtn);
    Sc.blitStrip(fb, ST.city, al * 0.04, Math.round(hy + 0.02 * h - ST.city.h));
    var lyy = Math.round(hy + 0.02 * h);
    Sc.blitStrip(fb, ST.low, al * 0.075 + 60, lyy);
    var mp = moonPos(S);                                           // the moon's path on the river
    for (var ry2 = lyy + ST.low.ry + 1; ry2 < lyy + ST.low.ry + ST.low.rh - 1; ry2++) {
      if (ry2 < 0 || ry2 >= h || (ry2 & 1)) continue;
      var spr = 4 + (ry2 - lyy - ST.low.ry) * 1.6;
      for (var gx = Math.round(mp.x - spr); gx <= Math.round(mp.x + spr); gx++) { if (gx < 0 || gx >= w) continue; var o3 = ry2 * w + gx, vv = d[o3]; if (vv >= I.river && vv <= I.river + 4 && hh(gx >> 1, ry2) < 0.45) d[o3] = hh(gx, ry2 + 1) < 0.3 ? I.moon + 1 : I.river + 4; }
    }
    if (hy + 0.02 * h + ST.low.h < h) fb.fillRect(0, Math.round(hy + 0.02 * h + ST.low.h), w, h, I.land);
  };

  R.ground = function (fb, S, pal) {
    B.deck(fb, S, DK);
    B.props(fb, S, DK, PK);
  };

  // fireflies over the deck: warm points that blink and wander (kept away from the hero)
  R.front = function (fb, S, pal) {
    if (S.reduced) return;
    var w = fb.w, h = fb.h, ax = S.ztx + S.anchorX * S.zoom, ay = S.zty + S.anchorY * S.zoom, t = S.tSec;
    for (var i = 0; i < FF.length; i++) {
      var f = FF[i], x = Math.round(((f.x * w * 1.4 + Math.sin(t * f.sp + f.ph) * 30 - S.altitude * 0.9) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2);
      var y = Math.round(ay - h * 0.08 - f.y * h * 0.4 + Math.sin(t * f.sp * 1.7 + f.ph * 2) * 8);
      if (Math.abs(x - ax) < 50 && Math.abs(y - ay) < 60) continue;
      var b = Math.sin(t * 2.2 * f.sp + f.ph * 3); if (b < 0.1) continue;
      fb.set(x, y, b > 0.6 ? I.lamp + 5 : I.lamp + 4);
      if (b > 0.75) { fb.set(x - 1, y, I.lamp + 2); fb.set(x + 1, y, I.lamp + 2); }
    }
  };

  R.thumb = { ratio: 0.78, f: 3 };            // realm card: f=3 keeps the crescent moon a crescent after the block reduction
  V8.register("moon-rome", R);
})(typeof window !== "undefined" ? window : this);
