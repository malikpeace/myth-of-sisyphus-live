import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(toolDir, "../..");
const source = path.join(projectDir, "assets/mountain-bg-noclouds.png");
const output = path.join(projectDir, "v5/assets/mountain-bg-pixel-master-v5.png");

const reduced = await sharp(source)
  .resize(384, 256, {
    fit: "fill",
    kernel: sharp.kernel.nearest,
  })
  .median(3)
  .png({
    palette: true,
    colours: 28,
    dither: 0,
    effort: 10,
  })
  .toBuffer();

const { data, info } = await sharp(reduced)
  .raw()
  .toBuffer({ resolveWithObject: true });

const skySource = [
  [58, 148, 236],
  [75, 164, 244],
  [91, 178, 247],
  [109, 191, 250],
  [126, 202, 251],
  [144, 212, 251],
];
const skyBands = Array.from({ length: 22 }, (_, index) => {
  const t = index / 21;
  return [
    Math.round(58 + (144 - 58) * t),
    Math.round(148 + (212 - 148) * t),
    Math.round(236 + (251 - 236) * t),
  ];
});

for (let y = 0; y < info.height; y += 1) {
  const band = skyBands[Math.min(skyBands.length - 1, Math.floor(y / 6))];
  for (let x = 0; x < info.width; x += 1) {
    const i = (y * info.width + x) * info.channels;
    let isSky = false;
    for (const color of skySource) {
      const distance = Math.abs(data[i] - color[0])
        + Math.abs(data[i + 1] - color[1])
        + Math.abs(data[i + 2] - color[2]);
      if (distance <= 3) {
        isSky = true;
        break;
      }
    }
    if (!isSky) continue;
    data[i] = band[0];
    data[i + 1] = band[1];
    data[i + 2] = band[2];
  }
}

await sharp(data, {
  raw: {
    width: info.width,
    height: info.height,
    channels: info.channels,
  },
})
  .png({ palette: false, compressionLevel: 9 })
  .toFile(output);

console.log(output);
