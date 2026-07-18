# V6 Pixel Art Style Bible

## Core Look

The world is cinematic pixel art, not a photograph run through a pixel filter.
Shapes are designed on the grid, material ramps are intentional, and detail is
clustered into readable forms rather than scattered as micro-noise.

## Pixel Grammar

- Base terrain tile: 16 x 16 logical pixels.
- Common prop units: 16, 24, 32, 48, and 64 logical pixels.
- Outlines are one logical pixel where needed, never soft alpha fringes.
- Diagonals use deliberate stair-step rhythms.
- Curves use consistent stepped clusters instead of smooth vector arcs.
- World art uses opaque pixels except for intentional particles, fades, glow,
  weather, atmospheric depth, and approved near-tree blur.

## Materials

- Grass: broad dark-to-light clumps with restrained single-pixel accents.
- Soil: layered clusters and occasional stones, not uniform visual noise.
- Rock: four-to-six value ramps with large planes and sparse cracks.
- Wood: readable plank groups, end grain, lashings, and one-pixel gaps.
- Sky: large clean color fields.
- Mountains: simplified planes, consistent snow ramps, no stray warm pixels.

## Depth

- Sky, far mountains, near mountains, world props, actors, and foreground
  occluders are separate layers.
- Parallax layers remain world-stable. They may scroll at different rates but
  must never reseed or shuffle while visible.
- Foreground trees are oversized and low in frame. Their trunk is normally
  outside the bottom edge; foliage crosses in front of the actor.

## Approved Cinematic Exceptions

- The current sun may retain a soft atmospheric glow around its hard sprite.
- Foreground and distant trees may use a slight depth blur.
- Tree opacity may animate only during entrance/exit; it settles at full opacity.
- Shadows may use soft falloff, but the receiver boundary must follow terrain or
  the bridge deck and may never form a visible rectangle.
- These exceptions are compared against strict-pixel variants before locking.

## Asset Production

1. Generate or sketch source art.
2. Reduce it to intended logical size.
3. Palette-map it.
4. Clean clusters and edges by hand or deterministic tooling.
5. Remove accidental partial alpha.
6. Test at 1x logical size and integer presentation scales.
7. Approve in moving gameplay before adding it to the manifest.

Raw image-generation output is reference material only and cannot be marked
`approved` in the manifest.
