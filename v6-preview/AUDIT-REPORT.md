# V6 Release Audit

## Candidate

- Entry: `/v6-preview/index.html`
- Build: `sisyphus6-release-candidate-3`
- Candidate checksum: `e78db84cf779b81c7fd34be948619a90591a1fe1041647c6aa44b2d3e01a3412`
- Protected V5 checksum: `3e3c5e76f68c31ce51255b7e1cd2185fac2103bef2c3d0132ea59c39a5050a9f`

## RC2 Ground Revision

- Replaced only the V6 meadow terrain master; gameplay, backgrounds, character,
  boulder, shadows, props, modes, and camera behavior are unchanged.
- Built `assets/meadow-ground-v3.png` directly from the protected V5 meadow
  reference so its visual language matches V5 instead of inventing a new one.
- Increased the terrain master from 256 x 512 to 512 x 512 for twice the
  horizontal variation while preserving the V6 integer pixel grid.
- Restored the V5 qualities the previous V6 ground lost: a deeper grass canopy,
  varied grass clumps, layered flowers, lighter upper soil, darker lower soil,
  roots, and embedded stones.
- The new master has 25 controlled colors and zero partial-alpha pixels. Runtime
  smoothing and runtime texture rotation remain disabled.
- The rejected V2 ground remains available for rollback; V5 was not edited.

## RC3 Terrain Continuity And Forest Revision

- Corrected mixed-width terrain sampling. The 512px meadow and 256px
  rock/realm masters now mirror-wrap using their own native dimensions, so a
  narrower material can never disappear as a vertical rectangular strip.
- Rechecked the full 1050-1250m meadow/rock/galaxy blend and every later
  biome handoff; all material weights remain continuous and sum to 1.0.
- Broadened the low-mountain forest progression. Trees begin sparsely after the
  opening meadow, reach a dense stand through the 1.1km climb, then ease away
  before the first high realm.
- Added a smaller, softer far-tree row behind the main ground-anchored row.
  Both rows remain fixed to the hillside; the camera-near foreground trees and
  bridge exclusion behavior are unchanged.

## RC3 Audit One - Passed

- Rechecked 250m, 650m, 900m, every 1050-1250m blend checkpoint, and all twelve
  later biome handoff midpoints on an exact 430 x 932 phone viewport.
- Every settled terrain sample reported a complete alpha sum of 1.0 and no loop
  error; the meadow faded continuously from 0.788 at 1050m to 0.006 at 1250m.
- Inspected fresh 1143m phone and desktop-framing comparisons. The former
  rectangular material strip is absent and the hillside remains continuous.
- Compared progressive forest frames at 250m, 650m, 900m, and 1143m. The opening
  stays sparse, the bridge remains clear, and the upper low-mountain climb reads
  as a layered forest.
- Phone game work averaged about 1.2-1.9ms per frame in settled forest views.

## RC3 Audit Two - Passed

- Launched Daily, Endless, Absurd, Resolve, Timed, and Rush from fresh RC3 pages;
  each entered the requested playing state with no loop errors.
- Rechecked the 1143m transition from a fresh phone page and the 650m bridge from
  a separate fresh page; the terrain seam stayed absent and no tree touched the
  bridge deck.
- Repeated portrait to landscape to portrait rotation at exact 430 x 932,
  932 x 430, and 430 x 932 presentation with no overflow or state errors.
- Twenty real alternating phone taps advanced a fresh Endless run to 70m with
  responsive controls and 0.67ms average game work per frame.
- Browser diagnostics were empty of warnings and errors on both audit tabs.
- Asset verification, promoted-runtime equality, and the protected V5 checksum
  passed again after the final code change.

## RC2 Audit One - Passed

- Title and settled six-mode menu inspected at 1440 x 900.
- Daily, Endless, Absurd, Resolve, Timed, and Rush launched from fresh promoted pages.
- Meadow, forest, bridge, rocky terrain, and all thirteen deep biome grounds rendered without errors.
- The revised meadow was inspected at 1440 x 900, 430 x 932, and 932 x 430;
  each view retained a hard integer grid with no smoothing or overflow.
- A real 150-tap iPhone-sized climb reached 194m with no loop errors and game
  work averaging 0.77ms per frame.
- The bridge/cliff view and all thirteen deep-biome anchors remained visually
  unchanged after the ground-only replacement.
- Direct terrain handoffs use native biome-to-biome blends; no generic-rock handoff flash during normal progression.
- Uninterrupted desktop climb reached 707m with a monotonic trace and no loop errors.
- Uninterrupted iPhone screen-tap climb reached 711m with a monotonic trace and no loop errors.
- iPhone 14 Pro Max portrait, landscape, and portrait-return remained exact integer grids with no overflow.
- Mobile pause, resume/share/restart/menu actions were present and correctly bounded.
- V5/V6 steep-slope push traces differed by no more than 1m at push checkpoints; rollback behavior matched.
- Real-player night and sound settings survived reload; cleanup back to classic and sound-off also survived reload.
- V6 terrain and boulder assets passed dimension and hard-alpha verification.
- RC2 screenshots are stored in `baselines/` with `audit1-ground-v3-` and
  `v6-meadow-v3-` prefixes.

## RC2 Audit Two - Passed

- Reopened RC2 from a fresh title page and inspected the fully settled menu at 1440 x 900.
- Repeated Timed expiry, Absurd `again?`, Resolve rhythm, Rush combo, and Daily target behavior.
- Rechecked every native biome handoff at its 50/50 midpoint; all layer pairs summed to 1.0 with no errors.
- Repeated pause and resume, Daily achievement/target state, and all six mode launches with no loop errors.
- Repeated portrait to landscape to portrait rotation at exact 430 x 932,
  932 x 430, and 430 x 932 presentation with no overflow or state loss.
- Rechecked the revised ground in a fresh iPhone portrait capture; the V5-style
  grass and soil depth remained sharp at the exact two-screen-pixel grid.
- Reconfirmed exact 430 x 932 and 932 x 430 integer presentation with no document overflow.
- Inspected fresh menu, phone, bridge, storm, void, and transition screenshots.
- Rechecked browser diagnostics: no console errors on phone or deep-world pages.
- Re-ran asset verification, manifest parsing, promoted-candidate equality, and the protected V5 checksum.

## Remaining Approval

The RC3 technical release gates and two independent post-change audits pass.
Owner visual approval of the published V6 preview remains intentionally separate.

## Published Preview

- RC3 publish commit: `1e51dd6`.
- RC3 URL: `https://malikpeace.github.io/myth-of-sisyphus-live/v6-preview/?v=1e51dd6`.
- GitHub Pages served the expected `sisyphus6-release-candidate-3` marker.
- The hosted 1143m transition was rechecked at the exact 430 x 932 phone
  viewport with no terrain seam, overflow, loop error, browser warning, or
  browser error.
- The hosted blend remained continuous at 0.730 rock, 0.022 galaxy, and 0.248
  meadow, and the progressive two-row forest rendered around the player.
- Final live iPhone capture: `baselines/v6-live-1e51dd6-iphone-1143m.png`.

### Previous RC2

- RC2 publish commit: `0436419`.
- RC2 URL: `https://malikpeace.github.io/myth-of-sisyphus-live/v6-preview/?v=0436419`.
- GitHub Pages served the expected `sisyphus6-release-candidate-2` marker.
- The published meadow asset loaded at its exact 512 x 512 native size.
- The published game retained the exact 430 x 932 phone presentation with no
  overflow or loop errors.
- Final live iPhone capture: `baselines/v6-live-0436419-iphone.png`.
