// V8 pixel toolkit. Everything the new renderers draw goes through here so the whole
// game shares ONE grid (integer pixels only), ONE way to shade (palette ramps + ordered
// dither) and ONE deterministic random source (integer hashes, identical on every device).
//
// Sprites are INDEXED: each pixel holds a small "slot" number (0 = transparent). The colour of a
// slot is chosen at draw time from the current palette, so a cached sprite can be re-lit for any
// realm / time of day without being re-rasterised.
(function (root) {
  "use strict";
  var PX = {};

  // ---------- small math ----------
  PX.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  PX.clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  PX.lerp = function (a, b, t) { return a + (b - a) * t; };
  PX.smooth01 = function (t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  PX.hex = function (h) {
    if (h.charAt(0) === "#") h = h.slice(1);
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  PX.mix = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  PX.round3 = function (c) { return [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]; };
  PX.css = function (c, a) { return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + (a == null ? 1 : a) + ")"; };
  PX.lum = function (c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; };

  // ---------- deterministic hashing (integer, so iPhone == desktop) ----------
  PX.ihash = function (x, y, z) {
    var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };
  PX.h1 = function (n) { return PX.ihash(n | 0, 0x9e37, 0x79b9); };
  PX.h2 = function (x, y) { return PX.ihash(x | 0, y | 0, 0x1b56); };
  PX.h3 = PX.ihash;
  // seeded stream (mulberry32) for one-off procedural generation
  PX.rng = function (seed) {
    var a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // ---------- ordered dither ----------
  PX.BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(function (r) { return r.map(function (v) { return (v + 0.5) / 16 - 0.5; }); });
  var B8 = [], i, j;
  (function () {
    var m = [[0]];
    while (m.length < 8) {
      var n = m.length, out = [];
      for (i = 0; i < n * 2; i++) { out.push([]); for (j = 0; j < n * 2; j++) out[i].push(0); }
      for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
        var v = m[i][j] * 4;
        out[i][j] = v; out[i][j + n] = v + 2; out[i + n][j] = v + 3; out[i + n][j + n] = v + 1;
      }
      m = out;
    }
    for (i = 0; i < 8; i++) { B8.push([]); for (j = 0; j < 8; j++) B8[i].push((m[i][j] + 0.5) / 64 - 0.5); }
  })();
  PX.BAYER8 = B8;
  // threshold in [-0.5, 0.5) for pixel (x, y)
  PX.bayer = function (x, y) { return PX.BAYER4[y & 3][x & 3]; };

  // ---------- 3D cellular noise from a periodic feature table (fast, deterministic) ----------
  var GRID = 16, FEAT = new Float32Array(GRID * GRID * GRID * 3);
  (function () {
    for (var z = 0; z < GRID; z++) for (var y = 0; y < GRID; y++) for (var x = 0; x < GRID; x++) {
      var o = ((z * GRID + y) * GRID + x) * 3;
      FEAT[o] = PX.ihash(x, y, z + 101); FEAT[o + 1] = PX.ihash(x + 17, y, z + 202); FEAT[o + 2] = PX.ihash(x, y + 31, z + 303);
    }
  })();
  var W_OUT = { d1: 0, d2: 0, id: 0 };
  // returns shared object {d1,d2,id}: distance to nearest / 2nd-nearest feature point and the nearest cell's id
  PX.worley = function (x, y, z) {
    var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), d1 = 9, d2 = 9, id = 0;
    for (var dz = -1; dz <= 1; dz++) for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var cx = ix + dx, cy = iy + dy, cz = iz + dz;
      var o = (((cz & 15) * GRID + (cy & 15)) * GRID + (cx & 15)) * 3;
      var ex = cx + FEAT[o] - x, ey = cy + FEAT[o + 1] - y, ez = cz + FEAT[o + 2] - z, d = ex * ex + ey * ey + ez * ez;
      if (d < d1) { d2 = d1; d1 = d; id = ((cz & 15) * GRID + (cy & 15)) * GRID + (cx & 15); } else if (d < d2) d2 = d;
    }
    W_OUT.d1 = Math.sqrt(d1); W_OUT.d2 = Math.sqrt(d2); W_OUT.id = id;
    return W_OUT;
  };
  // smooth value noise in [0,1)
  PX.vnoise = function (x, y, z) {
    var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    function L(a, b, t) { return a + (b - a) * t; }
    var h = PX.ihash;
    return L(L(L(h(ix, iy, iz), h(ix + 1, iy, iz), fx), L(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), fx), fy),
             L(L(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), fx), L(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), fx), fy), fz);
  };

  // ---------- indexed sprite ----------
  // (ox, oy) = the screen coordinate of the sprite's top-left pixel. All drawing calls take SCREEN coords.
  function Sprite(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); this.ox = 0; this.oy = 0; }
  Sprite.prototype.reset = function (w, h, ox, oy) {
    if (this.w !== w || this.h !== h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); } else this.d.fill(0);
    this.ox = ox; this.oy = oy;
  };
  Sprite.prototype.set = function (x, y, slot) {
    x = Math.floor(x) - this.ox; y = Math.floor(y) - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = slot;
  };
  Sprite.prototype.get = function (x, y) {
    x = Math.floor(x) - this.ox; y = Math.floor(y) - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[y * this.w + x];
  };
  PX.Sprite = Sprite;

  // hard-edged capsule with tapering radius; shade(x, y, u, v, t) -> slot (0 = leave pixel alone)
  //   u,v = offset from the capsule axis normalised by the local radius; t = 0..1 along the axis
  PX.capsule = function (sp, x0, y0, x1, y1, r0, r1, shade) {
    var minx = Math.floor(Math.min(x0 - r0, x1 - r1) - 1), maxx = Math.ceil(Math.max(x0 + r0, x1 + r1) + 1);
    var miny = Math.floor(Math.min(y0 - r0, y1 - r1) - 1), maxy = Math.ceil(Math.max(y0 + r0, y1 + r1) + 1);
    var vx = x1 - x0, vy = y1 - y0, L2 = vx * vx + vy * vy || 1e-6;
    for (var y = miny; y <= maxy; y++) for (var x = minx; x <= maxx; x++) {
      var px = x + 0.5, py = y + 0.5, t = ((px - x0) * vx + (py - y0) * vy) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      var cx = x0 + vx * t, cy = y0 + vy * t, r = r0 + (r1 - r0) * t, dx = px - cx, dy = py - cy;
      if (dx * dx + dy * dy <= r * r) { var s = shade(x, y, dx / r, dy / r, t); if (s) sp.set(x, y, s); }
    }
  };
  PX.disc = function (sp, cx, cy, r, shade) { PX.capsule(sp, cx, cy, cx, cy, r, r, shade); };
  // filled polygon (even-odd) with per-pixel shade(x, y) -> slot
  PX.poly = function (sp, pts, shade) {
    var miny = 1e9, maxy = -1e9, n = pts.length, k, y;
    for (k = 0; k < n; k++) { if (pts[k][1] < miny) miny = pts[k][1]; if (pts[k][1] > maxy) maxy = pts[k][1]; }
    for (y = Math.floor(miny); y <= Math.ceil(maxy); y++) {
      var yc = y + 0.5, xs = [];
      for (k = 0; k < n; k++) {
        var a = pts[k], b = pts[(k + 1) % n];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort(function (p, q) { return p - q; });
      for (k = 0; k + 1 < xs.length; k += 2) {
        for (var x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) { var s = shade(x, y); if (s) sp.set(x, y, s); }
      }
    }
  };
  // two-bone inverse kinematics; the middle joint bends toward `side` (+1 / -1)
  PX.ik2 = function (hx, hy, fx, fy, a, b, side) {
    var dx = fx - hx, dy = fy - hy, dist = Math.hypot(dx, dy) || 0.01, d = Math.min(dist, a + b - 0.05);
    var l = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - l * l));
    var ux = dx / dist, uy = dy / dist;
    return { x: hx + ux * l - uy * h * side, y: hy + uy * l + ux * h * side };
  };

  // ---------- indexed sprite -> canvas (only needed where the frame is still RGB) ----------
  // palette: array of [r,g,b] indexed by slot (entry 0 ignored = transparent)
  // Grow-only backing canvas (resizing a canvas reallocates it, which is slow at 60 fps). Draw the result with
  //   g.drawImage(canvas, 0, 0, sp.w, sp.h, dx, dy, sp.w, sp.h)
  var LUT = new Uint32Array(256);
  PX.spriteToCanvas = function (sp, palette, canvas) {
    if (canvas.width < sp.w || canvas.height < sp.h) {
      canvas.width = Math.max(canvas.width, sp.w + 16); canvas.height = Math.max(canvas.height, sp.h + 16);
      canvas._im = null; canvas._d32 = null;
    }
    var c = canvas.getContext("2d"), cw = canvas.width, im = canvas._im;
    if (!im) { im = canvas._im = c.createImageData(canvas.width, canvas.height); canvas._d32 = new Uint32Array(im.data.buffer); }
    var d32 = canvas._d32, s = sp.d, o, x, y, w = sp.w, h = sp.h;
    LUT.fill(0);
    for (o = 1; o < palette.length && o < 256; o++) {
      var p = palette[o]; if (!p) continue;
      LUT[o] = (255 << 24) | ((p[2] & 255) << 16) | ((p[1] & 255) << 8) | (p[0] & 255);
    }
    for (y = 0; y < h; y++) { var row = y * cw, srow = y * w; for (x = 0; x < w; x++) { var v = s[srow + x]; d32[row + x] = v ? LUT[v] : 0; } }
    c.putImageData(im, 0, 0, 0, 0, w, h);
    return canvas;
  };


  // ---------- palette + indexed framebuffer ----------
  // A Palette owns up to 256 entries. Realms allocate NAMED RAMPS (dark -> light) so effects can move along a
  // ramp (shade / lighten) and stay inside the palette. Animating the palette (dusk -> night, lightning flash,
  // fades) recolours the whole scene without touching a single pixel of the framebuffer.
  function Palette() { this.rgb = []; for (var i = 0; i < 256; i++) this.rgb.push([0, 0, 0]); this.n = 1; this.ramps = {}; this.p32 = new Uint32Array(256); this.dirty = true; }
  Palette.prototype.ramp = function (name, colors) {
    var base = this.n;
    for (var i = 0; i < colors.length; i++) this.rgb[base + i] = colors[i].slice();
    this.ramps[name] = { base: base, n: colors.length };
    this.n += colors.length; this.dirty = true;
    return base;
  };
  Palette.prototype.setRamp = function (name, colors) {
    var r = this.ramps[name];
    for (var i = 0; i < r.n; i++) { var c = colors[Math.min(i, colors.length - 1)]; this.rgb[r.base + i][0] = c[0]; this.rgb[r.base + i][1] = c[1]; this.rgb[r.base + i][2] = c[2]; }
    this.dirty = true;
  };
  Palette.prototype.set = function (idx, c) { var e = this.rgb[idx]; e[0] = c[0]; e[1] = c[1]; e[2] = c[2]; this.dirty = true; };
  Palette.prototype.build = function () {
    if (!this.dirty) return this.p32;
    for (var i = 0; i < 256; i++) {
      var c = this.rgb[i];
      this.p32[i] = (255 << 24) | ((Math.max(0, Math.min(255, Math.round(c[2]))) & 255) << 16) | ((Math.max(0, Math.min(255, Math.round(c[1]))) & 255) << 8) | (Math.max(0, Math.min(255, Math.round(c[0]))) & 255);
    }
    this.dirty = false; return this.p32;
  };
  PX.Palette = Palette;

  function Frame(w, h) { this.resize(w, h); }
  Frame.prototype.resize = function (w, h) {
    this.w = w; this.h = h; this.d = new Uint8Array(w * h); this.im = null; this.d32 = null; this.cv = null;
  };
  Frame.prototype.clear = function (c) { this.d.fill(c || 0); };
  Frame.prototype.set = function (x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; };
  Frame.prototype.get = function (x, y) { return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.d[y * this.w + x] : 0; };
  Frame.prototype.fillRect = function (x, y, w, h, c) {
    var x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0), x1 = Math.min(this.w, (x + w) | 0), y1 = Math.min(this.h, (y + h) | 0);
    if (x1 <= x0) return;
    for (var yy = y0; yy < y1; yy++) this.d.fill(c, yy * this.w + x0, yy * this.w + x1);
  };
  Frame.prototype.vline = function (x, y0, y1, c) {                     // inclusive y0..y1-1 (clipped)
    if (x < 0 || x >= this.w) return;
    y0 = Math.max(0, y0 | 0); y1 = Math.min(this.h, y1 | 0);
    for (var y = y0, o = y0 * this.w + x; y < y1; y++, o += this.w) this.d[o] = c;
  };
  // copy an indexed Sprite (slot 0 = transparent) at integer position; slots are offset by slotBase
  Frame.prototype.blit = function (sp, dx, dy, slotBase) {
    var sw = sp.w, sh = sp.h, sd = sp.d, w = this.w, h = this.h, d = this.d, base = slotBase | 0;
    for (var y = 0; y < sh; y++) {
      var ty = dy + y; if (ty < 0 || ty >= h) continue;
      for (var x = 0; x < sw; x++) {
        var v = sd[y * sw + x]; if (!v) continue;
        var tx = dx + x; if (tx < 0 || tx >= w) continue;
        d[ty * w + tx] = v + base;
      }
    }
  };
  // palette indices -> RGBA -> canvas (1:1, integer, no smoothing)
  Frame.prototype.present = function (g, pal) {
    var p32 = pal.build();
    if (!this.cv) { this.cv = document.createElement("canvas"); this.cv.width = this.w; this.cv.height = this.h; this.im = this.cv.getContext("2d").createImageData(this.w, this.h); this.d32 = new Uint32Array(this.im.data.buffer); }
    var d32 = this.d32, d = this.d, n = d.length;
    for (var i = 0; i < n; i++) d32[i] = p32[d[i]];
    this.cv.getContext("2d").putImageData(this.im, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(this.cv, 0, 0);
  };
  PX.Frame = Frame;

  root.PX = PX;
})(typeof window !== "undefined" ? window : this);
