import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const here = path.dirname(fileURLToPath(import.meta.url));
const assetDir = path.resolve(here, "../assets");
const source = path.join(assetDir, "v5-meadow-source-wower.png");
const surfacePath = path.join(assetDir, "v5-meadow-surface-tile.png");
const soilPath = path.join(assetDir, "v5-meadow-soil-tile.png");

// Reduce the approved 1672x941 painting onto the game's native logical grid.
// Nearest-neighbour sampling preserves its authored palette and hard pixel edges;
// the browser then enlarges these pixels only by an integer display scale.
const width = 418;
const height = 235;
const soilHeight = 64;

const reduced = await sharp(source)
  .resize(width, height, { kernel: "nearest" })
  .png({ palette: true, colours: 96, dither: 0, effort: 10 })
  .toBuffer();

await sharp(reduced).toFile(surfacePath);

// The lower crop extends deep portrait views. The renderer alternates it
// vertically, matching the first extension row to the full surface's last row.
await sharp(reduced)
  .extract({ left: 0, top: height - soilHeight, width, height: soilHeight })
  .png({ palette: true, colours: 64, dither: 0, effort: 10 })
  .toFile(soilPath);

console.log("Built authored V5 meadow surface and soil extension tiles.");
