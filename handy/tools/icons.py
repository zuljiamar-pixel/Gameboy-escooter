#!/usr/bin/env python3
"""Schneidet aus tools/out/hero.png (von tools/icon.js) alle App-Icons zu.
    node tools/icon.js && python3 tools/icons.py        (braucht Pillow)"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, "..", "android", "app", "src", "main", "res")
STORE = os.path.join(HERE, "..", "store")
hero = Image.open(os.path.join(HERE, "out", "hero.png")).convert("RGB")
W = hero.width
# Bildausschnitt für das normale Icon: etwas näher am Fahrer
k = int(W * 0.14)
close = hero.crop((k - int(W * 0.04), k - int(W * 0.02), W - k - int(W * 0.04), W - k - int(W * 0.02)))


def mask(size, radius):
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius * 4, fill=255)
    return m.resize((size, size), Image.LANCZOS)


for name, px in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
    d = os.path.join(RES, "mipmap-" + name)
    im = close.resize((px, px), Image.LANCZOS).convert("RGBA")
    sq = im.copy()
    sq.putalpha(mask(px, px * 0.22))
    sq.save(os.path.join(d, "ic_launcher.png"))
    rd = im.copy()
    rd.putalpha(mask(px, px / 2))
    rd.save(os.path.join(d, "ic_launcher_round.png"))
    fg = px * 108 // 48                 # Vordergrund vom "adaptive icon": 108 dp
    hero.resize((fg, fg), Image.LANCZOS).save(os.path.join(d, "ic_launcher_foreground.png"))

close.resize((512, 512), Image.LANCZOS).save(os.path.join(STORE, "icon-512.png"))
print("Icons fertig")
