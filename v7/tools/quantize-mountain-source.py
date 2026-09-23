from pathlib import Path
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "mountain-source-alpha-v1.png"
OUTPUT = ROOT / "assets" / "mountain-plate-v6-candidate.png"


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.removeprefix("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


palette_doc = json.loads((ROOT / "palette.json").read_text())
allowed = []
for ramp_name in ("mountainFar", "mountainNear", "snow"):
    allowed.extend(hex_rgb(value) for value in palette_doc["colors"][ramp_name])

image = Image.open(SOURCE).convert("RGBA")
width, height = image.size
crop_width = min(width, 1440)
crop_height = min(height, 900)
left = (width - crop_width) // 2
top = height - crop_height
image = image.crop((left, top, left + crop_width, top + crop_height))
image = image.resize((480, 300), Image.Resampling.NEAREST)

pixels = image.load()
for y in range(image.height):
    for x in range(image.width):
        red, green, blue, alpha = pixels[x, y]
        if alpha < 120:
            pixels[x, y] = (0, 0, 0, 0)
            continue
        nearest = min(
            allowed,
            key=lambda color: (red - color[0]) ** 2 + (green - color[1]) ** 2 + (blue - color[2]) ** 2,
        )
        pixels[x, y] = (*nearest, 255)

image.save(OUTPUT, optimize=True)
print(f"Wrote {OUTPUT} ({image.width}x{image.height})")
