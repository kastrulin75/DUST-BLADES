"""Make light-weight copies of the character art for the game.

media/sprites/<character>/<pose>.png  ->  media/px/sprites/<character>/<pose>.png
Each image is cropped to its visible pixels and scaled so its longest side is 560px.

usage: python tools/optimize_sprites.py
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'media', 'sprites')
DST = os.path.join(ROOT, 'media', 'px', 'sprites')
MAX_SIDE = 560

for char in sorted(os.listdir(SRC)):
    src_dir = os.path.join(SRC, char)
    if not os.path.isdir(src_dir):
        continue
    os.makedirs(os.path.join(DST, char), exist_ok=True)
    for name in sorted(os.listdir(src_dir)):
        if not name.lower().endswith('.png'):
            continue
        im = Image.open(os.path.join(src_dir, name)).convert('RGBA')
        bbox = im.getchannel('A').getbbox()
        if bbox:
            im = im.crop(bbox)
        w, h = im.size
        s = MAX_SIDE / max(w, h)
        im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
        out = os.path.join(DST, char, name.lower())
        im.save(out, optimize=True)
        print(f'{char}/{name}: {im.size[0]}x{im.size[1]}, {os.path.getsize(out) // 1024} KB')
