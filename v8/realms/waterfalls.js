// The Falls - V8 scene. A deep forested gorge at dusk: huge blue-grey cliff walls in three depths close in on both sides,
// thin waterfalls pour from the pine rims (palette-cycled water, so it flows without redrawing a pixel), a far stone arch
// bridge spans the gorge against the pink-orange afterglow, and mist fills the depths. The ground is the shared stone
// bridge deck (V8.bridge): mossy granite, one tier of arches whose openings look down into the misty gorge.
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
  var R = { rock: { mat: "night", style: "granite" } }, I = {}, ST = {}, CL = [], built = "", DK = null, PK = null, TB = null;
  function H(list) { return list.map(hex); }

  R.init = function (pal, S) {
    I.sky = pal.ramp("sky", H(["#171b37", "#212548", "#2d2e59", "#3c3666", "#4d3e6e", "#614773", "#785076", "#915a78", "#aa6579", "#c2737a", "#d6887d", "#e6a283", "#f2bf92"]));
    I.cloud = pal.ramp("cloud", H(["#2e2f58", "#473f6c", "#6b4f7a", "#a26885", "#e29c94"]));
    I.haze = pal.ramp("haze", H(["#4f4c78", "#625784", "#7a648d", "#977396", "#b98799"]));
    I.farC = pal.ramp("farC", H(["#2b3656", "#344262", "#40506e", "#54647f", "#9b8098"]));
    I.midC = pal.ramp("midC", H(["#172538", "#1e3044", "#283c51", "#344b5f", "#4a6072", "#a88597"]));
    I.nearC = pal.ramp("nearC", H(["#0c1420", "#111c2b", "#172636", "#1f3143", "#2a4053", "#3d5669", "#b08e9c"]));
    I.pineM = pal.ramp("pineM", H(["#10202e", "#172b38", "#213a44", "#86708a"]));
    I.pineN = pal.ramp("pineN", H(["#07111a", "#0c1a22", "#13262c", "#1c3536", "#6e5f79"]));
    I.water = pal.ramp("water", H(["#8fa9c4", "#b2c9dc", "#d5e4ee", "#f2f8fb"]));
    I.fall = pal.ramp("fall", H(["#58728f", "#7d98b2"]));
    I.waterF = pal.ramp("waterF", H(["#6d86a2", "#8aa2bb", "#a8bdd0", "#c4d4e1"]));
    I.mist = pal.ramp("mist", H(["#344a63", "#415a72", "#526c82", "#677f93", "#7f94a5", "#9aabb9", "#b7c3cd"]));
    I.wall = pal.ramp("wall", H(["#111722", "#1a212e", "#232c3b", "#2e3849", "#3b4657", "#4d586a", "#667083"]));
    I.trim = pal.ramp("trim", H(["#151b27", "#212836", "#2d3546", "#3b4457", "#4c5669", "#687084", "#b89ca8"]));
    I.moss = pal.ramp("moss", H(["#0c1c1a", "#142a24", "#1f3d2c", "#305735", "#4e7446"]));
    I.fol = I.moss;
    I.deep = pal.ramp("deep", H(["#080b12"]));
    DK = {
      wall: I.wall, trim: I.trim, ring: I.wall, mortar: I.wall, deep: I.deep,
      A: 280, pier: 68, phase: 60, slab: 13, slabL: 72, frieze: 9, dentil: false, string: 5, course: 17, blockL: 46,
      crown: 30, ringT: 15, nv: 15, tiers: 1, light: 1, open: { band: 26 }, face: 10,
      fog: { mode: "mist", idx: I.mist + 2, idx2: I.mist + 3, v0: 190, v1: 640, see: true }, moss: I.moss + 1, mossAmt: 0.2, tufts: true
    };
    PK = { ramp: I.trim, statueRamp: I.trim, deep: I.deep, light: 1, seed: 311, pColumn: 0.04, pBroken: 0.16, pStatue: 0.1, pUrn: 0.07, hMin: 90, hMax: 150, R: 8, capital: "doric", statueH: 84, urnH: 30, drum: 24 };
    TB = B.tables(pal); DK.T = TB; PK.T = TB;
    R.birdIdx = I.nearC; R.watcherIdx = I.deep;                                   // engine overlays: dark silhouettes read on dusk sky / mist
    R.markerIdx = { c0: I.wall + 1, c1: I.trim + 3, c2: I.trim + 5, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };   // cairns in the deck's own stone
    // (the baked scene holds palette INDICES only, keyed by screen size: it stays valid across re-inits, so a revisit costs ~nothing)
    build(S);
  };

  // periodic value noise on a coarse grid (period L in x, so a strip's wrap column has no seam); smooth bilinear, cheap
  function gridNoise(L, H, cw, ch, seed) {
    var nx = Math.max(2, Math.round(L / cw)), ny = Math.ceil(H / ch) + 2, g = new Float32Array(nx * ny), cx = L / nx;
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) g[j * nx + i] = hh(i * 7 + seed, j * 13 + seed * 3);
    return function (x, y) {
      var fx = (((x % L) + L) % L) / cx, fy = Math.max(0, y) / ch, i0 = Math.floor(fx), j0 = Math.floor(fy), tx = fx - i0, ty = fy - j0;
      var i1 = (i0 + 1) % nx; if (j0 >= ny - 1) j0 = ny - 2;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      var a = g[j0 * nx + i0], b = g[j0 * nx + i1], c = g[(j0 + 1) * nx + i0], d = g[(j0 + 1) * nx + i1];
      return a + (b - a) * tx + (c - a + (a - b - c + d) * tx) * ty;
    };
  }

  // ---------- cliff strip ----------
  // Each mass is split into rock pillars (prisms: a lit face toward the gorge light, a shaded face, dark crevices between),
  // crossed by strata ledges (lit lip + shadow), lighter near the rim, with pines along the top, shrubs on the ledges,
  // waterfalls that step over ledges and end in spray, and a base that dissolves into the mist.
  // o: { L, H, seed, masses:[{a,b,top,spread,lit}], pal:{deep,dark,mid,light,top,rim}, pine:{d,m,l,rim}, pineH:[min,max], pineGap,
  //      pw:[min,max] pillar width, ledge (px between strata), falls:[{x, w}], spray, fade:{idx, rows} }
  function cliffStrip(o) {
    var L = o.L, Hs = o.H, st = Sc.newStrip(L, Hs), d = st.d, rnd = PX.rng(o.seed), p = o.pal, put = B.put, get = B.get;
    var rim = new Int16Array(L).fill(Hs), m, x, y, i;
    var tones = [p.deep, p.dark, p.mid, p.light, p.top], nz = gridNoise(L, Hs, 28, 45, o.seed * 11 + 3);
    for (i = 0; i < o.masses.length; i++) {
      m = o.masses[i];
      var a = m.a, b = m.b, top = m.top, sd = o.seed * 17 + i * 101, lit = m.lit || 1;
      var spread = Math.min(m.spread == null ? 0.16 : m.spread, (o.maxSpread || 1e9) / Math.max(1, Hs - top));   // tall screens: the base never creeps under the gorge
      var steps = [], acc = 0, accR = 0, capS = Math.round((o.maxSpread || 60) * 0.5);
      for (y = 0; y < Hs; y++) {
        if (y > top + 6 && hh(sd, y) < 0.05) { acc = clamp(acc + Math.round((hh(sd + 1, y) - 0.3) * 6), -capS, capS); accR = clamp(accR + Math.round((hh(sd + 2, y) - 0.3) * 6), -capS, capS); }
        steps.push([acc, accR]);
      }
      // pillars across the whole footprint of the mass (some wide buttresses, some thin columns)
      var x0m = Math.floor(a - Hs * spread - 24), x1m = Math.ceil(b + Hs * spread + 24), pil = [], px = x0m;
      while (px < x1m) {
        var hw0 = hh(sd + 5, px), pwid = hw0 < 0.2 ? Math.round(o.pw[1] * (1.6 + hw0 * 3)) : Math.round(o.pw[0] + (o.pw[1] - o.pw[0]) * hh(sd + 9, px));
        pil.push({ x0: px, x1: px + pwid, dp: hh(sd + 6, px), off: Math.round(hh(sd + 7, px) * o.ledge * 0.9), cap: Math.round(hh(sd + 8, px) * 6), crev: hh(sd + 10, px) < 0.6, lg: Math.max(5, Math.round(o.ledge * (0.7 + 0.7 * hh(sd + 11, px)))) });
        px += pwid;
      }
      var pIdx = new Int16Array(x1m - x0m + 1), rimOff = new Int8Array(x1m - x0m + 1);
      for (var q = 0; q < pil.length; q++) for (x = pil[q].x0; x < pil[q].x1 && x <= x1m; x++) pIdx[x - x0m] = q;
      for (x = x0m; x <= x1m; x++) rimOff[x - x0m] = pil[pIdx[x - x0m]].cap + Math.round(1.5 * Math.sin((x + sd) * 0.31));
      var litX = lit > 0;
      for (y = Math.max(0, top - 8); y < Hs; y++) {
        var dy = Math.max(0, y - top), xl = Math.round(a - dy * spread - steps[y][0]), xr2 = Math.round(b + dy * spread + steps[y][1]);
        var row = y * L, by3 = BAY[y & 3];
        for (x = xl; x <= xr2; x++) {
          var ex = x - xl < xr2 - x ? x - xl : xr2 - x, xi = x - x0m; if (xi < 0) xi = 0; else if (xi > x1m - x0m) xi = x1m - x0m;
          var tp = top + rimOff[xi] + (ex < 8 ? ((8 - ex) * (8 - ex) * 0.1 + 0.5) | 0 : 0);
          if (y < tp) continue;
          var P0 = pil[pIdx[xi]], pwv = P0.x1 - P0.x0, u = (x - P0.x0 + 0.5) / pwv;
          var xx = x % L; if (xx < 0) xx += L;
          if (y < rim[xx]) rim[xx] = y;
          var depth = (y - tp) / (Hs - tp > 1 ? Hs - tp : 1), lr = (y - tp - P0.off) % P0.lg, strat = lr < 0 ? lr + P0.lg : lr;
          var lvl = 2.1 - P0.dp * 0.8 - depth * 1.7 + (nz(x + i * 97, y) - 0.5) * 1.8 + (y - tp < 4 ? 0.9 : 0);
          var face = litX ? u : 1 - u;                              // 1 = the edge toward the light
          if (pwv >= 6) { if (face * pwv > pwv - 2.2) lvl += 1.0; else if (face * pwv < 1.6) lvl -= 0.7; }
          if (strat >= 2 && strat < 4) lvl -= 0.8;                     // shadow under each ledge
          var c, ti;
          if (P0.crev && u * pwv < 1 && y > tp + 3 && strat > 1) c = p.deep;   // crevice between pillars
          else if (strat === 0 && y > tp + 3) c = lvl > 0.9 ? p.top : p.light;  // ledge lip catching the sky
          else if (strat === 1 && y > tp + 3) c = p.deep;
          else if (y === tp) c = p.top;
          else { ti = Math.floor(lvl + by3[x & 3] * 0.9 + 0.5); c = tones[ti < 0 ? 0 : ti > 4 ? 4 : ti]; }
          if (ex === 0) c = (litX ? x === xr2 : x === xl) ? (depth < 0.5 ? p.rim : p.light) : p.deep;   // silhouette: rim toward the gorge
          d[row + xx] = c;
        }
      }
      // foliage clumps on the ledges
      if (o.fol) for (var sx = x0m; sx < x1m; sx += 2) {
        var P1 = pil[pIdx[clamp(sx - x0m, 0, x1m - x0m)]];
        for (var k2 = 1; k2 < 14; k2++) {
          var ly = top + P1.cap + P1.off + k2 * P1.lg; if (ly >= Hs - (o.fade ? o.fade.rows : 0)) break;
          if (hh(sx, ly) > o.folAmt || get(st, sx, ly) === 0 || get(st, sx, ly + 3) === 0) continue;
          var shw = 1 + Math.round(hh(sx + 1, ly) * o.folSize), shh = 1 + Math.round(hh(sx + 2, ly) * o.folSize * 0.8);
          for (var dx2 = -shw; dx2 <= shw; dx2++) {
            var colH = Math.round(shh * Math.sqrt(1 - (dx2 * dx2) / ((shw + 0.5) * (shw + 0.5))));
            for (var yy2 = 0; yy2 <= colH + 1; yy2++) {
              var cf = yy2 === colH + 1 ? 0 : (yy2 === colH ? o.fol + 3 : (dx2 * lit > shw * 0.3 ? o.fol + 2 : (yy2 === 0 ? o.fol : o.fol + 1)));
              if (!cf) { if (hh(sx + dx2, ly + yy2) < 0.3) put(st, sx + dx2, ly - yy2 + 1, o.fol + 3); continue; }
              put(st, sx + dx2, ly - yy2 + 1, cf);
            }
          }
        }
      }
    }
    // pines along the rims: tiered firs, lit on the side facing the afterglow
    if (o.pine) {
      var pn = o.pine, pxp = 0;
      while (pxp < L) {
        var ry = rim[pxp];
        if (ry < Hs - 4) {
          var ph = Math.round(o.pineH[0] + (o.pineH[1] - o.pineH[0]) * rnd()), hw = Math.max(1, ph * 0.28), tiers = Math.max(2, Math.round(ph / 6)), lside = pxp % 7 < 4 ? 1 : -1;
          for (var yy = 0; yy < ph; yy++) {
            var t = yy / Math.max(1, ph - 1), tierPos = (t * tiers) % 1, half = Math.round(hw * (0.12 + 0.88 * t) * (0.6 + 0.4 * tierPos));
            var ty = ry + 1 - ph + yy;
            for (var dx = -half; dx <= half; dx++) {
              if (ty > ry && get(st, pxp + dx, ty)) continue;
              var cc = yy === 0 ? pn.rim : (tierPos > 0.8 ? pn.d : (dx * lside > half * 0.4 ? (t < 0.5 ? pn.rim : pn.l) : (dx * lside < -half * 0.3 ? pn.d : pn.m)));
              put(st, pxp + dx, ty, cc);
            }
          }
        }
        pxp += Math.max(2, Math.round(o.pineGap * (0.5 + rnd())));
      }
    }
    // waterfalls: palette-cycled water, ragged edges, splashes where they step over a ledge, spray at the base
    if (o.falls) for (i = 0; i < o.falls.length; i++) {
      var f = o.falls[i], fx = Math.round(f.x), fw = Math.max(1, Math.round(f.w * (o.adj || 1))), xw = ((fx % L) + L) % L, y0 = rim[xw];
      if (y0 >= Hs - 4) continue;
      var shift = 0, lastStep = y0;
      for (y = y0 - 1; y < Hs; y++) {
        var splash = false;
        if (y > lastStep + 18 && hh(fx, y) < 0.04) { shift += hh(fx + 3, y) < 0.5 ? -2 : 2; lastStep = y; splash = true; }
        var wv = fw + (y - y0 > 2 ? Math.round(hh(fx + 11, y >> 1) * 1.4 - 0.4) : 0) + Math.floor((y - y0) / 60);
        var xs = fx + shift - (wv > fw ? 1 : 0);
        for (var q2 = 0; q2 < wv; q2++) {
          var X = xs + q2, cq;
          if (q2 === 0 && wv > 2) cq = I.fall; else if (q2 === wv - 1 && wv > 1) cq = I.fall + 1;
          else cq = o.water + ((Math.floor(y * 0.5) + q2 * 2 + (hh(X, 9) < 0.5 ? 0 : 1)) & 3);
          put(st, X, y, cq);
        }
        if (splash) for (var sp = 1; sp < 4; sp++) { put(st, xs - sp, y + sp, o.spray); put(st, xs + wv - 1 + sp, y + sp, o.spray); if (sp < 2) { put(st, xs - sp, y, o.water + 3); put(st, xs + wv - 1 + sp, y, o.water + 3); } }
      }
      // spray plume where the fall disappears into the mist
      var pyb = Hs - (o.fade ? o.fade.rows : 0);
      for (y = pyb - 14; y < Hs; y++) { var spw = 2 + Math.round((y - pyb + 14) * 0.45); for (var sx2 = -spw; sx2 <= spw + fw; sx2++) if (BAY[y & 3][((fx + sx2) % 4 + 4) & 3] + 0.5 < 0.55 - Math.abs(sx2 - fw / 2) / (spw + fw) * 0.5) put(st, fx + shift + sx2, y, o.spray); }
    }
    if (o.fade) for (y = 0; y < o.fade.rows; y++) {
      var ry2 = Hs - 1 - y, amt = 1 - y / o.fade.rows;
      for (x = 0; x < L; x++) if (d[ry2 * L + x] && (BAY[ry2 & 3][x & 3] + 0.5) < amt) d[ry2 * L + x] = o.fade.idx;
    }
    st.rim = rim;
    return st;
  }

  // cloud bank sprite: overlapping flat lenses; dark crowns, lit undersides (the sun is already below the horizon)
  function cloudBank(seed, w, h, pal) {
    var rnd = PX.rng(seed), sp = new PX.Sprite(w, h), n = 3 + Math.floor(rnd() * 4), lens = [], i, x, y;
    for (i = 0; i < n; i++) lens.push({ cx: w * (0.12 + 0.76 * rnd()), cy: h * (0.45 + 0.3 * rnd()), rx: w * (0.14 + 0.26 * rnd()), ry: h * (0.2 + 0.25 * rnd()) });
    for (i = 0; i < n + 3; i++) lens.push({ cx: w * (0.18 + 0.64 * rnd()), cy: h * (0.3 + 0.25 * rnd()), rx: h * (0.25 + 0.3 * rnd()), ry: h * (0.25 + 0.3 * rnd()) });
    n = lens.length;
    var top = new Int16Array(w).fill(h), bot = new Int16Array(w).fill(-1);
    for (x = 0; x < w; x++) for (y = 0; y < h; y++) {
      var inside = false;
      for (i = 0; i < n && !inside; i++) { var dx = (x + 0.5 - lens[i].cx) / lens[i].rx, dy = (y + 0.5 - lens[i].cy) / lens[i].ry; if (dx * dx + dy * dy <= 1) inside = true; }
      if (inside) { if (y < top[x]) top[x] = y; if (y > bot[x]) bot[x] = y; }
    }
    for (x = 0; x < w; x++) for (y = top[x]; y <= bot[x]; y++) {
      var db = bot[x] - y, dt = y - top[x], c;
      if (db < 1) c = pal[4]; else if (db < 2) c = pal[3]; else if (dt < 1) c = pal[0]; else if (db < 3 + ((x >> 1) & 1)) c = pal[2]; else c = pal[1];
      sp.set(x, y, c);
    }
    return sp;
  }

  // far stone arch bridge between two cliffs: balustrade, a warm rim on the deck, a great arch with a lit ring,
  // two small relieving arches in the spandrels, faint joints; everything below melts into the mist
  function farBridge(st, xa, xb, yd, pal) {
    var span = xb - xa, cx = (xa + xb) / 2, rr = span * 0.34, sr = Math.max(2, span * 0.05), x, y;
    for (x = Math.round(xa); x <= Math.round(xb); x++) {
      var dx = x - cx, arch = Math.abs(dx) < rr ? yd + 6 + (rr - Math.sqrt(rr * rr - dx * dx)) : 1e9, archR = Math.abs(dx) < rr + 2 ? yd + 6 + (rr + 2 - Math.sqrt(Math.max(0, (rr + 2) * (rr + 2) - dx * dx))) - 2 : 1e9;
      var small = 1e9, smallR = 1e9;
      for (var sd = -1; sd <= 1; sd += 2) { var sx = cx + sd * (rr + span * 0.09), ddx = x - sx; if (Math.abs(ddx) < sr) { small = yd + 5 + (sr - Math.sqrt(sr * sr - ddx * ddx)); smallR = small + sr * 2.2; } }
      if (((x - Math.round(xa)) & 1) === 0) B.put(st, x, yd - 1, pal.mid);                   // balustrade
      for (y = yd; y < st.h; y++) {
        if (y > arch) continue;                                                              // the great opening
        if (y > small && y < smallR) continue;                                               // small openings
        var c;
        if (y === yd) c = pal.rim; else if (y === yd + 1) c = pal.light; else if (y === yd + 2) c = pal.deep;
        else if (y > archR) c = (y > arch - 1.5) ? pal.light : pal.mid;                     // the arch ring, lit on its inner edge
        else c = ((x * 5 + (y >> 2) * 3) % 11 === 0) ? pal.deep : pal.dark;                  // spandrel wall with a few joints
        B.put(st, x, y, c);
      }
    }
  }

  function mass(u0, u1, topF, w, h, hy, y0, spread, lit) { return { a: Math.round(u0 * w), b: Math.round(u1 * w), top: Math.round(hy + topF * h - y0), spread: spread, lit: lit }; }

  function build(S) {
    var k = S.w + "x" + S.h + "|" + (S.adj || 1); if (built === k) return; built = k;
    var w = S.w, h = S.h, hy = S.horizonY, s = Math.max(0.55, Math.min(1, w / (480 * (S.adj || 1)))) * (S.adj || 1), nw = w < 300 ? 0.7 : 1;
    // vertical frame of each layer (strip y0 = screen row of the strip's top when openingT = 1)
    var nY0 = Math.round(hy - 0.86 * h), nY1 = Math.round(hy + 0.40 * h);
    var mY0 = Math.round(hy - 0.62 * h), mY1 = Math.round(hy + 0.12 * h);
    var fY0 = Math.round(hy - 0.42 * h), fY1 = Math.round(hy + 0.0 * h);
    ST.nY0 = nY0; ST.mY0 = mY0; ST.fY0 = fY0;
    var nL = w < 300 ? 2.3 : 1.7;
    ST.near = cliffStrip({ adj: S.adj || 1, maxSpread: Math.round(w * 0.12), L: Math.round(w * nL), H: nY1 - nY0, seed: 7, water: I.water, pw: [Math.round(7 * s) + 2, Math.round(17 * s) + 3], ledge: Math.round(22 * s) + 6,
      masses: w < 300 ? [mass(-0.16, 0.14, -0.64, w, h, hy, nY0, 0.1, 1), mass(0.9, 1.16, -0.58, w, h, hy, nY0, 0.09, -1), mass(1.66, 1.8, -0.46, w, h, hy, nY0, 0.12, -1)]
                      : [mass(-0.2, 0.19, -0.64, w, h, hy, nY0, 0.14, 1), mass(0.84, 1.32, -0.58, w, h, hy, nY0, 0.12, -1), mass(1.46, 1.56, -0.42, w, h, hy, nY0, 0.18, -1)],
      pal: { deep: I.nearC, dark: I.nearC + 1, mid: I.nearC + 2, light: I.nearC + 4, top: I.nearC + 5, rim: I.nearC + 6 },
      pine: { d: I.pineN, m: I.pineN + 1, l: I.pineN + 3, rim: I.pineN + 4 }, pineH: [Math.round(14 * s), Math.round(32 * s)], pineGap: 4 * s + 1,
      fol: I.fol, folAmt: 0.3, folSize: 4 * s + 1,
      falls: w < 300 ? [{ x: w * 0.03, w: 3 }, { x: w * 0.1, w: 2 }, { x: w * 0.97, w: 4 }, { x: w * 1.72, w: 2 }] : [{ x: w * 0.055, w: 4 }, { x: w * 0.135, w: 3 }, { x: w * 0.93, w: 5 }, { x: w * 1.5, w: 3 }], spray: I.mist + 6,
      fade: { idx: I.mist + 1, rows: Math.round(h * 0.16) } });
    ST.mid = cliffStrip({ adj: S.adj || 1, maxSpread: Math.round(w * 0.12), L: Math.round(w * 1.45), H: mY1 - mY0, seed: 19, water: I.waterF, pw: [Math.round(5 * s) + 2, Math.round(12 * s) + 2], ledge: Math.round(16 * s) + 5,
      masses: [mass(0.08, 0.34, -0.44, w, h, hy, mY0, 0.1, 1), mass(0.77, 0.98, -0.4, w, h, hy, mY0, 0.1, -1), mass(1.14, 1.3, -0.32, w, h, hy, mY0, 0.14, -1)],
      pal: { deep: I.midC, dark: I.midC + 1, mid: I.midC + 2, light: I.midC + 3, top: I.midC + 4, rim: I.midC + 5 },
      pine: { d: I.pineM, m: I.pineM + 1, l: I.pineM + 2, rim: I.pineM + 3 }, pineH: [Math.round(8 * s), Math.round(18 * s)], pineGap: 3 * s + 1,
      fol: I.fol, folAmt: 0.22, folSize: 2.5 * s + 0.5,
      falls: [{ x: w * 0.3, w: 3 }, { x: w * 0.81, w: 3 }, { x: w * 1.2, w: 2 }], spray: I.mist + 5,
      fade: { idx: I.mist + 2, rows: Math.round(h * 0.13) } });
    ST.far = cliffStrip({ adj: S.adj || 1, maxSpread: Math.round(w * 0.12), L: Math.round(w * 1.25), H: fY1 - fY0, seed: 29, water: I.waterF, pw: [3, Math.round(7 * s) + 2], ledge: Math.round(11 * s) + 4,
      masses: [mass(0.3, 0.5, -0.3, w, h, hy, fY0, 0.06, 1), mass(0.64, 0.84, -0.28, w, h, hy, fY0, 0.06, -1), mass(1.02, 1.12, -0.2, w, h, hy, fY0, 0.1, -1)],
      pal: { deep: I.farC, dark: I.farC + 1, mid: I.farC + 2, light: I.farC + 3, top: I.farC + 3, rim: I.farC + 4 },
      pine: { d: I.farC, m: I.farC + 1, l: I.farC + 2, rim: I.farC + 4 }, pineH: [Math.round(4 * s) + 1, Math.round(9 * s) + 1], pineGap: 2,
      falls: [{ x: w * 0.47, w: 1 }, { x: w * 0.7, w: 2 }], spray: I.mist + 5,
      fade: { idx: I.mist + 3, rows: Math.round(h * 0.11) } });
    var gY0 = Math.round(hy - 0.34 * h), gY1 = Math.round(hy - 0.06 * h); ST.gY0 = gY0;
    ST.far2 = cliffStrip({ maxSpread: Math.round(w * 0.12), L: Math.round(w * 1.15), H: gY1 - gY0, seed: 53, pw: [2, Math.round(5 * s) + 2], ledge: Math.round(8 * s) + 3,
      masses: [mass(0.38, 0.545, -0.22, w, h, hy, gY0, 0.05, 1), mass(0.6, 0.76, -0.2, w, h, hy, gY0, 0.05, -1), mass(0.95, 1.05, -0.15, w, h, hy, gY0, 0.08, 1)],
      pal: { deep: I.haze, dark: I.haze + 1, mid: I.haze + 1, light: I.haze + 2, top: I.haze + 3, rim: I.haze + 4 },
      pine: { d: I.haze, m: I.haze + 1, l: I.haze + 1, rim: I.haze + 3 }, pineH: [2, Math.round(5 * s) + 1], pineGap: 2,
      fade: { idx: I.mist + 4, rows: Math.round(h * 0.1) } });
    farBridge(ST.far, w * 0.48, w * 0.66, Math.round(hy - 0.27 * h - fY0), { deep: I.farC, dark: I.farC + 1, mid: I.farC + 1, light: I.farC + 3, rim: I.farC + 4 });
    // hazy ridges at the far end of the gorge, glowing at the edges
    ST.haze = Sc.mountainStrip({ L: Math.round(w * 1.1), H: Math.round(Math.min(h * 0.2, w * 0.26)), seed: 41, peaks: Math.max(3, Math.round(7 * w / 480)), hMin: 0.35, hMax: 0.95, sharp: 1.1, snow: 0, gullies: 3,
      pal: { rockDeep: I.haze, rockS: I.haze + 1, rockM: I.haze + 2, rockL: I.haze + 3, snowS: I.haze + 3, snowL: I.haze + 4, snowH: I.haze + 4, snowD: I.haze + 3 } });
    // pine tops far below, rising out of the mist (seen through the arches)
    ST.low = Sc.forestRidge({ L: Math.round(w * 1.3), H: Math.round(h * 0.2), seed: 5, amp: 6, spacing: Math.round(5 * s) + 1, hMin: Math.round(10 * s), hMax: Math.round(26 * s),
      pal: { body: I.mist + 1, bodyL: I.mist + 2, pineD: I.mist, pineM: I.mist + 1, pineL: I.mist + 2 }, fadeIdx: I.mist + 3, fadeRows: Math.round(h * 0.09) });
    CL = [];
    for (var i = 0; i < 8; i++) {
      var cw = Math.round((26 + PX.h1(i * 3 + 1) * 60) * s), ch = Math.round((7 + PX.h1(i * 5 + 2) * 7) * s) + 3;
      CL.push({ sp: cloudBank(301 + i * 13, cw, ch, [I.cloud, I.cloud + 1, I.cloud + 2, I.cloud + 3, I.cloud + 4]), x: PX.h1(i * 7 + 3) * w * 1.6, y: 0.04 + PX.h1(i * 11 + 4) * 0.34, v: 0.4 + PX.h1(i * 13 + 5) * 0.8 });
    }
  }

  R.light = function (S) {
    var hy = S.horizonY + Math.round((1 - S.openingT) * S.h * 0.12);
    return { x: Math.round(S.w * 0.57), y: Math.round(hy - S.h * 0.3), k: 0.58, col: [255, 180, 150], ambient: [66, 82, 118], bright: 0.64, ground: [50, 60, 78] };
  };

  // water flows by rotating the four water colours
  R.palette = function (pal, S) {
    var base = [[143, 169, 196], [178, 201, 220], [213, 228, 238], [242, 248, 251]], dim = [[109, 134, 162], [138, 162, 187], [168, 189, 208], [196, 212, 225]];
    var k = S.reduced ? 0 : Math.floor(S.tSec * 12) & 3, k2 = S.reduced ? 0 : Math.floor(S.tSec * 8) & 3;
    for (var i = 0; i < 4; i++) { pal.set(I.water + i, base[(i - k + 4) & 3]); pal.set(I.waterF + i, dim[(i - k2 + 4) & 3]); }
  };

  // lift the sky around the afterglow by up to two ramp steps (dithered): the bands bend around the light
  function glow(fb, cx, cy, rx, ry, lo, hi, amt) {
    var w = fb.w, h = fb.h, d = fb.d, li1 = TB.light1;
    for (var y = Math.max(0, cy - ry); y < Math.min(h, cy + ry); y++) for (var x = Math.max(0, cx - rx); x < Math.min(w, cx + rx); x++) {
      var dx = (x - cx) / rx, dy = (y - cy) / ry, q = 1 - Math.sqrt(dx * dx + dy * dy); if (q <= 0) continue;
      var o = y * w + x, v = d[o]; if (v < lo || v > hi) continue;
      var n = Math.floor(q * amt + BAY[y & 3][x & 3] + 0.5);
      while (n-- > 0 && v < hi) v = li1[v];
      d[o] = v;
    }
  }

  R.backdrop = function (fb, S, pal) {
    build(S);
    var w = fb.w, h = fb.h, sh = Math.round((1 - S.openingT) * h * 0.12), hy = S.horizonY + sh, al = S.altitude * Math.min(1, w / 480), i;
    var skyIdx = []; for (i = 0; i < 13; i++) skyIdx.push(I.sky + i);
    var skyBot = Math.round(hy - 0.2 * h);
    Sc.bands(fb, 0, skyBot, skyIdx, 3);
    // below the sky line: the glowing far end of the gorge fades through haze into mist
    Sc.bands(fb, skyBot, h, [I.sky + 12, I.haze + 4, I.haze + 3, I.mist + 5, I.mist + 4, I.mist + 3, I.mist + 3, I.mist + 2], 3);
    var L = R.light(S);
    glow(fb, L.x, L.y + Math.round(h * 0.12), Math.round(w * 0.36), Math.round(h * 0.24), I.sky, I.sky + 12, 2.6);
    for (i = 0; i < CL.length; i++) {
      var c = CL[i], span = w * 1.6 + c.sp.w, cx = ((c.x - S.tSec * c.v * (S.reduced ? 0 : 1) - al * 0.08) % span + span) % span - c.sp.w;
      fb.blit(c.sp, Math.round(cx), Math.round(c.y * (hy - h * 0.3)), 0);
    }
    Sc.blitStrip(fb, ST.haze, al * 0.012 + ST.haze.w * 0.3, Math.round(hy - 0.28 * h - ST.haze.h * 0.6));
    var gy = ST.gY0 + sh, fy = ST.fY0 + sh, my = ST.mY0 + sh, ny = ST.nY0 + sh, ly = Math.round(hy + 0.16 * h + sh - ST.low.crest);
    Sc.blitStrip(fb, ST.far2, al * 0.014 + 3, gy);
    mistBand(fb, gy + ST.far2.h, I.mist + 4, I.mist + 3, h * 0.1);
    Sc.blitStrip(fb, ST.far, al * 0.02, fy);
    mistBand(fb, fy + ST.far.h, I.mist + 3, I.mist + 2, h * 0.12);
    Sc.blitStrip(fb, ST.mid, al * 0.045, my);
    mistBand(fb, my + ST.mid.h, I.mist + 2, I.mist + 3, h * 0.1);
    Sc.blitStrip(fb, ST.low, al * 0.06 + 40, ly);
    mistBand(fb, ly + ST.low.h, I.mist + 3, I.mist + 2, h * 0.12);
    Sc.blitStrip(fb, ST.near, al * 0.08, ny);
    mistBand(fb, ny + ST.near.h, I.mist + 1, I.mist + 2, h * 0.08);
    // slow horizontal mist layers drifting over the depths
    var ph = S.reduced ? 0 : S.tSec;
    for (i = 0; i < 4; i++) streak(fb, Math.round(hy + h * (0.02 + i * 0.09) + sh), Math.round(w * (0.5 + 0.3 * PX.h1(i + 3))), ((PX.h1(i * 7) * w * 2 - ph * (2 + i) - al * 0.07 * (i + 1)) % (w * 2) + w * 2) % (w * 2) - w * 0.4, 0.45);
  };

  // mist below a layer: a dithered two-tone band that settles into a solid colour (no large flat blocks right under a ridge)
  function mistBand(fb, y0, a, b, hgt) {
    var h = fb.h; y0 = Math.max(0, Math.round(y0)); if (y0 >= h) return;
    Sc.bands(fb, y0, Math.min(h, y0 + Math.round(hgt * 2)), [a, a, b], 3);
    if (y0 + Math.round(hgt * 2) < h) fb.fillRect(0, y0 + Math.round(hgt * 2), fb.w, h, b);
  }
  // a soft horizontal streak that lifts what is under it one ramp step
  function streak(fb, y, len, x0, amt) {
    var w = fb.w, h = fb.h, d = fb.d, li1 = TB.light1;
    for (var r = 0; r < 3; r++) {
      var yy = y + r; if (yy < 0 || yy >= h) continue;
      for (var x = Math.max(0, Math.round(x0)); x < Math.min(w, Math.round(x0 + len)); x++) {
        var t = (x - x0) / len, a = Math.sin(t * Math.PI) * (r === 1 ? amt : amt * 0.45);
        if (BAY[yy & 3][x & 3] + 0.5 > a) continue;
        var o = yy * w + x; d[o] = li1[d[o]];
      }
    }
  }

  R.ground = function (fb, S, pal) {
    B.deck(fb, S, DK);
    B.props(fb, S, DK, PK);
  };

  // mist wisps drifting across the lower screen (they lift whatever is under them one step: translucent, palette-true)
  R.front = function (fb, S, pal) {
    if (S.reduced) return;
    var w = fb.w, h = fb.h, d = fb.d, li1 = TB.light1, ax = S.ztx + S.anchorX * S.zoom;
    for (var i = 0; i < 7; i++) {
      var len = Math.round(w * (0.2 + PX.h1(i * 7 + 1) * 0.3)), yy = Math.round(h * (0.62 + PX.h1(i * 5 + 2) * 0.36)), sp = 3 + PX.h1(i * 3) * 6;
      var x0 = Math.round(((PX.h1(i * 11) * w * 2 - S.tSec * sp) % (w * 2) + w * 2) % (w * 2) - len * 0.5);
      for (var r = 0; r < 3; r++) {
        var y = yy + r; if (y < 0 || y >= h) continue;
        for (var x = Math.max(0, x0); x < Math.min(w, x0 + len); x++) {
          var t = (x - x0) / len, a = Math.sin(t * Math.PI) * (r === 1 ? 0.5 : 0.25);
          if (Math.abs(x - ax) < 60) a *= 0.3;
          if (BAY[y & 3][x & 3] + 0.5 > a) continue;
          var o = y * w + x; d[o] = li1[d[o]];
        }
      }
    }
  };

  R.thumb = { ratio: 0.78, f: 4 };            // realm card: a little more gorge above the deck
  V8.register("waterfalls", R);
})(typeof window !== "undefined" ? window : this);
