# Six-Realm Refinement

## Intent

Preserve V5. Refine V6 around six requested scenes: alpine meadow, waterfall
forest, moonlit Roman ruins, snow, sunset Rome, and cherry-blossom sunset.
Keep the game crisp, smooth, simple, and increasingly intense with height.
The stone must accelerate downhill when pushing stops, without an instant reset.

## Owner Decision Resolved

Owner confirmed each realm must be selectable from 0m for now. Natural realm
transitions throughout the journey are a future option, NOT part of this release.
Use independent realm bests and saved climbs; preserve existing legacy Endless
records and journey. Realm selection starts a fresh 0m climb; an explicit Continue
action may resume its own saved climb. Do not equate scenery position with score.
realm-catalog.js defines six stable ids and isolated keys. Unit tests cover zero
starts, distinct records, cross-realm save rejection and invalid selections.

## Implemented Locally, Not Published

- Owner explicitly authorized publishing the candidate to the live V6 preview
  on 2026-09-07 so they can review on their phone. This supersedes the earlier
  pre-publication review hold for this candidate, but is not final artwork
  approval. Keep asset status candidate while gathering that feedback.
- Final normal-menu report confirms all six legacy modes remain playable through
  their actual menu controls. Legacy Endless resumed at 813m; other modes made
  progress with touch input. No runtime errors; V5 sentinel remained unchanged.
- Release candidate now identifies itself as `6-six-realms-1`. Normal (non-QA)
  URLs show the six-realm menu; no preview flag is required. Journey/scenery
  module version markers bumped so existing phones fetch changed code.
- Final scene review found and fixed floating cherry roots: background cherry
  rows are drawn after camera placement, anchored to the actual terrain lip.
  Sunset Rome now has an offline-cleaned 320x480 portrait companion with 16
  opaque colors, preserving the visible sun and reflection on a phone.
- Changed sunset/cherry scenes passed six moving view combinations. Native-asset
  checks passed with the new sunset image. Expanded routing passed 24 zero-metre
  views (including 1920x1080) plus six 3000m views, all error-free. New high-climb
  screenshots confirm the Hills forest persists and cherry roots stay planted.
- Review page is `review/review-board.html`; it uses the shared review renderer
  and six real gameplay screenshots. Each opens the corresponding local realm.
  All six images were verified loaded. Preview opening returned queued.
- Explicit visual approval was requested once via async input in this goal turn.
  No answer has arrived. Do not publish or mark generated art approved until it
  does. This is the first turn awaiting this approval; not yet a blocked-goal
  threshold. Continue useful release verification meanwhile.
- Remote main verified still at 377e922; live worktree unchanged. Release builder
  inventories 36 V6 files (~15.9MB), with metadata/checksums, excluding unrelated
  live edits and unused old V3 rock assets. See SIX-REALMS-RELEASE-CHECKLIST.md.

- Cliff opening now includes both actor and stone on a grassy cliff. The old
  title-only actor suppression is removed only for the realm preview. The cliff
  cutout and open bridge arches reuse the actual rendered background snapshot,
  including celestial bodies and atmospheric layers; no second mismatched sky.
- Menu emphasizes six realm choices, with older modes in a native expandable
  section. Selected action names the realm and explicitly says 0m; Continue is
  separate. Shared links carry a validated realm id and start that realm at 0m.
  Completed run history and past-self ghosts retain realm identity. Legacy
  Endless ghosts cannot leak into a selected realm. Selecting another realm
  clears an unrelated shared challenge. Twenty-four realm storage keys tested.
- Roman paths now have varied, restrained masonry, open semicircular arches,
  fluted shafts, stepped bases/capitals, and grouped broken lintels. Waterfall
  animation follows piecewise channel paths traced against the native plates,
  rather than vertical highlights that could cross bare rock.
- Cherry valley has native portrait and wide companions, reframed so mountains
  sit above the path on a phone. Native muted meadow palette, background tree
  rows, low near-canopy occluders and drifting petals retained. Candidate art
  remains separate from the approved manifest pending final visual review.
- Latest full legacy regression passed: 18 gameplay views, five other modes,
  title/resize/reduced-motion checks, pause and saved progress. Rollback/recovery:
  126 -> 0 -> 40; 785 -> 0 -> 41; 2438 -> 1327 -> 1339. No runtime errors.
- Realm routing passed 18 zero-metre views and six 3000m views; focused follow-up
  passed same-realm fresh start, explicit Continue, restart, shared-link round
  trip, completed history identity, ghost isolation and V5/legacy sentinels.
- Native-asset and selected-waterfall motion tests passed. Open arch alpha=0,
  solid deck/pier alpha=255; wind moves 7364 canopy pixels and zero root pixels.
  Desktop Chrome draw/update averages 1.43-2.32ms at tested viewports, NOT a claim
  of actual iPhone Safari frame pacing.
- verify-realm-motion.cjs passed all 18 realm/view combinations, with real touch
  climbing, frame-by-frame release traces, fast rollback, catch/recovery and
  integer canvas scaling checks. Phone-sized contexts use DPR 3. The original
  4.2-second observation stopped during the transition from push momentum/grace
  to rapid descent; trace inspection confirmed this. Observation extended to
  6.5 seconds and speed assertion strengthened to exceed 80m/s. Physics unchanged.
  Highest mean draw/update cost in that run was 3.87ms, max sampled frame 6.5ms
  on desktop Chrome. No runtime errors; actual iPhone Safari remains unmeasured.
- Follow-up visual inspection exposed invisible legacy bridge zones culling the
  selected Hills forest and legacy altitude fade removing it above 1140m. Selected
  realm tree culling and shadows now use their actual surface identity. Hills
  retain progressive forest density; Falls use their authored background forest
  plus screen-near canopies, never trees planted on the walking bridge. Selected
  Hills have overlapping canopy rows instead of large flat forest-color bands.
  Targeted Hills/Falls motion recheck passed all six view combinations after
  these refinements, with recovery and no runtime errors. Full-runtime mirror
  matches index.html; eight unit tests still pass. All browser test processes
  have exited. No live repository files were changed during this pass.

- Six-realm selector now integrated behind realmsPreview=1 (normal saves) or
  qaRealmArt=1 with qa=1 (nonpersisting QA). Each choice begins at 0m; explicit
  Continue resumes only that realm. Legacy Endless button clears realm selection
  and retains its original keys. Separate best/milestone/journey keys in use.
- realm-scenes.js supplies fixed realm lighting, selected vista, cherry depth
  rows/petals, and progressive snow flurries. Selected realms suppress legacy
  altitude-triggered background and material changes. Old modes remain separate.
- Selected waterfall/Roman paths have open-arch stonework with deck-only shadow
  receivers. Snow has a native stepped snow crust. Blossom has its own generated
  sunset-valley plate and offline muted meadow/soil palette, not a runtime tint.
- verify-realm-routing.cjs passed 18 zero-metre views plus six portrait 3000m views,
  all six menu choices, a snow save/resume, a fresh Rome start, and legacy Endless
  and V5 storage preservation. No page/runtime errors. Latest snow/bridge/cherry
  refinements still require another screenshot pass.

- Endless rollback cap now ramps from 14m/s to an altitude-dependent 110-320m/s
  over three seconds of sliding. Existing grace, pause protection, and recovery
  controls remain. Catch response increased to stop a fast slide promptly.
- Unit tests cover acceleration and catch response. Browser tests inspect each
  descent frame, including normal bottom arrival rather than assuming a low run
  must still be above zero eight seconds after release.
- Regression pass: eighteen gameplay views, three title views, five other modes,
  noir/void, resize, reduced motion, touch recovery, pause, saved climb, V5 storage.
  No runtime errors. Observed release/recovery traces: 126 -> 0 -> 40;
  785 -> 0 -> 41; 2438 -> 1379 -> 1386. Desktop Chrome timings are not iPhone FPS.
- Four retained generated sources: wide waterfall gorge, portrait waterfall gorge,
  moonlit Roman valley, transparent cherry tree.
- Offline native cleanup via build-realm-assets.cjs and realm-palettes.json.
  Waterfalls use 33 opaque colors, Rome 18, cherry 13 plus binary transparency.
  Sources are never runtime assets. Candidate metadata remains separate from the
  approved manifest pending moving-gameplay approval.
- realm-architecture.js: pixel masonry with actual open arches, columns,
  row-shift cherry wind animation with stationary roots, drifting petals,
  waterfall plate and restrained flow accents.
- Standard gameplay still uses the retained legacy artwork unless realmsPreview=1
  or a validated realm link enables the new selected-realm path.

## Visual QA

verify-realm-art.cjs checks native palettes/alpha, captures real moving waterfall
gameplay at phone portrait/landscape and desktop, checks open arches, and verifies
that tree roots remain stationary while the crown moves. Outputs are under
/tmp/sisyphus-realm-art-qa. Initial wide-art phone crop was rejected because it
lost the waterfalls. A purpose-composed portrait companion replaces that crop.
Initial regular stone bricks were also rejected as too uniform; texture/chipping
and cooler stone ramps added. Further composition refinement remains necessary.

## Remaining Work

- Review new bridge/ruin silhouettes during long movement and varied slopes;
  ensure no old floating props or shadows survive outside masonry receivers.
- Further refine Roman foreground depth and cherry composition against renders.
- Refine existing alpine, snow, sunset art and terrain compositing.
- Cliff opening is implemented and screenshot-checked in portrait/landscape and
  desktop; review it alongside the final realm presentation before release.
- Implement the confirmed menu choice: six fresh 0m realm climbs, independent
  records/Continue, no automatic realm transitions in this release. Functional
  first implementation done behind preview flag; polish menu and inspect resume,
  restart, best counters, share links, and legacy-mode regressions before enabling.
- Test transitions, long slides, all modes, save migration, all six realms at
  target viewports. Obtain visual approval, then mirror only owned files and
  deploy V6. Do not stage unrelated dirty files in the live repository.

V5 index SHA256 remains
3e3c5e76f68c31ce51255b7e1cd2185fac2103bef2c3d0132ea59c39a5050a9f.
Published V6 is still commit 377e922, build 6-endless-craft-2.
