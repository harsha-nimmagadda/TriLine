#!/usr/bin/env python3
"""Asset generation CLI for Pedda Dhadi display-quality assets (ComfyUI + Pillow).

Examples (run from the repo root):
  python3 tools/assetgen/assetgen.py status
  python3 tools/assetgen/assetgen.py generate tools/assetgen/specs/granite.json --asset board --n 6
  python3 tools/assetgen/assetgen.py generate tools/assetgen/specs/granite.json --asset board --n 2 --draft
  python3 tools/assetgen/assetgen.py master granite board 3
  python3 tools/assetgen/assetgen.py tile-preview granite board
  python3 tools/assetgen/assetgen.py export granite
"""
from __future__ import annotations

import argparse
import io
import json
import os
import random
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cabochons  # noqa: E402
import imgtools  # noqa: E402
import workflows  # noqa: E402
from comfy import Comfy, ComfyError  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets-src"
PUBLIC = ROOT / "public" / "assets"
SPEC_DIR = Path(__file__).resolve().parent / "specs"
UPSCALE_MODEL = "RealESRGAN_x4plus.pth"


def load_spec(path_or_theme: str) -> dict:
    p = Path(path_or_theme)
    if not p.exists():
        p = SPEC_DIR / f"{path_or_theme}.json"
    if not p.exists():
        sys.exit(f"Spec not found: {path_or_theme}")
    return json.loads(p.read_text())


def asset_dir(theme: str, asset: str) -> Path:
    d = SRC / theme / asset
    d.mkdir(parents=True, exist_ok=True)
    return d


def round8(n: float) -> int:
    return max(64, int(round(n / 8)) * 8)


def say(msg: str) -> None:
    print(msg, flush=True)


# ---- status ---------------------------------------------------------------------------------

def cmd_status(args) -> None:
    c = Comfy(args.url)
    say(f"ComfyUI: {c.base}")
    for folder in ("checkpoints", "upscale_models", "background_removal"):
        say(f"  {folder}: {c.list_models(folder) or '-'}")
    say(f"  upscale model {UPSCALE_MODEL}: {'available' if UPSCALE_MODEL in c.list_models('upscale_models') else 'missing (Lanczos fallback)'}")
    bg = c.list_models("background_removal")
    say(f"  background removal: {bg[0] if bg else 'missing (colour-key cutout fallback)'}")


# ---- generate -------------------------------------------------------------------------------

def cmd_generate(args) -> None:
    spec = load_spec(args.spec)
    theme = spec["theme"]
    if args.asset not in spec["assets"]:
        sys.exit(f"Unknown asset '{args.asset}'. Choices: {', '.join(spec['assets'])}")
    a = spec["assets"][args.asset]
    mode = "draft" if args.draft else "main"
    p = spec["params"][mode]
    model = spec["models"][mode]
    w, h = a["width"], a["height"]
    if args.draft:
        s = p["long_edge"] / max(w, h)
        w, h = round8(w * s), round8(h * s)
    negative = ", ".join(x for x in (spec.get("negative"), a.get("negative_extra")) if x)
    prompt = a["prompt"]

    c = Comfy(args.url)
    bg_model = None
    if a["kind"] == "piece":
        found = c.list_models("background_removal")
        bg_model = found[0] if found else None
        say(f"piece cutout: {'model ' + bg_model if bg_model else 'colour-key fallback'}")

    d = asset_dir(theme, args.asset)
    existing = sorted(d.glob("cand_*.png"))
    start = max((int(f.stem.split("_")[1]) for f in existing if f.stem.split("_")[1].isdigit() and "mask" not in f.stem), default=0) + 1
    base_seed = args.seed if args.seed is not None else random.randrange(2**31)
    log_path = d / "log.json"
    log = json.loads(log_path.read_text()) if log_path.exists() else {"theme": theme, "asset": args.asset, "candidates": []}

    for i in range(args.n):
        idx = start + i
        seed = base_seed + i
        say(f"[{i + 1}/{args.n}] cand_{idx:03d} seed={seed} {w}x{h} model={model} steps={p['steps']} cfg={p['cfg']}")
        wf = workflows.txt2img(model=model, prompt=prompt, negative=negative, seed=seed, steps=p["steps"], cfg=p["cfg"],
                               sampler=p["sampler"], scheduler=p["scheduler"], width=w, height=h,
                               prefix=f"assetgen_{theme}_{args.asset}", bg_removal_model=bg_model)
        outs = c.run(wf, timeout=args.timeout)
        by_node = dict(outs)
        (d / f"cand_{idx:03d}.png").write_bytes(by_node["save"])
        if "save_mask" in by_node:
            (d / f"cand_{idx:03d}_mask.png").write_bytes(by_node["save_mask"])
        log["candidates"].append({
            "file": f"cand_{idx:03d}.png", "seed": seed, "prompt": prompt, "negative": negative, "model": model,
            "steps": p["steps"], "cfg": p["cfg"], "sampler": p["sampler"], "scheduler": p["scheduler"],
            "width": w, "height": h, "draft": args.draft, "bg_removal_model": bg_model,
        })
        log_path.write_text(json.dumps(log, indent=2))

    # contact sheet of the candidates from this run
    files = [d / f"cand_{start + i:03d}.png" for i in range(args.n)]
    sheet = imgtools.contact_sheet([Image.open(f) for f in files], [f"#{start + i}" for i in range(args.n)])
    sheet.save(d / "contact.png")
    say(f"wrote {len(files)} candidates + contact.png + log.json in {d.relative_to(ROOT)}")


# ---- master ---------------------------------------------------------------------------------

def upscale_to(img: Image.Image, long_edge: int, c: Comfy | None, tmp_dir: Path) -> Image.Image:
    """Upscale with RealESRGAN via ComfyUI when installed, else Lanczos. Result has the target long edge."""
    scale = long_edge / max(img.size)
    target = (round(img.width * scale), round(img.height * scale))
    if c and UPSCALE_MODEL in c.list_models("upscale_models") and scale > 1:
        tmp = tmp_dir / "_upscale_in.png"
        img.convert("RGB").save(tmp)
        name = c.upload_image(str(tmp), "assetgen_upscale_in.png")
        out = c.run(workflows.upscale(uploaded_name=name, upscale_model=UPSCALE_MODEL, target_long_edge=long_edge))
        tmp.unlink(missing_ok=True)
        up = Image.open(io.BytesIO(out[0][1])).convert("RGB")
        say(f"upscaled with {UPSCALE_MODEL}: {img.size} -> {up.size}")
        return up.resize(target, Image.LANCZOS)
    say(f"upscaled with Lanczos (no {UPSCALE_MODEL} installed): {img.size} -> {target}")
    return img.convert("RGB").resize(target, Image.LANCZOS)


def cmd_master(args) -> None:
    spec = load_spec(args.spec or args.theme)
    a = spec["assets"][args.asset]
    d = asset_dir(args.theme, args.asset)
    src = d / f"cand_{int(args.cand):03d}.png"
    if not src.exists():
        sys.exit(f"No such candidate: {src}")
    img = Image.open(src)
    try:
        c: Comfy | None = Comfy(args.url)
        c.list_models("checkpoints")
    except ComfyError:
        c = None
    kind = a["kind"]
    if kind == "texture":
        big = upscale_to(img, 2048, c, d)
        big = big.resize((2048, 2048), Image.LANCZOS)
        if a.get("seamless", True):
            out = imgtools.make_seamless(big)
            say("made seamless (offset + cross-fade); inspect with: tile-preview")
        else:
            out = big
    elif kind == "background":
        edge = max(a["export"].values())
        out = upscale_to(img, edge, c, d)
    elif kind == "piece":
        mask = d / f"cand_{int(args.cand):03d}_mask.png"
        if mask.exists():
            rgba = imgtools.apply_mask(img, Image.open(mask))
            say("cutout from background-removal model mask")
        else:
            rgba = imgtools.cutout_colour_key(img, tolerance=args.tolerance)
            say("cutout by colour key")
        out = imgtools.crop_square(rgba, size=1024)
    else:
        sys.exit(f"Unknown kind: {kind}")
    out.save(d / "master.png")
    (d / "master.json").write_text(json.dumps({"candidate": src.name, "kind": kind, "size": out.size}))
    say(f"wrote {(d / 'master.png').relative_to(ROOT)} {out.size}")


# ---- cabochons (pieces cut from flat-lay sheets) ---------------------------------------------------

def blue_fraction(img: Image.Image) -> float:
    rgb = img.convert("RGBA")
    px = [p for p in rgb.getdata() if p[3] > 200]
    if not px:
        return 0.0
    return sum(1 for r, g, b, _ in px if b > r * 1.25 and b > g * 1.1) / len(px)


def cmd_cabochons(args) -> None:
    spec = load_spec(args.spec or args.theme)
    a = spec["assets"][args.asset]
    prefix = a["piece"]
    out_dir = SRC / args.theme / "pieces"
    out_dir.mkdir(parents=True, exist_ok=True)
    if args.clear:
        for f in out_dir.glob(f"{prefix}_*.png"):
            f.unlink()
    existing = len(list(out_dir.glob(f"{prefix}_*.png")))
    kept = []
    for cand in args.cands.split(","):
        sheet = SRC / args.theme / args.asset / f"cand_{int(cand):03d}.png"
        stones = cabochons.find_stones(Image.open(sheet))
        say(f"{sheet.name}: {len(stones)} separate stones found")
        img = Image.open(sheet).convert("RGB")
        for cx, cy, r in stones:
            cut = cabochons.cut_circle(img, cx, cy, r, 512)
            if args.min_blue and blue_fraction(cut) < args.min_blue:
                continue
            path = out_dir / f"{prefix}_{existing + len(kept):02d}.png"
            cut.save(path)
            kept.append(path)
    files = sorted(out_dir.glob(f"{prefix}_*.png"))
    sheet = imgtools.contact_sheet([Image.open(f) for f in files], [f.stem for f in files], thumb=200, cols=6)
    sheet.save(out_dir / f"{prefix}_contact.png")
    say(f"{len(files)} {prefix} variants in {out_dir.relative_to(ROOT)} (see {prefix}_contact.png); delete unwanted PNGs by hand, keep 4-6")


# ---- tile preview ---------------------------------------------------------------------------

def cmd_tile_preview(args) -> None:
    d = asset_dir(args.theme, args.asset)
    src = d / (f"cand_{int(args.cand):03d}.png" if args.cand else "master.png")
    if not src.exists():
        sys.exit(f"Missing {src} (run master first, or pass --cand N)")
    out = imgtools.tile_preview(Image.open(src))
    out_path = d / "tile_preview.png"
    out.save(out_path)
    say(f"wrote {out_path.relative_to(ROOT)} (2x2 tiling of {src.name}) - look for visible seams along the centre cross")


# ---- export ---------------------------------------------------------------------------------

def fmt(n: int) -> str:
    return f"{n / 1024:.0f} KB" if n < 1024 * 1024 else f"{n / 1024 / 1024:.2f} MB"


def relight_stone(img: Image.Image) -> Image.Image:
    """Match the board's light (warm, from the upper left): a gentle brightness ramp across the stone plus a warm cast."""
    import numpy as np

    a = np.asarray(img, dtype=np.float32) / 255.0
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = ((xx / w) + (yy / h)) / 2          # 0 upper-left .. 1 lower-right
    ramp = 1.16 - 0.38 * t
    rgb = a[..., :3] * ramp[..., None] * np.array([1.04, 0.99, 0.92], np.float32)
    out = np.concatenate([np.clip(rgb, 0, 1), a[..., 3:4]], axis=-1)
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA")


BALANCE: dict = {}


def stone_stats(imgs):
    import numpy as np
    L, C = [], []
    for im in imgs:
        a = np.asarray(im.convert("RGBA"), np.float32) / 255.0
        m = a[..., 3] > 0.9
        rgb = a[..., :3][m]
        L.append(0.299 * rgb[:, 0] + 0.587 * rgb[:, 1] + 0.114 * rgb[:, 2])
        C.append(rgb.max(axis=1) - rgb.min(axis=1))
    return float(np.concatenate(L).mean()), float(np.concatenate(C).mean())


def balance_sets(theme: str) -> None:
    """Match red jasper (p1) to lapis (p2) in mean luminance and chroma; report before/after."""
    import numpy as np
    fin = SRC / theme / "pieces" / "final"
    sets = {k: [relight_stone(Image.open(f).convert("RGBA")) for f in sorted(fin.glob(f"{k}_*.png"))] for k in ("p1", "p2")}
    if not sets["p1"] or not sets["p2"]:
        return
    l2, c2 = stone_stats(sets["p2"])
    l1, c1 = stone_stats(sets["p1"])
    gain = l2 / l1
    chroma = (c2 / c1) / gain   # applied before the gain, so the final chroma matches
    BALANCE["p1"] = (gain, chroma)
    out = []
    for im in sets["p1"]:
        out.append(apply_balance(im, gain, chroma))
    l1b, c1b = stone_stats(out)
    say(f"balance: lapis L={l2:.3f} chroma={c2:.3f}; jasper before L={l1:.3f} chroma={c1:.3f} -> after L={l1b:.3f} chroma={c1b:.3f} (gain {gain:.2f}, chroma x{chroma:.2f})")


def apply_balance(img: Image.Image, gain: float, chroma: float) -> Image.Image:
    import numpy as np
    a = np.asarray(img.convert("RGBA"), np.float32) / 255.0
    rgb = a[..., :3]
    lum = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2])[..., None]
    rgb = lum + (rgb - lum) * chroma          # chroma about the luma axis
    rgb = rgb * gain
    out = np.concatenate([np.clip(rgb, 0, 1), a[..., 3:4]], axis=-1)
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA")


def make_piece_shadow(path: Path, size: int = 192) -> None:
    """Soft contact shadow, same box as a stone image; offset to the lower right (light is upper left)."""
    import numpy as np

    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    c = size / 2
    r = size * 0.5 / 1.07 * 0.97          # stone radius within its box (margin 7%)
    d = np.hypot(xx - (c + size * 0.045), yy - (c + size * 0.075))
    a = np.clip((r * 1.02 - d) / (size * 0.075) + 0.5, 0, 1)       # soft-edged disc
    a = a * 0.75
    img = np.zeros((size, size, 4), np.uint8)
    img[..., 3] = (a * 255).astype(np.uint8)
    im = Image.fromarray(img, "RGBA")
    from PIL import ImageFilter
    im = im.filter(ImageFilter.GaussianBlur(size * 0.03))
    im.save(path, "WEBP", quality=90, alpha_quality=100, method=6)


def export_pieces(theme: str, a: dict, out_dir: Path) -> None:
    """Variants chosen in assets-src/<theme>/pieces/final/<prefix>_<k>.png -> piece_<prefix>_<k>.{ultra,high}.webp"""
    prefix = a["piece"]
    finals = sorted((SRC / theme / "pieces" / "final").glob(f"{prefix}_*.png"))
    if not finals:
        say(f"- {prefix}: no pieces/final/{prefix}_*.png, skipped")
        return
    make_piece_shadow(out_dir / "piece_shadow.webp")
    balance_sets(theme)
    say(f"- {(out_dir / 'piece_shadow.webp').relative_to(ROOT)}  192x192")
    for f in finals:
        img = relight_stone(Image.open(f).convert("RGBA"))
        if prefix in BALANCE:
            img = apply_balance(img, *BALANCE[prefix])
        for level, size in (("ultra", 256), ("high", 128)):
            path = out_dir / f"piece_{f.stem}.{level}.webp"
            img.resize((size, size), Image.LANCZOS).save(path, "WEBP", quality=92, alpha_quality=100, method=6)
            say(f"- {path.relative_to(ROOT)}  {size}x{size}  {fmt(path.stat().st_size)}")


def cmd_compose(args) -> None:
    import importlib

    spec = load_spec(args.spec or args.theme)
    a = spec["assets"]["board"]
    mod = importlib.import_module(a["compositor"])
    m = a["materials"]
    root = SRC / args.theme
    out = mod.compose(root / m["granite"] / "master.png", root / m["chisel"] / "master.png", root / "board_composite.png", size=args.size)
    say(f"wrote {out.relative_to(ROOT)} ({args.size}px); depth map beside it")


REALISM_PROMPT = ("top-down photo of a carved black granite game board, fine gold flecks, chiselled V-grooves with rough grey stone "
                  "inside, carved round cup holes, warm golden hour side light from the upper left, photoreal, sharp focus")
REALISM_NEGATIVE = ("text, letters, numbers, watermark, logo, pieces, stones, balls, objects, extra lines, extra holes, people, hands, "
                    "cartoon, illustration, blurry, low quality, table, wood, border, frame outside")


def cmd_realism(args) -> None:
    """img2img realism pass at 1024, then verify that the carved geometry did not move."""
    import geomcheck

    spec = load_spec(args.spec or args.theme)
    root = SRC / args.theme
    comp = root / "board_composite.png"
    out_dir = root / "realism"
    out_dir.mkdir(exist_ok=True)
    small = Image.open(comp).convert("RGB").resize((1024, 1024), Image.LANCZOS)
    inp = out_dir / "input_1024.png"
    small.save(inp)
    c = Comfy(args.url)
    name = c.upload_image(str(inp), "assetgen_realism_in.png")
    results = {}
    for d in [float(x) for x in args.denoise.split(",")]:
        say(f"img2img denoise={d} seed={args.seed}")
        wf = workflows.img2img(model=spec["models"]["main"], uploaded_name=name, prompt=args.prompt or REALISM_PROMPT,
                               negative=REALISM_NEGATIVE, seed=args.seed, steps=30, cfg=args.cfg, sampler="dpmpp_2m",
                               scheduler="karras", denoise=d)
        outs = c.run(wf, timeout=args.timeout)
        path = out_dir / f"d{int(round(d * 100)):03d}.png"
        path.write_bytes(dict(outs)["save"])
        res = geomcheck.check(comp, path, comp.with_name(comp.stem + "_cavity.png"))
        results[f"{d:.2f}"] = res
        say(json.dumps(res, indent=1))
    (out_dir / "geomcheck.json").write_text(json.dumps(results, indent=2))


def cmd_realism_finish(args) -> None:
    """Upscale the accepted realism result to 2048 (RealESRGAN if installed) and blend procedural detail back in."""
    root = SRC / args.theme
    acc = Image.open(root / "realism" / f"{args.name}.png").convert("RGB")
    try:
        c: Comfy | None = Comfy(args.url)
    except ComfyError:
        c = None
    up = upscale_to(acc, 2048, c, root / "realism").resize((2048, 2048), Image.LANCZOS)
    comp = Image.open(root / "board_composite.png").convert("RGB")
    final = Image.blend(up, comp, args.blend) if args.blend > 0 else up
    if args.gain != 1.0:
        # exposure lift with a soft shoulder (keeps highlights from clipping)
        final = final.point(lambda v: int(255 * (1 - 2.718281828 ** (-(v / 255.0) * args.gain * 1.6)) / (1 - 2.718281828 ** (-args.gain * 1.6))))
    up.save(root / "realism" / "accepted_2048.png")
    final.save(root / "board_final.png")
    say(f"wrote {(root / 'board_final.png').relative_to(ROOT)} (realism {args.name}, {1 - args.blend:.0%} diffusion / {args.blend:.0%} procedural)")


def cmd_export(args) -> None:
    spec = load_spec(args.spec or args.theme)
    out_dir = PUBLIC / args.theme
    out_dir.mkdir(parents=True, exist_ok=True)
    total = 0
    for asset_id, a in spec["assets"].items():
        if a["kind"] == "sheet":
            export_pieces(args.theme, a, out_dir)
            continue
        master = SRC / args.theme / asset_id / "master.png"
        if a["kind"] == "composite":
            master = SRC / args.theme / ("board_final.png" if (SRC / args.theme / "board_final.png").exists() else "board_composite.png")
        if not master.exists():
            say(f"- {asset_id}: no master.png, skipped")
            continue
        img = Image.open(master)
        for level, size in (a.get("export") or {}).items():
            if a["kind"] == "piece":
                im = img.resize((size, size), Image.LANCZOS)
                kw = dict(quality=92, alpha_quality=100, method=6)
            elif a["kind"] in ("texture", "composite"):
                im = img.convert("RGB").resize((size, size), Image.LANCZOS)
                kw = dict(quality=82, method=6)
            else:  # background: size = long edge
                s = size / max(img.size)
                im = img.convert("RGB").resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
                kw = dict(quality=76, method=6)
            path = out_dir / f"{asset_id}.{level}.webp"
            im.save(path, "WEBP", **kw)
            total += path.stat().st_size
            say(f"- {path.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}  {fmt(path.stat().st_size)}")
    say(f"total {fmt(total)}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", help="ComfyUI base URL (default $COMFY_URL or http://192.168.1.10:4567)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status", help="show server models / optional upscaler & bg-removal availability").set_defaults(fn=cmd_status)

    g = sub.add_parser("generate", help="generate candidates for one asset")
    g.add_argument("spec")
    g.add_argument("--asset", required=True)
    g.add_argument("--n", type=int, default=6)
    g.add_argument("--draft", action="store_true", help="fast SDXL-Turbo 512px drafts")
    g.add_argument("--seed", type=int, help="base seed (candidate i uses seed+i)")
    g.add_argument("--timeout", type=float, default=900)
    g.set_defaults(fn=cmd_generate)

    m = sub.add_parser("master", help="build the master image from a chosen candidate")
    m.add_argument("theme"); m.add_argument("asset"); m.add_argument("cand")
    m.add_argument("--spec"); m.add_argument("--tolerance", type=int, default=60, help="colour-key tolerance for piece cutouts")
    m.set_defaults(fn=cmd_master)

    cb = sub.add_parser("cabochons", help="cut round stones from a flat-lay sheet's candidates")
    cb.add_argument("theme"); cb.add_argument("asset"); cb.add_argument("--cands", required=True, help="comma-separated candidate numbers")
    cb.add_argument("--spec"); cb.add_argument("--min-blue", type=float, default=0.0); cb.add_argument("--clear", action="store_true")
    cb.set_defaults(fn=cmd_cabochons)

    t = sub.add_parser("tile-preview", help="2x2 tiling of a texture to check seams")
    t.add_argument("theme"); t.add_argument("asset"); t.add_argument("--cand")
    t.set_defaults(fn=cmd_tile_preview)

    cp = sub.add_parser("compose", help="render the carved board composite from the game geometry")
    cp.add_argument("theme"); cp.add_argument("--spec"); cp.add_argument("--size", type=int, default=2048)
    cp.set_defaults(fn=cmd_compose)

    rl = sub.add_parser("realism", help="img2img realism pass over the composite + geometry check")
    rl.add_argument("theme"); rl.add_argument("--spec"); rl.add_argument("--denoise", default="0.25,0.35,0.45")
    rl.add_argument("--seed", type=int, default=1234); rl.add_argument("--cfg", type=float, default=5.0)
    rl.add_argument("--prompt"); rl.add_argument("--timeout", type=float, default=900)
    rl.set_defaults(fn=cmd_realism)

    rf = sub.add_parser("realism-finish", help="upscale the accepted realism pass to 2048 and blend procedural detail back")
    rf.add_argument("theme"); rf.add_argument("name", help="e.g. d025"); rf.add_argument("--blend", type=float, default=0.35); rf.add_argument("--gain", type=float, default=1.0)
    rf.set_defaults(fn=cmd_realism_finish)

    e = sub.add_parser("export", help="write final WebPs to public/assets/<theme>/")
    e.add_argument("theme"); e.add_argument("--spec")
    e.set_defaults(fn=cmd_export)

    args = ap.parse_args()
    try:
        args.fn(args)
    except ComfyError as err:
        sys.exit(f"ERROR: {err}")


if __name__ == "__main__":
    main()
