# Myth of Sisyphus V8

Every pixel on screen is now one palette index on one grid: hero, stone, all realms, journey zones, menus, HUD and share card.
V7 (painted plates) is untouched at `/v7/`; V5, V6 and the main link are untouched too.

**Play:** https://malikpeace.github.io/myth-of-sisyphus-live/v8/

## What is new
- **The hero and the stone** are drawn natively on the world's pixel grid (no resampling): a rig-driven figure with two looks (Settings > Hero: *shadow* = dark, backlit, rim-lit; *color*), a lit faceted stone with per-realm materials.
- **Seven realms built entirely in code** (no image plates): The Hills, The Falls, Moonlit Rome, Sunset Rome, The Snow, The Blossom, The Dusk. Each frame uses ~70-130 colours (V7 used 5,000-12,000).
- **The endless journey** (Endless, Rush, Timed, Daily, Resolve, Summit) walks through all 14 zones as V8 scenes (see `ZONES.md`); a dithered mist crossing hides each hand-over.
- **Pixel UI:** one bitmap font (SisyphusPx), stepped-corner panels, buttons, dialogs, HUD and realm cards painted by the realms themselves.
- **Settings:** Theme (classic / night / void = palette grades over every scene), Hero look, Pixels (Fine = today's grid, Chunky = 1.33-1.5x bigger pixels), Sound.
- **Living details:** bird flocks, eagle / wind / watcher / thunder events, footprints, the 1000 m quote sign, Daily target sign, old-best afterglow, pull-back labels, wind streaks, particles - all palette-locked.
- **Share card:** a whole-number upscale of the live frame with stepped-dither bands, the UI font and the realm ladder.
- **Fast:** ~0.2 MB gzip to first play (legacy painted art only loads if a legacy frame is ever drawn).

## Map
`px.js` pixel toolkit | `rock.js`, `hero.js`, `actor.js` stone/figure | `scenery.js` shared generators | `core.js` pipeline (framebuffer, palette, markers, overlays glue, thumbnails, look grades) | `overlays.js` shared living details | `realms/*.js` one scene each | `ui.css`, `ui.js`, `ui/` pixel UI kit | `index.html` game + glue.
Docs: `REALM-GUIDE.md` (how to write a scene), `ZONES.md` (journey ladder), `V8-PLAN.md` (status). Tools in `tools/` (`serve.py`, `cdp.py`, `realm-test.html`, `thumb-test.html`, `bust.py`, ...).

## Deploy routine
`python3 v8/tools/bust.py` (cache-bust tokens) -> `git add` finished v8 files -> commit -> push (Pages rebuilds in ~1 min).
