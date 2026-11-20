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

Granite carved-board pipeline (materials generated, board procedural):

```bash
# materials + piece sheets (spec: specs/granite.json): granite_base, chisel, table, sheet_p1 (tiger's eye), sheet_p2 (lapis)
python3 tools/assetgen/assetgen.py generate tools/assetgen/specs/granite.json --asset granite_base --n 4
python3 tools/assetgen/assetgen.py master granite granite_base 5      # ESRGAN 2048 master (Lanczos if the model is absent)
python3 tools/assetgen/assetgen.py master granite chisel 1
python3 tools/assetgen/assetgen.py master granite table 2
python3 tools/assetgen/assetgen.py compose granite                    # deterministic carved board from the game geometry
python3 tools/assetgen/assetgen.py cabochons granite sheet_p1 --cands 1,2,3 --clear   # circular cutouts of every stone
python3 tools/assetgen/assetgen.py cabochons granite sheet_p2 --cands 2,3,4 --min-blue 0.5 --clear
# copy the 4-6 best stones to assets-src/granite/pieces/final/p1_0.png, p1_1.png ... p2_0.png ...
python3 tools/assetgen/assetgen.py export granite
```

`compose_granite.py` renders the board from the same coordinates as `src/engine/board.ts` / `boardView.ts`
(600x600 viewBox, 24 points), so the image aligns exactly with the SVG overlays. No numpy needed (Pillow only).

Candidates, contact sheets, logs (prompt, seed, model, params) and masters live in `assets-src/` (git-ignored).
Only `public/assets/**` is committed. Edit prompts in `specs/<theme>.json`.

Optional models (auto-detected): `RealESRGAN_x4plus.pth` in `upscale_models` (else Lanczos), and any model in
`background_removal` for piece cutouts (else generate on flat magenta and colour-key locally).
