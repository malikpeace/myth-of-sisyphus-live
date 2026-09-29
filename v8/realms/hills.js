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

  R.ground = function (fb, S, pal) {
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, sc = S.scroll, lipA = S.lip;
    var G = I.grass, So = I.soil, x, y;
    var grassD = Math.max(12, Math.round(70 * zoom)), soilRef = Math.max(20, 60 * zoom);
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
    // the meadow, column by column
    for (x = 0; x < w; x++) {
      var lip = lipA[x]; if (lip >= h) continue;
      var wxF = (x - S.ztx) / zoom + sc, wx = Math.floor(wxF);
      var c1 = PX.h2(wx, 11), c2 = PX.h2(wx, 23), c3 = PX.h2(wx, 37);
      var patch = PX.vnoise(wxF * 0.018, 3.3, 1.7);                        // big lighter / darker swathes of meadow
      var lvBase = 2.3 + 1.7 * c1 + 1.4 * (patch - 0.5);
      var tip = 1 + Math.floor(c2 * c2 * 5.2);
      for (var kk = 1; kk <= tip; kk++) {                                  // blade tips break the skyline
        var ty = lip - kk; if (ty < 0) continue;
        d[ty * w + x] = G + clamp(Math.floor(lvBase + 1.4 - kk * 0.55 + PX.BAYER4[ty & 3][x & 3] * 0.8), 1, 6);
      }
      var y0 = Math.max(0, lip);
      for (y = y0; y < h; y++) {
        var dd = y - lip, idx;
        if (dd < grassD) {
          var t = dd / grassD;
          var s = PX.h2(wx * 3 + 1, Math.floor((dd + c1 * 7) / 3.4));
          var lvf = lvBase + 0.9 - 3.7 * Math.pow(t, 0.95) + (s - 0.5) * 1.7 + PX.BAYER4[y & 3][x & 3] * 0.9;
          idx = G + clamp(Math.floor(lvf), 0, 6);
          if (s > 0.955 && t < 0.72) idx = G + 6;
          else if (s < 0.05 && t > 0.15) idx = G + 1;
        } else {
          var sd = dd - grassD, st = sd / soilRef;
          var strata = 0.55 * Math.sin(dd * 0.31 + c3 * 6) + (PX.h2(wx >> 1, dd >> 1) - 0.5) * 0.9;
          var sl = 4.3 - st * 1.5 + strata + PX.BAYER4[y & 3][x & 3] * 0.8;
          idx = So + clamp(Math.floor(sl), 0, 5);
          var pb = PX.h2(wx >> 3, (dd >> 3) + 50);                             // pebbles
          if (pb > 0.88) { var px = wx & 7, py = dd & 7; if (px >= 2 && px <= 5 && py >= 3 && py <= 5) idx = I.stone + (py === 3 ? 3 : (px < 4 ? 2 : 1)); }
        }
        d[y * w + x] = idx;
      }
    }
    // flowers: world-locked cells, painted after the grass so they sit on top of it
    var cw = 34, ch = 30, wl2 = (0 - S.ztx) / zoom + sc - cw, wr2 = (w - S.ztx) / zoom + sc + cw;
    for (var fc = Math.floor(wl2 / cw); fc <= Math.ceil(wr2 / cw); fc++) {
      for (var fr = 0; fr < 3; fr++) {
        var fh = PX.h2(fc, fr + 90); if (fh < 0.55) continue;
        var fwx = fc * cw + PX.h2(fc, fr + 95) * cw, fdu = 7 + fr * 19 + PX.h2(fc, fr + 99) * 9;
        var fsx = Math.round(S.ztx + (fwx - sc) * zoom); if (fsx < 1 || fsx > w - 2) continue;
        var fsy = Math.round(lipA[fsx] + fdu * zoom); if (fsy < 1 || fsy > h - 2) continue;
        flowerAt(fb, fsx, fsy, Math.floor(fh * 8) % 4);
      }
    }
  };

  // foreground: giant crisp pines sweeping past in front of him, then light wind streaks
  R.front = function (fb, S, pal) {
    var w = fb.w, h = fb.h, sc = S.scroll, zoom = S.zoom, cell = 780;
    var fgZ = 1.7, wl = (0 - S.ztx) / (zoom * fgZ) + sc * 0 , k0 = Math.floor((sc * fgZ - w * 1.2) / cell) - 1, k1 = Math.ceil((sc * fgZ + w * 2.2) / cell) + 1;
    if (S.altitude > 60) for (var k = k0; k <= k1; k++) {
      var hh = PX.h1(k * 9 + 4); if (hh < 0.45) continue;
      var sx = Math.round(k * cell + PX.h1(k * 3 + 2) * 300 - sc * fgZ * zoom * 0.62 + w * 0.2);
      // (positions scroll faster than the ground so they read as being close to the camera)
      if (sx < -80 || sx > w + 80) continue;
      var th = Math.round(h * (1.05 + 0.5 * PX.h1(k * 5 + 1)));
      Sc.pine(fb, sx, h + 6, th, k * 17 + 3, { dark: I.pine, mid: I.pine + 1, light: I.pine + 2, trunk: I.trunk }, { slim: 0.36, light: -1 });
    }
  };

  V8.register("hills", R);
})(typeof window !== "undefined" ? window : this);
