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

# ---- menu icons (module screen: categories, search, lock, arrows) ----
def ring(d, cx, cy, r, w=W): d.ellipse(P(cx - r, cy - r, cx + r, cy + r), outline=255, width=w)
def dot(d, cx, cy, r): d.ellipse(P(cx - r, cy - r, cx + r, cy + r), fill=255)
# All: a 2x2 grid of rounded tiles
im, d = canvas()
for x, y in ((18, 18), (70, 18), (18, 70), (70, 70)): d.rounded_rectangle(P(x, y, x + 40, y + 40), radius=10 * K, outline=255, width=W)
save(im, "grid")
# Player: head and shoulders
im, d = canvas(); ring(d, 64, 42, 22); d.arc(P(22, 76, 106, 160), 180, 360, fill=255, width=W); save(im, "user")
# Color & Rendering: a droplet
im, d = canvas(); pts = []
for i in range(0, 361, 3):
    a = math.radians(i); r = 34
    x, y = 64 + r * math.sin(a), 78 - r * math.cos(a)
    if 140 < i < 220: pass
    pts.append((x, y))
d.polygon([(v[0] * K, v[1] * K) for v in [(64, 12)] + [(64 + 34 * math.cos(math.radians(a)), 78 + 34 * math.sin(math.radians(a))) for a in range(-35, 216, 3)]], outline=255, fill=0, width=W)
d.line(P(64, 12, 36, 58), fill=255, width=W); d.line(P(64, 12, 92, 58), fill=255, width=W)
d.arc(P(30, 44, 98, 112), -35, 215, fill=255, width=W); save(im, "droplet")
# Information: i in a circle
im, d = canvas(); ring(d, 64, 64, 50); dot(d, 64, 38, 7); d.line(P(64, 56, 64, 92), fill=255, width=W + 2 * K); save(im, "info")
# Cosmetics: sparkles
im, d = canvas()
def spark(cx, cy, r):
    pts = []
    for i in range(8):
        a = math.radians(i * 45 - 90); rr = r if i % 2 == 0 else r * 0.28
        pts.append(((cx + rr * math.cos(a)) * K, (cy + rr * math.sin(a)) * K))
    d.polygon(pts, fill=255)
spark(54, 70, 44); spark(98, 30, 20); save(im, "sparkles")
# World & Sky: a crescent moon and a star
im, d = canvas(); d.ellipse(P(14, 18, 106, 110), fill=255); d.ellipse(P(42, 6, 126, 90), fill=0); spark(98, 98, 14); save(im, "moon")
# Totems: the totem silhouette (head, arms, body)
im, d = canvas(); d.rounded_rectangle(P(42, 10, 86, 50), radius=8 * K, outline=255, width=W); d.rounded_rectangle(P(14, 58, 114, 76), radius=8 * K, fill=255)
d.rounded_rectangle(P(42, 58, 86, 118), radius=8 * K, outline=255, width=W); dot(d, 56, 30, 5); dot(d, 72, 30, 5); save(im, "totem")
# Player Visuals: a shirt
im, d = canvas(); d.polygon(P(40, 14, 88, 14, 120, 40, 104, 60, 92, 52, 92, 116, 36, 116, 36, 52, 24, 60, 8, 40), outline=255, fill=0, width=W)
d.line(P(40, 14, 120, 40), fill=0, width=1); d.line(P(40, 14, 8, 40), fill=255, width=W); d.line(P(88, 14, 120, 40), fill=255, width=W)
d.line(P(120, 40, 104, 60), fill=255, width=W); d.line(P(8, 40, 24, 60), fill=255, width=W); d.line(P(24, 60, 36, 52), fill=255, width=W); d.line(P(104, 60, 92, 52), fill=255, width=W)
d.line(P(36, 52, 36, 116), fill=255, width=W); d.line(P(92, 52, 92, 116), fill=255, width=W); d.line(P(36, 116, 92, 116), fill=255, width=W)
d.arc(P(48, 2, 80, 30), 20, 160, fill=255, width=W); save(im, "shirt")
# Particles & Effects: scattered dots of different sizes
im, d = canvas()
for cx, cy, r in ((40, 40, 14), (88, 30, 9), (76, 76, 18), (32, 92, 8), (104, 100, 7), (60, 112, 5)): dot(d, cx, cy, r)
save(im, "dots")
# Animations: a film frame with a play triangle
im, d = canvas(); d.rounded_rectangle(P(10, 22, 118, 106), radius=14 * K, outline=255, width=W); d.polygon(P(52, 44, 52, 84, 86, 64), fill=255); save(im, "film")
# Locked: a padlock
im, d = canvas(); d.rounded_rectangle(P(22, 56, 106, 118), radius=12 * K, fill=255); d.arc(P(38, 14, 90, 84), 180, 360, fill=255, width=W); d.line(P(38, 49, 38, 60), fill=255, width=W); d.line(P(90, 49, 90, 60), fill=255, width=W)
d.ellipse(P(57, 75, 71, 89), fill=0); d.line(P(64, 82, 64, 100), fill=0, width=5 * K); save(im, "lock")
# Search: a magnifier
im, d = canvas(); ring(d, 54, 54, 34, 11 * K); d.line(P(80, 80, 112, 112), fill=255, width=13 * K); save(im, "search")
# Settings gear
im, d = canvas()
for i in range(8):
    a = math.radians(i * 45); cx, cy = 64 + 46 * math.cos(a), 64 + 46 * math.sin(a); d.ellipse(P(cx - 11, cy - 11, cx + 11, cy + 11), fill=255)
dot(d, 64, 64, 42); d.ellipse(P(46, 46, 82, 82), fill=0); save(im, "gear")
# Arrows: back (chevron left) and a down chevron
im, d = canvas(); d.line(P(80, 20, 40, 64), fill=255, width=12 * K); d.line(P(40, 64, 80, 108), fill=255, width=12 * K); dot(d, 40, 64, 6); save(im, "back")
im, d = canvas(); d.line(P(24, 46, 64, 86), fill=255, width=12 * K); d.line(P(64, 86, 104, 46), fill=255, width=12 * K); dot(d, 64, 86, 6); save(im, "chevron")
# HUD editor: a move cross
im, d = canvas(); d.line(P(64, 12, 64, 116), fill=255, width=W); d.line(P(12, 64, 116, 64), fill=255, width=W)
for a in (0, 90, 180, 270):
    r = math.radians(a); tip = (64 + 52 * math.cos(r), 64 + 52 * math.sin(r)); L = 18
    for s in (-1, 1):
        b = r + math.pi + s * math.radians(40); d.line(P(tip[0], tip[1], tip[0] + L * math.cos(b), tip[1] + L * math.sin(b)), fill=255, width=W)
save(im, "move")
print("icons:", sorted(os.listdir(OUT)))
