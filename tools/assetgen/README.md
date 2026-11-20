# assetgen

Generates raster display assets (ComfyUI on the LAN GPU + Pillow). Python 3, stdlib + Pillow only.
Server: `http://192.168.1.10:4567` (override with `COMFY_URL` or `--url`). No LoRAs are used.

```bash
python3 tools/assetgen/assetgen.py status                       # models, optional upscaler / bg-removal
python3 tools/assetgen/assetgen.py generate tools/assetgen/specs/granite.json --asset board --n 6
python3 tools/assetgen/assetgen.py generate tools/assetgen/specs/granite.json --asset board --n 2 --draft   # fast SDXL-Turbo drafts
python3 tools/assetgen/assetgen.py master granite board 3       # pick candidate #3 -> master.png (2048, seamless for textures)
python3 tools/assetgen/assetgen.py tile-preview granite board   # 2x2 tiling to inspect seams
python3 tools/assetgen/assetgen.py export granite               # WebPs -> public/assets/granite/
```

Candidates, contact sheets, logs (prompt, seed, model, params) and masters live in `assets-src/` (git-ignored).
Only `public/assets/**` is committed. Edit prompts in `specs/<theme>.json`.

Optional models (auto-detected): `RealESRGAN_x4plus.pth` in `upscale_models` (else Lanczos), and any model in
`background_removal` for piece cutouts (else generate on flat magenta and colour-key locally).
