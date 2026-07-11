from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "v5" / "assets"


def build_pixel_master(source: str, output: str, target: tuple[int, int], colors: int) -> None:
    image = Image.open(ROOT / "assets" / source).convert("RGB")
    image = image.filter(ImageFilter.GaussianBlur(1.15))

    low_size = (target[0] // 2, target[1] // 2)
    image = ImageOps.fit(image, low_size, method=Image.Resampling.LANCZOS)
    image = ImageEnhance.Contrast(image).enhance(1.06)
    image = ImageEnhance.Color(image).enhance(0.92)
    image = image.quantize(
        colors=colors,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    ).convert("RGB")
    image = image.resize(target, Image.Resampling.NEAREST)

    OUT.mkdir(parents=True, exist_ok=True)
    image.save(OUT / output, optimize=True)


def main() -> None:
    build_pixel_master(
        "galaxy-night-wide-v2.png",
        "galaxy-wide-v5.png",
        (426, 240),
        colors=28,
    )
    build_pixel_master(
        "galaxy-night-portrait-v2.png",
        "galaxy-portrait-v5.png",
        (240, 426),
        colors=28,
    )


if __name__ == "__main__":
    main()
