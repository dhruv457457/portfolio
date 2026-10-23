"""Turn the generated art (in art/, never deployed) into the web assets in site/assets.

- hero.png → hero.webp, plus the social preview og.jpg (1200×630)
- icons-sheet.png (3×2 grid on magenta) → icon-<name>.png, magenta keyed out, trimmed, crisp pixels
- the lantern icon → favicon.png and apple-touch-icon.png
- campers-sheet.png → camper-1..4.png;  me-sheet.png → me-portrait.png, me-full.png

Usage: python tools/prep_site_assets.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "art"  # generated sources: big, kept out of the deploy folder
ASSETS = ROOT / "site" / "assets"
NAMES = ["toolbox", "map", "trophy", "sprout", "campfire", "lantern"]


def main():
    hero = Image.open(ART / "hero.png").convert("RGB")
    hero.save(ASSETS / "hero.webp", quality=86, method=6)
    # Social preview: the hero cropped to 1200×630 around the valley and the fort
    w = hero.width
    h = round(w * 630 / 1200)
    top = round((hero.height - h) * 0.55)
    hero.crop((0, top, w, top + h)).resize((1200, 630), Image.LANCZOS).save(ASSETS / "og.jpg", quality=86, optimize=True)

    sheet = np.asarray(Image.open(ART / "icons-sheet.png").convert("RGB"), dtype=np.int16)
    h, w, _ = sheet.shape
    r, g, b = sheet[..., 0], sheet[..., 1], sheet[..., 2]
    magenta = (r > 180) & (b > 180) & (g < 120)
    alpha = np.where(magenta, 0, 255).astype(np.uint8)
    rgba = np.dstack([sheet.astype(np.uint8), alpha])

    for i, name in enumerate(NAMES):
        cx, cy = i % 3, i // 3
        cell = rgba[cy * h // 2:(cy + 1) * h // 2, cx * w // 3:(cx + 1) * w // 3]
        ys, xs = np.nonzero(cell[..., 3])
        crop = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        im = Image.fromarray(crop, "RGBA")
        # The art is ~11 screen px per pixel-art pixel; shrink with NEAREST to keep the pixels crisp
        scale = 160 / max(im.size)
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.NEAREST)
        im.save(ASSETS / f"icon-{name}.png", optimize=True)
        print(name, im.size)
        if name == "lantern":
            favicons(Image.fromarray(crop, "RGBA"))


def favicons(icon):
    """The pixel lantern, centred on a square, as the browser tab icon and the iPhone home-screen icon."""
    for size, name, bg in [(64, "favicon.png", None), (180, "apple-touch-icon.png", (245, 242, 234, 255))]:
        canvas = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
        scale = (size * 0.86) / max(icon.size)
        small = icon.resize((max(1, round(icon.width * scale)), max(1, round(icon.height * scale))), Image.NEAREST)
        canvas.alpha_composite(small, ((size - small.width) // 2, (size - small.height) // 2))
        canvas.save(ASSETS / name, optimize=True)


def campers():
    """Cut the 4 campers out of their magenta sheet and find each blank monitor screen."""
    import json
    sheet = np.asarray(Image.open(ART / "campers-sheet.png").convert("RGB"), dtype=np.int16)
    h, w, _ = sheet.shape
    r, g, b = sheet[..., 0], sheet[..., 1], sheet[..., 2]
    alpha = np.where((r > 180) & (b > 180) & (g < 120), 0, 255).astype(np.uint8)
    rgba = np.dstack([sheet.astype(np.uint8), alpha])
    screens = {}
    for i, name in enumerate(["camper-1", "camper-2", "camper-3", "camper-4"]):
        cx, cy = i % 2, i // 2
        cell = rgba[cy * h // 2:(cy + 1) * h // 2, cx * w // 2:(cx + 1) * w // 2]
        ys, xs = np.nonzero(cell[..., 3])
        crop = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        ch, cw = crop.shape[:2]
        cr, cg, cb = (crop[..., k].astype(np.int16) for k in range(3))
        cream = (cr > 225) & (cg > 212) & (cb > 170) & (crop[..., 3] > 0)
        cream[int(ch * 0.5):] = False  # the screen is in the top half
        sy, sx = np.nonzero(cream)
        screens[name] = [round(sx.min() / cw * 100, 1), round(sy.min() / ch * 100, 1),
                         round((sx.max() - sx.min()) / cw * 100, 1), round((sy.max() - sy.min()) / ch * 100, 1)]
        im = Image.fromarray(crop, "RGBA")
        scale = 220 / im.height
        im.resize((round(im.width * scale), 220), Image.NEAREST).save(ASSETS / f"{name}.png", optimize=True)
    print(json.dumps(screens))



def me():
    """Cut the pixel-art Dhruv sheet into a dialogue portrait and a full-body sprite."""
    sheet = np.asarray(Image.open(ART / "me-sheet.png").convert("RGB"), dtype=np.int16)
    h, w, _ = sheet.shape
    r, g, b = sheet[..., 0], sheet[..., 1], sheet[..., 2]
    alpha = np.where((r > 180) & (b > 180) & (g < 120), 0, 255).astype(np.uint8)
    rgba = np.dstack([sheet.astype(np.uint8), alpha])
    for name, x0, x1, height in [("me-portrait", 0, int(w * 0.55), 360), ("me-full", int(w * 0.55), w, 320)]:
        part = rgba[:, x0:x1]
        ys, xs = np.nonzero(part[..., 3])
        crop = Image.fromarray(part[ys.min():ys.max() + 1, xs.min():xs.max() + 1], "RGBA")
        scale = height / crop.height
        crop.resize((round(crop.width * scale), height), Image.NEAREST).save(ASSETS / f"{name}.png", optimize=True)
        print(name, crop.size)


if __name__ == "__main__":
    main()
    campers()
    me()
