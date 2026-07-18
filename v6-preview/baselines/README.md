# V5 and V6 Visual Baselines

These files make the overhaul measurable instead of subjective-only.

## V5 Capture

- Source commit: `180bc07fc224910ac26563026bccccb0d7197407`
- Source checksum: `3e3c5e76f68c31ce51255b7e1cd2185fac2103bef2c3d0132ea59c39a5050a9f`
- Input sequence: enter, start Endless, then 22 alternating left/right pushes
  approximately 85 milliseconds apart.
- Captures exist for desktop, iPhone 14 Pro Max portrait, and iPhone 14 Pro Max
  landscape layout sizes.

## What the Baseline Shows

- V5 uses a 480 x 300 logical canvas at 1440 x 900.
- V5 phone portrait uses a 215 x 466 logical canvas enlarged 2x.
- V5 phone landscape asks for a 466 x 220 canvas displayed at 932 x 440 inside
  a 932 x 430 viewport, creating a vertical crop.
- The V5 meadow source has oversized mixed-size blocks. The canvas is sharp, but
  the art itself does not follow one coherent native pixel grid.

## V6 POC Contract

- Desktop reference: 480 x 300 logical at 3x.
- iPhone portrait reference: 430 x 932 logical at 1x CSS and 3x physical DPR on
  the real device.
- iPhone landscape reference: 466 x 215 logical at 2x CSS.
- Terrain uses 16 x 16 native tiles, axis-aligned fill, and a per-logical-pixel
  terrain edge.
- The QA query string is `?qa=1`; production view omits the renderer lab.
