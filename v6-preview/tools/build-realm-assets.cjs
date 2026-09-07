// Offline source cleanup only. Generated sources are never loaded by the game.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const hex = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));

function quantize(data, palette, transparent) {
  const result = Buffer.alloc(data.length);
  const cache = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (transparent && data[i + 3] < 240) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let color = cache.get(key);
    if (!color) {
      let best = Infinity;
      for (const candidate of palette) {
        const dr = data[i] - candidate[0], dg = data[i + 1] - candidate[1], db = data[i + 2] - candidate[2];
        const distance = 2 * dr * dr + 3 * dg * dg + db * db;
        if (distance < best) { best = distance; color = candidate; }
      }
      cache.set(key, color);
    }
    result.set([...color, 255], i);
  }
  return result;
}

function removeStrayAlpha(data, width, height) {
  const visited = new Uint8Array(width * height);
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || !data[start * 4 + 3]) continue;
    const component = [start]; visited[start] = 1;
    for (let i = 0; i < component.length; i++) {
      const p = component[i], x = p % width, y = Math.floor(p / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, next = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || visited[next] || !data[next * 4 + 3]) continue;
        visited[next] = 1; component.push(next);
      }
    }
    if (component.length < 3) for (const p of component) data.fill(0, p * 4, p * 4 + 4);
  }
}

async function main() {
  const config = JSON.parse(await fs.readFile(path.join(root, 'realm-palettes.json'), 'utf8'));
  const report = {version: 1, status: 'candidate', assets: []};
  for (const asset of config.assets) {
    const source = await fs.readFile(path.join(root, 'assets', asset.source));
    const palette = asset.ramps.flatMap(name => config.ramps[name].map(hex));
    const {data, info} = await sharp(source).resize(asset.width, asset.height, {fit: 'fill', kernel: 'nearest'})
      .ensureAlpha().raw().toBuffer({resolveWithObject: true});
    const cleaned = quantize(data, palette, asset.transparent);
    if (asset.transparent) removeStrayAlpha(cleaned, info.width, info.height);
    const used = new Set(); let opaque = 0;
    for (let i = 0; i < cleaned.length; i += 4) if (cleaned[i + 3]) {
      opaque++; used.add(cleaned.subarray(i, i + 3).toString('hex'));
    }
    const output = path.join(root, 'assets', asset.output);
    await sharp(cleaned, {raw: {width: info.width, height: info.height, channels: 4}}).png().toFile(output);
    report.assets.push({id: asset.id, path: asset.output, nativeSize: [info.width, info.height], colors: used.size,
      opaquePixels: opaque, partialAlpha: 0, sourceSHA256: crypto.createHash('sha256').update(source).digest('hex'),
      outputSHA256: crypto.createHash('sha256').update(await fs.readFile(output)).digest('hex')});
  }
  await fs.writeFile(path.join(root, 'assets', 'realm-candidates.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = {quantize, removeStrayAlpha};
