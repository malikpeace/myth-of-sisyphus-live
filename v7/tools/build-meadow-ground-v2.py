from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "source" / "meadow-ground-imagegen-source-v2.png"
OUTPUT = ROOT / "assets" / "meadow-ground-v2.png"
WIDTH = 256
HEIGHT = 512
SCALED_SOURCE_HEIGHT = 136
SOURCE_HEIGHT = 112
GRASS_DEPTH = 32


def rgb(value: str) -> tuple[int, int, int]:
    value = value.removeprefix("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


def nearest(color: tuple[int, int, int], palette: list[tuple[int, int, int]]) -> tuple[int, int, int]:
    red, green, blue = color
    return min(
        palette,
        key=lambda candidate: (
            (candidate[0] - red) ** 2 * 0.30
            + (candidate[1] - green) ** 2 * 0.59
            + (candidate[2] - blue) ** 2 * 0.11
        ),
    )


def hash01(x: int, y: int, seed: int = 0) -> float:
    mask = 0xFFFFFFFF
    value = (((x + seed * 17) * 374761393) & mask) ^ (((y - seed * 11) * 668265263) & mask)
    value = ((value ^ (value >> 13)) * 1274126177) & mask
    value ^= value >> 16
    return (value & mask) / mask


def build() -> None:
    palette_document = json.loads((ROOT / "palette.json").read_text())
    ramps = {
        name: [rgb(value) for value in values]
        for name, values in palette_document["colors"].items()
    }

    source = Image.open(SOURCE).convert("RGB")
    source = source.resize((WIDTH, SCALED_SOURCE_HEIGHT), Image.Resampling.LANCZOS)
    source = ImageEnhance.Contrast(source).enhance(1.08)
    source = ImageEnhance.Color(source).enhance(0.96)

    ground = Image.new("RGB", (WIDTH, HEIGHT), ramps["soil"][1])
    pixels = ground.load()
    source_pixels = source.load()

    grass_palette = ramps["grass"] + ramps["flowers"]
    soil_palette = ramps["soil"]
    for y in range(SOURCE_HEIGHT):
        material_palette = grass_palette if y < GRASS_DEPTH else soil_palette
        for x in range(WIDTH):
            chosen = nearest(source_pixels[x, y], material_palette)
            if y < GRASS_DEPTH and chosen in ramps["flowers"] and hash01(x // 9, 0, 887) < 0.72:
                chosen = nearest(source_pixels[x, y], ramps["grass"])
            pixels[x, y] = chosen

    # Extend the source into deep, clustered soil so portrait screens never expose
    # a repeated lower edge. Detail is built in small connected patches, not noise.
    for y in range(SOURCE_HEIGHT, HEIGHT):
        depth = (y - SOURCE_HEIGHT) / max(1, HEIGHT - SOURCE_HEIGHT - 1)
        base_index = 1
        if depth > 0.68:
            base_index = 0
        for x in range(WIDTH):
            cell_x = x // 3
            cell_y = y // 2
            grain = hash01(cell_x, cell_y, 211)
            index = base_index
            if grain > 0.80 and depth < 0.78:
                index += 1
            elif grain < 0.12:
                index -= 1
            index = max(0, min(len(soil_palette) - 1, index))
            pixels[x, y] = soil_palette[index]

    # Quiet horizontal strata and short root-like seams give the earth structure.
    for band in range(7):
        y = 151 + band * 31 + round(hash01(band, 0, 301) * 13)
        for segment in range(-1, 7):
            start = segment * 47 + round(hash01(segment, band, 307) * 18)
            length = 13 + round(hash01(segment, band, 311) * 30)
            shade = soil_palette[3 if band < 3 else 2]
            if hash01(segment, band, 313) > 0.48:
                shade = soil_palette[1]
            for x in range(max(0, start), min(WIDTH, start + length)):
                pixels[x, y] = shade
                if x < start + length // 2 and hash01(x, y, 317) > 0.76:
                    pixels[x, min(HEIGHT - 1, y + 1)] = shade

    # Remove any isolated one-pixel values in the generated turf/soil source.
    cleaned = ground.copy()
    cleaned_pixels = cleaned.load()
    for y in range(1, SOURCE_HEIGHT - 1):
        for x in range(1, WIDTH - 1):
            center = pixels[x, y]
            neighbors = [pixels[x - 1, y], pixels[x + 1, y], pixels[x, y - 1], pixels[x, y + 1]]
            if all(color != center for color in neighbors) and len(set(neighbors)) <= 2:
                cleaned_pixels[x, y] = max(set(neighbors), key=neighbors.count)

    cleaned.save(OUTPUT, optimize=True)


if __name__ == "__main__":
    build()
