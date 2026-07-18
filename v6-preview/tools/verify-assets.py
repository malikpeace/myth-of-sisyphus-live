from pathlib import Path
import json
import sys

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "assets" / "manifest.json").read_text())
errors = []
report = []

for asset in manifest["assets"]:
    path = (ROOT / "assets" / asset["path"]).resolve()
    if not path.exists():
        report.append({"id": asset["id"], "status": "reference-only"})
        continue
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    histogram = alpha.histogram()
    partial = sum(histogram[1:255])
    expected = asset.get("nativeSize")
    if expected and list(image.size) != expected:
        errors.append(f"{asset['id']}: expected {expected}, got {list(image.size)}")
    frame = asset.get("nativeFrame")
    frames = asset.get("frames")
    if frame and frames and image.size != (frame[0] * frames, frame[1]):
        errors.append(f"{asset['id']}: frame atlas dimensions do not match metadata")
    if partial and not asset.get("approvedException"):
        errors.append(f"{asset['id']}: {partial} partially transparent pixels")
    report.append({
        "id": asset["id"],
        "size": list(image.size),
        "partialAlpha": partial,
        "status": asset["status"],
    })

result = {"ok": not errors, "errors": errors, "assets": report}
(ROOT / "baselines" / "asset-validation.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
sys.exit(1 if errors else 0)
