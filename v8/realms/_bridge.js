// V8 stone-bridge kit (V8.bridge): the masonry deck shared by The Falls, Moonlit Rome and Sunset Rome.
// The ground of these realms is a bridge deck, not earth. Every pixel below S.lip is computed from WORLD coordinates
// (world x of a column = (x - ztx)/zoom + scroll, depth below the deck = (y - lip)/zoom), so the stones are world-locked
// and crisp at any zoom: 1-px mortar lines are found by asking "does a course / joint boundary fall inside this pixel",
// never by scaling an image. Arches repeat every P.A world units; their openings follow the slope (every depth is measured
// down from the lip of that column) and reveal whatever the realm's backdrop painted below the deck.
// Also here: the deck-edge props (fluted columns, broken columns, statues, urns, colonnade fragments) and a few shared
// rasterisers (temple, cypress) used by the backdrops of the two Roman realms.
(function (root) {
  "use strict";
  var PX = root.PX, V8 = root.V8;
  var B = {}, BAY = PX.BAYER4, clamp = PX.clamp, ihash = PX.ihash;
  function hh(a, b) { return ihash(a | 0, b | 0, 0x5b1d); }
  B.hh = hh;

  // shade / light tables for ONE palette (same rule as V8.buildShade). Realms build them at the end of init and hand them
  // to the kit, so a realm also renders correctly when it is initialised on a private palette (V8.thumbnail realm cards).
  B.tables = function (pal) {
    var T = { shade1: new Uint8Array(256), shade2: new Uint8Array(256), light1: new Uint8Array(256) }, i;
    for (i = 0; i < 256; i++) { T.shade1[i] = i; T.shade2[i] = i; T.light1[i] = i; }
    for (var name in pal.ramps) {
      var r = pal.ramps[name];
      for (i = 0; i < r.n; i++) { T.shade1[r.base + i] = r.base + Math.max(0, i - 1); T.shade2[r.base + i] = r.base + Math.max(0, i - 2); T.light1[r.base + i] = r.base + Math.min(r.n - 1, i + 1); }
    }
    return T;
  };

  B.worldX = function (S, x) { return (x - S.ztx) / S.zoom + S.scroll; };
  B.screenX = function (S, wx) { return S.ztx + (wx - S.scroll) * S.zoom; };
  B.lipAt = function (S, x) { var w = S.w; x = Math.round(x); return S.lip[x < 0 ? 0 : x >= w ? w - 1 : x]; };

  // ------------------------------------------------------------------------------------------------------------------
  // THE DECK
  // P = {
  //   wall, trim: base indices of two 7-tone ramps (0 darkest .. 6 lightest): wall = ashlar/brick, trim = coping, bands, imposts
  //   ring: base index of the voussoir ramp (defaults to trim);  mortar: joint index;  deep: darkest shadow index
  //   A: arch pitch (wu), pier: pier width, phase: world offset of the arch grid (pier centres at k*A + phase)
  //   slab, slabL: coping height / slab length;  frieze, dentil: frieze height and whether it is a classical dentil band
  //   string: string-course height;  course, blockL: course height / block length (course doubled when too small on screen)
  //   crown: depth of the arch extrados crown below the deck;  ringT: voussoir depth;  nv: voussoirs per arch (odd -> keystone)
  //   tiers: 1 | 2;  tierGap: opening height below the springing line of tier 1;  band: height of the band between tiers
  //   light: +1 key light from the right, -1 from the left
  //   open: { all: shade the whole view one step, band: wu of deeper shade under the arch }
  //   face: depth (wu) of the pier's inner face, seen in perspective on the side away from the camera (0 = off)
  //   fog: { mode: "mist" | "dark", idx, idx2, v0, v1, see }  (depth fade of the lower masonry; see = finally dissolve into the backdrop)
  //   moss: base index of a 4-tone moss ramp (optional) + mossAmt;  tufts: moss tufts along the coping edge
  // }
  B.deck = function (fb, S, P) {
    var w = fb.w, h = fb.h, d = fb.d, z = S.zoom, iz = 1 / z, sc = S.scroll, lipA = S.lip, ztx = S.ztx;
    var W = P.wall, T = P.trim, RG = P.ring == null ? T : P.ring, MO = P.mortar, DP = P.deep, TT = P.T || V8;
    var sh1 = TT.shade1, li1 = TT.light1;
    var A = P.A, r = (P.A - P.pier) * 0.5, ringT = P.ringT, rE = r + ringT, r2 = r * r, rE2 = rE * rE;
    var slab = P.slab, fr1 = slab + P.frieze, st1 = fr1 + P.string, wallTop = st1;
    var c1 = P.crown + ringT + r;
    var two = P.tiers === 2, bandTop = two ? c1 + P.tierGap : 1e9, bandBot = two ? bandTop + P.band : 1e9;
    var c2 = two ? bandBot + (P.crown2 == null ? 6 : P.crown2) + ringT + r : 1e9;
    var CH = P.course, BL = P.blockL, minPx = P.minCoursePx || 4.4;
    while (CH * z < minPx) { CH *= 2; BL *= 1.6; }
    var SL = P.slabL, light = P.light >= 0 ? 1 : -1, nv = P.nv, dth = Math.PI / nv, keyI = (nv - 1) >> 1, keyUp = P.keyUp == null ? 5 : P.keyUp;
    var kx = rE * dth * 0.5;
    var fogOn = !!P.fog, fv0 = fogOn ? P.fog.v0 : 1e9, fv1 = fogOn ? P.fog.v1 : 1e9, fIdx = fogOn ? P.fog.idx : 0, fDark = fogOn && P.fog.mode === "dark";
    var fog2 = fogOn ? (P.fog.idx2 || fIdx) : 0, fInv = fogOn ? 1 / (fv1 - fv0) : 0, fSee = fogOn && !!P.fog.see;
    var openAll = P.open && P.open.all, openBand = P.open ? (P.open.band || 0) : 0;
    var dent = P.dentil && 10 * z >= 3.6, dentP = 10, dentW = 6;
    var camX = S.ztx + S.anchorX * z, faceK = (P.face || 0) * z;
    var moss = P.moss || 0, mossAmt = P.mossAmt || 0;
    var slabPx = slab * z, impH = 6, sill = two ? clamp(Math.round(z * 7), 2, 5) : 0;
    var so = hh(7, 7) * SL, ph = P.phase;
    for (var x = 0; x < w; x++) {
      var lip = lipA[x]; if (lip >= h) continue;
      var wx0 = (x - ztx) * iz + sc - ph, wx1 = wx0 + iz, wxc = wx0 + 0.5 * iz;
      var cell = Math.floor(wxc / A), du = wxc - cell * A - A * 0.5, adu = du < 0 ? -du : du;
      var inSpan = adu < r, inRing = adu < rE;
      var sq = inSpan ? Math.sqrt(r2 - du * du) : 0, sqE = inRing ? Math.sqrt(rE2 - du * du) : 0;
      var vI1 = inSpan ? c1 - sq : 1e9, vE1 = inRing ? c1 - sqE : 1e9;
      var vI2 = inSpan ? c2 - sq : 1e9, vE2 = inRing ? c2 - sqE : 1e9;
      // perspective: the pier's inner face shows on the side of the opening away from the camera
      var xc = ztx + ((cell * A + A * 0.5 + ph) - sc) * z, fpx = faceK ? Math.min(faceK, Math.abs(xc - camX) * z * 0.05) : 0, fSide = xc > camX ? 1 : -1;
      // coping slabs for this column
      var k0 = Math.floor((wx0 - so) / SL), k1 = Math.floor((wx1 - so) / SL);
      var sJoint = k1 > k0, sEdgeL = Math.floor((wx0 - iz - so) / SL) < k0, sEdgeR = Math.floor((wx1 + iz - so) / SL) > k1;
      var kc = Math.floor((wxc - so) / SL), sTone = T + (hh(kc, 3) < 0.4 ? 3 : 4);
      var pierEdge = !inSpan && adu < r + iz, edgeLit = (du < 0) === (light > 0);
      // dentils
      var dfr = wxc - Math.floor(wxc / dentP) * dentP, inTooth = dfr < dentW, toothEdge = light > 0 ? (dfr + iz >= dentW) : (dfr < iz);
      // world-locked moss strands hanging from the string course and tufts on the coping (1 px wide, one per 3-wu cell)
      var strand = 0;
      if (moss) {
        var mc0 = Math.floor((wx0 + ph) / 3), mc1 = Math.floor((wx1 + ph) / 3);
        if (mc1 > mc0) { var hs = hh(mc1, 41); if (hs < 0.2 && hh(Math.floor((wx0 + ph) / 60), 13) < 0.55) strand = 3 + hs * 110; }
        if (P.tufts) {
          var tc = Math.floor((wxc + ph) / 2.2), th = hh(tc, 77), tn = th < 0.55 ? 0 : th < 0.82 ? 1 : th < 0.94 ? 2 : 3;
          if (hh(Math.floor((wxc + ph) / 46), 5) < 0.4) tn = 0;
          for (var ty = 1; ty <= tn; ty++) { var yy = lip - ty; if (yy >= 0 && yy < h) d[yy * w + x] = moss + (ty === tn ? 3 : 2 - ((ty + x) & 1)); }
        }
      }
      var ccKey = -99999, cOff = 0, jHere = false, eL = false, eR = false, bTone = 0, bMoss = false;
      var y0 = lip < 0 ? 0 : lip;
      for (var y = y0; y < h; y++) {
        var vt = (y - lip) * iz, vb = vt + iz, v = vt + 0.5 * iz, idx = -1;
        if (v < slab) {
          // ---- coping slab: lit top edge, joints, soft underside ----
          if (vt <= 0) idx = sJoint ? T + 4 : T + 6;
          else if (vb >= slab) idx = sJoint ? MO : T + 2;
          else if (sJoint) idx = MO;
          else if (vt < iz * 1.01 && slabPx >= 5) idx = T + 5;
          else if (light > 0 ? sEdgeR : sEdgeL) idx = li1[sTone];
          else if (light > 0 ? sEdgeL : sEdgeR) idx = sh1[sTone];
          else idx = sTone;
        } else if (v < fr1) {
          // ---- frieze: dentils (Roman) or a course of small corbel stones ----
          if (vt - slab < iz) idx = DP;                                // drop shadow under the coping
          else if (dent) {
            if (!inTooth) idx = DP;
            else if (vb >= fr1) idx = T + 2;
            else idx = toothEdge ? T + 4 : T + 3;
          } else {
            var fk = Math.floor((wxc + 5) / 15), fe = (wxc + 5) - fk * 15;
            if (fe < iz) idx = MO;
            else if (vb >= fr1) idx = W + 2;
            else idx = (hh(fk, 9) < 0.5 ? W + 3 : W + 4);
            if (moss && v - slab < 3.5 && hh(fk, 19) < 0.5) idx = moss + ((x + y) & 1 ? 1 : 2);
          }
        } else if (v < st1) {
          // ---- string course ----
          if (vt - fr1 < iz * 0.99) idx = T + 5; else if (vb >= st1) idx = T + 2; else idx = T + 3;
        } else {
          // ---- wall, arches, openings ----
          var cv = -1, vI = 0, vE = 0, lim = 0, wtop = 0;
          if (v < bandTop) { cv = c1; vI = vI1; vE = vE1; lim = bandTop; wtop = wallTop; }
          else if (v < bandBot) {
            // the band between the tiers (it is also the sill of the upper openings)
            if (vt - bandTop < iz * 0.99) idx = T + 6;
            else if (vb >= bandBot) idx = T + 1;
            else if (Math.abs(v - (bandTop + P.band * 0.45)) < iz * 0.5) idx = T + 2;
            else idx = v - bandTop < P.band * 0.45 ? T + 4 : T + 3;
          } else { cv = c2; vI = vI2; vE = vE2; lim = 1e9; wtop = bandBot; }
          if (cv >= 0) {
            if (adu >= r - 3 && adu < r + 18 && v >= cv - impH && v < cv + iz * 0.99) {
              // impost block where the arch springs from the pier (it steps 3 wu into the opening)
              if (v - (cv - impH) < iz) idx = T + 5; else if (v + iz >= cv + iz * 0.99) idx = DP; else idx = (adu < r ? T + 2 : T + 3);
            } else if (inSpan && v >= vI && v < lim) {
              // opening: the backdrop shows through, framed by the pier's inner face (perspective) and a sill
              var xr = v >= cv ? r : Math.sqrt(Math.max(0, r2 - (cv - v) * (cv - v)));
              var dEdge = fSide > 0 ? (xr - du) * z : (xr + du) * z, dTop = (v - vI) * z;
              if (fpx >= 1 && dEdge < fpx) idx = dEdge >= fpx - 1 ? DP : (dTop < 1.5 || dEdge < 1 ? W + 1 : W + 2);
              else if (dTop < 1) idx = DP;
              else if (two && cv === c1 && v >= lim - sill * iz) idx = (v >= lim - iz) ? T + 3 : T + 5;
              else {
                var o0 = y * w + x, bv = d[o0];
                if (openBand && (v - vI) < openBand && BAY[y & 3][x & 3] + 0.5 < 1 - (v - vI) / openBand) bv = sh1[sh1[bv]];
                else if (openAll) bv = sh1[bv];
                d[o0] = bv; continue;
              }
            } else if (inRing && v >= vE && (v < cv || (inSpan && v < vI))) {
              // ---- voussoirs with radial joints and a keystone ----
              var dy = cv - v, rho = Math.sqrt(du * du + dy * dy), ang = Math.atan2(dy, du);
              var f = ang / dth, fi = Math.floor(f), fr = f - fi, jd = rho * z * dth;
              if ((rE - rho) * z < 1 && fi !== keyI) idx = MO;
              else if (fr * jd < 0.55 || (1 - fr) * jd < 0.55) idx = MO;
              else {
                var vt0 = (fi === keyI) ? RG + 5 : ((fi & 1) ? RG + 3 : RG + 4);
                if ((rho - r) * z < 1) idx = sh1[sh1[vt0]];
                else if (fr * jd < 1.6) idx = light > 0 ? sh1[vt0] : li1[vt0];
                else if ((1 - fr) * jd < 1.6) idx = light > 0 ? li1[vt0] : sh1[vt0];
                else idx = vt0;
              }
            } else if (inRing && v < vE && v >= vE - keyUp && adu < kx) {
              // keystone standing proud above the ring
              if (v - (vE - keyUp) < iz) idx = RG + 6;
              else if (adu > kx - iz) idx = (du < 0) === (light > 0) ? RG + 3 : RG + 5;
              else idx = RG + 5;
            } else {
              // ---- ashlar / brick masonry (spandrels and piers) ----
              var vr = v - wtop, vtr = vt - wtop, vbr = vb - wtop, t2 = cv === c2 ? 1 : 0;
              var ck = Math.floor(vr / CH), key = ck + t2 * 100000;
              if (key !== ccKey) {
                ccKey = key;
                cOff = (ck & 1) * BL * 0.5 + (hh(ck, 70 + t2) - 0.5) * BL * 0.3;
                var kL = Math.floor((wx0 - cOff) / BL), kR = Math.floor((wx1 - cOff) / BL);
                jHere = kR > kL; eL = Math.floor((wx0 - iz - cOff) / BL) < kL; eR = Math.floor((wx1 + iz - cOff) / BL) > kR;
                var kb = Math.floor((wxc - cOff) / BL), hb = hh(kb * 3 + t2 * 7, ck * 5 + 1);
                bTone = W + (hb < 0.08 ? 2 : hb < 0.62 ? 3 : 4);
                bMoss = moss && hh(kb, ck * 7 + 3) < mossAmt;
              }
              var mRow = Math.floor(vbr / CH) > Math.floor(vtr / CH);
              if (vtr < iz && vtr > -iz) idx = DP;                     // drop shadow under the string course / band
              else if (mRow || jHere) idx = MO;
              else {
                var topRow = Math.floor(vtr / CH) > Math.floor((vtr - iz) / CH), botRow = Math.floor((vbr + iz) / CH) > Math.floor(vbr / CH);
                var tb = bTone;
                if (topRow) idx = bMoss ? moss + 2 + ((x ^ y) & 1) : li1[tb];
                else if (botRow) idx = sh1[tb];
                else if (light > 0 ? eR : eL) idx = li1[tb];
                else if (light > 0 ? eL : eR) idx = sh1[tb];
                else idx = tb;
                if (bMoss && !topRow && Math.floor((vtr - iz * 2) / CH) < Math.floor(vtr / CH) && ((x + y) & 1)) idx = moss + 1;
              }
              if (pierEdge && v > cv) idx = edgeLit ? T + 5 : W + 1;
              if (strand && !t2 && vr < strand) idx = (y & 1) ? moss + 1 : moss + 2;
            }
          }
        }
        if (idx < 0) continue;
        if (v > fv0) {
          // depth fade of the lower masonry: toward the fog tone, then (see) dissolving into the backdrop behind it
          var lv = (v - fv0) * fInv * 3 + BAY[y & 3][x & 3] + 0.5;
          if (lv >= 3 && fSee) continue;
          if (fDark) { if (lv >= 3) idx = fIdx; else if (lv >= 2) idx = sh1[sh1[idx]]; else if (lv >= 1) idx = sh1[idx]; }
          else if (lv >= 2) idx = fSee ? fIdx : fog2; else if (lv >= 1) idx = fSee ? fog2 : fIdx;
        }
        d[y * w + x] = idx;
      }
    }
  };

  // ------------------------------------------------------------------------------------------------------------------
  // SHARED LITTLE RASTERISERS
  // cylinder tone along u in [-1, 1] (u * L > 0 = toward the light) -> ramp offset 1..5
  function cylTone(u, L) {
    var l = u * L;
    if (l > 0.8) return 4; if (l > 0.3) return 5; if (l > -0.1) return 4; if (l > -0.5) return 3; if (l > -0.84) return 2; return 1;
  }
  B.cylTone = cylTone;

  // a mask: shapes are rasterised into it (region ids), then shaded with rim light and written to the frame
  function Mask() { this.w = 0; this.h = 0; this.d = new Uint8Array(4096); this.ox = 0; this.oy = 0; }
  Mask.prototype.reset = function (ox, oy, w, h) { this.ox = ox; this.oy = oy; this.w = w; this.h = h; if (this.d.length < w * h) this.d = new Uint8Array(w * h * 2); else this.d.fill(0, 0, w * h); };
  Mask.prototype.set = function (x, y, id) { x = Math.floor(x) - this.ox; y = Math.floor(y) - this.oy; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d[y * this.w + x] = id; };
  var MK = new Mask();
  B.mask = MK;

  // ---------- fluted column ----------
  // cx = screen x of the axis, by = screen row just below its foot (the deck lip); o: { H, R (px), ramp (7 tones), light,
  //   broken (0 | fraction of the height kept), seed, capital: "doric" | "ionic", deep, drum (px between drums), lipOf(x) }
  B.column = function (fb, cx, by, o) {
    var w = fb.w, h = fb.h, d = fb.d, C = o.ramp, L = o.light >= 0 ? 1 : -1, R = Math.max(1.5, o.R), H = Math.round(o.H), DP = o.deep;
    var icx = Math.round(cx), sh1 = (o.T || V8).shade1;
    var pH = Math.max(2, Math.round(R * 0.62)), pW = Math.round(R + Math.max(1.5, R * 0.42));
    var tH = Math.max(1, Math.round(R * 0.32)), tW = Math.round(R + Math.max(1, R * 0.2));
    var broken = o.broken || 0, seed = o.seed | 0;
    var capH = broken ? 0 : Math.max(2, Math.round(R * 0.55)), abH = broken ? 0 : Math.max(2, Math.round(R * 0.5)), abW = Math.round(R + Math.max(2, R * 0.55));
    var topY = by - H, shaftBot = by - pH - tH, shaftTop = broken ? Math.round(by - H * broken) : topY + capH + abH;
    var flute = R >= 3.2 ? (R >= 8 ? 3 : 2) : 0, drum = o.drum || 0;
    var x, y, dx;
    // plinth (reaches down to the deck at every column so it never floats on a slope)
    for (dx = -pW; dx <= pW; dx++) {
      x = icx + dx; if (x < 0 || x >= w) continue;
      var yb = o.lipOf ? Math.max(by, o.lipOf(x)) : by, yt = by - pH;
      for (y = Math.max(0, yt); y < Math.min(h, yb); y++) {
        var c;
        if (y === yt) c = C + 5; else if (dx * L >= pW - 1) c = C + 4; else if (dx * L <= -pW + 1) c = C + 1; else c = (dx * L > 0) ? C + 4 : C + 3;
        if (y >= by - 1) c = C + 2;
        d[y * w + x] = c;
      }
    }
    // torus
    var ty0 = by - pH - tH;
    for (dx = -tW; dx <= tW; dx++) { x = icx + dx; if (x < 0 || x >= w) continue; for (y = ty0; y < by - pH; y++) if (y >= 0 && y < h) d[y * w + x] = C + clamp(cylTone(dx / (tW + 0.5), L) + (y === ty0 ? 1 : 0), 1, 6); }
    // shaft with a gentle entasis, flutes and drum joints
    var jag = broken ? Math.max(1, Math.round(R * 0.7)) : 0;
    for (y = Math.max(0, shaftTop - jag); y < Math.min(h, shaftBot); y++) {
      var tt = (shaftBot - y) / Math.max(1, shaftBot - shaftTop), ir = Math.round(R * (1 - 0.1 * tt));
      var drumLine = drum > 2 && ((shaftBot - y) % drum === 0) && y > shaftTop + 1;
      for (dx = -ir; dx <= ir; dx++) {
        x = icx + dx; if (x < 0 || x >= w) continue;
        if (broken) { var jt = shaftTop + Math.round((hh(seed * 31 + dx, 5) - 0.35) * jag); if (y < jt) continue; if (y === jt) { d[y * w + x] = C + 5; continue; } }
        var tone = cylTone(dx / (ir + 0.5), L), cc = C + tone;
        if (flute && tone >= 2 && tone <= 5 && ((dx + ir + 64) % flute) === 0 && Math.abs(dx) < ir) cc = sh1[cc];
        if (dx === -ir * L && ir >= 2) cc = DP;                 // outline on the shadow side
        if (drumLine) cc = sh1[cc];
        d[y * w + x] = cc;
      }
    }
    if (broken) return;
    // capital: echinus + abacus (+ volutes for ionic)
    var ey0 = shaftTop - capH, ay0 = ey0 - abH;
    for (y = ey0; y < shaftTop; y++) {
      if (y < 0 || y >= h) continue;
      var ew = Math.round(R + (shaftTop - y) * (abW - R) / Math.max(1, capH) * 0.8);
      for (dx = -ew; dx <= ew; dx++) { x = icx + dx; if (x < 0 || x >= w) continue; var cc2 = C + cylTone(dx / (ew + 0.5), L); if (y === shaftTop - 1) cc2 = sh1[cc2]; d[y * w + x] = cc2; }
    }
    for (y = ay0; y < ey0; y++) {
      if (y < 0 || y >= h) continue;
      for (dx = -abW; dx <= abW; dx++) {
        x = icx + dx; if (x < 0 || x >= w) continue;
        d[y * w + x] = y === ay0 ? C + 6 : (y === ey0 - 1 ? C + 2 : (dx * L > abW - 2 ? C + 5 : (dx * L < -abW + 1 ? C + 2 : C + 4)));
      }
    }
    if (o.capital === "ionic" && R >= 2.5) {                  // volutes: a small scroll hanging at each end of the abacus
      var vr = Math.max(1, Math.round(R * 0.38));
      for (var side = -1; side <= 1; side += 2) {
        var vx = icx + side * (abW - vr + 1), vy = ey0 + vr - 1;
        for (var yy = -vr; yy <= vr; yy++) for (var xx = -vr; xx <= vr; xx++) {
          var rr2 = xx * xx + yy * yy; if (rr2 > vr * vr + vr * 0.8) continue;
          var px = vx + xx, py = vy + yy; if (px < 0 || py < 0 || px >= w || py >= h) continue;
          d[py * w + px] = rr2 <= 0.6 ? DP : (rr2 >= (vr - 0.6) * (vr - 0.6) ? ((xx * L - yy) > 0 ? C + 6 : C + 2) : C + 4);
        }
      }
    }
  };

  // ---------- statue on a plinth (silhouette with rim light) ----------
  // o: { H (px, figure + plinth), ramp (7), light, deep, lipOf, pose: 0 spear | 1 raised arm | 2 offering }
  B.statue = function (fb, cx, by, o) {
    var H = o.H, U = H / 100, L = o.light >= 0 ? 1 : -1, C = o.ramp, DP = o.deep, pose = o.pose | 0;
    if (H < 8) return;
    var bw = Math.ceil(56 * U) + 6, bh = Math.ceil(H * 1.12) + 6, ox = Math.round(cx) - (bw >> 1), oy = Math.round(by) - bh;
    MK.reset(ox, oy, bw, bh);
    var X = function (lx) { return cx + lx * U; }, Y = function (ly) { return by - ly * U; };
    var one = function () { return 2; };
    PX.poly(MK, [[X(-15), Y(0)], [X(15), Y(0)], [X(15), Y(15)], [X(-15), Y(15)]], function () { return 1; });
    PX.poly(MK, [[X(-17), Y(15)], [X(17), Y(15)], [X(17), Y(19)], [X(-17), Y(19)]], function () { return 3; });
    var m = pose === 1 ? -1 : 1;
    PX.poly(MK, [[X(-9), Y(19)], [X(10), Y(19)], [X(8), Y(52)], [X(9 * m), Y(76)], [X(-8 * m), Y(77)], [X(-8), Y(50)]], one);
    PX.capsule(MK, X(0.5), Y(62), X(0), Y(78), 7.2 * U, 6.2 * U, one);
    PX.capsule(MK, X(0.5), Y(84), X(0.8), Y(86), 4.4 * U, 4.2 * U, one);
    if (pose === 0) {
      PX.capsule(MK, X(7), Y(76), X(14), Y(66), 2.4 * U, 2.1 * U, one);
      PX.capsule(MK, X(14), Y(66), X(16), Y(80), 2.1 * U, 1.9 * U, one);
      PX.capsule(MK, X(16.5), Y(20), X(16.5), Y(104), Math.max(0.55, 0.9 * U), Math.max(0.55, 0.9 * U), one);
      PX.capsule(MK, X(-7), Y(76), X(-10), Y(58), 2.4 * U, 2.1 * U, one);
    } else if (pose === 1) {
      PX.capsule(MK, X(-7), Y(77), X(-15), Y(92), 2.4 * U, 2.0 * U, one);
      PX.capsule(MK, X(-15), Y(92), X(-17), Y(103), 2.0 * U, 1.8 * U, one);
      PX.capsule(MK, X(7), Y(76), X(11), Y(56), 2.4 * U, 2.1 * U, one);
    } else {
      PX.capsule(MK, X(7), Y(76), X(12), Y(62), 2.4 * U, 2.2 * U, one);
      PX.capsule(MK, X(12), Y(62), X(4), Y(58), 2.2 * U, 2.0 * U, one);
      PX.capsule(MK, X(-7), Y(76), X(-11), Y(58), 2.4 * U, 2.1 * U, one);
      PX.poly(MK, [[X(-2), Y(60)], [X(9), Y(60)], [X(7), Y(56)], [X(0), Y(56)]], one);
    }
    shadeMask(fb, MK, C, L, DP, o.lipOf);
  };

  // shade a mask: 1 = box (plinth), 2 = figure, 3 = cap moulding. Rim light on the light side, dark core, lit top edges.
  function shadeMask(fb, M, C, L, DP, lipOf) {
    var w = fb.w, h = fb.h, d = fb.d, x, y, mw = M.w;
    for (y = 0; y < M.h; y++) for (x = 0; x < mw; x++) {
      var id = M.d[y * mw + x]; if (!id) continue;
      var sx = x + M.ox, sy = y + M.oy; if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      var up = y > 0 ? M.d[(y - 1) * mw + x] : 0, lt = x > 0 ? M.d[y * mw + x - 1] : 0, rt = x < mw - 1 ? M.d[y * mw + x + 1] : 0, dn = y < M.h - 1 ? M.d[(y + 1) * mw + x] : 0;
      var towardL = L > 0 ? rt : lt, away = L > 0 ? lt : rt, c;
      if (id === 2) {
        if (!towardL) c = C + 5; else if (!up) c = C + 4; else if (!away) c = DP; else {
          var t2 = L > 0 ? (x + 2 < mw && !M.d[y * mw + x + 2]) : (x > 1 && !M.d[y * mw + x - 2]);
          c = t2 ? C + 3 : C + 2;
        }
      } else if (id === 3) c = !up ? C + 6 : (!dn ? C + 2 : (!towardL ? C + 5 : C + 4));
      else c = !up ? C + 5 : (!towardL ? C + 4 : (!away ? C + 1 : C + 3));
      d[sy * w + sx] = c;
    }
    if (lipOf) for (x = 0; x < mw; x++) {                       // plinth feet reach the deck on a slope
      var bottom = -1; for (y = M.h - 1; y >= 0; y--) if (M.d[y * mw + x] === 1) { bottom = y; break; }
      if (bottom < 0) continue;
      var sx2 = x + M.ox; if (sx2 < 0 || sx2 >= w) continue;
      var ly = lipOf(sx2);
      for (var yy = bottom + M.oy + 1; yy < ly && yy < h; yy++) if (yy >= 0) d[yy * w + sx2] = C + 2;
    }
  }
  B.shadeMask = shadeMask;

  // ---------- urn on a low plinth ----------
  B.urn = function (fb, cx, by, o) {
    var w = fb.w, h = fb.h, d = fb.d, C = o.ramp, L = o.light >= 0 ? 1 : -1, Hh = Math.round(o.H), DP = o.deep;
    if (Hh < 6) return;
    var pH = Math.max(2, Math.round(Hh * 0.16)), pW = Math.max(3, Math.round(Hh * 0.3)), icx = Math.round(cx), x, y, dx;
    for (dx = -pW; dx <= pW; dx++) { x = icx + dx; if (x < 0 || x >= w) continue; var yb = o.lipOf ? Math.max(by, o.lipOf(x)) : by; for (y = by - pH; y < yb; y++) if (y >= 0 && y < h) d[y * w + x] = y === by - pH ? C + 5 : (dx * L > 0 ? C + 4 : C + 2); }
    var uh = Hh - pH, W0 = Math.max(2, uh * 0.36), neckK = Math.round(0.86 * uh);
    for (var k = 0; k < uh; k++) {
      var t = k / uh, rw;
      if (t < 0.1) rw = 0.42; else if (t < 0.7) rw = 0.42 + 0.58 * Math.sin(Math.PI * (t - 0.1) / 0.66); else if (t < 0.86) rw = 0.34; else rw = 0.52;
      var hw = Math.max(1, Math.round(rw * W0)); y = by - pH - 1 - k; if (y < 0 || y >= h) continue;
      for (dx = -hw; dx <= hw; dx++) { x = icx + dx; if (x < 0 || x >= w) continue; var c = C + cylTone(dx / (hw + 0.5), L); if (k === uh - 1) c = C + 5; else if (k === neckK) c = DP; if (dx === -hw * L) c = DP; d[y * w + x] = c; }
    }
    var hy0 = by - pH - Math.round(uh * 0.62), hy1 = by - pH - Math.round(uh * 0.86), hx = Math.round(W0 * 0.62);
    for (var s = -1; s <= 1; s += 2) for (y = hy1; y <= hy0; y++) { x = icx + s * (hx + (y === hy1 || y === hy0 ? 0 : 1)); if (x >= 0 && x < w && y >= 0 && y < h) d[y * w + x] = s * L > 0 ? C + 4 : DP; }
  };

  // ---------- a lintel (entablature) across two columns, one end broken off in a jagged fracture ----------
  B.lintel = function (fb, x0, x1, y0, hPx, o) {
    var w = fb.w, h = fb.h, d = fb.d, C = o.ramp, DP = o.deep, seed = o.seed | 0, x, y, k;
    var a1 = Math.max(1, Math.round(hPx * 0.2)), a2 = Math.max(1, Math.round(hPx * 0.2)), fz = Math.max(1, Math.round(hPx * 0.32));
    var ix0 = Math.round(x0), ix1 = Math.round(x1), iy0 = Math.round(y0), gp = Math.max(4, Math.round(hPx * 0.55)), bw = Math.max(3, Math.round(hPx * 1.2));
    var over = Math.max(1, Math.round(hPx * 0.12));
    for (x = ix0 - over; x <= ix1 + over; x++) {
      if (x < 0 || x >= w) continue;
      var cutTop = 0, cutBot = 0;
      if (o.brokenRight != null) {
        var dd = o.brokenRight ? ix1 + over - x : x - (ix0 - over);
        if (dd < bw) {                                            // stepped, irregular break (never a clean diagonal)
          var f = 1 - dd / bw, stp = Math.max(2, Math.round(hPx * 0.22));
          cutTop = Math.round(f * hPx * 0.95 / stp) * stp + (hh(seed + (x >> 1), 3) < 0.35 ? 1 : 0);
          cutBot = dd < 2 ? Math.round(hPx * 0.3) : (hh(seed + x, 5) < 0.25 && f > 0.5 ? 1 : 0);
        }
      }
      var isOver = x < ix0 || x > ix1;
      for (k = cutBot; k < hPx - cutTop; k++) {
        y = iy0 + hPx - 1 - k; if (y < 0 || y >= h) continue;
        var cor = k >= a1 + a2 + fz, c;
        if (isOver && !cor) continue;                              // only the cornice overhangs the columns
        if (k === hPx - cutTop - 1 && cutTop > 0) c = C + 5;       // the broken face catches the light
        else if (k < a1) c = k === 0 ? C + 2 : C + 3;              // lower fascia
        else if (k < a1 + a2) c = k === a1 ? C + 5 : C + 4;        // upper fascia
        else if (k < a1 + a2 + fz) { var g = (x - ix0) % gp; c = (k === a1 + a2) ? DP : (g === 1 || g === 3 ? C + 2 : (g === 2 ? C + 1 : C + 3)); }   // triglyphs
        else c = (k === hPx - 1) ? C + 6 : (k === a1 + a2 + fz ? DP : C + 4);   // cornice
        d[y * w + x] = c;
      }
    }
  };

  // ------------------------------------------------------------------------------------------------------------------
  // PROPS along the deck edge (behind the hero): one decision per pier, world-locked
  // K = { ramp, statueRamp, deep, light, seed, pColumn, pBroken, pStatue, pUrn, pLintel, hMin, hMax, R, capital, statueH, urnH, drum }
  B.props = function (fb, S, P, K) {
    var w = fb.w, z = S.zoom, sc = S.scroll, A = P.A;
    var wl = (0 - S.ztx) / z + sc - 260, wr = (w - S.ztx) / z + sc + 260;
    var lipOf = function (x) { return B.lipAt(S, x); };
    var list = [["column", K.pColumn || 0], ["broken", K.pBroken || 0], ["statue", K.pStatue || 0], ["urn", K.pUrn || 0], ["lintel", K.pLintel || 0]];
    for (var i = Math.floor((wl - P.phase) / A); i <= Math.ceil((wr - P.phase) / A); i++) {
      var hv = hh(i, K.seed), pick = hh(i, K.seed + 1), wxp = i * A + P.phase + (hh(i, K.seed + 2) - 0.5) * 12;
      if (Math.abs(wxp - S.anchorX) < (K.calm == null ? 80 : K.calm)) continue;   // never right behind the hero where the climb starts (world-locked, so nothing pops)
      var sx = S.ztx + (wxp - sc) * z; if (sx < -160 || sx > w + 160) continue;
      var kind = null, acc = 0;
      for (var q = 0; q < list.length; q++) { acc += list[q][1]; if (hv < acc) { kind = list[q][0]; break; } }
      if (!kind) continue;
      var by = lipOf(sx), Hc = (K.hMin + (K.hMax - K.hMin) * pick) * z, R = Math.max(1.6, (K.R || 8) * z), drum = Math.round((K.drum || 26) * z);
      var base = { R: R, ramp: K.ramp, light: K.light, deep: K.deep, capital: K.capital, drum: drum, lipOf: lipOf, seed: i, T: K.T };
      if (kind === "column") { base.H = Hc; B.column(fb, sx, by, base); }
      else if (kind === "broken") { base.H = Hc; base.broken = 0.25 + 0.4 * pick; B.column(fb, sx, by, base); }
      else if (kind === "statue") B.statue(fb, sx, by, { H: (K.statueH || 80) * z * (0.9 + 0.2 * pick), ramp: K.statueRamp || K.ramp, light: K.light, deep: K.deep, lipOf: lipOf, pose: Math.floor(pick * 3) });
      else if (kind === "urn") B.urn(fb, sx, by, { H: (K.urnH || 30) * z, ramp: K.ramp, light: K.light, deep: K.deep, lipOf: lipOf });
      else if (kind === "lintel") {
        var gap = (K.lintelGap || 96) * z, x2 = sx + gap, by2 = lipOf(x2), lh = Math.max(4, Math.round(24 * z));
        var topY = Math.min(by, by2) - Math.round(Hc * 0.92);
        base.H = by - topY; B.column(fb, sx, by, base);
        base.H = by2 - topY; base.seed = i + 7; B.column(fb, x2, by2, base);
        var bR = pick > 0.5;
        B.lintel(fb, sx - R * 2.3 - (bR ? 0 : gap * 0.3), x2 + R * 2.3 + (bR ? gap * 0.3 : 0), topY - lh, lh, { ramp: K.ramp, deep: K.deep, seed: i, brokenRight: bR });
      }
    }
  };

  // ------------------------------------------------------------------------------------------------------------------
  // BACKDROP HELPERS (strips = {w, h, d}; x wraps so strips tile)
  B.put = function (st, x, y, c) { if (y < 0 || y >= st.h) return; x = ((x % st.w) + st.w) % st.w; st.d[y * st.w + x] = c; };
  B.get = function (st, x, y) { if (y < 0 || y >= st.h) return 0; x = ((x % st.w) + st.w) % st.w; return st.d[y * st.w + x]; };
  function putClip(s, x, y, c) { if (x >= 0 && y >= 0 && x < s.w && y < s.h) s.d[y * s.w + x] = c; }

  // small temple (steps, columns, entablature, pediment) into a strip or frame {w,h,d}; x0 = left, yb = ground row
  // P: { lit, mid, dark, deep, roof, glow (lamp index or 0) }, light: +1 / -1
  B.temple = function (st, x0, yb, W, Ht, P, light, wrap) {
    var put = wrap ? B.put : putClip, x, y, s, c;
    var steps = Math.max(1, Math.round(Ht * 0.1)), entH = Math.max(1, Math.round(Ht * 0.14)), pedH = Math.max(2, Math.round(Ht * 0.24));
    var colTop = yb - steps - Math.round(Ht * 0.52), colBot = yb - steps, n = Math.max(3, Math.round(W / 3.2)) | 1;
    for (s = 0; s < steps; s++) for (x = x0 - steps + s; x <= x0 + W - 1 + steps - s; x++) put(st, x, yb - 1 - s, s === steps - 1 ? P.lit : P.mid);
    for (y = colTop; y < colBot; y++) for (x = x0 + 1; x < x0 + W - 1; x++) put(st, x, y, P.deep);
    var sp = (W - 1) / (n - 1);
    for (c = 0; c < n; c++) {
      var cx = Math.round(x0 + c * sp);
      for (y = colTop; y < colBot; y++) { put(st, cx, y, P.lit); if (Ht >= 18) put(st, cx + (light > 0 ? -1 : 1), y, P.mid); }
    }
    if (P.glow) for (c = 0; c < n - 1; c++) { var gx = Math.round(x0 + (c + 0.5) * sp); if (hh(x0 + c, yb) < 0.55) { put(st, gx, colBot - 1, P.glow); if (Ht > 14) put(st, gx, colBot - 2, P.glow); } }
    for (y = colTop - entH; y < colTop; y++) for (x = x0 - 1; x <= x0 + W; x++) put(st, x, y, y === colTop - entH ? P.lit : P.mid);
    for (y = 0; y < pedH; y++) {
      var half = Math.round((W / 2 + 1) * (1 - y / pedH)), cxm = x0 + (W - 1) / 2, py = colTop - entH - 1 - y;
      for (x = Math.round(cxm - half); x <= Math.round(cxm + half); x++) put(st, x, py, (x === Math.round(cxm - half) || x === Math.round(cxm + half)) ? P.lit : ((x - cxm) * light > 0 ? P.mid : P.roof));
    }
  };

  // cypress (tall flame-shaped tree) into a target; P: { dark, mid, lit }
  B.cypress = function (st, cx, yb, Ht, P, light, wrap) {
    var put = wrap ? B.put : putClip, hw = Math.max(1, Ht * 0.13);
    for (var k = 0; k < Ht; k++) {
      var t = k / Ht, half = hw * Math.min(1, Math.sin(Math.PI * Math.min(1, (1 - t) * 1.02)) * 1.25) * (t < 0.12 ? 0.75 : 1);
      if (t > 0.9) half = Math.min(half, 0.5);
      var y = yb - k, a = Math.round(cx - half), b = Math.round(cx + half);
      for (var x = a; x <= b; x++) put(st, x, y, (x - cx) * light > half * 0.25 ? P.lit : ((x === a || x === b) && ((x + y) & 1) ? P.dark : P.mid));
    }
  };

  V8.bridge = B;
})(typeof window !== "undefined" ? window : this);
