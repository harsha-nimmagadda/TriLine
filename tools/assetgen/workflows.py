"""Builders for ComfyUI API-format workflows (no LoRAs; optional upscale / background removal)."""
from __future__ import annotations


def txt2img(*, model: str, prompt: str, negative: str, seed: int, steps: int, cfg: float, sampler: str,
            scheduler: str, width: int, height: int, prefix: str = "assetgen",
            bg_removal_model: str | None = None) -> dict:
    """SDXL text-to-image. Node ids: 'save' = RGB image; 'save_mask' = background mask (if a model is given)."""
    wf = {
        "ckpt": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": model}},
        "pos": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["ckpt", 1]}},
        "neg": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["ckpt", 1]}},
        "latent": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "sample": {"class_type": "KSampler", "inputs": {
            "model": ["ckpt", 0], "positive": ["pos", 0], "negative": ["neg", 0], "latent_image": ["latent", 0],
            "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": sampler, "scheduler": scheduler, "denoise": 1.0}},
        "decode": {"class_type": "VAEDecode", "inputs": {"samples": ["sample", 0], "vae": ["ckpt", 2]}},
        "save": {"class_type": "SaveImage", "inputs": {"images": ["decode", 0], "filename_prefix": prefix}},
    }
    if bg_removal_model:
        wf["bgload"] = {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": bg_removal_model}}
        wf["bgmask"] = {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["bgload", 0], "image": ["decode", 0]}}
        wf["maskimg"] = {"class_type": "MaskToImage", "inputs": {"mask": ["bgmask", 0]}}
        wf["save_mask"] = {"class_type": "SaveImage", "inputs": {"images": ["maskimg", 0], "filename_prefix": prefix + "_mask"}}
    return wf


def upscale(*, uploaded_name: str, upscale_model: str, target_long_edge: int, prefix: str = "assetgen_up") -> dict:
    """LoadImage -> ESRGAN-style model upscale -> Lanczos resize to the target long edge."""
    return {
        "load": {"class_type": "LoadImage", "inputs": {"image": uploaded_name}},
        "um": {"class_type": "UpscaleModelLoader", "inputs": {"model_name": upscale_model}},
        "up": {"class_type": "ImageUpscaleWithModel", "inputs": {"upscale_model": ["um", 0], "image": ["load", 0]}},
        "save": {"class_type": "SaveImage", "inputs": {"images": ["up", 0], "filename_prefix": prefix}},
    }


def img2img(*, model: str, uploaded_name: str, prompt: str, negative: str, seed: int, steps: int, cfg: float,
            sampler: str, scheduler: str, denoise: float, prefix: str = "assetgen_i2i") -> dict:
    """Low-denoise SDXL img2img (used as a realism pass that must not move geometry)."""
    return {
        "ckpt": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": model}},
        "pos": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["ckpt", 1]}},
        "neg": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["ckpt", 1]}},
        "load": {"class_type": "LoadImage", "inputs": {"image": uploaded_name}},
        "enc": {"class_type": "VAEEncode", "inputs": {"pixels": ["load", 0], "vae": ["ckpt", 2]}},
        "sample": {"class_type": "KSampler", "inputs": {
            "model": ["ckpt", 0], "positive": ["pos", 0], "negative": ["neg", 0], "latent_image": ["enc", 0],
            "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": sampler, "scheduler": scheduler, "denoise": denoise}},
        "decode": {"class_type": "VAEDecode", "inputs": {"samples": ["sample", 0], "vae": ["ckpt", 2]}},
        "save": {"class_type": "SaveImage", "inputs": {"images": ["decode", 0], "filename_prefix": prefix}},
    }
