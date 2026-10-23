"""Cut the hero into 2.5D layers by comparing the master frame with the clean room plate.

The plate (P2) is the master (P1) with the person and desk painted out, and it lines up
pixel-for-pixel. So wherever the two differ, something sits in front of the room.
That difference becomes the alpha mask. The desk layer takes its laptop lid from P4
(logo replaced by a sticker). Everything else comes from the master.

Usage: python tools/cut_layers.py
Writes prototype/assets/hero/layer-*.webp and preview-*.png.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERO = Path(__file__).resolve().parent.parent / "prototype" / "assets" / "hero"
DESK_LINE = 0.84  # y (fraction of height) of the desk's top edge


def load(name):
    return Image.open(HERO / name).convert("RGB")


def poly_mask(size, pts):
    """Polygon in fractions of width/height → 0..1 float mask."""
    w, h = size
    img = Image.new("L", size, 0)
    ImageDraw.Draw(img).polygon([(x * w, y * h) for x, y in pts], fill=255)
    return np.asarray(img, dtype=np.float32) / 255


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def soft(mask, grow=2, feather=1.5):
    """Close small holes, then soften the edge."""
    img = Image.fromarray((mask * 255).astype(np.uint8))
    if grow:  # Pillow crashes on a size-1 rank filter
        img = img.filter(ImageFilter.MaxFilter(grow * 2 + 1)).filter(ImageFilter.MinFilter(grow * 2 + 1))
    img = img.filter(ImageFilter.GaussianBlur(feather))
    return np.asarray(img, dtype=np.float32) / 255


def save_layer(rgb, alpha, name):
    rgba = np.dstack([rgb, (alpha * 255).astype(np.uint8)])
    Image.fromarray(rgba, "RGBA").save(HERO / f"{name}.webp", quality=90, method=6)
    # Checkerboard preview so the cut can be judged by eye
    w, h = alpha.shape[1], alpha.shape[0]
    yy, xx = np.mgrid[0:h, 0:w]
    checker = np.where(((xx // 32) + (yy // 32)) % 2 == 0, 235, 200).astype(np.float32)
    a = alpha[..., None]
    prev = rgb * a + checker[..., None] * (1 - a)
    Image.fromarray(prev.astype(np.uint8)).resize((w // 2, h // 2)).save(HERO / f"preview-{name}.png")


def main():
    master, plate, desk_edit = load("p1-master.png"), load("p2-room.png"), load("p4-desk.png")
    size = master.size
    w, h = size
    M = np.asarray(master, dtype=np.float32)
    P4 = np.asarray(desk_edit, dtype=np.float32)

    # Difference on lightly blurred copies, so render noise doesn't count as "something there"
    blur = lambda im: np.asarray(im.filter(ImageFilter.GaussianBlur(1.5)), dtype=np.float32)
    diff = np.abs(blur(master) - blur(plate)).mean(2)
    diff4 = np.abs(blur(desk_edit) - blur(plate)).mean(2)
    fg = smoothstep(9, 30, diff)
    fg4 = smoothstep(9, 30, diff4)

    # ---- Desk layer: desk surface + things on it, in front of the character ----
    surface = poly_mask(size, [(0.322, DESK_LINE), (1, DESK_LINE - 0.004), (1, 1), (0.248, 1)])
    mug_box = poly_mask(size, [(0.374, 0.774), (0.452, 0.774), (0.452, 0.93), (0.374, 0.93)])
    papers = poly_mask(size, [(0.915, 0.81), (1, 0.81), (1, 0.9), (0.915, 0.9)])
    # The lid is an opaque object, so its polygon is the mask (difference keying misses its pale reflections)
    lid = poly_mask(size, [(0.768, 0.842), (0.797, 0.621), (0.946, 0.619), (0.936, 0.893), (0.773, 0.94)])
    not_chair = (M[..., 0] - M[..., 1] < 45).astype(np.float32)  # the red chair sits right behind the mug
    mug = soft(mug_box * fg * not_chair)
    desk_alpha = soft(surface, grow=0, feather=1)  # the wood itself is solid
    desk_alpha = np.maximum(desk_alpha, mug)
    desk_alpha = np.maximum(desk_alpha, soft(papers * fg))
    lid_soft = soft(lid, grow=0, feather=1.5)
    desk_alpha = np.clip(np.maximum(desk_alpha, lid_soft), 0, 1)
    desk_rgb = M * (1 - lid_soft[..., None]) + P4 * lid_soft[..., None]  # sticker lid instead of the logo

    # ---- Character layer: person + chair, behind the desk ----
    body_box = poly_mask(size, [(0.42, 0.14), (0.8, 0.14), (0.8, DESK_LINE + 0.002), (0.42, DESK_LINE + 0.002)])
    body = fg * body_box * (1 - lid_soft) * (1 - mug)
    # Fine edges come from the difference; the inside is filled solid so dark hoodie areas
    # that happen to match the racks behind them don't turn see-through.
    hard = Image.fromarray(((body > 0.5) * 255).astype(np.uint8))
    closed = hard.filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.MinFilter(31))
    inside = np.asarray(closed.filter(ImageFilter.MinFilter(9)), dtype=np.float32) / 255
    char_alpha = np.maximum(soft(body, grow=2, feather=1.2), inside * body_box * (1 - lid_soft) * (1 - mug))
    char_rgb = M.copy()
    # Extend the body ~6% below the desk line by repeating the last visible row.
    # The desk hides it at rest; it only shows if the layers drift apart, and then it reads as hoodie, not a hole.
    line = int(DESK_LINE * h)
    ext = int(0.06 * h)
    char_rgb[line:line + ext] = char_rgb[line - 1]
    char_alpha[line:line + ext] = char_alpha[line - 1]

    save_layer(desk_rgb.astype(np.uint8), desk_alpha, "layer-desk")
    save_layer(char_rgb.astype(np.uint8), char_alpha, "layer-character")
    plate.save(HERO / "layer-room.webp", quality=88, method=6)
    for n in ("layer-room", "layer-character", "layer-desk"):
        print(n, f"{(HERO / f'{n}.webp').stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
