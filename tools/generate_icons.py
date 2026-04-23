"""Generate Chrome extension icons for DeleteHistoryPlugIn.

Creates icons at 16, 32, 48, 128 pixels. Design: a circular clock/history
dial rendered in a cyan->magenta gradient with a bold red diagonal slash,
signaling "history removed". Saved to ../icons/.
"""
from __future__ import annotations
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = Path(__file__).resolve().parent.parent / "icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SIZES = [16, 32, 48, 128]


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def make_gradient_disk(size: int, c1, c2) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    cx = cy = (size - 1) / 2
    r = size / 2
    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if d <= r:
                t = max(0.0, min(1.0, (y / size) * 0.7 + (x / size) * 0.3))
                px[x, y] = (*lerp(c1, c2, t), 255)
    return img


def draw_clock_face(draw: ImageDraw.ImageDraw, size: int, inset: int):
    box = (inset, inset, size - inset, size - inset)
    ring_w = max(1, size // 16)
    draw.ellipse(box, outline=(255, 255, 255, 230), width=ring_w)

    cx = cy = (size - 1) / 2
    r_outer = (size / 2) - inset
    r_inner = r_outer * 0.78
    tick_w = max(1, size // 32)
    for i in range(12):
        ang = math.radians(-90 + i * 30)
        x1 = cx + math.cos(ang) * r_outer
        y1 = cy + math.sin(ang) * r_outer
        x2 = cx + math.cos(ang) * r_inner
        y2 = cy + math.sin(ang) * r_inner
        draw.line([(x1, y1), (x2, y2)], fill=(255, 255, 255, 220), width=tick_w)

    hand_w = max(2, size // 14)
    hour_len = r_outer * 0.45
    min_len = r_outer * 0.7
    ang_h = math.radians(-90 + 300)
    ang_m = math.radians(-90 + 90)
    draw.line(
        [(cx, cy), (cx + math.cos(ang_h) * hour_len, cy + math.sin(ang_h) * hour_len)],
        fill=(255, 255, 255, 240), width=hand_w,
    )
    draw.line(
        [(cx, cy), (cx + math.cos(ang_m) * min_len, cy + math.sin(ang_m) * min_len)],
        fill=(255, 255, 255, 240), width=hand_w,
    )
    center_r = max(1, size // 22)
    draw.ellipse(
        (cx - center_r, cy - center_r, cx + center_r, cy + center_r),
        fill=(255, 255, 255, 255),
    )


def draw_slash(img: Image.Image, size: int):
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    pad = size * 0.12
    width = max(3, size // 8)
    od.line(
        [(pad, size - pad), (size - pad, pad)],
        fill=(255, 52, 78, 255), width=width,
    )
    od.line(
        [(pad, size - pad), (size - pad, pad)],
        fill=(255, 120, 140, 180), width=max(1, width // 3),
    )
    img.alpha_composite(overlay)


def generate(size: int) -> Image.Image:
    SUP = 4 if size <= 48 else 2
    big = size * SUP
    shadow = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    pad = big // 12
    sd.ellipse((pad, pad + big // 40, big - pad, big - pad + big // 40),
               fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=big / 40))

    disk = make_gradient_disk(big, (18, 196, 233), (170, 58, 220))
    composite = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    composite.alpha_composite(shadow)
    composite.alpha_composite(disk)

    d = ImageDraw.Draw(composite)
    inset = max(2, big // 10)
    draw_clock_face(d, big, inset)

    draw_slash(composite, big)

    return composite.resize((size, size), Image.LANCZOS)


def main():
    for s in SIZES:
        img = generate(s)
        out = OUT_DIR / f"icon{s}.png"
        img.save(out, "PNG", optimize=True)
        print(f"wrote {out}  ({s}x{s})")


if __name__ == "__main__":
    main()
