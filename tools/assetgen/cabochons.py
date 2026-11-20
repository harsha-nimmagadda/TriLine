"""Cut round gemstone cabochons out of a flat-lay sheet (Pillow only).

The model is asked for a photo of many separate round stones on a plain grey background. Stones are found by
saturation (stones are strongly coloured, the background and the soft contact shadows are grey), grouped into
connected components, and each is cut with a fitted CIRCULAR mask (the pieces are round, so no
background-removal model is needed).
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


def _saturation(img: Image.Image) -> Image.Image:
    return img.convert("HSV").getchannel("S")


def find_stones(img: Image.Image, work: int = 384, sat_thresh: int = 70, min_area_frac: float = 0.0015):
    """Return [(cx, cy, r)] in full-resolution pixels for stones that are separate from each other and the border."""
    scale = work / max(img.size)
    small = img.convert("RGB").resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    sat = _saturation(small)
    mask = sat.point(lambda v: 255 if v > sat_thresh else 0)
    # close pinholes (white veins / highlights inside a stone) and drop specks
    mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    w, h = mask.size
    px = mask.load()
    seen = bytearray(w * h)
    comps = []
    for y in range(h):
        for x in range(w):
            if px[x, y] and not seen[y * w + x]:
                stack = [(x, y)]
                seen[y * w + x] = 1
                n = 0
                sx = sy = 0
                minx = maxx = x
                miny = maxy = y
                while stack:
                    cx, cy = stack.pop()
                    n += 1
                    sx += cx
                    sy += cy
                    minx, maxx = min(minx, cx), max(maxx, cx)
                    miny, maxy = min(miny, cy), max(maxy, cy)
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not seen[ny * w + nx]:
                            seen[ny * w + nx] = 1
                            stack.append((nx, ny))
                comps.append((n, sx / n, sy / n, minx, miny, maxx, maxy))
    areas = sorted(c[0] for c in comps if c[0] > w * h * min_area_frac)
    if not areas:
        return []
    med = areas[len(areas) // 2]
    stones = []
    for n, cx, cy, x0, y0, x1, y1 in comps:
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        if n < med * 0.55 or n > med * 1.8:
            continue  # a speck, a merged blob, or a stone from a different scale
        if x0 <= 1 or y0 <= 1 or x1 >= w - 2 or y1 >= h - 2:
            continue  # touches the sheet border (cut off)
        if max(bw, bh) / max(1, min(bw, bh)) > 1.3:
            continue  # elongated: probably two merged stones
        if n / (bw * bh) < 0.62:
            continue  # not roundish
        r = math.sqrt(n / math.pi)
        stones.append((cx / scale, cy / scale, r / scale))
    return stones


def cut_circle(img: Image.Image, cx: float, cy: float, r: float, size: int = 512, margin: float = 0.07, shrink: float = 0.97) -> Image.Image:
    """Square RGBA crop around the stone with a feathered circular alpha."""
    half = r * (1 + margin)
    crop = img.convert("RGB").crop((round(cx - half), round(cy - half), round(cx + half), round(cy + half)))
    crop = crop.resize((size * 2, size * 2), Image.LANCZOS)
    mask = Image.new("L", (size * 2, size * 2), 0)
    rr = size * shrink / (1 + margin)  # radius in 2x px = size*2/2 * shrink/(1+margin)
    c = size
    ImageDraw.Draw(mask).ellipse([c - rr, c - rr, c + rr, c + rr], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(2.2)).resize((size, size), Image.LANCZOS)
    out = crop.resize((size, size), Image.LANCZOS).convert("RGBA")
    out.putalpha(mask)
    return out


def extract(sheet_path: Path, out_dir: Path, prefix: str, size: int = 512, **kw) -> list[Path]:
    img = Image.open(sheet_path).convert("RGB")
    stones = find_stones(img, **kw)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, (cx, cy, r) in enumerate(stones):
        p = out_dir / f"{prefix}_{i:02d}.png"
        cut_circle(img, cx, cy, r, size).save(p)
        paths.append(p)
    return paths


def find_single(img: Image.Image, work: int = 512, sat_thresh: int = 60):
    """(cx, cy, r) in full-res px of the single stone in the frame (largest saturated blob), or None."""
    scale = work / max(img.size)
    small = img.convert("RGB").resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    mask = _saturation(small).point(lambda v: 255 if v > sat_thresh else 0)
    mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MinFilter(3))
    bbox = mask.getbbox()
    if not bbox:
        return None
    x0, y0, x1, y1 = bbox
    w, h = x1 - x0, y1 - y0
    area = sum(1 for v in mask.getdata() if v) if False else None  # noqa
    return ((x0 + x1) / 2 / scale, (y0 + y1) / 2 / scale, (w + h) / 4 / scale, w / max(1, h))
