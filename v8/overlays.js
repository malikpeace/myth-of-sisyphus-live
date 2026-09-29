// V8 overlays: the small living and ceremonial things every realm shares, drawn into the indexed framebuffer with
// palette indices only - bird flocks, mythic events (eagle / thunder / wind / watcher), the trail of footprints, and
// the signposts (the 1000 m quote, the Daily target). Realms may set R.birdIdx / R.markerIdx to tint them.
(function (root) {
  "use strict";
  var PX = root.PX, V8 = root.V8, clamp01 = PX.clamp01, MK = { p0: 247, p1: 248, f0: 249, f1: 250, paper: 253, ink: 254 };

  function dith(x, y, a) { return a >= 1 || PX.BAYER4[y & 3][x & 3] + 0.5 < a; }

  // ---- a chunky flapping bird: body + two wing blocks either side, wing height animates ----
  function bird(fb, x, y, s, wing, c) {
    s = Math.max(1, Math.round(s)); x = Math.round(x); y = Math.round(y);
    fb.fillRect(x - s, y, 2 * s, s, c);
    fb.fillRect(x - 3 * s, y - wing * s, 2 * s, s, c);
    fb.fillRect(x - 5 * s, y - (wing + 1) * s, 2 * s, s, c);
    fb.fillRect(x + s, y - wing * s, 2 * s, s, c);
    fb.fillRect(x + 3 * s, y - (wing + 1) * s, 2 * s, s, c);
  }
  // the eagle: broad soaring wings in a gull-wing bend, splayed feather fingers at the tips, a fanned tail and a hooked head
  // (flying left). flap in -1..1: +1 wings up, -1 wings down, 0 gliding.
  function eagle(fb, x, y, flap, c) {
    var i, side, py, px;
    for (side = -1; side <= 1; side += 2) for (i = 1; i <= 13; i++) {
      var glide = i <= 5 ? -0.18 * i : -0.9 + 0.34 * (i - 5), up = -0.62 * i + (i > 9 ? 0.25 * (i - 9) : 0), down = 0.42 * i;
      var wy = Math.round(flap >= 0 ? glide + (up - glide) * flap : glide + (down - glide) * -flap);
      px = x + side * i; py = y + wy;
      var thick = i < 4 ? 3 : i < 9 ? 2 : 1;
      for (var t = 0; t < thick; t++) fb.set(px, py + t, c);
      if (i >= 9 && (i & 1)) { fb.set(px, py + 1, c); fb.set(px + side, py + 2, c); }                  // feather fingers fan out at the tip
    }
    var body = [[-3, 0], [-2, -1], [-2, 0], [-1, -1], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [4, 2], [3, 3], [4, 3], [5, 3], [-4, 1]];
    for (i = 0; i < body.length; i++) fb.set(x + body[i][0], y + body[i][1], c);
  }

  V8.birds = function (fb, S, R) {
    if (S.reduced || R.noBirds) return;
    var period = 22, pass = 9, flock = Math.floor(S.tSec / period), local = S.tSec - flock * period;
    if (local > pass || PX.h1(flock * 19.7 + 3) < 0.38) return;
    var col = R.birdIdx == null ? 0 : R.birdIdx, count = 2 + Math.floor(PX.h1(flock * 5.2 + 1) * 3), w = fb.w, hz = S.horizonY || fb.h * 0.5;
    var baseY = 26 + PX.h1(flock * 9.4 + 2) * Math.max(24, hz * 0.42), speed = 30 + PX.h1(flock * 13.1 + 4) * 24, startX = w + 30 + PX.h1(flock * 3.3 + 5) * 50;
    for (var i = 0; i < count; i++) {
      var bx = startX - local * speed - i * (16 + PX.h1(flock + i * 8.1) * 12), by = baseY + Math.sin(local * 1.7 + i) * 2 + i * (PX.h1(flock + i * 4.4 + 9) * 9 - 4);
      if (bx < -20 || bx > w + 20) continue;
      bird(fb, bx, by, 1 + Math.round(PX.h1(flock + i * 2.6 + 6)), 1 + Math.round((Math.sin(S.tSec * 7 + i) + 1) * 0.5), col);
    }
  };

  // ---- "you passed your old best": a warm afterglow band on the horizon (a dithered lift along each ramp) and the big bird crossing the sky ----
  V8.afterglow = function (fb, S, R) {
    var a = S.afterglow || 0, w = fb.w, h = fb.h, d = fb.d, hz = S.horizonY || h * 0.5;
    if (a > 0.01) {
      var y0 = Math.max(0, Math.round(hz - 18)), y1 = Math.min(h - 1, Math.round(S.anchorY + 58)), span = Math.max(1, y1 - y0);
      for (var y = y0; y <= y1; y++) {
        var t = (y - y0) / span, prof = t < 0.45 ? t / 0.45 : (1 - t) / 0.55, dens = Math.min(0.9, a * 2.6 * prof);
        if (dens <= 0.02) continue;
        for (var x = 0; x < w; x++) if (dith(x, y, dens)) { var o = y * w + x; d[o] = V8.light1[d[o]]; }
      }
    }
    if ((S.oldBestBird || 0) > 0.01 && !S.reduced && !R.noBirds) {
      var p = clamp01(1 - S.oldBestBird / 4.2), col = R.birdIdx == null ? 0 : R.birdIdx;
      bird(fb, w + 28 - p * (w + 90), Math.round(hz * 0.34 + Math.sin(p * 6.283) * 10), 4, 2, col);
      bird(fb, w + 8 - p * (w + 80), Math.round(hz * 0.34 + 14), 2, 1, col);
    }
  };

  // ---- mythic events. S.mythic = { type, p (0..1 through the event), seed } ----
  V8.mythicSky = function (fb, S, R) {
    var m = S.mythic; if (!m || !m.type || S.reduced) return;
    var w = fb.w, h = fb.h, p = m.p, fade = Math.sin(p * Math.PI), col = R.birdIdx == null ? 0 : R.birdIdx, hz = S.horizonY || h * 0.5;
    if (m.type === "eagle") {
      if (R.noBirds) return;
      var ex = Math.round(w + 30 - p * (w + 80)), ey = Math.round(24 + PX.h1(m.seed * 2.2 + 1) * Math.max(24, hz * 0.42));
      eagle(fb, ex, ey, Math.sin(p * 9) * 0.5 - 0.05, col);
      bird(fb, ex + 22, ey + 11, 1, 1 + ((p * 14) & 1), col);
    } else if (m.type === "wind") {
      var d = fb.d, n = 18;
      for (var wi = 0; wi < n; wi++) {
        var wx = Math.round((w + 40 - p * (w + 160) + PX.h1(wi * 4.7 + 1) * w) % (w + 80)) - 40, wy = Math.round(20 + PX.h1(wi * 9.3 + m.seed) * (h - 40)), len = 18 + Math.round(PX.h1(wi * 2.5 + 3) * 30);
        for (var x = 0; x < len; x++) {
          var px = wx + x; if (px < 0 || px >= w || wy < 0 || wy >= h) continue;
          if (dith(px, wy, fade * (x < len * 0.3 ? 0.45 : 0.25))) { var o = wy * w + px; d[o] = V8.light1[d[o]]; }
        }
      }
    }
  };

  // the watcher: a hooded figure with a staff, standing on the far ground for two seconds, eyes catching the light
  V8.mythicGround = function (fb, S, R) {
    var m = S.mythic; if (!m || m.type !== "watcher" || S.reduced) return;
    var w = fb.w, fade = Math.sin(m.p * Math.PI), rx = Math.round(w * (0.58 + PX.h1(m.seed * 0.4 + 1) * 0.24));
    if (S.zoom < 0.05) return;
    var by = S.lip[Math.max(0, Math.min(w - 1, rx))] - 1, ht = Math.round(20 * Math.max(0.75, Math.min(1.25, S.zoom * 1.5))), a = Math.min(1, fade * 1.5) * 0.92, col = R.watcherIdx == null ? 0 : R.watcherIdx, y, x;
    for (y = 0; y < ht; y++) {
      var t = y / (ht - 1), half = t < 0.22 ? 2 + (t > 0.08 ? 0.4 : 0) : 2 + (t - 0.22) * 6.4;    // head, then a cloak that flares to the ground
      for (x = -Math.round(half); x <= Math.round(half); x++) if (dith(rx + x, by - (ht - 1 - y), a)) fb.set(rx + x, by - (ht - 1 - y), col);
    }
    for (y = -4; y < ht - 2; y++) if (dith(rx + 7, by - (ht - 1 - y) , a)) fb.set(rx + 7, by - (ht - 1 - y), col);       // the staff
    fb.set(rx + 6, by - ht - 2, col); fb.set(rx + 8, by - ht - 2, col);
    if (fade > 0.55) { fb.set(rx - 1, by - ht + 5, MK.paper); fb.set(rx + 1, by - ht + 5, MK.paper); }                       // two pale eyes
  };

  // thunder: a brief flash lifting the whole frame along its ramps + a small forked bolt in the sky
  V8.mythicPost = function (fb, S, R) {
    var m = S.mythic; if (!m || m.type !== "thunder" || S.reduced || R.noThunder) return;
    var w = fb.w, h = fb.h, d = fb.d, p = m.p, x, y;
    if (p < 0.34) {
      var a = (1 - p) * 0.5, big = p < 0.12;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (dith(x, y, a)) { var o = y * w + x; d[o] = big ? V8.light1[V8.light1[d[o]]] : V8.light1[d[o]]; }
    }
    var fade = Math.sin(p * Math.PI), lx = Math.round(w * (0.26 + PX.h1(m.seed + 1) * 0.45)), ly = Math.round((S.horizonY || h * 0.5) * 0.16);
    if (fade > 0.15) {
      fb.fillRect(lx, ly, 2, 26, MK.paper); fb.fillRect(lx - 9, ly + 24, 11, 2, MK.paper); fb.fillRect(lx - 10, ly + 26, 2, 18, MK.paper); fb.fillRect(lx - 18, ly + 43, 10, 2, MK.paper);
    }
  };

  // ---- footprints: pairs of pressed marks trailing downhill behind him; they only exist where he has really walked ----
  V8.footprints = function (fb, S, R) {
    if (S.gameState !== "playing" || S.altitude <= 0.5) return;
    var stride = 20, z = S.zoom, w = fb.w, d = fb.d, scroll = S.scroll, footW = S.anchorX + scroll, k1 = Math.floor((footW - 8) / stride), k0 = Math.max(Math.ceil(S.anchorX / stride), Math.floor((-S.ztx / z + scroll) / stride));
    var fp = R && R.footprint, fw = Math.max(3, Math.round(6 * z * 1.4)), fh = Math.max(2, Math.round(2.4 * z * 1.4)), span = Math.max(1, footW - (-S.ztx / z + scroll));
    for (var k = k0; k <= k1; k++) {
      var xw = k * stride, sx = Math.round(S.ztx + (xw - scroll) * z); if (sx < 0 || sx >= w) continue;
      var f = clamp01((xw - (-S.ztx / z + scroll)) / span); f = f * f * (3 - 2 * f); var a = 0.30 + 0.62 * f;
      var lipy = S.lip[sx], y = lipy + Math.round(5 * z * 1.3) + ((k & 1) ? Math.max(1, Math.round(1.5 * z * 1.3)) : 0);
      for (var yy = 0; yy < fh; yy++) for (var xx = 0; xx < fw; xx++) {
        var px = sx - (fw >> 1) + xx, py = y + yy; if (px < 0 || px >= w || py < 0 || py >= fb.h) continue;
        if (!dith(px, py, a)) continue;
        var o = py * w + px; d[o] = fp ? fp.col : V8.shade2[d[o]];
      }
      if (fw >= 3 && dith(sx, y - 1, a * 0.7)) { var o2 = (y - 1) * w + sx; if (y - 1 >= 0) d[o2] = fp ? fp.hi : V8.light1[d[o2]]; }
    }
  };

  // ---- signposts ----
  function board(fb, x0, y0, bw, bh, put) {
    var i, j;
    for (j = 0; j < bh; j++) for (i = 0; i < bw; i++) {
      var edge = i === 0 || j === 0 || i === bw - 1 || j === bh - 1;
      put(x0 + i, y0 + j, edge ? MK.p0 : (j === bh - 2 || i === bw - 2 ? MK.p1 : MK.paper));
    }
    put(x0 + 1, y0 + 1, MK.p1); put(x0 + bw - 2, y0 + 1, MK.p1); put(x0 + 1, y0 + bh - 2, MK.p0); put(x0 + bw - 2, y0 + bh - 2, MK.p0);   // nails
  }
  function post(fb, x, yTop, yBot, put) { for (var y = yTop; y <= yBot; y++) { put(x - 1, y, MK.p1); put(x, y, MK.p0); put(x + 1, y, MK.p0); } }

  V8.signs = function (fb, S, R) {
    var z = S.zoom, w = fb.w, lip = S.lip, i;
    var mk = (R && R.markerIdx) || MK; MK.p0 = mk.p0 || 247; MK.p1 = mk.p1 || 248;
    function plain(x, y, c) { fb.set(x, y, c); }
    // the quote, planted at 1000 m
    var qx = S.anchorX + (1000 - S.altitude) * 7.2 + 260, sx = Math.round(S.ztx + qx * z);
    if (sx > -80 && sx < w + 80) {
      var l1 = "ONE MUST IMAGINE", l2 = "SISYPHUS HAPPY", bw = V8.textWidth(l1) + 14, bh = 27, gy = lip[Math.max(0, Math.min(w - 1, sx))] + 1, yTop = gy - 20 - bh;
      post(fb, sx, yTop + bh - 2, gy, plain);
      board(fb, sx - (bw >> 1), yTop, bw, bh, plain);
      V8.text(fb, sx - (V8.textWidth(l1) >> 1), yTop + 6, l1, MK.ink, MK.paper, 1);
      V8.text(fb, sx - (V8.textWidth(l2) >> 1), yTop + 15, l2, MK.ink, MK.paper, 1);
    }
    // Daily: the target the day is asking of you
    if (S.gameState === "playing" && S.mode === "daily" && S.dailyTarget) {
      var passed = S.score >= S.dailyTarget, a = passed ? clamp01(1 - (S.score - S.dailyTarget) / 130) : 1;
      if (a > 0.03) {
        var tx = S.anchorX + (S.dailyTarget - S.score) * 7.2 + 260, tsx = Math.round(S.ztx + tx * z);
        if (tsx > -60 && tsx < w + 60) {
          var t1 = "TARGET", t2 = ("000" + Math.round(S.dailyTarget)).slice(-4) + "M", bw2 = Math.max(V8.textWidth(t1), V8.textWidth(t2)) + 12, bh2 = 24, gy2 = lip[Math.max(0, Math.min(w - 1, tsx))] + 1, y2 = gy2 - 16 - bh2;
          var put = a >= 1 ? plain : function (x, y, c) { if (dith(x, y, a)) fb.set(x, y, c); };
          post(fb, tsx, y2 + bh2 - 2, gy2, put);
          board(fb, tsx - (bw2 >> 1), y2, bw2, bh2, put);
          if (a >= 0.6) { V8.text(fb, tsx - (V8.textWidth(t1) >> 1), y2 + 5, t1, MK.ink, MK.paper, 1); V8.text(fb, tsx - (V8.textWidth(t2) >> 1), y2 + 13, t2, MK.ink, MK.paper, 1); }
        }
      }
    }
  };
})(typeof window !== "undefined" ? window : this);
