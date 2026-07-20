# V6 Release Audit

## Candidate

- Entry: `/v6-preview/index.html`
- Build: `sisyphus6-release-candidate-7`
- Candidate checksum: `4ba147651856f0a69f64c75f620d386c317370df154bb72b59cac377bfee9bfe`
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

## RC4 Moonlit World Revision

- Recolored the complete V6 world at night instead of tinting the sky alone.
  Grass now settles into a muted blue-green and exposed soil into deep navy,
  while flowers, roots, stones, and terrain depth remain readable.
- The night treatment is clipped to the exact terrain silhouette after the
  hard-pixel terrain pass. It cannot create a floating rectangle, soften an
  edge, or change the native pixel grid.
- Added coordinated moonlight treatment for the gorge, waterfall, later
  backdrops, and both bridge renderers so warm daytime materials do not remain
  isolated inside a blue night scene.
- Automatic night stages now retain their night strength through every realm
  blend. The moon, stars, backdrop, and terrain fade together instead of
  appearing or disappearing independently.
- Snow, storm, volcanic, aurora, Elysium, galaxy, and void terrain preserve
  their authored realm identity with a reduced adaptive night grade.
- Explicit Night style and automatic night progression share the same palette
  logic. The daytime Classic style remains completely ungraded.

## RC4 Night Audit - Passed

- Inspected fresh exact 430 x 932 phone captures at the opening, 650m bridge,
  900m automatic night stage, and 1143m progressive forest.
- Rechecked the 4175m snow/storm transition and the 8200m volcanic/aurora
  transition; terrain detail stayed visible without reverting to warm brown.
- The daytime control reported `0.000` terrain and backdrop night strength,
  no document overflow, and about 1.1ms average game work per frame.
- The RC4 runtime marker, asset verification, promoted-runtime equality, and
  source whitespace checks pass with no loop error.
- Phone captures are stored as `baselines/v6-night-rc4-*-phone.png`.

## RC5 Mountain, Crest, Actor Rim, And Moon Revision

- Replaced the V6 mountain candidate with a new mountain-only image-generation
  source inspired by the approved render: four restrained blue depth layers,
  two clear hero peaks, broad readable silhouettes, and no baked sky or clouds.
- Converted the generated source through `tools/build-mountain-plate-v2.py` to a
  240 x 150 logical pixel master, a maximum 18-color palette, hard alpha, and an
  exact 2x enlargement. The shipped 480 x 300 plate contains 17 colors and zero
  partial-alpha pixels.
- Kept the sky, drifting clouds, and mountain plate as separate render layers.
  Clouds can therefore travel behind the mountains instead of being painted
  into the image, and portrait framing centers the hero peak without cropping.
- Added deterministic world-locked grass blades along the exact terrain crest.
  The blades follow the hillside, skip bridge gaps, use night-aware colors, and
  remain fixed to the world with no blur, alpha animation, or subpixel drift.
- Added a directional one-pixel rim to Sisyphus using the live sun or moon
  direction and color. The black body is re-stamped over the rim so the effect
  cannot turn him gray or create a broad outline.
- Reworked the moon wrap into coordinated visibility windows. At the tested
  path it faded from 0.795 to 0.008 before the edge crossing, wrapped while at
  0.007 visibility, then returned through 0.210, 0.641, and 0.955.

## RC5 Audit - Passed

- Inspected fresh exact 430 x 932 phone captures during the moon approach,
  disappearance, opposite-edge return, and full reappearance. No positional
  jump remains visible and actor lighting fades with the moon.
- Inspected fresh day and night phone captures plus a 1440 x 900 desktop view.
  Mountains, terrain crest, clouds, Sisyphus, and foreground trees remain sharp
  and correctly ordered at both aspect ratios.
- Twenty-four rapid mobile pushes advanced a fresh Endless run from 0000m to
  0099m. The page had zero horizontal overflow, no loop error, and averaged
  1.18ms of game work per frame with a 2.7ms recorded maximum.
- Asset verification confirms the new mountain dimensions, controlled palette,
  and hard alpha. The promoted runtime pair is byte-identical with checksum
  `79e051ef6e5f31523e5e308ecd556c95632f2ba343b81e479add8d72b16f965c`.

## RC6 Shadow Depth Revision

- Rebuilt the cast presentation as three coordinated layers: a wide low-density
  penumbra, a readable central umbra, and a dense near-contact core. The stone
  gains volume without becoming a single flat black oval.
- Added an independent figure projection using the same light ray, so Sisyphus
  and the boulder both cast shadows and remain visually connected.
- Broadened the contact occlusion under the stone, feet, and torso. It remains
  present as a restrained ambient weight when no direct sun or moon is visible.
- Derives direction continuously from the visible sun or moon and smooths both
  direction and strength over time. The overhead crossing rotates through the
  center instead of jumping from one side to the other.
- Uses green-black daylight shadow ink and cool navy-black moonlight ink while
  preserving the authored terrain texture beneath the translucent shading.
- Retains the terrain and bridge receiver mask, so shadows can continue over the
  bridge deck but cannot float through the gorge or extend above the ground.

## RC6 Shadow Audit - Passed

- Inspected exact phone captures at 99m, 154m, 419m, 650m bridge, 780m night,
  900m night, 1143m forest, and all thirteen later realm anchors.
- Inspected exact desktop captures at the opening, broad daylight cast, bridge,
  and night. The shadow remained attached and readable without a hard box edge.
- Sampled the overhead-light transition at 250m, 280m, and 310m. The reported
  angle changed continuously from 1.309 to 1.722 to 2.054 radians.
- Fifty rapid mobile push inputs registered with no loop error or overflow. The
  settled phone renderer averaged 0.99ms of game work per frame with a 2.3ms
  recorded maximum after the shadow revision.
- V5 remains byte-unchanged with checksum
  `3e3c5e76f68c31ce51255b7e1cd2185fac2103bef2c3d0132ea59c39a5050a9f`.

## RC7 Rocky Pass Revision

- Replaced the pale oversized pathway pile with six low-profile dark-slate rock
  variants that share the rocky ground palette and render behind the actor.
- Replaced forest rows inside the barren chapter with five world-locked distant
  crags. The final pines fade out by 1.14km while the earlier waterfall and
  bridge forest remain unchanged.
- Added four monumental camera-near formations after the actor layer so
  Sisyphus and the boulder pass behind them for occasional scale moments.
- Removed the old procedural rock-band props, eliminating duplicate and ghosted
  stones beneath the authored set.
- All three atlases use fixed cells, limited palettes, nearest-neighbor sampling,
  hard alpha, and zero partially transparent pixels.

## RC7 Rocky Pass Audit - Passed

- Inspected exact 430 x 932 phone views from 1.05km through 1.45km and a
  1440 x 900 desktop view at 1.325km.
- Confirmed progressive rock entry, no rocky-biome trees, grounded path stones,
  temporary foreground occlusion, and no browser warnings or errors.
- Rechecked the 700m bridge and waterfall after the forest cutoff change; the
  original forest framing and bridge scene remain intact.
- Captures are stored as `baselines/v6-rocky-v2-*.png`.

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

The RC6 technical release gates and the shadow depth, receiver, direction,
terrain-crest, actor-lighting, and moon-transition audits pass.
Owner visual approval of the published V6 preview remains intentionally separate.

## Published Preview

- RC6 publish commit: `0bc041e`.
- RC6 URL: `https://malikpeace.github.io/myth-of-sisyphus-live/v6-preview/?v=0bc041e`.
- GitHub Pages served the expected `sisyphus6-release-candidate-6` marker.
- The hosted HTML is byte-identical to the audited promoted runtime with checksum
  `3c7d231a34ae06a825035068aa9a7475f49c9f7667c1cbccc86bc9e9b28018c2`.
- Local exact-phone, desktop, bridge, night, overhead-transition, and later-realm
  visual evidence is stored under `baselines/v6-shadow-*.png`.

### Previous RC5

- RC5 publish commit: `03421ff`.
- RC5 URL: `https://malikpeace.github.io/myth-of-sisyphus-live/v6-preview/?v=03421ff`.
- GitHub Pages served the expected `sisyphus6-release-candidate-5` marker.
- The hosted exact 430 x 932 day and Night views retained the new mountain plate,
  world-locked crest grass, restrained actor rim, and smooth moon wrap with no
  loop error or document overflow.
- Hosted game work averaged 1.09ms in the day check and 1.63ms in the settled
  Night check.
- Final live iPhone captures: `baselines/v6-live-03421ff-day-iphone.png`,
  `baselines/v6-live-03421ff-moon-wrap-iphone.png`, and
  `baselines/v6-live-03421ff-night-iphone.png`.

### Previous RC4

- RC4 publish commit: `e514e50`.
- RC4 URL: `https://malikpeace.github.io/myth-of-sisyphus-live/v6-preview/?v=e514e50`.
- GitHub Pages served the expected `sisyphus6-release-candidate-4` marker.
- The hosted exact 430 x 932 Night opening reported full terrain moonlight,
  coordinated backdrop moonlight, no loop error, and no document overflow.
- Hosted game work averaged about 0.98ms per frame in the settled phone view.
- Final live iPhone capture: `baselines/v6-live-e514e50-night-iphone.png`.

### Previous RC3

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
