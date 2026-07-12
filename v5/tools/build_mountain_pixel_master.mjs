import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(toolDir, "../..");
const source = path.join(projectDir, "assets/mountain-bg-noclouds.png");
const output = path.join(projectDir, "v5/assets/mountain-bg-pixel-master-v5.png");
const skyOutput = path.join(projectDir, "v5/assets/mountain-bg-sky-v5.png");
const mountainsOutput = path.join(projectDir, "v5/assets/mountain-bg-mountains-v5.png");
const redrawSource = path.join(projectDir, "v5/assets/source/v5-mountain-redraw-alpha-source.png");
const redrawSkyOutput = path.join(projectDir, "v5/assets/mountain-bg-sky-imagegen-v2.png");
const redrawMountainsOutput = path.join(projectDir, "v5/assets/mountain-bg-mountains-imagegen-v2.png");

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
const skyMask = new Uint8Array(info.width * info.height);
const skyData = Buffer.alloc(info.width * info.height * 3);

for (let y = 0; y < info.height; y += 1) {
  const band = skyBands[Math.min(skyBands.length - 1, Math.floor(y / 6))];
  for (let x = 0; x < info.width; x += 1) {
    const pixel = y * info.width + x;
    const i = (y * info.width + x) * info.channels;
    const skyI = pixel * 3;
    skyData[skyI] = band[0];
    skyData[skyI + 1] = band[1];
    skyData[skyI + 2] = band[2];
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
    skyMask[pixel] = 1;
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

await sharp(skyData, {
  raw: {
    width: info.width,
    height: info.height,
    channels: 3,
  },
})
  .png({ palette: false, compressionLevel: 9 })
  .toFile(skyOutput);

const mountainsData = Buffer.alloc(info.width * info.height * 4);
for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
  const sourceI = pixel * info.channels;
  const targetI = pixel * 4;
  mountainsData[targetI] = data[sourceI];
  mountainsData[targetI + 1] = data[sourceI + 1];
  mountainsData[targetI + 2] = data[sourceI + 2];
  mountainsData[targetI + 3] = skyMask[pixel] ? 0 : 255;
}

await sharp(mountainsData, {
  raw: {
    width: info.width,
    height: info.height,
    channels: 4,
  },
})
  .png({ palette: false, compressionLevel: 9 })
  .toFile(mountainsOutput);

// Image-generated V5 redraw. It arrives with chroma-key transparency already
// removed; reduce it to a true 16:9 canonical grid and harden every alpha edge
// so browser scaling can never introduce a soft fringe around the peaks.
const REDRAW_W = 384;
const REDRAW_H = 216;
const redrawRaw = await sharp(redrawSource)
  .resize(REDRAW_W, REDRAW_H, { fit: "fill", kernel: sharp.kernel.nearest })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let pixel = 0; pixel < REDRAW_W * REDRAW_H; pixel += 1) {
  const i = pixel * 4;
  const opaque = redrawRaw.data[i + 3] >= 128;
  redrawRaw.data[i + 3] = opaque ? 255 : 0;
  if (!opaque) {
    redrawRaw.data[i] = 0;
    redrawRaw.data[i + 1] = 0;
    redrawRaw.data[i + 2] = 0;
  }
}

await sharp(redrawRaw.data, {
  raw: { width: REDRAW_W, height: REDRAW_H, channels: 4 },
})
  .png({ palette: true, colours: 32, dither: 0, effort: 10 })
  .toFile(redrawMountainsOutput);

const redrawSky = Buffer.alloc(REDRAW_W * REDRAW_H * 3);
for (let y = 0; y < REDRAW_H; y += 1) {
  const t = y / Math.max(1, REDRAW_H - 1);
  const bandT = Math.floor(t * 27) / 27;
  const col = [
    Math.round(58 + (144 - 58) * bandT),
    Math.round(148 + (212 - 148) * bandT),
    Math.round(236 + (251 - 236) * bandT),
  ];
  for (let x = 0; x < REDRAW_W; x += 1) {
    const i = (y * REDRAW_W + x) * 3;
    redrawSky[i] = col[0];
    redrawSky[i + 1] = col[1];
    redrawSky[i + 2] = col[2];
  }
}

await sharp(redrawSky, {
  raw: { width: REDRAW_W, height: REDRAW_H, channels: 3 },
})
  .png({ palette: true, colours: 28, dither: 0, effort: 10 })
  .toFile(redrawSkyOutput);

console.log([output, skyOutput, mountainsOutput, redrawSkyOutput, redrawMountainsOutput].join("\n"));
