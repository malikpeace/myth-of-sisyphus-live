// V8 actor: puts the hero, the stone and their shadow on screen as ONE native-grid sprite.
//  - joints / centres are mapped to screen pixels by the slope rotation + camera zoom (vector level),
//  - the stone comes from the cached lit-sphere renderer, the hero from the rig rasteriser,
//  - both are composited into a single indexed buffer, coloured through a per-frame palette,
//  - the shadow is a hard dither (solid core, checker ring) clipped to the terrain, never a soft blur.
// Two outputs: frame(g, P) for the legacy RGB canvas, frameFb(fb, pal, P, shade) for the V8 indexed framebuffer.
(function (root) {
  "use strict";
  var PX = root.PX, Rock = root.Rock, Hero = root.Hero;
  var clamp01 = PX.clamp01;
  var comp = new PX.Sprite(1, 1), cv = null, shCv = null, shIm = null;
  var HERO_SCALE = 1.14;                                                   // the man is drawn 20% larger than the game's base figure (the stone keeps its size): more pixels to model a body with
  var ACTOR_BASE = 200;                                                   // framebuffer palette indices 201..243 belong to the actor

  var RAMPS = {
    granite: [[16, 20, 26], [30, 38, 48], [48, 60, 74], [76, 92, 106], [112, 130, 142], [160, 178, 182]],
    warm:    [[24, 18, 18], [44, 34, 32], [70, 56, 52], [104, 86, 78], [148, 124, 108], [196, 172, 148]],
    icy:     [[18, 26, 38], [36, 52, 72], [62, 86, 112], [98, 128, 156], [146, 176, 200], [200, 222, 236]],
    night:   [[8, 10, 18], [16, 20, 34], [28, 34, 54], [46, 56, 82], [72, 84, 112], [104, 118, 146]],
    obsidian:[[5, 4, 9], [10, 7, 14], [17, 12, 24], [28, 20, 38], [46, 34, 58], [72, 56, 84]]
  };

  function stonePalette(P) {
    var A = P.ambient || [90, 100, 130], C = P.sunCol || [255, 226, 176], k = clamp01(P.sunK == null ? 0.6 : P.sunK), kk = Math.pow(k, 0.7);
    var bright = clamp01(P.bright == null ? 0.7 : P.bright), base = P.rockRamp || RAMPS[P.rockMat || "granite"] || RAMPS.granite;
    var f = 0.5 + 0.5 * bright;
    var ramp = base.map(function (c, i) {
      var t = PX.mix(c, A, 0.10 + 0.05 * (i < 3 ? 1 : 0));
      if (i >= 3) t = PX.mix(t, C, (0.16 * kk) * ((i - 2) / 3));
      return [t[0] * f, t[1] * f, t[2] * f];
    });
    var ink = PX.mix([8, 10, 14], A, 0.08), rim = PX.mix(C, [255, 255, 255], 0.22);
    ink = [ink[0] * f, ink[1] * f, ink[2] * f];
    if (k < 0.05) rim = ramp[5];
    var accent = null;
    if (P.rockStyle === "mossy") accent = [[34, 52, 24], [72, 104, 44], [138, 168, 74]];
    else if (P.rockStyle === "snowy") accent = [[126, 148, 176], [196, 214, 232], [244, 248, 252]];
    if (accent) accent = accent.map(function (c) { return [c[0] * f, c[1] * f, c[2] * f].map(Math.round); });
    var g = P.ground || [90, 110, 60];
    var bounce = PX.mix(ramp[2], g, 0.35);
    return Rock.palette(ramp.map(PX.round3), PX.round3(ink), PX.round3(rim), accent, PX.round3(bounce));
  }

  // ---------- shadow: calls sink(x, y, level) with level 2 (core) or 1 (dither ring), only on ground ----------
  function shadowRun(P, rc, R, sink) {
    var cs = Math.cos(P.theta), sn = Math.sin(P.theta);
    var lx = P.light[0], k = clamp01(P.sunK == null ? 0.5 : P.sunK);
    var sd = Math.max(-1.35, Math.min(1.35, -lx * 1.8)) * (0.4 + 0.6 * k);   // shadow leans away from the light
    var ux = cs, uy = -sn, vx = sn, vy = cs;
    var cx = rc.x, cy = rc.y + R;
    var ru = R * (1.15 + Math.abs(sd) * 0.85), rv = Math.max(2.2, R * 0.30), u0 = sd * R * 0.75, v0 = rv * 0.35;
    var hu = Math.abs(sd) * R + ru + 6, minx = Math.floor(cx - hu - rv * 2), maxx = Math.ceil(cx + hu + rv * 2);
    var miny = Math.floor(cy - hu * 0.6 - rv * 2), maxy = Math.ceil(cy + hu * 0.6 + rv * 2);
    var body = P.heroShadow, x, y;
    for (y = miny; y <= maxy; y++) for (x = minx; x <= maxx; x++) {
      var px = x + 0.5 - cx, py = y + 0.5 - cy;
      var u = px * ux + py * uy, v = px * vx + py * vy;
      var lvl = 0, dd = ((u - u0) / ru) * ((u - u0) / ru) + ((v - v0) / rv) * ((v - v0) / rv);
      if (dd <= 1) lvl = dd < 0.42 ? 2 : (((x + y) & 1) === 0 ? 1 : 0);
      if (body) {
        var bu = u - body.u, bd = (bu / body.ru) * (bu / body.ru) + ((v - v0 * 0.6) / body.rv) * ((v - v0 * 0.6) / body.rv);
        if (bd <= 1) { var lb = bd < 0.4 ? 2 : (((x + y) & 1) === 0 ? 1 : 0); if (lb > lvl) lvl = lb; }
      }
      if (lvl <= 0) continue;
      var lip = P.lipAt ? P.lipAt(x + 0.5) : -1e9;
      if (y + 0.5 < lip - 0.5) continue;
      if (P.bridgeDepth && y + 0.5 > lip + P.bridgeDepth) continue;
      sink(x, y, lvl);
    }
  }

  // builds everything for one frame (stone sprite, hero rig, composited indexed sprite, slot palette)
  function prepare(P) {
    var z = P.z, s = P.s * HERO_SCALE, cs = Math.cos(P.theta), sn = Math.sin(P.theta);
    var ox = P.ox, oy = P.oy;
    function map(lx, ly) { return [ox + z * (lx * cs + ly * sn), oy + z * (-lx * sn + ly * cs)]; }
    var sfig = s * z, lod = clamp01((sfig - 0.34) / 0.52);
    var stonePal = stonePalette(P), heroPal = Hero.palette({ look: P.look, cosmetic: P.cosmetic, ambient: P.ambient, sunCol: P.sunCol, sunK: P.sunK, bright: P.bright, ground: P.ground, bgLum: P.bgLum });
    var pal = stonePal.slice(); for (var q = 0; q < heroPal.length; q++) if (heroPal[q]) pal[q] = heroPal[q];
    var Rpx = P.brad * z, sq = P.squash || 0;
    var rx = Math.max(3, Math.round(Rpx * (1 + sq))), ry = Math.max(3, Math.round(Rpx * (1 - sq)));
    var rcF = map(P.blx + (P.lurchX || 0), P.bly), rc = { x: Math.round(rcF[0]), y: Math.round(rcF[1]) };
    var stone = Rock.get({ rx: rx, ry: ry, angle: P.roll, lightDx: P.light[0], lightDy: P.light[1], style: P.rockStyle || "granite" });
    var J = null;
    if (P.mode === "cheer") J = Hero.rigCheer({ s: s, cheer: P.cheer, manBaseX: P.manBaseX, ratio: P.ratio, brad: P.brad, blx: P.blx, bly: P.bly });
    else J = Hero.rig({ s: s, brace: P.brace, stumble: P.stumble, pushDrive: P.pushDrive, windLean: P.windLean, wp: P.wp, activity: P.activity, effort: P.effort, slideEffort: P.slideEffort,
                        tSec: P.tSec, reduced: P.reduced, playing: P.playing, groove: P.groove, ratio: P.ratio, brad: P.brad, blx: P.blx, bly: P.bly, manBaseX: P.manBaseX });
    var heroShadow = null;
    if (J && !P.hideHero) { var hf = map(J.hip.x - 2 * s, 0); heroShadow = { u: (hf[0] - rcF[0]) * cs - (hf[1] - (rcF[1] + Rpx)) * sn, ru: 13 * s * z, rv: Math.max(1.6, 2.6 * s * z) }; }
    P.heroShadow = heroShadow;
    var minx = rc.x - rx - 4, maxx = rc.x + rx + 4, miny = rc.y - ry - 4, maxy = rc.y + ry + 4;
    if (J) {
      var pts = [J.hip, J.sh, J.head, J.neck, J.shB];
      J.legs.forEach(function (l) { pts.push(l.foot, l.knee); });
      if (J.arms) J.arms.forEach(function (a) { pts.push(a.hand, a.elbow); }); else pts.push(J.hand, J.hand2, J.elbow, J.elbow2);
      var pad = 9 * s * z + 6;
      pts.forEach(function (p) { var m = map(p.x, p.y); if (m[0] - pad < minx) minx = Math.floor(m[0] - pad); if (m[0] + pad > maxx) maxx = Math.ceil(m[0] + pad); if (m[1] - pad < miny) miny = Math.floor(m[1] - pad); if (m[1] + pad > maxy) maxy = Math.ceil(m[1] + pad); });
      if (P.cosmetic === "cloak") minx -= Math.round(20 * s * z);
      if (P.cosmetic === "aura") { minx -= 8; miny -= 8; maxx += 8; }
    }
    var w = maxx - minx + 1, h = maxy - miny + 1;
    if (w <= 0 || h <= 0 || w > 1400 || h > 1400) return null;
    comp.reset(w, h, minx, miny);
    var sd = stone.d, sw = stone.w, sh = stone.h, sox = rc.x + stone.ox, soy = rc.y + stone.oy;
    if (!P.hideRock) {
      for (var yy = 0; yy < sh; yy++) {
        var dy = soy + yy - miny; if (dy < 0 || dy >= h) continue;
        for (var xx = 0; xx < sw; xx++) {
          var v = sd[yy * sw + xx]; if (!v) continue;
          var dx = sox + xx - minx; if (dx < 0 || dx >= w) continue;
          comp.d[dy * w + dx] = v;
        }
      }
    }
    if (J && !P.hideHero) {
      Hero.draw(comp, { map: map, z: z, s: s, lod: lod, light: P.light, lightK: P.sunK, look: P.look, cosmetic: P.cosmetic, tSec: P.tSec, wp: P.wp, activity: P.activity, windLean: P.windLean, pushTime: P.pushTime, reduced: P.reduced, playing: P.playing }, J);
    }
    var ap = P.appear == null ? 1 : P.appear;
    if (ap < 0.999) {                                                     // menu / intro: the man and the stone dissolve in and out through an ordered dither
      var cd = comp.d, B4 = PX.BAYER4, cy, cx;
      for (cy = 0; cy < h; cy++) for (cx = 0; cx < w; cx++) { var oi = cy * w + cx; if (cd[oi] && !(B4[(miny + cy) & 3][(minx + cx) & 3] + 0.5 < ap)) cd[oi] = 0; }
    }
    return { comp: comp, pal: pal, minx: minx, miny: miny, w: w, h: h, rc: rc, rcF: rcF, Rpx: Rpx, rx: rx, ry: ry, J: J, map: map, appear: ap };
  }

  // ---- legacy RGB canvas output ----
  function frame(g, P) {
    var R = prepare(P); if (!R) return;
    if (!P.noShadow && !P.reduced) {
      var k = clamp01(P.sunK == null ? 0.5 : P.sunK), strength = 0.35 + 0.65 * k, col = P.shadowCol || [8, 14, 10];
      var pts = [], minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      shadowRun(P, { x: R.rcF[0], y: R.rcF[1] }, R.Rpx, function (x, y, lvl) { pts.push(x, y, lvl); if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; });
      if (pts.length) {
        var w = maxx - minx + 1, h = maxy - miny + 1;
        if (w > 0 && h > 0 && w < 900 && h < 900) {
          if (!shCv) { shCv = document.createElement("canvas"); shCv.width = 64; shCv.height = 64; }
          if (shCv.width < w || shCv.height < h) { shCv.width = Math.max(shCv.width, w + 16); shCv.height = Math.max(shCv.height, h + 16); shIm = null; }
          var sc = shCv.getContext("2d"), cw = shCv.width;
          if (!shIm) shIm = sc.createImageData(shCv.width, shCv.height);
          var d = shIm.data, x, y, i;
          for (y = 0; y < h; y++) for (x = 0; x < w; x++) d[(y * cw + x) * 4 + 3] = 0;
          for (i = 0; i < pts.length; i += 3) {
            var o = ((pts[i + 1] - miny) * cw + (pts[i] - minx)) * 4;
            d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = Math.round(255 * (pts[i + 2] === 2 ? 0.50 : 0.30) * strength);
          }
          sc.putImageData(shIm, 0, 0, 0, 0, w, h);
          g.drawImage(shCv, 0, 0, w, h, minx, miny, w, h);
        }
      }
    }
    if (!cv) cv = document.createElement("canvas");
    PX.spriteToCanvas(R.comp, R.pal, cv);
    g.drawImage(cv, 0, 0, R.w, R.h, R.minx, R.miny, R.w, R.h);
    return { rock: R.rc, rx: R.rx, ry: R.ry, joints: R.J, map: R.map };
  }

  // ---- V8 indexed framebuffer output ----
  //   shade1 / shade2: Uint8Array(256) LUTs (one / two steps darker along each palette ramp)
  // what the man stands against: the luminance of the backdrop behind his torso and head (smoothed, quantised) so his skin and linen can be lifted or darkened to stay readable
  var bgSmooth = -1;
  function surroundLum(fb, pal, P) {
    var z = P.z, s = P.s * HERO_SCALE, x0 = Math.round(P.ox - 24 * z * s), x1 = Math.round(P.ox + 6 * z * s), y0 = Math.round(P.oy - 46 * z * s), y1 = Math.round(P.oy - 8 * z * s), sum = 0, n = 0, xs, ys;
    x0 = Math.max(0, x0); x1 = Math.min(fb.w - 1, Math.max(x0 + 3, x1)); y0 = Math.max(0, y0); y1 = Math.min(fb.h - 1, Math.max(y0 + 3, y1));
    for (ys = 0; ys < 5; ys++) for (xs = 0; xs < 7; xs++) {
      var px = x0 + Math.round((x1 - x0) * xs / 6), py = y0 + Math.round((y1 - y0) * ys / 4), e = pal.rgb[fb.d[py * fb.w + px]];
      if (e) { sum += (0.2126 * e[0] + 0.7152 * e[1] + 0.0722 * e[2]) / 255; n++; }
    }
    var l = n ? sum / n : 0.45;
    bgSmooth = bgSmooth < 0 ? l : bgSmooth + (l - bgSmooth) * 0.16;
    return Math.round(bgSmooth * 14) / 14;
  }
  function frameFb(fb, pal, P, shade1, shade2) {
    if (P.bgLum == null) P.bgLum = surroundLum(fb, pal, P);
    var R = prepare(P); if (!R) return null;
    if (!P.noShadow && !P.reduced && R.appear > 0.02) {
      var strong = (P.sunK == null ? 0.5 : P.sunK) > 0.18, d = fb.d, w = fb.w, h = fb.h, apr = R.appear, B4s = PX.BAYER4;
      shadowRun(P, { x: R.rcF[0], y: R.rcF[1] }, R.Rpx, function (x, y, lvl) {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        if (apr < 0.999 && !(B4s[y & 3][x & 3] + 0.5 < apr)) return;
        var o = y * w + x, v = d[o];
        d[o] = (lvl === 2 && strong) ? shade2[v] : shade1[v];
      });
    }
    fb.blit(R.comp, R.minx, R.miny, ACTOR_BASE);
    for (var s = 1; s < R.pal.length; s++) if (R.pal[s]) pal.set(ACTOR_BASE + s, R.pal[s]);
    return { rock: R.rc, rx: R.rx, ry: R.ry, joints: R.J, map: R.map };
  }

  root.V8Actor = { frame: frame, frameFb: frameFb, stonePalette: stonePalette, RAMPS: RAMPS, ACTOR_BASE: ACTOR_BASE };
})(typeof window !== "undefined" ? window : this);
