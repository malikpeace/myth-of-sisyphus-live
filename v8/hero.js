// V8 hero (v2): Sisyphus drawn natively on the world's pixel grid.
//
// The pose logic is the game's own rig (walk cycle, brace, stumble, push-drive, wind lean, lean-in on giant stones,
// hands on the stone's surface), re-proportioned as an athletic figure (about six heads tall, long legs, a spine that
// leans into the stone, head carried forward, straight-ish arms). Joints are computed in the slope's local frame, mapped
// to SCREEN pixels (slope rotation + camera zoom applied to the skeleton, never to a bitmap) and rasterised as profiled
// muscle silhouettes with banded shading, a warm sun rim and a cool stone-bounce fill, then an ink outline.
//
// Two looks share one rig:  "shadow" = dark, backlit, rim-lit   |   "color" = full-colour figure (default).
// Level of detail: as the camera pulls out he simplifies gracefully down to a rim-lit speck that never vanishes.
(function (root) {
  "use strict";
  var PX = root.PX;
  var clamp = PX.clamp, clamp01 = PX.clamp01, lerp = PX.lerp, smooth01 = PX.smooth01;

  // slot numbers in the shared actor sprite (rock owns 1..13; 14/15 belong to the belt + outline)
  var SLOT = { BELT: 14, OUT: 15, T0: 16, T1: 17, T2: 18, T3: 19, RIM: 20, HAIRLO: 21, SANDAL: 22, SASH: 23, CLOTHDEEP: 24, CLOTH: 25, CLOTHHI: 26, CLOTHSH: 27,
    HAIR: 28, HAIRHI: 29, BEARD: 30, EYE: 31, WRAP: 32, BAND: 33, LAUREL: 34, AURA: 35, BRONZE: 36, SWEAT: 37,
    DIRT0: 38, DIRT1: 39, DIRT2: 40, CAPE: 41, CAPEHI: 42, GLINT: 43 };

  // ---------- palette for the figure ----------
  // o: look ("shadow"|"color"), cosmetic, ambient [r,g,b] (sky tone), sunCol [r,g,b], sunK 0..1, bright 0..1 (how lit the world is), ground [r,g,b]
  function palette(o) {
    var p = [], A = o.ambient || [90, 100, 130], C = o.sunCol || [255, 226, 176], k = clamp01(o.sunK == null ? 0.6 : o.sunK);
    var kk = Math.pow(k, 0.7), bright = clamp01(o.bright == null ? 0.7 : o.bright);
    var T, cloth, hair, sash, sandal, outCol, ink;
    if (o.look === "color") {
      var f = 0.46 + 0.54 * bright;
      var base = [[54, 30, 46], [106, 60, 56], [166, 104, 68], [222, 160, 104]].map(function (c) { return [c[0] * f, c[1] * f, c[2] * f]; });   // hue-shifted: cool plum shadows, warm lights
      T = [PX.mix(base[0], A, 0.14), PX.mix(base[1], A, 0.10), PX.mix(base[2], C, 0.12 * kk), PX.mix(base[3], C, 0.24 * kk)];
      cloth = PX.mix([228, 216, 190], A, 0.12 + 0.28 * (1 - bright)); hair = PX.mix([54, 36, 30], A, 0.10);
      sash = PX.mix([176, 62, 46], A, 0.10 + 0.2 * (1 - bright)); sandal = PX.mix([88, 56, 38], A, 0.12); outCol = PX.mix([30, 18, 26], A, 0.08);
    } else {
      ink = PX.mix([7, 6, 12], A, 0.045);
      T = [ink, PX.mix(ink, A, 0.16), PX.mix(PX.mix(ink, A, 0.30), C, 0.16 * kk), PX.mix(ink, C, 0.48 * kk + 0.04)];   // dark, backlit: sky fill lifts upward planes to cool slate, the sun paints only the rim
      cloth = PX.mix(ink, [172, 86, 54], 0.30 + 0.12 * bright); hair = PX.mix(ink, [92, 76, 66], 0.30 + 0.25 * kk);
      sash = PX.mix(ink, [150, 52, 40], 0.42); sandal = PX.mix(ink, [70, 48, 34], 0.5); outCol = ink;
    }
    if (o.cosmetic === "bronze") T = T.map(function (c) { return PX.mix(c, [96, 112, 88], 0.55); });
    var rim = PX.mix(C, [255, 255, 255], 0.22);
    p[SLOT.T0] = T[0]; p[SLOT.T1] = T[1]; p[SLOT.T2] = T[2]; p[SLOT.T3] = T[3];
    p[SLOT.RIM] = k > 0.06 ? PX.mix(T[3], rim, clamp01(0.35 + kk * 0.7)) : T[3];
    p[SLOT.CLOTH] = cloth; p[SLOT.CLOTHHI] = PX.mix(cloth, C, 0.30 * kk + 0.10); p[SLOT.CLOTHSH] = PX.mix(cloth, T[0], 0.32); p[SLOT.CLOTHDEEP] = PX.mix(cloth, T[0], 0.62);
    p[SLOT.HAIR] = hair; p[SLOT.HAIRHI] = PX.mix(hair, C, 0.5 * kk + 0.1); p[SLOT.HAIRLO] = PX.mix(hair, [8, 6, 10], 0.5); p[SLOT.BEARD] = PX.mix(hair, T[1], 0.22);
    p[SLOT.SASH] = sash; p[SLOT.SANDAL] = sandal; p[SLOT.BELT] = PX.mix(T[0], [72, 48, 34], 0.5); p[SLOT.OUT] = outCol;
    p[SLOT.EYE] = [16, 12, 14];
    p[SLOT.WRAP] = [214, 208, 190]; p[SLOT.BAND] = [188, 52, 52]; p[SLOT.LAUREL] = [158, 176, 96]; p[SLOT.AURA] = [150, 132, 230];
    p[SLOT.BRONZE] = [222, 190, 110]; p[SLOT.SWEAT] = [140, 190, 236];
    var g = o.ground || [82, 58, 40];
    p[SLOT.DIRT0] = PX.mix(g, [0, 0, 0], 0.42); p[SLOT.DIRT1] = PX.mix(g, [40, 26, 18], 0.55); p[SLOT.DIRT2] = PX.mix(g, [200, 176, 140], 0.25);
    p[SLOT.CAPE] = PX.mix(T[0], [30, 26, 40], 0.5); p[SLOT.CAPEHI] = PX.mix(T[1], C, 0.15 * kk);
    p[SLOT.GLINT] = PX.mix(C, [255, 255, 255], 0.4);
    return p;
  }

  // ---------- the rig (local frame: x forward, y DOWN, floor at y = 0; all lengths scale with s) ----------
  // Proportions (units of s): thigh 10.3 + shin 9.9 + foot 2.3, torso 13.6, neck 2.3, head radius 3.75, upper arm 8.2 + forearm 7.8.
  var THIGH = 11.2, SHIN = 10.6, FOOT = 2.3, TORSO = 13.2, UARM = 8.2, FARM = 7.8, HEADR = 3.9;
  function rig(P) {
    var s = P.s, brace = P.brace, stumble = P.stumble, pd = P.pushDrive, wl = P.windLean || 0, gY = 0;
    var ax = P.manBaseX || 0;
    var giantT = smooth01(clamp01((P.ratio - 1.6) / 1.2)), leanIn = 0;
    if (giantT > 0.001) {                                            // giant stone: the whole body steps in so a bent arm reaches it
      var estShY = gY - 29.2 * s, estRel = clamp(estShY - 1 * s - P.bly, -P.brad + 3, P.brad - 3);
      var estHalf = Math.sqrt(Math.max(0, P.brad * P.brad - estRel * estRel)), chordX = P.blx - estHalf - 1 * s;
      leanIn = Math.min(14 * s, Math.max(0, (chordX - (ax + 9.2 * s)) - 15 * s) * giantT * 0.72);
    }
    ax += leanIn;
    var wph = P.wp * 6.2832;
    var bobAmp = 0.95 * P.activity * s * (1 - brace * 0.55);
    var bob = -(0.5 - 0.5 * Math.cos(2 * wph)) * bobAmp;                 // the hips rise at the passing poses, drop at the contacts
    var idle = (P.playing && P.activity < 0.035 && P.effort < 0.055 && P.slideEffort < 0.04 && stumble < 0.04) ? (Math.sin(P.tSec * 2.05) * 0.5 + 0.5) * (P.reduced ? 0.28 : 1) : 0;
    var hipH = 18.3 * s;
    var hip = { x: ax - brace * 3.0 * s - stumble * 1.8 * s + pd * 1.1 * s - wl * 0.6 * s,
                y: gY - hipH + bob + brace * 2.2 * s + stumble * 2.6 * s + pd * 0.8 * s };
    var lean = 0.62 + brace * 0.30 + stumble * 0.16 + pd * 0.09 + wl * 0.12 + giantT * 0.05 - idle * 0.03;     // spine angle from vertical (rad)
    var sh = { x: hip.x + Math.sin(lean) * TORSO * s, y: hip.y - Math.cos(lean) * TORSO * s + bob * 0.4 + stumble * 0.8 * s };
    var idleHeadT = 1 - smooth01(clamp01(P.activity / 0.06));
    var nl = lean * 0.95 - 0.08, neckLen = (2.7 + 0.7 * idleHeadT) * s;
    var neck = { x: sh.x + Math.sin(nl) * neckLen, y: sh.y - Math.cos(nl) * neckLen };
    var headR = HEADR * s, ht = lean * 0.30 - 0.03 * idle;                 // the head lifts toward the horizon: less tilted than the spine
    var head = { x: neck.x + Math.sin(ht) * headR * 0.92, y: neck.y - Math.cos(ht) * headR * 0.92 };
    var L1 = THIGH * s, L2 = SHIN * s, legLen = L1 + L2, ankleY = gY - FOOT * s;
    function reach(f, planted) {                                          // never over-extend a leg: a planted foot slides in along the floor, a lifted one along the line
      var dx = f.x - hip.x, dy = f.y - hip.y, d = Math.sqrt(dx * dx + dy * dy), mx = legLen * 0.992;
      if (d > mx) {
        if (planted) f.x = hip.x + (dx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, mx * mx - dy * dy));
        else { var kf = mx / d; f.x = hip.x + dx * kf; f.y = hip.y + dy * kf; }
      }
      return f;
    }
    var legs = [];
    if (brace > 0.08) {                                              // dug in: the stone is forcing him back down the slope
      var bf = reach({ x: hip.x - (17 + brace * 2 + pd * 1.0) * s, y: ankleY }, true), ff = reach({ x: hip.x - (5.6 + brace * 1.4 + pd * 0.3) * s, y: ankleY }, true);
      legs.push({ foot: bf, knee: PX.ik2(hip.x, hip.y, bf.x, bf.y, L1, L2, 1), far: true, plant: true, ang: -0.28 * brace });
      legs.push({ foot: ff, knee: PX.ik2(hip.x, hip.y, ff.x, ff.y, L1, L2, 1), far: false, plant: true, ang: 0 });
    } else {
      var stepReach = 6.4 * s * (1 - wl * 0.4) * (1 + (P.groove || 0) * 0.3), stepLift = 5.0 * s;
      for (var leg = 0; leg < 2; leg++) {
        var ph = (P.wp + leg * 0.5) * 6.2832, fwd = Math.cos(ph), sw = Math.sin(ph), lift = Math.max(0, sw) * stepLift * P.activity;
        var ankle = reach({ x: hip.x - (7.4 - stumble * 1.0) * s - fwd * stepReach, y: ankleY - lift }, lift < 0.01);
        var ang = (sw > 0 ? -0.6 * fwd : -0.55 * Math.max(0, (fwd - 0.55) / 0.45)) * P.activity;          // toe-off, toe up into the contact
        legs.push({ foot: ankle, knee: PX.ik2(hip.x, hip.y, ankle.x, ankle.y, L1, L2, 1), far: leg === 1, plant: lift < 0.01, ang: ang });
      }
    }
    for (var li = 0; li < legs.length; li++) legs[li].ground = { x: legs[li].foot.x - 1.0 * s, y: gY };
    // arms: both hands on the stone's surface
    var smallGripT = 1 - smooth01(clamp01((P.ratio - 1.0) / 0.72));
    var handY = sh.y + lerp(-1 * s, 4.7 * s, smallGripT);
    var rel = clamp(handY - P.bly, -P.brad + 3, P.brad - 3), halfw = Math.sqrt(Math.max(0, P.brad * P.brad - rel * rel));
    var hand = { x: P.blx - halfw + 1.2 * s, y: handY };
    var rel2 = clamp(handY - 2.2 * s - P.bly, -P.brad + 3, P.brad - 3), hand2 = { x: P.blx - Math.sqrt(Math.max(0, P.brad * P.brad - rel2 * rel2)) + 1.4 * s, y: handY - 2.2 * s };
    var shB = { x: sh.x + 0.7 * s, y: sh.y - 0.8 * s };
    var elbow = PX.ik2(sh.x, sh.y, hand.x, hand.y, UARM * s, FARM * s, -1);
    var elbow2 = PX.ik2(shB.x, shB.y, hand2.x, hand2.y, UARM * s, FARM * s, -1);
    elbow.y += pd * 0.8 * s; elbow2.y += pd * 0.8 * s;
    return { hip: hip, sh: sh, shB: shB, neck: neck, head: head, headR: headR, legs: legs, hand: hand, hand2: hand2, elbow: elbow, elbow2: elbow2,
             idle: idle, leanIn: leanIn, brace: brace, ax: ax, lean: lean, ht: ht };
  }

  // summit cheer pose (he lets go, stands, jumps): port of the game's own pose curve, on the new skeleton
  function rigCheer(P) {
    var s = P.s, release = P.cheer.release, armsUp = P.cheer.arms, jump = P.cheer.jump, bx = P.manBaseX || 0;
    var jy = jump * 22 * s, hip = { x: bx, y: -jy - 20.6 * s };
    var lean = lerp(0.62, 0.05, release), ht = lean * 0.4 - armsUp * 0.12;
    var sh = { x: hip.x + Math.sin(lean) * TORSO * s, y: hip.y - Math.cos(lean) * TORSO * s };
    var legs = [], L1 = THIGH * s, L2 = SHIN * s;
    for (var leg = 0; leg < 2; leg++) {
      var dir = leg === 0 ? -1 : 1;
      var ankle = { x: hip.x + dir * (3.2 + release * 2.6) * s, y: -jy + jump * 6 * s - FOOT * s };
      legs.push({ foot: ankle, knee: PX.ik2(hip.x, hip.y, ankle.x, ankle.y, L1, L2, 1), far: leg === 0, plant: false, ang: -0.35 * jump, ground: { x: ankle.x - 1.0 * s, y: -jy + jump * 6 * s } });
    }
    var nl = lean * 0.8 - 0.06, neckLen = 2.6 * s, neck = { x: sh.x + Math.sin(nl) * neckLen, y: sh.y - Math.cos(nl) * neckLen }, headR = HEADR * s;
    var head = { x: neck.x + Math.sin(ht) * headR * 0.92, y: neck.y - Math.cos(ht) * headR * 0.92 };
    var arms = [];
    for (var arm = 0; arm < 2; arm++) {
      var d = arm === 0 ? -1 : 1;
      var fwdHX = hip.x + 16 * s, fwdHY = sh.y - 1 * s, sideHX = hip.x + d * 5 * s, sideHY = hip.y + 2 * s;
      var upHX = sh.x + d * 9 * s, upHY = sh.y - 20 * s;
      var hX = lerp(lerp(fwdHX, sideHX, release), upHX, armsUp), hY = lerp(lerp(fwdHY, sideHY, release), upHY, armsUp);
      var shp = arm === 0 ? { x: sh.x + 0.7 * s, y: sh.y - 0.8 * s } : sh;
      var el = PX.ik2(shp.x, shp.y, hX, hY, UARM * s, FARM * s, d < 0 ? -1 : 1);
      arms.push({ hand: { x: hX, y: hY }, elbow: el, far: arm === 0 });
    }
    return { hip: hip, sh: sh, shB: { x: sh.x + 0.7 * s, y: sh.y - 0.8 * s }, neck: neck, head: head, headR: headR, legs: legs, arms: arms, cheer: true, idle: 0, brace: 0, lean: lean, ht: ht };
  }

  // ---------- rasteriser ----------
  function isBody(v) { return (v >= 16 && v <= 34) || v === 14; }
  function draw(sp, P, J) {
    var z = P.z, s = P.s, lod = P.lod, L2 = P.light || [-0.4, -0.8], k = P.lightK == null ? 0.6 : P.lightK;
    var isColor = P.look === "color", cos = P.cosmetic, i;
    var minR = lod < 0.3 ? 1.0 : lod < 0.6 ? 0.85 : 0.55, hz = s * z;
    function A(x, y) { return P.map(x, y); }
    function M(x, y) { var q = P.map(x, y); return { x: q[0], y: q[1] }; }
    function m(p) { return M(p.x, p.y); }
    function R(u) { return Math.max(minR, u * z); }
    var o0 = A(0, 0), o1 = A(1, 0), o2 = A(0, 1), fwdV = [o1[0] - o0[0], o1[1] - o0[1]], dnV = [o2[0] - o0[0], o2[1] - o0[1]];
    function off(p, ax, ay) { return { x: p.x + fwdV[0] * ax + dnV[0] * ay, y: p.y + fwdV[1] * ax + dnV[1] * ay }; }       // local-frame offset in px (ax, ay already multiplied by s)
    function lp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
    function dirL(lx, ly) { var vx = fwdV[0] * lx + dnV[0] * ly, vy = fwdV[1] * lx + dnV[1] * ly, l = Math.sqrt(vx * vx + vy * vy) || 1; return [vx / l, vy / l]; }
    function prof(pts) {                                                        // width profile along a limb (rig units -> px), smooth between the control points
      return function (t) {
        var n = pts.length, j = 0; while (j < n - 2 && t > pts[j + 1][0]) j++;
        var a = pts[j], b = pts[j + 1], u = clamp01((t - a[0]) / ((b[0] - a[0]) || 1)); u = u * u * (3 - 2 * u);
        return Math.max(minR * 0.9, (a[1] + (b[1] - a[1]) * u) * hz);
      };
    }
    // light: the sun from behind/above (rim) plus a cool bounce off the stone in front - so the face, chest and forearms stay readable
    var FL = [0.93, 0.26];
    function tone(far) {
      return function (x, y, u, v) {
        var dot = u * L2[0] + v * L2[1], c;
        if (lod < 0.16) return dot > 0.25 && k > 0.05 ? (far ? SLOT.T2 : SLOT.RIM) : SLOT.T1;
        if (isColor) {
          var d = Math.max(dot, (u * FL[0] + v * FL[1]) * 0.5);
          if (dot >= 0.74 && k > 0.06 && !far) return SLOT.RIM;
          c = d >= 0.50 ? 3 : d >= -0.10 ? 2 : d >= -0.56 ? 1 : 0;
        } else {
          if (dot > 0.66 && k > 0.06) return far ? SLOT.T2 : SLOT.RIM;
          c = dot >= 0.10 ? 2 : dot >= -0.42 ? 1 : 0;
        }
        if (far) c = Math.max(0, c - 1);
        return SLOT.T0 + c;
      };
    }
    var hip = m(J.hip), sh = m(J.sh), shB = m(J.shB), neck = m(J.neck), head = m(J.head), hr = Math.max(minR + 0.4, J.headR * z);
    var legs = J.legs.map(function (l) { return { foot: m(l.foot), knee: m(l.knee), far: l.far, plant: l.plant, ang: l.ang || 0, ground: m(l.ground || l.foot) }; });
    var cosm = P.cosmetic;

    if (lod < 0.16) { drawSimple(sp, P, J, legs, hip, sh, shB, neck, head, hr, tone, R, minR); return; }

    // plowed dirt behind the dug-in heel (pixel clusters in the ground's own colours)
    if (J.brace > 0.08 && P.playing && lod > 0.4) {
      var bfoot = legs[0].ground, a = 0.4 + J.brace * 0.6, wob = Math.floor(P.tSec * 6);
      for (var dk = 0; dk < 22; dk++) {
        var rx = PX.h1(dk * 7 + 3), ry = PX.h1(dk * 13 + 5), phd = ((P.tSec * 1.9 + dk * 0.37) % 1);
        if (dk < 12) {
          if (rx > a) continue;
          sp.set(Math.round(bfoot.x - (1.5 + rx * 9.5) * z * 0.9), Math.round(bfoot.y - ry * (3 + J.brace * 3) * z * 0.7), ry > 0.55 ? SLOT.DIRT1 : SLOT.DIRT0);
        } else if (!P.reduced && PX.h2(dk, wob) > 0.45) {
          sp.set(Math.round(bfoot.x - (2 + rx * 6 + phd * 9) * z), Math.round(bfoot.y - Math.sin(phd * Math.PI) * (3 + J.brace * 4) * z), SLOT.DIRT2);
        }
      }
    }
    // cloak (cosmetic): a cape trailing behind
    if (cosm === "cloak") {
      var cape = [A(J.sh.x - 2 * s, J.sh.y + 1 * s), A(J.hip.x - 4 * s, J.hip.y + 2 * s), A(J.hip.x - (17 + J.brace * 4) * s, -3 * s), A(J.hip.x - 6 * s, -2 * s)];
      PX.poly(sp, cape, function (x, y) { return ((x + y) & 3) === 0 ? SLOT.CAPEHI : SLOT.CAPE; });
    }

    // ---- muscle silhouettes (rig units; half-widths toward the front / the back of each limb) ----
    var TH_F = prof([[0, 4.5], [0.42, 4.55], [1, 2.7]]), TH_B = prof([[0, 4.3], [0.4, 3.7], [1, 2.6]]);                 // thigh: quad sweep in front, glute -> hamstring behind
    var SH_F = prof([[0, 2.7], [0.5, 2.15], [1, 1.5]]), SH_B = prof([[0, 2.7], [0.28, 3.5], [0.7, 2.3], [1, 1.45]]);   // shin: straight front, calf bulge behind
    var UA_F = prof([[0, 3.3], [0.4, 3.4], [1, 2.35]]), UA_B = prof([[0, 3.35], [0.38, 3.45], [1, 2.4]]);                // upper arm: biceps / triceps
    var FA_F = prof([[0, 2.55], [0.32, 2.65], [1, 1.5]]), FA_B = prof([[0, 2.65], [0.3, 2.8], [1, 1.5]]);                 // forearm
    var TO_F = prof([[0, 2.9], [0.2, 2.7], [0.6, 4.2], [1, 3.3]]), TO_B = prof([[0, 2.9], [0.3, 3.1], [0.7, 3.7], [1, 3.9]]);   // torso: waist -> chest / lats -> trapezius
    var NE = prof([[0, 2.5], [1, 1.95]]);

    function legDraw(l, far) {
      var t = tone(far);
      PX.limb(sp, hip.x, hip.y, l.knee.x, l.knee.y, TH_F, TH_B, t, -1);
      PX.limb(sp, l.knee.x, l.knee.y, l.foot.x, l.foot.y, SH_F, SH_B, t, -1);
      PX.disc(sp, l.knee.x, l.knee.y, R(2.75 * s), t);                                                                  // a round knee
      PX.disc(sp, l.foot.x, l.foot.y, R(1.6 * s), t);
      var ca = Math.cos(-l.ang), sa = Math.sin(-l.ang);
      function lf(px, py) { return off(l.foot, (px * ca - py * sa) * s, (px * sa + py * ca) * s); }
      var heel = lf(-1.1, 1.0), toe = lf(4.3, 1.35), s0 = lf(-1.5, 2.25), s1 = lf(4.6, 2.2);
      PX.capsule(sp, heel.x, heel.y, toe.x, toe.y, R(1.5 * s), R(1.05 * s), t);                                        // the foot
      PX.capsule(sp, s0.x, s0.y, s1.x, s1.y, R(0.72 * s), R(0.68 * s), function () { return SLOT.SANDAL; });          // the leather sole
      if (lod > 0.55) { var st = lf(2.0, 0.6), an = lf(0.2, -0.4); sp.set(st.x, st.y, SLOT.SANDAL); sp.set(an.x, an.y, SLOT.SANDAL); }   // straps
    }
    function armDraw(shoulder, elbow, hand, far) {
      var t = tone(far), e = m(elbow), h = m(hand);
      PX.limb(sp, shoulder.x, shoulder.y, e.x, e.y, UA_F, UA_B, t, 1);
      PX.limb(sp, e.x, e.y, h.x, h.y, FA_F, FA_B, t, 1);
      PX.disc(sp, e.x, e.y, R(2.35 * s), t);                                                                            // a round elbow
      PX.disc(sp, h.x + 0.4 * hz, h.y, R(1.75 * s), t);
      if (cosm === "wraps" && lod > 0.45) { var wp2 = lp(e, h, 0.72); PX.disc(sp, wp2.x, wp2.y, R(2.1 * s), function () { return SLOT.WRAP; }); }
    }

    var DARK = {}; DARK[SLOT.RIM] = SLOT.T1; DARK[SLOT.T3] = SLOT.T1; DARK[SLOT.T2] = SLOT.T1; DARK[SLOT.T1] = SLOT.T0; DARK[SLOT.CLOTHHI] = SLOT.CLOTHSH; DARK[SLOT.CLOTH] = SLOT.CLOTHDEEP; DARK[SLOT.CLOTHSH] = SLOT.CLOTHDEEP;
    DARK[SLOT.SASH] = SLOT.BELT; DARK[SLOT.HAIRHI] = SLOT.HAIR; DARK[SLOT.HAIR] = SLOT.HAIRLO; DARK[SLOT.BEARD] = SLOT.HAIRLO; DARK[SLOT.SANDAL] = SLOT.BELT;
    function castShade(x, y) { return DARK[sp.get(x, y)] || 0; }
    var shx = 1.3 * hz, shy = 1.7 * hz;                                                                                // the sun is up-left, so shadows fall down-right
    function castLimb(a, b, F, B, fs) { if (isColor && lod > 0.55) PX.limb(sp, a.x + shx, a.y + shy, b.x + shx, b.y + shy, F, B, castShade, fs); }
    // ---- draw order: far arm + leg, torso, near leg, kilt, near arm + shoulder, neck, head, hair ----
    if (J.cheer) J.arms.forEach(function (a2) { if (a2.far) armDraw(shB, a2.elbow, a2.hand, true); }); else armDraw(shB, J.elbow2, J.hand2, true);
    for (i = 0; i < legs.length; i++) if (legs[i].far) legDraw(legs[i], true);
    castLimb(hip, sh, TO_F, TO_B, 1);
    PX.limb(sp, hip.x, hip.y, sh.x, sh.y, TO_F, TO_B, tone(false), 1);                                                 // torso
    PX.disc(sp, hip.x, hip.y + 0.4 * hz, R(3.9 * s), tone(false));                                                    // pelvis: joins the torso to both thighs
    if (J.idle > 0.02) PX.disc(sp, lp(hip, sh, 0.55).x, lp(hip, sh, 0.55).y, R((1.2 + J.idle * 0.5) * s), tone(false));   // breathing
    for (i = 0; i < legs.length; i++) if (!legs[i].far) legDraw(legs[i], false);

    // kilt: a belted linen wrap; the belt follows the pelvis, the cloth hangs straight down by gravity (trailing him as he pushes), hem torn into teeth
    var nx = Math.cos(J.lean), ny = Math.sin(J.lean);
    var bk = A(J.hip.x - nx * 2.7 * s, J.hip.y - ny * 2.7 * s), ft = A(J.hip.x + nx * 3.1 * s, J.hip.y + ny * 3.1 * s), span = Math.max(1, ft[0] - bk[0]);
    var flow = (P.reduced ? 0 : -(0.6 + P.activity * 1.4 + (P.windLean || 0) * 2.4) + Math.sin(P.tSec * 2.4 + P.wp * 6.28) * 0.7 * (0.4 + P.activity)) * hz;
    var cl = [bk, ft, [ft[0] + 1.8 * hz + flow * 0.3, ft[1] + 8.6 * hz], [ft[0] - 0.8 * hz + flow * 0.6, ft[1] + 10.0 * hz], [bk[0] + span * 0.58 + flow * 0.7, bk[1] + 8.9 * hz],
              [bk[0] + span * 0.30 + flow * 0.85, bk[1] + 10.0 * hz], [bk[0] - 1.2 * hz + flow, bk[1] + 8.2 * hz]];
    var top = Math.min(bk[1], ft[1]);
    PX.poly(sp, cl, function (x, y) {
      var e = y - top, col = (x - bk[0]) / span;
      if (e < 1.7 * hz) return SLOT.SASH;                                                                            // the sash at the waist
      if (e > 8.2 * hz) return col > 0.45 ? SLOT.CLOTHDEEP : SLOT.CLOTHSH;                                            // hem in shadow
      var f1 = 0.34 + e / (10 * hz) * 0.05, f2 = 0.66 + e / (10 * hz) * 0.04, w = 0.55 / Math.max(2, span);
      if (Math.abs(col - f1) < w || Math.abs(col - f2) < w) return SLOT.CLOTHDEEP;                                    // two vertical folds
      return col < 0.22 ? SLOT.CLOTHHI : (col > 0.78 ? SLOT.CLOTHSH : SLOT.CLOTH);
    });
    if (lod > 0.55) {                                                                                                 // the sash knot and a trailing tail
      var kn = lp(bk, ft, 0.08), tl0 = [kn.x - 0.6 * hz, kn.y + 0.6 * hz], tl1 = [kn.x - 3.2 * hz + flow * 0.4, kn.y + 1.8 * hz + Math.sin(P.tSec * 5) * 0.5 * hz], tl2 = [kn.x - 6.0 * hz + flow * 0.7, kn.y + 3.4 * hz];
      PX.capsule(sp, tl0[0], tl0[1], tl1[0], tl1[1], R(0.9 * s), R(0.7 * s), function () { return SLOT.SASH; });
      PX.capsule(sp, tl1[0], tl1[1], tl2[0], tl2[1], R(0.7 * s), R(0.4 * s), function () { return SLOT.SASH; });
    }

    if (lod > 0.6) {                                                                                                  // a leather baldric from the far shoulder across the chest
      var sa0 = off(lp(hip, sh, 0.96), -2.6 * s, -0.4 * s), sa1 = off(lp(hip, sh, 0.34), 3.4 * s, 0.4 * s);
      PX.capsule(sp, sa0.x, sa0.y, sa1.x, sa1.y, R(1.0 * s), R(1.0 * s), function (x, y, u, v) { return (u * L2[0] + v * L2[1]) > 0.5 ? SLOT.BELT : SLOT.SANDAL; });
    }
    // near arm, shoulder mass, neck
    if (isColor && lod > 0.55) { var ne2 = m(J.cheer ? J.arms[1].elbow : J.elbow), nh2 = m(J.cheer ? J.arms[1].hand : J.hand); castLimb(sh, ne2, UA_F, UA_B, 1); castLimb(ne2, nh2, FA_F, FA_B, 1); }
    PX.disc(sp, sh.x + 0.3 * hz, sh.y + 0.5 * hz, R(3.5 * s), tone(false));
    if (J.cheer) J.arms.forEach(function (a2) { if (!a2.far) armDraw(sh, a2.elbow, a2.hand, false); }); else armDraw(sh, J.elbow, J.hand, false);
    PX.limb(sp, sh.x, sh.y, neck.x, neck.y, NE, NE, tone(false), 1);
    if (isColor && lod > 0.55) { var hsx = head.x + shx * 0.8, hsy = head.y + shy * 0.8; for (var ay = -Math.ceil(hr); ay <= Math.ceil(hr); ay++) for (var ax2 = -Math.ceil(hr); ax2 <= Math.ceil(hr); ax2++) if (ax2 * ax2 + ay * ay <= hr * hr) { var sx = Math.floor(hsx + ax2), sy = Math.floor(hsy + ay), dk = castShade(sx, sy); if (dk) sp.set(sx, sy, dk); } }

    // ---- head: a proper skull + jaw, hair with a hairline, a full beard, brow, eye, nose, ear ----
    var hu = dirL(Math.sin(J.ht), -Math.cos(J.ht)), hf = dirL(Math.cos(J.ht), Math.sin(J.ht)), hrr = hr * 1.02;
    var bx0 = Math.floor(head.x - hrr * 1.6), bx1 = Math.ceil(head.x + hrr * 1.6), by0 = Math.floor(head.y - hrr * 1.6), by1 = Math.ceil(head.y + hrr * 1.6);
    for (var py = by0; py <= by1; py++) for (var px2 = bx0; px2 <= bx1; px2++) {
      var rx2 = px2 + 0.5 - head.x, ry2 = py + 0.5 - head.y, lu = (rx2 * hu[0] + ry2 * hu[1]) / hr, lf = (rx2 * hf[0] + ry2 * hf[1]) / hr;
      var skull = (lu / 1.07) * (lu / 1.07) + (lf / 0.95) * (lf / 0.95) <= 1, jaw = ((lf - 0.3) / 0.62) * ((lf - 0.3) / 0.62) + ((lu + 0.44) / 0.56) * ((lu + 0.44) / 0.56) <= 1;
      var hairVol = ((lf + 0.24) / 1.05) * ((lf + 0.24) / 1.05) + ((lu - 0.1) / 1.1) * ((lu - 0.1) / 1.1) <= 1 && (lu > 0.0 || lf < -0.34);
      var beardVol = ((lf - 0.12) / 0.7) * ((lf - 0.12) / 0.7) + ((lu + 0.6) / 0.46) * ((lu + 0.6) / 0.46) <= 1 && lf > -0.32;
      if (!(skull || jaw || hairVol || beardVol)) continue;
      var hairLine = lf >= 0.3 ? 0.56 : 0.56 - (0.3 - lf) * 1.55, nxn = rx2 / (hr * 1.1), nyn = ry2 / (hr * 1.1), dS = nxn * L2[0] + nyn * L2[1], dF = (nxn * FL[0] + nyn * FL[1]) * (isColor ? 0.55 : 0), dd = Math.max(dS, dF), slot;
      if (lu > hairLine && (skull || hairVol) || (hairVol && !skull && lu > -0.2)) slot = dS > 0.62 && k > 0.05 ? SLOT.HAIRHI : (dd > -0.25 ? SLOT.HAIR : SLOT.HAIRLO);
      else if (lu < -0.10 && lf > -0.30 && (jaw || beardVol || skull)) slot = dS > 0.7 && k > 0.06 ? SLOT.HAIRHI : (dd > -0.1 ? SLOT.BEARD : SLOT.HAIRLO);
      else if (skull || jaw) slot = tone(false)(px2, py, nxn, nyn);
      else continue;
      sp.set(px2, py, slot);
    }
    if (hr >= 2.6 && lod > 0.55) {                                                                                     // face details, placed in the head's own frame
      function hp(lfv, luv) { return [head.x + hf[0] * lfv * hr + hu[0] * luv * hr, head.y + hf[1] * lfv * hr + hu[1] * luv * hr]; }
      var nose = hp(1.08, -0.02), brow = hp(0.56, 0.34), eye = hp(0.56, 0.16), ear = hp(-0.16, 0.06);
      sp.set(nose[0], nose[1], isColor ? SLOT.T2 : (k > 0.06 ? SLOT.T3 : SLOT.T1));
      if (isColor) { sp.set(brow[0], brow[1], SLOT.T0); sp.set(eye[0], eye[1], SLOT.EYE); }
      if (hr >= 3.4) sp.set(ear[0], ear[1], isColor ? SLOT.T1 : SLOT.T0);
    }
    // hair streaming back, and a lock over the brow
    if (lod > 0.5) {
      var wave = P.reduced ? 0 : Math.sin(P.tSec * 5.3 + P.wp * 6.28) * 0.5, tr = 0.8 + P.activity * 0.5 + (P.windLean || 0) * 1.6;
      var h0 = [head.x - hf[0] * 0.75 * hr + hu[0] * 0.55 * hr, head.y - hf[1] * 0.75 * hr + hu[1] * 0.55 * hr];
      var h1 = [h0[0] - hf[0] * tr * hr * 0.9 + fwdV[0] * 0, h0[1] - hf[1] * tr * hr * 0.9 + wave * hz + 0.5 * hz];
      var h2 = [h1[0] - hf[0] * tr * hr * 0.75, h1[1] + 1.6 * hz + wave * hz];
      PX.capsule(sp, h0[0], h0[1], h1[0], h1[1], R(1.5 * s), R(0.95 * s), function () { return SLOT.HAIR; });
      PX.capsule(sp, h1[0], h1[1], h2[0], h2[1], R(0.95 * s), R(0.4 * s), function () { return SLOT.HAIRLO; });
    }
    if (cosm === "headband" && lod > 0.45) { var hb0 = [head.x - hf[0] * hr * 0.95 + hu[0] * hr * 0.42, head.y - hf[1] * hr * 0.95 + hu[1] * hr * 0.42], hb1 = [head.x + hf[0] * hr * 0.8 + hu[0] * hr * 0.42, head.y + hf[1] * hr * 0.8 + hu[1] * hr * 0.42]; PX.capsule(sp, hb0[0], hb0[1], hb1[0], hb1[1], Math.max(0.6, 0.6 * hz), Math.max(0.6, 0.6 * hz), function () { return SLOT.BAND; }); }
    if (cosm === "laurel" && lod > 0.45) for (var li = -2; li <= 2; li++) sp.set(head.x + li * 1.6 * hz, head.y - hr * 1.05 - (Math.abs(li) % 2) * hz * 0.8, SLOT.LAUREL);

    // ---- a few muscle marks and creases (colour look) ----
    if (isColor && lod > 0.72) {
      var tf = tone(false);
      function mark(a3, b3, t, lat, slot, fs) {                                                                    // one pixel at (t along a3->b3, lat px toward the front normal)
        var ax = b3.x - a3.x, ay = b3.y - a3.y, ll = Math.sqrt(ax * ax + ay * ay) || 1, nxm = -ay / ll * fs, nym = ax / ll * fs;
        sp.set(a3.x + ax * t + nxm * lat, a3.y + ay * t + nym * lat, slot);
      }
      mark(hip, sh, 0.57, 2.5 * hz, SLOT.T1, 1); mark(hip, sh, 0.40, 1.5 * hz, SLOT.T1, 1); mark(hip, sh, 0.28, 1.3 * hz, SLOT.T1, 1);   // pec line + abs
    }

    if (isColor && lod > 0.16) outlinePass(sp);                                                                       // ink outline (colour look): every edge, in the deep warm dark

    // a rim glint so a tiny figure never disappears into the scenery
    if (lod < 0.4 && k > 0.03) { sp.set(head.x + L2[0] * hr, head.y + L2[1] * hr, SLOT.GLINT); sp.set(sh.x + L2[0] * R(4 * s), sh.y + L2[1] * R(4 * s), SLOT.GLINT); }
    if (cosm === "aura" && lod > 0.3) {
      var ar = hr + 5 * hz;
      for (var an2 = 0; an2 < 40; an2++) { var aa = an2 / 40 * 6.2832; if ((an2 & 1) === 0) sp.set(head.x + Math.cos(aa) * ar, head.y + Math.sin(aa) * ar, SLOT.AURA); }
    }
    if (cosm === "bronze" && lod > 0.5) { sp.set(head.x - 1, head.y - hr, SLOT.BRONZE); sp.set(sh.x, sh.y - 2 * hz, SLOT.BRONZE); }
    if (P.pushTime > 10 && lod > 0.55) {                                                                               // sweat after sustained pushing
      var swt = Math.min(1, (P.pushTime - 10) / 2), dy = P.reduced ? hr : ((P.tSec * 16) % 18) * hz * 0.5;
      sp.set(head.x - hr, head.y - hr * 0.3, SLOT.SWEAT); if (swt > 0.5) sp.set(head.x - hr + 1, head.y + dy, SLOT.SWEAT);
    }
  }

  function outlinePass(sp) {
    var sw = sp.w, sh2 = sp.h, sd = sp.d, mk = [];
    for (var oy = 0; oy < sh2; oy++) for (var ox = 0; ox < sw; ox++) {
      var oo = oy * sw + ox; if (sd[oo] !== 0) continue;
      if ((ox > 0 && isBody(sd[oo - 1])) || (ox < sw - 1 && isBody(sd[oo + 1])) || (oy > 0 && isBody(sd[oo - sw])) || (oy < sh2 - 1 && isBody(sd[oo + sw]))) mk.push(oo);
    }
    for (var mi = 0; mi < mk.length; mi++) sd[mk[mi]] = SLOT.OUT;
  }

  // the small figure (camera far away): a few capsules and a glint; never vanishes
  function drawSimple(sp, P, J, legs, hip, sh, shB, neck, head, hr, tone, R, minR) {
    var s = P.s, z = P.z, L2 = P.light || [-0.4, -0.8], k = P.lightK == null ? 0.6 : P.lightK, i, isColor = P.look === "color";
    function Rm(u, lo) { return Math.max(lo, u * z); }
    function m2(p) { var q = P.map(p.x, p.y); return { x: q[0], y: q[1] }; }
    for (i = 0; i < legs.length; i++) {
      PX.capsule(sp, hip.x, hip.y, legs[i].knee.x, legs[i].knee.y, Rm(4.4 * s, 1.5), Rm(3.2 * s, 1.3), tone(legs[i].far));
      PX.capsule(sp, legs[i].knee.x, legs[i].knee.y, legs[i].foot.x, legs[i].foot.y, Rm(3.2 * s, 1.3), Rm(2.2 * s, 1.1), tone(legs[i].far));
    }
    PX.capsule(sp, hip.x, hip.y, sh.x, sh.y, Rm(4.2 * s, 1.6), Rm(5.2 * s, 1.9), tone(false));
    PX.disc(sp, hip.x, hip.y + 0.2 * z * s, Rm(3.6 * s, 1.5), function () { return isColor ? SLOT.CLOTH : SLOT.CLOTHSH; });           // the kilt: a pale patch so he reads as a man, not a twig
    var hand = m2(J.hand), elbow = m2(J.elbow);
    if (!J.cheer) { PX.capsule(sp, sh.x, sh.y, elbow.x, elbow.y, Rm(3.2 * s, 1.3), Rm(2.6 * s, 1.1), tone(false)); PX.capsule(sp, elbow.x, elbow.y, hand.x, hand.y, Rm(2.6 * s, 1.1), Rm(2.0 * s, 1.0), tone(false)); }
    else J.arms.forEach(function (a) { var e = m2(a.elbow), h = m2(a.hand); PX.capsule(sp, sh.x, sh.y, e.x, e.y, Rm(3.0 * s, 1.2), Rm(2.4 * s, 1.0), tone(a.far)); PX.capsule(sp, e.x, e.y, h.x, h.y, Rm(2.4 * s, 1.0), Rm(1.8 * s, 0.9), tone(a.far)); });
    var hh = Math.max(hr, 1.7);
    PX.disc(sp, head.x, head.y, hh, function (x, y, u, v) { return v < -0.05 || u < -0.4 ? (isColor ? SLOT.HAIR : SLOT.T0) : (isColor ? SLOT.T2 : SLOT.T1); });
    if (isColor) outlinePass(sp);
    if (k > 0.03) { sp.set(head.x + L2[0] * hh, head.y + L2[1] * hh, SLOT.GLINT); sp.set(sh.x + L2[0] * Rm(4 * s, 1.6), sh.y + L2[1] * Rm(4 * s, 1.6), SLOT.GLINT); }
  }

  // ---------- public ----------
  root.Hero = { SLOT: SLOT, palette: palette, rig: rig, rigCheer: rigCheer, draw: draw };
})(typeof window !== "undefined" ? window : this);
