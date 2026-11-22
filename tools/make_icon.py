#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成「拾词」启动图标：墨蓝圆角底 + 米色「拾」+ 赭石星点。
输出 android/res/mipmap-*/ic_launcher.png 与 out/icon-512.png。
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "res")
OUT = os.path.join(ROOT, "out")

INK = (26, 32, 53, 255)
CREAM = (246, 241, 231, 255)
OCHRE = (203, 146, 44, 255)
TERRA = (196, 87, 58, 255)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\simsun.ttc",
]

SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def load_font(px):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, px)
            except Exception:
                continue
    return None


def rounded(size, radius):
    mask = Image.new("L", (size * 4, size * 4), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=radius * 4, fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def draw_icon(size):
    scale = 4
    S = size * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 底：墨蓝，下方略深的渐变
    for i in range(S):
        t = i / max(1, S - 1)
        r = int(26 - 8 * t)
        g = int(32 - 9 * t)
        b = int(53 - 12 * t)
        d.line([(0, i), (S, i)], fill=(r, g, b, 255))

    # 星点
    stars = [(0.72, 0.24, 0.030, OCHRE), (0.80, 0.36, 0.018, CREAM), (0.26, 0.24, 0.016, CREAM)]
    for sx, sy, sr, col in stars:
        x, y = sx * S, sy * S
        rad = sr * S
        d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=col)

    # 主字「拾」
    font = load_font(int(S * 0.56))
    if font is not None:
        box = d.textbbox((0, 0), "拾", font=font)
        tw, th = box[2] - box[0], box[3] - box[1]
        d.text(((S - tw) / 2 - box[0], (S - th) / 2 - box[1] - S * 0.015), "拾", font=font, fill=CREAM)
    else:
        # 没有中文字体时画一本小书 + 星
        m = S * 0.24
        d.rounded_rectangle([m, m, S - m, S - m], radius=S * 0.05, fill=CREAM)
        d.line([S / 2, m + S * 0.03, S / 2, S - m - S * 0.03], fill=(26, 32, 53, 255), width=max(2, int(S * 0.012)))
        d.line([m + S * 0.08, S * 0.45, S / 2 - S * 0.08, S * 0.45], fill=(26, 32, 53, 255), width=max(2, int(S * 0.01)))
        d.line([S / 2 + S * 0.08, S * 0.45, S - m - S * 0.08, S * 0.45], fill=(26, 32, 53, 255), width=max(2, int(S * 0.01)))

    # 底边一线赭石，呼应纸感
    d.rounded_rectangle([S * 0.30, S * 0.84, S * 0.70, S * 0.865], radius=S * 0.012, fill=OCHRE)

    img = img.resize((size, size), Image.LANCZOS)
    mask = rounded(size, int(size * 0.22))
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    for folder, size in SIZES.items():
        path = os.path.join(RES, folder)
        os.makedirs(path, exist_ok=True)
        icon = draw_icon(size)
        icon.save(os.path.join(path, "ic_launcher.png"))
        print("icon", folder, size)
    big = draw_icon(512)
    big.save(os.path.join(OUT, "icon-512.png"))
    print("icon out/icon-512.png")


if __name__ == "__main__":
    main()
