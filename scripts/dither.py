"""Gera versões estáticas em dither (4 tintas verdes, Bayer 8x8) das imagens do site.

São usadas quando o WebGL não roda (aparelho sem suporte ou movimento reduzido).
O shader em
src/gl/glsl.js usa a mesma matriz e a mesma paleta, então as duas versões batem.

Uso: python3 scripts/dither.py  (precisa de Pillow e numpy)
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "public" / "img"

INKS = np.array([
    [0x08, 0x1A, 0x14],
    [0x1E, 0x46, 0x36],
    [0x5E, 0x9C, 0x80],
    [0xC4, 0xDB, 0xD0],
], dtype=np.uint8)

# (origem, destino, largura final, tamanho do "pixel" do dither, contraste)
JOBS = [
    ("vinicius-1000.webp", "vinicius-dither.webp", 600, 2, 1.25),
]


def bayer8() -> np.ndarray:
    m = np.array([[0, 2], [3, 1]])
    for _ in range(2):
        m = np.block([[4 * m, 4 * m + 2], [4 * m + 3, 4 * m + 1]])
    return (m + 0.5) / 64.0


def dither(src: Path, dst: Path, width: int, pixel: int, contrast: float) -> None:
    im = Image.open(src).convert("RGB")
    height = round(im.height * width / im.width)
    # Reduz para a grade de "pixels" e depois amplia sem suavizar: visual de jogo antigo
    small = im.resize((width // pixel, height // pixel), Image.LANCZOS)
    rgb = np.asarray(small).astype(np.float32) / 255.0
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    lum = np.clip((lum - 0.5) * contrast + 0.5, 0.0, 1.0)

    h, w = lum.shape
    threshold = np.tile(bayer8(), (h // 8 + 1, w // 8 + 1))[:h, :w]
    scaled = lum * 3.0
    index = np.clip(np.floor(scaled) + (scaled % 1.0 > threshold), 0, 3).astype(int)

    out = Image.fromarray(INKS[index]).resize((w * pixel, h * pixel), Image.NEAREST)
    out.save(dst, quality=90, method=6)
    print(f"{dst.relative_to(ROOT)}  {out.size[0]}x{out.size[1]}")


if __name__ == "__main__":
    for source, target, width, pixel, contrast in JOBS:
        dither(IMG / source, IMG / target, width, pixel, contrast)
