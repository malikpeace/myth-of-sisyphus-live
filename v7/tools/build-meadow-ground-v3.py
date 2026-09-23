from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "v5" / "assets" / "v5-meadow-ground-approved.png"
OUTPUT = ROOT / "assets" / "meadow-ground-v3.png"

WIDTH = 512
HEIGHT = 512
GRASS_SOURCE_BOTTOM = 245
GRASS_DEPTH = 82


GRASS = [
    (13, 24, 15),
    (20, 36, 17),
    (29, 51, 20),
    (38, 68, 22),
    (49, 86, 24),
    (63, 105, 27),
    (81, 128, 31),
    (104, 149, 38),
    (132, 169, 47),
    (168, 190, 65),
]

FLOWERS = [
    (242, 238, 224),
    (231, 166, 189),
    (201, 94, 137),
    (232, 85, 79),
    (241, 200, 75),
]

SOIL = [
    (18, 13, 12),
    (27, 19, 18),
    (37, 25, 22),
    (48, 32, 27),
    (61, 41, 33),
    (76, 51, 40),
    (94, 63, 48),
    (116, 79, 59),
    (143, 100, 75),
]

STONES = [
    (45, 40, 38),
    (66, 58, 53),
    (89, 79, 71),
    (119, 108, 97),
]


def nearest(
    color: tuple[int, int, int],
    palette: list[tuple[int, int, int]],
) -> tuple[int, int, int]:
    red, green, blue = color
    return min(
        palette,
        key=lambda candidate: (
            (candidate[0] - red) ** 2 * 0.30
            + (candidate[1] - green) ** 2 * 0.59
            + (candidate[2] - blue) ** 2 * 0.11
        ),
    )


def is_flower(color: tuple[int, int, int]) -> bool:
    red, green, blue = color
    pale = red > 150 and green > 135 and blue > 115
    pink = red > 105 and red > green * 1.14 and red > blue * 1.03
    yellow = red > 130 and green > 105 and blue < green * 0.78
    return pale or pink or yellow


def is_stone(color: tuple[int, int, int]) -> bool:
    red, green, blue = color
    spread = max(color) - min(color)
    return red > 40 and spread < 24 and abs(red - green) < 18


def reduce_region(
    source: Image.Image,
    size: tuple[int, int],
    material: str,
) -> Image.Image:
    reduced = source.resize(size, Image.Resampling.LANCZOS)
    reduced = ImageEnhance.Contrast(reduced).enhance(1.08)
    pixels = reduced.load()
    for y in range(reduced.height):
        for x in range(reduced.width):
            color = pixels[x, y]
            if material == "grass":
                palette = FLOWERS if is_flower(color) else GRASS
            else:
                palette = STONES if is_stone(color) else SOIL
            pixels[x, y] = nearest(color, palette)
    return reduced


def build() -> None:
    source = Image.open(SOURCE).convert("RGB")
    source = ImageEnhance.Color(source).enhance(1.04)

    grass_source = source.crop((0, 0, source.width, GRASS_SOURCE_BOTTOM))
    soil_source = source.crop((0, GRASS_SOURCE_BOTTOM, source.width, source.height))

    grass = reduce_region(grass_source, (WIDTH, GRASS_DEPTH), "grass")
    soil = reduce_region(soil_source, (WIDTH, HEIGHT - GRASS_DEPTH), "soil")

    ground = Image.new("RGB", (WIDTH, HEIGHT))
    ground.paste(grass, (0, 0))
    ground.paste(soil, (0, GRASS_DEPTH))
    ground.save(OUTPUT, optimize=True)


if __name__ == "__main__":
    build()
