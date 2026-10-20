#!/usr/bin/env python3
"""Cuts the Auroras "A" emblem out of the launcher icon (build/icon.png) for the in-game main and pause menus: the emblem
square is cropped, and the dark background is turned into transparency by treating the artwork as light on black
(alpha = brightness above the background, colour un-premultiplied), so its glow stays soft on any backdrop.
Output: client-mod/adapters/mojmap/common/resources/assets/auroras_client/textures/gui/emblem.png (256 x 256).
Run: python3 scripts/make-emblem.py   (needs Pillow; the result is committed)."""
import os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "build", "icon.png")
OUT = os.path.join(ROOT, "client-mod", "adapters", "mojmap", "common", "resources", "assets", "auroras_client", "textures", "gui", "emblem.png")
im = Image.open(SRC).convert("RGB").crop((92, 42, 428, 378)).resize((256, 256), Image.LANCZOS)
out = Image.new("RGBA", im.size)
src, dst = im.load(), out.load()
for y in range(im.size[1]):
    for x in range(im.size[0]):
        r, g, b = src[x, y]
        # the background is about (1, 4, 13); anything up to a little above it is fully transparent
        a = max(0.0, min(1.0, (max(r - 8, g - 16, b - 34) / 255.0) * 1.4))
        # fade out toward the square's edges, so no faint box of background glow shows around the emblem
        edge = min(x, y, im.size[0] - 1 - x, im.size[1] - 1 - y) / (im.size[0] * 0.10)
        a *= min(1.0, edge) ** 2
        if a < 0.02: dst[x, y] = (0, 0, 0, 0); continue
        dst[x, y] = (min(255, round(r / a)), min(255, round(g / a)), min(255, round(b / a)), round(a * 255))
out.save(OUT, optimize=True)
print("wrote", OUT)
