"""Deterministic compositor for the carved-granite board (numpy + Pillow).

Renders the board from the GAME GEOMETRY (24 points, 3 squares, midpoint cross lines - the same
coordinates as src/engine/board.ts / boardView.ts: a 600x600 SVG viewBox, points at 60/140/220 .. 540)
so the image aligns exactly with the app's SVG coordinate system.

What comes from the diffusion model: only the *materials* (low-frequency granite tone, the rough chiselled
stone texture). Everything else is procedural:
  * a height field (V-grooves with a crisp lip, spherical cup holes, a bevelled frame channel, a slab chamfer),
  * normal-based Lambert lighting from one warm low light in the upper left (cast shadow side is dark, lit side
    catches the light), ambient occlusion, dust,
  * fine gold/bronze/amber flecks and a few quartz points on near-black stone, a broad warm light gradient and a
    faint polished sheen.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

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
    seed=7,
    groove_width=9.0,      # units at the surface (lip to lip)
    groove_slope=0.95,     # depth/half-width: steeper = deeper V
    cup_radius=24.0,       # units
    cup_depth=40.0,        # px at 2048
    frame_inset=26.0,      # units from the slab edge to the channel centre-line
    frame_width=15.0,      # units
    frame_depth=13.0,      # px
    chamfer_px=16.0,       # slab edge bevel
    light=(-0.55, -0.55, 0.62),   # direction TOWARDS the light: upper left, low and warm
    ambient=0.22,
    rough=2.6,             # px of chisel roughness inside the carving
    fleck_density=0.0042,  # gold flecks per px^2 at 2048
    quartz_density=0.0006,
)


# ---- numpy helpers -------------------------------------------------------------------------------------

def gauss(a: np.ndarray, sigma: float) -> np.ndarray:
    """Gaussian blur by FFT (wraps at the borders - fine for our masks and noise)."""
    if sigma <= 0:
        return a
    h, w = a.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.rfftfreq(w)[None, :]
    k = np.exp(-2 * (math.pi * sigma) ** 2 * (fx * fx + fy * fy)).astype(np.float32)
    return np.fft.irfft2(np.fft.rfft2(a) * k, s=a.shape).astype(np.float32)


def noise(size: int, sigma: float, rng: np.random.Generator) -> np.ndarray:
    """Band-limited noise, zero mean, unit standard deviation."""
    n = gauss(rng.standard_normal((size, size)).astype(np.float32), sigma)
    return (n - n.mean()) / (n.std() + 1e-6)


def _luma(img: np.ndarray) -> np.ndarray:
    return (0.299 * img[..., 0] + 0.587 * img[..., 1] + 0.114 * img[..., 2]).astype(np.float32)


def _load(path: Path, size: int) -> np.ndarray:
    im = Image.open(path).convert("RGB")
    s = max(size / im.width, size / im.height)
    if s != 1:
        im = im.resize((max(size, round(im.width * s)), max(size, round(im.height * s))), Image.LANCZOS)
    x, y = (im.width - size) // 2, (im.height - size) // 2
    return np.asarray(im.crop((x, y, x + size, y + size)), dtype=np.float32) / 255.0


# ---- height field --------------------------------------------------------------------------------------

def _seg_dist(X, Y, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    t = np.clip(((X - ax) * dx + (Y - ay) * dy) / (dx * dx + dy * dy), 0, 1)
    return np.hypot(X - (ax + t * dx), Y - (ay + t * dy))


def height_fields(o: dict):
    """Returns dict of float32 arrays (px units, positive = deeper): lines, cups, frame, edge, plus cup_t."""
    n, s = o["size"], o["size"] / SIZE_UNITS
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    X, Y = xs + 0.5, ys + 0.5
    # grooves: V profile
    dist = np.full((n, n), 1e9, np.float32)
    for a, b in board_segments():
        dist = np.minimum(dist, _seg_dist(X, Y, (a[0] * s, a[1] * s), (b[0] * s, b[1] * s)))
    half = o["groove_width"] * s / 2
    lines = np.clip(half - dist, 0, None) * o["groove_slope"]
    # cups: shallow spherical hollow with a crisp vertical-ish rim
    cd = np.full((n, n), 1e9, np.float32)
    for p in range(24):
        x, y = point_xy(p)
        cd = np.minimum(cd, np.hypot(X - x * s, Y - y * s))
    r0 = o["cup_radius"] * s
    t = np.clip(cd / r0, 0, 1)
    cups = np.where(cd < r0, o["cup_depth"] * (1 - t ** 3.2) ** 0.5, 0).astype(np.float32)
    # grooves stop at the cup rim
    lines = np.where(cd < r0, 0, lines).astype(np.float32)
    # frame channel: trapezoid profile (chamfered walls, flat chiselled floor)
    q = np.maximum(np.abs(X - n / 2), np.abs(Y - n / 2))
    rf = (SIZE_UNITS / 2 - o["frame_inset"]) * s
    df = np.abs(q - rf)
    fw = o["frame_width"] * s / 2
    chamfer = fw * 0.38
    frame = np.clip((fw - df) / chamfer, 0, 1) * o["frame_depth"]
    # slab edge chamfer
    e = np.minimum(np.minimum(X, Y), np.minimum(n - X, n - Y))
    edge = np.clip(1 - e / o["chamfer_px"], 0, 1) * 7.0
    return dict(lines=lines, cups=cups, frame=frame.astype(np.float32), edge=edge.astype(np.float32), cd=cd, r0=r0)


def compose(granite_path: Path, chisel_path: Path, out_path: Path, **overrides) -> Path:
    o = {**DEFAULTS, **overrides}
    n, s = o["size"], o["size"] / SIZE_UNITS
    rng = np.random.default_rng(o["seed"])
    hf = height_fields(o)
    carve = np.maximum(np.maximum(hf["lines"], hf["cups"]), hf["frame"])  # cavity depth, px
    # crisp cavity mask (antialiased by one pixel)
    cav = np.clip(carve * 1.5, 0, 1).astype(np.float32)
    cav_edge = np.clip(hf["cd"] / hf["r0"], 0, 1)  # noqa: F841 (kept for debugging)

    # ---- chisel material -----------------------------------------------------------------------------
    chisel = _load(chisel_path, n)
    cl = _luma(chisel)
    cl_hp = cl - gauss(cl, 6 * s / 3.4)  # tool marks / grain
    cl_hp = cl_hp / (cl_hp.std() + 1e-6)
    # roughness only exists inside the carving; lips stay crisp
    depth = np.maximum(carve, hf["edge"]) + cav * o["rough"] * cl_hp * 0.55 + gauss(cav, 1.0) * cav * 0
    depth = gauss(depth.astype(np.float32), 0.7)

    # ---- normals + lighting --------------------------------------------------------------------------
    gy, gx = np.gradient(-depth)
    nz = 1.0 / np.sqrt(1 + gx * gx + gy * gy)
    nx, ny = -gx * nz, -gy * nz
    L = np.array(o["light"], np.float32)
    L = L / np.linalg.norm(L)
    lam = nx * L[0] + ny * L[1] + nz * L[2]
    rel = np.clip(lam / L[2], 0, 3)  # 1.0 on flat stone, >1 lit walls, ~0 shadowed walls

    # ambient occlusion: deep narrow places are darker
    ao = 1.0 - np.clip(gauss(carve, 9 * s / 3.4) / 9.0, 0, 0.62)
    ao *= 1.0 - np.clip(gauss(carve, 22 * s / 3.4) / 16.0, 0, 0.25)

    # ---- albedo of the carved stone: muted grey-beige ---------------------------------------------------
    gray = np.repeat(cl[..., None], 3, axis=2)
    alb = 0.45 * chisel + 0.55 * gray
    alb = (alb - 0.5) * 1.35 + 0.5
    alb = np.clip(alb * np.array([0.78, 0.74, 0.68], np.float32), 0, 1)  # darker, muted, slightly warm
    amb = o["ambient"]
    cav_light = amb + (1 - amb) * np.clip(rel, 0, 2.1)
    cupness = np.clip(1 - hf['cd'] / (hf['r0'] * 1.02), 0, 1)
    cup_shade = 1 - 0.28 * np.clip(cupness * 3, 0, 1)   # the hollows sit in a bit more shade
    carved = alb * (cav_light * ao * cup_shade)[..., None]
    # thin catch-light on faces turned towards the light
    spec = np.clip(rel - 1.12, 0, 1) ** 1.3 * 0.8
    carved = carved + spec[..., None] * np.array([0.9, 0.78, 0.55], np.float32)
    # soft dust collected in the low places and along the lit lip
    dust_n = np.clip(noise(n, 1.1 * s / 3.4, rng) * 0.5 + 0.35, 0, 1)
    low = np.clip(gauss(carve, 4 * s / 3.4) / 10.0, 0, 1)
    dust = (dust_n * low * 0.30)[..., None] * np.array([0.78, 0.68, 0.52], np.float32)
    carved = np.clip(carved + dust * ao[..., None], 0, 1)

    # ---- polished granite surface --------------------------------------------------------------------
    tex = _load(granite_path, n)
    tl = gauss(_luma(tex), 14 * s / 3.4)
    tl = (tl - tl.min()) / (tl.max() - tl.min() + 1e-6)
    tone = 0.7 + 0.7 * tl                      # slow tone variation from the generated texture
    green = np.clip(noise(n, 60 * s / 3.4, rng) * 0.5, -1, 1)   # some areas deeper black-green
    base = np.empty((n, n, 3), np.float32)
    base[..., 0] = 0.060 * tone * (1 - 0.18 * np.clip(green, 0, 1))
    base[..., 1] = 0.062 * tone * (1 + 0.05 * green)
    base[..., 2] = 0.068 * tone * (1 + 0.08 * np.clip(green, 0, 1))
    grain = noise(n, 0.8, rng) * 0.10 + noise(n, 2.2 * s / 3.4, rng) * 0.10
    base *= (1 + grain)[..., None]
    surf = base * (1 - cav)[..., None]

    # fine flecks (gold / bronze / amber) and a few quartz points
    fl = _flecks(n, s, o, rng)
    surf = surf * (1 - fl[..., 3:4]) + fl[..., :3] * fl[..., 3:4]

    img = surf * (1 - cav)[..., None] + carved * cav[..., None]
    # chamfer / lips: lit & shaded by the same normals (surface response, weak)
    edge_light = (np.clip(rel, 0, 2) - 1.0) * (1 - cav)
    img = img + (edge_light * 0.20)[..., None] * np.array([1.0, 0.85, 0.62], np.float32) * (hf["edge"] > 0.2)[..., None]

    # ---- global look: warm low light, broad gradient, polished sheen, far-corner falloff ------------------
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / n
    d = np.hypot(xx - 0.12, yy - 0.08) / 1.25
    grad = np.clip(2.45 - 1.95 * d, 0.5, 2.5)
    warm = np.stack([np.clip(1.05 - 0.08 * d, 0, 2), np.clip(0.97 - 0.02 * d, 0, 2), np.clip(0.84 + 0.14 * d, 0, 2)], axis=-1)
    img = img * (grad[..., None] * warm)
    sheen = np.exp(-(((xx - 0.20) / 0.30) ** 2 + ((yy - 0.16) / 0.20) ** 2)) * 0.085
    sheen += np.exp(-(((xx - 0.55 - 0.3 * (yy - 0.5)) / 0.05) ** 2)) * 0.012  # faint diagonal reflection band
    img = img + (sheen * (1 - cav))[..., None] * np.array([1.0, 0.86, 0.66], np.float32)

    img = np.clip(img, 0, 1)
    img = img ** (1 / 1.08)  # lift the mids slightly
    out = Image.fromarray((img * 255 + 0.5).astype(np.uint8))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(out_path)
    # companions used by the realism-pass geometry check
    Image.fromarray((np.clip(carve / carve.max(), 0, 1) * 255).astype(np.uint8)).save(out_path.with_name(out_path.stem + "_depth.png"))
    Image.fromarray((cav * 255).astype(np.uint8)).save(out_path.with_name(out_path.stem + "_cavity.png"))
    return out_path


def _flecks(n: int, s: float, o: dict, rng: np.random.Generator) -> np.ndarray:
    """RGBA float layer of fine mineral flecks (drawn 2x supersampled)."""
    ss = 2
    layer = Image.new("RGBA", (n * ss, n * ss), (0, 0, 0, 0))
    dr = ImageDraw.Draw(layer)
    palette = np.array([[212, 160, 66], [186, 126, 52], [232, 168, 48], [160, 112, 60], [205, 175, 110]], np.float32)
    count = int(n * n * o["fleck_density"])
    xs = rng.uniform(0, n, count)
    ys = rng.uniform(0, n, count)
    rad = (0.55 + rng.exponential(0.55, count)).clip(0.55, 3.0) * s / 3.4 * 1.15
    shade = rng.uniform(0.35, 1.25, count)
    which = rng.integers(0, len(palette), count)
    sparkle = rng.random(count) < 0.07
    for i in range(count):
        c = palette[which[i]] * shade[i] * (1.5 if sparkle[i] else 1.0)
        col = tuple(int(min(255, v)) for v in c) + (255,)
        r = rad[i] * ss
        k = rng.integers(3, 6)
        ang = rng.uniform(0, math.tau)
        pts = [(xs[i] * ss + r * (0.6 + 0.5 * rng.random()) * math.cos(ang + j * math.tau / k),
                ys[i] * ss + r * (0.6 + 0.5 * rng.random()) * math.sin(ang + j * math.tau / k)) for j in range(k)]
        dr.polygon(pts, fill=col)
    for _ in range(int(n * n * o["quartz_density"])):
        x, y = rng.uniform(0, n * ss, 2)
        r = rng.uniform(0.5, 1.1) * ss * s / 3.4
        v = int(rng.uniform(200, 255))
        dr.ellipse([x - r, y - r, x + r, y + r], fill=(v, v, min(255, v - 6), 255))
    layer = layer.resize((n, n), Image.LANCZOS)
    a = np.asarray(layer, dtype=np.float32) / 255.0
    return a


if __name__ == "__main__":
    import sys

    root = Path(__file__).resolve().parents[2] / "assets-src" / "granite"
    out = compose(root / "granite_base" / "master.png", root / "chisel" / "master.png", root / "board_composite.png",
                  size=int(sys.argv[1]) if len(sys.argv) > 1 else 2048)
    print("wrote", out)
