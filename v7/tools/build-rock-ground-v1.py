from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "source" / "rock-ground-imagegen-source-v1.png"
OUTPUT = ROOT / "assets" / "rock-ground-v1.png"
WIDTH = 256
HEIGHT = 512
SURFACE_DEPTH = 42

ROCK = [
    (8, 11, 13),
    (16, 21, 24),
    (25, 31, 35),
    (36, 43, 47),
    (51, 59, 63),
    (72, 80, 84),
    (101, 109, 112),
]
MOSS = [
    (23, 45, 24),
    (37, 69, 29),
    (54, 99, 35),
    (79, 132, 40),
]


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


def build() -> None:
    source = Image.open(SOURCE).convert("RGB")
    source = source.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    source = ImageEnhance.Contrast(source).enhance(1.16)
    source = ImageEnhance.Color(source).enhance(0.55)

    output = Image.new("RGB", (WIDTH, HEIGHT), ROCK[0])
    src = source.load()
    dst = output.load()

    for y in range(HEIGHT):
        depth = y / max(1, HEIGHT - 1)
        allowed = ROCK
        if depth > 0.74:
            allowed = ROCK[:4]
        elif depth > 0.52:
            allowed = ROCK[:5]
        for x in range(WIDTH):
            color = src[x, y]
            green_fleck = (
                y < SURFACE_DEPTH
                and color[1] > color[0] * 1.08
                and color[1] > color[2] * 0.92
            )
            dst[x, y] = nearest(color, MOSS if green_fleck else allowed)

    # Remove isolated single-pixel values while retaining authored strata.
    cleaned = output.copy()
    clean = cleaned.load()
    for y in range(1, HEIGHT - 1):
        for x in range(1, WIDTH - 1):
            center = dst[x, y]
            neighbors = [dst[x - 1, y], dst[x + 1, y], dst[x, y - 1], dst[x, y + 1]]
            if all(color != center for color in neighbors) and len(set(neighbors)) <= 2:
                clean[x, y] = max(set(neighbors), key=neighbors.count)

    cleaned.save(OUTPUT, optimize=True)


if __name__ == "__main__":
    build()
