// V8 rock: a faceted stone that is LIT, not textured. Each pixel asks "which way does this bit of
// stone face?" and shades it against the realm's light with a 6-tone palette ramp + ordered dither,
// a hard 1-px outline and a rim of sun on the lit edge. The stone spins under the light exactly like
// a real one rolling. Output is an INDEXED sprite (slots), so any realm / hour can recolour it for free.
//
// Slots: 1..6 tone ramp dark->light | 7 ink outline | 8 lit-side outline | 9 rim light
//        10 accent mid | 11 accent light | 12 accent dark   (moss, snow, lichen ...)
(function (root) {
  "use strict";
  var PX = root.PX;
  var CACHE = new Map(), CACHE_MAX = 420;
  var ANGLE_STEPS = 96, LIGHT_DIRS = 16;

  function lightVec(idx) {                       // idx: 0..15 = direction of the light in the screen plane
    var a = (idx / LIGHT_DIRS) * Math.PI * 2, e = 0.62;
    return [Math.cos(a) * Math.cos(e) * 1.0, Math.sin(a) * Math.cos(e) * 1.0, Math.sin(e) + 0.25];
  }
  // screen-plane direction TOWARD the light -> quantised index
  function lightIndex(dx, dy) {
    var a = Math.atan2(dy, dx); if (a < 0) a += Math.PI * 2;
    return Math.round(a / (Math.PI * 2) * LIGHT_DIRS) % LIGHT_DIRS;
  }

  var STYLES = {
    granite: { facets: 1.9, tilt: 0.95, crack: 0.06, seed: 3, fine: true, accent: 0, lump: 0.055 },
    mossy:   { facets: 1.9, tilt: 0.95, crack: 0.06, seed: 3, fine: true, accent: 1, lump: 0.055 },
    snowy:   { facets: 1.7, tilt: 0.85, crack: 0.05, seed: 5, fine: true, accent: 2, lump: 0.05 },
    smooth:  { facets: 1.3, tilt: 0.55, crack: 0.035, seed: 7, fine: false, accent: 0, lump: 0.025 },
    obsidian:{ facets: 2.3, tilt: 1.15, crack: 0.05, seed: 9, fine: true, accent: 0, lump: 0.045 }
  };

  function render(rx, ry, angleStep, lightIdx, style) {
    var st = STYLES[style] || STYLES.granite;
    var L = lightVec(lightIdx), Ln = Math.hypot(L[0], L[1], L[2]); L = [L[0] / Ln, L[1] / Ln, L[2] / Ln];
    var theta = angleStep / ANGLE_STEPS * Math.PI * 2, cs = Math.cos(theta), sn = Math.sin(theta);
    var hw = Math.ceil(rx) + 2, hh = Math.ceil(ry) + 2, W = hw * 2 + 1, H = hh * 2 + 1;
    var sp = new PX.Sprite(W, H); sp.ox = -hw; sp.oy = -hh;
    var mask = new Uint8Array(W * H), tone = new Float32Array(W * H), lit = new Float32Array(W * H), acc = new Uint8Array(W * H);
    var seed = st.seed, N = 6, big = rx > 24, freq = big ? st.facets * 0.62 : st.facets;
    var y, x, i;
    for (y = -hh; y <= hh; y++) for (x = -hw; x <= hw; x++) {
      var dx = (x + 0.5) / rx, dy = (y + 0.5) / ry, rr = dx * dx + dy * dy;
      if (rr > 1) continue;
      var nx = dx, ny = dy, nz = Math.sqrt(Math.max(0, 1 - rr));
      var px = nx * cs + ny * sn, py = -nx * sn + ny * cs, pz = nz;                 // point on the stone's own surface
      if (st.lump && rr > 0.55) {                                                   // a boulder is never a perfect circle: flats and lumps that turn with it
        var rl = Math.sqrt(rr), ux = px / (rl || 1), uy = py / (rl || 1);
        var g0 = PX.vnoise(ux * 1.35 + 5.1 + seed, uy * 1.35 + 7.3, 0.5);
        if (rl > 1 - st.lump * g0 * 2.2) continue;
      }
      var w = PX.worley(px * freq + seed * 3.7, py * freq + seed * 1.9, pz * freq + seed * 5.3);
      var d1 = w.d1, d2 = w.d2, id = w.id;
      var tx = (PX.h3(id, seed, 1) - 0.5) * st.tilt, ty = (PX.h3(id, seed, 2) - 0.5) * st.tilt, tz = (PX.h3(id, seed, 3) - 0.5) * st.tilt;
      var mx = px + tx, my = py + ty, mz = pz + tz, ml = Math.hypot(mx, my, mz); mx /= ml; my /= ml; mz /= ml;
      var vx = mx * cs - my * sn, vy = mx * sn + my * cs, vz = mz;                  // facet normal back in view space
      var diff = vx * L[0] + vy * L[1] + vz * L[2]; if (diff < 0) diff = 0;
      var sph = nx * L[0] + ny * L[1] + nz * L[2]; if (sph < 0) sph = 0;
      var t = 0.10 + 0.44 * diff + 0.40 * sph;
      t *= 0.90 + 0.20 * PX.h3(id, seed, 9);
      var crack = st.crack, edge = (d2 - d1) < crack * (big ? 1.7 : 1.25);
      if (!edge && st.fine && !big) {
        var w2 = PX.worley(px * freq * 2.6 + seed * 9.1, py * freq * 2.6 + seed * 4.4, pz * freq * 2.6 + seed * 2.2);
        if ((w2.d2 - w2.d1) < crack && PX.h3(w2.id, seed, 4) > 0.52) edge = true;
      }
      if (edge && PX.h3(id, seed, 21) > (big ? 0.66 : 0.42)) t *= 0.55;         // only some plane edges are dark; the rest show as a change of tone
      if (big) {
        if (Math.abs(PX.vnoise(px * 2.1 + seed, py * 2.1, pz * 2.1) - 0.5) < 0.014) t *= 0.55;   // a few long wandering cracks
        t += (PX.vnoise(px * 3.1 + seed * 2, py * 3.1, pz * 3.1) - 0.5) * 0.24;                  // weathering stains
        if (PX.vnoise(px * 6 + seed, py * 6, pz * 6) > 0.86) t *= 0.78;                          // pits
      }
      t += (PX.vnoise(px * 5.5 + seed, py * 5.5, pz * 5.5) - 0.5) * 0.10;
      if (t > 0.93) t = 0.93;
      i = (y + hh) * W + (x + hw);
      mask[i] = 1; tone[i] = t; lit[i] = sph;
      // accents: moss grows on facets that look up; snow settles on anything facing up and is thickest on top
      if (st.accent === 1 && pz > -0.25) {
        var mm = 0.45 * PX.h3(id, seed, 11) + 0.55 * PX.vnoise(px * 4.2 + seed, py * 4.2, pz * 4.2);
        if (mm > 0.60 - 0.30 * Math.max(0, -py)) acc[i] = 1;                       // moss: patchy, thicker on top
      }
      else if (st.accent === 2 && (py < -0.30 + 0.35 * PX.h3(id, seed, 12) + 0.18 * (PX.vnoise(px * 5 + seed, py * 5, pz * 5) - 0.5)) && pz > -0.3) acc[i] = 1;
    }
    function inside(xx, yy) { xx += hw; yy += hh; if (xx < 0 || yy < 0 || xx >= W || yy >= H) return false; return mask[yy * W + xx] === 1; }
    var dither = 0.42;
    for (y = -hh; y <= hh; y++) for (x = -hw; x <= hw; x++) {
      i = (y + hh) * W + (x + hw);
      if (!mask[i]) continue;
      var slot;
      var isEdge = !(inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1));
      if (isEdge) slot = lit[i] > 0.42 ? 8 : 7;
      else {
        var k = Math.floor(tone[i] * (N - 0.001) + PX.BAYER4[(y + 64) & 3][(x + 64) & 3] * dither);
        k = k < 0 ? 0 : k > N - 1 ? N - 1 : k;
        slot = 1 + k;
        if (acc[i]) slot = k < 2 ? 12 : k < 4 ? 10 : 11;
        else if (lit[i] > 0.55 && !(inside(x - 2, y) && inside(x + 2, y) && inside(x, y - 2) && inside(x, y + 2))) slot = 9;      // rim of light
        else if (k <= 2 && !inside(x, y + 2) && ((x + y) & 1) === 0) slot = 13;                                                     // bounce light from the ground
      }
      sp.set(x, y, slot);
    }
    return sp;
  }

  // returns a cached, SHARED sprite: origin (0,0) = the stone's centre. Do not mutate.
  //   o: rx, ry (px radii, integers), angle (radians), lightDx/lightDy (screen direction TOWARD the light), style
  function get(o) {
    var a = o.angle / (Math.PI * 2); a -= Math.floor(a);
    var step = Math.round(a * ANGLE_STEPS) % ANGLE_STEPS;
    var li = lightIndex(o.lightDx == null ? -0.5 : o.lightDx, o.lightDy == null ? -0.8 : o.lightDy);
    var key = o.rx + "|" + o.ry + "|" + step + "|" + li + "|" + (o.style || "granite");
    var sp = CACHE.get(key);
    if (sp) { CACHE.delete(key); CACHE.set(key, sp); return sp; }        // LRU touch
    sp = render(o.rx, o.ry, step, li, o.style || "granite");
    CACHE.set(key, sp);
    if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
    return sp;
  }

  // slot -> RGB for a stone in a given light: ramp[6] dark->light, ink, rim, accent ramp[3] (dark, mid, light)
  function palette(ramp, ink, rim, accent, bounce) {
    var p = [null];
    for (var i = 0; i < 6; i++) p.push(ramp[i]);
    p.push(ink);
    p.push(PX.mix(ink, ramp[1], 0.55));
    p.push(rim);
    var a = accent || [ramp[2], ramp[3], ramp[5]];
    p.push(a[1]); p.push(a[2]); p.push(a[0]);
    p.push(bounce || PX.mix(ramp[2], ramp[4], 0.5));
    return p;
  }

  root.Rock = { get: get, palette: palette, STYLES: STYLES, cacheSize: function () { return CACHE.size; }, clear: function () { CACHE.clear(); } };
})(typeof window !== "undefined" ? window : this);
