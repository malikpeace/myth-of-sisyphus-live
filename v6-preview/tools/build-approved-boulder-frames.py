from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "boulder-granite-sprite-v2.png"
OUTPUT = ROOT / "v6-preview" / "assets" / "boulder-frames-v5-approved.png"
FRAME_COUNT = 64

source = Image.open(SOURCE).convert("RGBA").resize((64, 64), Image.Resampling.NEAREST)
atlas = Image.new("RGBA", (64 * FRAME_COUNT, 64), (0, 0, 0, 0))
for frame in range(FRAME_COUNT):
    rotated = source.rotate(-frame * (360 / FRAME_COUNT), resample=Image.Resampling.NEAREST, expand=False)
    pixels = rotated.load()
    for y in range(rotated.height):
        for x in range(rotated.width):
            red, green, blue, alpha = pixels[x, y]
            pixels[x, y] = (red, green, blue, 255 if alpha >= 128 else 0)
    atlas.alpha_composite(rotated, (frame * 64, 0))

atlas.save(OUTPUT, optimize=True)
print(f"Wrote {OUTPUT} ({atlas.width}x{atlas.height})")
