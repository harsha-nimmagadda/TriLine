"""Geometry check for the img2img realism pass: do the carved lines and cup holes stay exactly in place?

Compares gradient-magnitude (edge) maps of the procedural composite and the diffusion output:
  * per cup hole: the (dx, dy) shift that maximises normalised cross-correlation in a window around the cup;
  * per groove segment: the same along windows sampled down the line (perpendicular shift matters);
  * new lines / holes: edge energy in the plain-granite region compared with the composite's own.
Everything is measured at the output resolution (1024 px for a 1024 render).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

import compose_granite as cg

MAXSHIFT = 7


def _gray(path: Path, size: int) -> np.ndarray:
    im = Image.open(path).convert("L").resize((size, size), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255.0


def _edges(g: np.ndarray) -> np.ndarray:
    b = cg.gauss(g, 1.3)
    gy, gx = np.gradient(b)
    return np.hypot(gx, gy)


def _ncc(a: np.ndarray, b: np.ndarray) -> float:
    a = a - a.mean()
    b = b - b.mean()
    d = float(np.sqrt((a * a).sum() * (b * b).sum()))
    return float((a * b).sum() / d) if d > 1e-9 else 0.0


def _best_shift(ref: np.ndarray, out: np.ndarray, cx: int, cy: int, hw: int, hh: int):
    n = ref.shape[0]
    a = ref[cy - hh: cy + hh, cx - hw: cx + hw]
    best = (-2.0, 0, 0)
    for dy in range(-MAXSHIFT, MAXSHIFT + 1):
        for dx in range(-MAXSHIFT, MAXSHIFT + 1):
            y0, x0 = cy - hh + dy, cx - hw + dx
            if y0 < 0 or x0 < 0 or y0 + 2 * hh > n or x0 + 2 * hw > n:
                continue
            v = _ncc(a, out[y0: y0 + 2 * hh, x0: x0 + 2 * hw])
            if v > best[0]:
                best = (v, dx, dy)
    return best


def check(composite: Path, output: Path, cavity: Path, size: int = 1024) -> dict:
    ref = _edges(_gray(composite, size))
    out = _edges(_gray(output, size))
    s = size / cg.SIZE_UNITS
    cav = np.asarray(Image.open(cavity).convert("L").resize((size, size), Image.LANCZOS), dtype=np.float32) / 255.0

    cup_res = []
    r = int(cg.DEFAULTS["cup_radius"] * s * 1.45)
    for p in range(24):
        x, y = cg.point_xy(p)
        cx, cy = int(round(x * s)), int(round(y * s))
        cx = min(max(cx, r + MAXSHIFT), size - r - MAXSHIFT)
        cy = min(max(cy, r + MAXSHIFT), size - r - MAXSHIFT)
        ncc, dx, dy = _best_shift(ref, out, cx, cy, r, r)
        cup_res.append((ncc, dx, dy))

    line_res = []
    for (a, b) in cg.board_segments():
        ax, ay, bx, by = a[0] * s, a[1] * s, b[0] * s, b[1] * s
        length = float(np.hypot(bx - ax, by - ay))
        horizontal = abs(by - ay) < abs(bx - ax)
        k = max(1, int(length // 90))
        for i in range(k):
            t = (i + 0.5) / k
            cx, cy = int(ax + (bx - ax) * t), int(ay + (by - ay) * t)
            # skip windows dominated by a cup
            if min(np.hypot(cx - px * s, cy - py * s) for px, py in map(cg.point_xy, range(24))) < cg.DEFAULTS["cup_radius"] * s * 2.1:
                continue
            hw, hh = (30, 18) if horizontal else (18, 30)
            cx = min(max(cx, hw + MAXSHIFT), size - hw - MAXSHIFT)
            cy = min(max(cy, hh + MAXSHIFT), size - hh - MAXSHIFT)
            ncc, dx, dy = _best_shift(ref, out, cx, cy, hw, hh)
            line_res.append((ncc, dx, dy, horizontal))

    # new lines / holes: edge energy away from all carving
    from scipy_free_dilate import dilate  # local helper below (kept tiny to avoid scipy)
    plain = dilate(cav, 14) < 0.5
    e_ref = float(ref[plain].mean())
    e_out = float(out[plain].mean())
    # strongest edge responses in the plain region (a new groove would be a long strong edge)
    thr = float(np.percentile(ref[~plain], 90)) if (~plain).any() else 0.05
    strong_new = float((out[plain] > thr).mean()) / max(1e-9, float((ref[plain] > thr).mean()))

    def stats(res, perp=None):
        ncc = np.array([r[0] for r in res])
        if perp is None:
            sh = np.array([max(abs(r[1]), abs(r[2])) for r in res])
        else:
            sh = np.array([abs(r[2]) if r[3] else abs(r[1]) for r in res])
        return dict(n=len(res), ncc_mean=float(ncc.mean()), ncc_min=float(ncc.min()), max_shift_px=int(sh.max()), mean_shift_px=float(sh.mean()))

    return dict(
        cups=stats(cup_res),
        lines=stats(line_res, perp=True),
        plain_edge_energy_ratio=e_out / max(1e-9, e_ref),
        strong_edge_ratio=strong_new,
        global_ncc=_ncc(ref, out),
    )
