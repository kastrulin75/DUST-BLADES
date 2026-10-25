"""Measure how much bigger/smaller a character is drawn in each pose compared to idle.

Matches the same details (boots, belt, head, armour...) between idle.png and every
other pose with SIFT features and fits a similarity transform with RANSAC; the
transform's scale is the size ratio.

usage: python tools/measure_scale.py zombie skeleton ghost
prints e.g.  zombie/defeat  x1.47  (212 inliers)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'source', 'sprites')


def load(path):
    # PIL instead of cv2.imread: OpenCV can't open non-ASCII paths on Windows
    im = np.asarray(Image.open(path).convert('RGBA'))
    alpha = im[..., 3:4].astype(np.float32) / 255
    bg = np.full_like(im[..., :3], 128)
    rgb = (im[..., :3] * alpha + bg * (1 - alpha)).astype(np.uint8)
    mask = (im[..., 3] > 128).astype(np.uint8) * 255
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), mask


def measure(ref_path, path):
    sift = cv2.SIFT_create(nfeatures=4000)
    g1, m1 = load(ref_path)
    g2, m2 = load(path)
    k1, d1 = sift.detectAndCompute(g1, m1)
    k2, d2 = sift.detectAndCompute(g2, m2)
    if d1 is None or d2 is None:
        return None, 0
    matches = cv2.BFMatcher().knnMatch(d2, d1, k=2)
    good = [m for m, n in (p for p in matches if len(p) == 2) if m.distance < 0.75 * n.distance]
    if len(good) < 6:
        return None, len(good)
    src = np.float32([k2[m.queryIdx].pt for m in good])
    dst = np.float32([k1[m.trainIdx].pt for m in good])
    M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=4.0, maxIters=5000)
    if M is None:
        return None, 0
    # M maps pose -> idle; its scale is idle/pose, so the pose is drawn 1/s times idle size
    s = float(np.hypot(M[0, 0], M[1, 0]))
    n = int(inl.sum())
    if s < 1e-3 or n < 8:
        return None, n
    return 1.0 / s, n


if __name__ == '__main__':
    for char in sys.argv[1:]:
        d = os.path.join(SRC, char)
        ref = os.path.join(d, 'idle.png')
        for f in sorted(os.listdir(d)):
            if f == 'idle.png' or not f.endswith('.png'):
                continue
            ratio, n = measure(ref, os.path.join(d, f))
            print(f'{char}/{f[:-4]:8s}', 'x%.3f' % ratio if ratio else 'no match', f'({n} inliers)')
