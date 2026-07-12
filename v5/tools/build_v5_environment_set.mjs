import { createRequire } from "node:module";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const here = path.dirname(fileURLToPath(import.meta.url));
const assetDir = path.resolve(here, "../assets");
const sourceDir = path.join(assetDir, "source");

const groundSource = path.join(sourceDir, "v5-meadow-ground-imagegen-source.png");
const legacyGround = path.resolve(assetDir, "../../assets/wower-ground-pixel-crisp.png");
const treeSource = path.join(sourceDir, "v5-pine-family-alpha-source.png");
const propSource = path.join(sourceDir, "v5-ground-props-alpha-source.png");

// This is the user-approved meadow exactly as generated. Keep an explicit final
// copy so later experiments cannot silently replace it with a blended derivative.
await copyFile(groundSource, path.join(assetDir, "v5-meadow-ground-approved.png"));

// Keep the generated meadow's palette and broad forms, but borrow a restrained
// amount of the previous ground's smaller structure. This avoids both extremes:
// photographic noise and oversized mosaic blocks beside the actor.
const groundBase = await sharp(legacyGround)
  .resize(1536, 1024, { fit: "fill", kernel: "lanczos3" })
  .modulate({ brightness: 0.94, saturation: 0.72 })
  .png()
  .toBuffer();
const groundDetail = await sharp(groundSource)
  .resize(1536, 1024, { fit: "fill", kernel: "lanczos3" })
  .modulate({ brightness: 0.98, saturation: 0.76 })
  .ensureAlpha(0.20)
  .png()
  .toBuffer();
const groundCombined = await sharp(groundBase)
  .composite([{ input: groundDetail, blend: "soft-light" }])
  .png()
  .toBuffer();

await sharp(groundCombined)
  .resize(768, 512, { fit: "fill", kernel: "lanczos3" })
  .median(3)
  .resize(1536, 1024, { fit: "fill", kernel: "nearest" })
  .png({ palette: true, colours: 32, dither: 0 })
  .toFile(path.join(assetDir, "v5-meadow-ground-master-v4.png"));

const treeMeta = await sharp(treeSource).metadata();
const treeCellW = Math.floor(treeMeta.width / 3);
for (let index = 0; index < 3; index++) {
  const left = index * treeCellW;
  const width = index === 2 ? treeMeta.width - left : treeCellW;
  const cell = await sharp(treeSource)
    .extract({ left, top: 0, width, height: treeMeta.height })
    .png()
    .toBuffer();
  const trimmed = await sharp(cell)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: 280, height: 470, fit: "inside", kernel: "nearest" })
    .png()
    .toBuffer({ resolveWithObject: true });
  const x = Math.floor((290 - trimmed.info.width) / 2);
  const y = 482 - trimmed.info.height;
  await sharp({ create: { width: 290, height: 482, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: trimmed.data, left: x, top: y }])
    .png({ palette: true, colours: 32, dither: 0 })
    .toFile(path.join(assetDir, `v5-pine-tree-${index + 1}.png`));
}

const propMeta = await sharp(propSource).metadata();
const sourceCellW = Math.floor(propMeta.width / 6);
const sourceCellH = Math.floor(propMeta.height / 2);
const targetCellW = 128;
const targetCellH = 96;

// Existing gameplay expects thirteen semantic slots. Map the twelve generated
// cells into that contract and reuse two strong rock/bush forms as flipped variants.
const propMap = [
  { source: 0 },  // pink flowers
  { source: 1 },  // white flowers
  { source: 2 },  // yellow flowers
  { source: 5 },  // bare rock
  { source: 7 },  // stump
  { source: 3 },  // bush
  { source: 10 }, // skull
  { source: 8 },  // mushroom
  { source: 4 },  // large bush
  { source: 3, flip: true },
  { source: 6 },  // mossy rock
  { source: 11 }, // low rock cluster
  { source: 6, flip: true }
];

const composites = [];
for (let index = 0; index < propMap.length; index++) {
  const item = propMap[index];
  const col = item.source % 6;
  const row = Math.floor(item.source / 6);
  const left = col * sourceCellW;
  const top = row * sourceCellH;
  const width = col === 5 ? propMeta.width - left : sourceCellW;
  const height = row === 1 ? propMeta.height - top : sourceCellH;
  const cell = await sharp(propSource)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
  let sprite = sharp(cell).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (item.flip) sprite = sprite.flop();
  const rendered = await sprite
    .resize({ width: 118, height: 84, fit: "inside", kernel: "nearest" })
    .png()
    .toBuffer({ resolveWithObject: true });
  composites.push({
    input: rendered.data,
    left: index * targetCellW + Math.floor((targetCellW - rendered.info.width) / 2),
    top: targetCellH - rendered.info.height
  });
}

await sharp({
  create: {
    width: targetCellW * propMap.length,
    height: targetCellH,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
})
  .composite(composites)
  .png({ palette: true, colours: 64, dither: 0 })
  .toFile(path.join(assetDir, "v5-ground-props-atlas.png"));

console.log("Built V5 meadow ground, three pine trees, and ground-prop atlas.");
