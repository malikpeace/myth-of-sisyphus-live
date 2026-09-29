// V8 hero: Sisyphus drawn natively on the world's pixel grid.
//
// The pose logic is the game's own rig (walk cycle, brace, stumble, push-drive, wind lean, lean-in on giant
// stones, hand on the stone's surface) so gameplay animation is unchanged - only the drawing changed:
// joints are computed in the slope's local frame, mapped to SCREEN pixels (slope rotation + camera zoom
// applied to the skeleton, never to a bitmap), then rasterised as hard-edged shaded capsules.
//
// Two looks share one rig:  "shadow" = dark, backlit, rim-lit (default)   |   "color" = full-colour figure.
// Level of detail: as the camera pulls out he simplifies gracefully down to a rim-lit speck that never vanishes.
(function (root) {
  "use strict";
  var PX = root.PX;
  var clamp = PX.clamp, clamp01 = PX.clamp01, lerp = PX.lerp, smooth01 = PX.smooth01;

  // slot numbers in the shared actor sprite (rock owns 1..13)
  var SLOT = { T0: 16, T1: 17, T2: 18, T3: 19, RIM: 20, F0: 21, F1: 22, F2: 23, F3: 24, CLOTH: 25, CLOTHHI: 26, CLOTHSH: 27,
    HAIR: 28, HAIRHI: 29, BEARD: 30, EYE: 31, WRAP: 32, BAND: 33, LAUREL: 34, AURA: 35, BRONZE: 36, SWEAT: 37,
    DIRT0: 38, DIRT1: 39, DIRT2: 40, CAPE: 41, CAPEHI: 42, GLINT: 43 };

  // ---------- palette for the figure ----------
  // o: look ("shadow"|"color"), cosmetic, ambient [r,g,b] (sky tone), sunCol [r,g,b], sunK 0..1, bright 0..1 (how lit the world is), ground [r,g,b]
  function palette(o) {
    var p = [], A = o.ambient || [90, 100, 130], C = o.sunCol || [255, 226, 176], k = clamp01(o.sunK == null ? 0.6 : o.sunK);
    var kk = Math.pow(k, 0.7), bright = clamp01(o.bright == null ? 0.7 : o.bright);
    var T, cloth, hair;
    if (o.look === "color") {
      var f = 0.42 + 0.58 * bright;
      var base = [[70, 43, 32], [118, 74, 49], [168, 116, 76], [218, 172, 124]].map(function (c) { return [c[0] * f, c[1] * f, c[2] * f]; });
      T = [PX.mix(base[0], A, 0.12), PX.mix(base[1], A, 0.08), PX.mix(base[2], C, 0.14 * kk), PX.mix(base[3], C, 0.26 * kk)];
      cloth = PX.mix([206, 194, 164], A, 0.16 + 0.3 * (1 - bright)); hair = PX.mix([42, 28, 20], A, 0.1);
    } else {
      var ink = PX.mix([7, 6, 12], A, 0.045);
      T = [ink, PX.mix(ink, A, 0.075), PX.mix(ink, C, 0.20 * kk + 0.03), PX.mix(ink, C, 0.48 * kk + 0.04)];
      cloth = PX.mix(ink, [176, 80, 50], 0.62 + 0.30 * bright); hair = PX.mix(ink, [86, 72, 64], 0.30 + 0.25 * kk);
    }
    if (o.cosmetic === "bronze") T = T.map(function (c) { return PX.mix(c, [96, 112, 88], 0.55); });
    var rim = PX.mix(C, [255, 255, 255], 0.22);
    var far = function (c) { return [c[0] * 0.64, c[1] * 0.64, c[2] * 0.68]; };
    p[SLOT.T0] = T[0]; p[SLOT.T1] = T[1]; p[SLOT.T2] = T[2]; p[SLOT.T3] = T[3];
    p[SLOT.RIM] = k > 0.06 ? PX.mix(T[3], rim, clamp01(0.35 + kk * 0.7)) : T[3];
    p[SLOT.F0] = far(T[0]); p[SLOT.F1] = far(T[1]); p[SLOT.F2] = far(T[2]); p[SLOT.F3] = far(T[3]);
    p[SLOT.CLOTH] = cloth; p[SLOT.CLOTHHI] = PX.mix(cloth, C, 0.30 * kk + 0.12); p[SLOT.CLOTHSH] = PX.mix(cloth, T[0], 0.5);
    p[SLOT.HAIR] = hair; p[SLOT.HAIRHI] = PX.mix(hair, C, 0.5 * kk + 0.1);
    p[SLOT.BEARD] = PX.mix(hair, T[1], 0.4);
    p[SLOT.EYE] = [14, 10, 12];
    p[SLOT.WRAP] = [214, 208, 190]; p[SLOT.BAND] = [188, 52, 52]; p[SLOT.LAUREL] = [158, 176, 96]; p[SLOT.AURA] = [150, 132, 230];
    p[SLOT.BRONZE] = [222, 190, 110]; p[SLOT.SWEAT] = [140, 190, 236];
    var g = o.ground || [82, 58, 40];
    p[SLOT.DIRT0] = PX.mix(g, [0, 0, 0], 0.42); p[SLOT.DIRT1] = PX.mix(g, [40, 26, 18], 0.55); p[SLOT.DIRT2] = PX.mix(g, [200, 176, 140], 0.25);
    p[SLOT.CAPE] = PX.mix(T[0], [30, 26, 40], 0.5); p[SLOT.CAPEHI] = PX.mix(T[1], C, 0.15 * kk);
    p[SLOT.GLINT] = PX.mix(C, [255, 255, 255], 0.4);
    return p;
  }

  // ---------- the rig (local frame: x forward, y DOWN, floor at y = 0; units scale with s) ----------
  function rig(P) {
    var s = P.s, brace = P.brace, stumble = P.stumble, pd = P.pushDrive, wl = P.windLean || 0, gY = 0;
    var ax = P.manBaseX || 0;
    var giantT = smooth01(clamp01((P.ratio - 1.6) / 1.2)), leanIn = 0;
    if (giantT > 0.001) {                                            // giant stone: the whole body steps in so a bent arm reaches it
      var estShY = gY - 15.5 * s - 12 * s, estRel = clamp(estShY - 1 * s - P.bly, -P.brad + 3, P.brad - 3);
      var estHalf = Math.sqrt(Math.max(0, P.brad * P.brad - estRel * estRel)), chordX = P.blx - estHalf - 1 * s;
      leanIn = Math.min(14 * s, Math.max(0, (chordX - (ax + 8.5 * s)) - 16 * s) * giantT * 0.72);
    }
    ax += leanIn;
    var bob = Math.sin(P.wp * 6.2832) * 0.8 * P.activity * s * (1 - brace * 0.55);
    var idle = (P.playing && P.activity < 0.035 && P.effort < 0.055 && P.slideEffort < 0.04 && stumble < 0.04) ? (Math.sin(P.tSec * 2.05) * 0.5 + 0.5) * (P.reduced ? 0.28 : 1) : 0;
    var hip = { x: ax - brace * 4 * s - stumble * 1.8 * s + pd * 1.15 * s - wl * 0.6 * s,
                y: gY - 16 * s + bob + brace * 2 * s + stumble * 2.4 * s + pd * 0.75 * s };
    var sh = { x: hip.x + (7.4 + brace * 4 + stumble * 2.0 + pd * 1.85 + wl * 1.5) * s,
               y: hip.y - (12.9 - brace * 1.5 - pd * 0.5 - wl * 1.1) * s + bob * 0.5 + stumble * 0.8 * s };
    var idleHeadT = 1 - smooth01(clamp01(P.activity / 0.06));
    var neck = { x: sh.x - 0.1 * s, y: sh.y - (1.3 + 1.1 * idleHeadT) * s };
    var headR = 4.7 * s;
    var head = { x: neck.x + 0.9 * s, y: neck.y - headR * 0.86 };
    var legs = [];
    if (brace > 0.08) {                                              // dug in: the stone is forcing him back down the slope
      var bf = { x: hip.x - (19 + brace * 3 + pd * 1.15) * s, y: gY }, ff = { x: hip.x - (7 + brace * 2 + pd * 0.35) * s, y: gY };
      legs.push({ foot: bf, knee: PX.ik2(hip.x, hip.y, bf.x, bf.y, 8.6 * s, 8.6 * s, 1), far: true, plant: true });
      legs.push({ foot: ff, knee: PX.ik2(hip.x, hip.y, ff.x, ff.y, 8.6 * s, 8.6 * s, 1), far: false, plant: true });
    } else {
      var stepReach = 5.6 * s * (1 - wl * 0.4) * (1 + (P.groove || 0) * 0.3), stepLift = 4.2 * s;
      for (var leg = 0; leg < 2; leg++) {
        var ph = (P.wp + leg * 0.5) * 6.2832, fwd = Math.cos(ph), lift = Math.max(0, Math.sin(ph)) * stepLift * P.activity;
        var foot = { x: hip.x - 2 * s - fwd * stepReach, y: gY - lift };
        legs.push({ foot: foot, knee: PX.ik2(hip.x, hip.y, foot.x, foot.y, 8.6 * s, 8.6 * s, 1), far: leg === 1, plant: false });
      }
    }
    // arms: both hands on the stone's surface
    var smallGripT = 1 - smooth01(clamp01((P.ratio - 1.0) / 0.72));
    var handY = sh.y + lerp(-1 * s, 4.7 * s, smallGripT);
    var rel = clamp(handY - P.bly, -P.brad + 3, P.brad - 3), halfw = Math.sqrt(Math.max(0, P.brad * P.brad - rel * rel));
    var hand = { x: P.blx - halfw + 1.2 * s, y: handY };
    var rel2 = clamp(handY - 2.2 * s - P.bly, -P.brad + 3, P.brad - 3), hand2 = { x: P.blx - Math.sqrt(Math.max(0, P.brad * P.brad - rel2 * rel2)) + 1.4 * s, y: handY - 2.2 * s };
    var shB = { x: sh.x + 0.9 * s, y: sh.y - 0.9 * s };
    var elbow = PX.ik2(sh.x, sh.y, hand.x, hand.y, 7.6 * s, 7.6 * s, -1);
    var elbow2 = PX.ik2(shB.x, shB.y, hand2.x, hand2.y, 7.6 * s, 7.6 * s, -1);
    elbow.y += pd * 0.8 * s; elbow2.y += pd * 0.8 * s;
    return { hip: hip, sh: sh, shB: shB, neck: neck, head: head, headR: headR, legs: legs, hand: hand, hand2: hand2, elbow: elbow, elbow2: elbow2,
             idle: idle, leanIn: leanIn, brace: brace, ax: ax };
  }

  // summit cheer pose (he lets go, stands, jumps): port of the game's own pose curve
  function rigCheer(P) {
    var s = P.s, release = P.cheer.release, armsUp = P.cheer.arms, jump = P.cheer.jump, bx = P.manBaseX || 0;
    var jy = jump * 22 * s, hip = { x: bx, y: -jy - 16 * s };
    var sh = { x: hip.x + lerp(8.4, 1.2, release) * s, y: hip.y - 12 * s };
    var legs = [];
    for (var leg = 0; leg < 2; leg++) {
      var dir = leg === 0 ? -1 : 1;
      var foot = { x: hip.x + dir * (3 + release * 2.5) * s, y: -jy + jump * 6 * s };
      legs.push({ foot: foot, knee: { x: (hip.x + foot.x) / 2 + dir * 1 * s, y: (hip.y + foot.y) / 2 + (2 + jump * 4) * s }, far: leg === 0, plant: false });
    }
    var neck = { x: sh.x - 0.1 * s, y: sh.y - 1.9 * s }, headR = 4.7 * s, head = { x: neck.x + 0.3 * s, y: neck.y - headR * 0.86 };
    var arms = [];
    for (var arm = 0; arm < 2; arm++) {
      var d = arm === 0 ? -1 : 1;
      var fwdHX = hip.x + 16 * s, fwdHY = sh.y - 1 * s, sideHX = hip.x + d * 5 * s, sideHY = hip.y + 2 * s;
      var upHX = sh.x + d * 9 * s, upHY = sh.y - 20 * s;
      var hX = lerp(lerp(fwdHX, sideHX, release), upHX, armsUp), hY = lerp(lerp(fwdHY, sideHY, release), upHY, armsUp);
      arms.push({ hand: { x: hX, y: hY }, elbow: { x: (sh.x + hX) / 2 + d * 1 * s, y: (sh.y + hY) / 2 - armsUp * 2 * s + 1.4 * s }, far: arm === 0 });
    }
    return { hip: hip, sh: sh, shB: sh, neck: neck, head: head, headR: headR, legs: legs, arms: arms, cheer: true, idle: 0, brace: 0 };
  }

  // ---------- rasteriser ----------
  var sprite = null;
  function draw(sp, P, J) {
    // P.map(lx,ly) -> [sx,sy]; P.z = px per local unit
    var z = P.z, s = P.s, lod = P.lod, L2 = P.light || [-0.4, -0.8], k = P.lightK == null ? 0.6 : P.lightK;
    var minR = lod < 0.35 ? 0.95 : lod < 0.7 ? 0.8 : 0.5;
    function A(x, y) { return P.map(x, y); }                              // -> [sx, sy] (for polygons)
    function M(x, y) { var q = P.map(x, y); return { x: q[0], y: q[1] }; }   // -> {x, y}
    function m(p) { return M(p.x, p.y); }
    function R(u) { return Math.max(minR, u * z); }
    var look = P.look, isColor = look === "color";
    function shadeFn(far) {
      return function (x, y, u, v) {
        var dot = u * L2[0] + v * L2[1], c;
        if (lod < 0.35) return dot > 0.25 && k > 0.05 ? (far ? SLOT.F3 : SLOT.RIM) : (far ? SLOT.F1 : SLOT.T1);
        if (dot > 0.68) c = 3; else if (dot > 0.2) c = 2; else if (dot > -0.45) c = 1; else c = 0;
        if (c === 3 && !isColor && k > 0.06) return far ? SLOT.F3 : SLOT.RIM;
        return (far ? SLOT.F0 : SLOT.T0) + c;
      };
    }
    var hip = m(J.hip), sh = m(J.sh), shB = m(J.shB), neck = m(J.neck), head = m(J.head), hr = Math.max(minR + 0.3, J.headR * z);
    var legs = J.legs.map(function (l) { return { foot: m(l.foot), knee: m(l.knee), far: l.far, plant: l.plant }; });
    var cos = P.cosmetic;

    // plowed dirt behind the dug-in heel (pixel clusters in the ground's own colours)
    if (J.brace > 0.08 && P.playing && lod > 0.3) {
      var bfoot = legs[0].foot, a = 0.4 + J.brace * 0.6, wob = Math.floor(P.tSec * 6);
      for (var dk = 0; dk < 22; dk++) {
        var rx = PX.h1(dk * 7 + 3), ry = PX.h1(dk * 13 + 5), ph = ((P.tSec * 1.9 + dk * 0.37) % 1);
        if (dk < 12) {                                                   // the pile
          if (rx > a) continue;
          var px = Math.round(bfoot.x - (1.5 + rx * 9.5) * z * 0.9), py = Math.round(bfoot.y - ry * (3 + J.brace * 3) * z * 0.7);
          sp.set(px, py, ry > 0.55 ? SLOT.DIRT1 : SLOT.DIRT0);
        } else if (!P.reduced && PX.h2(dk, wob) > 0.45) {                // flung flecks
          var fx = Math.round(bfoot.x - (2 + rx * 6 + ph * 9) * z), fy = Math.round(bfoot.y - Math.sin(ph * Math.PI) * (3 + J.brace * 4) * z);
          sp.set(fx, fy, SLOT.DIRT2);
        }
      }
    }
    // cloak (cosmetic): a cape trailing behind
    if (cos === "cloak" && lod > 0.4) {
      var cape = [A(J.sh.x - 2 * s, J.sh.y + 1 * s), A(J.hip.x - 4 * s, J.hip.y + 2 * s), A(J.hip.x - (17 + J.brace * 4) * s, -3 * s), A(J.hip.x - 6 * s, -2 * s)];
      PX.poly(sp, cape, function (x, y) { return ((x + y) & 3) === 0 ? SLOT.CAPEHI : SLOT.CAPE; });
    }
    // ---- draw order: far limbs, torso, near leg, loincloth, near arm + shoulder, head (last so nothing hides it) ----
    var i;
    function leg(l, far) {
      var shade = shadeFn(far);
      PX.capsule(sp, hip.x, hip.y, l.knee.x, l.knee.y, R(3.6 * s), R(2.8 * s), shade);
      PX.capsule(sp, l.knee.x, l.knee.y, l.foot.x, l.foot.y, R(2.8 * s), R(1.9 * s), shade);
      PX.capsule(sp, l.foot.x - 1.6 * z * s, l.foot.y - 0.9 * z * s, l.foot.x + 3.6 * z * s, l.foot.y - 0.9 * z * s, R(1.35 * s), R(1.2 * s), shade);
    }
    function arm(shoulder, elbow, hand, far) {
      var shade = shadeFn(far), e = M(elbow.x, elbow.y), h = M(hand.x, hand.y);
      PX.capsule(sp, shoulder.x, shoulder.y, e.x, e.y, R(2.75 * s), R(2.3 * s), shade);
      PX.capsule(sp, e.x, e.y, h.x, h.y, R(2.3 * s), R(1.7 * s), shade);
      if (lod > 0.35) PX.disc(sp, h.x + 0.4 * z * s, h.y, R(1.85 * s), shade);
      if (cos === "wraps" && lod > 0.45) {
        var wx = e.x + (h.x - e.x) * 0.72, wy = e.y + (h.y - e.y) * 0.72;
        PX.disc(sp, wx, wy, R(2.1 * s), function () { return SLOT.WRAP; });
      }
    }
    for (i = 0; i < legs.length; i++) if (legs[i].far) leg(legs[i], true);
    if (J.cheer) { J.arms.forEach(function (a) { if (a.far) arm(sh, a.elbow, a.hand, true); }); }
    else arm(shB, J.elbow2, J.hand2, true);
    // torso: broad chest tapering to the waist
    PX.capsule(sp, hip.x, hip.y, sh.x, sh.y, R(3.8 * s), R(5.2 * s), shadeFn(false));
    if (J.idle > 0.02 && lod > 0.5) PX.disc(sp, hip.x + (sh.x - hip.x) * 0.58, hip.y + (sh.y - hip.y) * 0.58, R((1.4 + J.idle * 0.5) * s), shadeFn(false));
    for (i = 0; i < legs.length; i++) if (!legs[i].far) leg(legs[i], false);
    // loincloth: a front flap hanging from the waist, over the thighs
    if (lod > 0.3) {
      var sway = Math.sin(P.tSec * 2.4 + P.wp * 6.28) * 0.9 * s * (P.reduced ? 0 : 1) * (0.4 + P.activity), wl2 = (P.windLean || 0) * 2.2 * s;
      var cl = [A(J.hip.x - 0.4 * s, J.hip.y - 1.6 * s), A(J.hip.x + 5.4 * s, J.hip.y - 1.6 * s),
                A(J.hip.x + 5.0 * s + sway * 0.5 - wl2 * 0.5, J.hip.y + 7.6 * s), A(J.hip.x + 0.2 * s + sway - wl2, J.hip.y + 8.2 * s)];
      var top = Math.min(cl[0][1], cl[1][1]);
      PX.poly(sp, cl, function (x, y) {
        var e = y - top;
        if (e < 1.05 * z * s + 0.4) return SLOT.CLOTHSH;                                   // waistband
        return e > 6.4 * z * s ? SLOT.CLOTHHI : ((((x * 3 + y) % 7) + 7) % 7 === 0 ? SLOT.CLOTHSH : SLOT.CLOTH);
      });
    }
    // shoulder mass, then the near arm
    PX.disc(sp, sh.x + 0.3 * z * s, sh.y + 0.5 * z * s, R(3.7 * s), shadeFn(false));
    if (J.cheer) { J.arms.forEach(function (a) { if (!a.far) arm(sh, a.elbow, a.hand, false); }); }
    else arm(sh, J.elbow, J.hand, false);
    // neck + head last: hair, beard, face
    PX.capsule(sp, neck.x, neck.y, head.x - 0.2 * z * s, head.y + hr * 0.55, R(1.9 * s), R(2.1 * s), shadeFn(false));
    PX.disc(sp, head.x, head.y, hr, function (x, y, u, v) {
      var dot = u * L2[0] + v * L2[1];
      if (lod < 0.35) return dot > 0.2 && k > 0.05 ? SLOT.RIM : SLOT.T1;
      if (v < -0.2 && u < 0.5) return dot > 0.62 ? SLOT.HAIRHI : SLOT.HAIR;                       // hair cap
      if (u > 0.2 && v > 0.2) return SLOT.BEARD;                                                    // beard along the jaw
      if (isColor && u > 0.35 && v > -0.35 && v < -0.05 && lod > 0.7) return SLOT.EYE;
      return dot > 0.55 ? SLOT.T3 : dot > 0.0 ? SLOT.T2 : SLOT.T1;
    });
    if (lod > 0.55) sp.set(head.x + hr + 0.4, head.y + hr * 0.05, isColor ? SLOT.T2 : (k > 0.06 ? SLOT.T3 : SLOT.T1));   // the nose: a face in profile, looking at the stone
    if (cos === "headband" && lod > 0.45) PX.capsule(sp, head.x - hr * 0.9, head.y - hr * 0.25, head.x + hr * 0.7, head.y - hr * 0.25, Math.max(0.6, 0.6 * z * s), Math.max(0.6, 0.6 * z * s), function () { return SLOT.BAND; });
    if (cos === "laurel" && lod > 0.45) for (var li = -2; li <= 2; li++) sp.set(head.x + li * 1.6 * z * s, head.y - hr - (Math.abs(li) % 2) * z * s * 0.8, SLOT.LAUREL);

    // a rim glint so a tiny figure never disappears into the scenery
    if (lod < 0.5 && k > 0.03) {
      var gx = head.x + L2[0] * hr, gy = head.y + L2[1] * hr; sp.set(gx, gy, SLOT.GLINT);
      sp.set(sh.x + L2[0] * R(4 * s), sh.y + L2[1] * R(4 * s), SLOT.GLINT);
    }
    if (cos === "aura" && lod > 0.3) {
      var ar = hr + 5 * z * s;
      for (var an = 0; an < 40; an++) { var aa = an / 40 * 6.2832; if ((an & 1) === 0) sp.set(head.x + Math.cos(aa) * ar, head.y + Math.sin(aa) * ar, SLOT.AURA); }
    }
    if (cos === "bronze" && lod > 0.5) { sp.set(head.x - 1, head.y - hr, SLOT.BRONZE); sp.set(sh.x, sh.y - 2 * z * s, SLOT.BRONZE); }
    // sweat after sustained pushing
    if (P.pushTime > 10 && lod > 0.55) {
      var sw = Math.min(1, (P.pushTime - 10) / 2), dy = P.reduced ? hr : ((P.tSec * 16) % 18) * z * s * 0.5;
      sp.set(head.x - hr, head.y - hr * 0.3, SLOT.SWEAT); if (sw > 0.5) sp.set(head.x - hr + 1, head.y + dy, SLOT.SWEAT);
    }
  }

  // ---------- public ----------
  root.Hero = { SLOT: SLOT, palette: palette, rig: rig, rigCheer: rigCheer, draw: draw };
})(typeof window !== "undefined" ? window : this);
