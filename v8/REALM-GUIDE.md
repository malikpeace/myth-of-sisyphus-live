# Writing a V8 realm

A realm is ONE file, `v8/realms/<id>.js`, that builds its whole world in code on the shared indexed framebuffer
and registers itself with `V8.register("<id>", R)`. **`realms/hills.js` is the reference** — read it, `core.js`,
`scenery.js`, `px.js` first. Nothing is loaded from images: every pixel is generated.

## Rules of the look (owner decisions — do not deviate)
- One pixel grid. Integer positions only. No alpha blending, no anti-aliasing, no blur, no smooth gradients, no
  resampling. Everything is a palette index; softness comes ONLY from ordered dither (`PX.BAYER4`) between two
  palette entries; depth/haze = dither toward a mist colour.
- "Dusk's graphic language": bold banded dithered skies, clean layered shapes, hard 1-px lines, rim/edge light on the
  sun-facing side, limited palettes (a scene should use roughly 60-110 colours, ramps of 3-7 tones dark->light).
- Each realm keeps its OWN colours and lit ground (not silhouette-everything). Far layers may be silhouettes (depth).
- Light comes from `R.light(S)`; shade consistently (lit side toward it, rim on the edge, dark side away).
- Make it beautiful and readable: the hero + stone sit at the anchor (S.anchorX, S.lip near it) — keep the area
  around them calm (no busy high-contrast pattern within ~50 px of the anchor).
- Compose for THREE screen shapes: desktop 480x300, phone portrait 215x466, phone landscape 466x220 (w x h in game
  pixels). Never hard-code 480x300; scale things from S.w / S.h / S.zoom.
- Camera zoom is continuous (S.zoom ~0.74 at the start down to ~0.36 on a long climb) and the terrain tilts up to
  ~20 degrees; everything world-locked must look right through that range. Screen-space layers scroll with
  `S.altitude` at slow parallax rates (see hills.js).
- Performance budget: the whole frame (backdrop+ground+front) must stay under ~4 ms on desktop headless (test page prints
  ms/frame). Pre-render tileable strips/sprites in `init` and scroll them by integer offsets; keep per-frame per-pixel
  work to cheap table lookups; use typed arrays.

## Module contract
```js
(function (root) {
  var PX = root.PX, Sc = root.Sc, V8 = root.V8;
  var R = { rock: { mat: "granite", style: "granite" } }, I = {};       // I = palette base indices
  R.init = function (pal, S) {          // allocate ramps + build caches. Called on realm start and on every resize.
    I.sky = pal.ramp("sky", [ [r,g,b], ... ]);   // dark -> light, returns the first palette index. <= 199 total for the scene.
  };
  R.palette = function (pal, S) {};     // OPTIONAL per-frame palette animation: pal.setRamp(name, colours) / pal.set(idx, rgb)
  R.backdrop = function (fb, S, pal) {};// sky + far scenery, screen space, must cover the WHOLE framebuffer
  R.ground = function (fb, S, pal) {};  // terrain below S.lip[x] + world-locked props (drawn behind the actor)
  R.front = function (fb, S, pal, actorResult) {};  // foreground occluders + weather (after the actor)
  R.light = function (S) { return { x, y, k, col: [r,g,b], ambient: [r,g,b], bright: 0..1, ground: [r,g,b] }; };
  //  x,y = sun/moon position in SCREEN pixels; k = strength 0..1 (0 = no direct light); ambient = sky tone; ground = ground tone
  R.markerIdx = { c0,c1,c2, p0,p1, f0,f1, g0,g1 };   // OPTIONAL palette indices for cairns / best-height flag
  V8.register("myrealm", R);
})(window);
```
Palette layout: 0 = ink/black. Scene ramps use indices 1..199. **200..243 belong to the hero/stone, 244..252 to the
markers — never allocate there.** `pal.ramp()` is the only allocator. Shade tables (`V8.shade1/shade2`) are derived from
the named ramps automatically (one/two steps darker along each ramp) and are what shadows use.

## The frame state `S` (built every frame by index.html, see `v8DrawRealm`)
`w,h` framebuffer size | `zoom` | `ztx,zty` camera translation: screen = (ztx + x*zoom, zty + y*zoom) for world-local x,y |
`altitude` (m) | `scroll` = altitude*7.2 (world units) | `tSec` | `reduced` (prefers-reduced-motion: no animation) |
`anchorX,anchorY` (hero position in world-local coords) | `horizonY` (screen y of the horizon, before the opening shift) |
`lip` Int16Array[w]: screen y of the terrain surface at each screen column (ground is BELOW it, rows y >= lip[x]) |
`slope` (tangent of the terrain angle at the hero; ~0.03 flat .. ~0.5 steep) | `openingT` 0..1 (title camera drop -> play;
shift backdrop layers by `(1-openingT)*S.h*0.12` like hills.js) | `realmId` | `windGust` 0..1 | `gameState` |
`pull` 0..1 (pull-back zoom) | `cairns`, `bestM`, `oldBestPassed` (used by core markers).
World-locked things: world x of a screen column = (x - ztx)/zoom + scroll  (that is how the meadow/flowers/pines are placed).

## Shared overlays (v8/overlays.js) - the engine draws these for every realm; tune them with optional realm fields
Drawn by core.js around your layers: bird flocks + the "passed your old best" bird/afterglow (after `backdrop`), mythic events
(eagle / wind streaks in the sky; the hooded WATCHER on the ground after markers; thunder flash as a final full-frame lift),
footprints (right after `ground`), the 1000 m quote sign and the Daily target sign (after markers, before the actor).
Optional fields on your realm object (set them in `R.init`, they are palette INDICES from your own ramps):
- `R.birdIdx`   colour of birds / eagle silhouettes against YOUR sky (default 0 = the darkest slot). Night skies: pick a pale index or set `R.noBirds = true`.
- `R.watcherIdx` colour of the watcher silhouette (default 0). On dark grounds pick something that still reads.
- `R.footprint = { col: idx, hi: idx }` footprint colour + its 1-px lit rim (default: the pixel under it darkened two ramp steps / lightened one).
- `R.markerIdx` overrides the cairn/flag/pole/sign palette slots (see MARK in core.js) if your world needs different stones.
- `R.noShadow` skips the hero/stone ground shadow (Dusk).
Signs use fixed marker slots 247/248 (post) + 253/254 (paper/ink) so they are readable everywhere; do not overwrite 244..254 in your palette.
Do NOT draw your own bird flocks / eagle / footprints any more (they would double up). Ambient realm life (petals, embers, snow, fireflies, fish) is yours.
`V8.thumbnail(id, w, h)` renders your realm into the menu card (it builds a synthetic S: `gameState:"title"`, `reduced:true`, `adj:1`,
flat-ish terrain, no hero) - make sure `init/backdrop/ground/front` survive that S and any w x h (cards are ~80 x 38 game px after a whole-number reduction of a ~4-6x frame).
Chunky mode (Settings > pixels): `S.adj` = 1 normally, ~0.67 in Chunky. Multiply fixed pixel sizes that should keep their on-screen size by it
(sun radius, cloud/sprite sizes, particle sizes, lamp glows). Texture grain (dither, facets, blades) should stay in whole native pixels so Chunky really looks chunkier.

## Testing (all headless, no dependencies)
A static server must be running on port 8811 serving the repo root:
`perl -e 'alarm shift; exec @ARGV' 21600 python3 v8/tools/serve.py /Users/malikpeace/myth-of-sisyphus-live 8811 &`
(check with `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8811/v8/index.html`).

1. Fast loop, your realm alone with synthetic terrain (hero + stone included):
   `python3 v8/tools/realmshot.py NAME "realm=<id>&alt=0&zoom=0.74&slope=0.03" [w h port]` -> saves `v8/tools/out/NAME.png`
   (native pixels; scale it up with PIL nearest-neighbour to look at it). Useful params: `alt` (m), `zoom`, `slope`, `w`,`h`, `t` (seconds),
   `open` (1 play .. 0 title), `look=color`. Try: alt=0/zoom .74/slope .03; alt=350/.6/.22; alt=1100/.44/.38; and the phone size w=215&h=466.
2. In the real game: `http://127.0.0.1:8811/v8/?qa=1&qaRealmArt=1&qaRealm=<id>` then click `#enterstart`, then the button "start ...".
   See `v8/tools/start8.py` (START steps, waits on `assetsReady`) and `v8/tools/cdp.py` (`run(url,w,h,steps)`; step `("canvas",path)` saves the game's native pixels,
   `("shot",path)` a full screenshot; errors are collected in `window.__errs`). Drive the climb with `window.__sisyphusQa.drive(seconds, hz)` and jump with `.setAltitude(m)`.
Use a distinct CDP port range per worker (pass `port=`), and always check `window.__errs` is empty.
Never leave servers or browsers running when you finish (cdp.run cleans up its own Chrome).

## Done means
Looks great at all 3 sizes and along the climb (0 / 350 / 1100 / 3000 m), no console errors, under budget, no stale pixels
(the backdrop covers the whole frame), hero + stone read clearly against it, and it is unmistakably THIS realm.
