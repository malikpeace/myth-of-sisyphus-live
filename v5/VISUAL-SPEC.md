# Sisyphus 5 Visual Specification

## Non-negotiable Behavior

- Preserve V4 input, push cadence, movement, rollback, terrain physics, scoring,
  modes, progression, audio timing, and gameplay constants.
- Rendering may observe gameplay state but must not modify it.
- V5 writes only to `sisyphus5.*`.

## Canonical Pixel Grid

- Render the world directly at one virtual-pixel resolution (`RES = 1`).
- One virtual world pixel displays as exactly 2 CSS pixels on compact/mobile
  screens and 3 CSS pixels on larger screens.
- Calculate virtual width/height from the viewport and chosen integer display
  scale. Never stretch the world canvas fractionally.
- Center the canvas; allow only the 0–2 pixel viewport remainder at its edges.
- Snap camera translation, sprite origins, terrain samples, particles, shadows,
  and effect masks to virtual integer coordinates before drawing.
- Keep `imageSmoothingEnabled = false` on world rendering contexts.

## Art Language

- Author final assets at their in-game virtual size or an exact integer multiple.
- Use a shared daylight palette and biome-specific extensions.
- Limit material ramps to deliberate stepped values; avoid micro-noise.
- Use one-pixel world outlines at 1× where outlines are required.
- No accidental partially transparent edge pixels.
- No per-object Gaussian blur. Create depth with scale, palette, contrast,
  occlusion, and slower world movement.
- Generated imagery is source material only. Reduce, palette-map, edge-clean,
  and verify it on the canonical grid before use.

## First Vertical Slice

The approval slice covers title, menu, and the first 0–700 meters:

- cloudless mountain layers and deliberate moving cloud sprites
- grass, topsoil, flowers, rocks, bushes, and cliff edge
- Sisyphus, boulder, pose animation, contact/cast shadows
- background and foreground trees
- waterfall transition and rope bridge
- day lighting, birds, weather, HUD, and pause/menu transitions

The remaining biomes are ported only after this slice clearly outperforms V4 in
side-by-side moving captures on desktop, square, tablet, and phone viewports.

## V5 Realm Pass

- Rocky terrain uses broken, world-locked strata and sparse stepped outcrops.
- Galaxy uses V5-only wide and portrait pixel masters with a reduced palette.
- Greek and ruins scenes use broad broken masonry that remains legible at zoom.
- Storm and volcanic scenes use clustered basalt rather than thin floating lines.
- Aurora, obsidian, and void use distinct stepped crystal palettes.
- Bones uses planted fossil fragments; Elysium uses warm carved stone.
- Cloud visibility follows realm lighting, including a nearly cloudless void.
