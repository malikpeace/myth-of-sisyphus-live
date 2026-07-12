import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const here = path.dirname(fileURLToPath(import.meta.url));
const assetDir = path.resolve(here, "../assets");

const WIDTH = 768;
const SURFACE_H = 96;
const SOIL_H = 128;

function hash2(x, y, seed = 0) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function makeBuffer(width, height, color) {
  const out = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i += 1) {
    out[i * 3] = color[0];
    out[i * 3 + 1] = color[1];
    out[i * 3 + 2] = color[2];
  }
  return out;
}

function put(buffer, width, height, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const i = (y * width + x) * 3;
  buffer[i] = color[0];
  buffer[i + 1] = color[1];
  buffer[i + 2] = color[2];
}

function rect(buffer, width, height, x, y, w, h, color) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) put(buffer, width, height, px, py, color);
  }
}

const grass = {
  shadow: [24, 58, 24],
  deep: [32, 76, 25],
  dark: [43, 94, 27],
  mid: [62, 116, 30],
  light: [88, 139, 37],
  bright: [124, 158, 45],
};
const soil = {
  darkest: [31, 23, 24],
  deep: [43, 29, 27],
  dark: [57, 36, 29],
  mid: [72, 45, 32],
  light: [91, 58, 38],
  glint: [116, 79, 50],
};
const stone = {
  dark: [62, 58, 58],
  mid: [91, 84, 78],
  light: [127, 116, 103],
};

function soilPixel(x, y, seed) {
  const cellX = Math.floor(x / 2);
  const cellY = Math.floor(y / 2);
  const n = hash2(cellX, cellY, seed);
  const band = hash2(Math.floor(x / 13), Math.floor(y / 7), seed + 19);
  if (n < 0.13) return soil.darkest;
  if (n < 0.40) return soil.deep;
  if (n < 0.70) return soil.dark;
  if (n < 0.90) return soil.mid;
  return band > 0.72 ? soil.glint : soil.light;
}

const surface = makeBuffer(WIDTH, SURFACE_H, grass.dark);
for (let y = 0; y < SURFACE_H; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    if (y >= 56) {
      put(surface, WIDTH, SURFACE_H, x, y, soilPixel(x, y, 41));
      continue;
    }
    if (y >= 43) {
      const rootNoise = hash2(Math.floor(x / 2), Math.floor(y / 2), 23);
      const palette = [grass.shadow, grass.deep, soil.darkest, soil.deep];
      put(surface, WIDTH, SURFACE_H, x, y, palette[Math.min(3, Math.floor(rootNoise * 4))]);
      continue;
    }
    const n = hash2(Math.floor(x / 2), Math.floor(y / 2), 7);
    const depth = y / 42;
    let color;
    if (n < 0.10) color = grass.shadow;
    else if (n < 0.28) color = grass.deep;
    else if (n < 0.55) color = grass.dark;
    else if (n < 0.80) color = grass.mid;
    else if (n < 0.94) color = grass.light;
    else color = grass.bright;
    if (depth > 0.72 && color === grass.bright) color = grass.mid;
    put(surface, WIDTH, SURFACE_H, x, y, color);
  }
}

// One-logical-pixel blades and leaf clusters. These remain crisp after the whole
// game canvas is enlarged by its integer display scale.
for (let x = 3; x < WIDTH - 3; x += 4 + Math.floor(hash2(x, 2, 71) * 5)) {
  const baseY = 43 + Math.floor(hash2(x, 4, 72) * 4);
  const bladeH = 4 + Math.floor(hash2(x, 7, 73) * 11);
  const lean = hash2(x, 8, 74) > 0.5 ? 1 : -1;
  const color = hash2(x, 9, 75) > 0.45 ? grass.light : grass.mid;
  for (let step = 0; step < bladeH; step += 1) {
    put(surface, WIDTH, SURFACE_H, x + Math.round((step / bladeH) * lean * 2), baseY - step, color);
  }
  if (hash2(x, 11, 76) > 0.56) {
    rect(surface, WIDTH, SURFACE_H, x - 2, baseY - 5, 2, 1, grass.bright);
    rect(surface, WIDTH, SURFACE_H, x + 1, baseY - 8, 2, 1, grass.light);
  }
}

// Sparse tiny flowers, authored at 1-3 logical pixels rather than baked 20px blocks.
const flowerColors = [[236, 230, 205], [216, 126, 151], [238, 190, 72]];
for (let x = 29; x < WIDTH - 20; x += 67 + Math.floor(hash2(x, 15, 82) * 47)) {
  const y = 18 + Math.floor(hash2(x, 17, 83) * 17);
  const col = flowerColors[Math.floor(hash2(x, 19, 84) * flowerColors.length)];
  put(surface, WIDTH, SURFACE_H, x, y, col);
  put(surface, WIDTH, SURFACE_H, x - 1, y + 1, col);
  put(surface, WIDTH, SURFACE_H, x + 1, y + 1, col);
  put(surface, WIDTH, SURFACE_H, x, y + 2, [52, 105, 31]);
  put(surface, WIDTH, SURFACE_H, x, y + 3, [52, 105, 31]);
}

const soilTile = makeBuffer(WIDTH, SOIL_H, soil.deep);
for (let y = 0; y < SOIL_H; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) put(soilTile, WIDTH, SOIL_H, x, y, soilPixel(x, y, 101));
}

// Thin strata and small embedded stones add structure without becoming noise.
for (let y = 17; y < SOIL_H; y += 23 + Math.floor(hash2(y, 3, 112) * 17)) {
  for (let x = 0; x < WIDTH; x += 1) {
    if (hash2(Math.floor(x / 3), y, 113) > 0.36) put(soilTile, WIDTH, SOIL_H, x, y, soil.mid);
  }
}
for (let y = 14; y < SOIL_H - 9; y += 28) {
  for (let x = 24 + Math.floor(hash2(y, 1, 120) * 29); x < WIDTH - 20; x += 61 + Math.floor(hash2(x, y, 121) * 71)) {
    if (hash2(x, y, 122) < 0.56) continue;
    const w = 4 + Math.floor(hash2(x, y, 123) * 5);
    const h = 2 + Math.floor(hash2(x, y, 124) * 3);
    rect(soilTile, WIDTH, SOIL_H, x, y, w, h, stone.mid);
    rect(soilTile, WIDTH, SOIL_H, x + 1, y, Math.max(1, w - 2), 1, stone.light);
    put(soilTile, WIDTH, SOIL_H, x, y + h - 1, stone.dark);
    put(soilTile, WIDTH, SOIL_H, x + w - 1, y + h - 1, stone.dark);
  }
}

await sharp(surface, { raw: { width: WIDTH, height: SURFACE_H, channels: 3 } })
  .png({ palette: true, colours: 32, dither: 0, effort: 10 })
  .toFile(path.join(assetDir, "v5-meadow-surface-tile.png"));

await sharp(soilTile, { raw: { width: WIDTH, height: SOIL_H, channels: 3 } })
  .png({ palette: true, colours: 24, dither: 0, effort: 10 })
  .toFile(path.join(assetDir, "v5-meadow-soil-tile.png"));

console.log("Built V5 native meadow surface and soil tiles.");
