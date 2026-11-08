"""生成 WayMuse 的绿色球体图标（#036f3b + 两只白色胶囊眼）。

一次性脚本：改了品牌色或眼睛比例时重跑即可。
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GREEN = (3, 111, 59)       # #036f3b
EYE = (247, 248, 247)      # 和 BotAvatar 一致


def render(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), GREEN)
    d = ImageDraw.Draw(img)
    s = size / 1024

    # 两只胶囊眼：宽 110、高 190、圆角 55，中心分别在 x=400 / 624
    ew, eh, r = 110 * s, 190 * s, 55 * s
    for cx in (400 * s, 624 * s):
        cy = 512 * s
        d.rounded_rectangle(
            [cx - ew / 2, cy - eh / 2, cx + ew / 2, cy + eh / 2],
            radius=r,
            fill=EYE,
        )
    return img


TARGETS = [
    ("public/icons/icon-1024.png", 1024),
    ("public/icons/icon-512.png", 512),
    ("public/icons/icon-192.png", 192),
    ("public/icons/apple-touch-icon.png", 180),
    ("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", 1024),
]

for rel, size in TARGETS:
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    render(size).save(path, "PNG")
    print(f"wrote {rel} ({size}x{size})")

svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#036f3b"/>
  <rect x="345" y="417" width="110" height="190" rx="55" fill="#f7f8f7"/>
  <rect x="569" y="417" width="110" height="190" rx="55" fill="#f7f8f7"/>
</svg>
"""
with open(os.path.join(ROOT, "public/icon.svg"), "w", encoding="utf-8") as f:
    f.write(svg)
print("wrote public/icon.svg")
