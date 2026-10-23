"""Cut V1 into 2.5D layers: back plate, character, front (machine + ribbon + ledge), plus a parcel sprite.

Same method as cut_layers.py: the clean plate lines up with the master, so their difference
is everything in front of the backdrop. Polygons (in % of the frame) decide which layer each
foreground pixel belongs to.

Usage: python tools/cut_v1.py   → prototype/assets/v1/layer-*.webp, parcel.webp, preview-*.png
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

V1 = Path(__file__).resolve().parent.parent / "prototype" / "assets" / "v1"


def poly(size, pts):
    w, h = size
    img = Image.new("L", size, 0)
    ImageDraw.Draw(img).polygon([(x / 100 * w, y / 100 * h) for x, y in pts], fill=255)
    return np.asarray(img, dtype=np.float32) / 255


def close_fill(mask, k=31):
    """Fill holes inside a mask (morphological close), keep the outline."""
    img = Image.fromarray(((mask > 0.5) * 255).astype(np.uint8))
    img = img.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))
    return np.asarray(img, dtype=np.float32) / 255


def feather(mask, r=1.2):
    img = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
    return np.asarray(img, dtype=np.float32) / 255


def save(rgb, alpha, name, crop=None):
    rgba = np.dstack([rgb.astype(np.uint8), (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    im = Image.fromarray(rgba, "RGBA")
    if crop:
        im = im.crop(crop)
    im.save(V1 / f"{name}.webp", quality=90, method=6)
    w, h = im.size
    yy, xx = np.mgrid[0:h, 0:w]
    checker = Image.fromarray(np.where(((xx // 32) + (yy // 32)) % 2 == 0, 235, 200).astype(np.uint8)).convert("RGBA")
    checker.alpha_composite(im)
    checker.convert("RGB").resize((max(1, w // 2), max(1, h // 2))).save(V1 / f"preview-{name}.png")


def main():
    master = Image.open(V1 / "v1-master.png").convert("RGB")
    plate = Image.open(V1 / "v1-plate.png").convert("RGB")
    size = master.size
    W, H = size
    M = np.asarray(master, dtype=np.float32)
    blur = lambda im: np.asarray(im.filter(ImageFilter.GaussianBlur(1.5)), dtype=np.float32)
    diff = np.abs(blur(master) - blur(plate)).mean(2)
    t = np.clip((diff - 5) / 12, 0, 1)
    fg = t * t * (3 - 2 * t)

    machine = poly(size, [(69.1, 61.6), (90.5, 61.6), (91.4, 66), (91.4, 82.5), (97.5, 82.5), (97.5, 98), (69.1, 98)])
    ledge = poly(size, [(35.5, 89.6), (100, 82.8), (100, 100), (35.5, 100)])
    # The paper ribbon is near-white; his linen shirt is warmer (red minus blue ≈ 45 vs ≈ 10–20).
    r, g, b = M[..., 0], M[..., 1], M[..., 2]
    whitish = ((r - b) < 40) & (np.minimum(np.minimum(r, g), b) > 105)  # includes the ribbon's grey shading
    ribbon_zone = poly(size, [(35, 70), (71, 70), (71, 100), (35, 100)])
    ribbon = close_fill((fg > 0.5) * whitish * ribbon_zone, 13) * ribbon_zone
    machine_mask = close_fill(fg * machine) * machine
    front_hard = np.clip(machine_mask + ribbon + ledge, 0, 1)
    front_zone = front_hard

    front = feather(front_hard)

    # Character: everything else in front of the backdrop, inside his area.
    body_zone = poly(size, [(48, 8), (83, 8), (83, 92), (48, 92)])
    char = fg * body_zone * (1 - front_zone)
    char = np.maximum(char, close_fill(char, 41) * body_zone * (1 - front_zone))
    char = feather(char)
    # Continue him a little under the front layer so a parallax shift never opens a gap.
    char_rgb = M.copy()

    save(M, front, "layer-front")
    save(char_rgb, char, "layer-character")
    plate.save(V1 / "layer-back.webp", quality=88, method=6)

    # Parcel sprite: the front parcel on the conveyor, kraft paper + its white band.
    box = (int(0.838 * W), int(0.758 * H), int(0.938 * W), int(0.858 * H))
    region = M[box[1]:box[3], box[0]:box[2]]
    r, g, b = region[..., 0], region[..., 1], region[..., 2]
    kraft = ((r - b) > 45) & (r > 140)
    band = ((r > 205) & (g > 205) & (b > 195))
    m = (kraft | band).astype(np.float32)
    m = close_fill(m, 9)
    # keep only the largest blob roughly: drop pixels far outside the kraft hull
    hull = close_fill(kraft.astype(np.float32), 35)
    m = feather(m * hull, 0.8)
    full = np.zeros((H, W), np.float32)
    full[box[1]:box[3], box[0]:box[2]] = m
    save(M, full, "parcel", crop=box)

    for n in ("layer-back", "layer-character", "layer-front", "parcel"):
        print(n, f"{(V1 / f'{n}.webp').stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
