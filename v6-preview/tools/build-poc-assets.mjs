import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "assets");
await mkdir(outDir, { recursive: true });

const paletteDoc = JSON.parse(await readFile(path.join(root, "palette.json"), "utf8"));
const hex = (value) => {
  const clean = value.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    255
  ];
};
const colors = Object.fromEntries(
  Object.entries(paletteDoc.colors).map(([key, ramp]) => [key, ramp.map(hex)])
);

function image(width, height) {
  return { width, height, data: Buffer.alloc(width * height * 4) };
}

function pixel(target, x, y, color) {
  if (x < 0 || y < 0 || x >= target.width || y >= target.height) return;
  const i = (y * target.width + x) * 4;
  target.data[i] = color[0];
  target.data[i + 1] = color[1];
  target.data[i + 2] = color[2];
  target.data[i + 3] = color[3] ?? 255;
}

function fill(target, x, y, width, height, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) pixel(target, px, py, color);
  }
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, payload) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, payload])));
  return Buffer.concat([length, name, payload, checksum]);
}

async function writePng(target, outputPath) {
  const scanlines = Buffer.alloc((target.width * 4 + 1) * target.height);
  for (let y = 0; y < target.height; y += 1) {
    const rowStart = y * (target.width * 4 + 1);
    scanlines[rowStart] = 0;
    target.data.copy(scanlines, rowStart + 1, y * target.width * 4, (y + 1) * target.width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(target.width, 0);
  ihdr.writeUInt32BE(target.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
  await writeFile(outputPath, png);
}

function hash(x, y, seed = 0) {
  let n = Math.imul((x + seed * 17) | 0, 374761393) ^ Math.imul((y - seed * 11) | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

const tiles = image(64, 32);
for (let variant = 0; variant < 4; variant += 1) {
  const ox = variant * 16;
  fill(tiles, ox, 0, 16, 16, colors.grass[3]);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const h = hash(x, y, variant + 3);
      let index = 3;
      if (h > 0.84) index = 5;
      else if (h > 0.64) index = 4;
      else if (h < 0.16) index = 2;
      if (y < 2) index = h > 0.58 ? 6 : 5;
      if (y > 11) index = h > 0.78 ? 3 : 2;
      pixel(tiles, ox + x, y, colors.grass[index]);
    }
  }
  for (let cluster = 0; cluster < 10; cluster += 1) {
    const x = Math.floor(hash(cluster, variant, 101) * 14);
    const y = 3 + Math.floor(hash(cluster, variant, 103) * 9);
    const color = colors.grass[hash(cluster, variant, 107) > 0.5 ? 5 : 2];
    fill(tiles, ox + x, y, hash(cluster, variant, 109) > 0.55 ? 2 : 1, hash(cluster, variant, 113) > 0.7 ? 2 : 1, color);
  }
  for (let x = 0; x < 16; x += 1) {
    if (hash(x, variant, 29) > 0.54) {
      const blade = 1 + Math.floor(hash(x, variant, 41) * 4);
      for (let b = 0; b < blade; b += 1) pixel(tiles, ox + x, 5 - b, colors.grass[5 + (b === blade - 1 ? 1 : 0)]);
    }
  }
  fill(tiles, ox, 16, 16, 16, colors.soil[2]);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const h = hash(x, y, variant + 71);
      let index = 2;
      if (h > 0.9) index = 4;
      else if (h > 0.72) index = 3;
      else if (h < 0.12) index = 1;
      pixel(tiles, ox + x, 16 + y, colors.soil[index]);
    }
  }
  for (let cluster = 0; cluster < 8; cluster += 1) {
    const x = Math.floor(hash(cluster, variant, 151) * 13);
    const y = Math.floor(hash(cluster, variant, 157) * 15);
    const width = 2 + Math.floor(hash(cluster, variant, 163) * 2);
    const color = colors.soil[hash(cluster, variant, 167) > 0.72 ? 4 : 1];
    fill(tiles, ox + x, 16 + y, width, 1, color);
    if (hash(cluster, variant, 173) > 0.72) pixel(tiles, ox + x + 1, 16 + y + 1, color);
  }
}

await writePng(tiles, path.join(outDir, "meadow-tiles-v1.png"));

const boulderSize = 64;
const boulderFrames = 8;
const boulders = image(boulderSize * boulderFrames, boulderSize);
for (let frame = 0; frame < boulderFrames; frame += 1) {
  const ox = frame * boulderSize;
  const cx = 31.5;
  const cy = 31.5;
  const radius = 28;
  const angle = (frame / boulderFrames) * Math.PI * 2;
  for (let y = 0; y < boulderSize; y += 1) {
    for (let x = 0; x < boulderSize; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius + (hash(x, y, 90) > 0.75 ? 0.7 : -0.3)) continue;
      const light = Math.max(0, 1 - Math.hypot(dx + 10, dy + 12) / 44);
      const edge = Math.max(0, (dist - 22) / 7);
      const grain = hash(
        Math.round(Math.cos(angle) * dx - Math.sin(angle) * dy + 40),
        Math.round(Math.sin(angle) * dx + Math.cos(angle) * dy + 40),
        17
      );
      let value = Math.round(1 + light * 3 - edge * 2 + (grain > 0.82 ? 1 : grain < 0.12 ? -1 : 0));
      value = Math.max(0, Math.min(colors.stone.length - 1, value));
      pixel(boulders, ox + x, y, colors.stone[value]);
    }
  }
  const cracks = [
    [[17, 22], [23, 26], [28, 25], [33, 31]],
    [[39, 15], [36, 22], [40, 27], [37, 34]],
    [[20, 43], [28, 40], [34, 43], [42, 39]]
  ];
  for (const line of cracks) {
    for (let s = 0; s < line.length - 1; s += 1) {
      const a = line[s];
      const b = line[s + 1];
      const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      for (let i = 0; i <= steps; i += 1) {
        const px = Math.round(a[0] + (b[0] - a[0]) * i / steps);
        const py = Math.round(a[1] + (b[1] - a[1]) * i / steps);
        const rx = Math.round(cx + Math.cos(angle) * (px - cx) - Math.sin(angle) * (py - cy));
        const ry = Math.round(cy + Math.sin(angle) * (px - cx) + Math.cos(angle) * (py - cy));
        pixel(boulders, ox + rx, ry, colors.stone[0]);
      }
    }
  }
}

await writePng(boulders, path.join(outDir, "boulder-frames-v1.png"));

await writeFile(path.join(outDir, "build-info.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  meadowTileSize: 16,
  meadowVariants: 4,
  boulderFrameSize: 64,
  boulderFrames
}, null, 2) + "\n");
