# Endless Craft Candidate

Date: 2026-09-06
Build: `6-endless-craft-2`
Status: candidate tested locally; owner requested publication to the existing
V6 preview on 2026-09-06. Actual iPhone acceptance remains outstanding.

## Intent

Make Endless calmer to begin, progressively more demanding with height, and
more visually layered. Preserve the simple push interaction, existing content,
pixel presentation, and the oversized low foreground trees. V5 stays frozen.
This is a focused refinement, not a claim that every biome is finished.

## Player-Visible Changes

- More forgiving opening cadence, with resistance and fall stakes rising
  continuously rather than changing abruptly at a realm boundary.
- Rollback is continuous again, per follow-up feedback. The stone starts rolling
  after momentum fades and a short grace period, with an altitude-dependent
  speed cap of 8-48 metres/second. It can roll all the way down if left unattended
  in the foreground; it does not teleport or automatically reset the run.
  Craft 1's artificial 35%/140-metre fall floor has been removed.
- Smoother acceleration and deceleration. Endless no longer applies continuous
  camera vibration or stretches the stone on each tap.
- Finer stone rotation, sampled from retained art onto the logical pixel grid.
- Automatic interruption pause and a Continue Climb option. Resuming waits for
  the next push instead of silently starting a fall.
- Saved height, peak, elapsed climb time, and core journey state. Saves occur
  every four seconds and on normal pause/page-exit events. An abrupt process
  kill or storage clearing can still lose unsaved progress.
- A wider portrait mountain composition, cleaner morning sky, and three
  progressively parallaxed forest ridges using retained tree artwork.
- Subdued galaxy imagery with fine stars and layered nighttime mountain ridges.
- Four detailed forest depth bands fill the title foreground and fade out during
  the entrance camera move. The gameplay forest framing remains unchanged.
- Bridge cliff faces and the ravine cutout share a world-stable, pixel-stepped
  edge instead of overlapping incompatible shapes that exposed brown triangles.
- Best-height HUD stays consistent during a fall and avoids duplicate labels.

## Engineering Boundaries

- No V5 edits or source asset replacements.
- Endless pacing changes are mode-gated. Shared frame/lifecycle fixes are
  smoke-tested against Summit, Timed, Daily, Resolve, and Rush.
- The animation loop follows browser animation frames, subdividing long updates
  into steps no larger than 1/60 second. The hidden-page simulation interval and
  wall-clock 16 ms frame gate have been removed.
- Rotation retains only twelve recently needed native-size frames per current
  stone size. Pixels use nearest-neighbour sampling with hard alpha; this does
  not download a large new rotation atlas.
- New scenery placement is deterministic in world coordinates, not randomized
  every frame. Existing terrain, foreground scale, and collision geometry remain.
- New persistence uses `sisyphus6.journey`; existing V5 storage is not migrated.

## Verification

Run `tools/test-endless-journey.cjs` with Node's `--test` flag for profile,
rollback-speed, refresh-rate response, and invalid-save tests.

Run `tools/verify-endless-browser.cjs` with Playwright and Chrome available for:

- Moving screenshots at 0, 400, 650, 755, 1145, and 1800 metres in iPhone-sized
  portrait, landscape, and desktop viewports.
- Canvas nonblank checks, integer presentation scale, disabled smoothing,
  runtime errors, and horizontal overflow checks.
- Actual simulated touch input at low, middle, and higher elevations, followed
  by idle falls and recovery attempts.
- Interruption pause, saved-climb restoration, and V5 storage preservation.
- Other available modes, reduced motion, Night/Void themes, and rotation.

Browser evidence is written to `/tmp/sisyphus-endless-qa/`. The browser uses
isolated test storage, never the owner's actual saved game.

Craft 1 passed its four unit tests, fifteen moving scene checks, five other-mode
smoke checks, both theme/rotation checks, touch/recovery and save/continue checks.
Craft 2 expands scene coverage to eighteen views plus title foreground checks,
and requires continuing rollback after the old distance limit, followed by
recovery through normal touch input. Latest results are in the generated report.

These tests run in desktop Chrome, including phone-sized emulation. They do not
establish actual iPhone Safari frame pacing, thermal behavior, or PWA lifecycle
reliability. Those remain device acceptance checks. The owner's subsequent
publication request authorizes sharing this candidate at the V6 preview URL;
it does not make those unperformed hardware checks pass.

V5 index SHA-256 before and after this work:
`3e3c5e76f68c31ce51255b7e1cd2185fac2103bef2c3d0132ea59c39a5050a9f`
