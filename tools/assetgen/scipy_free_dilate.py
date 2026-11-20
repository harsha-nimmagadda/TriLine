import numpy as np


def dilate(a: np.ndarray, radius: int) -> np.ndarray:
    """Max-filter dilation with a square window via separable running max (no scipy)."""
    out = a.copy()
    for axis in (0, 1):
        acc = out.copy()
        for k in range(1, radius + 1):
            acc = np.maximum(acc, np.roll(out, k, axis=axis))
            acc = np.maximum(acc, np.roll(out, -k, axis=axis))
        out = acc
    return out
