"""Deterministic compositor for the carved-granite board (Pillow only, no numpy).

Renders the board from the GAME GEOMETRY (24 points, 3 squares, midpoint cross lines - the same
coordinates as src/engine/board.ts / boardView.ts: a 600x600 SVG viewBox, points at 60/140/220 .. 540)
so the image aligns exactly with the app's SVG coordinate system. Only the *materials* come from the
diffusion model (black granite, chiselled beige stone); the carving, lighting and shadows are procedural.

Light comes from the upper left. Surfaces are described by a depth map D (0 = top surface, 255 = deepest):
V-grooves along every line, round cup holes at the points, and a bevelled frame. Shading is the
directional derivative of D along the light direction, so the wall facing the light is lit and the
opposite wall is in shadow.
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps

SIZE_UNITS = 600.0
CELL = 80.0
CENTRE = 300.0


def point_xy(p: int) -> tuple[float, float]:
    """Mirror of pointGrid()/pointXY(): ring*8+pos, pos clockwise from top-left, grid -3..3."""
    ring, pos = divmod(p, 8)
    d = 3 - ring
    table = [(-d, -d), (0, -d), (d, -d), (d, 0), (d, d), (0, d), (-d, d), (-d, 0)]
    gx, gy = table[pos]
    return CENTRE + gx * CELL, CENTRE + gy * CELL


def board_segments() -> list[tuple[tuple[float, float], tuple[float, float]]]:
    segs = []
    for ring in range(3):
        a, c = point_xy(ring * 8), point_xy(ring * 8 + 4)
        b, d = (c[0], a[1]), (a[0], c[1])
        segs += [(a, b), (b, c), (c, d), (d, a)]
    for pos in (1, 3, 5, 7):
        segs.append((point_xy(pos), point_xy(16 + pos)))
    return segs


DEFAULTS = dict(
    size=2048,
    groove_width=9.0,    # units, at the surface
    groove_depth=200,
    cup_radius=20.5,     # units
    cup_depth=235,
    cup_darkness=0.7,
    cup_light_gain=3.2,
    cup_rim_depth=70,
    frame_inset=26.0,    # units from the slab edge to the frame centre-line
    frame_width=15.0,
    light=(-1.0, -1.0),  # direction TOWARDS the light (upper left)
)


def _scale(size: int) -> float:
    return size / SIZE_UNITS


def groove_depth_map(opts: dict) -> tuple[Image.Image, Image.Image, Image.Image, Image.Image]:
    """Depth map D ('L'): V-grooves, cups, bevelled frame and slab chamfer."""
    size, s = opts["size"], _scale(opts["size"])
    d_lines = Image.new("L", (size, size), 0)
    dr = ImageDraw.Draw(d_lines)
    steps = 14
    w0 = opts["groove_width"] * s
    for i in range(steps):
        w = max(1, round(w0 * (1 - i / steps)))
        v = round(opts["groove_depth"] * (i + 1) / steps)
        for (x1, y1), (x2, y2) in board_segments():
            dr.line([(x1 * s, y1 * s), (x2 * s, y2 * s)], fill=v, width=w)
            for (x, y) in ((x1, y1), (x2, y2)):
                dr.ellipse([x * s - w / 2, y * s - w / 2, x * s + w / 2, y * s + w / 2], fill=v)
    # cup holes: smooth spherical bowl (steep near the rim) from a radial gradient - avoids the stair-step
    # artefacts that nested ellipses give in the derivative shading
    d_cups = Image.new("L", (size, size), 0)
    r0 = opts["cup_radius"] * s
    diam = max(8, round(r0 * 2))
    grad = Image.radial_gradient("L").resize((diam, diam), Image.BICUBIC)  # 0 centre -> 255 at the rim
    rim = opts["cup_rim_depth"]
    bowl = grad.point(lambda v: round(rim + (opts["cup_depth"] - rim) * max(0.0, 1 - (v / 255.0) ** 1.5)))
    circle = Image.new("L", (diam, diam), 0)
    ImageDraw.Draw(circle).ellipse([0, 0, diam - 1, diam - 1], fill=255)
    bowl_mask = circle.filter(ImageFilter.GaussianBlur(0.6))
    for p in range(24):
        x, y = point_xy(p)
        box = (round(x * s - diam / 2), round(y * s - diam / 2))
        patch = d_cups.crop((box[0], box[1], box[0] + diam, box[1] + diam))
        patch = ImageChops.lighter(patch, ImageChops.multiply(bowl, bowl_mask.point(lambda v: v)).point(lambda v: v) if False else Image.composite(bowl, patch, bowl_mask))
        d_cups.paste(patch, box)
    # grooves stop at the cup rim (the cup defines its own interior)
    cup_area = Image.new("L", (size, size), 0)
    ca = ImageDraw.Draw(cup_area)
    for p in range(24):
        x, y = point_xy(p)
        ca.ellipse([x * s - r0, y * s - r0, x * s + r0, y * s + r0], fill=255)
    d_lines = Image.composite(Image.new("L", (size, size), 0), d_lines, cup_area)
    # frame: bevelled channel with a flat chiselled bottom
    fw = opts["frame_width"] * s
    c = opts["frame_inset"] * s
    fsteps = 12
    d_frame = Image.new("L", (size, size), 0)
    df = ImageDraw.Draw(d_frame)
    for i in range(fsteps):
        w = fw * (1 - 0.55 * i / fsteps)
        v = round(opts["groove_depth"] * 0.8 * min(1.0, (i + 1) / (fsteps * 0.55)))
        outer = c - w / 2
        inner = c + w / 2
        df.rectangle([outer, outer, size - outer, size - outer], fill=v)
        df.rectangle([inner, inner, size - inner, size - inner], fill=0)
    # slab chamfer at the very edge
    d_edge = Image.new("L", (size, size), 0)
    de = ImageDraw.Draw(d_edge)
    cw = 6 * s
    for i in range(8):
        w = cw * (1 - i / 8)
        v = round(70 * (i + 1) / 8)
        de.rectangle([0, 0, size - 1, size - 1], outline=v, width=max(1, round(w)))
    cav = ImageChops.lighter(ImageChops.lighter(d_lines, d_cups), d_frame)
    d = ImageChops.lighter(cav, d_edge)
    blur = ImageFilter.GaussianBlur(1.1 * s / 3.4)
    return d.filter(blur), cav.filter(blur), cup_area.filter(ImageFilter.GaussianBlur(2.0 * s / 3.4)), d_cups.filter(ImageFilter.GaussianBlur(2.6 * s / 3.4))


def _clamp_point(v: float) -> int:
    return max(0, min(255, int(v)))


def shading_maps(d: Image.Image, opts: dict, gain: float = 1.0) -> tuple[Image.Image, Image.Image, Image.Image]:
    """Returns (lit, shadow, ao) 'L' maps. lit: 0..255 brightening; shadow: 255 = unshaded."""
    s = _scale(opts["size"])
    lx, ly = opts["light"]
    norm = math.hypot(lx, ly)
    ax, ay = -lx / norm, -ly / norm  # direction away from the light
    h = max(2, round(3.0 * s / 3.4))
    # central difference along the light direction, so the effect stays on the carved walls
    d_minus = ImageChops.offset(d, round(ax * h), round(ay * h))   # D(p - h*a)
    d_plus = ImageChops.offset(d, -round(ax * h), -round(ay * h))  # D(p + h*a)
    signed = ImageChops.add(d_minus, ImageOps.invert(d_plus), 2.0, 0)  # 127.5 + (D(p-ha) - D(p+ha))/2
    lit = signed.point(lambda v: _clamp_point((v - 128) * 7.0 * gain))
    shadow = signed.point(lambda v: 255 - _clamp_point((128 - v) * 16.0 * gain))
    # ambient occlusion: deep + narrow regions are darker
    ao_blur = d.filter(ImageFilter.GaussianBlur(7 * s / 3.4))
    ao = ao_blur.point(lambda v: 255 - _clamp_point(v * 0.55))
    return lit, shadow, ao


def _grade(img: Image.Image, brightness=1.0, contrast=1.0, color=1.0, tint=(1.0, 1.0, 1.0)) -> Image.Image:
    img = ImageEnhance.Brightness(img).enhance(brightness)
    img = ImageEnhance.Contrast(img).enhance(contrast)
    img = ImageEnhance.Color(img).enhance(color)
    r, g, b = img.split()
    r = r.point(lambda v: min(255, int(v * tint[0])))
    g = g.point(lambda v: min(255, int(v * tint[1])))
    b = b.point(lambda v: min(255, int(v * tint[2])))
    return Image.merge("RGB", (r, g, b))


def _fit(img: Image.Image, size: int) -> Image.Image:
    img = img.convert("RGB")
    s = max(size / img.width, size / img.height)
    if s != 1:
        img = img.resize((max(size, round(img.width * s)), max(size, round(img.height * s))), Image.LANCZOS)
    x, y = (img.width - size) // 2, (img.height - size) // 2
    return img.crop((x, y, x + size, y + size))


def light_gradient(size: int, cx=0.30, cy=0.22) -> Image.Image:
    """'L' image, bright near (cx, cy) falling off to the lower right."""
    g = Image.radial_gradient("L").resize((size * 2, size * 2), Image.BICUBIC)  # 0 centre -> 255 edge
    ox = int(size - cx * size)
    oy = int(size - cy * size)
    return ImageOps.invert(g.crop((ox, oy, ox + size, oy + size)))


def compose(granite_path: Path, chisel_path: Path, out_path: Path, **overrides) -> Path:
    opts = {**DEFAULTS, **overrides}
    size = opts["size"]
    s = _scale(size)

    d, d_cav, cup_mask, d_cups = groove_depth_map(opts)
    lit, shadow, ao = shading_maps(d, opts)
    # bowls are shallow: light them with a stronger response than the narrow grooves
    lit_c, shadow_c, _ = shading_maps(d_cups, opts, gain=opts['cup_light_gain'])
    lit = Image.composite(lit_c, lit, cup_mask)
    shadow = Image.composite(shadow_c, shadow, cup_mask)
    cavity = d_cav.point(lambda v: min(255, v * 6)).filter(ImageFilter.GaussianBlur(0.8))

    # ---- materials ---------------------------------------------------------------------------
    base = _fit(Image.open(granite_path), size)
    base = _grade(base, brightness=0.8, contrast=1.1, color=1.05, tint=(1.04, 1.0, 0.94))
    chisel = _fit(Image.open(chisel_path), size)
    chisel = _grade(chisel, brightness=0.6, contrast=1.6, color=0.9, tint=(1.0, 0.97, 0.92))

    # chisel stone is lit/shaded by the carving; the granite surface only gets a faint bevel response
    def shade(img: Image.Image, lit_gain: float, shadow_amt: float) -> Image.Image:
        sh = ImageChops.multiply(img, shadow.point(lambda v: int(255 - (255 - v) * shadow_amt)).convert('RGB'))
        brighten = ImageChops.multiply(img, lit.point(lambda v: int(v * lit_gain)).convert('RGB'))
        return ImageChops.add(sh, brighten)

    chisel_lit = shade(chisel, 1.1, 1.0)
    chisel_lit = ImageChops.multiply(chisel_lit, ao.convert('RGB'))
    # cup interiors read as shaded hollows: darker stone, the lit crescent comes from the shading
    cup_dark = chisel_lit.point(lambda v: int(v * opts['cup_darkness']))
    chisel_lit = Image.composite(cup_dark, chisel_lit, cup_mask)
    base_lit = shade(base, 0.55, 0.9)

    img = Image.composite(chisel_lit, base_lit, cavity)

    # ---- dust along the groove edges + inside ---------------------------------------------------------
    halo = cavity.filter(ImageFilter.GaussianBlur(6 * s / 3.4))
    halo = ImageChops.subtract(halo, cavity.filter(ImageFilter.GaussianBlur(1.5)))
    grain = chisel.convert("L").filter(ImageFilter.GaussianBlur(0.6)).point(lambda v: _clamp_point((v - 90) * 2.2))
    dust_a = ImageChops.multiply(halo.point(lambda v: int(v * 0.55)), grain)
    dust = Image.new("RGB", (size, size), (176, 160, 134))
    img = Image.composite(dust, img, dust_a)

    # ---- global look: warm side light, soft sheen, vignette ---------------------------------------------
    grad = light_gradient(size)
    warm = Image.merge("RGB", (
        grad.point(lambda v: int(150 + v * 0.40)),
        grad.point(lambda v: int(130 + v * 0.36)),
        grad.point(lambda v: int(104 + v * 0.30)),
    ))
    img = ImageChops.multiply(img, warm).point(lambda v: min(255, int(v * 1.55)))
    sheen = light_gradient(size, 0.2, 0.15).point(lambda v: int(max(0, v - 120) * 0.5))
    img = ImageChops.add(img, Image.merge("RGB", (sheen, sheen.point(lambda v: int(v * 0.92)), sheen.point(lambda v: int(v * 0.8)))))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    d.save(out_path.with_name(out_path.stem + "_depth.png"))
    return out_path


if __name__ == "__main__":
    import sys

    root = Path(__file__).resolve().parents[2] / "assets-src" / "granite"
    out = compose(root / "granite_base" / "master.png", root / "chisel" / "master.png", root / "board_composite.png",
                  size=int(sys.argv[1]) if len(sys.argv) > 1 else 2048)
    print("wrote", out)
