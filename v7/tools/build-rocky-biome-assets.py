#!/usr/bin/env python3
"""Build strict pixel atlases from the generated rocky-biome source sheets."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"


SHEETS = (
    {
        "source": "rocky-path-props-chroma-v2.png",
        "output": "rocky-path-props-v2.png",
        "count": 6,
        "bounds": (0, 307, 655, 1074, 1390, 1779, 2172),
        "cell": (128, 64),
        "fit": (116, 48),
        "colors": 14,
    },
    {
        "source": "rocky-background-crags-chroma-v2.png",
        "output": "rocky-background-crags-v2.png",
        "count": 5,
        "bounds": (0, 510, 925, 1460, 1703, 2172),
        "cell": (192, 168),
        "fit": (178, 152),
        "colors": 14,
    },
    {
        "source": "rocky-foreground-masses-chroma-v2.png",
        "output": "rocky-foreground-masses-v2.png",
        "count": 4,
        "bounds": (0, 515, 894, 1330, 1774),
        "cell": (240, 320),
        "fit": (224, 304),
        "colors": 16,
    },
)


def is_chroma(pixel):
    r, g, b = pixel[:3]
    return r > 100 and b > 90 and g < min(r, b) * 0.72


def keyed_crop(image, left, right):
    slot = image.crop((left, 0, right, image.height)).convert("RGBA")
    pixels = list(slot.getdata())
    alpha = [0 if is_chroma(px) else 255 for px in pixels]
    alpha_image = Image.new("L", slot.size)
    alpha_image.putdata(alpha)
    slot.putalpha(alpha_image)
    bbox = slot.getchannel("A").getbbox()
    if not bbox:
        raise RuntimeError(f"No sprite found between x={left} and x={right}")
    return slot.crop(bbox)


def fit_sprite(sprite, max_w, max_h):
    scale = min(max_w / sprite.width, max_h / sprite.height)
    size = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
    # One filtered reduction followed by palette reduction gives authored-size
    # pixel clusters; alpha is snapped back to binary immediately afterward.
    sprite = sprite.resize(size, Image.Resampling.LANCZOS)
    alpha = sprite.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    sprite.putalpha(alpha)
    return sprite


def quantize_rgba(image, colors):
    alpha = image.getchannel("A").point(lambda value: 255 if value else 0)
    quantized = image.convert("RGBA").quantize(
        colors=colors,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.NONE,
    ).convert("RGBA")
    quantized.putalpha(alpha)
    return quantized


def build(spec):
    source = Image.open(ASSETS / spec["source"]).convert("RGBA")
    count = spec["count"]
    cell_w, cell_h = spec["cell"]
    fit_w, fit_h = spec["fit"]
    atlas = Image.new("RGBA", (cell_w * count, cell_h), (0, 0, 0, 0))

    for index in range(count):
        left = spec["bounds"][index]
        right = spec["bounds"][index + 1]
        sprite = fit_sprite(keyed_crop(source, left, right), fit_w, fit_h)
        x = index * cell_w + (cell_w - sprite.width) // 2
        y = cell_h - sprite.height
        atlas.alpha_composite(sprite, (x, y))

    atlas = quantize_rgba(atlas, spec["colors"])
    atlas.save(ASSETS / spec["output"], optimize=True)
    print(f"built {spec['output']}: {atlas.width}x{atlas.height}")


def main():
    for spec in SHEETS:
        build(spec)


if __name__ == "__main__":
    main()
