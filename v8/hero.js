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
    // contrast with what he stands against: dark figure on mid/bright ground, lifted figure in the dark (bgLum = luminance behind him 0..1)
    var bgL = o.bgLum == null ? 0.45 : clamp01(o.bgLum);
    var cf = bgL >= 0.30 ? PX.lerp(1.0, 0.78, clamp01((bgL - 0.30) / 0.30)) : PX.lerp(1.0, 1.22, clamp01((0.30 - bgL) / 0.22));
    var clothF = clamp(0.58 + bgL * 1.05, 0.66, 1.0);                                   // the linen is never the brightest thing on a dark screen
    if (o.look === "color") {
      var f = (0.46 + 0.54 * bright) * cf, fh = (0.46 + 0.54 * bright) * Math.sqrt(cf);                          // highlights keep more of their value than the shadows: the range stays, the body just sits darker
      var base = [[54, 30, 46], [106, 60, 56], [166, 104, 68], [222, 160, 104]].map(function (c, ci) { var ff = ci === 3 ? fh : f; return [c[0] * ff, c[1] * ff, c[2] * ff]; });   // hue-shifted: cool plum shadows, warm lights
      T = [PX.mix(base[0], A, 0.14), PX.mix(base[1], A, 0.10), PX.mix(base[2], C, 0.12 * kk), PX.mix(base[3], C, 0.24 * kk)];
      cloth = PX.mix([222, 200, 160], A, 0.14 + 0.34 * (1 - bright)); cloth = [cloth[0] * clothF, cloth[1] * clothF, cloth[2] * clothF]; hair = PX.mix([72, 46, 34], A, 0.10);
      sash = PX.mix([176, 62, 46], A, 0.10 + 0.2 * (1 - bright)); sandal = PX.mix([88, 56, 38], A, 0.12); outCol = PX.mix([30, 18, 26], A, 0.08);
    } else {
      ink = PX.mix([7, 6, 12], A, 0.045);
      T = [ink, PX.mix(ink, A, 0.16), PX.mix(PX.mix(ink, A, 0.30), C, 0.16 * kk), PX.mix(ink, C, 0.48 * kk + 0.04)];   // dark, backlit: sky fill lifts upward planes to cool slate, the sun paints only the rim
      var dkT = clamp01((0.22 - bgL) / 0.16);                                                                          // the whole surround is near-black: a pure silhouette would vanish, so he turns moonlit slate a step above the dark
      if (dkT > 0) { T[1] = PX.mix(T[1], PX.mix([52, 50, 78], A, 0.2), dkT); T[2] = PX.mix(T[2], PX.mix([92, 90, 126], A, 0.2), dkT); T[3] = PX.mix(T[3], PX.mix([150, 152, 192], A, 0.15), dkT); }
      cloth = PX.mix(ink, [172, 86, 54], 0.30 + 0.12 * bright); hair = PX.mix(ink, [92, 76, 66], 0.30 + 0.25 * kk);
      sash = PX.mix(ink, [150, 52, 40], 0.42); sandal = PX.mix(ink, [70, 48, 34], 0.5); outCol = ink;
    }
    if (o.cosmetic === "bronze") T = T.map(function (c) { return PX.mix(c, [96, 112, 88], 0.55); });
    var rim = PX.mix(C, [255, 255, 255], 0.22);
    p[SLOT.T0] = T[0]; p[SLOT.T1] = T[1]; p[SLOT.T2] = T[2]; p[SLOT.T3] = T[3];
    p[SLOT.RIM] = k > 0.06 ? PX.mix(T[3], rim, clamp01(0.35 + kk * 0.7)) : T[3];
    p[SLOT.CLOTH] = cloth; p[SLOT.CLOTHHI] = PX.mix(PX.mix(cloth, [255, 240, 200], 0.42), C, 0.16 * kk); p[SLOT.CLOTHSH] = PX.mix(PX.mix(cloth, [120, 84, 64], 0.36), T[0], 0.12); p[SLOT.CLOTHDEEP] = PX.mix(PX.mix(cloth, [70, 44, 44], 0.62), T[0], 0.2);
    p[SLOT.HAIR] = hair; p[SLOT.HAIRHI] = PX.mix(PX.mix(hair, [150, 98, 60], 0.55), C, 0.16 * kk); p[SLOT.HAIRLO] = PX.mix(hair, [14, 10, 14], 0.42);
    p[SLOT.BEARD] = o.look === "color" ? PX.mix(PX.mix([84, 54, 38], A, 0.10), C, 0.08 * kk) : PX.mix(hair, T[1], 0.30);
    p[SLOT.SASH] = sash; p[SLOT.SANDAL] = sandal; p[SLOT.BELT] = PX.mix(T[0], [72, 48, 34], 0.5); p[SLOT.OUT] = outCol;
    p[SLOT.EYE] = [16, 12, 14];
    p[SLOT.WRAP] = PX.mix([190, 176, 146], T[0], 0.18); p[SLOT.BAND] = [188, 52, 52]; p[SLOT.LAUREL] = [158, 176, 96]; p[SLOT.AURA] = [150, 132, 230];
    p[SLOT.BRONZE] = [222, 190, 110]; p[SLOT.SWEAT] = [140, 190, 236];
    var g = o.ground || [82, 58, 40];
    p[SLOT.DIRT0] = PX.mix(g, [0, 0, 0], 0.42); p[SLOT.DIRT1] = PX.mix(g, [40, 26, 18], 0.55); p[SLOT.DIRT2] = PX.mix(g, [200, 176, 140], 0.25);
    if (o.look === "color") { p[SLOT.CAPE] = PX.mix([112, 30, 42], A, 0.10 + 0.2 * (1 - bright)); p[SLOT.CAPEHI] = PX.mix([184, 64, 56], C, 0.16 * kk); }
    else { p[SLOT.CAPE] = PX.mix(T[0], [30, 26, 40], 0.5); p[SLOT.CAPEHI] = PX.mix(T[1], C, 0.15 * kk); }
    p[SLOT.GLINT] = PX.mix(C, [255, 255, 255], 0.4);
    return p;
  }

  // ---------- the rig (local frame: x forward, y DOWN, floor at y = 0; all lengths scale with s) ----------
  // Proportions (units of s): thigh 10.3 + shin 9.9 + foot 2.3, torso 13.6, neck 2.3, head radius 3.75, upper arm 8.2 + forearm 7.8.
  var THIGH = 12.2, SHIN = 11.6, FOOT = 2.3, TORSO = 13.2, UARM = 8.2, FARM = 7.8, HEADR = 4.6;
  function leanInOf(P, s) {                                            // giant stone: the whole body steps in so a bent arm reaches it
    var giantT = smooth01(clamp01((P.ratio - 1.6) / 1.2)), leanIn = 0, ax = P.manBaseX || 0;
    if (giantT > 0.001) {
      var estShY = -29.2 * s, estRel = clamp(estShY - 1 * s - P.bly, -P.brad + 3, P.brad - 3);
      var estHalf = Math.sqrt(Math.max(0, P.brad * P.brad - estRel * estRel)), chordX = P.blx - estHalf - 1 * s;
      leanIn = Math.min(14 * s, Math.max(0, (chordX - (ax + 9.2 * s)) - 15 * s) * giantT * 0.72);
    }
    return { giantT: giantT, leanIn: leanIn };
  }
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
    var TN0 = root.HERO_TUNE || {};
    var hipH = (21.5 - giantT * (TN0.ghip != null ? TN0.ghip : 1.0)) * s;
    var hip = { x: ax - brace * 3.0 * s - stumble * 1.8 * s + pd * 1.1 * s - wl * 0.6 * s,
                y: gY - hipH + bob + brace * 2.2 * s + stumble * 2.6 * s + pd * 0.8 * s };
    var lean = 0.62 + brace * 0.30 + stumble * 0.16 + pd * 0.09 + wl * 0.12 + giantT * (TN0.glean != null ? TN0.glean : 0.18) - idle * 0.03;
    lean = lean - 0.07 + (P.theta || 0);                                     // authored against gravity, so on a climb the body leans into the slope by the slope angle too
    // where his hands will land on the stone, and therefore where his shoulders must be for the arms to be nearly straight (a real push: extended arms,
    // body a diagonal from heel to hand) - this stands him back from small and medium stones instead of pressing his face into them
    var smallGripT = 1 - smooth01(clamp01((P.ratio - 1.0) / 0.72));
    var shY0 = hip.y - Math.cos(lean) * TORSO * s + bob * 0.4 + stumble * 0.8 * s;
    var TN = root.HERO_TUNE || {}, gd = TN.gdrop != null ? TN.gdrop : 1.0;                 // against a colossus the hands can only reach the flank at about shoulder height
    var handY = shY0 + lerp(gd * s, 5.4 * s, smallGripT);                 // hands land BELOW the shoulder (chest height on the stone), never at head height
    var rel = clamp(handY - P.bly, -P.brad + 3, P.brad - 3), halfw = Math.sqrt(Math.max(0, P.brad * P.brad - rel * rel));
    var handX = P.blx - halfw + 1.2 * s;
    var armMax = (TN.garm != null ? TN.garm : lerp(0.90, 0.97, giantT)) * (UARM + FARM) * s, ddy = handY - shY0, reachX = Math.sqrt(Math.max(0, armMax * armMax - ddy * ddy));
    var fitD = (handX - reachX) - (hip.x + Math.sin(lean) * TORSO * s);
    var fit = fitD < 0 ? Math.max(fitD, -10 * s) : Math.min(fitD, 3 * s) * (1 - giantT);       // too close to the stone: step back so the arms straighten (a giant only ever pulls him back, never forward)
    hip.x += fit;
    var sh = { x: hip.x + Math.sin(lean) * TORSO * s, y: shY0 };
    var idleHeadT = 1 - smooth01(clamp01(P.activity / 0.06));
    var nl = lean * 0.95 - 0.10 - giantT * (TN.gneck != null ? TN.gneck : 0.25), neckLen = (4 - giantT * 0.3 + 0.7 * idleHeadT) * s;
    var neck = { x: sh.x + Math.sin(nl) * neckLen, y: sh.y - Math.cos(nl) * neckLen };
    var headR = HEADR * s, ht = lean * 0.30 - 0.03 * idle - giantT * (TN.gtilt != null ? -TN.gtilt : 0.25);       // beside a colossus he looks UP at it (the face stays clear of the arm)                 // the head lifts toward the horizon: less tilted than the spine
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
    var bkk = smooth01(clamp01(brace / 0.55));                                   // walk <-> dug-in is a blend, never a one-frame teleport
    var wl0 = [], br0 = null;
    if (bkk < 0.999) {
      var stepReach = 6.4 * s * (1 - wl * 0.4) * (1 + (P.groove || 0) * 0.3), stepLift = 3.5 * s;
      for (var leg = 0; leg < 2; leg++) {
        // one stride: the swing carries the foot forward on an arc (leaving and landing at the ground's own speed), the stance pins it to the
        // ground: it slides back at a CONSTANT speed, so the planted foot does not skate over the grass
        var fr = P.wp + leg * 0.5; fr -= Math.floor(fr);
        var fx, lift = 0, fwd, un;
        if (fr < 0.5) { un = fr * 2; fx = stepReach * (-8 * un * un * un + 12 * un * un - 2 * un - 1); lift = Math.sin(un * Math.PI) * stepLift * P.activity; fwd = Math.cos(un * Math.PI); }
        else { un = (fr - 0.5) * 2; fx = stepReach * (1 - 2 * un); fwd = -1 + 2 * un; }
        var ankle = reach({ x: hip.x - (7.4 - stumble * 1.0) * s + fx, y: ankleY - lift }, lift < 0.01);
        var ang = (fr < 0.5 ? -0.6 * fwd : -0.55 * Math.max(0, (fwd - 0.55) / 0.45)) * P.activity;          // toe-off, toe up into the contact
        wl0.push({ foot: ankle, far: leg === 1, plant: lift < 0.01, ang: ang });
      }
    }
    if (bkk > 0.001) {
      var bf = reach({ x: hip.x - (17 + brace * 2 + pd * 1.0) * s, y: ankleY }, true), ff = reach({ x: hip.x - (5.6 + brace * 1.4 + pd * 0.3) * s, y: ankleY }, true);
      br0 = [{ foot: ff, far: false, plant: true, ang: 0 }, { foot: bf, far: true, plant: true, ang: -0.28 * brace }];
    }
    for (var lg = 0; lg < 2; lg++) {
      var a0 = wl0[lg], b0 = br0 && br0[lg], f, ang2, plant2;
      if (a0 && b0) { f = { x: lerp(a0.foot.x, b0.foot.x, bkk), y: lerp(a0.foot.y, b0.foot.y, bkk) }; ang2 = lerp(a0.ang, b0.ang, bkk); plant2 = a0.plant || bkk > 0.5; }
      else { var c0 = a0 || b0; f = { x: c0.foot.x, y: c0.foot.y }; ang2 = c0.ang; plant2 = c0.plant; }
      legs.push({ foot: f, knee: PX.ik2(hip.x, hip.y, f.x, f.y, L1, L2, -1), far: lg === 1, plant: plant2, ang: ang2 });
    }
    for (var li = 0; li < legs.length; li++) legs[li].ground = { x: legs[li].foot.x - 1.0 * s, y: gY };
    // arms: both hands on the stone's surface (handX / handY from above; the second hand a little higher)
    var hand = { x: handX, y: handY }, maxR = 0.985 * (UARM + FARM) * s, dH = Math.hypot(hand.x - sh.x, hand.y - sh.y);
    if (dH > maxR) { hand.x = sh.x + (hand.x - sh.x) * maxR / dH; hand.y = sh.y + (hand.y - sh.y) * maxR / dH; }
    var rel2 = clamp(handY - 3.6 * s - P.bly, -P.brad + 3, P.brad - 3), hand2 = { x: P.blx - Math.sqrt(Math.max(0, P.brad * P.brad - rel2 * rel2)) + 1.4 * s, y: handY - 3.6 * s };
    var shB = { x: sh.x + 0.7 * s, y: sh.y - 0.8 * s }, dH2 = Math.hypot(hand2.x - shB.x, hand2.y - shB.y);
    if (dH2 > maxR) { hand2.x = shB.x + (hand2.x - shB.x) * maxR / dH2; hand2.y = shB.y + (hand2.y - shB.y) * maxR / dH2; }
    var elbow = PX.ik2(sh.x, sh.y, hand.x, hand.y, UARM * s, FARM * s, 1);
    var elbow2 = PX.ik2(shB.x, shB.y, hand2.x, hand2.y, UARM * s, FARM * s, 1);
    elbow.y += pd * 0.8 * s; elbow2.y += pd * 0.8 * s;
    return { hip: hip, sh: sh, shB: shB, neck: neck, head: head, headR: headR, legs: legs, hand: hand, hand2: hand2, elbow: elbow, elbow2: elbow2,
             idle: idle, leanIn: leanIn, brace: brace, ax: ax, lean: lean, ht: ht };
  }

  // summit cheer pose (he lets go, stands, jumps): port of the game's own pose curve, on the new skeleton
  function rigCheer(P) {
    var s = P.s, release = P.cheer.release, armsUp = P.cheer.arms, jump = P.cheer.jump, bx = P.manBaseX || 0;
    var li0 = P.ratio != null ? leanInOf(P, s).leanIn : 0;                 // he lets go where he stood (leaning in on the stone) and steps back to stand
    var jy = jump * 22 * s, hip = { x: bx + li0 * (1 - smooth01(clamp01(release * 1.25))), y: -jy - 22.2 * s };
    var lean = lerp(0.62, 0.05, release), ht = lean * 0.3 - armsUp * 0.32;
    var sh = { x: hip.x + Math.sin(lean) * TORSO * s, y: hip.y - Math.cos(lean) * TORSO * s };
    var legs = [], L1 = THIGH * s, L2 = SHIN * s;
    for (var leg = 0; leg < 2; leg++) {
      var dir = leg === 0 ? -1 : 1;
      var ankle = { x: hip.x + dir * (3.2 + release * 2.6) * s, y: -jy - jump * 3.5 * s - FOOT * s };
      legs.push({ foot: ankle, knee: PX.ik2(hip.x, hip.y, ankle.x, ankle.y, L1, L2, -1), far: leg === 0, plant: false, ang: -0.35 * jump, ground: { x: ankle.x - 1.0 * s, y: -jy - jump * 3.5 * s } });
    }
    var nl = lean * 0.8 - 0.06, neckLen = 2.6 * s, neck = { x: sh.x + Math.sin(nl) * neckLen, y: sh.y - Math.cos(nl) * neckLen }, headR = HEADR * s;
    var head = { x: neck.x + Math.sin(ht) * headR * 0.92, y: neck.y - Math.cos(ht) * headR * 0.92 };
    var arms = [];
    for (var arm = 0; arm < 2; arm++) {
      var d = arm === 0 ? -1 : 1;
      var spread = lerp(0.7, 3.4, armsUp), shp0 = arm === 0 ? { x: sh.x - spread * s, y: sh.y - 0.6 * s } : { x: sh.x + spread * s, y: sh.y + 0.5 * s };
      var fwdHX = shp0.x + 20.5 * s, fwdHY = shp0.y + 3.5 * s, sideHX = hip.x + d * 5 * s, sideHY = hip.y + 2 * s;      // gripping (the push pose) -> arms hanging
      var upHX = sh.x + d * (d < 0 ? 14 : 11.5) * s, upHY = sh.y - (d < 0 ? 17 : 18.5) * s;                                                              // cheering: a wide V, the head between the fists
      var hX = lerp(lerp(fwdHX, sideHX, release), upHX, armsUp), hY = lerp(lerp(fwdHY, sideHY, release), upHY, armsUp);
      var shp = shp0, elSide = armsUp > 0.5 ? (d < 0 ? -1 : 1) : (release > 0.5 ? 1 : -1);
      var el = PX.ik2(shp.x, shp.y, hX, hY, UARM * s, FARM * s, elSide);
      arms.push({ hand: { x: hX, y: hY }, elbow: el, far: arm === 0 });
    }
    var spr = lerp(0.7, 3.4, armsUp);
    return { hip: hip, sh: sh, shB: { x: sh.x - spr * s, y: sh.y - 0.6 * s }, shN: { x: sh.x + spr * s, y: sh.y + 0.5 * s }, neck: neck, head: head, headR: headR, legs: legs, arms: arms, cheer: true, idle: 0, brace: 0, lean: lean, ht: ht, armsUp: armsUp };
  }

  // ---------- hand-authored heads (facing right) ----------
  // h hair, H hair highlight, l hair shade | S skin light, s skin, d skin shade, D skin deep | k brow, e eye, b beard, m mouth
  // Five sizes, chosen by the head's on-screen radius; the pixels are drawn (not computed) so the face always reads as a face.
  var HEADS = [
    { r: 4.55, cx: 5, cy: 5, rows: [                       // 11 x 11
      "...hHHhh...",
      "..hHhhhhh..",
      ".hhhhhhhhh.",
      "hhhhhhhssS.",
      "hhhhhssSkS.",
      "hhhhdssseS.",
      "hhhldsssssS",
      ".hhlsssbbm.",
      ".lhlsbbbbb.",
      "..ll.bbbbb.",
      ".....bbbb.." ] },
    { r: 3.75, cx: 4, cy: 4, rows: [                       // 9 x 9
      "..hHHhh..",
      ".hhhhhhh.",
      "hhhhhssS.",
      "hhhhssSkS",
      "hhhdssseS",
      "hhldssssS",
      ".hlssbbbm",
      ".lhlsbbbb",
      "..l.bbbb." ] },
    { r: 3.0, cx: 3, cy: 3, rows: [                        // 8 x 7
      "..hHhh..",
      ".hhhhhh.",
      "hhhhssS.",
      "hhhssSkS",
      "hhdssseS",
      ".hlsbbbm",
      "...bbbb." ] },
    { r: 2.35, cx: 2, cy: 3, rows: [                       // 6 x 6
      ".hHhh.",
      "hhhhsS",
      "hhhskS",
      "hhdseS",
      ".lsbbb",
      "..bbb." ] },
    { r: 0, cx: 1, cy: 2, rows: [                          // 4 x 4
      ".hh.",
      "hhsS",
      "hdse",
      ".bbb" ] }
  ];
  (function () { HEADS.forEach(function (H) { H.w = 0; H.rows.forEach(function (r) { if (r.length > H.w) H.w = r.length; }); }); })();
  function pickHead(hr) { for (var i = 0; i < HEADS.length; i++) if (hr >= HEADS[i].r) return HEADS[i]; return HEADS[HEADS.length - 1]; }
  // colour look: letters -> palette slots;  shadow look: one dark body colour plus a rim of light where the sun grazes the edge
  var HSLOT = {
    color: { h: SLOT.HAIR, H: SLOT.HAIRHI, l: SLOT.HAIRLO, S: SLOT.T3, s: SLOT.T2, d: SLOT.T1, D: SLOT.T0, k: SLOT.T0, e: SLOT.EYE, b: SLOT.BEARD, m: SLOT.T1 },
    shadow: { h: SLOT.HAIR, H: SLOT.HAIR, l: SLOT.HAIR, S: SLOT.T2, s: SLOT.T1, d: SLOT.T0, D: SLOT.T0, k: SLOT.T0, e: SLOT.T1, b: SLOT.HAIR, m: SLOT.T0 }
  };
  function stampHead(sp, HB, hx, hy, phi, isColor, L2, lightOn) {
    var map = HSLOT[isColor ? "color" : "shadow"], rows = HB.rows, cx = HB.cx, cy = HB.cy, t2 = Math.tan(phi / 2), sn = Math.sin(phi);
    var ox = Math.round(hx), oy = Math.round(hy), pts = [], mask = {}, r, c;
    for (r = 0; r < rows.length; r++) for (c = 0; c < rows[r].length; c++) {
      var ch = rows[r][c]; if (ch === ".") continue;
      var dx = c - cx, dy = r - cy;
      dx = dx - Math.round(dy * t2); dy = dy + Math.round(dx * sn); dx = dx - Math.round(dy * t2);        // three integer shears = a small rotation that never drops a pixel
      pts.push([ox + dx, oy + dy, ch]); mask[(ox + dx) + "," + (oy + dy)] = 1;
    }
    var rx = L2[0] < -0.45 ? -1 : (L2[0] > 0.45 ? 1 : 0), ry = L2[1] < -0.45 ? -1 : (L2[1] > 0.45 ? 1 : 0);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], slot = map[p[2]];
      if (!isColor && lightOn && (!mask[p[0] + "," + (p[1] + ry)] && ry !== 0 || !mask[(p[0] + rx) + "," + p[1]] && rx !== 0)) slot = SLOT.RIM;
      sp.set(p[0], p[1], slot);
    }
  }

  // ---------- rasteriser ----------
  function isBody(v) { return (v >= 16 && v <= 34) || v === 14; }
  function draw(sp, P, J) {
    var z = P.z, s = P.s, lod = P.lod, L2 = P.light || [-0.4, -0.8], k = P.lightK == null ? 0.6 : P.lightK;
    var isColor = P.look === "color", cos = P.cosmetic, i;
    var rimOn = k > 0.06 || (!isColor && P.bgLum != null && P.bgLum < 0.2);                                           // the silhouette keeps its rim in the dark (a moonlit edge) even when the sun is gone
    var minR = lod < 0.3 ? 1.0 : lod < 0.6 ? 0.85 : 0.55, hz = s * z;
    function A(x, y) { return P.map(x, y); }
    function M(x, y) { var q = P.map(x, y); return { x: q[0], y: q[1] }; }
    function m(p) { return M(p.x, p.y); }
    function R(u) { return Math.max(minR, u * z); }
    var o0 = A(0, 0), o1 = A(1, 0), o2 = A(0, 1), fwdV = [o1[0] - o0[0], o1[1] - o0[1]], dnV = [o2[0] - o0[0], o2[1] - o0[1]];
    function off(p, ax, ay) { return { x: p.x + fwdV[0] * ax + dnV[0] * ay, y: p.y + fwdV[1] * ax + dnV[1] * ay }; }       // local-frame offset in px (ax, ay already multiplied by s)
    function lp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
    function dirL(lx, ly) { var vx = fwdV[0] * lx + dnV[0] * ly, vy = fwdV[1] * lx + dnV[1] * ly, l = Math.sqrt(vx * vx + vy * vy) || 1; return [vx / l, vy / l]; }
    function prof(pts, kk) {
      kk = kk == null ? 1 : kk;                                                        // width profile along a limb (rig units -> px), smooth between the control points
      return function (t) {
        var n = pts.length, j = 0; while (j < n - 2 && t > pts[j + 1][0]) j++;
        var a = pts[j], b = pts[j + 1], u = clamp01((t - a[0]) / ((b[0] - a[0]) || 1)); u = u * u * (3 - 2 * u);
        return Math.max(minR * 0.9, (a[1] + (b[1] - a[1]) * u) * hz * kk);
      };
    }
    // light: the sun from behind/above (rim) plus a cool bounce off the stone in front - so the face, chest and forearms stay readable
    var FL = [0.93, 0.26];
    function tone(far) {
      return function (x, y, u, v) {
        var dot = u * L2[0] + v * L2[1], c;
        if (lod < 0.16) return dot > 0.25 && (k > 0.05 || rimOn) ? (far ? SLOT.T2 : SLOT.RIM) : SLOT.T1;
        if (isColor) {
          var d = Math.max(dot, (u * FL[0] + v * FL[1]) * 0.5);
          if (dot >= 0.74 && k > 0.06 && !far) return SLOT.RIM;
          c = d >= 0.50 ? 3 : d >= -0.10 ? 2 : d >= -0.56 ? 1 : 0;
        } else {
          if (dot > 0.66 && rimOn) return far ? SLOT.T2 : SLOT.RIM;
          c = dot >= 0.10 ? 2 : dot >= -0.42 ? 1 : 0;
        }
        if (far) c = Math.max(1, c - 1);                                    // the far limb is skin in shadow, never a black trouser leg
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
    if (cosm === "cloak") {                                                                                            // a cape hung from the shoulders, streaming back with his effort and the wind
      var fl = (P.reduced ? 0.4 : 1) * (0.7 + P.activity * 1.3 + (P.windLean || 0) * 2.4), wv = P.reduced ? 0 : Math.sin(P.tSec * 3.1 + P.wp * 6.28) * 0.9;
      var cN = A(J.sh.x - 3.0 * s, J.sh.y - 1.6 * s), cS = A(J.sh.x - 0.2 * s, J.sh.y + 3.4 * s), cH = A(J.hip.x - 2.2 * s, J.hip.y + 1.5 * s);
      var cape = [cN, cS, [cH[0] - 1.0 * hz - fl * 3.0 * hz + wv * hz, cH[1] + 8 * hz], [cH[0] - 3.6 * hz - fl * 6.4 * hz + wv * 1.5 * hz, cH[1] + 15 * hz],
                  [cN[0] - 5.5 * hz - fl * 8.0 * hz + wv * 0.6 * hz, cN[1] + 15 * hz], [cN[0] - 3.0 * hz - fl * 4.4 * hz, cN[1] + 5 * hz]];
      PX.poly(sp, cape, function (x, y) { return ((x + y) & 3) === 0 || y < cN[1] + 2 * hz ? SLOT.CAPEHI : SLOT.CAPE; });
    }

    // ---- muscle silhouettes (rig units; half-widths toward the front / the back of each limb) ----
    var LK = 0.66;
    var TH_F = prof([[0, 4.5], [0.42, 4.55], [1, 2.7]], LK), TH_B = prof([[0, 4.3], [0.4, 3.7], [1, 2.6]], LK);                 // thigh: quad sweep in front, glute -> hamstring behind
    var SH_F = prof([[0, 2.7], [0.5, 2.15], [1, 1.5]], LK), SH_B = prof([[0, 2.7], [0.28, 3.5], [0.7, 2.3], [1, 1.45]], LK);   // shin: straight front, calf bulge behind
    var UA_F = prof([[0, 3.3], [0.4, 3.4], [1, 2.35]], LK), UA_B = prof([[0, 3.35], [0.38, 3.45], [1, 2.4]], LK);                // upper arm: biceps / triceps
    var FA_F = prof([[0, 2.55], [0.32, 2.65], [1, 1.5]], LK), FA_B = prof([[0, 2.65], [0.3, 2.8], [1, 1.5]], LK);                 // forearm
    var TO_F = prof([[0, 2.7], [0.2, 2.45], [0.55, 4.0], [1, 3.1]]), TO_B = prof([[0, 2.7], [0.3, 2.85], [0.7, 3.5], [1, 3.4]]);   // torso: waist -> chest / lats -> trapezius
    var NE = prof([[0, 2.35], [1, 1.85]]);

    function legDraw(l, far) {
      var t = tone(far);
      PX.limb(sp, hip.x, hip.y, l.knee.x, l.knee.y, TH_F, TH_B, t, -1);
      PX.limb(sp, l.knee.x, l.knee.y, l.foot.x, l.foot.y, SH_F, SH_B, t, -1);
      PX.disc(sp, l.knee.x, l.knee.y, R(2.2 * s), t);                                                                  // a round knee
      if (!far && isColor && lod > 0.6) { var kh = off(l.knee, 1.5 * s, -1.2 * s); sp.set(kh.x, kh.y, SLOT.T3); }                                     // kneecap highlight
      PX.disc(sp, l.foot.x, l.foot.y, R(1.3 * s), t);
      var ca = Math.cos(-l.ang), sa = Math.sin(-l.ang);
      function lf(px, py) { return off(l.foot, (px * ca - py * sa) * s, (px * sa + py * ca) * s); }
      var heel = lf(-1.1, 1.0), toe = lf(4.3, 1.35), s0 = lf(-1.5, 2.25), s1 = lf(4.6, 2.2);
      PX.capsule(sp, heel.x, heel.y, toe.x, toe.y, R(1.2 * s), R(0.85 * s), t);                                        // the foot
      PX.capsule(sp, s0.x, s0.y, s1.x, s1.y, R(0.72 * s), R(0.68 * s), function () { return SLOT.SANDAL; });          // the leather sole
      if (lod > 0.55) { var st = lf(2.0, 0.6), an = lf(0.2, -0.4); sp.set(st.x, st.y, SLOT.SANDAL); sp.set(an.x, an.y, SLOT.SANDAL); }   // straps
    }
    function armDraw(shoulder, elbow, hand, far) {
      var t = tone(far && !(J.cheer && J.armsUp > 0.3)), e = m(elbow), h = m(hand);
      PX.limb(sp, shoulder.x, shoulder.y, e.x, e.y, UA_F, UA_B, t, 1);
      PX.limb(sp, e.x, e.y, h.x, h.y, FA_F, FA_B, t, 1);
      PX.disc(sp, e.x, e.y, R(1.9 * s), t);                                                                            // a round elbow
      PX.disc(sp, h.x + 0.4 * hz, h.y, R((J.cheer && J.armsUp > 0.5 ? 2.15 : 1.75) * s), t);
      if (lod > 0.5) { var wr = lp(e, h, 0.52); PX.disc(sp, wr.x, wr.y, R(1.15 * s), function (x, y, u, v) { return far ? SLOT.CLOTHDEEP : SLOT.CLOTHSH; }); }     // a thin, dim linen wrap (the skin hand stays the brightest thing)
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
    PX.disc(sp, hip.x, hip.y + 0.4 * hz, R(3.4 * s), tone(false));                                                    // pelvis: joins the torso to both thighs
    if (J.idle > 0.02) PX.disc(sp, lp(hip, sh, 0.55).x, lp(hip, sh, 0.55).y, R((1.2 + J.idle * 0.5) * s), tone(false));   // breathing
    for (i = 0; i < legs.length; i++) if (!legs[i].far) legDraw(legs[i], false);

    // kilt: a belted linen wrap; the belt follows the pelvis, the cloth hangs straight down by gravity (trailing him as he pushes), hem torn into teeth
    var nx = Math.cos(J.lean), ny = Math.sin(J.lean);
    var bk = A(J.hip.x - nx * 2.7 * s, J.hip.y - ny * 2.7 * s), ft = A(J.hip.x + nx * 3.1 * s, J.hip.y + ny * 3.1 * s), span = Math.max(1, ft[0] - bk[0]);
    var flow = (P.reduced ? 0 : -(0.6 + P.activity * 1.4 + (P.windLean || 0) * 2.4) + Math.sin(P.tSec * 2.4 + P.wp * 6.28) * 0.7 * (0.4 + P.activity)) * hz;
    var KH = 0.7;
    var cl = [bk, ft, [ft[0] + 1.9 * hz + flow * 0.3, ft[1] + 9.0 * KH * hz], [ft[0] - 0.7 * hz + flow * 0.6, ft[1] + 10.4 * KH * hz], [bk[0] + span * 0.58 + flow * 0.7, bk[1] + 9.4 * KH * hz],
              [bk[0] + span * 0.30 + flow * 0.85, bk[1] + 10.6 * KH * hz], [bk[0] - 1.2 * hz + flow, bk[1] + 8.6 * KH * hz]];
    var top = Math.min(bk[1], ft[1]), hemY = 8.2 * KH * hz;
    PX.poly(sp, cl, function (x, y) {
      var e = y - (bk[1] + Math.max(0, Math.min(1, (x - bk[0]) / span)) * (ft[1] - bk[1])), col = (x - bk[0]) / span;
      if (e < 1.6 * hz) return SLOT.SASH;                                                                            // the sash at the waist
      if (e > hemY + 1.0 * hz && (x % 3) === 0) return 0;                                                            // torn hem: gaps between the teeth
      if (e > hemY) return SLOT.CLOTHDEEP;                                                                             // the hem: a dark edge
      var fold = 0.50 - (e / (9 * hz)) * 0.22;                                                                        // ONE broad fold, angled with the cloth
      if (col > fold - 0.09 && col < fold + 0.08) return SLOT.CLOTHSH;
      return col < 0.30 ? SLOT.CLOTHHI : (col > 0.80 ? SLOT.CLOTHSH : SLOT.CLOTH);
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
    PX.disc(sp, sh.x + 0.3 * hz, sh.y + 0.5 * hz, R(2.9 * s), tone(false));
    if (J.cheer) { var shN = m(J.shN); PX.disc(sp, shN.x, shN.y, R(2.7 * s), tone(false)); PX.disc(sp, shB.x, shB.y, R(2.4 * s), tone(true)); J.arms.forEach(function (a2) { if (!a2.far) armDraw(shN, a2.elbow, a2.hand, false); }); }
    else armDraw(sh, J.elbow, J.hand, false);
    PX.limb(sp, sh.x, sh.y, neck.x, neck.y, NE, NE, tone(false), 1);
    if (isColor && lod > 0.55) { var hsx = head.x + shx * 0.8, hsy = head.y + shy * 0.8; for (var ay = -Math.ceil(hr); ay <= Math.ceil(hr); ay++) for (var ax2 = -Math.ceil(hr); ax2 <= Math.ceil(hr); ax2++) if (ax2 * ax2 + ay * ay <= hr * hr) { var sx = Math.floor(hsx + ax2), sy = Math.floor(hsy + ay), dk = castShade(sx, sy); if (dk) sp.set(sx, sy, dk); } }

    // ---- head: a hand-authored bitmap chosen by size (see HEADS), tilted a little with the neck ----
    var hu = dirL(Math.sin(J.ht), -Math.cos(J.ht)), hf = dirL(Math.cos(J.ht), Math.sin(J.ht));
    stampHead(sp, pickHead(hr), head.x, head.y, Math.max(-0.5, Math.min(0.5, Math.atan2(hu[0], -hu[1]))), isColor, L2, rimOn);
    if (cosm === "headband" && lod > 0.45) { var hb0 = [head.x - hf[0] * hr * 0.95 + hu[0] * hr * 0.42, head.y - hf[1] * hr * 0.95 + hu[1] * hr * 0.42], hb1 = [head.x + hf[0] * hr * 0.8 + hu[0] * hr * 0.42, head.y + hf[1] * hr * 0.8 + hu[1] * hr * 0.42]; PX.capsule(sp, hb0[0], hb0[1], hb1[0], hb1[1], Math.max(0.6, 0.6 * hz), Math.max(0.6, 0.6 * hz), function () { return SLOT.BAND; }); }
    if (cosm === "laurel" && lod > 0.45) for (var li = -2; li <= 2; li++) sp.set(head.x + li * 1.6 * hz, head.y - hr * 1.05 - (Math.abs(li) % 2) * hz * 0.8, SLOT.LAUREL);

    if (isColor && lod > 0.16) outlinePass(sp);                                                                       // ink outline (colour look): every edge, in the deep warm dark

    // a rim glint so a tiny figure never disappears into the scenery
    if (lod < 0.4 && k > 0.03) { sp.set(head.x + L2[0] * hr, head.y + L2[1] * hr, SLOT.GLINT); sp.set(sh.x + L2[0] * R(4 * s), sh.y + L2[1] * R(4 * s), SLOT.GLINT); }
    if (cosm === "aura" && lod > 0.3) {
      var ar = hr + 5 * hz;
      for (var an2 = 0; an2 < 40; an2++) { var aa = an2 / 40 * 6.2832; if ((an2 & 1) === 0) sp.set(head.x + Math.cos(aa) * ar, head.y + Math.sin(aa) * ar, SLOT.AURA); }
    }
    if (cosm === "bronze" && lod > 0.5) { sp.set(head.x - 1, head.y - hr, SLOT.BRONZE); sp.set(sh.x, sh.y - 2 * hz, SLOT.BRONZE); }
  }

  var OUTMAP = null;
  function outlinePass(sp) {
    if (!OUTMAP) {                                                                                            // selective outlining: an edge is a deep shade of the tone it borders
      OUTMAP = {}; OUTMAP[SLOT.T0] = SLOT.OUT; OUTMAP[SLOT.T1] = SLOT.OUT; OUTMAP[SLOT.T2] = SLOT.T0; OUTMAP[SLOT.T3] = SLOT.T0; OUTMAP[SLOT.RIM] = SLOT.T1;
      OUTMAP[SLOT.HAIR] = SLOT.HAIRLO; OUTMAP[SLOT.HAIRHI] = SLOT.HAIRLO; OUTMAP[SLOT.HAIRLO] = SLOT.OUT; OUTMAP[SLOT.BEARD] = SLOT.HAIRLO;
      OUTMAP[SLOT.CLOTH] = SLOT.CLOTHDEEP; OUTMAP[SLOT.CLOTHHI] = SLOT.CLOTHSH; OUTMAP[SLOT.CLOTHSH] = SLOT.CLOTHDEEP; OUTMAP[SLOT.CLOTHDEEP] = SLOT.OUT;
      OUTMAP[SLOT.SASH] = SLOT.BELT; OUTMAP[SLOT.SANDAL] = SLOT.BELT; OUTMAP[SLOT.BELT] = SLOT.OUT; OUTMAP[SLOT.CAPE] = SLOT.OUT; OUTMAP[SLOT.CAPEHI] = SLOT.CAPE;
    }
    var sw = sp.w, sh2 = sp.h, sd = sp.d, mk = [], mv = [];
    for (var oy = 0; oy < sh2; oy++) for (var ox = 0; ox < sw; ox++) {
      var oo = oy * sw + ox; if (sd[oo] !== 0) continue;
      var nb = 0;
      if (ox > 0 && isBody(sd[oo - 1])) nb = sd[oo - 1]; else if (ox < sw - 1 && isBody(sd[oo + 1])) nb = sd[oo + 1];
      else if (oy > 0 && isBody(sd[oo - sw])) nb = sd[oo - sw]; else if (oy < sh2 - 1 && isBody(sd[oo + sw])) nb = sd[oo + sw];
      if (nb) { mk.push(oo); mv.push(OUTMAP[nb] || SLOT.OUT); }
    }
    for (var mi = 0; mi < mk.length; mi++) sd[mk[mi]] = mv[mi];
  }

  // the small figure (camera far away): a few capsules and a glint; never vanishes
  // the small figure (the camera is far away: about 9 out of 10 metres of the climb). Not a boot on a stick: a slim man with a head and hair, V-shaped shoulders,
  // a pale kilt patch, two skinny legs, an arm to the stone and a glint of sun.
  function drawSimple(sp, P, J, legs, hip, sh, shB, neck, head, hr, tone, R, minR) {
    var s = P.s, z = P.z, L2 = P.light || [-0.4, -0.8], k = P.lightK == null ? 0.6 : P.lightK, i, isColor = P.look === "color";
    var rimOn = k > 0.03 || (!isColor && P.bgLum != null && P.bgLum < 0.2);
    function Rm(u, lo) { return Math.max(lo, u * z); }
    function m2(p) { var q = P.map(p.x, p.y); return { x: q[0], y: q[1] }; }
    function lim(far) { return function (x, y, u, v) { var d = u * L2[0] + v * L2[1]; return far ? SLOT.T1 : (d > 0.4 && rimOn ? SLOT.T3 : (d > -0.2 ? SLOT.T2 : SLOT.T1)); }; }
    for (i = 0; i < legs.length; i++) {
      var lg = legs[i];
      PX.capsule(sp, hip.x, hip.y, lg.knee.x, lg.knee.y, Rm(3.5 * s, 1.15), Rm(2.5 * s, 1.0), lim(lg.far));
      PX.capsule(sp, lg.knee.x, lg.knee.y, lg.foot.x, lg.foot.y, Rm(2.5 * s, 1.0), Rm(1.6 * s, 0.9), lim(lg.far));
      sp.set(lg.foot.x + 1, lg.foot.y, SLOT.SANDAL);                                                          // a toe pixel so the foot points somewhere
    }
    PX.capsule(sp, hip.x, hip.y, sh.x, sh.y, Rm(3.3 * s, 1.3), Rm(5.6 * s, 2.0), lim(false));                    // torso: narrow at the waist, wide at the shoulders
    PX.disc(sp, hip.x + 0.4, hip.y + 0.6, Rm(3.9 * s, 1.55), function () { return SLOT.CLOTH; });               // the kilt: a pale patch
    PX.disc(sp, hip.x + 0.4, hip.y - 0.6, Rm(3.2 * s, 1.0), function () { return SLOT.SASH; });
    var hand = m2(J.hand), elbow = m2(J.elbow);
    if (!J.cheer) { PX.capsule(sp, sh.x, sh.y, elbow.x, elbow.y, Rm(2.6 * s, 1.0), Rm(2.1 * s, 0.9), lim(false)); PX.capsule(sp, elbow.x, elbow.y, hand.x, hand.y, Rm(2.1 * s, 0.9), Rm(1.6 * s, 0.8), lim(false)); }
    else J.arms.forEach(function (a) { var e = m2(a.elbow), h = m2(a.hand); PX.capsule(sp, sh.x, sh.y, e.x, e.y, Rm(2.4 * s, 1.0), Rm(1.9 * s, 0.9), lim(a.far)); PX.capsule(sp, e.x, e.y, h.x, h.y, Rm(1.9 * s, 0.9), Rm(1.4 * s, 0.8), lim(a.far)); });
    var hh = Math.max(hr, 1.9), hx = head.x, hy = head.y;
    PX.disc(sp, hx, hy, hh, function (x, y, u, v) { return (v < -0.05 || u < -0.35) ? (isColor ? SLOT.HAIR : SLOT.T0) : (isColor ? SLOT.T2 : SLOT.T1); });
    sp.set(hx + hh * 0.62, hy + hh * 0.2, isColor ? SLOT.T1 : SLOT.T0);                                          // a dark pixel for the eye / face line
    if (isColor) outlinePass(sp);
    if (rimOn) { sp.set(hx + L2[0] * hh, hy + L2[1] * hh, SLOT.GLINT); sp.set(sh.x + L2[0] * Rm(5 * s, 2), sh.y + L2[1] * Rm(5 * s, 2), SLOT.GLINT); }
  }

  // ---------- public ----------
  root.Hero = { SLOT: SLOT, palette: palette, rig: rig, rigCheer: rigCheer, draw: draw };
})(typeof window !== "undefined" ? window : this);
