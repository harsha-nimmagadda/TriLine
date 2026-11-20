"""Tiny ComfyUI HTTP client (stdlib only).

Usage:
    c = Comfy()                       # base URL from $COMFY_URL or the LAN default
    pid = c.queue(workflow)           # API-format workflow dict
    entry = c.wait(pid)               # blocks until finished (raises ComfyError on failure)
    images = c.outputs(entry)         # [(node_id, filename, subfolder, type)]
    data = c.fetch(*images[0][1:])    # PNG bytes
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

DEFAULT_URL = "http://192.168.1.10:4567"


class ComfyError(RuntimeError):
    pass


class Comfy:
    def __init__(self, base_url: str | None = None, http_timeout: float = 30.0):
        self.base = (base_url or os.environ.get("COMFY_URL") or DEFAULT_URL).rstrip("/")
        self.http_timeout = http_timeout
        self.client_id = uuid.uuid4().hex

    # ---- low level -------------------------------------------------------------------------
    def _request(self, path: str, data: bytes | None = None, headers: dict | None = None, timeout: float | None = None) -> bytes:
        req = urllib.request.Request(self.base + path, data=data, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=timeout or self.http_timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:2000]
            raise ComfyError(f"HTTP {e.code} from {path}: {body}") from None
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            raise ComfyError(f"Cannot reach ComfyUI at {self.base} ({e}). Is the server up? Set COMFY_URL to override.") from None

    def _json(self, path: str, payload: dict | None = None, timeout: float | None = None):
        data = None
        headers = {}
        if payload is not None:
            data = json.dumps(payload).encode()
            headers["Content-Type"] = "application/json"
        return json.loads(self._request(path, data, headers, timeout))

    # ---- info ------------------------------------------------------------------------------
    def object_info(self, node: str) -> dict:
        return self._json(f"/object_info/{urllib.parse.quote(node)}")[node]

    def has_node(self, node: str) -> bool:
        try:
            self.object_info(node)
            return True
        except ComfyError:
            return False

    def list_models(self, folder: str) -> list[str]:
        """Files in a models sub-folder, e.g. 'checkpoints', 'upscale_models', 'background_removal'."""
        try:
            return list(self._json(f"/models/{folder}"))
        except ComfyError:
            return []

    # ---- running workflows -----------------------------------------------------------------
    def queue(self, workflow: dict) -> str:
        res = self._json("/prompt", {"prompt": workflow, "client_id": self.client_id})
        if res.get("node_errors"):
            raise ComfyError("Workflow rejected: " + json.dumps(res["node_errors"])[:2000])
        return res["prompt_id"]

    def wait(self, prompt_id: str, timeout: float = 900.0, poll: float = 1.0) -> dict:
        deadline = time.time() + timeout
        while time.time() < deadline:
            hist = self._json(f"/history/{prompt_id}")
            entry = hist.get(prompt_id)
            if entry:
                status = entry.get("status", {})
                if status.get("status_str") == "error":
                    msgs = [m for m in status.get("messages", []) if m and m[0] == "execution_error"]
                    detail = json.dumps(msgs[-1][1])[:1500] if msgs else "unknown error"
                    raise ComfyError(f"Execution failed: {detail}")
                if status.get("completed") or entry.get("outputs"):
                    return entry
            time.sleep(poll)
        raise ComfyError(f"Timed out after {timeout:.0f}s waiting for prompt {prompt_id}")

    @staticmethod
    def outputs(entry: dict) -> list[tuple[str, str, str, str]]:
        out = []
        for node_id, o in entry.get("outputs", {}).items():
            for img in o.get("images", []):
                out.append((node_id, img["filename"], img.get("subfolder", ""), img.get("type", "output")))
        return out

    def fetch(self, filename: str, subfolder: str = "", type_: str = "output") -> bytes:
        q = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": type_})
        return self._request(f"/view?{q}", timeout=120)

    def upload_image(self, path: str, name: str | None = None) -> str:
        """Upload a local image to ComfyUI's input folder (for LoadImage). Returns the stored name."""
        boundary = uuid.uuid4().hex
        fname = name or os.path.basename(path)
        with open(path, "rb") as f:
            content = f.read()
        body = (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{fname}\"\r\n"
            f"Content-Type: image/png\r\n\r\n"
        ).encode() + content + (
            f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n--{boundary}--\r\n"
        ).encode()
        res = json.loads(self._request("/upload/image", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}, timeout=120))
        return res["name"]

    def run(self, workflow: dict, timeout: float = 900.0) -> list[tuple[str, bytes]]:
        """Queue, wait, and download every image output as (node_id, png_bytes)."""
        entry = self.wait(self.queue(workflow), timeout=timeout)
        return [(n, self.fetch(fn, sub, ty)) for n, fn, sub, ty in self.outputs(entry)]
