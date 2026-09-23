#!/usr/bin/env python3
"""Reduce the generated mountain source onto V6's hard two-pixel art grid."""

from pathlib import Path
import sys

from PIL import Image


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: build-mountain-plate-v2.py INPUT OUTPUT", file=sys.stderr)
        return 2

    source = Image.open(Path(sys.argv[1])).convert("RGBA")
    reduced = source.resize((240, 160), Image.Resampling.NEAREST).crop((0, 5, 240, 155))

    alpha = reduced.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    rgb = reduced.convert("RGB")
    rgb.paste((0, 0, 0), mask=alpha.point(lambda value: 0 if value else 255))
    rgb = rgb.quantize(colors=18, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    rgb.putalpha(alpha)

    final = rgb.resize((480, 300), Image.Resampling.NEAREST)
    output = Path(sys.argv[2])
    output.parent.mkdir(parents=True, exist_ok=True)
    final.save(output, optimize=True)

    pixels = final.getdata()
    opaque_colors = {pixel[:3] for pixel in pixels if pixel[3]}
    partial_alpha = sum(1 for pixel in pixels if pixel[3] not in (0, 255))
    print(f"wrote {output} ({final.width}x{final.height}, {len(opaque_colors)} colors, {partial_alpha} partial alpha)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
