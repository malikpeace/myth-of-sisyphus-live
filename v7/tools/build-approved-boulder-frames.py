from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "boulder-granite-sprite-v2.png"
OUTPUT_DIR = ROOT / "v6-preview" / "assets"
# Sixteen fixed angles are enough at the game's native pixel scale and avoid
# decoding several oversized 64-frame atlases on mobile Safari.
FRAME_COUNT = 16
BASE_DIAMETER = 64 * 1.32
STAGE_SCALES = (0.62, 0.991667, 1.363333, 1.735, 2.106667, 2.478333, 2.85)

source = Image.open(SOURCE).convert("RGBA")

for stage, scale in enumerate(STAGE_SCALES):
    size = round(BASE_DIAMETER * scale)
    stage_source = source.resize((size, size), Image.Resampling.NEAREST)
    atlas = Image.new("RGBA", (size * FRAME_COUNT, size), (0, 0, 0, 0))
    for frame in range(FRAME_COUNT):
        rotated = stage_source.rotate(
            -frame * (360 / FRAME_COUNT),
            resample=Image.Resampling.NEAREST,
            expand=False,
        )
        pixels = rotated.load()
        for y in range(rotated.height):
            for x in range(rotated.width):
                red, green, blue, alpha = pixels[x, y]
                pixels[x, y] = (red, green, blue, 255 if alpha >= 128 else 0)
        atlas.alpha_composite(rotated, (frame * size, 0))

    output = OUTPUT_DIR / f"boulder-stage-{stage}-{size}-16f.png"
    atlas.save(output, optimize=True)
    print(f"Wrote {output} ({atlas.width}x{atlas.height})")
