#!/usr/bin/env python3
"""Bakes the in-game font: Inter (SIL Open Font License, github.com/rsms/inter) rendered by FreeType into one
anti-aliased glyph atlas plus metrics, for the Auroras menus. Minecraft draws the atlas 1:1 at the screen's real pixel
size, so text is as crisp as the desktop launcher's. Output (bundled into every mod build):
  visuals/font/auroras-font.png   white glyphs with alpha
  visuals/font/auroras-font.json  per weight and pixel size: ascent, line height, glyph boxes and advances
Run: python3 scripts/bake-font.py   (needs Pillow; the result is committed, so builds don't need it)."""
import json, os
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TTF = os.path.join(ROOT, "client-mod", "fonts", "InterVariable.ttf")
OUT = os.path.join(ROOT, "visuals", "font")
WEIGHTS = {"medium": b"Medium", "semibold": b"SemiBold"}
# Pixel sizes the menus ask for (GUI sizes 7, 8, 9 and 11 at GUI scales 1 to 4, plus a few in between).
SIZES = [7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 21, 22, 24, 27, 28, 32, 33, 36, 44]
CHARS = [chr(c) for c in range(32, 127)] + list("…·°“”‘’×—–")
ATLAS_W = 2048
glyphs, x, y, row_h, images = {}, 1, 1, 0, []
for wname, var in WEIGHTS.items():
    glyphs[wname] = {}
    for size in SIZES:
        f = ImageFont.truetype(TTF, size); f.set_variation_by_name(var)
        asc, desc = f.getmetrics()
        g = {"ascent": asc, "descent": desc, "lineHeight": round(size * 1.2), "glyphs": {}}
        for ch in CHARS:
            adv = f.getlength(ch); x0, y0, x1, y1 = f.getbbox(ch, anchor="ls")
            gw, gh = max(0, x1 - x0) + 2, max(0, y1 - y0) + 2
            if ch == " " or x1 <= x0: g["glyphs"][str(ord(ch))] = [0, 0, 0, 0, 0, 0, round(adv, 3)]; continue
            if x + gw + 1 > ATLAS_W: x, y, row_h = 1, y + row_h + 1, 0
            im = Image.new("L", (gw, gh), 0); ImageDraw.Draw(im).text((1 - x0, 1 - y0), ch, font=f, fill=255, anchor="ls")
            images.append((x, y, im)); g["glyphs"][str(ord(ch))] = [x, y, gw, gh, x0 - 1, y0 - 1, round(adv, 3)]
            x += gw + 1; row_h = max(row_h, gh)
        glyphs[wname][str(size)] = g
H = 1
while H < y + row_h + 2: H *= 2
atlas = Image.new("LA", (ATLAS_W, H), (255, 0))
for gx, gy, im in images: atlas.paste(Image.merge("LA", (Image.new("L", im.size, 255), im)), (gx, gy))
os.makedirs(OUT, exist_ok=True)
atlas.convert("RGBA").save(os.path.join(OUT, "auroras-font.png"), optimize=True)
json.dump({"schema": 1, "font": "Inter (SIL OFL 1.1, github.com/rsms/inter)", "atlas": {"w": ATLAS_W, "h": H}, "weights": glyphs},
          open(os.path.join(OUT, "auroras-font.json"), "w"), separators=(",", ":"))
print("atlas", ATLAS_W, "x", H, "glyphs", len(images))
