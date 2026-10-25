"""Build everything in media/ (what the game loads) from the originals in source/.

source/sprites/<character>/<pose>.png  ->  media/sprites/<character>/<pose>.png (+ manifest.js)
source/images/*.png                    ->  media/images/ (backgrounds, logo, result screens)
source/icons/*.png                     ->  media/icons/  (64x64, only the icons the game uses)

Characters listed in ALIGNED have several poses: every pose is scaled and moved
into the coordinate space of the reference pose (idle), then all poses are written
onto one shared frame, so swapping poses in the game never makes the hero jump.
Characters in AUTO are aligned automatically by their feet (see AUTO below).
Writes media/sprites/manifest.js with frame sizes for the game.

usage: python tools/build_assets.py
"""
import json
import os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'source', 'sprites')
DST = os.path.join(ROOT, 'media', 'sprites')
IMG_SRC = os.path.join(ROOT, 'source', 'images')
IMG_DST = os.path.join(ROOT, 'media', 'images')
ICON_SRC = os.path.join(ROOT, 'source', 'icons')
ICON_DST = os.path.join(ROOT, 'media', 'icons')
# icons the game actually shows (the rest stay in source/ only)
USED_ICONS = ['armor', 'attack', 'close', 'delete', 'exit', 'exp', 'gold', 'heart', 'level',
              'potion', 'settings', 'shop', 'skull', 'strength', 'target', 'trophy', 'ult', 'wait']
MAX_SIDE = 560

# pose: (scale to reference, anchor point in the source image, where it lands in the reference)
# Anchor = head centre x on the ground line; scale measured from the head size in each picture.
ALIGNED = {
    'hero': {
        'reference': 'idle',
        'out_scale': 0.8,
        'poses': {
            'idle': (1.0, (325, 571), (325, 571)),
            'attack': (1.0, (325, 571), (325, 571)),
            'block': (1.0, (325, 571), (325, 571)),
            'damage': (1.0, (325, 571), (325, 571)),
            'win': (0.65, (382, 1023), (325, 571)),
            'defeat': (0.59, (480, 895), (325, 571)),
        },
        # square head crop for HUD / menu portraits, in reference coordinates
        'portrait': (232, 0, 412, 180),
        # effect pictures kept whole (same pixel scale as the poses); placed by CSS
        'extras': ['ult'],
    },
}


# Enemies: every pose is drawn at the same pixel scale, so they are aligned automatically by
# the centre of the feet (solid, non-white pixels in the lowest rows) on the ground line.
# out_scale brings every character to roughly the same on-screen pixel size.
# 'scale': some poses were generated bigger than idle; these factors shrink them back to the
# idle's size (measured from head/eye/boot sizes — see tools/measure_scale.py).
AUTO = {
    'zombie': {'out_scale': 0.8, 'scale': {'defeat': 0.79}},
    'skeleton': {'out_scale': 0.8, 'scale': {'defeat': 0.85}},
    # the ghost has no feet (just a wispy tail): align by the skull's x instead
    'ghost': {'out_scale': 0.8, 'scale': {'damage': 0.83},
              'anchor_x': {'idle': 222, 'attack': 387, 'damage': 415, 'win': 237, 'defeat': 275}},
    'death-knight': {'out_scale': 0.8},
}
POSE_ORDER = ['idle', 'attack', 'block', 'damage', 'defeat', 'win']
MANIFEST = {}


def load(path):
    return Image.open(path).convert('RGBA')


def solid_mask(im):
    """Opaque body pixels: ignores soft glows and the white swoosh of attack trails."""
    a = np.asarray(im)
    alpha = a[..., 3] > 200
    bright = a[..., :3].min(axis=2) > 205
    return alpha & ~bright


def feet_anchor(im):
    m = solid_mask(im)
    rows = np.where(m.any(axis=1))[0]
    if not len(rows):
        return im.width / 2, im.height
    top, bottom = rows[0], rows[-1]
    band = m[max(top, bottom - max(4, int((bottom - top) * 0.12))):bottom + 1]
    xs = np.where(band)[1]
    return float(xs.mean()), float(bottom + 1)


def build_auto(char, cfg):
    src_dir = os.path.join(SRC, char)
    poses = [p for p in POSE_ORDER if os.path.exists(os.path.join(src_dir, p + '.png'))]
    ref = poses[0]
    placed = {}
    manual = cfg.get('anchor_x', {})
    scales = cfg.get('scale', {})

    def load_pose(pose):
        im = load(os.path.join(src_dir, pose + '.png'))
        k = scales.get(pose, 1.0)
        if k != 1.0:
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        return im, k

    ref_im, ref_k = load_pose(ref)
    rax, ray = feet_anchor(ref_im)
    if ref in manual:
        rax = manual[ref] * ref_k
    for pose in poses:
        im, k = load_pose(pose)
        ax, ay = feet_anchor(im)
        if pose in manual:
            ax = manual[pose] * k
        placed[pose] = (im, rax - ax, ray - ay)
    x0 = min(ox for _, ox, _ in placed.values())
    y0 = min(oy for _, _, oy in placed.values())
    x1 = max(ox + im.width for im, ox, _ in placed.values())
    y1 = max(oy + im.height for im, _, oy in placed.values())
    fw, fh = round(x1 - x0), round(y1 - y0)
    k = cfg['out_scale']
    out_w, out_h = round(fw * k), round(fh * k)
    os.makedirs(os.path.join(DST, char), exist_ok=True)
    for pose, (im, ox, oy) in placed.items():
        frame = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        frame.alpha_composite(im, (round(ox - x0), round(oy - y0)))
        frame = frame.resize((out_w, out_h), Image.LANCZOS)
        out = os.path.join(DST, char, pose + '.png')
        frame.save(out, optimize=True)
        print(f'{char}/{pose}: frame {out_w}x{out_h}, {os.path.getsize(out) // 1024} KB')
    # tight crop of the idle pose for the "choose your enemy" cards
    card = load(os.path.join(src_dir, ref + '.png'))
    card = card.crop(card.getchannel('A').getbbox())
    cs = 360 / max(card.size)
    card = card.resize((round(card.width * cs), round(card.height * cs)), Image.LANCZOS)
    card.save(os.path.join(DST, char, 'card.png'), optimize=True)

    # idle body box and feet/body centres, as fractions of the shared frame
    idle, iox, ioy = placed[ref]
    m = solid_mask(idle)
    ys, xs = np.where(m)
    MANIFEST[char] = {
        'w': out_w, 'h': out_h,
        'poses': poses,
        'feetX': round((rax - x0) / fw, 4),
        'bodyX': round(float((xs.mean() + iox - x0) / fw), 4),
        'top': round(float((ys.min() + ioy - y0) / fh), 4),
        'ground': round((ray - y0) / fh, 4),
    }
    print(f'{char}: {MANIFEST[char]}')


def build_aligned(char, cfg):
    src_dir = os.path.join(SRC, char)
    placed = {}
    for pose, (scale, src_pt, ref_pt) in cfg['poses'].items():
        path = os.path.join(src_dir, pose + '.png')
        if not os.path.exists(path):
            continue
        im = load(path)
        if scale != 1.0:
            im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        ox = ref_pt[0] - src_pt[0] * scale
        oy = ref_pt[1] - src_pt[1] * scale
        placed[pose] = (im, ox, oy)

    # shared frame = union of every placed pose
    x0 = min(ox for _, ox, _ in placed.values())
    y0 = min(oy for _, _, oy in placed.values())
    x1 = max(ox + im.width for im, ox, _ in placed.values())
    y1 = max(oy + im.height for im, _, oy in placed.values())
    fw, fh = round(x1 - x0), round(y1 - y0)
    k = cfg['out_scale']
    out_w, out_h = round(fw * k), round(fh * k)

    os.makedirs(os.path.join(DST, char), exist_ok=True)
    for pose, (im, ox, oy) in placed.items():
        frame = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        frame.alpha_composite(im, (round(ox - x0), round(oy - y0)))
        frame = frame.resize((out_w, out_h), Image.LANCZOS)
        out = os.path.join(DST, char, pose + '.png')
        frame.save(out, optimize=True)
        print(f'{char}/{pose}: frame {out_w}x{out_h}, {os.path.getsize(out) // 1024} KB')

    ref_im, rox, roy = placed[cfg['reference']]
    ref_box = (rox - x0, roy - y0, rox - x0 + ref_im.width, roy - y0 + ref_im.height)
    print(f'{char}: reference pose box in frame (fractions) '
          f'x {ref_box[0] / fw:.3f}..{ref_box[2] / fw:.3f}, y {ref_box[1] / fh:.3f}..{ref_box[3] / fh:.3f}')

    for extra in cfg.get('extras', []):
        path = os.path.join(src_dir, extra + '.png')
        if not os.path.exists(path):
            continue
        im = load(path)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        # lots of soft semi-transparent pixels: WebP is several times lighter than PNG here
        out = os.path.join(DST, char, extra + '.webp')
        im.save(out, 'WEBP', quality=88, method=6)
        print(f'{char}/{extra}: {im.width}x{im.height}, {os.path.getsize(out) // 1024} KB (extra)')

    if 'portrait' in cfg:
        px0, py0, px1, py1 = cfg['portrait']
        idle = load(os.path.join(src_dir, cfg['reference'] + '.png'))
        por = idle.crop((px0, py0, px1, py1)).resize((160, 160), Image.LANCZOS)
        por.save(os.path.join(DST, char, 'portrait.png'), optimize=True)
        print(f'{char}/portrait: 160x160')


def build_simple(char):
    src_dir = os.path.join(SRC, char)
    os.makedirs(os.path.join(DST, char), exist_ok=True)
    for name in sorted(os.listdir(src_dir)):
        if not name.lower().endswith('.png'):
            continue
        im = load(os.path.join(src_dir, name))
        bbox = im.getchannel('A').getbbox()
        if bbox:
            im = im.crop(bbox)
        w, h = im.size
        s = MAX_SIDE / max(w, h)
        im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
        out = os.path.join(DST, char, name.lower())
        im.save(out, optimize=True)
        print(f'{char}/{name}: {im.size[0]}x{im.size[1]}, {os.path.getsize(out) // 1024} KB')


def fit(im, max_side):
    im = im.crop(im.getchannel('A').getbbox())
    k = max_side / max(im.size)
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)


def build_images():
    os.makedirs(IMG_DST, exist_ok=True)
    for name, side in [('logo', 640), ('victory', 900), ('lose', 900)]:
        fit(load(os.path.join(IMG_SRC, name + '.png')), side).save(os.path.join(IMG_DST, name + '.png'), optimize=True)
    # menu dungeon: darkened and the shadows deepened so the menu reads on top of it
    a = np.asarray(Image.open(os.path.join(IMG_SRC, 'bg.jpg')).convert('RGB')).astype(np.float32) / 255
    a = np.clip((a ** 1.15) * 0.62, 0, 1)
    Image.fromarray((a * 255 + .5).astype(np.uint8)).save(os.path.join(IMG_DST, 'bg_menu.jpg'), quality=88)
    # hardcore battle: night storm, used as is
    Image.open(os.path.join(IMG_SRC, 'hardcore.jpg')).convert('RGB').save(os.path.join(IMG_DST, 'hardcore.jpg'), quality=90)
    # battle desert (desert_dusk.jpg) is the first frame of its video: see tools/build_video.py
    print('images:', sorted(os.listdir(IMG_DST)))


def build_icons():
    os.makedirs(ICON_DST, exist_ok=True)
    for name in USED_ICONS:
        im = load(os.path.join(ICON_SRC, name + '.png'))
        im = im.crop(im.getchannel('A').getbbox())
        k = 64 / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.BOX)
        canvas = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        canvas.paste(im, ((64 - im.width) // 2, (64 - im.height) // 2))
        canvas.save(os.path.join(ICON_DST, name + '.png'), optimize=True)
    print('icons:', len(USED_ICONS))


build_images()
build_icons()

for char in sorted(os.listdir(SRC)):
    if not os.path.isdir(os.path.join(SRC, char)):
        continue
    if char in ALIGNED:
        build_aligned(char, ALIGNED[char])
    elif char in AUTO:
        build_auto(char, AUTO[char])
    else:
        build_simple(char)

# frame data the game uses to size and place each enemy (works from file:// too, no fetch needed)
with open(os.path.join(DST, 'manifest.js'), 'w', encoding='utf-8') as f:
    f.write('/* generated by tools/optimize_sprites.py — do not edit */' + chr(10))
    f.write('window.DUST_SPRITES = ' + json.dumps(MANIFEST, ensure_ascii=False, indent=1) + ';' + chr(10))
    # build stamp: appended to image URLs so browsers never show stale sprites after a rebuild
    import time
    f.write('window.DUST_SPRITES_V = ' + json.dumps(time.strftime('%Y%m%d%H%M%S')) + ';' + chr(10))
print('manifest:', sorted(MANIFEST))
