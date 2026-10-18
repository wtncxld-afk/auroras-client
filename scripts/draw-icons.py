#!/usr/bin/env python3
"""Draws the radial menu's section icons (original, simple line icons) as 128x128 white-on-transparent PNG masks in
visuals/icons. Drawn at 4x and downsampled for smooth edges; the mod resamples them again into each petal.
Run: python3 scripts/draw-icons.py (needs Pillow; the PNGs are committed)."""
import math, os
from PIL import Image, ImageDraw
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "visuals", "icons")
S, K = 128, 4
def canvas(): im = Image.new("L", (S * K, S * K), 0); return im, ImageDraw.Draw(im)
def save(im, name):
    small = im.resize((S, S), Image.LANCZOS); small.save(os.path.join(OUT, name + ".png"))
    # .a8 = the same mask as raw bytes (128x128 alpha, row by row), so the mod reads it without an image decoder
    open(os.path.join(OUT, name + ".a8"), "wb").write(small.tobytes())
W = 9 * K  # stroke
def P(*xy): return [v * K for v in xy]
os.makedirs(OUT, exist_ok=True)
# HUD: a screen with two readouts
im, d = canvas(); d.rounded_rectangle(P(14, 24, 114, 104), radius=16 * K, outline=255, width=W)
d.line(P(34, 50, 62, 50), fill=255, width=W); d.line(P(34, 72, 52, 72), fill=255, width=W); d.line(P(76, 80, 94, 80), fill=255, width=W); save(im, "hud")
# Visuals: an eye (outer lid shape filled, inner cut out, so the stroke has no seams)
im, d = canvas()
def lid(rx, ry):
    out = []
    for i in range(0, 360, 2):
        a = math.radians(i); out.append(((64 + rx * math.cos(a)) * K, (64 + ry * math.sin(a) * (1 - 0.18 * abs(math.cos(a)))) * K))
    return out
d.polygon(lid(56.5, 34.5), fill=255); d.polygon(lid(47.5, 25.5), fill=0)
d.ellipse(P(46, 46, 82, 82), outline=255, width=W); d.ellipse(P(58, 58, 70, 70), fill=255); save(im, "eye")
# Design: a palette with paint wells
im, d = canvas(); d.ellipse(P(14, 18, 114, 110), outline=255, width=W); d.ellipse(P(70, 70, 96, 96), fill=0, outline=255, width=W)
for cx, cy in ((42, 46), (64, 34), (88, 46), (38, 74)): d.ellipse(P(cx - 7, cy - 7, cx + 7, cy + 7), fill=255)
save(im, "palette")
# Settings: two sliders
im, d = canvas(); d.line(P(16, 44, 112, 44), fill=255, width=W); d.line(P(16, 86, 112, 86), fill=255, width=W)
for cx, cy in ((44, 44), (84, 86)): d.ellipse(P(cx - 14, cy - 14, cx + 14, cy + 14), fill=0, outline=255, width=W)
save(im, "sliders")
# Utility: a wrench
im, d = canvas(); d.line(P(36, 92, 74, 54), fill=255, width=14 * K); d.ellipse(P(30, 86, 42, 98), fill=255)
d.ellipse(P(58, 18, 110, 70), fill=255); d.ellipse(P(76, 10, 104, 38), fill=0); d.rectangle(P(86, 6, 120, 30), fill=0)
d.ellipse(P(70, 34, 98, 62), fill=0); save(im, "wrench")
print("icons:", sorted(os.listdir(OUT)))
