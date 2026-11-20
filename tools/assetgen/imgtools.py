"""Pillow-only image helpers: seamless tiling, piece cutout, contact sheets."""
from __future__ import annotations

import math
from collections import Counter

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


# ---- textures -------------------------------------------------------------------------------

def _smooth_ramp(n: int) -> Image.Image:
    """1 x n 'L' image: 0 at both ends, 255 in the middle (raised-cosine)."""
    img = Image.new("L", (n, 1))
    img.putdata([int(255 * math.sin(math.pi * (i + 0.5) / n) ** 2) for i in range(n)])
    return img


def make_seamless(img: Image.Image) -> Image.Image:
    """Offset by half and cross-fade so the wrap-around edges are continuous.

    rolled = image shifted by (w/2, h/2): its own seams sit in the middle, where the mask keeps the
    original; at the borders the mask picks the rolled image, whose borders are the original's
    (continuous) interior. Check the result with `tile-preview`.
    """
    img = img.convert("RGB")
    w, h = img.size
    rolled = ImageChops.offset(img, w // 2, h // 2)
    mx = _smooth_ramp(w).resize((w, h))
    my = _smooth_ramp(h).rotate(90, expand=True).transpose(Image.FLIP_LEFT_RIGHT).resize((w, h))
    mask = ImageChops.multiply(mx, my)
    return Image.composite(img, rolled, mask)


def tile_preview(img: Image.Image, max_edge: int = 2048) -> Image.Image:
    """2x2 tiling of the texture, scaled to fit max_edge."""
    w, h = img.size
    sheet = Image.new("RGB", (w * 2, h * 2))
    for x in (0, w):
        for y in (0, h):
            sheet.paste(img.convert("RGB"), (x, y))
    scale = min(1.0, max_edge / max(sheet.size))
    if scale < 1:
        sheet = sheet.resize((round(sheet.width * scale), round(sheet.height * scale)), Image.LANCZOS)
    return sheet


# ---- pieces ---------------------------------------------------------------------------------

def r_ch(im): return im.getchannel('R')


def g_ch(im): return im.getchannel('G')


def b_ch(im): return im.getchannel('B')


def _border_colour(img: Image.Image) -> tuple[int, int, int]:
    px = img.convert("RGB").load()
    w, h = img.size
    pts = [px[x, 0] for x in range(0, w, 7)] + [px[x, h - 1] for x in range(0, w, 7)]
    pts += [px[0, y] for y in range(0, h, 7)] + [px[w - 1, y] for y in range(0, h, 7)]
    # most common quantised colour, then average the members
    q = Counter((r // 24, g // 24, b // 24) for r, g, b in pts).most_common(1)[0][0]
    members = [p for p in pts if (p[0] // 24, p[1] // 24, p[2] // 24) == q]
    return tuple(sum(c[i] for c in members) // len(members) for i in range(3))  # type: ignore[return-value]


def cutout_colour_key(img: Image.Image, tolerance: int = 60, feather: float = 1.6, magenta: bool = True) -> Image.Image:
    """Remove a flat background by colour distance from the border colour, flood-filled from the
    border (so same-coloured interior details survive), then erode + feather the alpha."""
    rgb = img.convert("RGB")
    key = _border_colour(rgb)
    # distance image: max channel difference
    solid = Image.new("RGB", rgb.size, key)
    diff = ImageChops.difference(rgb, solid)
    r, g, b = diff.split()
    dist = ImageChops.lighter(ImageChops.lighter(r, g), b)
    # foreground where distance exceeds tolerance
    fg = dist.point(lambda v: 255 if v > tolerance else 0)
    if magenta:
        # Dark magenta cast shadows are far from the flat key colour; treat anything clearly
        # magenta/pink (min(R,B) well above G) as background too.
        mag = ImageChops.subtract(ImageChops.darker(r_ch(rgb), b_ch(rgb)), g_ch(rgb)).point(lambda v: 255 if v > 8 else 0)
        fg = ImageChops.multiply(fg, ImageOps.invert(mag))
    # flood the background from every border pixel so only connected background is removed
    bg = fg.copy()
    w, h = bg.size
    marker = 128
    for x in range(w):
        for y in (0, h - 1):
            if bg.getpixel((x, y)) == 0:
                ImageDraw.floodfill(bg, (x, y), marker)
    for y in range(h):
        for x in (0, w - 1):
            if bg.getpixel((x, y)) == 0:
                ImageDraw.floodfill(bg, (x, y), marker)
    alpha = bg.point(lambda v: 0 if v == marker else 255)
    # fill pinholes inside the subject, then shrink 1px to drop key-colour fringe and feather
    alpha = alpha.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(feather))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def apply_mask(img: Image.Image, mask: Image.Image, feather: float = 1.0) -> Image.Image:
    """Use a model-produced mask (white = keep). Inverts automatically if the border is white."""
    m = mask.convert("L").resize(img.size, Image.LANCZOS)
    w, h = m.size
    edge = (m.getpixel((2, 2)) + m.getpixel((w - 3, 2)) + m.getpixel((2, h - 3)) + m.getpixel((w - 3, h - 3))) / 4
    if edge > 127:
        m = ImageOps.invert(m)
    m = m.filter(ImageFilter.GaussianBlur(feather))
    out = img.convert("RGBA")
    out.putalpha(m)
    return out


def crop_square(img: Image.Image, margin: float = 0.06, size: int | None = None) -> Image.Image:
    """Tight-crop to the alpha bounding box, pad to a square with a small margin, optionally resize."""
    box = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if box:
        img = img.crop(box)
    side = round(max(img.size) * (1 + 2 * margin))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    if size:
        canvas = canvas.resize((size, size), Image.LANCZOS)
    return canvas


# ---- contact sheet --------------------------------------------------------------------------

def contact_sheet(images: list[Image.Image], labels: list[str], thumb: int = 320, cols: int = 3) -> Image.Image:
    rows = math.ceil(len(images) / cols)
    pad = 10
    sheet = Image.new("RGB", (cols * (thumb + pad) + pad, rows * (thumb + pad + 18) + pad), (40, 40, 44))
    d = ImageDraw.Draw(sheet)
    for i, (im, label) in enumerate(zip(images, labels)):
        t = im.copy()
        t.thumbnail((thumb, thumb), Image.LANCZOS)
        x = pad + (i % cols) * (thumb + pad)
        y = pad + (i // cols) * (thumb + pad + 18)
        bgtile = Image.new("RGB", t.size, (90, 90, 96))
        if t.mode == "RGBA":
            bgtile.paste(t, mask=t.getchannel("A"))
        else:
            bgtile.paste(t.convert("RGB"))
        sheet.paste(bgtile, (x, y))
        d.text((x + 2, y + t.height + 3), label, fill=(240, 240, 240))
    return sheet
