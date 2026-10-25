"""Make web-sized copies of the animated backdrops.

source/images/bg.mp4            ->  media/video/bg_menu.mp4     (menu dungeon, darkened)
source/images/desert_castle.mp4 ->  media/video/desert_dusk.mp4 (battle desert, dusk grade baked in)
The desert's first frame also becomes media/images/desert_dusk.jpg (shown until the video plays).

1920x1080, 30 fps, H.264, no sound (browsers only autoplay muted video).
Needs ffmpeg: either on PATH or from `pip install imageio-ffmpeg`.

usage: python tools/build_video.py [bg_menu] [desert_dusk]   (no names = both)
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'source', 'images')
DST = os.path.join(ROOT, 'media', 'video')
IMG = os.path.join(ROOT, 'media', 'images')

# same look as the still pictures made by build_assets.py
# videos whose still picture comes from the video itself (bg_menu.jpg is built by build_assets.py)
POSTER = {'desert_dusk'}

GRADES = {
    # (x ** 1.15) * 0.62
    'bg_menu': ('bg.mp4', 'eq=gamma=0.87,colorchannelmixer=.62:0:0:0:0:.62:0:0:0:0:.62'),
    # warm dusk: brightness .85, saturate .85, sepia .25, hue -8deg, contrast 1.05 folded into one matrix
    'desert_dusk': ('desert_castle.mp4',
                    'colorchannelmixer=0.6894:0.3155:-0.0257:0.0000:0.0852:0.7852:0.0644:0.0000:0.1445:0.1457:0.5931:0.0000,'
                    'lutrgb=r=val-6:g=val-6:b=val-6'),
}


def ffmpeg():
    exe = shutil.which('ffmpeg')
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def main():
    os.makedirs(DST, exist_ok=True)
    exe = ffmpeg()
    names = sys.argv[1:] or list(GRADES)
    for name in names:
        src, grade = GRADES[name]
        out = os.path.join(DST, name + '.mp4')
        subprocess.run([exe, '-y', '-v', 'error', '-i', os.path.join(SRC, src),
                        '-vf', 'scale=1920:1080:flags=lanczos,' + grade,
                        '-an', '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '27',
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30', out], check=True)
        if name not in POSTER:
            print(name, os.path.getsize(out) // 1024, 'KB')
            continue
        # the still picture shown until the video plays = its first frame
        subprocess.run([exe, '-y', '-v', 'error', '-i', out, '-frames:v', '1', '-q:v', '3',
                        os.path.join(IMG, name + '.jpg')], check=True)
        print(name, os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    main()
