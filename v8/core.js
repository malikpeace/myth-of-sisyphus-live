// V8 core: the realm pipeline. One indexed framebuffer (a byte per pixel) + one palette per realm.
// Order of a frame:  palette update -> backdrop -> ground (+ props) -> actor (stone, hero, shadow) -> foreground -> present.
// Because pixels are palette INDICES, shading is index arithmetic along named ramps (shade1/shade2 tables),
// fog and glow are ordered dithers between two palette entries, and day/night or lightning are palette animations.
(function (root) {
  "use strict";
  var PX = root.PX, V8 = { realms: {}, fb: null, pal: null, key: "", realm: null, shade1: new Uint8Array(256), shade2: new Uint8Array(256), stats: { ms: 0 } };

  V8.register = function (id, realm) { V8.realms[id] = realm; realm.id = id; };
  V8.has = function (id) { return !!V8.realms[id]; };

  V8.buildShade = function (pal) {
    var i, n;
    for (i = 0; i < 256; i++) { V8.shade1[i] = i; V8.shade2[i] = i; }
    for (var name in pal.ramps) {
      var r = pal.ramps[name];
      for (i = 0; i < r.n; i++) { V8.shade1[r.base + i] = r.base + Math.max(0, i - 1); V8.shade2[r.base + i] = r.base + Math.max(0, i - 2); }
    }
  };

  // Markers: cairns every 100 m (taller each 500 m) and the flag where your best climb ended. Fixed palette slots 244..252,
  // overridable per realm through realm.markerIdx.
  var MARK = { c0: 244, c1: 245, c2: 246, p0: 247, p1: 248, f0: 249, f1: 250, g0: 251, g1: 252 };
  V8.markerColors = function (pal) {
    var C = [[52, 50, 50], [98, 94, 90], [148, 142, 132], [56, 42, 34], [112, 90, 66], [214, 196, 130], [168, 148, 88], [150, 158, 170], [108, 116, 130]];
    for (var i = 0; i < C.length; i++) pal.set(244 + i, C[i]);
  };
  V8.markers = function (fb, S, pal, R) {
    var z = S.zoom, w = fb.w, lip = S.lip, mk = (R && R.markerIdx) || MARK, sc = Math.max(0.55, z * 1.25), i, y, yy, x;
    for (i = 0; i < S.cairns.length; i++) {
      var c = S.cairns[i], sx = Math.round(S.ztx + c.x * z); if (sx < -12 || sx > w + 12) continue;
      var big = c.m % 500 === 0, rows = big ? [[11, 3], [9, 3], [7, 3], [5, 2], [3, 2]] : [[9, 3], [7, 3], [5, 2], [3, 2]];
      y = lip[Math.max(0, Math.min(w - 1, sx))] + 1;
      for (var r = 0; r < rows.length; r++) {
        var rw = Math.max(2, Math.round(rows[r][0] * sc)), rh = Math.max(1, Math.round(rows[r][1] * sc)), off = (r % 2 ? 1 : 0) - (r === 2 ? 1 : 0);
        y -= rh;
        for (yy = 0; yy < rh; yy++) for (x = 0; x < rw; x++) fb.set(sx - (rw >> 1) + off + x, y + yy, r === 0 ? mk.c0 : (yy === 0 && x < rw - 1 ? mk.c2 : mk.c1));
      }
    }
    if (S.bestM >= 30) {
      var fxw = S.anchorX + (S.bestM * 7.2 - S.scroll), fsx = Math.round(S.ztx + fxw * z);
      if (fsx > -20 && fsx < w + 20) {
        var fy = lip[Math.max(0, Math.min(w - 1, fsx))] + 1, ph = Math.max(10, Math.round(34 * z * 1.3)), cw = Math.max(5, Math.round(9 * sc)), chh = Math.max(3, Math.round(6 * sc));
        for (y = 0; y < ph; y++) fb.set(fsx, fy - y, y & 1 ? mk.p1 : mk.p0);
        var wave = S.reduced ? 0 : Math.round(Math.sin(S.tSec * 3) * 0.6);
        for (yy = 0; yy < chh; yy++) for (x = 0; x < cw - (yy >> 1); x++) fb.set(fsx + 1 + x, fy - ph + yy + (x > cw / 2 ? wave : 0), (yy === chh - 1 || x === 0) ? (S.oldBestPassed ? mk.g1 : mk.f1) : (S.oldBestPassed ? mk.g0 : mk.f0));
      }
    }
  };

  V8.ensure = function (S) {
    var key = S.realmId + "|" + S.w + "x" + S.h;
    if (V8.key === key && V8.fb) return;
    V8.key = key;
    V8.realm = V8.realms[S.realmId];
    if (!V8.fb || V8.fb.w !== S.w || V8.fb.h !== S.h) V8.fb = new PX.Frame(S.w, S.h);
    V8.pal = new PX.Palette();
    if (V8.realm.init) V8.realm.init(V8.pal, S);
    V8.markerColors(V8.pal);
    V8.buildShade(V8.pal);
  };

  // A = actor parameters (see actor.js) or null. Returns the light the realm is casting (for HUD tinting etc.)
  V8.render = function (g, S, A) {
    var t0 = performance.now();
    V8.ensure(S);
    var R = V8.realm, fb = V8.fb, pal = V8.pal;
    if (R.palette) R.palette(pal, S);
    R.backdrop(fb, S, pal);
    R.ground(fb, S, pal);
    if (R.markers) R.markers(fb, S, pal); else V8.markers(fb, S, pal, R);
    var res = null;
    if (A) res = root.V8Actor.frameFb(fb, pal, A, V8.shade1, V8.shade2);
    if (R.front) R.front(fb, S, pal, res);
    fb.present(g, pal);
    V8.stats.ms = performance.now() - t0;
    return res;
  };

  root.V8 = V8;
})(typeof window !== "undefined" ? window : this);
