# V8 legacy journey zones (wave 2)

Legacy modes (classic Endless, Rush, Timed, Daily, Resolve, Summit) climb through a 15,000 m journey of "zones".
Until now only the first (mountain) is a V8 scene; the rest still use V7's crude painted/tinted renderer
(see `v8/tools/refs/v7-legacy-zones-1200-to-15500.png`: flat tints, rotated hatch ground, a fuzzy boulder).
Wave 2 rebuilds the missing zones as V8 realm modules (same contract as `REALM-GUIDE.md`), so every mode is V8 "all the way through".
They register with `V8.register("<id>", R)` like any realm but are NOT menu realms (no card): they only appear in the legacy journey.

## The ladder (visual metres -> scene). The mist crossing in index.html hides each hand-over.
| from m | zone            | scene id       | status |
|--------|-----------------|----------------|--------|
| 0      | mountain        | `hills`        | done |
| 700    | waterfall       | `waterfalls`   | done (wave 1) |
| 1120   | above the clouds| `snow`         | done (wave 1, high overcast peaks) |
| 1800   | galaxy          | `galaxy`       | WAVE 2 - Cosmos worker |
| 2500   | canyon          | `canyon`       | WAVE 2 - Rock worker |
| 3200   | greek sunset    | `sunset-rome`  | done (wave 1) |
| 4450   | storm pass      | `storm`        | WAVE 2 - Weather worker |
| 5950   | ruins           | `moon-rome`    | done (wave 1, night ruins/city) |
| 7450   | volcanic        | `volcanic`     | WAVE 2 - Rock worker |
| 8950   | aurora          | `aurora`       | WAVE 2 - Cosmos worker |
| 10450  | bone fields     | `bones`        | WAVE 2 - Weather worker |
| 11950  | obsidian        | `obsidian`     | WAVE 2 - Rock worker |
| 13450  | elysium         | `blossom`      | done (wave 1) |
| 15000  | the void        | `void`         | WAVE 2 - Cosmos worker |

The player sees a zone for ~750-1500 m (a few minutes). Each scene must therefore hold up for a long stretch: keep slow ambient motion
(no big repeating pops), world-locked ground, and vary the mid-ground with altitude the way `hills.js` does.
Hero + stone must read clearly (rim light colour and ground contact shadow come from `R.light(S)`).

## Creative direction per zone (each keeps the shared graphic language: banded dithered sky, clean layered shapes, rim light, palette-locked)
- **galaxy** - "The Night Sky": above the weather; deep indigo->violet bands, a dense dithered star field in 3-4 sizes/tints, a milky-way band,
  2-3 soft nebula clouds (violet / teal / rose, ordered dither, no smooth gradients), occasional shooting star (bright head + dithered tail),
  far dark peaks with cold starlight rim. Ground: dark violet slate strata with faint cyan-lit veins and tiny crystals. Cool rim on the hero.
- **canyon** - "The Canyon River": warm late-afternoon light in a deep red-ochre sandstone gorge; layered strata walls receding in atmospheric steps,
  a river far below reflecting the sky (dither ripples, sun glints), a few birds. Ground: baked sandstone strata, cracks, scattered scree.
  Reference plate: `assets/canyon-river-realm-px.png` (mood/colours only; recreate in code).
- **storm** - "Storm Pass": heavy dark cloud banks, driving angled rain (palette-locked streaks that lift/darken pixels, not RGB lines), gusting scud,
  lightning: `V8.emit("strike", x)` (game adds thunder/shake) + a brief palette flash and a forked bolt with dithered afterglow. Wet dark rock ground
  with puddle glints; muted blue-grey palette with the occasional warm lightning colour. Look at `realms/dusk.js` for how strikes are done.
- **volcanic** - "The Ash Fields": smoky red-orange sky, ash-cloud layers, a distant volcano with glowing lava rivers, falling ash motes and drifting embers;
  heat-shimmer dither rows near the horizon. Ground: black basalt with lava veins that pulse slowly, glowing cracks, cooled crust plates.
- **aurora** - "The Aurora": frozen tundra night; curtains of green/teal/violet aurora as animated ordered-dither ribbons over stars, ice-blue mountains,
  snow-dusted dark rock with a teal glow line and small ice crystals. Calm and luminous.
- **bones** - "The Bone Fields": pale beige/grey wasteland under a hazy sepia sky; colossal half-buried ribcages, skulls and vertebrae as layered silhouettes,
  dry grass tufts, slow dust devils. Ground: bone-white dust and fragments, cracked hardpan. Mournful, vast.
- **obsidian** - "Obsidian": deep blue night, two crescent moons, black glass shards and facets catching moonlight (sharp cyan/white glints, sparkles),
  a faceted mirror-like ground with long light streaks. Sharp, cold, geometric.
- **void** - "The Void": near-black; a few faint stars, one thin pale ring / eclipse, the ground barely there (an edge light and subtle drifting motes).
  Extremely minimal, maximum drama; the hero and stone are rim-lit only. No busy detail - this is the end of the world.

## Working rules (same as wave 1)
Read `v8/REALM-GUIDE.md` (contract, overlays, Chunky, thumbnail) and study `v8/realms/hills.js`, `snow.js`, `dusk.js` for quality and structure.
One realm file per zone: `v8/realms/<id>.js` (+ optional shared helpers appended to nothing else - do NOT edit scenery.js, core.js, index.html; ask me).
Test with realm-test (`realm=<id>`), the real game (`qaRealmArt=1&qaRealm=<id>` selects any registered V8 scene) at desktop 1440x900, phone 430x932 (dpr 2) and landscape 932x430,
at alt 0 / 350 / 1100 / 3000. Budget: ~1.5-2 ms/frame ground+backdrop on desktop, unique colours per frame under ~150, no console errors,
Chunky-aware (`S.adj`), `R.birdIdx/watcherIdx/footprint/thumb` set. Report: files, unique colours, ms/frame, anything I must wire.
