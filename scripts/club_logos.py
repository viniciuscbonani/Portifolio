"""Gera os logos dos clubes em dither (4 tintas verdes, Bayer 8x8), no mesmo estilo dos
logos que o elemento do fundo assume na trajetória.

Entrada: design/clubes/<clube>.png (logo com fundo transparente). Se o arquivo não existir,
gera um selo provisório com as iniciais do clube.
Saída: public/img/clubes/<clube>.png (fundo transparente, para ficar sobre a página).

Uso: python3 scripts/club_logos.py  (precisa de Pillow e numpy)
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "design" / "clubes"
OUT = ROOT / "public" / "img" / "clubes"
SIZE = 360
PIXEL = 3

INKS = np.array([
    [0x08, 0x1A, 0x14],
    [0x1E, 0x46, 0x36],
    [0x5E, 0x9C, 0x80],
    [0xC4, 0xDB, 0xD0],
], dtype=np.uint8)

# (saída, arquivo de entrada, iniciais do selo provisório)
CLUBS = [
    ("academy", "academy.png", "IA"),
    ("junior", "junior.png", "IJ"),
    ("codeclub", "codeclub-horizontal.png", "CC"),
]


def bayer8() -> np.ndarray:
    m = np.array([[0, 2], [3, 1]])
    for _ in range(2):
        m = np.block([[4 * m, 4 * m + 2], [4 * m + 3, 4 * m + 1]])
    return (m + 0.5) / 64.0


def first_glyph_group(alpha: Image.Image) -> Image.Image:
    """No logo horizontal do Code Club, fica só com a marca "{i}": os três primeiros grupos de colunas."""
    a = np.asarray(alpha) > 40
    cols = np.nonzero(a.any(axis=0))[0]
    breaks = np.nonzero(np.diff(cols) > 2)[0]
    end = cols[breaks[2]] + 1 if len(breaks) > 2 else cols[-1] + 1
    return alpha.crop((0, 0, end, alpha.size[1]))


def silhouette(name: str, file: str, initials: str) -> Image.Image:
    path = SRC / file
    if path.exists():
        alpha = Image.open(path).convert("RGBA").getchannel("A")
        if name == "codeclub":
            alpha = first_glyph_group(alpha)
        return alpha.crop(alpha.getbbox())
    # Selo provisório: iniciais dentro de um anel
    img = Image.new("L", (400, 400), 0)
    draw = ImageDraw.Draw(img)
    draw.ellipse((20, 20, 380, 380), outline=255, width=26)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 150)
    draw.text((200, 205), initials, fill=255, font=font, anchor="mm")
    return img


def render(alpha: Image.Image) -> Image.Image:
    cells = SIZE // PIXEL
    inner = int(cells * 0.72)
    logo = alpha.copy()
    logo.thumbnail((inner, inner), Image.LANCZOS)
    canvas = Image.new("L", (cells, cells), 0)
    canvas.paste(logo, ((cells - logo.size[0]) // 2, (cells - logo.size[1]) // 2))

    fill = np.asarray(canvas).astype(np.float32) / 255.0
    halo = np.asarray(canvas.filter(ImageFilter.GaussianBlur(cells * 0.04))).astype(np.float32) / 255.0
    rng = np.random.default_rng(7)
    texture = np.asarray(
        Image.fromarray((rng.random((cells // 6, cells // 6)) * 255).astype(np.uint8)).resize((cells, cells), Image.BICUBIC)
    ).astype(np.float32) / 255.0

    value = np.maximum(fill * (0.55 + 0.4 * texture), halo * 0.3)
    threshold = np.tile(bayer8(), (cells // 8 + 1, cells // 8 + 1))[:cells, :cells]
    scaled = value * 3.0
    index = np.clip(np.floor(scaled) + (scaled % 1.0 > threshold), 0, 3).astype(int)

    rgb = INKS[index]
    alpha_out = np.where(index > 0, 255, 0).astype(np.uint8)
    out = Image.fromarray(np.dstack([rgb, alpha_out]), "RGBA")
    return out.resize((SIZE, SIZE), Image.NEAREST)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, file, initials in CLUBS:
        provisional = not (SRC / file).exists()
        render(silhouette(name, file, initials)).save(OUT / f"{name}.png", optimize=True)
        print(f"public/img/clubes/{name}.png{'  (selo provisório)' if provisional else ''}")
