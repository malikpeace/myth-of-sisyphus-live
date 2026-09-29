// V8 actor: puts the hero, the stone and their shadow on screen as ONE native-grid sprite.
//  - joints / centres are mapped to screen pixels by the slope rotation + camera zoom (vector level),
//  - the stone comes from the cached lit-sphere renderer, the hero from the rig rasteriser,
//  - both are composited into a single indexed buffer, coloured through a per-frame palette,
//  - the shadow is a hard dither (solid core, checker ring) clipped to the terrain, never a soft blur.
(function (root) {
  "use strict";
  var PX = root.PX, Rock = root.Rock, Hero = root.Hero;
  var clamp01 = PX.clamp01, smooth01 = PX.smooth01;
  var comp = new PX.Sprite(1, 1), cv = null, shCv = null, shIm = null;
  var rockBounce = null;

  // base granite ramps per material (dark -> light). Realms may override with their own via P.rockRamp.
  var RAMPS = {
    granite: [[16, 20, 26], [30, 38, 48], [48, 60, 74], [76, 92, 106], [112, 130, 142], [160, 178, 182]],
    warm:    [[24, 18, 18], [44, 34, 32], [70, 56, 52], [104, 86, 78], [148, 124, 108], [196, 172, 148]],
    icy:     [[18, 26, 38], [36, 52, 72], [62, 86, 112], [98, 128, 156], [146, 176, 200], [200, 222, 236]],
    night:   [[8, 10, 18], [16, 20, 34], [28, 34, 54], [46, 56, 82], [72, 84, 112], [104, 118, 146]],
    obsidian:[[6, 4, 10], [12, 8, 16], [21, 14, 28], [36, 26, 46], [60, 44, 72], [92, 72, 104]]
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
    var pal = Rock.palette(ramp.map(PX.round3), PX.round3(ink), PX.round3(rim), accent, PX.round3(bounce));
    return pal;
  }

  // ---------- dithered ground shadow (RGBA canvas, hard alpha steps) ----------
  function shadow(g, P, rc, R) {
    var z = P.z, cs = Math.cos(P.theta), sn = Math.sin(P.theta);
    var lx = P.light[0], k = clamp01(P.sunK == null ? 0.5 : P.sunK);
    var strength = 0.35 + 0.65 * k;                                        // even without a sun, a stone still sits in contact shadow
    var sd = Math.max(-1.35, Math.min(1.35, -lx * 1.8)) * (0.4 + 0.6 * k);   // shadow leans away from the light
    // ground-frame axes in screen space: u along the slope (forward), v down into the ground
    var ux = cs, uy = -sn, vx = sn, vy = cs;
    var cx = rc.x, cy = rc.y + R;                                          // contact point under the stone
    var ru = R * (1.15 + Math.abs(sd) * 0.85), rv = Math.max(2.2, R * 0.30), u0 = sd * R * 0.75, v0 = rv * 0.35;
    var hu = Math.abs(sd) * R + ru + 6, minx = Math.floor(cx - hu - rv * 2), maxx = Math.ceil(cx + hu + rv * 2);
    var miny = Math.floor(cy - hu * 0.6 - rv * 2), maxy = Math.ceil(cy + hu * 0.6 + rv * 2);
    var w = maxx - minx + 1, h = maxy - miny + 1;
    if (w <= 0 || h <= 0 || w > 900 || h > 900) return;
    if (!shCv) { shCv = document.createElement("canvas"); shCv.width = 64; shCv.height = 64; }
    if (shCv.width < w || shCv.height < h) { shCv.width = Math.max(shCv.width, w + 16); shCv.height = Math.max(shCv.height, h + 16); shIm = null; }
    var sc = shCv.getContext("2d"), cw = shCv.width;
    if (!shIm) shIm = sc.createImageData(shCv.width, shCv.height);
    var d = shIm.data, col = P.shadowCol || [8, 14, 10], any = false, i, x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) d[(y * cw + x) * 4 + 3] = 0;
    var body = P.heroShadow;                                                // hero: a smaller companion shadow
    for (y = miny; y <= maxy; y++) for (x = minx; x <= maxx; x++) {
      var px = x + 0.5 - cx, py = y + 0.5 - cy;
      var u = px * ux + py * uy, v = px * vx + py * vy;                     // slope-frame coordinates
      var a = 0, dd = ((u - u0) / ru) * ((u - u0) / ru) + ((v - v0) / rv) * ((v - v0) / rv);
      if (dd <= 1) a = dd < 0.42 ? 0.50 : (((x + y) & 1) === 0 ? 0.30 : 0);
      if (body) {
        var bu = u - body.u * 1.0, bd = (bu / body.ru) * (bu / body.ru) + ((v - v0 * 0.6) / body.rv) * ((v - v0 * 0.6) / body.rv);
        if (bd <= 1) { var ab = bd < 0.4 ? 0.46 : (((x + y) & 1) === 0 ? 0.28 : 0); if (ab > a) a = ab; }
      }
      if (a <= 0) continue;
      var lip = P.lipAt ? P.lipAt(x + 0.5) : -1e9;
      if (y + 0.5 < lip - 0.5) continue;                                   // only on ground, never in the air
      if (P.bridgeDepth && y + 0.5 > lip + P.bridgeDepth) continue;         // deck shadows stop at the deck's edge
      var o = ((y - miny) * cw + (x - minx)) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = Math.round(255 * a * strength); any = true;
    }
    if (!any) return;
    sc.putImageData(shIm, 0, 0, 0, 0, w, h);
    g.drawImage(shCv, 0, 0, w, h, minx, miny, w, h);
  }

  // main entry: draws shadow + stone + hero. P is assembled by the game each frame.
  function frame(g, P) {
    var z = P.z, s = P.s, cs = Math.cos(P.theta), sn = Math.sin(P.theta);
    var ox = P.ox, oy = P.oy;
    function map(lx, ly) { return [ox + z * (lx * cs + ly * sn), oy + z * (-lx * sn + ly * cs)]; }
    var sfig = s * z;                                                      // pixels per figure unit
    var lod = clamp01((sfig - 0.34) / 0.52);                               // 1 = full detail, 0 = speck
    var stonePal = stonePalette(P), heroPal = Hero.palette({ look: P.look, cosmetic: P.cosmetic, ambient: P.ambient, sunCol: P.sunCol, sunK: P.sunK, bright: P.bright, ground: P.ground });
    var pal = stonePal.slice(); for (var q = 0; q < heroPal.length; q++) if (heroPal[q]) pal[q] = heroPal[q];

    // stone geometry on screen
    var Rpx = P.brad * z, sq = P.squash || 0;
    var rx = Math.max(3, Math.round(Rpx * (1 + sq))), ry = Math.max(3, Math.round(Rpx * (1 - sq)));
    var rcF = map(P.blx + (P.lurchX || 0), P.bly), rc = { x: Math.round(rcF[0]), y: Math.round(rcF[1]) };
    var stone = Rock.get({ rx: rx, ry: ry, angle: P.roll, lightDx: P.light[0], lightDy: P.light[1], style: P.rockStyle || "granite" });

    // hero rig
    var J = null;
    if (P.mode === "cheer") J = Hero.rigCheer({ s: s, cheer: P.cheer, manBaseX: P.manBaseX });
    else if (P.mode === "push" || P.mode === "stand")
      J = Hero.rig({ s: s, brace: P.brace, stumble: P.stumble, pushDrive: P.pushDrive, windLean: P.windLean, wp: P.wp, activity: P.activity, effort: P.effort, slideEffort: P.slideEffort,
                     tSec: P.tSec, reduced: P.reduced, playing: P.playing, groove: P.groove, ratio: P.ratio, brad: P.brad, blx: P.blx, bly: P.bly, manBaseX: P.manBaseX });

    // shadow first (lies on the ground, under everything)
    if (!P.noShadow && !P.reduced) {
      var heroShadow = null;
      if (J && !P.hideHero) { var hf = map(J.hip.x - 2 * s, 0); heroShadow = { u: 0, ru: 13 * s * z, rv: Math.max(1.6, 2.6 * s * z) }; heroShadow.u = (hf[0] - rcF[0]) * cs - (hf[1] - (rcF[1] + Rpx)) * sn; }
      P.heroShadow = heroShadow;
      shadow(g, P, { x: rcF[0], y: rcF[1] }, Rpx);
    }

    // bounding box of everything that is going to be drawn
    var minx = rc.x - rx - 4, maxx = rc.x + rx + 4, miny = rc.y - ry - 4, maxy = rc.y + ry + 4;
    if (J) {
      var pts = [J.hip, J.sh, J.head, J.neck, J.shB];
      J.legs.forEach(function (l) { pts.push(l.foot, l.knee); });
      if (J.arms) J.arms.forEach(function (a) { pts.push(a.hand, a.elbow); }); else pts.push(J.hand, J.hand2, J.elbow, J.elbow2);
      var pad = 9 * s * z + 6;
      pts.forEach(function (p) { var m = map(p.x, p.y); if (m[0] - pad < minx) minx = Math.floor(m[0] - pad); if (m[0] + pad > maxx) maxx = Math.ceil(m[0] + pad); if (m[1] - pad < miny) miny = Math.floor(m[1] - pad); if (m[1] + pad > maxy) maxy = Math.ceil(m[1] + pad); });
      if (P.cosmetic === "cloak") { minx -= Math.round(20 * s * z); }
      if (P.cosmetic === "aura") { minx -= 8; miny -= 8; maxx += 8; }
    }
    var w = maxx - minx + 1, h = maxy - miny + 1;
    if (w <= 0 || h <= 0 || w > 1400 || h > 1400) return;
    comp.reset(w, h, minx, miny);

    // stone (offset stone slots are 1..13 already)
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
    // hero
    if (J && !P.hideHero) {
      Hero.draw(comp, { map: map, z: z, s: s, lod: lod, light: P.light, lightK: P.sunK, look: P.look, cosmetic: P.cosmetic, tSec: P.tSec, wp: P.wp, activity: P.activity, windLean: P.windLean, pushTime: P.pushTime, reduced: P.reduced, playing: P.playing }, J);
    }
    if (!cv) cv = document.createElement("canvas");
    PX.spriteToCanvas(comp, pal, cv);
    g.drawImage(cv, 0, 0, w, h, minx, miny, w, h);
    return { rock: rc, rx: rx, ry: ry, joints: J, map: map };
  }

  root.V8Actor = { frame: frame, stonePalette: stonePalette, RAMPS: RAMPS };
})(typeof window !== "undefined" ? window : this);
