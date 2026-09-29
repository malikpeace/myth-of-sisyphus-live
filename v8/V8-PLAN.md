# Myth of Sisyphus V8 — one grid, one light, one palette

Goal (owner, 2026-09-28): a visually coherent, truly 8-bit game "all the way through", with sprites/assets
that feel AAA. V7 (painted backdrops) stays untouched at `/v7/`; V8 lives at `/v8/` and references V7's asset
files by path for anything not yet rebuilt.

## Decisions (grill-me, all confirmed by the owner)
- Rebuild EVERY realm from scratch in code (Dusk's graphic language: banded skies, clean layered shapes,
  dithered light, rim light) — but each realm keeps its own colours and lit ground.
- Hero: two looks, switchable in Settings — "shadow" (dark, backlit, rim-lit; default) and "color".
- Pixel size: "Fine" (default = today's grid) and "Chunky" (1.5x) as a Settings option.
- The hero may shrink to a ~11 px speck at deep zoom (Colossus scale); a rim glint keeps him visible.
- Full pixel UI (bitmap font, chunky panels, pixel realm cards + share card).
- Realms first; legacy modes inherit the new hero/rock/menus immediately; their deeper zones are rebuilt after.
- Autonomous build, publish to /v8/ as each milestone passes checks (desktop + iPhone portrait/landscape).

## Architecture
Simulation/physics are untouched. New drawing code lives in separate modules:
- `px.js`     pixel toolkit: integer-hash noise, ordered dither, indexed sprites, capsule/poly rasterisers, IK.
- `rock.js`   the stone: a lit faceted sphere (per-pixel normals, 6-tone ramp + dither, outline, rim, bounce),
              cached by size/angle/light; accent styles (moss/snow); lumpy silhouette.
- `hero.js`   the figure: the game's own rig (walk, brace, stumble, push-drive, wind lean, giant lean-in, hands
              on the stone) rasterised natively with shaded capsules; LOD down to a speck; cosmetics.
- `actor.js`  composes stone + hero + dithered shadow into one indexed sprite, palette per frame.
- `scenery.js` shared generators: dithered sky bands, cloud sprites, mountain ranges (ridges/wedges/snow), forested ridges, pines.
- `core.js`   the realm pipeline: indexed framebuffer + palette (named ramps, shade tables), markers (cairns, best flag).
- `realms/*.js` one module per realm (palette, backdrop, ground, front, light). Add a realm by registering with `V8.register`.
- `index.html` glue: `v8ActorPass()` builds the parameters each frame and replaces the old coarse-buffer actor.
Rule: nothing is ever resampled. Skeletons/centres are mapped to screen pixels (slope rotation + camera zoom)
and rasterised there; colours come from palette ramps only.

## Milestones
- [x] M1  New hero + rock in every realm and mode (Settings: hero look). Verified desktop/phone, all modes.
- [x] M2  V8 realm pipeline (indexed framebuffer + palette) + The Hills in code, shared overlays (birds, mythic events, footprints, signs, afterglow), pixel share card, legacy modes start in the new Hills.
- [x] M3  All seven realms built in code: Hills, Falls, Moonlit Rome, Sunset Rome (shared masonry `realms/_bridge.js`), Snow, Blossom, Dusk.
- [x] M4  Pixel UI kit (SisyphusPx bitmap font, panels, buttons, cards, HUD, dialogs) + realm cards painted by the realms + canvas HUD text in the same face.
- [x] M5  Fine/Chunky, Night/Void looks as palette grades over every scene, lazy legacy art (first load ~0.2 MB gz), cache-busting, fuzz + matrix QA, iOS Safari check.
- [x] Journey: all 14 zones of the endless climb are V8 scenes (`V8_LEGACY_SEGMENTS`, mist crossing, zone-name banner): hills, falls, above-the-clouds (snow), night sky (galaxy), canyon, sunset rome, storm pass, moonlit ruins, ash fields (volcanic), aurora, bone fields, obsidian, elysium (blossom), the void. Wave-2 zone scenes were built by parallel workers (see `ZONES.md`).
- [x] Hero redesign (owner: "the character model looks TERRIBLE"): six-head athletic figure, spine leaning into the stone, arms at near-full reach, profiled muscles, round joints, face with hairline/brow/eye/nose/beard, kilt + sash + baldric + wrist wraps + sandals, cast shadows, ink outline, chunky small-size figure, summit cheer with clenched fists; colour look is the default (shadow look in Settings).
- [x] Hero pass 3 (2026-09-29 night): the figure read as a meerkat/kangaroo because the leg IK bent the knees BACKWARD - fixed (knees forward, elbows down); hand-authored bitmap heads (5 sizes) with jaw beard, no hair tail; slope-aware lean, thinner limbs, longer legs, straight-armed diagonal push against giants; constant-speed stance so planted feet do not skate (cadence 0.16); stone spin = ground speed / radius; moonlit-slate silhouette on near-black surrounds (Dusk).
- [x] Perf: zone scenes are cached across revisits (8 realms used to discard their baked caches on every init) and the heavy ones are pre-built one per idle tick on the gate / menu / pause screen (`V8.warm`); 4x CPU throttle: 4-8 ms/frame average in every scene.
- [~] Ongoing: three independent review passes (hero states, world tour, UI flows) and their fixes.

## QA
`tools/serve.py` (sturdy static server) + `tools/cdp.py` (dependency-free headless-Chrome driver; its `canvas`
step saves the game's NATIVE pixels) + `tools/start8.py` (start helpers, waits on `assetsReady`).
Test URL: `http://127.0.0.1:8811/v8/?qa=1&qaRealmArt=1&qaRealm=hills` then click ENTER -> START.

## Polish backlog
- Hero: hand-drawn hands/feet bitmaps, inner contour lines between limbs, per-part 3-tone shading; giant-stone facet variety;
  Dusk stone/hero palette (blacker, rim stronger); dither/palette-lock pass for gradients, glow, vignette.
