// The Dusk — V7's seventh realm. A retro silhouette world: posterised dusk sky,
// a huge striped sun that sinks as he climbs (dusk -> night -> dusk again),
// layered black-violet ridges, cypresses, a far temple, bird flocks — and every
// few hundred metres a noir storm rolls through: colour drains out, rain, and
// lightning that turns the whole world into stark black cut-outs.
// Everything here is screen-space and deterministic from (metres, time).
(function (root) {
  "use strict";
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(v) { v = clamp01(v); return v * v * (3 - 2 * v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function css(c, a) { return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + (a == null ? 1 : a) + ")"; }

  var SKY_DUSK = ["#1d1537", "#34204f", "#6a2c61", "#b0405f", "#e9765a", "#f7b36c"].map(hex);
  var SKY_NIGHT = ["#05040d", "#0b0a1f", "#151232", "#231a42", "#35224f", "#4a2a5c"].map(hex);
  var RIDGE_DUSK = ["#b04a6c", "#7a2f60", "#46193f", "#1c0b20"].map(hex);
  var RIDGE_NIGHT = ["#3a2552", "#29193d", "#18102a", "#0a0613"].map(hex);
  var INK = hex("#0a0610");
  var SUN_OUT = hex("#fbd08e"), SUN_IN = hex("#ffe7bd");

  // Journey clock: 0 = golden dusk, 1 = deep night, back to dusk every 2400 m.
  function nightAt(m) { var f = ((m / 2400) % 1 + 1) % 1; return smooth(1 - Math.abs(2 * f - 1)); }
  // Storms: first one at 260 m, then one every 700 m, each ~220 m long.
  function stormAt(m) {
    if (m < 260) return 0;
    var local = ((m - 260) % 700 + 700) % 700;
    if (local > 220) return 0;
    return smooth(local / 45) * smooth((220 - local) / 45);
  }

  var strike = { next: 0, start: -9, x: 0, seed: 0 };
  function flashAt(t) {
    var a = t - strike.start;
    if (a < 0 || a > 0.7) return 0;
    if (a < 0.07) return 1;
    if (a < 0.14) return 0.18;
    if (a < 0.22) return 0.75;
    return 0.75 * (1 - (a - 0.22) / 0.48);
  }

  function groundY(o) { var G = o.groundY; return (isFinite(G) && G > o.height * 0.25 && G < o.height * 1.1) ? G : o.height * 0.64; }
  function sunGeom(o) {
    var w = o.width, h = o.height, G = groundY(o), n = nightAt(o.metres);
    var r = Math.round(Math.max(18, Math.min(w * 0.2, h * 0.2)));
    var x = Math.round(w * (h > w ? 0.62 : 0.66));
    var y = Math.round(G - Math.max(r * 1.05, h * 0.15) + n * r * 2.6);
    return { x: x, y: y, r: r, night: n };
  }

  // Sky + sun are the expensive dithered part; cache them until something visible changes.
  var skyC = null, skyKey = "";
  function paintSky(o, sun, storm) {
    var w = o.width, h = o.height, G = groundY(o), n = sun.night;
    var key = [w, h, Math.round(G), Math.round(n * 200), Math.round(storm * 40)].join(":");
    if (!skyC) skyC = document.createElement("canvas");
    if (key === skyKey && skyC.width === w && skyC.height === h) return skyC;
    skyKey = key; skyC.width = w; skyC.height = h;
    var c = skyC.getContext("2d");
    var cols = SKY_DUSK.map(function (d, i) { return mix(d, SKY_NIGHT[i], n); });
    if (storm > 0) cols = cols.map(function (col) { var l = col[0] * 0.3 + col[1] * 0.5 + col[2] * 0.2; return mix(col, [l * 0.55, l * 0.58, l * 0.7], storm * 0.8); });
    var bottom = Math.max(40, G - h * 0.04), bandH = bottom / (cols.length - 0.35);
    for (var i = 0; i < cols.length; i++) {
      var y0 = Math.round(i * bandH), y1 = i === cols.length - 1 ? h : Math.round((i + 1) * bandH);
      c.fillStyle = css(cols[i]); c.fillRect(0, y0, w, y1 - y0);
      if (i < cols.length - 1) {                       // two-row checker dither into the next band
        c.fillStyle = css(cols[i + 1]);
        for (var dy = -2; dy < 0; dy++) for (var x = (dy & 1); x < w; x += 2) c.fillRect(x, y1 + dy, 1, 1);
        c.fillStyle = css(cols[i]);
        for (var x2 = 1; x2 < w; x2 += 2) c.fillRect(x2, y1, 1, 1);
      }
    }
    // stars: a few at the very top at dusk, a full field at night
    var starN = Math.round(10 + n * 70);
    for (var s = 0; s < starN; s++) {
      var sy = hash(s * 7.1) * bottom * (0.25 + n * 0.55);
      c.fillStyle = css([255, 244, 230], (0.25 + hash(s * 3.3) * 0.5) * (0.35 + n * 0.65) * (1 - storm));
      c.fillRect(Math.round(hash(s * 1.9) * w), Math.round(sy), 1, 1);
    }
    // the sun: soft stepped glow, two-tone disc, retro horizontal cuts in its lower half
    var sunA = 1 - smooth((n - 0.55) / 0.3);
    if (sunA > 0.01 && storm < 0.98) {
      var sa = sunA * (1 - storm * 0.85);
      for (var gI = 3; gI >= 1; gI--) {
        c.fillStyle = css(mix(SUN_OUT, cols[4], 0.4), 0.10 * sa);
        c.beginPath(); c.arc(sun.x, sun.y, sun.r + gI * Math.max(3, sun.r * 0.16), 0, Math.PI * 2); c.fill();
      }
      for (var ry = -sun.r; ry <= sun.r; ry++) {
        var half = Math.floor(Math.sqrt(Math.max(0, sun.r * sun.r - ry * ry)));
        if (half <= 0) continue;
        var cut = ry > sun.r * 0.12 ? Math.floor((ry - sun.r * 0.12) / Math.max(3, sun.r * 0.15)) : -1;
        var gap = cut >= 0 && ((ry - sun.r * 0.12) % Math.max(3, sun.r * 0.15)) < 1 + cut * 0.9;
        if (gap) continue;
        var inner = Math.floor(half * 0.8);
        c.fillStyle = css(SUN_OUT, sa); c.fillRect(sun.x - half, sun.y + ry, half * 2, 1);
        if (Math.abs(ry) < sun.r * 0.8) { c.fillStyle = css(SUN_IN, sa); c.fillRect(sun.x - inner, sun.y + ry, inner * 2, 1); }
      }
    }
    // moon at night: a pale crescent high on the left
    var moonA = smooth((n - 0.5) / 0.3) * (1 - storm);
    if (moonA > 0.01) {
      var mx = Math.round(w * 0.24), my = Math.round(bottom * 0.28), mr = Math.max(5, Math.round(sun.r * 0.28));
      c.fillStyle = css([236, 232, 246], moonA); c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();
      c.fillStyle = css(cols[1]); c.beginPath(); c.arc(mx + mr * 0.45, my - mr * 0.2, mr * 0.92, 0, Math.PI * 2); c.fill();
    }
    return skyC;
  }

  function ridgeShape(x, seed, freq) {
    var a = x * freq;
    var r = 0.50 * (1 - Math.abs(Math.sin(a + seed))) + 0.30 * Math.sin(a * 2.3 + seed * 1.7) + 0.20 * Math.sin(a * 5.1 + seed * 2.9);
    return clamp01(r * 0.9 + 0.2);
  }
  function drawRidge(g, o, base, amp, freq, seed, scroll, col, extras) {
    var w = o.width, h = o.height;
    g.fillStyle = css(col);
    var ys = [];
    for (var x = 0; x < w; x++) {
      var y = Math.round(base - amp * ridgeShape(x + scroll, seed, freq));
      ys.push(y); g.fillRect(x, y, 1, h - y);
    }
    if (!extras) return;
    var cell = extras.cell, first = Math.floor(scroll / cell) - 1;
    for (var k = first; k * cell - scroll < w + cell; k++) {
      var hk = hash(k * 13.7 + seed);
      if (hk < extras.p) continue;
      var cx = Math.round(k * cell - scroll + hash(k * 3.1 + seed) * cell * 0.6);
      if (cx < -30 || cx > w + 30) continue;
      var gy = ys[Math.max(0, Math.min(w - 1, cx))] + 1;
      if (extras.kind === "cypress") {
        var th = Math.round(extras.size * (0.7 + hash(k * 5.3) * 0.6)), tw = Math.max(2, Math.round(th * 0.22));
        for (var yy = 0; yy < th; yy++) {
          var u = yy / th, half = Math.max(0.5, tw * Math.sin(Math.PI * Math.min(1, (1 - u) * 1.15)) * (u < 0.1 ? 0.6 : 1));
          g.fillRect(Math.round(cx - half), gy - yy, Math.max(1, Math.round(half * 2)), 1);
        }
        g.fillRect(cx, gy - th - 1, 1, 2);
      } else if (extras.kind === "temple") {
        var s = extras.size, tw2 = s * 2, top = gy - s;
        g.fillRect(cx - s - 1, gy - 2, tw2 + 2, 3);                              // stylobate
        for (var cI = 0; cI < 5; cI++) g.fillRect(cx - s + 1 + Math.round(cI * (tw2 - 3) / 4), top + 2, 1, s - 3);
        g.fillRect(cx - s, top, tw2, 2);                                         // entablature
        for (var p = 0; p < Math.round(s * 0.45); p++) g.fillRect(cx - s + p * 2, top - p, Math.max(1, tw2 - p * 4), 1);
      }
    }
  }

  function bird(g, x, y, t, i, col) {
    var f = Math.floor((t * 7 + i * 0.37) % 3);
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
    if (f === 0) { g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); g.fillRect(x - 2, y - 2, 1, 1); g.fillRect(x + 2, y - 2, 1, 1); }
    else if (f === 1) { g.fillRect(x - 2, y - 1, 2, 1); g.fillRect(x + 1, y - 1, 2, 1); }
    else { g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x - 2, y + 1, 1, 1); g.fillRect(x + 2, y + 1, 1, 1); }
  }
  function drawFlocks(g, o, G, alpha) {
    if (alpha <= 0.02 || o.reduced) return;
    var w = o.width, h = o.height, t = o.time, col = css(INK, 0.88 * alpha);
    for (var fI = 0; fI < 2; fI++) {
      var period = 26 + fI * 9, tt = t + fI * 13, k = Math.floor(tt / period), local = tt - k * period;
      if (hash(k * 5.7 + fI) < 0.25) continue;
      var n = 3 + Math.floor(hash(k * 2.3 + fI) * 5), sp = (w + 90) / (period * 0.9);
      var lx = -40 + local * sp, ly = G - h * (0.30 + hash(k * 9.1 + fI) * 0.22);
      for (var b = 0; b < n; b++) {
        var row = Math.ceil(b / 2), side = b % 2 ? -1 : 1;
        var bx = Math.round(lx - row * 6), by = Math.round(ly + row * 3 * side + Math.sin(t * 1.3 + b) * 1.2);
        if (bx > -4 && bx < w + 4) bird(g, bx, by, t, b, col);
      }
    }
  }

  function boltPath(g, x, top, bottom, seed, col) {
    g.fillStyle = col;
    var cx = x, y = top, k = 0;
    while (y < bottom) {
      var seg = 4 + Math.round(hash(seed + k * 3.7) * 7);
      var nx = cx + Math.round((hash(seed + k * 9.1) - 0.5) * 9);
      for (var s = 0; s < seg; s++) g.fillRect(Math.round(lerp(cx, nx, s / seg)), y + s, 1 + (k < 3 ? 1 : 0), 1);
      if (hash(seed + k * 1.3) > 0.78) {                                    // a short fork
        var fx = nx, fy = y + seg;
        for (var f = 0; f < 8; f++) g.fillRect(fx + (hash(seed + k) > 0.5 ? f : -f), fy + f, 1, 1);
      }
      cx = nx; y += seg; k++;
    }
  }

  var api = {
    nightAt: nightAt,
    qaStrike: function () { strike.next = 1e-6; },
    stormAt: stormAt,
    // The light the actor rim, stone rim and ground edge should use.
    light: function (o) {
      var sun = sunGeom(o), storm = stormAt(o.metres), fl = flashAt(o.time);
      var n = sun.night;
      var col = mix([255, 190, 122], [176, 184, 236], smooth((n - 0.45) / 0.3));
      var x = n > 0.6 ? o.width * 0.24 : sun.x, y = n > 0.6 ? groundY(o) * 0.35 : sun.y;
      var str = lerp(1, 0.55, smooth((n - 0.4) / 0.4)) * (1 - storm * 0.8);
      if (fl > 0.05) { col = mix(col, [236, 236, 252], fl); str = Math.max(str, fl); x = strike.x; y = 0; }
      return { x: x, y: y, strength: str, col: col, storm: storm, flash: fl };
    },
    backdrop: function (g, o) {
      var w = o.width, h = o.height, G = groundY(o), m = o.metres, t = o.time;
      var sun = sunGeom(o), n = sun.night, storm = stormAt(m);
      // lightning schedule (only in the live game, never the menu thumbnail)
      if (!o.preview && !o.reduced) {
        if (storm > 0.35 && t >= strike.next) {
          if (strike.next > 0) { strike.start = t; strike.x = Math.round(w * (0.1 + hash(t * 3.1) * 0.8)); strike.seed = t * 17.3; if (o.onStrike) o.onStrike(storm); }
          strike.next = t + 2.2 + hash(t * 7.7) * 4.6;
        } else if (storm <= 0.35) strike.next = t + 1.2;
      }
      var fl = o.preview ? 0 : flashAt(t);
      g.save(); g.imageSmoothingEnabled = false;
      g.drawImage(paintSky(o, sun, storm), 0, 0);
      // long thin cloud bars drifting across the sun
      var barCol = mix(mix(hex("#8a3a66"), hex("#2a1a40"), n), [70, 70, 84], storm * 0.8);
      for (var bI = 0; bI < 5 + Math.round(storm * 7); bI++) {
        var bw = Math.round(w * (0.18 + hash(bI * 4.1) * 0.3) * (1 + storm)), bh = 1 + (hash(bI * 2.2) > 0.6 ? 1 : 0) + Math.round(storm * 2);
        var bx = Math.round(((hash(bI * 8.3) * (w + bw) - t * (1.5 + hash(bI) * 2.5) - m * 0.4) % (w + bw) + (w + bw)) % (w + bw) - bw);
        var by = Math.round(sun.y - sun.r * 0.9 + hash(bI * 6.6) * sun.r * 1.5 - storm * h * 0.1);
        g.fillStyle = css(barCol, 0.85); g.fillRect(bx, by, bw, bh);
      }
      if (fl > 0.02) {                                   // the sky blows out; everything in front goes black
        g.fillStyle = css([226, 224, 240], 0.85 * fl); g.fillRect(0, 0, w, h);
        if (t - strike.start < 0.3) boltPath(g, strike.x, 0, Math.round(G - h * 0.12), strike.seed, css([255, 255, 255], 0.95));
      }
      drawFlocks(g, o, G, (1 - smooth((n - 0.5) / 0.25)) * (1 - storm * 0.7));
      var flat = fl * 0.9;
      var R = RIDGE_DUSK.map(function (d, i) { var c = mix(d, RIDGE_NIGHT[i], n); c = mix(c, mix(c, [30, 30, 38], 0.6), storm * 0.7); return mix(c, INK, flat); });
      var scroll = m * 7.2;
      drawRidge(g, o, G - h * 0.10, h * 0.13, 0.011, 1.3, scroll * 0.03, R[0]);
      drawRidge(g, o, G - h * 0.06, h * 0.09, 0.017, 4.1, scroll * 0.06, R[1], { kind: "temple", cell: 520, p: 0.35, size: Math.max(6, Math.round(h * 0.025)) });
      drawRidge(g, o, G - h * 0.025, h * 0.07, 0.024, 7.7, scroll * 0.11, R[2], { kind: "cypress", cell: 34, p: 0.55, size: Math.max(9, Math.round(h * 0.045)) });
      drawRidge(g, o, G + h * 0.01, h * 0.06, 0.035, 2.2, scroll * 0.20, R[3], { kind: "cypress", cell: 46, p: 0.62, size: Math.max(12, Math.round(h * 0.07)) });
      g.restore();
      return true;
    },
    // Foreground pass: noir grade, rain, the flash.
    front: function (g, o) {
      var w = o.width, h = o.height, storm = stormAt(o.metres), t = o.time;
      if (storm <= 0.01) return;
      g.save();
      g.globalCompositeOperation = "saturation";
      g.fillStyle = css([128, 128, 128], Math.min(0.92, storm * 0.92));
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "source-over";
      g.fillStyle = css([12, 14, 24], storm * 0.16); g.fillRect(0, 0, w, h);
      if (!o.reduced) {
        var n = Math.round(50 + storm * 150), wind = 0.35 + (o.wind || 0) * 0.6;
        g.fillStyle = css([206, 208, 222], 0.30 + storm * 0.22);
        for (var i = 0; i < n; i++) {
          var sp = 260 + hash(i * 3.3) * 160, len = 4 + Math.round(hash(i * 5.9) * 5);
          var y = ((hash(i * 7.7) * (h + 20) + t * sp) % (h + 20)) - 10;
          var x = ((hash(i * 1.7) * (w + 40) - (y + t * sp * 0.2) * wind) % (w + 40) + (w + 40)) % (w + 40) - 20;
          for (var s = 0; s < len; s++) g.fillRect(Math.round(x - s * wind), Math.round(y + s), 1, 1);
        }
        if (o.surface) {                                                   // splashes where drops land
          g.fillStyle = css([220, 222, 236], 0.55 * storm);
          for (var j = 0; j < Math.round(16 * storm); j++) {
            var ph = (t * 3 + hash(j * 2.9)) % 1, sx = Math.round(hash(j * 6.1 + Math.floor(t * 3 + hash(j * 2.9))) * w);
            var sy = Math.round(o.surface(sx)) - 1;
            if (ph < 0.5) { g.fillRect(sx - 1, sy - 1, 1, 1); g.fillRect(sx + 1, sy - 1, 1, 1); } else g.fillRect(sx, sy - 2, 1, 1);
          }
        }
      }
      var fl = flashAt(t);
      if (fl > 0.02) { g.fillStyle = css([236, 236, 252], 0.14 * fl); g.fillRect(0, 0, w, h); }
      g.restore();
    }
  };
  root.SisyphusDusk = api;
})(typeof window !== "undefined" ? window : this);
