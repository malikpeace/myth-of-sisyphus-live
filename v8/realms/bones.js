// The Bone Fields - V8 scene (10450-11950 m). A pale, mournful wasteland under a hazy sepia sky, built entirely in code on the shared
// indexed framebuffer: a banded, dithered sky with a bleached low sun that sinks and rises over the zone, dust veils and a far dust wall;
// hazy mesas; colossal half-buried skeletons as layered silhouettes (ribcages seen side-on and as Gothic naves, a leviathan skull, a spine
// of great vertebrae, tusks and long bones), each shaded like a volume (distance-field bevel + Lambert + ordered dither) and faded into the
// haze by depth, with dark giant ribs sweeping past in front; slow dust devils crossing the plain; dry grass and dead thorn trees along a
// crest of bone-white dust. Below it the cracked hardpan gives way to baked strata holding stones, relics (a crown, a jug, a dagger, a shield
// boss) and fossils - great ribs in section, ammonites - then a packed bone bed of skulls whose sockets glow amber, and a dim amber glow far
// below. Sun height, haze and the props follow a 1500 m cycle (any altitude works).
(function (root) {
  "use strict";
  var PX = root.PX, Sc = root.Sc, V8 = root.V8, hex = PX.hex, clamp = PX.clamp, clamp01 = PX.clamp01, B4 = PX.BAYER4, TAU = Math.PI * 2;
  var R = { rock: { mat: "warm", style: "granite" }, thumb: { alt: 0, zoom: 0.74, slope: 0.02, ratio: 0.8 } }, I = {}, BASE = {};
  var ST = { built: "", skyKey: "", palKey: "", G: {}, WS: { t: -1, cp: 0 }, lm: [], dev: [] };
  var BP = new Float32Array(16);                                          // Bayer thresholds in (0,1): BP[((y & 3) << 2) | (x & 3)]
  (function () { for (var i = 0; i < 16; i++) BP[i] = B4[i >> 2][i & 3] + 0.5; })();
  var LIFT = new Uint8Array(256), DARK = new Uint8Array(256), LUM = new Float32Array(256);

  function H(list) { return list.map(hex); }
  function sm(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function h1(n) { return PX.h1(n); }
  function h2(a, b) { return PX.h2(a, b); }
  function mod(a, n) { return ((a % n) + n) % n; }
  function jag(x, seg, seed) { var k = Math.floor(x / seg), f = x / seg - k, a = PX.h2(k, seed), b = PX.h2(k + 1, seed); return a + (b - a) * f - 0.5; }
  function vn(x, y, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, h = PX.ihash; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h(ix, iy, s), b = h(ix + 1, iy, s), c = h(ix, iy + 1, s), d = h(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  // ---------- journey clock: the fields roll by in 1500 m (periodic, so any altitude works) ----------
  function zoneU(m) { return (((m - 10450) % 1500) + 1500) % 1500 / 1500; }

  // ---------- palette: every ramp runs dark -> light ----------
  var RAMPS = [
    ["sky",    "5a5249 635a50 6d6358 786d61 847769 908375 9c8f80 a89b8b b4a796 c0b3a1 cbbfab d6cab5 e1d6c0 ece2cd"],
    ["sun",    "e6dcc2 f2e9d0 fbf5e4 ffffff"],
    ["far",    "a89b86 b3a690 bfb29b cabda6 d8cbb4"],
    ["mid",    "85786a 93857a a2947f b3a48e c6b7a1"],
    ["boneF",  "9c8f7d a99c89 b8ab97 c9bda8"],
    ["boneM",  "5f5245 706255 84756a 9a8b79 b3a58f cdbfa7"],
    ["boneN",  "2e261f 3f342a 54463a 6b5b4b 85735f a08d77 bcaa92 dccfb6"],
    ["dust",   "8a7d69 9d907c b0a38e c3b6a1 d3c7b1 e2d7c1 efe6d2"],
    ["pan",    "463c32 594c3f 6e5f4d 85735e 9c8870 b39f84"],
    ["ochre",  "584229 71562f 8b6d3f a98a52 c4a66c"],
    ["rust",   "4a2a1e 673b2a 855039 a56b4c"],
    ["marl",   "4b5148 5d6558 727a6a 8a9383 a3ab98"],
    ["clay",   "3a2a22 4d392d 634a3a 7d604d 987b66"],
    ["deep",   "110d0a 19130e 221a14 2d231b 3a2e24"],
    ["amber",  "3a1a08 6e3210 a85a18 dd8a2a fcc862"],
    ["grass",  "4e4128 6b5a34 8c7846 b09a5c d6c184"],
    ["salt",   "8e9a9a c8d4d0 f4fffb"],
    ["ink",    "1a1510"]
  ];

  // ---------- masks: solid shapes drawn into a byte grid, shaded afterwards as volumes ----------
  function newMask(w, h) { return { w: w, h: h, d: new Uint8Array(w * h) }; }
  function mDisc(m, cx, cy, r, v) { mEll(m, cx, cy, r, r, v); }
  function mEll(m, cx, cy, rx, ry, v) {
    if (v === undefined) v = 1;
    var x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(m.w - 1, Math.ceil(cx + rx)), y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(m.h - 1, Math.ceil(cy + ry)), x, y;
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) { var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) m.d[y * m.w + x] = v; }
  }
  function mCap(m, x0, y0, x1, y1, r0, r1, v) {                         // tapered capsule
    if (v === undefined) v = 1;
    var minx = Math.max(0, Math.floor(Math.min(x0 - r0, x1 - r1))), maxx = Math.min(m.w - 1, Math.ceil(Math.max(x0 + r0, x1 + r1)));
    var miny = Math.max(0, Math.floor(Math.min(y0 - r0, y1 - r1))), maxy = Math.min(m.h - 1, Math.ceil(Math.max(y0 + r0, y1 + r1)));
    var vx = x1 - x0, vy = y1 - y0, L2 = vx * vx + vy * vy || 1e-6, x, y;
    for (y = miny; y <= maxy; y++) for (x = minx; x <= maxx; x++) {
      var px = x + 0.5, py = y + 0.5, t = ((px - x0) * vx + (py - y0) * vy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      var dx = px - (x0 + vx * t), dy = py - (y0 + vy * t), r = r0 + (r1 - r0) * t;
      if (dx * dx + dy * dy <= r * r) m.d[y * m.w + x] = v;
    }
  }
  function mPoly(m, pts, v) {
    if (v === undefined) v = 1;
    var n = pts.length, miny = 1e9, maxy = -1e9, k, y;
    for (k = 0; k < n; k++) { if (pts[k][1] < miny) miny = pts[k][1]; if (pts[k][1] > maxy) maxy = pts[k][1]; }
    for (y = Math.max(0, Math.floor(miny)); y <= Math.min(m.h - 1, Math.ceil(maxy)); y++) {
      var yc = y + 0.5, xs = [];
      for (k = 0; k < n; k++) { var a = pts[k], b = pts[(k + 1) % n]; if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort(function (p, q) { return p - q; });
      for (k = 0; k + 1 < xs.length; k += 2) for (var x = Math.max(0, Math.round(xs[k])); x < Math.min(m.w, Math.round(xs[k + 1])); x++) m.d[y * m.w + x] = v;
    }
  }
  // a curving, tapering bone (rib / horn / tusk): angle in screen space (0 = right, -PI/2 = up), curv = radians turned per pixel of length
  function mRib(m, x0, y0, len, ang, curv, w0, taper, breakAt) {
    var x = x0, y = y0, s, end = breakAt == null ? len : len * breakAt;
    for (s = 0; s < end; s += 0.6) {
      var wid = w0 * (1 - taper * Math.pow(s / len, 1.15)) + 0.7;
      mDisc(m, x, y, wid * 0.5 + 0.2, 1);
      ang += curv * 0.6; x += Math.cos(ang) * 0.6; y += Math.sin(ang) * 0.6;
    }
    return { x: x, y: y, ang: ang };
  }
  function mVert(m, cx, cy, s, tilt, spike) {
    spike = spike == null ? 1 : spike;                                   // one vertebra: a rounded drum with a canal, a tall spinous process and swept transverse fins
    mEll(m, cx, cy, 0.075 * s, 0.056 * s, 1);
    mCap(m, cx - 0.012 * s, cy - 0.04 * s, cx - 0.035 * s - tilt * 0.03 * s * spike, cy - 0.04 * s - 0.13 * s * spike, 0.028 * s, 0.012 * s, 1);
    mCap(m, cx - 0.05 * s, cy, cx - 0.115 * s, cy - 0.045 * s, 0.024 * s, 0.01 * s, 1);
    mCap(m, cx + 0.05 * s, cy, cx + 0.115 * s, cy - 0.045 * s, 0.024 * s, 0.01 * s, 1);
    mEll(m, cx + 0.02 * s, cy - 0.005 * s, 0.022 * s, 0.02 * s, 0);       // the spinal canal
  }

  // ---------- volume shading: distance-to-edge bevel -> normals -> Lambert -> tones with an ordered dither, a lit rim upper left, an ink edge lower right ----------
  var EL = (function () { var l = Math.sqrt(0.55 * 0.55 + 0.7 * 0.7 + 0.48 * 0.48); return [-0.55 / l, -0.7 / l, 0.48 / l]; })();
  function emboss(m, nT, o) {
    o = o || {};
    var w = m.w, h = m.h, N = w * h, dist = new Float32Array(N), i, x, y, d = m.d, out = new Uint8Array(N), R0 = o.bevel || 5, k = o.k || 1.7, amp = o.dither == null ? 0.85 : o.dither;
    for (i = 0; i < N; i++) dist[i] = d[i] ? 1e4 : 0;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; if (!dist[i]) continue; var v = dist[i];
      if (x > 0) v = Math.min(v, dist[i - 1] + 1); if (y > 0) { v = Math.min(v, dist[i - w] + 1); if (x > 0) v = Math.min(v, dist[i - w - 1] + 1.41); if (x < w - 1) v = Math.min(v, dist[i - w + 1] + 1.41); }
      dist[i] = v;
    }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) {
      i = y * w + x; if (!d[i]) continue; var v2 = dist[i];
      if (x < w - 1) v2 = Math.min(v2, dist[i + 1] + 1); if (y < h - 1) { v2 = Math.min(v2, dist[i + w] + 1); if (x < w - 1) v2 = Math.min(v2, dist[i + w + 1] + 1.41); if (x > 0) v2 = Math.min(v2, dist[i + w - 1] + 1.41); }
      dist[i] = v2;
    }
    var z = new Float32Array(N);
    for (i = 0; i < N; i++) if (d[i]) { var q = Math.min(dist[i], R0) / R0; z[i] = Math.sqrt(Math.max(0, 1 - (1 - q) * (1 - q))); }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; if (!d[i]) continue;
      var zl = x > 0 && d[i - 1] ? z[i - 1] : z[i], zr = x < w - 1 && d[i + 1] ? z[i + 1] : z[i], zu = y > 0 && d[i - w] ? z[i - w] : z[i], zd = y < h - 1 && d[i + w] ? z[i + w] : z[i];
      var gx = (zr - zl) * 0.5, gy = (zd - zu) * 0.5, nx = -gx * k * R0 * 0.5, ny = -gy * k * R0 * 0.5, nl = Math.sqrt(nx * nx + ny * ny + 1);
      var lam = (nx * EL[0] + ny * EL[1] + EL[2]) / nl, t = clamp01((lam + 0.28) / 1.28 - (o.bias || 0)), bay = BP[((y & 3) << 2) | (x & 3)] - 0.5;
      var tone = Math.floor(t * nT + bay * amp); tone = tone < 0 ? 0 : tone > nT - 1 ? nT - 1 : tone;
      var edgeUL = (x === 0 || !d[i - 1] || y === 0 || !d[i - w]), edgeDR = (x === w - 1 || !d[i + 1] || y === h - 1 || !d[i + w]);
      if (dist[i] <= 1.05) {
        if (edgeUL && !edgeDR && o.rim !== false) tone = nT - 1;                                    // a lit rim along the upper-left edge
        else if (edgeDR && o.ink !== false) tone = 0;                                               // an ink edge on the shaded side
      }
      out[i] = tone + 1;
    }
    var area = 0; for (i = 0; i < N; i++) if (d[i]) area++;
    if (area > 2200 && o.tex !== false) {                                                      // hairline cracks and pores: bone is never smooth
      var rndT = PX.rng((w * 31 + h * 17 + area) | 0), nc = Math.round(area / 900), q;
      for (q = 0; q < nc; q++) {
        var cx = Math.floor(rndT() * w), cy = Math.floor(rndT() * h), len = 6 + Math.floor(rndT() * 16), dx = rndT() < 0.5 ? -1 : 1;
        for (var s2 = 0; s2 < len; s2++) {
          if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= h - 1 || !d[cy * w + cx] || dist[cy * w + cx] < 3) break;
          out[cy * w + cx] = 1; if (out[cy * w + cx - 1] > 2) out[cy * w + cx - 1] = Math.min(nT, out[cy * w + cx - 1] + 1);
          cy += rndT() < 0.7 ? 1 : 0; cx += rndT() < 0.5 ? dx : 0; if (rndT() < 0.08) dx = -dx;
        }
      }
      for (i = 0; i < N; i++) if (out[i] > 2 && out[i] < nT && dist[i] > 2 && PX.ihash(i % w, (i / w) | 0, 77) > 0.975) out[i]--;
    }
    return { w: w, h: h, d: out };
  }
  // ---------- the bones ----------
  // A ribcage seen from the side: a spine of vertebrae along the ground, ribs rising from it and curving over like great horns. o: comb (curl direction), n ribs
  function mComb(W, Hh, seed, n, curlDir) {
    var m = newMask(W, Hh), rnd = PX.rng(seed), i, base = Hh - 3, sp = (W * 0.86) / Math.max(1, n - 1), x0 = W * 0.07, Lmax = Hh * 0.92;
    for (i = 0; i < n; i++) {
      var f = i / Math.max(1, n - 1), bell = Math.pow(Math.sin(Math.PI * (0.12 + 0.76 * f)), 0.75), L = Lmax * (0.42 + 0.58 * bell) * (0.92 + 0.16 * rnd());
      var bx = x0 + i * sp, by = base - 0.03 * Hh * Math.sin(f * 3.1), w0 = clamp(L * 0.085, 2.6, 13), ang0 = -Math.PI / 2 + curlDir * (0.10 + 0.22 * rnd()), curv = curlDir * (1.15 + 0.5 * rnd()) / L * (1.0 + 0.2 * (0.5 - f));
      mRib(m, bx, by, L, ang0, curv, w0, 0.84, rnd() < 0.22 ? 0.55 + 0.3 * rnd() : null);
    }
    for (i = 0; i < n; i++) { var bx2 = x0 + i * sp; mVert(m, bx2 + sp * 0.5, base + 1, Hh * 0.6, 0.3 * (rnd() - 0.5)); }
    for (i = 0; i < n; i++) mCap(m, x0 + i * sp - 2, base, x0 + i * sp + 2, base + 3, 2.2, 3, 1);
    return m;
  }
  // a Gothic nave of ribs seen end-on: arches nested into the distance. returns the arch masks far -> near
  function mArches(W, Hh, seed, n) {
    var rnd = PX.rng(seed), out = [], j;
    for (j = n - 1; j >= 0; j--) {
      var m = newMask(W, Hh), t = j / Math.max(1, n - 1), s = 1 - 0.55 * t, hw = W * 0.34 * s, H2 = Hh * 0.94 * s, xc = W * 0.5 + (t * 0.16 * W), yg = Hh - 2 - t * Hh * 0.16, w0 = clamp(Hh * 0.12 * s, 3.2, 14);
      for (var side = -1; side <= 1; side += 2) {
        var th = 0, tmax = (rnd() < 0.3 ? 0.62 + 0.25 * rnd() : 0.97) * Math.PI / 2, px = 0, py = 0, first = true;
        for (th = 0; th <= tmax; th += 0.012) {
          var x = xc + side * hw * Math.cos(th), y = yg - H2 * Math.sin(th), wid = w0 * (1 - 0.75 * Math.pow(th / (Math.PI / 2), 1.3)) + 0.8;
          mDisc(m, x, y, wid * 0.5, 1);
        }
      }
      out.push({ m: m, t: t });
    }
    return out;
  }
  // a leviathan's skull in profile, facing left: dome, long snout, brow, eye socket, second fenestra, a row of teeth, a hanging jaw
  function mSkull(W, Hh, seed) {
    var m = newMask(W, Hh), rnd = PX.rng(seed), i;
    function P(l) { return l.map(function (p) { return [p[0] * W, p[1] * Hh]; }); }
    mPoly(m, P([[0.02, 0.50], [0.05, 0.36], [0.15, 0.27], [0.30, 0.17], [0.46, 0.06], [0.63, 0.02], [0.79, 0.08], [0.93, 0.22], [0.99, 0.42], [0.96, 0.60], [0.86, 0.70], [0.70, 0.71], [0.52, 0.67], [0.30, 0.65], [0.14, 0.63], [0.04, 0.58]]));
    mPoly(m, P([[0.07, 0.70], [0.30, 0.71], [0.55, 0.75], [0.74, 0.80], [0.88, 0.88], [0.86, 0.97], [0.62, 0.995], [0.36, 0.965], [0.14, 0.89]]));
    for (i = 0; i < 9; i++) { var tx = (0.075 + i * 0.048) * W, th = (0.085 + 0.03 * rnd()) * Hh; mPoly(m, [[tx, 0.64 * Hh], [tx + 0.03 * W, 0.64 * Hh], [tx + 0.014 * W, 0.64 * Hh + th]]); }      // upper teeth
    for (i = 0; i < 8; i++) { var tx2 = (0.10 + i * 0.05) * W, th2 = (0.07 + 0.03 * rnd()) * Hh; mPoly(m, [[tx2, 0.715 * Hh], [tx2 + 0.03 * W, 0.715 * Hh], [tx2 + 0.016 * W, 0.715 * Hh - th2]]); }  // lower teeth, meeting them
    mEll(m, 0.505 * W, 0.37 * Hh, 0.105 * W, 0.135 * Hh, 0);              // the orbit
    mEll(m, 0.74 * W, 0.42 * Hh, 0.085 * W, 0.075 * Hh, 0);               // the temporal fenestra
    mEll(m, 0.085 * W, 0.44 * Hh, 0.02 * W, 0.035 * Hh, 0);               // the nostril
    mCap(m, 0.40 * W, 0.20 * Hh, 0.62 * W, 0.16 * Hh, 0.02 * Hh, 0.02 * Hh, 1);                              // brow ridge
    mEll(m, 0.66 * W, 0.66 * Hh, 0.20 * W, 0.045 * Hh, 0);                // a gap where the cheek arch meets the jaw
    return m;
  }
  function mTusk(W, Hh, seed, dir) {
    var m = newMask(W, Hh); mRib(m, dir > 0 ? W * 0.12 : W * 0.88, Hh - 3, Hh * 1.25, -Math.PI / 2 + dir * 0.15, dir * 1.7 / Hh, clamp(Hh * 0.2, 5, 22), 0.94, null); return m;
  }
  function mFemur(W, Hh, seed) {                                          // a long bone standing half-buried, knobbed at both ends
    var m = newMask(W, Hh), r = Hh * 0.05 + 2;
    mCap(m, W * 0.42, Hh - 2, W * 0.56, Hh * 0.10, r * 1.1, r * 0.8, 1);
    mDisc(m, W * 0.56, Hh * 0.08, r * 1.5, 1); mDisc(m, W * 0.56 + r * 1.3, Hh * 0.12, r * 1.2, 1);
    mDisc(m, W * 0.41, Hh - 2, r * 1.6, 1);
    return m;
  }
  function mSpine(W, Hh, seed, n) {                                       // a road of great vertebrae half sunk in the dust
    var m = newMask(W, Hh), rnd = PX.rng(seed), i, s = Hh * 1.6;
    for (i = 0; i < n; i++) { var f = i / Math.max(1, n - 1), cx = W * (0.08 + 0.84 * f), cy = Hh * 0.72 - Math.sin(f * 3.2) * Hh * 0.06 + (rnd() - 0.5) * 2; mVert(m, cx, cy, s * (0.9 + 0.2 * rnd()) * (1 - 0.25 * Math.abs(f - 0.4)), (rnd() - 0.5)); }
    return m;
  }

  // ---------- init: palette, lookup tables, cached strips ----------
  R.init = function (pal, S) {
    var i, j, nm;
    for (i = 0; i < RAMPS.length; i++) {
      nm = RAMPS[i][0];
      BASE[nm] = H(RAMPS[i][1].split(" ").map(function (c) { return "#" + c; }));
      I[nm] = pal.ramp(nm, BASE[nm].map(function (c) { return c.slice(); }));
    }
    for (i = 0; i < 256; i++) { LIFT[i] = i; DARK[i] = i; LUM[i] = 0; }
    for (nm in pal.ramps) {
      var rp = pal.ramps[nm];
      for (j = 0; j < rp.n; j++) { LIFT[rp.base + j] = rp.base + Math.min(rp.n - 1, j + 1); DARK[rp.base + j] = rp.base + Math.max(0, j - 1); LUM[rp.base + j] = PX.lum(pal.rgb[rp.base + j]); }
    }
    R.markerIdx = { c0: I.boneN, c1: I.boneN + 2, c2: I.boneN + 7, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };            // cairns: dark umber stones with a bone-white lit edge, readable against the pale haze
    R.birdIdx = I.boneN + 1;                                                // dark sepia buzzards against the pale sky
    R.watcherIdx = I.boneN + 1;                                             // a dark-cloaked watcher on the pale dust
    R.footprint = { col: I.dust + 1, hi: I.dust + 6 };                      // pressed dust with a pale rim
    ST.skyKey = ""; ST.palKey = ""; ST.WS.t = -1; ST.WS.cp = 0; ST.veils = null;                        // (the baked scene holds palette INDICES only: it stays valid across visits at the same size)
    R.pal = pal;
    buildScene(S);
  };

  // flat-topped mesas: steep talus flanks, a lit cap, strata lines. o: L H seed n base(ramp) mist(idx) fadeRows
  function mesaStrip(o) {
    var L = o.L, Hh = o.H, st = Sc.newStrip(L, Hh), d = st.d, rnd = PX.rng(o.seed), i, k, x, y, top = new Int16Array(L).fill(Hh), kind = new Int8Array(L);
    for (i = 0; i < o.n; i++) {
      var cx = (i + 0.15 + 0.7 * rnd()) * L / o.n, hw = L / o.n * (0.14 + 0.28 * rnd()), hh = Hh * (0.30 + 0.66 * Math.pow(rnd(), 0.8)), sl = 0.55 + 0.7 * rnd(), step = rnd() < 0.5;
      for (k = -1; k <= 1; k++) for (x = Math.floor(cx - hw - hh / sl); x <= Math.ceil(cx + hw + hh / sl); x++) {
        var dx = Math.abs(x + 0.5 - (cx + k * L)), yt = dx <= hw ? Hh - hh : Hh - hh + (dx - hw) * sl * (step && dx - hw > hh * 0.3 ? 0.55 : 1) + 1.8 * jag(x, 4, o.seed + i), xx = mod(x, L);
        yt = Math.round(yt); if (yt < top[xx]) { top[xx] = yt; kind[xx] = (dx <= hw) ? 0 : ((x + 0.5 < cx + k * L) ? -1 : 1); }
      }
    }
    for (x = 0; x < L; x++) for (y = top[x]; y < Hh; y++) {
      var dep = y - top[x], bay = BP[((y & 3) << 2) | (x & 3)] - 0.5, tone;
      var band = ((y + o.seed) % 7) === 0 ? -0.8 : 0;
      if (kind[x] === 0) tone = dep < 2 ? 4 : 2.6 + band; else if (kind[x] < 0) tone = dep < 1 ? 4 : 3.1 - dep / Hh * 1.2 + band; else tone = 1.4 - dep / Hh * 0.6 + band;
      tone += bay * 0.8 + (h2(x >> 1, y + o.seed) > 0.95 ? -0.9 : 0);
      d[y * L + x] = o.base + clamp(Math.floor(tone), 0, 4);
    }
    for (y = 0; y < o.fadeRows; y++) { var ry = Hh - 1 - y, amt = 1 - y / o.fadeRows; for (x = 0; x < L; x++) if (d[ry * L + x] && BP[((ry & 3) << 2) | (x & 3)] < amt * 0.92) d[ry * L + x] = o.mist; }
    return st;
  }

  // composes bone sprites into a tileable strip (palette indices). items: [{sp, x, y (top), lut}]; the buried foot fades into haze
  function landStrip(L, Hh, items, base, hazeIdx, fadeRows) {
    var st = Sc.newStrip(L, Hh), i, k, x, y;
    for (i = 0; i < items.length; i++) for (k = -1; k <= 1; k++) {
      var it = items[i], sp = it.sp, x0 = Math.round(it.x) + k * L;
      if (x0 + sp.w < 0 || x0 > L) continue;
      for (y = 0; y < sp.h; y++) { var ty = it.y + y; if (ty < 0 || ty >= Hh) continue; for (x = 0; x < sp.w; x++) { var v = sp.d[y * sp.w + x]; if (!v) continue; var tx = x0 + x; if (tx < 0 || tx >= L) continue; st.d[ty * L + tx] = base + v - 1; } }
    }
    for (y = 0; y < fadeRows; y++) { var ry = Hh - 1 - y, amt = 1 - y / fadeRows; for (x = 0; x < L; x++) if (st.d[ry * L + x] && BP[((ry & 3) << 2) | (x & 3)] < amt * 0.95) st.d[ry * L + x] = hazeIdx; }
    return st;
  }
  // cached bone sprites by kind/size: emboss(mask) -> tones 1..nT
  function boneSprite(kind, W, Hh, seed, nT, bevel, bias) {
    var m;
    if (kind === "comb") m = mComb(W, Hh, seed, Math.max(5, Math.round(W / 26)), (seed & 1) ? 1 : -1);
    else if (kind === "skull") m = mSkull(W, Hh, seed);
    else if (kind === "tusk") m = mTusk(W, Hh, seed, (seed & 1) ? 1 : -1);
    else if (kind === "femur") m = mFemur(W, Hh, seed);
    else if (kind === "spine") m = mSpine(W, Hh, seed, Math.max(4, Math.round(W / 32)));
    return emboss(m, nT, { bevel: kind === "skull" ? Math.max(bevel, Math.round(Hh * 0.15)) : bevel, bias: bias || 0 });
  }
  function nave(W, Hh, seed, n, nT, bevel, bias) {                        // nested arches, far -> near: each nearer arch paints over the one behind
    var arches = mArches(W, Hh, seed, n), out = { w: W, h: Hh, d: new Uint8Array(W * Hh) }, i, k;
    for (i = 0; i < arches.length; i++) {
      var sp = emboss(arches[i].m, nT, { bevel: bevel, bias: bias || 0 });
      for (k = 0; k < sp.d.length; k++) if (sp.d[k]) out.d[k] = sp.d[k];
    }
    return out;
  }

  function buildScene(S) {
    var key = S.w + "x" + S.h + "@" + (S.adj || 1) + "|" + S.horizonY;
    if (ST.built === key) return; ST.built = key; ST.skyKey = "";
    var a = S.adj || 1, hz = S.horizonY, w = S.w, U = clamp(hz / (192 * a), 0.7, 1.35) * a, i, k;               // Chunky keeps on-screen sizes: fewer, bigger pixels
    function Q(v) { return Math.max(2, Math.round(v * U)); }
    ST.U = U;
    ST.mesaF = mesaStrip({ L: 1300, H: Q(30), seed: 11, n: 14, base: I.far, mist: I.far + 1, fadeRows: Q(12) });
    ST.mesaN = mesaStrip({ L: 1150, H: Q(46), seed: 23, n: 10, base: I.mid, mist: I.mid + 1, fadeRows: Q(14) });
    // far skeletons: pale, low contrast (4 tones), the buried foot dissolving into haze
    var F = [], M = [], N = [];
    F.push({ sp: boneSprite("comb", Q(150), Q(58), 5, 4, 3), x: 90, y: 0 }); F.push({ sp: boneSprite("skull", Q(96), Q(58), 3, 4, 3), x: 470, y: 0 });
    F.push({ sp: nave(Q(120), Q(62), 4, 5, 4, 3), x: 800, y: 0 }); F.push({ sp: boneSprite("tusk", Q(34), Q(64), 2, 4, 3), x: 1130, y: 0 }); F.push({ sp: boneSprite("comb", Q(120), Q(50), 8, 4, 3), x: 1240, y: 0 });
    var HF = Q(72); F.forEach(function (it) { it.y = HF - it.sp.h + Q(5); });
    ST.landF = landStrip(1450, HF, F, I.boneF, I.far + 3, Q(20));
    M.push({ sp: boneSprite("skull", Q(170), Q(104), 7, 6, 4, 0.1), x: 60, y: 0 }); M.push({ sp: boneSprite("comb", Q(230), Q(96), 9, 6, 4, 0.1), x: 380, y: 0 });
    M.push({ sp: nave(Q(170), Q(100), 6, 5, 6, 4, 0.1), x: 790, y: 0 }); M.push({ sp: boneSprite("spine", Q(230), Q(52), 5, 6, 4, 0.1), x: 1010, y: 0 });
    var HM = Q(112); M.forEach(function (it, ix) { it.y = HM - it.sp.h + Q(ix === 3 ? 2 : 6); });
    ST.landM = landStrip(1300, HM, M, I.boneM, I.mid + 2, Q(24));
    N.push({ sp: boneSprite("comb", Q(300), Q(132), 12, 8, 5, 0.2), x: 40, y: 0 }); N.push({ sp: boneSprite("skull", Q(190), Q(116), 13, 8, 5, 0.2), x: 470, y: 0 });
    N.push({ sp: nave(Q(200), Q(126), 14, 5, 8, 5, 0.2), x: 760, y: 0 }); N.push({ sp: boneSprite("tusk", Q(48), Q(110), 15, 8, 5, 0.2), x: 1020, y: 0 });
    var HN = Q(140); N.forEach(function (it) { it.y = HN - it.sp.h + Q(8); });
    ST.landN = landStrip(1120, HN, N, I.boneN, I.dust + 2, Q(18));
    // foreground ribs: enormous dark bones sweeping past in front of everything (built once per screen size)
    ST.fg = [];
    var FH = Math.round(S.h * 1.08), FW = Math.round(FH * 0.5), fm;
    fm = newMask(FW, FH); mRib(fm, Math.round(FW * 0.30), FH - 2, FH * 1.02, -Math.PI / 2 + 0.05, 1.5 / (FH * 1.02), Math.max(12, Math.round(FH * 0.075)), 0.9, null);
    ST.fg.push(emboss(fm, 6, { bevel: Math.max(6, Math.round(FH * 0.04)), bias: 0.38, tex: false }));
    fm = newMask(FW, FH); mRib(fm, Math.round(FW * 0.70), FH - 2, FH * 0.95, -Math.PI / 2 - 0.05, -1.4 / (FH * 0.95), Math.max(11, Math.round(FH * 0.065)), 0.9, null);
    ST.fg.push(emboss(fm, 6, { bevel: Math.max(6, Math.round(FH * 0.035)), bias: 0.38, tex: false }));
    fm = newMask(Math.round(FW * 0.9), FH);
    mRib(fm, Math.round(FW * 0.22), FH - 2, FH * 0.9, -Math.PI / 2 + 0.08, 1.35 / (FH * 0.9), Math.max(10, Math.round(FH * 0.06)), 0.9, null);
    mRib(fm, Math.round(FW * 0.55), FH - 2, FH * 0.78, -Math.PI / 2 + 0.05, 1.25 / (FH * 0.78), Math.max(9, Math.round(FH * 0.05)), 0.9, null);
    ST.fg.push(emboss(fm, 6, { bevel: Math.max(5, Math.round(FH * 0.03)), bias: 0.38, tex: false }));
  }


  // ---------- sky ----------
  function geom(S) {
    var G = ST.G, u = zoneU(S.altitude);
    G.hy = S.horizonY + Math.round((1 - S.openingT) * S.h * 0.12);
    G.u = u; G.a = S.adj || 1; G.U = ST.U || 1;
    G.wind = clamp01(0.22 + 0.24 * (0.5 - 0.5 * Math.cos(TAU * u)) + 0.7 * (S.windGust || 0));
    G.haze = 0.5 - 0.5 * Math.cos(TAU * (u + 0.25));
    G.sunY = Math.round(G.hy * (0.46 - 0.10 * Math.sin(TAU * u)) / 3) * 3;
    return G;
  }
  function skyBake(fb, S, G) {
    var w = fb.w, h = fb.h, d = fb.d, hy = G.hy, a = G.a, i, x, y, idx = [];
    for (i = 0; i < 14; i++) idx.push(I.sky + i);
    Sc.bands(fb, 0, hy + 24, idx, 5);
    if (hy + 24 < h) fb.fillRect(0, hy + 24, w, h - hy - 24, I.sky + 13);
    var sx = Math.round(w * 0.20), sy = G.sunY, r = Math.round(clamp(S.h * 0.05, 11, 22) * a);
    ST.sunX = sx; ST.sunY = sy; ST.sunR = r;
    var rings = [[r + 1.5 * a, 1.0, 3], [r + 5 * a, 0.75, 2], [r + 9 * a, 0.5, 2], [r + 14 * a, 0.34, 1], [r + 20 * a, 0.18, 1]], Rm = rings[4][0] + 1;
    for (y = Math.max(0, sy - Rm); y <= Math.min(h - 1, sy + Rm); y++) for (x = Math.max(0, sx - Rm); x <= Math.min(w - 1, sx + Rm); x++) {
      var dx = x + 0.5 - sx, dy = y + 0.5 - sy, dd = Math.sqrt(dx * dx + dy * dy); if (dd <= r) continue;
      var rg = null; for (var q = 0; q < 5; q++) if (dd < rings[q][0]) { rg = rings[q]; break; } if (!rg) continue;
      if (BP[((y & 3) << 2) | (x & 3)] < rg[1]) { var o = y * w + x, v = d[o]; for (var s2 = 0; s2 < rg[2]; s2++) v = LIFT[v]; d[o] = v; }
    }
    for (y = -r; y <= r; y++) for (x = -r; x <= r; x++) {                                    // the bleached disc: three flat tones, a paler rim
      var e = x * x + y * y; if (e > r * r || sy + y < 0 || sy + y >= h) continue;
      d[(sy + y) * w + sx + x] = e < r * r * 0.5 ? I.sun + 3 : (e < r * r * 0.82 ? I.sun + 2 : I.sun + 1);
    }
    var rr = Math.round(r * 3.6);                                                            // a thin 22-degree halo ring in dither
    for (y = -rr - 1; y <= rr + 1; y++) for (x = -rr - 1; x <= rr + 1; x++) {
      var dr = Math.sqrt(x * x + y * y); if (Math.abs(dr - rr) > 0.7 || ((x + y) & 1)) continue;
      var ang = Math.atan2(y, x); if (Math.sin(ang * 5 + 1.3) + Math.sin(ang * 3 - 0.4) < -0.15) continue;             // a broken arc (a perfect 1-px circle read as a construction line)
      var px = sx + x, py = sy + y; if (px < 0 || py < 0 || px >= w || py >= h) continue; d[py * w + px] = LIFT[d[py * w + px]];
    }
  }

  // a rolling dust bank: wavy crest, dithered fringe, a gradient from idxA into idxB
  var MOD = new Int16Array(4096);
  function bank(fb, y0, amp, y1, idxA, idxB, drift, span) {
    var w = fb.w, d = fb.d, x, y;
    for (x = 0; x < w; x++) { var xa = x + drift; MOD[x] = Math.round(amp * (Math.sin(xa * 0.019) * 0.55 + Math.sin(xa * 0.053 + 1.1) * 0.3 + Math.sin(xa * 0.121 + 2.3) * 0.15)); }
    for (y = Math.max(0, y0 - amp - 2); y < Math.min(fb.h, y1); y++) {
      var row = y * w, ob = (y & 3) << 2;
      for (x = 0; x < w; x++) {
        var e = y - (y0 + MOD[x]);
        if (e < -2 || (e === -1 && BP[ob | (x & 3)] > 0.5) || (e === -2 && BP[ob | (x & 3)] > 0.2)) continue;
        var f = e < 0 ? 0 : e / span, c = idxA;
        if (f > 0) { f = f > 1 ? 1 : f; if (BP[ob | (x & 3)] < f * 1.1 - 0.05 + (h2((y >> 3) * 5 + (x >> 4), 3) - 0.5) * 0.25) c = idxB; }
        d[row + x] = c;
      }
    }
  }
  // thin veils drifting across the sky: a dithered lens that lifts (pale cirrus) or darkens (dust smear) what is behind it
  function makeVeil(w, h, seed) {
    var sp = { w: w, h: h, d: new Uint8Array(w * h) }, x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var ex = (x + 0.5 - w / 2) / (w / 2), ey = (y + 0.5 - h / 2) / (h / 2), e = ex * ex + ey * ey * 0.85; if (e >= 1) continue;
      var dens = (1 - e) * (0.8 + 0.2 * Math.sin(x * 0.17 + seed)); if (BP[((y & 3) << 2) | (x & 3)] < dens * 1.35) sp.d[y * w + x] = 1;
    }
    return sp;
  }
  var LIFT2 = new Uint8Array(256), DARK2 = new Uint8Array(256);
  function blitOp(fb, sp, x0, y0, lut) {
    var w = fb.w, h = fb.h, d = fb.d;
    for (var y = 0; y < sp.h; y++) { var ty = y0 + y; if (ty < 0 || ty >= h) continue; for (var x = 0; x < sp.w; x++) { if (!sp.d[y * sp.w + x]) continue; var tx = x0 + x; if (tx < 0 || tx >= w) continue; d[ty * w + tx] = lut[d[ty * w + tx]]; } }
  }
  // a dust devil: a slow funnel, narrow at the foot and flaring upward; hard bands turn around it (ochre body, a paler stripe, a shaded right flank, a lit left edge),
  // its skirt and its top dissolving in ordered dither, motes in orbit
  function devil(fb, cx, baseY, ht, wd, t, seed, lean) {
    var w = fb.w, h = fb.h, d = fb.d, y, x, M = I.mid, F = I.far;
    for (y = 0; y < ht; y++) {
      var f = y / ht, yy = baseY - y; if (yy < 0 || yy >= h) continue;
      var hw = Math.max(1.4, wd * (0.10 + 0.90 * Math.pow(f, 0.9)) * 0.5), xc = cx + Math.sin(f * 4.2 + t * 1.2 + seed) * wd * 0.30 * f + lean * f * f;
      var x0 = Math.round(xc - hw), x1 = Math.round(xc + hw);
      for (x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
        var u = (x - xc) / hw, au = Math.abs(u), th = BP[((yy & 3) << 2) | (x & 3)];
        if (au > 0.8 && th > (1 - au) * 5) continue;
        if (f > 0.72 && th > (1 - f) * 3.6) continue;
        var band = (Math.floor(f * 10 + u * 1.7 - t * 2.4 + seed) & 1) === 0;
        d[yy * w + x] = u < -0.72 ? F + 3 : (u > 0.45 ? M : (band ? M + 2 : M + 1));
      }
    }
    var sx, sk = Math.round(wd * 0.85);
    for (x = -sk; x <= sk; x++) for (y = 0; y < 4; y++) {                                       // the dust skirt at the foot
      var e = (x * x) / (sk * sk) + (y * y) / 10; if (e > 1) continue;
      sx = Math.round(cx + x); var yy2 = baseY + 1 - y; if (sx < 0 || sx >= w || yy2 < 0 || yy2 >= h) continue;
      if (BP[((yy2 & 3) << 2) | (sx & 3)] < (1 - e) * 1.3) d[yy2 * w + sx] = x < -sk * 0.35 ? F + 3 : M + 1;
    }
    var nm = 12, i;
    for (i = 0; i < nm; i++) {                                                                // motes flung around the funnel
      var ph = (t * (0.9 + 0.5 * h1(seed + i)) + h1(i * 3 + seed)) % 1, f2 = 0.08 + 0.85 * ph, an = ph * 18 + i * 2.1, hw2 = Math.max(1.4, wd * (0.10 + 0.90 * Math.pow(f2, 0.9)) * 0.5) * 1.25;
      var mx = Math.round(cx + Math.sin(f2 * 4.2 + t * 1.2 + seed) * wd * 0.30 * f2 + lean * f2 * f2 + Math.cos(an) * hw2), my = Math.round(baseY - f2 * ht);
      if (mx >= 0 && mx < w && my >= 0 && my < h) d[my * w + mx] = I.boneN + 2;
    }
  }

  // ---------- backdrop ----------
  function advance(S) {
    var G = ST.G, W = ST.WS, dt = W.t < 0 || S.reduced ? 0 : clamp(S.tSec - W.t, 0, 0.1); W.t = S.tSec;
    W.cp += (0.6 + 1.4 * G.wind) * dt;
  }
  function veilsInit(S) {
    var a = S.adj || 1, w = S.w, i; ST.veils = [];
    for (i = 0; i < 7; i++) ST.veils.push({ sp: makeVeil(Math.round(clamp(w * (0.30 + 0.45 * h1(i * 19 + 7)), 60, 400) * 1), 3 + Math.round(2 * h1(i * 23 + 9)), i), x: h1(i * 29 + 3) * 1200, y: 0.06 + 0.5 * h1(i * 31 + 5), v: 0.6 + 0.9 * h1(i * 37 + 1), dark: i % 3 === 2 });
  }

  R.backdrop = function (fb, S, pal) {
    buildScene(S);
    var G = geom(S); advance(S);
    var w = fb.w, h = fb.h, hy = G.hy, al = S.altitude, a = G.a, cp = ST.WS.cp, U = G.U, x, y, i, t = S.reduced ? 0 : S.tSec, lipMax = 0;
    for (x = 0; x < w; x++) if (S.lip[x] > lipMax) lipMax = S.lip[x];
    var bot = Math.min(h, lipMax + 4);                                      // the ground covers everything below the lip: the fills need not go deeper
    var skey = w + "x" + h + "|" + hy + "|" + G.sunY;
    if (ST.skyKey !== skey || !ST.sky || ST.sky.length !== w * h) {
      skyBake(fb, S, G);
      if (!ST.sky || ST.sky.length !== w * h) ST.sky = new Uint8Array(w * h);
      ST.sky.set(fb.d); ST.skyKey = skey;
    } else fb.d.set(ST.sky);
    if (!ST.veils) { veilsInit(S); for (i = 0; i < 256; i++) { LIFT2[i] = LIFT[LIFT[i]]; DARK2[i] = DARK[DARK[i]]; } }
    for (i = 0; i < ST.veils.length; i++) {
      var vv = ST.veils[i], vspan = w + vv.sp.w + 60, vx = mod(vv.x - cp * 4 * vv.v - al * 0.05, vspan) - vv.sp.w;
      blitOp(fb, vv.sp, Math.round(vx), Math.round(vv.y * hy), vv.dark ? DARK2 : LIFT2);
    }
    var wallA = Math.max(3, Math.round(6 * U));
    bank(fb, hy - Math.round(20 * U), wallA, hy + 12, I.far + 1, I.far + 2, cp * 1.2, Math.round(26 * U));
    Sc.blitStrip(fb, ST.mesaF, al * 0.04 + cp * 0.2, hy + 4 - ST.mesaF.h);
    Sc.blitStrip(fb, ST.landF, al * 0.06 + 120, hy + 8 - ST.landF.h);
    bank(fb, hy - Math.round(6 * U), wallA, hy + 20, I.far + 3, I.far + 3, cp * 1.6 + 60, 12);
    Sc.blitStrip(fb, ST.mesaN, al * 0.10 + 300, hy + 12 - ST.mesaN.h);
    Sc.blitStrip(fb, ST.landM, al * 0.15 + 260, hy + 16 - ST.landM.h);
    var plainTop = hy + 16, ob;
    for (y = plainTop; y < bot; y++) {                                                        // the far plain: banded dust, drifting ripples, never a flat fill
      var dep = (y - plainTop) / Math.max(1, h - plainTop), row = y * w; ob = (y & 3) << 2;
      for (x = 0; x < w; x++) {
        var tn = 3.4 - 1.6 * Math.min(1, dep * 2.2) + (((y >> 1) + ((x + Math.floor(cp * 3)) >> 5)) % 5 === 0 ? -0.7 : 0) + (BP[ob | (x & 3)] - 0.5) * 0.9;
        fb.d[row + x] = I.dust + clamp(Math.floor(tn), 1, 5);
      }
    }
    var nd = G.wind > 0.5 ? 3 : 2;                                                            // slow dust devils crossing the far plain
    for (i = 0; i < nd; i++) {
      var dspan = w + 240, dx0 = mod(h1(i * 7 + 3) * dspan - cp * (5 + 4 * h1(i * 5 + 1)) - al * 0.06, dspan) - 120;
      devil(fb, Math.round(dx0), hy + Math.round((22 + 14 * h1(i * 11 + 2)) * U), Math.round((56 + 46 * h1(i * 13 + 5)) * U), Math.round((26 + 18 * h1(i * 17 + 7)) * U), t, i * 3.7 + 1, -(2 + 6 * G.wind));
    }
    Sc.blitStrip(fb, ST.landN, al * 0.36 + 500, hy + 26 - ST.landN.h);
    for (y = hy + 26; y < bot; y++) { var rw2 = y * w; ob = (y & 3) << 2; for (x = 0; x < w; x++) fb.d[rw2 + x] = I.dust + 2 + (BP[ob | (x & 3)] < 0.35 ? 1 : 0); }
  };


  // ---------- world-locked bones standing on the crest: sprites cached per camera scale ----------
  var WL = { key: "", sp: null };
  function wlSprites(S) {
    var k = Math.max(0.5, S.zoom * 1.25), key = Math.round(k * 24) + "|" + (S.adj || 1);
    if (WL.key === key && WL.sp) return WL.sp;
    function Q(v) { return Math.max(3, Math.round(v * k)); }
    var sp = {};
    sp.rib1 = emboss((function () { var m = newMask(Q(70), Q(122)); mRib(m, Q(14), Q(122) - 3, Q(118), -Math.PI / 2 + 0.16, 1.55 / Q(118), Math.max(4, Q(13)), 0.9, null); return m; })(), 8, { bevel: Math.max(3, Q(7)), bias: 0.16 });
    sp.rib3 = emboss(mComb(Q(150), Q(112), 41, 4, 1), 8, { bevel: Math.max(3, Q(7)), bias: 0.16 });
    sp.rib3b = emboss(mComb(Q(130), Q(96), 47, 3, -1), 8, { bevel: Math.max(3, Q(6)), bias: 0.16 });
    sp.tusk = emboss(mTusk(Q(66), Q(120), 3, 1), 8, { bevel: Math.max(3, Q(8)), bias: 0.16 });
    sp.femur = emboss(mFemur(Q(64), Q(96), 4), 8, { bevel: Math.max(3, Q(6)), bias: 0.16 });
    sp.skull = emboss(mSkull(Q(120), Q(74), 5), 8, { bevel: Math.max(3, Q(5)), bias: 0.16 });
    sp.spine = emboss(mSpine(Q(150), Q(46), 6, 4), 8, { bevel: Math.max(3, Q(5)), bias: 0.16 });
    sp.bit1 = emboss((function () { var m = newMask(Q(30), Q(14)); mCap(m, Q(3), Q(9), Q(26), Q(6), Math.max(1.6, Q(3)), Math.max(1.6, Q(3.2)), 1); mDisc(m, Q(3), Q(9), Math.max(2, Q(4.2)), 1); mDisc(m, Q(26), Q(6), Math.max(2, Q(4)), 1); return m; })(), 8, { bevel: 2.4, bias: 0.16 });
    sp.bit2 = emboss(mComb(Q(34), Q(20), 9, 2, 1), 8, { bevel: 2.4, bias: 0.16 });
    WL.key = key; WL.sp = sp; return sp;
  }
  function blitU(fb, S, sp, x0, y0, base, flip, margin) {                  // sprite tones -> ramp, only above nothing but the crest is not enforced (props stand on the lip)
    var w = fb.w, h = fb.h, d = fb.d, sw = sp.w, sh = sp.h, sd = sp.d;
    for (var y = 0; y < sh; y++) { var ty = y0 + y; if (ty < 0 || ty >= h) continue; for (var x = 0; x < sw; x++) { var v = sd[y * sw + (flip ? sw - 1 - x : x)]; if (!v) continue; var tx = x0 + x; if (tx < 0 || tx >= w) continue; d[ty * w + tx] = base + v - 1; } }
  }
  // a dead thorn tree: forked, thinning branches, a few dry leaves
  function deadTree(fb, bx, by, ht, seed, lean) {
    var rnd = PX.rng(seed | 0), N = I.boneN;
    function line(x0, y0, x1, y1, c) { var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, g = 0; for (; g < 400; g++) { fb.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; var e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } } }
    function branch(x, y, ang, len, depth) {
      var x1 = Math.round(x + Math.cos(ang) * len), y1 = Math.round(y + Math.sin(ang) * len);
      line(Math.round(x), Math.round(y), x1, y1, depth > 2 ? N + 1 : N);
      if (depth > 2 && len > 4) line(Math.round(x) - 1, Math.round(y), x1 - 1, y1, N + 3);              // rim light on the trunk
      if (depth === 0 || len < 3) { if (rnd() < 0.6) fb.set(x1, y1 - 1, I.grass + 1); return; }
      var nk = depth > 2 ? 2 : 2 + (rnd() < 0.4 ? 1 : 0);
      for (var i = 0; i < nk; i++) branch(x1, y1, ang + (rnd() - 0.5) * 1.5 + (i - (nk - 1) / 2) * 0.55, len * (0.62 + 0.18 * rnd()), depth - 1);
    }
    branch(bx, by, -Math.PI / 2 + lean, ht * 0.42, 4);
  }
  function tuftDry(fb, bx, by, hgt, seed, lean) {
    var G = I.grass, n = 4 + Math.floor(h2(seed, 5) * 4), s, k;
    for (s = 0; s < n; s++) {
      var x0 = bx + (s - (n >> 1)), hh = Math.max(2, Math.round(hgt * (0.5 + 0.5 * h2(seed, s + 7)))), dir = (s - (n - 1) / 2) * 0.32;
      for (k = 0; k < hh; k++) { var f = k / hh, xx = x0 + Math.round((dir - lean) * f * f * 2.6), yy = by - k; fb.set(xx, yy, k >= hh - 1 ? G + 4 : (f > 0.55 ? G + 3 : (f > 0.25 ? G + 2 : G + 1))); }
    }
  }
  function sandRock(fb, cx, base, r, seed) {
    var rw = Math.round(r * (1.2 + 0.5 * h2(seed, 3))), rh = Math.round(r * (0.7 + 0.4 * h2(seed, 4))), x, y, PN = I.pan, DU = I.dust;
    for (y = -rh; y <= 1; y++) for (x = -rw; x <= rw; x++) {
      var ex = x / rw, ey = y / rh, q = ex * ex + ey * ey * (y < 0 ? 1 : 3) + 0.1 * jag(x + seed * 7, 3, seed), px = cx + x, py = base + y; if (q > 1) continue;
      var lit = -(ex * 0.62 + ey * 0.78), tone = lit > 0.6 ? 5 : lit > 0.25 ? 4 : lit > -0.15 ? 3 : lit > -0.55 ? 2 : 1;
      if (q > 0.82 && lit < 0.15) tone = 0;
      fb.set(px, py, y === 1 ? PN : (tone >= 4 ? DU + tone - 1 : PN + tone));
    }
  }
  function groundAbove(fb, S, heroX) {
    var w = fb.w, zoom = S.zoom, lipA = S.lip, G = geom(S), u = G.u, c, cc, i, sp = wlSprites(S), N = I.boneN, k = Math.max(0.5, zoom * 1.25);
    var sway = S.reduced ? 0 : (G.wind * 2.2 + 0.4 * Math.sin(S.tSec * 1.6));
    cc = cellsOf(S, 230, 180);
    for (c = cc[0]; c <= cc[1]; c++) {
      var hv = h2(c, 71); if (hv > 0.62) continue;
      var sx = sxOf(S, c * 230 + (0.1 + 0.8 * h2(c, 73)) * 230); if (sx < -140 || sx > w + 140 || Math.abs(sx - heroX) < 70 * zoom + 34) continue;
      var lp = lipA[clamp(sx, 0, w - 1)] + Math.round(5 * zoom), tw = h2(c, 75), pick;
      var wRib = 0.5 * (1 - sm((u - 0.45) / 0.3)) + 0.2, wSkull = 0.3 * sm((u - 0.2) / 0.3) * (1 - sm((u - 0.75) / 0.2)) + 0.12, wSpine = 0.4 * sm((u - 0.6) / 0.3) + 0.12, wOther = 0.3;
      var tot = wRib + wSkull + wSpine + wOther, q = tw * tot;
      if (q < wRib) { var arr = [sp.rib3, sp.rib1, sp.rib3b]; pick = arr[Math.floor(h2(c, 76) * 3) % 3]; }
      else if (q < wRib + wSkull) pick = sp.skull;
      else if (q < wRib + wSkull + wSpine) pick = sp.spine;
      else pick = h2(c, 77) < 0.5 ? sp.tusk : sp.femur;
      blitU(fb, S, pick, sx - (pick.w >> 1), lp - pick.h + Math.round(4 * k), N, h2(c, 78) > 0.5);
    }
    cc = cellsOf(S, 180, 60);
    for (c = cc[0]; c <= cc[1]; c++) {                                          // dead thorn trees and sandstone rocks
      var tv = h2(c, 171), tsx = sxOf(S, c * 180 + (0.1 + 0.8 * h2(c, 173)) * 180); if (tsx < -40 || tsx > w + 40 || Math.abs(tsx - heroX) < 40 * zoom + 22) continue;
      var tl = lipA[clamp(tsx, 0, w - 1)] + 1;
      if (tv < 0.32) deadTree(fb, tsx, tl, Math.round((44 + 36 * h2(c, 175)) * zoom * 1.25), c * 31 + 5, -0.12 - sway * 0.03);
      else if (tv < 0.62) { var nr = 1 + Math.floor(h2(c, 177) * 3); for (i = 0; i < nr; i++) sandRock(fb, tsx + i * Math.round(8 * zoom * 1.3), lipA[clamp(tsx + i * 8, 0, w - 1)] + 1, Math.max(3, Math.round((5 + 9 * h2(c * 5 + i, 179)) * zoom * 1.3)), c * 7 + i); }
    }
    cc = cellsOf(S, 8, 8);
    var lean = 1.0 + G.wind * 2.6 + (S.reduced ? 0 : 0.5 * Math.sin(S.tSec * 2.1));
    for (c = cc[0]; c <= cc[1]; c++) {
      var dens = 0.10 + 0.34 * vn(c * 8 * 0.012, 2.7, 3); if (h2(c, 191) > dens) continue;
      var gsx = sxOf(S, c * 8 + h2(c, 192) * 8); if (gsx < 1 || gsx >= w - 1) continue;
      var near = Math.abs(gsx - heroX) < 16 + 22 * zoom, hg = Math.max(2, (2.6 + 5.5 * h2(c, 193) * h2(c, 194)) * zoom * 1.4 * (near ? 0.45 : 1));
      tuftDry(fb, gsx, lipA[gsx], hg, c, lean + 0.4 * Math.sin(S.tSec * 1.3 + c));
    }
  }
  function sxOf(S, wx) { return Math.round(S.ztx + (wx - S.scroll) * S.zoom); }
  function cellsOf(S, cw, pad) { var wl = (0 - S.ztx) / S.zoom + S.scroll - pad, wr = (S.w - S.ztx) / S.zoom + S.scroll + pad; return [Math.floor(wl / cw), Math.ceil(wr / cw)]; }

  // ---------- the crest and the dust plane: bone fragments, pebbles, drifting wisps ----------
  function pebbleD(fb, x, y, r, seed) {
    var DU = I.dust, PN = I.pan, i, j;
    if (r <= 1) { fb.set(x, y, DU + 5); fb.set(x + 1, y, DU + 3); fb.set(x, y + 1, PN + 1); return; }
    for (j = -r + 1; j <= 0; j++) for (i = -r; i <= r; i++) {
      var e = (i * i) / (r * r) + (j * j) / ((r * 0.62) * (r * 0.62)); if (e > 1.05) continue;
      var lit = -(i * 0.6 + j * 1.2) / r; fb.set(x + i, y + j, e > 0.75 && lit < 0 ? PN + 1 : (lit > 0.5 ? DU + 6 : lit > 0.1 ? DU + 4 : lit > -0.4 ? DU + 2 : PN + 2));
    }
    for (i = -r + 1; i <= r; i++) fb.set(x + i, y + 1, PN + 1);
  }
  function surfaceStamps(fb, S, heroX, sbPx, t) {
    var sp = wlSprites(S), lipA = S.lip, w = fb.w, zoom = S.zoom, cc, c;
    cc = cellsOf(S, 64, 40);
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 501) > 0.46) continue;
      var sx = sxOf(S, c * 64 + h2(c, 502) * 64); if (sx < -20 || sx > w + 20 || Math.abs(sx - heroX) < 26 * zoom + 12) continue;
      var pick = h2(c, 503) < 0.5 ? sp.bit1 : sp.bit2, y = lipA[clamp(sx, 0, w - 1)] + Math.round((0.2 + 0.68 * h2(c, 504)) * sbPx) - pick.h + 3;
      blitU(fb, S, pick, sx - (pick.w >> 1), y, I.boneN, h2(c, 505) > 0.5);
    }
    cc = cellsOf(S, 26, 8);
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 511) > 0.3) continue;
      var px = sxOf(S, c * 26 + h2(c, 512) * 26); if (px < 1 || px >= w - 2 || Math.abs(px - heroX) < 20 * zoom + 8) continue;
      pebbleD(fb, px, lipA[px] + Math.round((0.12 + 0.82 * h2(c, 513)) * sbPx), 1 + Math.floor(h2(c, 514) * 2.4 * Math.min(1, zoom * 1.5)), c);
    }
  }

  R.light = function (S) {
    geom(S);
    return { x: ST.sunX || Math.round(S.w * 0.2), y: ST.sunY || Math.round(S.h * 0.15), k: 0.34, col: [244, 228, 198], ambient: [176, 152, 122], bright: 0.86, ground: [206, 192, 166] };
  };

  // ---------- ground textures: periodic tiles rendered once per depth-scale ----------
  var TP = 512, TM = TP - 1, TEX = { key: "" }, VO = { n1: 0, n2: 0, d1: 0, d2: 0, dx: 0, dy: 0, ex: 0, ey: 0 };
  function depthZoom(S) { var adj = S.adj || 1, z0 = S.zoom / adj; return adj * (0.2 + 0.73 * z0); }
  function voro(Hh, cw, ch, ky, seed, fn) {
    var ncx = Math.max(2, Math.round(TP / cw)), cwf = TP / ncx, nry = Math.ceil(Hh / ch) + 4, out = new Uint8Array(TP * Hh), fx = new Float32Array(ncx * nry), fy = new Float32Array(ncx * nry), i, j, x, y, ii, jj;
    for (j = 0; j < nry; j++) for (i = 0; i < ncx; i++) { fx[j * ncx + i] = (i + 0.12 + 0.76 * h2(i * 7 + seed, j * 13 + 1)) * cwf; fy[j * ncx + i] = (j - 1 + 0.12 + 0.76 * h2(i * 11 + seed + 5, j * 17 + 3)) * ch; }
    for (y = 0; y < Hh; y++) {
      var cj = Math.floor(y / ch) + 1;
      for (x = 0; x < TP; x++) {
        var ci = Math.floor(x / cwf), d1 = 1e9, d2 = 1e9, n1 = -1, n2 = -1, f1x = 0, f1y = 0, f2x = 0, f2y = 0;
        for (jj = -1; jj <= 1; jj++) {
          var jn = cj + jj;
          for (ii = -1; ii <= 1; ii++) {
            var inn = ci + ii, wo = 0; if (inn < 0) { inn += ncx; wo = -TP; } else if (inn >= ncx) { inn -= ncx; wo = TP; }
            var idx = jn * ncx + inn, px = fx[idx] + wo, py = fy[idx], ddx = x + 0.5 - px, ddy = (y + 0.5 - py) * ky, dd = ddx * ddx + ddy * ddy;
            if (dd < d1) { d2 = d1; n2 = n1; f2x = f1x; f2y = f1y; d1 = dd; n1 = idx; f1x = px; f1y = py; } else if (dd < d2) { d2 = dd; n2 = idx; f2x = px; f2y = py; }
          }
        }
        VO.n1 = n1; VO.n2 = n2; VO.d1 = Math.sqrt(d1); VO.d2 = Math.sqrt(d2); VO.dx = x + 0.5 - f1x; VO.dy = y + 0.5 - f1y; VO.ex = f2x - f1x; VO.ey = (f2y - f1y);
        out[y * TP + x] = fn(x, y, VO);
      }
    }
    return out;
  }
  function lowf(x) { return 0.55 * Math.sin(TAU * 3 * x / TP + 0.7) + 0.45 * Math.sin(TAU * 5 * x / TP + 2.1); }
  function smoothWob(L, seed) { var r = PX.rng(seed), c = [], k; for (k = 0; k < 3; k++) c.push({ f: 2 + Math.floor(r() * 5) + k * 2, ph: r() * TAU, a: 1 / (1 + k * 0.7) }); return function (x) { var s = 0; for (var i = 0; i < 3; i++) s += c[i].a * Math.sin(TAU * c[i].f * x / L + c[i].ph); return s / 2.1; }; }
  function seamLit(V) { var len = Math.sqrt(V.ex * V.ex + V.ey * V.ey) || 1; return -(V.ex * 0.6 + V.ey * 0.8) / len > 0.15; }

  function buildTex(S, zd, sbPx) {
    var DU = I.dust, PN = I.pan, OC = I.ochre, RS = I.rust, MR = I.marl, CL = I.clay, DP = I.deep, AM = I.amber, x, y;
    var T = { zd: zd, sb: sbPx };
    // surface: sun-baked hardpan plates under a skin of pale wind-blown dust; the seams hold darker earth
    T.surfRows = sbPx + 5;
    T.surf = voro(T.surfRows, 30, Math.max(3.4, sbPx / 4.6), 3.6, 3, function (x, y, V) {
      var tt = Math.min(1.2, y / sbPx), lv = 5.7 - 3.0 * Math.pow(tt, 0.8), bay = BP[((y & 3) << 2) | (x & 3)] - 0.5;
      if (y === 0) return (h2(x >> 1, 4) > 0.75) ? DU + 5 : DU + 6;
      if (V.d2 - V.d1 < 1.5) return seamLit(V) ? DU + clamp(Math.round(lv) + 1, 2, 6) : PN + 2;
      var sh = -(V.dx * 0.6 / 15 + V.dy * 0.8 / 3) * 0.5, tone = lv + (h2(V.n1, 7) - 0.5) * 1.5 + clamp(sh, -0.6, 0.6) + bay * 0.9 + 0.75 * lowf(x) * (1 - tt * 0.4);   // soft drifts of paler and darker dust across the plain
      if (((y * 2 + (x >> 3)) % 9) === 0 && tt < 0.75) tone -= 0.9;                                    // wind ripples in the dust
      return DU + clamp(Math.floor(tone), 1, 6);
    });
    // loam: fine pale sediment in laminae with gravel
    T.loamRows = Math.ceil(40 * zd) + 16;
    T.loam = voro(T.loamRows, 9, 5, 1.4, 5, function (x, y, V) {
      var bay = BP[((y & 3) << 2) | (x & 3)] - 0.5, dg = y / T.loamRows;
      if (y === 0) return PN + 3;
      if (V.d2 - V.d1 < 1.1) return seamLit(V) ? DU + 4 : PN + 1;
      var lf = 0.6 * lowf(x + 40); return h2(V.n1, 21) > 0.6 - lf * 0.15 ? PN + clamp(Math.floor(3.2 + lf + (h2(V.n1, 9) - 0.5) * 1.6 - dg * 0.8 + bay * 0.7), 1, 5) : DU + clamp(Math.floor(2.2 + lf + (h2(V.n1, 9) - 0.5) * 1.7 - dg * 0.9 + bay * 0.8), 1, 4);
    });
    // beds: ochre, pale marl, rust and clay; wavy thickness, lit tops, laminae, cross-bedding
    T.bedRows = Math.ceil(90 * zd) + 18;
    T.beds = new Uint8Array(TP * T.bedRows);
    var wob = smoothWob(TP, 31), wob2 = smoothWob(TP, 47);
    for (x = 0; x < TP; x++) {
      var acc = 0, bi = 0, ib, bh, kind, bt;
      while (acc < T.bedRows + 4) {
        bt = h2(bi * 5 + 3, 51); kind = bt < 0.28 ? 0 : (bt < 0.5 ? 1 : (bt < 0.72 ? 2 : (bt < 0.9 ? 3 : 4)));      // ochre, marl, rust, clay, chalk
        bh = Math.max(3, Math.round((6 + 9 * h2(bi, 52) + 3 * wob(x + bi * 53)) * zd * 1.15));
        var tone0 = 2.0 + h2(bi, 53) * 1.4 + 0.5 * wob2(x + bi * 29);
        for (ib = 0; ib < bh; ib++) {
          y = acc + ib; if (y >= T.bedRows) break;
          var bay = BP[((y & 3) << 2) | (x & 3)] - 0.5, idx, base = kind === 0 ? OC : kind === 1 ? MR : kind === 2 ? RS : kind === 3 ? CL : DU, hi = base === RS ? 3 : (base === DU ? 6 : 4);
          if (ib === 0) idx = bi === 0 ? DU + 3 : PN;
          else if (ib === 1) idx = kind === 4 ? DU + 6 : base + Math.min(hi, 4);
          else {
            var lam = (((y + (x >> 2)) & 3) === 0 ? -0.9 : 0.35);
            idx = base + clamp(Math.floor((kind === 4 ? 3.4 : tone0) + (kind === 0 || kind === 3 ? lam : lam * 0.4) - (ib / bh) * 0.8 + bay * 0.6 + (h2(x >> 1, y + bi) > 0.96 ? -1 : 0)), 0, hi);
          }
          T.beds[y * TP + x] = idx;
        }
        acc += bh; bi++;
      }
    }
    // bone bed matrix: packed dark clay with pebbles (the bones themselves are stamped on top)
    T.boneRows = Math.ceil(80 * zd) + 16;
    T.bone = voro(T.boneRows, 10, 7, 1.2, 7, function (x, y, V) {
      var bay = BP[((y & 3) << 2) | (x & 3)] - 0.5;
      if (y === 0) return PN;
      if (V.d2 - V.d1 < 1.2) return seamLit(V) ? CL + 2 : DP + 1;
      return CL + clamp(Math.floor(0.9 + (h2(V.n1, 9) - 0.5) * 2.0 + bay * 0.8 - (y / T.boneRows) * 0.8), 0, 3);
    });
    // deep: black earth in faint strata, the amber glow pooling toward the bottom
    T.deepRows = 96;
    T.deep = new Uint8Array(TP * T.deepRows);
    for (x = 0; x < TP; x++) for (y = 0; y < T.deepRows; y++) {
      var gl = y / T.deepRows, bay2 = BP[((y & 3) << 2) | (x & 3)] - 0.5, lines = ((y + Math.floor(3 * wob(x))) % 9) === 0;
      T.deep[y * TP + x] = (bay2 + 0.5 < gl * 0.05) ? AM + 2 : ((bay2 + 0.5 < gl * 0.32) ? AM + 1 : DP + clamp(Math.floor(1.6 + h2(x >> 1, y >> 1) * 1.4 + (lines ? 0.9 : 0) - gl * 0.6), 0, 4));
    }
    return T;
  }

  var SH = new Int16Array(1024), TOFF = [0, 91, 173, 251, 337];

  R.ground = function (fb, S, pal) {
    var w = fb.w, h = fb.h, d = fb.d, zoom = S.zoom, sc = S.scroll, lipA = S.lip, G = geom(S), t = S.reduced ? 0 : S.tSec, zd = Math.round(depthZoom(S) * 40) / 40, x, y, o;
    var heroX = Math.round(S.ztx + S.anchorX * zoom), slopeK = clamp(S.slope, 0, 0.7), qoff = Math.round(sc * zoom - S.ztx);
    var sbPx = Math.max(10, Math.round(34 * zd)); ST.sbPx = sbPx;
    var key = zd + "|" + sbPx, now = root.performance ? root.performance.now() : 0;
    if (TEX.key !== key || !TEX.t) {
      if (!TEX.t || Math.abs(zd - TEX.t.zd) > 0.14 || now - TEX.tb > 380) { TEX.t = buildTex(S, zd, sbPx); TEX.key = key; TEX.tb = now; }
    }
    var T = TEX.t;
    if (!ST.B3 || ST.B3.length !== w) { ST.B3 = new Int16Array(w); ST.B4 = new Int16Array(w); }
    groundAbove(fb, S, heroX);
    var minLip = 0; for (x = 0; x < w; x++) if (lipA[x] < minLip) minLip = lipA[x];
    if (SH.length < h - minLip + 16) SH = new Int16Array(h - minLip + 64);
    for (y = 0; y < SH.length; y++) SH[y] = Math.round(y * slopeK * 0.85);
    for (x = 0; x < w; x++) {
      var lip = lipA[x]; if (lip >= h) continue;
      var wxF = (x - S.ztx) / zoom + sc, qx = x + qoff, sw1 = Math.sin(wxF * 0.017 + 1.3), sw2 = Math.sin(wxF * 0.011 + 4.0);
      var b1 = sbPx + ((h2(qx >> 1, 77) > 0.7) ? 1 : 0);
      var b2 = Math.max(b1 + 4, Math.round((72 + 2 * sw1 + 5 * jag(wxF, 23, 11)) * zd));
      var b3 = Math.max(b2 + 8, Math.round((160 + 3 * sw2 + 7 * jag(wxF, 31, 12)) * zd));
      var b4 = Math.max(b3 + 8, Math.round((250 + 3 * sw1 + 8 * jag(wxF, 19, 13)) * zd));
      ST.B3[x] = b3; ST.B4[x] = b4;
      var y0 = Math.max(0, lip); o = y0 * w + x;
      for (y = y0; y < h; y++, o += w) {
        var dd = y - lip, r, sx;
        if (dd < b1) { r = dd < T.surfRows ? dd : T.surfRows - 1; sx = (qx - SH[dd]) & TM; d[o] = T.surf[r * TP + sx]; }
        else if (dd < b2) { r = dd - b1; if (r >= T.loamRows) r = T.loamRows - 1; sx = (qx + TOFF[1] - SH[dd]) & TM; d[o] = T.loam[r * TP + sx]; }
        else if (dd < b3) { r = dd - b2; if (r >= T.bedRows) r = T.bedRows - 1; sx = (qx + TOFF[2] - SH[dd]) & TM; d[o] = T.beds[r * TP + sx]; }
        else if (dd < b4) { r = dd - b3; if (r >= T.boneRows) r = T.boneRows - 1; sx = (qx + TOFF[3] - SH[dd]) & TM; d[o] = T.bone[r * TP + sx]; }
        else { r = dd - b4; if (r >= T.deepRows) r = T.deepRows - 1 - ((r - T.deepRows) % 20); sx = (qx + TOFF[4] - SH[dd]) & TM; d[o] = T.deep[r * TP + sx]; }
      }
    }
    surfaceStamps(fb, S, heroX, sbPx, t);
    deepStamps(fb, S, zd, sbPx, t);
  };

  // ---------- fossils: bone sprites cached per depth scale, stamped into the rock ----------
  var FS = { key: "", sp: null };
  function mLong(W, Hh, ang, len, r) {                                     // a long bone at an angle: shaft + a double knob at each end
    var m = newMask(W, Hh), cx = W / 2, cy = Hh / 2, dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
    mCap(m, cx - dx, cy - dy, cx + dx, cy + dy, r * 0.8, r * 0.7, 1);
    mDisc(m, cx - dx, cy - dy, r * 1.5, 1); mDisc(m, cx - dx + Math.sin(ang) * r * 1.1, cy - dy - Math.cos(ang) * r * 1.1, r * 1.2, 1);
    mDisc(m, cx + dx, cy + dy, r * 1.5, 1); mDisc(m, cx + dx - Math.sin(ang) * r * 1.1, cy + dy + Math.cos(ang) * r * 1.1, r * 1.2, 1);
    return m;
  }
  function mAmmonite(Rr, seed) {
    var W = Rr * 2 + 4, m = newMask(W, W), cx = W / 2, cy = W / 2, th;
    mDisc(m, cx, cy, Rr, 1);
    var b = Math.log(Rr / 1.2) / (3.6 * Math.PI);
    for (th = 0; th < 3.6 * Math.PI; th += 0.07) { var rr = 1.2 * Math.exp(b * th), x = cx + Math.cos(th + seed) * rr * 0.98, y = cy + Math.sin(th + seed) * rr * 0.98; mDisc(m, x, y, 0.55, 0); }   // the coiled groove
    mDisc(m, cx, cy, 1.4, 0);
    return m;
  }
  function fossils(zd) {
    var key = Math.round(zd * 40), now = root.performance ? root.performance.now() : 0; if (FS.key === key && FS.sp) return FS.sp;
    if (FS.sp && Math.abs(zd - FS.zd) <= 0.14 && now - FS.tb <= 380) return FS.sp;
    function Q(v) { return Math.max(3, Math.round(v * zd * 1.15)); }
    var sp = {}, nT = 6, bv = Math.max(2.5, Q(5)), o = { bevel: bv, bias: 0.03 }, i;
    function arc(seed, dir, len, wd) { var m = newMask(Q(len * 0.8), Q(len * 0.62)); mRib(m, dir > 0 ? Q(4) : m.w - Q(4), m.h - 3, Q(len), -1.25 * dir - (dir < 0 ? Math.PI : 0) + (dir < 0 ? 0 : 0), dir * 2.3 / Q(len), Math.max(4, Q(wd)), 0.8, null); return emboss(m, nT, o); }
    sp.arcA = arc(1, 1, 120, 11); sp.arcB = arc(2, -1, 100, 9); sp.arcC = arc(3, 1, 80, 8);
    sp.vert = emboss((function () { var m = newMask(Math.max(Q(190), 118), Math.max(Q(64), 42)); var vs = Math.max(Q(90), 56); for (i = 0; i < 3; i++) mVert(m, vs * 0.55 + i * vs * 0.62, vs * 0.42, vs, (i - 1) * 0.3, 0.35); return m; })(), nT, o);
    sp.femA = emboss(mLong(Q(96), Q(50), -0.35, Q(78), Q(4.6)), nT, o); sp.femB = emboss(mLong(Q(96), Q(50), 0.30, Q(78), Q(4.6)), nT, o); sp.femC = emboss(mLong(Q(80), Q(64), -1.05, Q(58), Q(4)), nT, o); sp.femD = emboss(mLong(Q(90), Q(30), 0.05, Q(74), Q(4)), nT, o);
    var skm = mSkull(Q(104), Q(64), 7); sp.skull = emboss(skm, nT, o); sp.skullEyes = [[0.505 * skm.w, 0.37 * skm.h, 0.105 * skm.w * 0.6, 0.135 * skm.h * 0.6], [0.74 * skm.w, 0.42 * skm.h, 0.085 * skm.w * 0.5, 0.075 * skm.h * 0.5]];
    var sk2 = mSkull(Q(72), Q(44), 9); sp.skullS = emboss(sk2, nT, o); sp.skullSEyes = [[0.505 * sk2.w, 0.37 * sk2.h, 0.105 * sk2.w * 0.6, 0.135 * sk2.h * 0.6]];
    sp.ammo = emboss(mAmmonite(Math.max(5, Q(15)), 0.4), nT, { bevel: Math.max(2, Q(3.2)), bias: 0.05 }); sp.ammoS = emboss(mAmmonite(Math.max(4, Q(9)), 2.0), nT, { bevel: 2.2, bias: 0.05 });
    sp.tooth = emboss((function () { var m = newMask(Q(34), Q(46)); mRib(m, Q(10), Q(44), Q(52), -Math.PI / 2 + 0.1, 1.1 / Q(52), Math.max(3.4, Q(9)), 0.92, null); return m; })(), nT, { bevel: Math.max(2.4, Q(4)), bias: 0.03 });
    sp.jaw = emboss((function () { var m = newMask(Q(110), Q(46)); mRib(m, Q(6), Q(38), Q(104), -0.55, 0.9 / Q(104), Math.max(4, Q(11)), 0.5, null); for (i = 0; i < 6; i++) { var tx = Q(16) + i * Q(14), ty = Q(26) - i * Q(2.4); mPoly(m, [[tx, ty], [tx + Q(8), ty], [tx + Q(4), ty - Q(13)]]); } return m; })(), nT, o);
    FS.key = key; FS.sp = sp; FS.zd = zd; FS.tb = now; return sp;
  }
  function blitFossil(fb, S, sp, x0, y0, base, flip, margin, minB, fade) {         // only below the crest (and, for the bone bed, below the beds), so nothing pokes out of its layer
    var w = fb.w, h = fb.h, d = fb.d, sw = sp.w, sh = sp.h, sd = sp.d, lip = S.lip;
    for (var y = 0; y < sh; y++) { var ty = y0 + y; if (ty < 0 || ty >= h) continue; for (var x = 0; x < sw; x++) { var v = sd[y * sw + (flip ? sw - 1 - x : x)]; if (!v) continue; var tx = x0 + x; if (tx < 0 || tx >= w || ty < lip[tx] + margin || (minB && ty < lip[tx] + minB[tx])) continue; var tn = v - 1; if (fade) { var fr = (ty - lip[tx] - (minB ? minB[tx] : 0)) / fade; if (fr > 0 && BP[((ty & 3) << 2) | (tx & 3)] < (fr > 1 ? 1 : fr) * 0.85 && tn > 0) tn--; } d[ty * w + tx] = base + tn; } }
  }
  // relics: '.' empty; g/h/d gold body/light/dark, c/e/f clay, i/j iron, a amber gem, k ink
  var RELICS = [
    [".h..h..h..h.", ".gk.gk.gk.gk", ".ggggaggggk.", ".gddgddgddgk", ".gggggggggk.", "..kkkkkkkk.."],                                       // a crown
    ["..kkk.", "..kfk.", "..kck.", ".kcccek", "kcfcccek", "kcccceek", "kcccceek", ".kcceek.", "..kkkk.."],                                     // a jug
    ["..k..", ".kik.", ".kjk.", ".kik.", ".kjk.", ".kik.", ".kjk.", ".kik.", "kkjkk", ".kgk.", ".kdk.", "..k.."],                            // a dagger
    ["..kkkkk..", ".kjjjjjk.", "kjjiiijjk", "kjihhhijk", "kjihahijk", "kjihhhijk", "kjjiiijjk", ".kjjjjjk.", "..kkkkk.."]                     // a shield boss
  ];
  function drawRelic(fb, S, k, x, y, flip) {
    var r = RELICS[k], M = { g: I.ochre + 3, h: I.ochre + 4, d: I.ochre + 1, c: I.clay + 3, e: I.clay + 2, f: I.clay + 4, i: I.rust + 1, j: I.rust + 2, a: I.amber + 3, k: I.deep + 1 };
    for (var yy = 0; yy < r.length; yy++) for (var xx = 0; xx < r[yy].length; xx++) {
      var ch = r[yy].charAt(flip ? r[yy].length - 1 - xx : xx); if (ch === ".") continue;
      putU(fb, S, x + xx, y + yy, M[ch], 5);
    }
  }
  function putU(fb, S, x, y, idx, m) { if (x < 0 || x >= fb.w || y < 0 || y >= fb.h) return; if (y < S.lip[x] + (m == null ? 3 : m)) return; fb.d[y * fb.w + x] = idx; }
  function deepStamps(fb, S, zd, sbPx, t) {
    var w = fb.w, h = fb.h, zoom = S.zoom, lipA = S.lip, c, cc, k, x, y, FSP = fossils(zd), BM = I.boneM, AM = I.amber, DP = I.deep;
    var breathe = S.reduced ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.3);
    function at(wx, du, marginX) { var sx = sxOf(S, wx); if (sx < -marginX || sx > w + marginX) return null; return { x: sx, y: Math.round(lipA[clamp(sx, 0, w - 1)] + du * zd) }; }
    // embedded stones and the relics of the ones who came before: a crown, a jug, a dagger, a shield boss
    cc = cellsOf(S, 200, 60);
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 441) > 0.34) continue;
      var bs = at(c * 200 + h2(c, 442) * 200, 88 + 64 * h2(c, 443), 40); if (!bs || bs.y > h + 14 || bs.y < -14) continue;
      var br = Math.max(3, Math.round((5 + 6 * h2(c, 444)) * zd * 1.2)), bw = Math.round(br * 1.3);
      for (y = -br; y <= br; y++) for (x = -bw; x <= bw; x++) {
        var ex = x / 1.3, d2 = ex * ex + y * y; if (d2 > br * br + 0.3 * jag(x + c * 7, 3, c) * br) continue;
        var lit = -(ex * 0.65 + y * 0.75) / br, tone = lit > 0.55 ? 5 : lit > 0.15 ? 4 : lit > -0.35 ? 3 : 2;
        if (d2 > (br - 1) * (br - 1) && lit < 0.2) tone = 0;
        putU(fb, S, bs.x + x, bs.y + y, tone >= 4 ? I.dust + tone - 1 : I.pan + tone + 1, 4);
      }
    }
    cc = cellsOf(S, 330, 30);
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 451) > 0.55) continue;
      var rl = at(c * 330 + h2(c, 452) * 330, 90 + 60 * h2(c, 453), 30); if (!rl || rl.y > h + 8 || rl.y < -14) continue;
      drawRelic(fb, S, Math.floor(h2(c, 454) * RELICS.length) % RELICS.length, rl.x, rl.y, h2(c, 455) > 0.5);
    }
    // fossils in the beds: great ribs cut in section, vertebrae, ammonites, long bones
    cc = cellsOf(S, 180, 90);
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 401) > 0.62) continue;
      var p = at(c * 180 + h2(c, 402) * 180, 78 + 70 * h2(c, 403), 90); if (!p || p.y > h + 60) continue;
      var kind = Math.floor(h2(c, 404) * 8), pick = [FSP.arcA, FSP.arcB, FSP.arcC, FSP.ammo, FSP.ammo, FSP.femA, FSP.femB, FSP.ammoS][kind];
      blitFossil(fb, S, pick, p.x - (pick.w >> 1), p.y - (pick.h >> 1), BM, h2(c, 405) > 0.5, 4);
    }
    // the bone bed: a packed jumble (dense cells, deterministic overlap); skulls watch from the darker earth with amber eyes
    var cw = 44, ch = 36;
    cc = cellsOf(S, cw, 60);
    for (c = cc[0]; c <= cc[1]; c++) for (k = 0; k < 6; k++) {
      var hv = h2(c * 7 + k, 411); if (hv > 0.55) continue;
      var pp = at(c * cw + h2(c, k + 412) * cw, 168 + k * ch + h2(c, k + 413) * ch, 60); if (!pp || pp.y > h + 40 || pp.y < -40) continue;
      var kd = h2(c, k + 414), sp2, eyes = null;
      if (kd < 0.36) sp2 = [FSP.femA, FSP.femB, FSP.femC, FSP.femD][Math.floor(h2(c, k + 415) * 4)];
      else if (kd < 0.41) sp2 = FSP.tooth; else if (kd < 0.58) sp2 = FSP.jaw; else if (kd < 0.74) sp2 = [FSP.arcC, FSP.arcB][Math.floor(h2(c, k + 416) * 2)];
      else if (kd < 0.80) sp2 = FSP.vert; else if (kd < 0.92) sp2 = FSP.ammoS; else { sp2 = k >= 2 ? FSP.skull : FSP.skullS; eyes = k >= 2 ? FSP.skullEyes : FSP.skullSEyes; }
      var fl = h2(c, k + 417) > 0.5, x0 = pp.x - (sp2.w >> 1), y0 = pp.y - (sp2.h >> 1);
      blitFossil(fb, S, sp2, x0, y0, BM, fl, 2, ST.B3, Math.round(140 * zd));                                  // the deeper, the more the bones sink into shadow (an ordered dither, one tone)
      if (eyes) for (var e = 0; e < eyes.length; e++) {                             // the eyes of the dead: two amber embers that pulse
        var ex = Math.round(fl ? sp2.w - 1 - eyes[e][0] : eyes[e][0]) + x0, ey = Math.round(eyes[e][1]) + y0, er = Math.max(1, Math.round(Math.min(eyes[e][2], eyes[e][3])));
        if (ex < 0 || ex >= w || ey < lipA[ex] + ST.B3[ex]) continue;
        var pulse = clamp01(0.55 + 0.45 * Math.sin(t * 1.7 + c * 2.3 + e));
        for (var yy = -er; yy <= er; yy++) for (var xx = -er; xx <= er; xx++) { if (xx * xx + yy * yy > er * er + 0.5) continue; putU(fb, S, ex + xx, ey + yy, DP + 1, 2); }
        putU(fb, S, ex, ey, AM + (pulse > 0.55 ? 4 : 3), 2); if (er > 1) { putU(fb, S, ex - 1, ey, AM + 2, 2); putU(fb, S, ex + 1, ey, AM + 2, 2); }
      }
    }
    // the deep: great skulls with embers for eyes, pools of amber light, veins running through the dark
    cc = cellsOf(S, 150, 90);
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 431) > 0.5) continue;
      var sk = at(c * 150 + h2(c, 432) * 150, 285 + 170 * h2(c, 433), 90); if (!sk || sk.y > h + 40 || sk.y < -40) continue;
      var big = h2(c, 434) > 0.45, spk = big ? FSP.skull : FSP.skullS, eyes2 = big ? FSP.skullEyes : FSP.skullSEyes, fl2 = h2(c, 435) > 0.5, xs = sk.x - (spk.w >> 1), ys = sk.y - (spk.h >> 1);
      for (y = -6; y <= spk.h + 6; y++) for (x = -8; x <= spk.w + 8; x++) {                    // a halo of ember light around it
        var hx = xs + x, hy2 = ys + y; if (hx < 0 || hx >= w || hy2 < 0 || hy2 >= h || hy2 < lipA[hx] + ST.B4[hx]) continue;
        var dxh = (x - spk.w / 2) / (spk.w * 0.75), dyh = (y - spk.h / 2) / (spk.h * 0.9), qh = 1 - Math.sqrt(dxh * dxh + dyh * dyh); if (qh <= 0) continue;
        if (BP[((hy2 & 3) << 2) | (hx & 3)] < qh * 0.6) { var vh = fb.d[hy2 * w + hx]; if (vh >= DP && vh <= DP + 4) fb.d[hy2 * w + hx] = AM + (qh > 0.55 ? 1 : 0); }
      }
      blitFossil(fb, S, spk, xs, ys, BM, fl2, 2, ST.B4, Math.round(60 * zd));
      for (var e2 = 0; e2 < eyes2.length; e2++) {
        var ex2 = Math.round(fl2 ? spk.w - 1 - eyes2[e2][0] : eyes2[e2][0]) + xs, ey2 = Math.round(eyes2[e2][1]) + ys, er2 = Math.max(1, Math.round(Math.min(eyes2[e2][2], eyes2[e2][3])));
        if (ex2 < 0 || ex2 >= w || ey2 < lipA[ex2] + ST.B4[ex2]) continue;
        var pu = clamp01(0.55 + 0.45 * Math.sin(t * 1.5 + c * 1.9 + e2));
        for (var yy2 = -er2; yy2 <= er2; yy2++) for (var xx2 = -er2; xx2 <= er2; xx2++) if (xx2 * xx2 + yy2 * yy2 <= er2 * er2 + 0.5) putU(fb, S, ex2 + xx2, ey2 + yy2, AM + (pu > 0.5 ? 3 : 2), 2);
        putU(fb, S, ex2, ey2, AM + 4, 2);
      }
    }
    if (!S.reduced) {                                                            // embers drifting up out of the deep, flickering with the palette
      cc = cellsOf(S, 44, 10);
      for (c = cc[0]; c <= cc[1]; c++) for (k = 0; k < 6; k++) {
        var eh = h2(c * 5 + k, 461); if (eh < 0.6) continue;
        var edu = 262 + k * 44 + h2(c, k + 462) * 44 - ((t * (3 + eh * 5)) % 44), ewx = c * 44 + h2(c, k + 463) * 44 + Math.sin(t * 0.6 + c + k) * 2, esx = sxOf(S, ewx);
        if (esx < 0 || esx >= w) continue;
        var esy = Math.round(lipA[esx] + edu * zd); if (esy < 0 || esy >= h || esy < lipA[esx] + ST.B4[esx] + 2) continue;
        putU(fb, S, esx, esy, AM + 2 + (Math.floor(eh * 300) % 2), 4);
      }
    }
    cc = cellsOf(S, 170, 120);
    for (c = cc[0]; c <= cc[1]; c++) {
      if (h2(c, 421) > 0.6) continue;
      var v = at(c * 170 + h2(c, 422) * 170, 268 + 200 * h2(c, 423), 100); if (!v || v.y > h + 20) continue;
      var vl = Math.round((44 + 70 * h2(c, 424)) * Math.max(0.6, zd)), vx = v.x, vy = v.y, vd = h2(c, 425) < 0.5 ? -1 : 1, rnd = PX.rng(c * 19 + 3);
      for (k = 0; k < vl; k++) {
        vx += vd * (rnd() < 0.65 ? 1 : 0); if (rnd() < 0.5) vy += 1; if (rnd() < 0.1) vx -= vd;
        var hot = !S.reduced && ((k + Math.floor(t * 7)) % 15) === 0;
        putU(fb, S, vx, vy - 1, AM, 0); putU(fb, S, vx, vy + 1, AM, 0); putU(fb, S, vx, vy, hot ? AM + 4 : (k & 1 ? AM + 3 : AM + 2), 0);
      }
    }
  }

  // ---------- palette animation: the haze thickens and thins over the zone; the amber in the deep breathes ----------
  var HZC = [226, 208, 172];
  R.palette = function (pal, S) {
    var G = geom(S), haze = G.haze, breathe = S.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(S.tSec * 1.1), key = Math.round(haze * 10) + "|" + Math.round(breathe * 8);
    if (key === ST.palKey) return; ST.palKey = key;
    var K = { sky: 0.10, far: 0.14, mid: 0.10, boneF: 0.14, boneM: 0.06 }, nm, j, out;
    for (nm in K) { out = []; for (j = 0; j < BASE[nm].length; j++) { var c = BASE[nm][j]; out.push(mix3(c, HZC, K[nm] * haze * (0.5 + 0.5 * j / (BASE[nm].length - 1)))); } pal.setRamp(nm, out); }
    out = []; var kb = 0.78 + 0.22 * breathe;
    for (j = 0; j < BASE.amber.length; j++) { var a = BASE.amber[j], kj = j >= 3 ? kb : 0.9 + 0.1 * breathe; out.push([a[0] * kj, a[1] * kj, a[2] * kj]); }
    pal.setRamp("amber", out);
  };

  // ---------- front: dust motes and wind-lifted wisps racing along the crest ----------
  R.front = function (fb, S, pal, res) {
    var G = geom(S), w = fb.w, h = fb.h, d = fb.d, lip = S.lip, t = S.reduced ? 0 : S.tSec, cp = ST.WS.cp, a = G.a, i, x, k;
    if (S.altitude > 40 && ST.fg) {                                                          // giant ribs sweeping past in front, dithered clear around the hero and his stone
      var zoom = S.zoom, fs = S.scroll * 1.5, cell = 2100, k0 = Math.floor(((0 - S.ztx) / zoom + fs) / cell) - 1, k1 = Math.ceil(((w - S.ztx) / zoom + fs) / cell) + 1;
      var heroX = Math.round(S.ztx + S.anchorX * zoom), heroY = lip[clamp(heroX, 0, w - 1)], sxw = S.stoneX || 40, srr = S.stoneR || 30;
      var hero = { x: Math.round(S.ztx + (S.anchorX + sxw * 0.5) * zoom), y: heroY - Math.round(srr * zoom), rx: (sxw * 0.5 + srr + 40) * zoom + 14, ry: (srr + 34) * zoom + 14 };
      for (k = k0; k <= k1; k++) {
        if (h1(k * 9 + 4) < 0.5) continue;
        var fx = k * cell + 250 + h1(k * 3 + 2) * 1100, sxp = Math.round(S.ztx + (fx - fs) * zoom), sp = ST.fg[Math.floor(h1(k * 5 + 7) * ST.fg.length) % ST.fg.length];
        if (sxp < -sp.w || sxp > w + 10) continue;
        var flip = h1(k * 11 + 1) > 0.5, y0 = h - sp.h + Math.round(14 * a * (0.5 + h1(k * 13 + 3)));
        for (var yy = 0; yy < sp.h; yy++) {
          var ty = y0 + yy; if (ty < 0 || ty >= h) continue;
          for (var xx = 0; xx < sp.w; xx++) {
            var v = sp.d[yy * sp.w + (flip ? sp.w - 1 - xx : xx)]; if (!v) continue;
            var tx = sxp + xx; if (tx < 0 || tx >= w) continue;
            var ex = (tx - hero.x) / hero.rx, ey = (ty - hero.y) / hero.ry, dist = Math.sqrt(ex * ex + ey * ey);
            if (dist < 1.3) { if (dist < 0.62) continue; if (BP[((ty & 3) << 2) | (tx & 3)] > (dist - 0.62) / 0.68) continue; }
            d[ty * w + tx] = I.boneN + v - 1;
          }
        }
      }
    }
    var nm = Math.round(16 * w / 480);
    for (i = 0; i < nm; i++) {                                                                // motes hanging in the air
      var span = w + 60, mx = mod(h1(i * 7 + 1) * span - cp * (6 + 8 * h1(i)) * a - S.scroll * S.zoom * 0.05, span) - 30;
      var my = (h1(i * 11 + 3) * 0.55 + 0.1) * h + Math.sin(t * (0.6 + h1(i * 3) * 0.6) + i * 2.1) * 4, px = Math.round(mx), py = Math.round(my);
      if (px < 0 || px >= w || py < 0 || py >= h) continue;
      var o = py * w + px, v = d[o]; d[o] = LUM[v] > 0.55 ? DARK[v] : LIFT[LIFT[v]];
    }
    var ns = Math.round((5 + 26 * G.wind) * w / 480);
    for (i = 0; i < ns; i++) {                                                                // wisps of dust lifted off the crest by the wind
      var sp = 60 + 90 * h1(i * 13 + 5), cyc = t * sp / (w + 80) + h1(i * 17 + 2), cy = Math.floor(cyc), ph = cyc - cy;
      var sx0 = Math.round(w + 40 - ph * (w + 80)), len = 5 + Math.round(16 * h2(i, cy)), lift = 1 + Math.round(h2(i * 5, cy + 3) * 6 * (0.5 + G.wind));
      for (k = 0; k < len; k++) {
        var xx = sx0 + k; if (xx < 0 || xx >= w) continue;
        var yy = lip[xx] - lift + (k & 3 ? 0 : 1); if (yy < 0 || yy >= h || (k > len * 0.55 && ((xx + yy) & 1))) continue;
        var oo = yy * w + xx, vv = d[oo]; d[oo] = LUM[vv] > 0.6 ? DARK[vv] : LIFT[vv];
      }
    }
  };

  V8.register("bones", R);
})(typeof window !== "undefined" ? window : this);
