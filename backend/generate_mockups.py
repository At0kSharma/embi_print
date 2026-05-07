"""One-off helper: generate placeholder garment mockup PNGs for each
seeded product. Real product photography replaces these for launch.

Run from inside the python:3.10-slim helper container with the host
frontend/public/mockups dir mounted at /work/mockups (see README).

Output convention: /work/mockups/{slug}/{color}/{view}.png
"""
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT_ROOT = Path(os.environ.get("MOCKUP_OUT", "/work/mockups"))
SIZE = (800, 1000)


# ── color palette ──────────────────────────────────────────────
COLORS = {
    "white":    {"fill": (250, 250, 250), "outline": (60, 60, 60)},
    "black":    {"fill": (30, 30, 30),    "outline": (200, 200, 200)},
    "navy":     {"fill": (27, 42, 74),    "outline": (200, 210, 230)},
    "forest":   {"fill": (31, 77, 63),    "outline": (200, 220, 210)},
    "charcoal": {"fill": (60, 60, 65),    "outline": (200, 200, 210)},
}


# ── per-garment silhouettes ────────────────────────────────────

def shirt_silhouette(draw, fill, outline, view):
    pts = [
        (200, 200), (320, 150), (480, 150), (600, 200),
        (700, 280), (620, 320), (620, 900), (180, 900),
        (180, 320), (100, 280),
    ]
    draw.polygon(pts, fill=fill, outline=outline, width=4)
    draw.arc((320, 130, 480, 220), start=0, end=180, fill=outline, width=4)


def hoodie_silhouette(draw, fill, outline, view):
    # Body
    pts = [
        (200, 230), (320, 170), (480, 170), (600, 230),
        (720, 320), (620, 360), (620, 920), (180, 920),
        (180, 360), (80, 320),
    ]
    draw.polygon(pts, fill=fill, outline=outline, width=4)
    if view == "front":
        # Hood draped at back of neck
        draw.polygon([(330, 195), (470, 195), (495, 280), (305, 280)],
                     fill=fill, outline=outline, width=3)
        # Drawstrings
        draw.line([(380, 280), (380, 360)], fill=outline, width=3)
        draw.line([(420, 280), (420, 360)], fill=outline, width=3)
        # Kangaroo pocket
        draw.polygon([(280, 580), (520, 580), (560, 720), (240, 720)],
                     fill=fill, outline=outline, width=2)
    else:  # back view: hood up
        draw.polygon([(280, 130), (520, 130), (540, 280), (260, 280)],
                     fill=fill, outline=outline, width=3)


def jacket_silhouette(draw, fill, outline, view):
    pts = [
        (180, 220), (310, 160), (490, 160), (620, 220),
        (740, 320), (640, 360), (640, 920), (160, 920),
        (160, 360), (60, 320),
    ]
    draw.polygon(pts, fill=fill, outline=outline, width=4)
    if view == "front":
        # Center zipper
        draw.line([(400, 220), (400, 920)], fill=outline, width=3)
        # Side pockets
        draw.line([(240, 660), (340, 700)], fill=outline, width=2)
        draw.line([(560, 660), (460, 700)], fill=outline, width=2)
        # Ribbed cuffs hint
        draw.line([(160, 870), (640, 870)], fill=outline, width=1)


def cap_silhouette(draw, fill, outline, view):
    if view == "front":
        # Crown
        draw.pieslice((180, 320, 620, 760), start=180, end=360,
                      fill=fill, outline=outline, width=4)
        # Brim
        draw.polygon([(120, 540), (680, 540), (640, 600), (160, 600)],
                     fill=fill, outline=outline, width=4)
        # Front panel seam (curved hint)
        draw.arc((180, 340, 620, 600), start=200, end=340,
                 fill=outline, width=2)
    else:  # back: snap-back style
        draw.pieslice((180, 320, 620, 760), start=180, end=360,
                      fill=fill, outline=outline, width=4)
        draw.line([(280, 540), (520, 540)], fill=outline, width=2)
        # Hint of adjustable strap
        draw.rectangle([(360, 520), (440, 560)], outline=outline, width=2)


def beanie_silhouette(draw, fill, outline, view):
    # Cone shape with cuff
    draw.polygon([(220, 320), (580, 320), (560, 700), (240, 700)],
                 fill=fill, outline=outline, width=4)
    # Cuff
    draw.rectangle([(220, 660), (580, 740)], outline=outline, width=4)
    draw.line([(220, 700), (580, 700)], fill=outline, width=3)
    # Decorative seams on top
    if view == "front":
        for x in (320, 400, 480):
            draw.line([(x, 320), (x, 380)], fill=outline, width=1)


SILHOUETTES = {
    "shirt": shirt_silhouette,
    "hoodie": hoodie_silhouette,
    "jacket": jacket_silhouette,
    "cap": cap_silhouette,
    "beanie": beanie_silhouette,
}


# ── product config ─────────────────────────────────────────────
# (slug, garment_type, [color list], [view list])
PRODUCTS = [
    ("classic-tee",      "shirt",  ["white", "black"],            ["front", "back"]),
    ("essential-tee",    "shirt",  ["white", "black", "navy"],    ["front", "back"]),
    ("pullover-hoodie",  "hoodie", ["black", "navy", "forest"],   ["front", "back"]),
    ("varsity-jacket",   "jacket", ["black", "navy"],             ["front", "back"]),
    ("dad-cap",          "cap",    ["black", "navy", "white"],    ["front", "back"]),
    ("beanie",           "beanie", ["black", "charcoal", "navy"], ["front"]),
]


def main():
    for slug, garment, colors, views in PRODUCTS:
        silhouette = SILHOUETTES[garment]
        for color in colors:
            palette = COLORS[color]
            for view in views:
                img = Image.new("RGB", SIZE, (245, 245, 245))
                draw = ImageDraw.Draw(img)
                silhouette(draw, palette["fill"], palette["outline"], view)
                if view == "back":
                    draw.text((360, 480), "BACK", fill=palette["outline"])
                out = OUT_ROOT / slug / color / f"{view}.png"
                out.parent.mkdir(parents=True, exist_ok=True)
                img.save(out)
                print(f"  wrote {out}")
        print(f"✓ {slug} ({len(colors)} colors × {len(views)} views)")


if __name__ == "__main__":
    main()
