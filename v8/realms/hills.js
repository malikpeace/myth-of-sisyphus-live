// The Hills - V8 scene. Alpine meadow under a snow range. Everything here is generated in code onto the shared
// indexed framebuffer: banded dithered sky, a stepped sun, pixel clouds, three mountain ranges (facets, gullies,
// snow), distant pine bands melting into mist, then the meadow itself painted blade by blade over layered soil.
(function (root) {
  "use strict";
  var PX = root.PX, Sc = root.Sc, V8 = root.V8, hex = PX.hex, clamp = PX.clamp, clamp01 = PX.clamp01;
  var R = { rock: { mat: "granite", style: "granite" } }, I = {}, ST = {}, CL = [], built = "";

  function H(list) { return list.map(hex); }

  R.init = function (pal, S) {
    // ---- palette: ramps run dark -> light ----
    I.sky = pal.ramp("sky", H(["#2b66ac", "#316fb5", "#3879bd", "#4084c5", "#4a90cd", "#569dd5", "#64aadb", "#75b8e2", "#88c5e8", "#9bd1ec", "#aedcf0"]));
    I.sun = pal.ramp("sun", H(["#efdca8", "#f7bd49", "#f9d66c", "#fff1b1", "#fff8d9"]));
    I.cloud = pal.ramp("cloud", H(["#98afc6", "#b7cbdb", "#d9e7f0", "#f6fafd"]));
    I.far = pal.ramp("far", H(["#6f92b6", "#84a5c6", "#98b7d3", "#adc7de", "#bfd3e5", "#dbe8f3", "#f4f9fd"]));
    I.mid = pal.ramp("mid", H(["#2c476d", "#39577f", "#4a6b96", "#6086ae", "#a2bcd6", "#e2edf6", "#ffffff"]));
    I.near = pal.ramp("near", H(["#122239", "#1a2f4d", "#243f62", "#33557d", "#8aabc6"]));
    I.mist = pal.ramp("mist", H(["#3f6f77", "#4d7f86", "#5e9297", "#72a5a8", "#88b8b8", "#a2c9c6"]));
    I.forestFar = pal.ramp("forestFar", H(["#4a7d84", "#5a9096", "#6ea3a7"]));
    I.forestMid = pal.ramp("forestMid", H(["#2f5d5a", "#3a6f68", "#4a8377"]));
    I.pine = pal.ramp("pine", H(["#0d1f15", "#14301f", "#1e4428", "#2b5a34", "#3b7442"]));
    I.trunk = pal.ramp("trunk", H(["#3a241a", "#583824"]));
    I.grass = pal.ramp("grass", H(["#172d18", "#25451d", "#366323", "#4f8428", "#70a72e", "#9ac23b", "#c0d85a"]));
    I.soil = pal.ramp("soil", H(["#120c0a", "#1d1210", "#2c1a15", "#43291f", "#5d3a29", "#7c5238"]));
    I.stone = pal.ramp("stone", H(["#161a1c", "#252b2d", "#383f41", "#51585a", "#707676", "#929695"]));
    I.flower = pal.ramp("flower", H(["#f2eee0", "#e7a6bd", "#c95e89", "#e8554f", "#f1c84b"]));
    I.clay = pal.ramp("clay", H(["#22110d", "#361a14", "#4e2a1e", "#6b3b27", "#8a4f31", "#a86a40"]));
    I.rockbed = pal.ramp("rockbed", H(["#1a1615", "#2a2422", "#3b332f", "#50463f", "#685b50", "#82725f"]));
    I.deep = pal.ramp("deep", H(["#070506", "#0d090b", "#150d12", "#1f1218", "#2b1820"]));
    I.ember = pal.ramp("ember", H(["#5a1c10", "#9b3413", "#e0631a", "#ffb03a"]));
    I.bone = pal.ramp("bone", H(["#6b5f4e", "#a89a80", "#d8ccb0", "#f2ead2"]));
    I.terra = pal.ramp("terra", H(["#5a2a1c", "#8c4a2c", "#b8683a", "#dc9256"]));
    I.metal = pal.ramp("metal", H(["#1c1f22", "#34393d", "#545b60", "#7b848a"]));
    I.bush = pal.ramp("bush", H(["#10261a", "#1a3a22", "#25522c", "#357038", "#4c8f44", "#6cae4f"]));
    I.ink = pal.ramp("ink", H(["#080b0d"]));
    R.pal = pal;
    built = "";
    buildScene(S);
  };

  function mtnPal(base, snowD) { return { rockDeep: base, rockS: base + 1, rockM: base + 2, rockL: base + 3, snowS: base + 4, snowL: base + 5, snowH: base + 6, snowD: snowD == null ? base + 4 : snowD }; }

  function buildScene(S) {
    var k = S.w + "x" + S.h; if (built === k) return; built = k;
    var Hm = clamp(Math.round(S.h * 0.40), 100, 170);
    ST.far = Sc.mountainStrip({ L: 1280, H: Math.round(Hm * 0.78), seed: 11, peaks: 20, hMin: 0.45, hMax: 0.9, sharp: 1.22, snow: 0.55, gullies: 4, pal: mtnPal(I.far) });
    ST.mid = Sc.mountainStrip({ L: 1152, H: Hm, seed: 23, peaks: 14, hMin: 0.5, hMax: 1.0, sharp: 1.14, snow: 0.5, gullies: 6, pal: mtnPal(I.mid, I.mid + 3) });
    ST.near = Sc.mountainStrip({ L: 1024, H: Math.round(Hm * 0.5), seed: 37, peaks: 10, hMin: 0.35, hMax: 0.8, sharp: 1.32, snow: 0.06, gullies: 3, pal: { rockDeep: I.near, rockS: I.near + 1, rockM: I.near + 2, rockL: I.near + 3, snowS: I.near + 3, snowL: I.near + 4, snowH: I.near + 4, snowD: I.near + 2 } });
    ST.fFar = Sc.forestRidge({ L: 1000, H: 70, seed: 5, amp: 6, spacing: 3, hMin: 7, hMax: 15, pal: { body: I.forestFar, bodyL: I.forestFar + 1, pineD: I.forestFar, pineM: I.forestFar + 1, pineL: I.forestFar + 2 }, fadeIdx: I.mist + 3, fadeRows: 16 });
    ST.fMid = Sc.forestRidge({ L: 900, H: 74, seed: 9, amp: 8, spacing: 4, hMin: 10, hMax: 22, pal: { body: I.forestMid, bodyL: I.forestMid + 1, pineD: I.forestMid, pineM: I.forestMid + 1, pineL: I.forestMid + 2 }, fadeIdx: I.mist + 2, fadeRows: 14 });
    CL = [];
    for (var i = 0; i < 10; i++) {
      var w = 30 + Math.round(PX.h1(i * 3 + 1) * 56), h = 10 + Math.round(PX.h1(i * 5 + 2) * 10);
      CL.push({ sp: Sc.cloudSprite(101 + i * 17, w, h, [I.cloud + 3, I.cloud + 2, I.cloud + 1, I.cloud]), x: PX.h1(i * 7 + 3) * 900, y: 0.10 + PX.h1(i * 11 + 4) * 0.34, v: 0.9 + PX.h1(i * 13 + 5) * 1.6 });
    }
  }

  // light the actor / rock should use (screen-plane direction TOWARD the sun)
  R.light = function (S) {
    var sx = Math.round(S.w * 0.41), sy = Math.round(S.h * 0.15);
    return { x: sx, y: sy, k: 0.86, col: [255, 236, 190], ambient: [96, 150, 200], bright: 0.95, ground: [70, 110, 44] };
  };

  R.backdrop = function (fb, S, pal) {
    buildScene(S);
    var w = fb.w, h = fb.h, hy = S.horizonY + Math.round((1 - S.openingT) * S.h * 0.12), al = S.altitude;
    // sky: banded, dithered
    var skyIdx = []; for (var i = 0; i < 11; i++) skyIdx.push(I.sky + i);
    Sc.bands(fb, 0, hy + 30, skyIdx, 4);
    if (hy + 30 < h) fb.fillRect(0, hy + 30, w, h - hy - 30, I.mist + 3);
    // sun + clouds
    var L = R.light(S);
    Sc.sun(fb, L.x, L.y + Math.round((1 - S.openingT) * S.h * 0.04), Math.round(clamp(S.h * 0.045, 11, 16)), { core: I.sun + 4, disc: I.sun + 3, rim: I.sun + 2, glow1: I.sun + 1, glow2: I.sun }, 3);
    for (i = 0; i < CL.length; i++) {
      var c = CL[i], span = w + c.sp.w + 40, cx = ((c.x - S.tSec * c.v * (S.reduced ? 0 : 1) - al * 0.16) % span + span) % span - c.sp.w;
      fb.blit(c.sp, Math.round(cx), Math.round(c.y * hy * 0.95), 0);
    }
    // mountains (three ranges, each scrolling a little faster: parallax)
    Sc.blitStrip(fb, ST.far, al * 0.05, hy - ST.far.h + 4);
    Sc.blitStrip(fb, ST.mid, al * 0.11 + 240, hy - ST.mid.h + 10);
    Sc.blitStrip(fb, ST.near, al * 0.2 + 500, hy - ST.near.h + 16);
    // forested ridges and mist, back to front, down to the ground (each ridge is placed by its crest row)
    var y1 = hy - 10 - ST.fFar.crest, y2 = hy + 2 - ST.fMid.crest;
    Sc.blitStrip(fb, ST.fFar, al * 0.30, y1);
    fb.fillRect(0, y1 + ST.fFar.h, w, Math.max(0, h - y1 - ST.fFar.h), I.mist + 3);
    Sc.blitStrip(fb, ST.fMid, al * 0.55 + 90, y2);
    fb.fillRect(0, y2 + ST.fMid.h, w, Math.max(0, h - y2 - ST.fMid.h), I.mist + 1);
  };

  // ---------- ground ----------
  function flowerAt(fb, x, y, kind, lvl) {
    var p = I.flower;
    if (kind === 0) { fb.set(x, y, p + 4); fb.set(x - 1, y, p + 1); fb.set(x + 1, y, p + 1); fb.set(x, y - 1, p + 1); fb.set(x, y + 1, p + 1); }
    else if (kind === 1) { fb.set(x, y, p + 4); fb.set(x - 1, y, p); fb.set(x + 1, y, p); fb.set(x, y - 1, p); fb.set(x, y + 1, p); }
    else if (kind === 2) { fb.set(x, y, p + 4); fb.set(x - 1, y, p + 2); fb.set(x + 1, y, p + 2); fb.set(x, y - 1, p + 2); }
    else { fb.set(x, y, p + 3); fb.set(x, y - 1, p + 3); fb.set(x + 1, y, p + 4); }
  }

  // ---- tiny pixel bitmaps for buried relics ('.' empty; digits = tone 0..3 of the named ramp) ----
  var RELICS = [
    { ramp: "bone", rows: ["..1223..", ".12333..", "..2331..", "...231..", "...221..", "..1231..", ".12333..", "..1221.."] },                       // a long bone standing in the soil
    { ramp: "bone", rows: [".122221.", "12333321", "13303031", "13303031", "12333321", ".123321.", "..1221.."] },                                 // a skull
    { ramp: "terra", rows: ["..1221..", ".123321.", ".13..31.", ".123321.", "..1231..", "...11..."] },                                              // amphora shard
    { ramp: "metal", rows: ["1221....", "2..21...", "2..2.21.", "1221.2.2", "...1.2.2", "....1221"] },                                              // chain links
    { ramp: "ember", rows: ["..23..", ".2333.", "23333.", ".2332.", "..22.."] }                                                                      // a coin / ember glint
  ];
  function drawRelic(fb, r, x, y, flip) {
    var ramp = I[r.ramp];
    for (var yy = 0; yy < r.rows.length; yy++) for (var xx = 0; xx < r.rows[yy].length; xx++) {
      var ch = r.rows[yy].charAt(flip ? r.rows[yy].length - 1 - xx : xx); if (ch === ".") continue;
      fb.set(x + xx, y + yy, ramp + parseInt(ch, 10));
    }
  }

  R.ground = function (fb, S, pal) {
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, sc = S.scroll, lipA = S.lip, adj = S.adj || 1;
    var G = I.grass, x, y;
    var grassDu = 70, topDu = 118, clayDu = 196, rockDu = 282;               // depth (world units) where each layer starts
    var grassD = Math.max(12, Math.round(grassDu * zoom));
    var lean = S.reduced ? 0 : (S.windGust || 0) * 3.2;
    var heroX = Math.round(S.ztx + S.anchorX * zoom);
    // slope-edge pines: small firs standing on the ridge line further up the mountain (they appear as the climb steepens)
    var pineDensity = clamp01((S.altitude - 30) / 260);
    if (pineDensity > 0.02) {
      var cell = 150, wl = (0 - S.ztx) / zoom + sc, wr = (w - S.ztx) / zoom + sc;
      for (var pc = Math.floor(wl / cell) - 1; pc <= Math.ceil(wr / cell) + 1; pc++) {
        var hh = PX.h1(pc * 3 + 7); if (hh > pineDensity * 0.85) continue;
        var pwx = pc * cell + PX.h1(pc * 5 + 1) * cell * 0.8, psx = Math.round(S.ztx + (pwx - sc) * zoom);
        if (psx < -20 || psx > w + 20) continue;
        var pl = lipA[clamp(psx, 0, w - 1)], ph = Math.round((34 + PX.h1(pc * 7 + 3) * 52) * zoom * 1.25);
        Sc.pine(fb, psx, pl + 2, ph, pc * 31 + 5, { dark: I.pine, mid: I.pine + 2, light: I.pine + 3, trunk: I.trunk + 1 }, { slim: 0.30, light: -1 });
      }
    }
    // the ground, column by column
    for (x = 0; x < w; x++) {
      var lip = lipA[x]; if (lip >= h) continue;
      var wxF = (x - S.ztx) / zoom + sc, wx = Math.floor(wxF);
      var c1 = PX.h2(wx, 11), c2 = PX.h2(wx, 23), c3 = PX.h2(wx, 37);
      var patch = PX.vnoise(wxF * 0.018, 3.3, 1.7);                        // big lighter / darker swathes of meadow
      var lvBase = 2.3 + 1.7 * c1 + 1.4 * (patch - 0.5);
      var sway = S.reduced ? 0 : (lean + 0.55 * Math.sin(S.tSec * 2.1 + wxF * 0.03)) ;
      var tip = 1 + Math.floor(c2 * c2 * 5.2);
      for (var kk = 1; kk <= tip; kk++) {                                  // blade tips break the skyline (and lean with the wind)
        var ty = lip - kk, tx = x + Math.round(sway * (kk / 6)); if (ty < 0 || tx < 0 || tx >= w) continue;
        d[ty * w + tx] = G + clamp(Math.floor(lvBase + 1.4 - kk * 0.55 + PX.BAYER4[ty & 3][tx & 3] * 0.8), 1, 6);
      }
      // per-column layer boundaries wobble so strata are wavy, never ruler-straight
      var b1 = topDu + 9 * Math.sin(wxF * 0.021 + 1.3) + 5 * Math.sin(wxF * 0.057), b2 = clayDu + 12 * Math.sin(wxF * 0.017 + 4.1) + 6 * Math.sin(wxF * 0.049 + 2), b3 = rockDu + 14 * Math.sin(wxF * 0.013 + 0.4) + 7 * Math.sin(wxF * 0.041);
      var y0 = Math.max(0, lip);
      for (y = y0; y < h; y++) {
        var dd = y - lip, du = dd / zoom, idx, bay = PX.BAYER4[y & 3][x & 3];
        if (du < grassDu) {
          var t = dd / grassD;
          var wxs = wx + Math.round(sway * (1 - t) * 1.6);                   // blades lean: the streak drifts sideways toward the tip
          var s = PX.h2(wxs * 3 + 1, Math.floor((dd + c1 * 7) / 3.4));
          var lvf = lvBase + 0.9 - 3.7 * Math.pow(t, 0.95) + (s - 0.5) * 1.7 + bay * 0.9;
          idx = G + clamp(Math.floor(lvf), 0, 6);
          if (s > 0.955 && t < 0.72) idx = G + 6; else if (s < 0.05 && t > 0.15) idx = G + 1;
        } else if (du < b1) {                                                // loam: dark, crumbly, rooty
          var sl = 3.5 - (du - grassDu) / 46 + (PX.h2(wx >> 1, dd >> 1) - 0.5) * 1.5 + bay * 0.8;
          idx = I.soil + clamp(Math.floor(sl), 0, 5);
          if (PX.h2(wx, dd + 900) > 0.985) idx = I.soil;                     // specks
        } else if (du < b2) {                                                // clay: warmer, banded
          var band = 0.9 * Math.sin(du * 0.36 + PX.vnoise(wxF * 0.04, du * 0.05, 3) * 5) + (PX.h2(wx >> 1, (dd >> 1) + 70) - 0.5) * 1.1;
          idx = I.clay + clamp(Math.floor(3.0 + band + bay * 0.8 - (du - b1) / 90), 0, 5);
        } else if (du < b3) {                                                // bedrock: masonry-like blocks with 1-px joints
          var rowH = 15, bi = Math.floor((du - b2) / rowH), off = (bi & 1) ? 13 : 0, bw = 28;
          var cx = Math.floor((wxF + off) / bw), fx = (wxF + off) - cx * bw, fy = (du - b2) - bi * rowH;
          var bt = PX.h2(cx * 7 + bi, 31);
          var joint = fx < 1.2 / zoom || fy < 1.1 / zoom;
          var lvr = 2.3 + bt * 2.0 + bay * 0.7 - (fy > rowH * 0.7 ? 0.6 : 0) + (fx < 4 && fy > 3 ? 0.4 : 0);
          idx = joint ? I.rockbed + 0 : I.rockbed + clamp(Math.floor(lvr), 1, 5);
          if (!joint && PX.h2(wx, dd + 300) > 0.985) idx = I.rockbed + 5;
        } else {                                                             // the deep: near-black, violet glints, a few embers
          var ex = (du - b3);
          var lvd = 2.6 - ex / 130 + (PX.h2(wx >> 1, dd >> 1) - 0.5) * 1.1 + bay * 0.7;
          idx = I.deep + clamp(Math.floor(lvd), 0, 4);
          var eh = PX.h2(wx, dd + 500);
          if (eh > 0.9975) idx = I.ember + (eh > 0.9992 ? 3 : 2); else if (eh > 0.995) idx = I.ember;
        }
        d[y * w + x] = idx;
      }
    }
    // embedded stones (loam .. bedrock): shaded blobs, lit from the upper left
    var scw = 24, sch = 20, wl3 = (0 - S.ztx) / zoom + sc - scw, wr3 = (w - S.ztx) / zoom + sc + scw, rowMax = Math.ceil(((h - 0) / zoom) / sch) + 2;
    for (var sc0 = Math.floor(wl3 / scw); sc0 <= Math.ceil(wr3 / scw); sc0++) {
      for (var sr = 4; sr < 4 + rowMax; sr++) {
        var sh = PX.h2(sc0 * 3 + 1, sr * 5 + 2); if (sh < 0.83) continue;
        var swx = sc0 * scw + PX.h2(sc0, sr + 41) * scw, sdu = sr * sch + PX.h2(sc0, sr + 43) * sch;
        var ssx = Math.round(S.ztx + (swx - sc) * zoom); if (ssx < -8 || ssx > w + 8) continue;
        var ssy = Math.round(lipA[clamp(ssx, 0, w - 1)] + sdu * zoom); if (ssy < 4 || ssy > h + 4) continue;
        var rr = Math.max(1.6, (3 + 3.5 * PX.h2(sc0, sr + 47)) * zoom * 1.2), sd = swx < 0 ? 0 : 0;
        var base = sdu > (rockDu - 30) ? I.rockbed : I.stone;
        for (var by = -Math.ceil(rr); by <= Math.ceil(rr); by++) for (var bx = -Math.ceil(rr * 1.3); bx <= Math.ceil(rr * 1.3); bx++) {
          var ex2 = bx / 1.3, dist2 = ex2 * ex2 + by * by; if (dist2 > rr * rr) continue;
          var lit = (-(ex2 * 0.7 + by * 0.7)) / rr;                          // >0 toward the upper left
          var tone = lit > 0.45 ? 4 : lit > 0.05 ? 3 : lit > -0.4 ? 2 : 1;
          if (dist2 > (rr - 1) * (rr - 1) && lit < 0.2) tone = 0;             // dark rim on the shaded side
          fb.set(ssx + bx, ssy + by, base + Math.min(5, tone));
        }
      }
    }
    // roots: dark branching lines hanging from the turf into the loam
    var rcell = 46, wl4 = (0 - S.ztx) / zoom + sc - rcell, wr4 = (w - S.ztx) / zoom + sc + rcell;
    for (var rc = Math.floor(wl4 / rcell); rc <= Math.ceil(wr4 / rcell); rc++) {
      if (PX.h2(rc, 61) < 0.45) continue;
      var rwx = rc * rcell + PX.h2(rc, 62) * rcell, rsx = Math.round(S.ztx + (rwx - sc) * zoom); if (rsx < -20 || rsx > w + 20) continue;
      var cxp = rsx, cyp = lipA[clamp(rsx, 0, w - 1)] + Math.round(grassDu * zoom * 0.92), len = Math.round((22 + 34 * PX.h2(rc, 63)) * zoom * 1.3), dir = PX.h2(rc, 64) < 0.5 ? -1 : 1;
      for (var st = 0; st < len; st++) {
        cyp += 1; if (PX.h2(rc * 31 + st, 65) < 0.42) cxp += dir; else if (PX.h2(rc * 17 + st, 66) < 0.16) cxp -= dir;
        fb.set(cxp, cyp, I.soil + (st & 3 ? 1 : 0)); if (st < len * 0.4) fb.set(cxp + 1, cyp, I.soil);
        if (st > 5 && st % 9 === 0 && PX.h2(rc * 13 + st, 67) < 0.7) { var bxp = cxp, byp = cyp; for (var bs = 0; bs < 6; bs++) { byp += (bs & 1); bxp += dir * 1; fb.set(bxp, byp, I.soil + 1); } }
      }
    }
    // buried relics: bones, skulls, amphora shards, chain links and coins, deep in the clay and bedrock
    var rlc = 150, wl5 = (0 - S.ztx) / zoom + sc - rlc, wr5 = (w - S.ztx) / zoom + sc + rlc;
    for (var lc = Math.floor(wl5 / rlc); lc <= Math.ceil(wr5 / rlc); lc++) {
      for (var lr = 0; lr < 3; lr++) {
        var lh = PX.h2(lc * 5 + lr, 81); if (lh < 0.60) continue;
        var lwx = lc * rlc + PX.h2(lc, lr + 82) * rlc, ldu = 150 + lr * 110 + PX.h2(lc, lr + 83) * 80;
        var lsx = Math.round(S.ztx + (lwx - sc) * zoom); if (lsx < -14 || lsx > w + 14) continue;
        var lsy = Math.round(lipA[clamp(lsx, 0, w - 1)] + ldu * zoom); if (lsy < 2 || lsy > h - 2) continue;
        drawRelic(fb, RELICS[Math.floor(PX.h2(lc, lr + 84) * RELICS.length) % RELICS.length], lsx, lsy, PX.h2(lc, lr + 85) > 0.5);
      }
    }
    // flowers with stems, tufts and bushes on the meadow (world-locked; kept clear of the hero)
    var cw = 34, wl2 = (0 - S.ztx) / zoom + sc - cw, wr2 = (w - S.ztx) / zoom + sc + cw;
    for (var fc = Math.floor(wl2 / cw); fc <= Math.ceil(wr2 / cw); fc++) {
      for (var fr = 0; fr < 3; fr++) {
        var fh = PX.h2(fc, fr + 90); if (fh < 0.55) continue;
        var fwx = fc * cw + PX.h2(fc, fr + 95) * cw, fdu = 7 + fr * 19 + PX.h2(fc, fr + 99) * 9;
        var fsx = Math.round(S.ztx + (fwx - sc) * zoom); if (fsx < 1 || fsx > w - 2) continue;
        var fsy = Math.round(lipA[fsx] + fdu * zoom); if (fsy < 1 || fsy > h - 2) continue;
        var lx = Math.round(sway * 0.25);
        fb.set(fsx, fsy + 1, G + 2); fb.set(fsx + lx, fsy + 2, G + 3);       // stem
        flowerAt(fb, fsx + lx, fsy, Math.floor(fh * 8) % 4);
      }
    }
    var bcell = 120, wl6 = (0 - S.ztx) / zoom + sc - bcell, wr6 = (w - S.ztx) / zoom + sc + bcell;
    for (var bc = Math.floor(wl6 / bcell); bc <= Math.ceil(wr6 / bcell); bc++) {
      var bh = PX.h2(bc, 111); if (bh < 0.52) continue;
      var bwx = bc * bcell + PX.h2(bc, 112) * bcell * 0.85, bsx = Math.round(S.ztx + (bwx - sc) * zoom); if (bsx < -20 || bsx > w + 20) continue;
      if (Math.abs(bsx - heroX) < 46 * zoom + 24) continue;                 // keep the hero's surroundings calm
      var bsy = lipA[clamp(bsx, 0, w - 1)] + Math.round(4 * zoom), kind = Math.floor(PX.h2(bc, 113) * 3);
      if (kind === 0) {                                                     // a bush: three dithered leaf tones, a few berries
        var brr = Math.max(4, Math.round((9 + 7 * PX.h2(bc, 114)) * zoom * 1.3));
        for (var yy = -brr; yy <= 2; yy++) for (var xx = -Math.round(brr * 1.5); xx <= Math.round(brr * 1.5); xx++) {
          var ex3 = xx / 1.5, d3 = ex3 * ex3 + yy * yy; if (d3 > brr * brr || yy > 1) continue;
          var lit2 = (-(ex3 * 0.5 + yy * 0.85)) / brr, bt2 = lit2 + (PX.BAYER4[(bsy + yy) & 3][(bsx + xx) & 3]) * 0.5;
          fb.set(bsx + xx + Math.round(sway * 0.3 * (-yy / brr)), bsy + yy, I.bush + (bt2 > 0.55 ? 5 : bt2 > 0.2 ? 4 : bt2 > -0.2 ? 3 : bt2 > -0.55 ? 2 : 1));
        }
        if (PX.h2(bc, 115) > 0.5) { fb.set(bsx - 1, bsy - brr + 2, I.flower + 3); fb.set(bsx + 2, bsy - Math.round(brr * 0.5), I.flower + 3); fb.set(bsx - 3, bsy - Math.round(brr * 0.4), I.flower + 2); }
      } else if (kind === 1) {                                              // a small boulder, lit like the big one
        var rr2 = Math.max(3, Math.round((6 + 5 * PX.h2(bc, 116)) * zoom * 1.3));
        for (var y2 = -rr2; y2 <= 1; y2++) for (var x2 = -Math.round(rr2 * 1.4); x2 <= Math.round(rr2 * 1.4); x2++) {
          var e4 = x2 / 1.4, d4 = e4 * e4 + y2 * y2 * 1.15; if (d4 > rr2 * rr2 || y2 > 1) continue;
          var lit3 = (-(e4 * 0.7 + y2 * 0.7)) / rr2, tn = lit3 > 0.5 ? 4 : lit3 > 0.1 ? 3 : lit3 > -0.35 ? 2 : 1;
          if (d4 > (rr2 - 1) * (rr2 - 1) && lit3 < 0.3) tn = 0;
          fb.set(bsx + x2, bsy + y2, I.stone + tn);
        }
      } else {                                                              // a fern: fanned fronds
        var fl = Math.max(4, Math.round((8 + 6 * PX.h2(bc, 117)) * zoom * 1.3));
        for (var fa = -3; fa <= 3; fa++) { var ang = fa * 0.32; for (var ft = 1; ft <= fl; ft++) { var fx2 = Math.round(Math.sin(ang) * ft * 0.9 + sway * 0.2 * (ft / fl)), fy2 = -Math.round(Math.cos(ang) * ft * 0.85 + Math.sin(ft * 0.25 + fa) * 0.4); fb.set(bsx + fx2, bsy + fy2, I.bush + (ft > fl * 0.6 ? 5 : ft > fl * 0.3 ? 4 : 3)); } }
      }
    }
    // butterflies drifting over the meadow (a couple of pixels, three wing frames)
    if (!S.reduced && S.altitude < 900) for (var bf = 0; bf < 3; bf++) {
      var bx0 = ((PX.h1(bf * 9 + 2) * w * 1.4 + S.tSec * (6 + bf * 3) - sc * zoom * 0.0) % (w + 40)) - 20, by0 = lipA[clamp(Math.round(bx0), 0, w - 1)] - 10 - 12 * PX.h1(bf * 5 + 1) + Math.sin(S.tSec * 2 + bf * 2) * 5;
      var wf = Math.floor(S.tSec * 8 + bf) % 3, col = bf === 0 ? I.flower + 4 : (bf === 1 ? I.flower + 1 : I.flower);
      var bxr = Math.round(bx0), byr = Math.round(by0);
      fb.set(bxr, byr, I.ink);
      if (wf === 0) { fb.set(bxr - 1, byr - 1, col); fb.set(bxr + 1, byr - 1, col); } else if (wf === 1) { fb.set(bxr - 1, byr, col); fb.set(bxr + 1, byr, col); } else { fb.set(bxr - 1, byr + 1, col); fb.set(bxr + 1, byr + 1, col); }
    }
  };

  // foreground: giant crisp pines sweeping past in front of him (dithered see-through where they'd hide him), and drifting pollen
  R.front = function (fb, S, pal) {
    var w = fb.w, h = fb.h, zoom = S.zoom, fs = S.scroll * 1.45, cell = 1150;
    if (S.altitude > 110) {
      var heroX = Math.round(S.ztx + S.anchorX * zoom), heroY = S.lip[Math.max(0, Math.min(w - 1, heroX))];
      var k0 = Math.floor(((0 - S.ztx) / zoom + fs) / cell) - 1, k1 = Math.ceil(((w - S.ztx) / zoom + fs) / cell) + 1;
      for (var k = k0; k <= k1; k++) {
        if (PX.h1(k * 9 + 4) < 0.5) continue;
        var fx = k * cell + PX.h1(k * 3 + 2) * 500, sx = Math.round(S.ztx + (fx - fs) * zoom);
        if (sx < -100 || sx > w + 100) continue;
        var th = Math.round(h * (0.95 + 0.5 * PX.h1(k * 5 + 1)));
        Sc.pine(fb, sx, h + 8, th, k * 17 + 3, { dark: I.pine, mid: I.pine + 1, light: I.pine + 2, trunk: I.trunk }, { slim: 0.30, light: -1, hole: { x0: heroX - 40, x1: heroX + 60, y0: heroY - 80, y1: heroY + 30 } });
      }
    }
    if (!S.reduced) for (var m = 0; m < 14; m++) {                            // pollen / dust motes catching the light
      var mx = ((PX.h1(m * 7 + 1) * (w + 60) - S.tSec * (3 + PX.h1(m) * 4) - S.scroll * zoom * 0.05) % (w + 60) + (w + 60)) % (w + 60) - 30;
      var my = (PX.h1(m * 11 + 3) * 0.6 + 0.06) * h + Math.sin(S.tSec * (0.7 + PX.h1(m * 3) * 0.6) + m * 2.1) * 5;
      var tw = Math.floor(S.tSec * 2 + m) & 1;
      fb.set(Math.round(mx), Math.round(my), I.sun + 2); if (tw) fb.set(Math.round(mx) + 1, Math.round(my), I.sun + 1);
    }
  };

  V8.register("hills", R);
})(typeof window !== "undefined" ? window : this);
