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
- [x] M2  V8 realm pipeline (indexed framebuffer + palette) LIVE; Hills rebuilt in code (strata, roots, relics, bushes/ferns/flowers,
          butterflies, pollen, slope pines, organic foreground pines, amethyst crystals + magma veins in the deep).
          Shared overlays (`overlays.js`): bird flocks, mythic events (eagle/thunder/wind/watcher), footprints, 1000 m quote sign, Daily target.
          Pixel share card (whole-number upscale, stepped-dither bands, bitmap type, pixel ladder). Hero anatomy/tone/kilt/outline pass.
          Legacy modes open in the new Hills (0-700 m) and cross into the painted zones through a dithered mist crossing.
          `V8.thumbnail(id,w,h)` / `V8.thumbnailAsync` paint realm cards from the realm itself (block-mode reduction).
- [~] M3  Falls, Moon Rome, Snow, Sunset Rome, Blossom, Dusk ported to the pipeline (parallel workers; integrate + review each)
- [~] M4  Pixel UI kit (bitmap font TTF, panels, cards) - worker building; hook `V8.thumbnail` into ui.js `thumbs()` on integration
- [ ] M5  Chunky (`S.adj`) pass across realms, polish, performance, full QA matrix
- [ ] Stretch: legacy deep zones as scenes (extend `V8_LEGACY_SEGMENTS` in index.html as each is rebuilt)

## QA
`tools/serve.py` (sturdy static server) + `tools/cdp.py` (dependency-free headless-Chrome driver; its `canvas`
step saves the game's NATIVE pixels) + `tools/start8.py` (start helpers, waits on `assetsReady`).
Test URL: `http://127.0.0.1:8811/v8/?qa=1&qaRealmArt=1&qaRealm=hills` then click ENTER -> START.

## Polish backlog
- Hero anatomy pass (shoulders, cloth shape, hand detail, more expressive walk); giant-stone facet variety;
  Dusk stone/hero palette (blacker, rim stronger); dither/palette-lock pass for gradients, glow, vignette.
