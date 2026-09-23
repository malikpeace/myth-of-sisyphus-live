from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "rock-ground-v1.png"

ROCK = [
    (8, 11, 13), (16, 21, 24), (25, 31, 35), (36, 43, 47),
    (51, 59, 63), (72, 80, 84), (101, 109, 112),
]
MOSS = [(23, 45, 24), (37, 69, 29), (54, 99, 35), (79, 132, 40)]

PALETTES = {
    "galaxy": [
        (7, 8, 18), (13, 15, 31), (23, 25, 49), (34, 36, 68),
        (51, 50, 88), (74, 70, 112), (104, 98, 143),
    ],
    "valleys": [
        (15, 10, 16), (27, 17, 26), (43, 25, 39), (61, 34, 53),
        (82, 47, 65), (105, 64, 79), (139, 88, 100),
    ],
    "canyon": [
        (20, 11, 8), (38, 20, 13), (61, 31, 18), (86, 43, 23),
        (115, 58, 30), (148, 80, 42), (184, 109, 63),
    ],
    "greek": [
        (18, 14, 10), (35, 27, 17), (55, 42, 24), (78, 59, 31),
        (103, 79, 41), (134, 105, 59), (169, 139, 84),
    ],
    "snow": [
        (11, 17, 24), (20, 30, 41), (33, 47, 60), (50, 67, 82),
        (75, 94, 109), (117, 139, 153), (176, 194, 202),
    ],
    "storm": [
        (6, 9, 14), (12, 17, 25), (20, 27, 38), (30, 39, 52),
        (43, 54, 69), (61, 74, 90), (86, 101, 116),
    ],
    "ruins": [
        (14, 13, 12), (27, 25, 22), (42, 38, 33), (59, 53, 45),
        (79, 70, 58), (103, 92, 76), (133, 120, 100),
    ],
    "volcanic": [
        (10, 7, 7), (22, 12, 10), (37, 19, 14), (54, 27, 18),
        (76, 37, 21), (107, 52, 25), (151, 76, 35),
    ],
    "aurora": [
        (5, 11, 17), (10, 23, 30), (17, 37, 45), (25, 54, 60),
        (36, 75, 78), (55, 99, 96), (82, 128, 116),
    ],
    "bones": [
        (18, 17, 15), (33, 31, 27), (50, 47, 40), (70, 66, 56),
        (94, 88, 74), (126, 118, 99), (165, 156, 132),
    ],
    "obsidian": [
        (4, 6, 10), (9, 12, 19), (15, 19, 29), (23, 27, 42),
        (34, 39, 57), (49, 53, 73), (70, 73, 96),
    ],
    "elysium": [
        (13, 18, 15), (25, 34, 27), (39, 51, 40), (56, 70, 53),
        (77, 92, 67), (105, 118, 84), (143, 151, 108),
    ],
    "void": [
        (2, 3, 7), (5, 6, 13), (9, 10, 20), (14, 15, 29),
        (21, 21, 40), (31, 29, 53), (44, 40, 69),
    ],
}

SURFACE_ACCENTS = {
    "galaxy": [(29, 43, 76), (47, 63, 102), (71, 82, 127), (104, 104, 150)],
    "valleys": [(48, 36, 46), (70, 49, 61), (96, 65, 79), (129, 88, 101)],
    "canyon": [(60, 45, 22), (88, 64, 29), (120, 84, 37), (157, 111, 52)],
    "greek": [(48, 51, 25), (69, 72, 32), (94, 95, 42), (124, 121, 56)],
    "snow": [(115, 141, 158), (151, 174, 187), (196, 211, 218), (231, 237, 236)],
    "storm": [(26, 39, 47), (39, 55, 64), (57, 74, 83), (80, 99, 106)],
    "ruins": [(54, 56, 43), (73, 74, 54), (96, 95, 67), (124, 120, 85)],
    "volcanic": [(72, 28, 16), (105, 39, 18), (143, 54, 21), (187, 77, 27)],
    "aurora": [(24, 63, 64), (34, 86, 81), (50, 111, 98), (75, 141, 119)],
    "bones": [(95, 93, 76), (124, 120, 96), (158, 151, 120), (196, 187, 151)],
    "obsidian": [(26, 30, 46), (37, 42, 60), (51, 56, 76), (71, 75, 96)],
    "elysium": [(61, 90, 55), (83, 113, 69), (111, 139, 87), (148, 169, 112)],
    "void": [(13, 14, 27), (20, 20, 38), (29, 27, 50), (40, 36, 63)],
}


def nearest_index(color: tuple[int, int, int], palette: list[tuple[int, int, int]]) -> int:
    return min(
        range(len(palette)),
        key=lambda index: sum((palette[index][channel] - color[channel]) ** 2 for channel in range(3)),
    )


def build() -> None:
    source = Image.open(SOURCE).convert("RGB")
    src = source.load()
    for name, palette in PALETTES.items():
        output = Image.new("RGB", source.size, palette[0])
        dst = output.load()
        accents = SURFACE_ACCENTS[name]
        for y in range(source.height):
            for x in range(source.width):
                color = src[x, y]
                moss_index = nearest_index(color, MOSS)
                moss_distance = sum((MOSS[moss_index][channel] - color[channel]) ** 2 for channel in range(3))
                rock_index = nearest_index(color, ROCK)
                rock_distance = sum((ROCK[rock_index][channel] - color[channel]) ** 2 for channel in range(3))
                if y < 48 and moss_distance < rock_distance:
                    dst[x, y] = accents[moss_index]
                else:
                    dst[x, y] = palette[rock_index]

        output.save(ROOT / "assets" / f"ground-{name}-v1.png", optimize=True)


if __name__ == "__main__":
    build()
