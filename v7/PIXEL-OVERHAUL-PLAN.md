# Myth of Sisyphus V6 Pixel-Perfect Overhaul

## Mission

Rebuild the presentation layer so the game reads as authored pixel art at every
supported viewport while preserving V5 gameplay, modes, controls, pacing,
physics, progression, scoring, audio timing, and saved-player expectations.

V5 remains frozen and published. V6 is developed only under `/v6-preview/`
until every stage gate passes.

## Frozen Baselines

- V4 root SHA-256: `20a5ec87a50fd60dce1ce05c558f944b69207a0a24009605bfefdc8104d93d51`
- V5 SHA-256: `3e3c5e76f68c31ce51255b7e1cd2185fac2103bef2c3d0132ea59c39a5050a9f`
- V5 git commit: `180bc07fc224910ac26563026bccccb0d7197407`
- V5 restore tag: `v5-pixel-overhaul-baseline-2026-07-18`

## Device Targets

- Primary phone: iPhone 14 Pro Max, Safari home-screen web app.
- Phone portrait reference: 430 x 932 CSS pixels.
- Phone landscape reference: 932 x 430 CSS pixels.
- Desktop references: 1440 x 900 and 1920 x 1080 CSS pixels.
- Respect `viewport-fit=cover` and safe-area insets without a black footer.

## Architecture

1. The simulation runs unchanged from V5.
2. The world is rendered at logical resolution with smoothing disabled.
3. Presentation uses integer CSS scaling only.
4. The logical viewport extends to consume device remainders; it is never
   fractionally stretched.
5. World coordinates, camera offsets, sprite origins, masks, and terrain
   samples are rounded to the logical grid at draw time.
6. DOM menus and HUD remain DOM elements, but their layout is tested against
   the logical world at all target viewports.

## Stage Gates

### Gate 0: Freeze and Measure

- Freeze exact V5 source and checksum.
- Capture deterministic V5 gameplay traces.
- Capture V5 screenshots and frame timings at every target viewport.
- Record protected visuals and known defects.

### Gate 1: Pixel Grid

- Implement the DPR-aware integer presentation system.
- Verify every displayed world pixel is a hard-edged integer rectangle.
- Verify full-bleed iPhone PWA framing in portrait and landscape.
- Verify resize and orientation changes do not flash or wipe the canvas.

### Gate 2: Moving Meadow Slice

- Rebuild the first meadow with native-size pixel tiles and sprites.
- Compare two terrain methods in motion:
  - authored quantized slope tiles
  - logical-resolution rasterized pixel curve with axis-aligned tile fill
- Reject rotated or fractionally scaled terrain textures.
- Preserve V5 movement and camera traces.
- Pass desktop and iPhone screenshot, motion, and performance checks.

### Gate 3: Character and Boulder

- Preserve the current Sisyphus silhouette unless a replacement clearly wins.
- Build seven discrete boulder size stages with pre-authored rotation frames.
- Use hysteresis at size boundaries so stages never flicker.
- Preserve contact points, push poses, roll cadence, and gameplay collision data.

### Gate 4: First 700 Metres

- Port trees, bushes, flowers, cliff edge, bridge, waterfall, sun, clouds,
  shadows, weather, birds, HUD, pause, and menu transitions.
- Foreground trees remain truly foreground: large, low, trunk mostly out of
  frame, slightly blurred, and fully opaque after their entrance fade.
- Shadows can appear only on terrain or bridge receiver masks.

### Gate 5: Remaining Biomes and Modes

- Port one biome at a time.
- Each biome needs its own approved palette extension and asset sheet.
- Preserve all modes and gameplay parity before public release.

### Gate 6: Release

- Run the complete regression matrix.
- Confirm no V5 file changed.
- Publish V6 only after explicit visual approval.

## Acceptance Rules

- No world asset uses browser smoothing.
- No world sprite is displayed at a fractional logical position.
- No production terrain texture is rotated.
- No unapproved generated image is shipped directly.
- Gameplay trace values match V5 within documented tolerances.
- Visual terrain may differ from collision terrain by at most two logical pixels
  near the player and boulder, and three elsewhere.
- V6 must meet or beat V5 frame pacing on the iPhone target.
- A failed gate blocks later biome work.

## Recovery

V5 can always be restored from the published tag. V6 files live in a separate
directory and use `sisyphus6.*` storage keys until release migration is approved.
