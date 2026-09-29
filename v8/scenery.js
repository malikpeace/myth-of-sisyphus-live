// V8 scenery toolkit: reusable procedural pixel-art generators shared by every realm.
// Everything writes PALETTE INDICES into an indexed Frame or into tileable strips; nothing is ever resampled.
// Strips are generated once (per size/palette) and scrolled with integer offsets - parallax for free.
(function (root) {
  "use strict";
  var PX = root.PX, Sc = {};
  var clamp01 = PX.clamp01, TAU = Math.PI * 2;

  // ---------- dithered vertical gradient: idxs = palette indices top -> bottom ----------
  Sc.bands = function (fb, y0, y1, idxs, dither) {
    var n = idxs.length, h = y1 - y0, bandH = h / n, w = fb.w, d = fb.d, y, x;
    dither = dither == null ? 3 : dither;
    for (y = Math.max(0, y0); y < Math.min(fb.h, y1); y++) {
      var t = (y - y0) / bandH, k = Math.floor(t), f = t - k;
      var a = idxs[Math.min(n - 1, k)], b = idxs[Math.min(n - 1, k + 1)], row = y * w;
      if (a === b || f < 1 - dither / bandH) { d.fill(a, row, row + w); continue; }
      // last `dither` rows of each band blend into the next with an ordered dither
      var mix = (f - (1 - dither / bandH)) / (dither / bandH);
      for (x = 0; x < w; x++) d[row + x] = (PX.BAYER4[y & 3][x & 3] + 0.5) < mix ? b : a;
    }
  };

  // ---------- strips ----------
  // A strip is {w, h, d: Uint8Array of palette indices (0 = transparent)}. blitStrip scrolls it horizontally (wrapping).
  Sc.newStrip = function (w, h) { return { w: w, h: h, d: new Uint8Array(w * h) }; };
  Sc.blitStrip = function (fb, st, offX, y0, clipTop, clipBot) {
    var w = fb.w, sw = st.w, sh = st.h, d = fb.d, sd = st.d, fh = fb.h;
    var ox = ((Math.floor(offX) % sw) + sw) % sw;
    var ya = Math.max(0, y0, clipTop == null ? 0 : clipTop), yb = Math.min(fh, y0 + sh, clipBot == null ? fh : clipBot);
    for (var y = ya; y < yb; y++) {
      var srow = (y - y0) * sw, row = y * w, sx = ox;
      for (var x = 0; x < w; x++) {
        var v = sd[srow + sx]; if (v) d[row + x] = v;
        if (++sx === sw) sx = 0;
      }
    }
  };

  // periodic 1-D noise built from sines whose periods divide L (so strips tile seamlessly)
  function periodic(L, seed) {
    var r = PX.rng(seed), comps = [], k;
    for (k = 0; k < 5; k++) comps.push({ f: 3 + Math.floor(r() * 9) * (k + 1) * 2, ph: r() * TAU, a: Math.pow(0.55, k) });
    return function (x) { var s = 0, wsum = 0; for (var i = 0; i < comps.length; i++) { s += comps[i].a * Math.sin(TAU * comps[i].f * x / L + comps[i].ph); wsum += comps[i].a; } return s / wsum; };
  }
  Sc.periodic = periodic;

  // ---------- mountain range strip ----------
  // Peaks get a diagonal main ridge (lit face on one side, shaded on the other) and a fan of gullies; the gullies split each face
  // into wedges that alternate one tone, and snow settles per wedge with a jagged, dithered lower edge. No straight verticals.
  // o: L (period px), H (max height px), seed, peaks, hMin,hMax (0..1 of H), sharp, snow (0..1), gullies,
  //    pal: { rockDeep, rockS, rockM, rockL, snowS, snowL, snowH, snowD }
  Sc.mountainStrip = function (o) {
    var L = o.L, H = o.H, st = Sc.newStrip(L, H), rnd = PX.rng(o.seed), pal = o.pal, n = o.peaks, i, x, y, k, g;
    var peaks = [];
    for (i = 0; i < n; i++) {
      var span = L / n, pk = { x: (i + 0.2 + 0.6 * rnd()) * span, h: H * (o.hMin + (o.hMax - o.hMin) * rnd()), w: span * (0.95 + 0.9 * rnd()), ridge: (rnd() - 0.5) * 0.55, gl: [] };
      var ng = o.gullies || 5;
      for (g = 0; g < ng; g++) pk.gl.push({ a: (g / (ng - 1) - 0.5) * 2.2 + (rnd() - 0.5) * 0.35, wob: rnd() * TAU, len: 0.5 + 0.5 * rnd() });
      pk.gl.sort(function (p, q) { return p.a - q.a; });
      peaks.push(pk);
    }
    var jit = periodic(L, o.seed * 7 + 1), jit2 = periodic(L, o.seed * 13 + 5);
    var topY = new Int16Array(L), dom = new Int16Array(L), dmax = new Float32Array(L);
    for (x = 0; x < L; x++) {
      var best = 0, bi = 0;
      for (i = 0; i < n; i++) for (k = -1; k <= 1; k++) {
        var dx = x - (peaks[i].x + k * L), ad = Math.abs(dx);
        if (ad >= peaks[i].w) continue;
        var prof = Math.pow(1 - ad / peaks[i].w, o.sharp);
        var f = peaks[i].h * prof * (1 + 0.10 * jit(x) * (0.4 + prof)) + 3.2 * jit2(x) * prof;
        if (f > best) { best = f; bi = i; }
      }
      dmax[x] = best; topY[x] = Math.max(0, Math.round(H - best)); dom[x] = bi;
    }
    var snowAmt = o.snow == null ? 0.4 : o.snow;
    for (x = 0; x < L; x++) {
      var ty = topY[x], pk = peaks[dom[x]], hn = dmax[x] / H, apexY = H - pk.h;
      // the dominant peak's copy nearest to this column (periodic wrap)
      var px = pk.x; if (x - px > L / 2) px += L; else if (px - x > L / 2) px -= L;
      for (y = ty; y < H; y++) {
        var t = Math.max(0, y - apexY), d0 = y - ty;
        var ridgeX = px + Math.tan(pk.ridge) * t;
        var left = x < ridgeX;
        var wedge = 0;
        for (g = 0; g < pk.gl.length; g++) {
          var gg = pk.gl[g], gx = px + Math.tan(gg.a) * t * (0.55 + 0.45 * Math.min(1, t / 22)) + Math.sin(t * 0.19 + gg.wob) * 1.3;
          if (x >= gx) wedge++;
          if (t <= gg.len * pk.h && Math.abs(x - gx) < 0.55) { wedge = -1000; break; }
        }
        var onGully = wedge < -500; if (onGully) wedge = 0;
        var alt = (wedge & 1) === 1;
        var thick = snowAmt * pk.h * (0.30 + 0.70 * PX.h2(dom[x] * 13 + Math.max(0, Math.min(9, wedge)), 5)) * (0.75 + 0.25 * (jit2(x + 31) * 0.5 + 0.5));
        var dith = PX.BAYER4[y & 3][x & 3] * 3.4;
        var isSnow = snowAmt > 0 && hn > 0.30 && (d0 < thick + dith);
        var idx;
        if (isSnow) {
          if (onGully) idx = pal.snowD || pal.snowS;
          else if (left) idx = alt ? pal.snowL : (d0 < 3 ? pal.snowH : pal.snowL);
          else idx = alt ? (pal.snowD || pal.snowS) : pal.snowS;
        } else {
          if (onGully) idx = left ? pal.rockS : pal.rockDeep;
          else if (left) idx = alt ? pal.rockM : pal.rockL;
          else idx = alt ? pal.rockDeep : pal.rockS;
          if (left && d0 > 5 && ((x * 7 + y * 3) & 15) === 0) idx = pal.rockM;
        }
        if (d0 === 0 && left && !isSnow) idx = pal.rockL;                    // a lit edge along the sunward skyline
        st.d[y * L + x] = idx;
      }
    }
    return st;
  };

  // ---------- distant forest strip (tiny pines, tileable) ----------
  // o: L, H, seed, spacing (avg px), hMin, hMax, pal {dark, mid, light}, fadeIdx (mist colour drawn as dither on the lowest rows)
  Sc.forestStrip = function (o) {
    var L = o.L, H = o.H, st = Sc.newStrip(L, H), rnd = PX.rng(o.seed), x = 0;
    var base = H - 1;
    while (x < L + 8) {
      var h = Math.round(o.hMin + (o.hMax - o.hMin) * rnd()), hw = Math.max(2, Math.round(h * 0.28)), cx = x, lean = rnd() < 0.5 ? 0 : 1;
      for (var yy = 0; yy < h; yy++) {
        var t = yy / h, half = Math.max(0, Math.round(hw * (t < 0.06 ? 0.2 : 0.2 + t * 0.95)) - (((yy + Math.floor(rnd() * 2)) % 3 === 0) ? 1 : 0));
        var y = base - (h - 1 - yy) - 0;
        y = base - yy;
        var top = base - h + 1 + yy;
        for (var dx = -half; dx <= half; dx++) {
          var px = (((cx + dx) % L) + L) % L, c = dx < -half * 0.3 ? o.pal.light : (dx > half * 0.4 ? o.pal.dark : o.pal.mid);
          st.d[top * L + px] = c;
        }
      }
      x += Math.max(2, Math.round(o.spacing * (0.55 + 0.9 * rnd())));
    }
    // mist: the lowest rows dissolve into the mist colour with an ordered dither
    if (o.fadeIdx) for (var fy = 0; fy < Math.min(H, o.fadeRows || 10); fy++) {
      var rowY = H - 1 - fy, amt = 1 - fy / (o.fadeRows || 10);
      for (var fx = 0; fx < L; fx++) if (st.d[rowY * L + fx] && (PX.BAYER4[rowY & 3][fx & 3] + 0.5) < amt) st.d[rowY * L + fx] = o.fadeIdx;
    }
    return st;
  };

  // ---------- forested ridge strip: a rolling hill silhouette with pines standing along the crest ----------
  // o: L, H, seed, amp (crest wobble px), hMin,hMax (pine height), spacing, pal {body, bodyL, pineD, pineM, pineL}, fadeIdx
  Sc.forestRidge = function (o) {
    var L = o.L, H = o.H, st = Sc.newStrip(L, H), rnd = PX.rng(o.seed), wob = periodic(L, o.seed * 3 + 2), wob2 = periodic(L, o.seed * 5 + 9), x, y;
    var crest = new Int16Array(L), base = Math.round(H * 0.42);
    for (x = 0; x < L; x++) crest[x] = Math.round(base + o.amp * (0.7 * wob(x) + 0.3 * wob2(x)));
    for (x = 0; x < L; x++) for (y = crest[x]; y < H; y++) st.d[y * L + x] = (y - crest[x] < 2 && ((x + y) & 1) === 0) ? o.pal.bodyL : o.pal.body;
    var px = 0;
    while (px < L) {
      var h = Math.round(o.hMin + (o.hMax - o.hMin) * rnd()), hw = Math.max(1, Math.round(h * 0.26)), cx = px, cy = crest[cx % L] + 1;
      for (var yy = 0; yy < h; yy++) {
        var t = yy / h, half = Math.max(0, Math.round(hw * (t < 0.08 ? 0.15 : 0.15 + t * 0.95)) - (((yy + (cx & 1)) % 3 === 0) ? 1 : 0)), top = cy - h + 1 + yy;
        if (top < 0) continue;
        for (var dx = -half; dx <= half; dx++) { var xx = (((cx + dx) % L) + L) % L; st.d[top * L + xx] = dx < -half * 0.25 ? o.pal.pineL : (dx > half * 0.45 ? o.pal.pineD : o.pal.pineM); }
      }
      px += Math.max(2, Math.round(o.spacing * (0.55 + 0.9 * rnd())));
    }
    if (o.fadeIdx) for (y = 0; y < (o.fadeRows || 12); y++) {
      var ry = H - 1 - y, amt = 1 - y / (o.fadeRows || 12);
      for (x = 0; x < L; x++) if (st.d[ry * L + x] && (PX.BAYER4[ry & 3][x & 3] + 0.5) < amt) st.d[ry * L + x] = o.fadeIdx;
    }
    st.crest = base;
    return st;
  };

  // ---------- pixel cloud sprite (flat bottom, 4 tones: highlight, body, shade, underside) ----------
  Sc.cloudSprite = function (seed, w, h, pal) {
    var rnd = PX.rng(seed), sp = new PX.Sprite(w, h), i, x, y, blobs = [], nb = 4 + Math.floor(rnd() * 3);
    for (i = 0; i < nb; i++) blobs.push({ x: w * (0.16 + 0.68 * (i + rnd() * 0.6) / nb), r: h * (0.30 + 0.36 * rnd()) });
    blobs.sort(function (a, b) { return b.r - a.r; });
    var base = h - 2;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var inside = false, topmost = 1e9;
      for (i = 0; i < nb; i++) { var dx = x - blobs[i].x, dy = y - (base - blobs[i].r * 0.62); if (dx * dx + dy * dy <= blobs[i].r * blobs[i].r) { inside = true; topmost = Math.min(topmost, y - (base - blobs[i].r * 1.6)); } }
      if (!inside || y > base) continue;
      var t = (y - 1) / base, c;
      if (y >= base - 1) c = pal[3]; else if (t > 0.66) c = pal[2]; else if (t < 0.30) c = pal[0]; else c = pal[1];
      if (c === pal[1] && ((x + y) & 1) === 0 && t > 0.5 && t < 0.66) c = pal[2];       // dither the shading step
      sp.set(x, y, c === 0 ? 0 : c);
    }
    sp.ox = 0; sp.oy = 0;
    // flat sprites are stored with palette INDICES directly (no slot remapping): 0 stays transparent
    return sp;
  };

  // ---------- sun: hard two-tone disc + banded glow (dithered into whatever is behind) ----------
  Sc.sun = function (fb, cx, cy, r, pal, glow) {
    var w = fb.w, h = fb.h, d = fb.d, rr, x, y;
    var R = r + (glow || 3) * 3;
    for (y = Math.max(0, cy - R - 2); y <= Math.min(h - 1, cy + R + 2); y++) for (x = Math.max(0, cx - R - 2); x <= Math.min(w - 1, cx + R + 2); x++) {
      var dx = x - cx + 0.5, dy = y - cy + 0.5, dist = Math.sqrt(dx * dx + dy * dy), o = y * w + x;
      if (dist <= r) { d[o] = dist <= r * 0.72 ? pal.core : (dist <= r * 0.9 ? pal.disc : pal.rim); }
      else if (dist <= r + 3) { if (((x + y) & 1) === 0 || dist < r + 1.5) d[o] = pal.glow1; }
      else if (dist <= r + 7) { if (PX.BAYER4[y & 3][x & 3] + 0.5 < 0.5 - (dist - r - 3) / 8) d[o] = pal.glow2; }
      else if (dist <= R) { if (PX.BAYER4[y & 3][x & 3] + 0.5 < 0.22 - (dist - r - 7) / (R * 5)) d[o] = pal.glow2; }
    }
    // short rays
    var rays = 8;
    for (var k = 0; k < rays; k++) {
      var a = k / rays * TAU + 0.2;
      for (var t = r + 2.5; t < r + 5.5; t++) { var px = Math.round(cx + Math.cos(a) * t), py = Math.round(cy + Math.sin(a) * t); if (px >= 0 && py >= 0 && px < w && py < h && (k & 1 || t < r + 4.6)) d[py * w + px] = pal.rim; }
    }
  };

  // ---------- pines (world-locked props, rasterised at any size) ----------
  // Draws a tiered fir with its base at (bx, by), height h px. pal: {dark, mid, light, trunk}
  Sc.pine = function (fb, bx, by, h, seed, pal, opts) {
    if (h < 3) return;
    opts = opts || {};
    var w = fb.w, d = fb.d, fh = fb.h, rnd = PX.rng(seed | 0), hw = Math.max(2, h * (opts.slim || 0.30)), tiers = Math.max(2, Math.round(h / 8)), trunkH = Math.max(1, Math.round(h * 0.08));
    var lightDir = opts.light == null ? -1 : opts.light;
    for (var y = 0; y < h; y++) {
      var t = y / (h - 1);                                                      // 0 top .. 1 bottom
      var tierPos = (t * tiers) % 1, tier = Math.floor(t * tiers);
      var half = hw * (0.15 + 0.85 * t) * (0.62 + 0.38 * tierPos) + (t > 0.03 ? 0.6 : 0);
      var py = by - (h - 1 - y) - trunkH;
      if (py < 0 || py >= fh) continue;
      var x0 = Math.round(bx - half), x1 = Math.round(bx + half);
      for (var x = x0; x <= x1; x++) {
        if (x < 0 || x >= w) continue;
        var u = half > 0.01 ? (x - bx) / half : 0, c;
        // lit from one side; tier undersides get the dark tone so tiers read as layered boughs
        if (tierPos > 0.82) c = pal.dark;
        else if (u * lightDir > 0.35) c = pal.light;
        else if (u * lightDir > -0.3) c = (((x + py) & 1) === 0 && tierPos < 0.25) ? pal.light : pal.mid;
        else c = pal.dark;
        d[py * w + x] = c;
      }
    }
    if (pal.trunk) for (var ty = 0; ty < trunkH + 1; ty++) { var yy = by - ty; if (yy >= 0 && yy < fh && bx >= 0 && bx < w) d[yy * w + Math.round(bx)] = pal.trunk; }
  };

  root.Sc = Sc;
})(typeof window !== "undefined" ? window : this);
