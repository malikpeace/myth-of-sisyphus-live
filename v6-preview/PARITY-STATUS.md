# V6 Parity Status

This file records what is proven in the current V6 build. A checked item needs
current source evidence plus runtime evidence at every relevant target view.

## Protected Baseline

- [x] V5 stays outside `/v6-preview/`.
- [x] V5 checksum remains
  `3e3c5e76f68c31ce51255b7e1cd2185fac2103bef2c3d0132ea59c39a5050a9f`.
- [x] V5 desktop and iPhone reference captures are stored under `baselines/`.

## Gate 1: Pixel Grid

- [x] DPR-aware logical canvas and integer CSS presentation.
- [x] Smoothing disabled for world rendering.
- [x] Desktop 1440 x 900 framing.
- [x] iPhone 14 Pro Max portrait 430 x 932 framing.
- [x] iPhone 14 Pro Max landscape 932 x 430 framing.
- [x] Integer grid measurements at desktop, portrait, and landscape.
- [x] Orientation-change and PWA safe-area regression suite.

## Gate 2: Moving Meadow

- [x] Fixed-step V5 endless physics slice.
- [x] Alternating tap controls, hold-to-brace, rollback, score, peak, and best.
- [x] V5 ground travel rate and slope progression.
- [x] V5-derived 512 x 512 meadow master with taller grass, layered flowers,
  organic soil depth, and no smoothing or texture rotation.
- [x] Moving desktop, portrait, and landscape visual/performance evidence.
- [x] Deterministic V5/V6 tap trace parity at desktop, portrait, and landscape.
- [ ] Explicit owner approval of the meadow ground candidate.

## Gate 3: Character And Boulder

- [x] V5-approved boulder appearance retained as the source reference.
- [x] Offline nearest-neighbor rotation frames avoid runtime rotation.
- [x] V5 push rhythm and ordinary-tap animation behavior ported.
- [x] V5 camera pullback and framing curve retained by the complete V5 runtime.
- [x] Seven native boulder size stages with boundary hysteresis.
- [x] Growth-aware actor contact and V5 shadow presentation retained.
- [x] Full rollback and high-slope comparison against V5 (0-1m push-trace delta).

## Gate 4: First 700 Metres

- [x] V5 title, six-mode menu, pause, settings, records, and achievements.
- [x] V5 clouds, sun path, birds, weather, and lighting systems retained.
- [x] World-stable distant trees, bushes, flowers, and landmarks retained.
- [x] Progressive two-row background forest grows from sparse meadow edge to a
  dense 1.1km stand without moving independently of the ground.
- [x] Oversized low foreground trees match V5 placement, fade, opacity, and blur.
- [x] Cliff edge, bridge, waterfall, and receiver-masked shadows retained.
- [x] Mixed-width terrain masters mirror-wrap independently with no vertical
  meadow/rock/realm strip at 1.05-1.25km or later biome handoffs.
- [x] Settings and save persistence use isolated V6 storage with one-time V5 import.
- [x] Audio, haptics, milestones, achievements, and toasts retain V5 logic; real-player settings persist.
- [x] Continuous desktop playthrough to 707m with monotonic trace and no errors.
- [x] Continuous iPhone screen-tap playthrough to 711m with monotonic trace and no errors.

## Gate 5: Modes And Remaining Biomes

- [x] Daily launch, intro, target, and achievement path.
- [x] Endless launch, movement, scoring, pause, restart, and menu return.
- [x] Absurd/summit `again?` ending and resume path.
- [x] Resolve cadence and resolve-meter behavior.
- [x] Timed picker, countdown, result, and best-save path.
- [x] Rush launch and mode HUD behavior.
- [x] Thirteen hard-pixel biome grounds plus meadow and rocky terrain.
- [x] Direct continuous biome handoffs without generic-rock flashes.
- [x] Mode-specific feedback, milestone, persistence, and achievement paths retain V5 logic and pass runtime checks.

## Gate 6: Release

- [x] Full regression matrix passes.
- [x] Validated complete runtime promoted to `/v6-preview/index.html`.
- [x] Fresh end-to-end audit one passed after the RC3 continuity/forest revision.
- [x] Fresh end-to-end audit two passed independently after the RC3 continuity/forest revision.
- [x] Explicit Night style applies a clipped moonlit grade to terrain, bridges,
  and later backdrops without softening or changing the native pixel grid.
- [x] Automatic night stages fade the world palette and moonlight together;
  daytime remains ungraded at the exact phone target.
- [x] Night opening, bridge, progressive forest, snow transition, and deep-realm
  checks retain readable silhouettes and authored biome identity.
- [x] RC5 transparent mountain plate preserves moving-cloud depth, uses a
  240 x 150 hard-pixel logical master, and presents without smoothing.
- [x] RC5 world-locked crest grass breaks the straight terrain horizon without
  adding texture motion, blur, or bridge overlap.
- [x] RC5 sun/moon-aware one-pixel actor rim keeps Sisyphus black while improving
  separation on dark scenery.
- [x] RC5 moon wrap fades below visibility before crossing the viewport and
  fades back in from the opposite side without a position pop.
- [x] RC5 iPhone push regression advances a fresh Endless run from 0m to 99m
  with no overflow or loop error and 1.18ms average game work per frame.
- [x] V5 checksum is unchanged at release.
- [ ] Explicit final visual approval.
