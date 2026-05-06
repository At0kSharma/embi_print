"""One-off helper: generate placeholder t-shirt mockup PNGs.

The real product would use photographed garments. For v1 these are
simple silhouettes good enough to drive the customizer canvas. Run:
    docker compose exec fastapi python generate_mockups.py
"""
import os
from pathlib import Path

from PIL import Image, ImageDraw

# Default to the host-mounted path used in `docker run`; override with
# MOCKUP_OUT for one-off invocations.
OUT_ROOT = Path(os.environ.get("MOCKUP_OUT", "/work/mockups"))

SIZE = (800, 1000)


def shirt_silhouette(draw: ImageDraw.ImageDraw, fill: tuple, outline: tuple) -> None:
    """Draw a simple t-shirt silhouette."""
    # Body (rounded rectangle approximation)
    draw.polygon(
        [
            (200, 200),  # left shoulder top
            (320, 150),  # left neck
            (480, 150),  # right neck
            (600, 200),  # right shoulder top
            (700, 280),  # right shoulder bottom
            (620, 320),  # right armpit
            (620, 900),  # right hem
            (180, 900),  # left hem
            (180, 320),  # left armpit
            (100, 280),  # left shoulder bottom
        ],
        fill=fill,
        outline=outline,
        width=4,
    )
    # Neckline curve
    draw.arc((320, 130, 480, 220), start=0, end=180, fill=outline, width=4)


def main():
    for color_name, (fill, outline) in {
        "white": ((250, 250, 250), (60, 60, 60)),
        "black": ((30, 30, 30), (200, 200, 200)),
    }.items():
        for view in ("front", "back"):
            img = Image.new("RGB", SIZE, (245, 245, 245))
            draw = ImageDraw.Draw(img)
            shirt_silhouette(draw, fill, outline)
            if view == "back":
                # Annotate so back is distinguishable
                draw.text((350, 500), "BACK", fill=outline)
            out = OUT_ROOT / color_name / f"{view}.png"
            out.parent.mkdir(parents=True, exist_ok=True)
            img.save(out)
            print(f"wrote {out}")


if __name__ == "__main__":
    main()
